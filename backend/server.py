from __future__ import annotations

import asyncio
import json
import os
from typing import Any
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

import backend.data_store as data_store
from backend.auth import LoginRequest, TokenPayload, TokenResponse, create_access_token, decode_token, require_doctor, require_patient, verify_password, verify_token
from backend.clinical_engine import analyze_clinical_case
from backend.data_store import (
    MYSQL_DATABASE,
    MYSQL_HOST,
    MYSQL_PORT,
    MYSQL_USER,
    append_audit as repo_append_audit,
    create_report_and_update_patient,
    delete_patient_report as repo_delete_patient_report,
    doctor_can_access as repo_doctor_can_access,
    get_audit_logs as repo_get_audit_logs,
    get_doctor_dashboard as repo_get_doctor_dashboard,
    get_doctor_patients as repo_get_doctor_patients,
    get_federation_stats as repo_get_federation_stats,
    get_models as repo_get_models,
    get_nodes as repo_get_nodes,
    get_patient_by_public_id,
    get_patient_by_user_id,
    get_patient_diet_plan,
    get_patient_reports as repo_get_patient_reports,
    get_patient_mental_health,
    get_patient_vital_forecast,
    get_patient_vitals,
    get_user_for_login,
    register_patient,
    start_federated_round as repo_start_federated_round,
    update_patient_live_tracking as repo_update_patient_live_tracking,
    update_patient_report as repo_update_patient_report,
)
from backend.drug_analyzer import analyze_drug_with_gemini
from backend.report_explainer import SECURE_REPORTS_DIR, build_report_analysis_pdf, explain_report_with_gemini


app = FastAPI(
    title="Health Nexus API",
    description="Doctor-oriented federated clinical decision support backend",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",")
origins = [
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:5173",
    "https://healthnexuss.netlify.app",
]
if any(ALLOWED_ORIGINS):
    origins.extend([o.strip() for o in ALLOWED_ORIGINS if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|.*\.netlify\.app)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PATIENT_EVENT_SUBSCRIBERS: dict[str, set[asyncio.Queue[str]]] = {}


def _broadcast_patient_event(patient_id: str, event_type: str, payload: dict[str, Any] | None = None) -> None:
    listeners = PATIENT_EVENT_SUBSCRIBERS.get(patient_id)
    if not listeners:
        return

    message = {
        "patient_id": patient_id,
        "event": event_type,
        "timestamp": data_store._utc_now(),
    }
    if payload:
        message.update(payload)

    data = json.dumps(message)
    for queue in list(listeners):
        try:
            queue.put_nowait(data)
        except asyncio.QueueFull:
            continue


def _register_patient_listener(patient_id: str, queue: asyncio.Queue[str]) -> None:
    PATIENT_EVENT_SUBSCRIBERS.setdefault(patient_id, set()).add(queue)


def _unregister_patient_listener(patient_id: str, queue: asyncio.Queue[str]) -> None:
    listeners = PATIENT_EVENT_SUBSCRIBERS.get(patient_id)
    if not listeners:
        return
    listeners.discard(queue)
    if not listeners:
        PATIENT_EVENT_SUBSCRIBERS.pop(patient_id, None)


class TreatmentOutcomeRequest(BaseModel):
    patient_id: str
    condition: str


class SOAPRequest(BaseModel):
    patient_id: str
    visit_notes: str


class PrescriptionCheckRequest(BaseModel):
    drugs: list[str]


class DrugAnalysisRequest(BaseModel):
    drug_name: str
    patient_id: str | None = None


class ClinicalAnalysisRequest(BaseModel):
    patient_id: str
    age: int = Field(ge=0, le=130)
    gender: str
    systolic_bp: float
    diastolic_bp: float
    sugar_level: float
    cholesterol: float
    ecg: str
    heart_rate: float
    oxygen_level: float
    previous_disease_history: list[str] = Field(default_factory=list)


class PatientRegisterRequest(BaseModel):
    user_id: str
    password: str
    full_name: str
    age: int
    gender: str
    email: str
    phone: str | None = None
    blood_group: str
    chronic_illness: str | None = None
    genetic_conditions: str | None = None
    family_history: list[str] = Field(default_factory=list)
    lifestyle: dict[str, Any] = Field(default_factory=dict)


class MentalHealthAnswersRequest(BaseModel):
    answers: dict[str, str] = Field(default_factory=dict)


class ReportExplanationResponse(BaseModel):
    detailed_explanation: str
    patient_friendly_summary: str
    clinical_takeaways: list[str]
    recommended_questions: list[str]
    recommendations: list[str]
    note: str


class LiveTrackingUpdateRequest(BaseModel):
    latest_vitals: dict[str, Any] | None = None
    recommendation: str | None = None
    condition: str | None = None
    risk: str | None = None
    last_visit: str | None = None


class ReportUpdateRequest(BaseModel):
    name: str | None = None
    follow_up: str | None = None
    ai_summary: str | None = None
    explanation: str | None = None
    recommendations: list[str] | None = None
    severity_score: int | None = None
    risk_level: str | None = None


TRAINING_SUMMARY_PATH = Path("demo_data") / "federated" / "training_summary.json"
SECURE_REPORTS_DIR.mkdir(parents=True, exist_ok=True)


MENTAL_HEALTH_OPTION_SCORES: dict[str, dict[str, int]] = {
    "1": {"very low": 5, "low": 12, "neutral": 18, "good": 23, "excellent": 25},
    "2": {"< 4": 4, "4-5": 10, "6-7": 18, "7-8": 25, "> 8": 22},
    "3": {"very high": 4, "high": 10, "moderate": 17, "low": 23, "minimal": 25},
    "4": {"exhausted": 5, "tired": 11, "average": 18, "energized": 23, "very active": 25},
}


def _score_mental_health_answers(patient_id: str, answers: dict[str, str]) -> dict[str, Any]:
    normalized = {str(key): str(value).strip().lower() for key, value in answers.items()}
    total = 0
    answered = 0
    for question_id, score_map in MENTAL_HEALTH_OPTION_SCORES.items():
        answer = normalized.get(question_id)
        if answer and answer in score_map:
            total += score_map[answer]
            answered += 1

    if answered == 0:
        return get_patient_mental_health(patient_id)

    wellness_score = max(0, min(100, int(total * (4 / answered))))
    if wellness_score >= 80:
        burnout_risk = "Low"
    elif wellness_score >= 65:
        burnout_risk = "Low-Moderate"
    elif wellness_score >= 45:
        burnout_risk = "Moderate"
    else:
        burnout_risk = "High"

    if wellness_score <= 10:
        recommendations = [
            {"category": "Focus", "text": "Immediate intervention"},
            {"category": "Medical", "text": "Consult a doctor for full health screening"},
            {"category": "Physical Activity", "text": "Start 5–10 min walking daily"},
            {"category": "Hydration", "text": "Drink at least 2L water/day"},
            {"category": "Sleep", "text": "Fix sleep to minimum 6 hours"},
            {"category": "Diet", "text": "Eliminate sugary drinks + processed foods"},
        ]
    elif wellness_score <= 20:
        recommendations = [
            {"category": "Focus", "text": "Stabilization"},
            {"category": "Physical Activity", "text": "Walk 2,000+ steps daily"},
            {"category": "Diet", "text": "Add fruits once/day"},
            {"category": "Sleep", "text": "Sleep before 11 PM"},
            {"category": "Mental Peace", "text": "Practice 5 mins deep breathing"},
            {"category": "Monitoring", "text": "Track BP, sugar, or weight weekly"},
        ]
    elif wellness_score <= 30:
        recommendations = [
            {"category": "Focus", "text": "Basic recovery"},
            {"category": "Physical Activity", "text": "15 mins physical activity/day"},
            {"category": "Diet", "text": "Reduce fried food to 2x/week"},
            {"category": "Diet", "text": "Increase protein intake"},
            {"category": "Hydration", "text": "Maintain hydration schedule"},
            {"category": "Sleep", "text": "Limit screen time before bed"},
        ]
    elif wellness_score <= 40:
        recommendations = [
            {"category": "Focus", "text": "Habit building"},
            {"category": "Physical Activity", "text": "5,000 steps/day"},
            {"category": "Sleep", "text": "7 hours sleep target"},
            {"category": "Diet", "text": "Add vegetables to 2 meals/day"},
            {"category": "Mental Peace", "text": "Weekly stress management activity"},
            {"category": "Diet", "text": "Reduce caffeine + junk snacks"},
        ]
    elif wellness_score <= 50:
        recommendations = [
            {"category": "Focus", "text": "Structured improvement"},
            {"category": "Physical Activity", "text": "Exercise 30 mins, 4x/week"},
            {"category": "Diet", "text": "Balanced breakfast daily"},
            {"category": "Monitoring", "text": "Monitor BMI progress"},
            {"category": "Mental Peace", "text": "Practice mindfulness 10 mins/day"},
            {"category": "Medical", "text": "Regular preventive blood tests"},
        ]
    elif wellness_score <= 60:
        recommendations = [
            {"category": "Focus", "text": "Consistency"},
            {"category": "Physical Activity", "text": "7,000 steps/day"},
            {"category": "Physical Activity", "text": "Strength training 2x/week"},
            {"category": "Diet", "text": "Reduce sugar intake"},
            {"category": "Hydration", "text": "Hydrate every 2 hours"},
            {"category": "Physical Activity", "text": "Improve posture + stretching"},
        ]
    elif wellness_score <= 70:
        recommendations = [
            {"category": "Focus", "text": "Optimization"},
            {"category": "Physical Activity", "text": "8,000–10,000 steps/day"},
            {"category": "Diet", "text": "Mediterranean-style diet"},
            {"category": "Sleep", "text": "7–8 hrs quality sleep"},
            {"category": "Physical Activity", "text": "Weekly fitness goal progression"},
            {"category": "Mental Peace", "text": "Mental wellness journaling"},
        ]
    elif wellness_score <= 80:
        recommendations = [
            {"category": "Focus", "text": "Performance enhancement"},
            {"category": "Physical Activity", "text": "Strength + cardio mix"},
            {"category": "Diet", "text": "Track macros (protein/fiber)"},
            {"category": "Medical", "text": "Preventive checkups every 6 months"},
            {"category": "Mental Peace", "text": "Digital detox sessions"},
            {"category": "Physical Activity", "text": "Improve flexibility/yoga"},
        ]
    elif wellness_score <= 90:
        recommendations = [
            {"category": "Focus", "text": "Peak maintenance"},
            {"category": "Physical Activity", "text": "Advanced fitness routine"},
            {"category": "Diet", "text": "Personalized nutrient optimization"},
            {"category": "Monitoring", "text": "Recovery monitoring (HRV/sleep)"},
            {"category": "Social", "text": "Mentor family/friends wellness"},
            {"category": "Mental Peace", "text": "Maintain emotional resilience habits"},
        ]
    elif wellness_score <= 99:
        recommendations = [
            {"category": "Focus", "text": "Longevity"},
            {"category": "Monitoring", "text": "Bio-marker tracking"},
            {"category": "Physical Activity", "text": "Periodized training plans"},
            {"category": "Mental Peace", "text": "Advanced mental resilience"},
            {"category": "Diet", "text": "Longevity diet protocols"},
            {"category": "Mental Peace", "text": "Prevent overtraining + burnout"},
        ]
    else:
        recommendations = [
            {"category": "Focus", "text": "Sustain excellence"},
            {"category": "Physical Activity", "text": "Maintain elite routine consistently"},
            {"category": "Medical", "text": "Annual comprehensive health audit"},
            {"category": "Social", "text": "Share best practices/community leadership"},
            {"category": "Physical Activity", "text": "Continue adaptive fitness goals"},
            {"category": "Focus", "text": "Focus on longevity + preventive science"},
        ]

    return {
        "patient_id": patient_id,
        "date": get_patient_mental_health(patient_id)["date"],
        "wellness_score": wellness_score,
        "burnout_risk": burnout_risk,
        "dimensions": [
            {"subject": "Mood", "value": max(35, min(95, wellness_score - 2))},
            {"subject": "Sleep", "value": max(30, min(95, wellness_score - 4))},
            {"subject": "Energy", "value": max(30, min(95, wellness_score - 1))},
            {"subject": "Focus", "value": max(30, min(95, wellness_score - 6))},
            {"subject": "Social", "value": max(30, min(95, wellness_score - 3))},
            {"subject": "Stress", "value": max(20, min(90, 100 - wellness_score + 15))},
        ],
        "recommendations": recommendations,
    }


@app.get("/health")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "Health Nexus API",
        "database": "mysql",
        "database_name": MYSQL_DATABASE,
    }


@app.get("/config/database")
def get_database_config(token: TokenPayload = Depends(require_doctor)) -> dict[str, str]:
    return {
        "driver": data_store.ACTIVE_DATABASE,
        "host": MYSQL_HOST,
        "port": str(MYSQL_PORT),
        "username": MYSQL_USER,
        "database_name": MYSQL_DATABASE if data_store.ACTIVE_DATABASE == "mysql" else str(data_store.SQLITE_FALLBACK_PATH),
    }


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    user = get_user_for_login(payload.user_id, payload.role)
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

    token = create_access_token(
        TokenPayload(
            user_id=user["user_id"],
            role=user["role"],
            doctor_id=user.get("doctor_id"),
            patient_id=user.get("patient_id"),
        )
    )
    return TokenResponse(access_token=token)


@app.post("/auth/register")
def register(payload: PatientRegisterRequest) -> dict[str, Any]:
    try:
      return register_patient(payload.model_dump())
    except ValueError as exc:
      raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/doctors/{doctor_id}/dashboard")
def get_doctor_dashboard(doctor_id: str, token: TokenPayload = Depends(require_doctor)) -> dict[str, Any]:
    if token.doctor_id not in {doctor_id, None} and token.role != "admin":
        raise HTTPException(status_code=403, detail="Doctor access mismatch.")
    dashboard = repo_get_doctor_dashboard(doctor_id)
    if dashboard is None:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    return dashboard


@app.get("/doctors/{doctor_id}/patients")
def get_doctor_patients(doctor_id: str, token: TokenPayload = Depends(require_doctor)) -> list[dict[str, Any]]:
    if token.doctor_id not in {doctor_id, None} and token.role != "admin":
        raise HTTPException(status_code=403, detail="Doctor access mismatch.")
    return repo_get_doctor_patients(doctor_id)


@app.get("/patients/{patient_id}")
def get_patient(patient_id: str, token: TokenPayload = Depends(verify_token)) -> dict[str, Any]:
    if token.role == "doctor" and token.doctor_id and not repo_doctor_can_access(token.doctor_id, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only access their own record.")
    patient = get_patient_by_public_id(patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return patient


@app.get("/patients/{patient_id}/reports")
def get_patient_reports(patient_id: str, token: TokenPayload = Depends(verify_token)) -> list[dict[str, Any]]:
    if token.role == "doctor" and token.doctor_id and not repo_doctor_can_access(token.doctor_id, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only access their own reports.")
    return repo_get_patient_reports(patient_id)


@app.post("/patients/{patient_id}/reports/{report_id}/explain", response_model=ReportExplanationResponse)
def explain_patient_report(patient_id: str, report_id: str, token: TokenPayload = Depends(verify_token)) -> dict[str, Any]:
    if token.role == "doctor" and token.doctor_id and not repo_doctor_can_access(token.doctor_id, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only access their own reports.")
    patient = get_patient_by_public_id(patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    report = next((item for item in repo_get_patient_reports(patient_id) if item["id"] == report_id), None)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found.")
    return explain_report_with_gemini(report, patient)


@app.get("/patients/{patient_id}/reports/{report_id}/analysis.pdf")
def download_patient_report_analysis_pdf(patient_id: str, report_id: str, token: TokenPayload = Depends(verify_token)) -> Response:
    if token.role == "doctor" and token.doctor_id and not repo_doctor_can_access(token.doctor_id, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only access their own reports.")
    patient = get_patient_by_public_id(patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    report = next((item for item in repo_get_patient_reports(patient_id) if item["id"] == report_id), None)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found.")
    analysis = explain_report_with_gemini(report, patient)
    pdf_bytes = build_report_analysis_pdf(patient, report, analysis)
    filename = f"{report_id.lower()}-analysis.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.patch("/patients/{patient_id}/live-tracking")
def update_patient_live_tracking_endpoint(
    patient_id: str,
    payload: LiveTrackingUpdateRequest,
    token: TokenPayload = Depends(verify_token),
) -> dict[str, Any]:
    if token.role == "doctor" and token.doctor_id and not repo_doctor_can_access(token.doctor_id, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only update their own tracking record.")
    try:
        patient = repo_update_patient_live_tracking(
            patient_id,
            latest_vitals=payload.latest_vitals,
            recommendation=payload.recommendation,
            condition=payload.condition,
            risk=payload.risk,
            last_visit=payload.last_visit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    repo_append_audit("patient_live_tracking_updated", "success", metadata={"patient_id": patient_id})
    _broadcast_patient_event(patient_id, "patient_live_tracking_updated", {"patient": patient})
    return patient


@app.patch("/patients/{patient_id}/reports/{report_id}")
def update_patient_report_endpoint(
    patient_id: str,
    report_id: str,
    payload: ReportUpdateRequest,
    token: TokenPayload = Depends(verify_token),
) -> dict[str, Any]:
    if token.role == "doctor" and token.doctor_id and not repo_doctor_can_access(token.doctor_id, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only update their own reports.")
    try:
        report = repo_update_patient_report(
            patient_id,
            report_id,
            name=payload.name,
            follow_up=payload.follow_up,
            ai_summary=payload.ai_summary,
            explanation=payload.explanation,
            recommendations=payload.recommendations,
            severity_score=payload.severity_score,
            risk_level=payload.risk_level,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    repo_append_audit("patient_report_updated", "success", metadata={"patient_id": patient_id, "report_id": report_id})
    _broadcast_patient_event(patient_id, "patient_report_updated", {"report": report})
    return report


@app.delete("/patients/{patient_id}/reports/{report_id}")
def delete_patient_report_endpoint(
    patient_id: str,
    report_id: str,
    token: TokenPayload = Depends(verify_token),
) -> dict[str, str]:
    if token.role == "doctor" and token.doctor_id and not repo_doctor_can_access(token.doctor_id, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only delete their own reports.")
    try:
        repo_delete_patient_report(patient_id, report_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    repo_append_audit("patient_report_deleted", "success", metadata={"patient_id": patient_id, "report_id": report_id})
    _broadcast_patient_event(patient_id, "patient_report_deleted", {"report_id": report_id})
    return {"message": "Report deleted successfully."}


@app.get("/patients/{patient_id}/events")
async def patient_events(
    patient_id: str,
    request: Request,
    access_token: str | None = None,
) -> StreamingResponse:
    if not access_token:
        raise HTTPException(status_code=401, detail="Authentication token required.")

    token = decode_token(access_token)
    if token.role == "doctor" and token.doctor_id and not repo_doctor_can_access(token.doctor_id, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only subscribe to their own record.")

    patient = get_patient_by_public_id(patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")

    # Track the last known state to detect changes
    last_seen_updated_at = str(patient.get("updated_at") or "")
    last_seen_risk = patient.get("risk")
    last_seen_vitals = str(patient.get("latest_vitals") or "")

    async def event_stream():
        nonlocal last_seen_updated_at, last_seen_risk, last_seen_vitals
        yield "event: ready\ndata: {\"status\":\"connected\"}\n\n"
        idle_seconds = 0
        check_count = 0
        
        while True:
            if await request.is_disconnected():
                break
            
            # Poll for updates more frequently (every 1 second instead of 2)
            await asyncio.sleep(1)
            check_count += 1
            idle_seconds += 1
            
            current_patient = get_patient_by_public_id(patient_id)
            if current_patient is None:
                break

            # Check for any changes in the patient record
            current_updated_at = str(current_patient.get("updated_at") or "")
            current_risk = current_patient.get("risk")
            current_vitals = str(current_patient.get("latest_vitals") or "")
            
            has_changes = (
                (current_updated_at and current_updated_at != last_seen_updated_at) or
                (current_risk and current_risk != last_seen_risk) or
                (current_vitals and current_vitals != last_seen_vitals)
            )
            
            if has_changes:
                # Update tracked state
                last_seen_updated_at = current_updated_at
                last_seen_risk = current_risk
                last_seen_vitals = current_vitals
                
                payload = json.dumps(
                    {
                        "patient_id": patient_id,
                        "event": "patient_update",
                        "updated_at": current_updated_at,
                        "timestamp": _utc_now(),
                    }
                )
                yield f"event: patient-update\ndata: {payload}\n\n"
                idle_seconds = 0
                check_count = 0
                continue

            # Send periodic ping to keep connection alive and signal server is listening
            if idle_seconds >= 20:
                yield ": ping\n\n"
                idle_seconds = 0

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/patients/{patient_id}/vitals")
def get_patient_vitals_endpoint(patient_id: str, token: TokenPayload = Depends(verify_token)) -> list[dict[str, Any]]:
    if token.role == "doctor" and token.doctor_id and not repo_doctor_can_access(token.doctor_id, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only access their own vitals.")
    return get_patient_vitals(patient_id)


@app.get("/patients/{patient_id}/vitals/forecast")
def get_patient_vitals_forecast_endpoint(patient_id: str, token: TokenPayload = Depends(verify_token)) -> dict[str, Any]:
    if token.role == "doctor" and token.doctor_id and not repo_doctor_can_access(token.doctor_id, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only access their own forecast.")
    return get_patient_vital_forecast(patient_id)


@app.get("/patients/{patient_id}/diet")
def get_patient_diet_endpoint(patient_id: str, token: TokenPayload = Depends(verify_token)) -> dict[str, Any]:
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only access their own diet plan.")
    return get_patient_diet_plan(patient_id)


@app.get("/patients/{patient_id}/mental-health")
def get_patient_mental_health_endpoint(patient_id: str, token: TokenPayload = Depends(verify_token)) -> dict[str, Any]:
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only access their own mental health data.")
    return get_patient_mental_health(patient_id)


@app.post("/patients/{patient_id}/mental-health")
def submit_patient_mental_health_answers(
    patient_id: str,
    payload: MentalHealthAnswersRequest,
    token: TokenPayload = Depends(verify_token),
) -> dict[str, Any]:
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only submit their own mental health answers.")
    if token.role == "doctor" and token.doctor_id and not repo_doctor_can_access(token.doctor_id, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    return _score_mental_health_answers(patient_id, payload.answers)


@app.get("/patients/me")
def get_current_patient(token: TokenPayload = Depends(require_patient)) -> dict[str, Any]:
    patient = get_patient_by_user_id(token.user_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return patient


@app.post("/clinical/analyze")
def analyze_report(payload: ClinicalAnalysisRequest, token: TokenPayload = Depends(require_doctor)) -> dict[str, Any]:
    if token.doctor_id and not repo_doctor_can_access(token.doctor_id, payload.patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    result = analyze_clinical_case(payload.model_dump())
    report = create_report_and_update_patient(
        patient_public_id=payload.patient_id,
        result=result,
        vitals={
            "heart_rate": payload.heart_rate,
            "systolic_bp": payload.systolic_bp,
            "diastolic_bp": payload.diastolic_bp,
            "blood_sugar": payload.sugar_level,
            "cholesterol": payload.cholesterol,
            "ecg": payload.ecg,
            "oxygen_level": payload.oxygen_level,
        },
        report_name="Clinical analysis",
        report_type="JSON",
    )
    repo_append_audit("clinical_analysis_generated", "success", metadata={"patient_id": payload.patient_id, "risk_level": result["risk_level"]})
    _broadcast_patient_event(payload.patient_id, "patient_live_tracking_updated", {"report": report})
    return report


@app.post("/patients/{patient_id}/reports")
async def upload_patient_report(
    patient_id: str,
    file: UploadFile = File(...),
    age: int = Form(...),
    gender: str = Form(...),
    systolic_bp: float = Form(...),
    diastolic_bp: float = Form(...),
    sugar_level: float = Form(...),
    cholesterol: float = Form(...),
    ecg: str = Form(...),
    heart_rate: float = Form(...),
    oxygen_level: float = Form(...),
    previous_disease_history: str = Form(""),
    token: TokenPayload = Depends(verify_token),
) -> dict[str, Any]:
    if token.role == "doctor" and token.doctor_id and not repo_doctor_can_access(token.doctor_id, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only upload reports for their own account.")
    contents = await file.read()
    safe_name = Path(file.filename or "uploaded-report.pdf").name
    stored_name = f"{patient_id}-{safe_name}"
    stored_path = SECURE_REPORTS_DIR / stored_name
    stored_path.write_bytes(contents)
    result = analyze_clinical_case(
        {
            "patient_id": patient_id,
            "age": age,
            "gender": gender,
            "systolic_bp": systolic_bp,
            "diastolic_bp": diastolic_bp,
            "sugar_level": sugar_level,
            "cholesterol": cholesterol,
            "ecg": ecg,
            "heart_rate": heart_rate,
            "oxygen_level": oxygen_level,
            "previous_disease_history": previous_disease_history,
        },
        file_name=file.filename,
    )
    report = create_report_and_update_patient(
        patient_public_id=patient_id,
        result=result,
        vitals={
            "heart_rate": heart_rate,
            "systolic_bp": systolic_bp,
            "diastolic_bp": diastolic_bp,
            "blood_sugar": sugar_level,
            "cholesterol": cholesterol,
            "ecg": ecg,
            "oxygen_level": oxygen_level,
        },
        report_name=file.filename or "Uploaded report",
        report_type="PDF" if (file.filename or "").lower().endswith(".pdf") else "JSON",
        file_url=f"/secure-reports/{stored_name}",
    )
    report["file_size"] = len(contents)
    repo_append_audit("medical_report_uploaded", "success", metadata={"patient_id": patient_id, "file_name": file.filename})
    _broadcast_patient_event(patient_id, "patient_report_uploaded", {"report": report})
    return report


@app.post("/clinical/soap")
def generate_soap(payload: SOAPRequest, token: TokenPayload = Depends(require_doctor)) -> dict[str, str]:
    if token.doctor_id and not repo_doctor_can_access(token.doctor_id, payload.patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    patient = get_patient_by_public_id(payload.patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    latest = patient["latest_vitals"]
    soap = (
        f"S: {patient['full_name']} reports ongoing concerns aligned with {patient['condition']}. {payload.visit_notes}\n"
        f"O: BP {latest['systolic_bp']}/{latest['diastolic_bp']} mmHg, HR {latest['heart_rate']} bpm, SpO2 {latest['oxygen_level']}%, ECG {latest['ecg']}.\n"
        f"A: Federated clinical engine categorizes current risk as {patient['risk']} with focus on {patient['condition']}.\n"
        f"P: {patient['recommendation']}"
    )
    return {"soap": soap}


@app.post("/clinical/prescription/check")
def check_prescription(payload: PrescriptionCheckRequest, token: TokenPayload = Depends(require_doctor)) -> dict[str, Any]:
    normalized = {drug.strip().lower() for drug in payload.drugs if drug.strip()}
    
    # 25 Manual Mock Interactions
    INTERACTIONS_DB = [
        # High Risk
        {
            "pair": {"warfarin", "aspirin"},
            "severity": "High",
            "severity_score": 95,
            "interaction_type": "Pharmacodynamic (Synergistic Bleeding Risk)",
            "note": "Concurrent use significantly increases the risk of severe bleeding.",
            "safer_alternatives": ["Consider monotherapy if appropriate", "Use Clopidogrel instead if dual therapy is strictly required, with monitoring"],
            "food_lifestyle_warnings": ["Avoid Cranberry juice", "Limit alcohol consumption", "Maintain consistent Vitamin K intake"]
        },
        {
            "pair": {"lisinopril", "spironolactone"},
            "severity": "High",
            "severity_score": 90,
            "interaction_type": "Pharmacodynamic (Additive Hyperkalemia)",
            "note": "Combination increases the risk of dangerous hyperkalemia, which can cause cardiac arrhythmias.",
            "safer_alternatives": ["Amlodipine (Calcium Channel Blocker)", "Use non-potassium sparing diuretic if appropriate"],
            "food_lifestyle_warnings": ["Avoid potassium-rich foods (bananas, spinach)", "Avoid salt substitutes containing potassium"]
        },
        {
            "pair": {"sildenafil", "isosorbide mononitrate"},
            "severity": "High",
            "severity_score": 98,
            "interaction_type": "Pharmacodynamic (Synergistic Vasodilation)",
            "note": "Absolute contraindication. Can cause severe, life-threatening hypotension.",
            "safer_alternatives": ["Alternative angina therapies (e.g., Ranolazine, Beta-blockers) if continuing Sildenafil"],
            "food_lifestyle_warnings": ["Avoid alcohol", "Avoid sudden posture changes"]
        },
        {
            "pair": {"lithium", "ibuprofen"},
            "severity": "High",
            "severity_score": 88,
            "interaction_type": "Pharmacokinetic (Decreased Renal Clearance)",
            "note": "Ibuprofen decreases lithium clearance, leading to lithium toxicity.",
            "safer_alternatives": ["Acetaminophen (Paracetamol) for pain relief", "Aspirin (does not typically affect Lithium clearance)"],
            "food_lifestyle_warnings": ["Maintain adequate hydration", "Avoid low-sodium diets"]
        },
        {
            "pair": {"digoxin", "amiodarone"},
            "severity": "High",
            "severity_score": 85,
            "interaction_type": "Pharmacokinetic (P-glycoprotein inhibition)",
            "note": "Amiodarone significantly increases Digoxin levels, risking toxicity.",
            "safer_alternatives": ["Reduce Digoxin dose by 50% if combination is necessary", "Alternative antiarrhythmics"],
            "food_lifestyle_warnings": ["Limit licorice root", "Ensure adequate dietary potassium"]
        },
        {
            "pair": {"atorvastatin", "clarithromycin"},
            "severity": "High",
            "severity_score": 92,
            "interaction_type": "Pharmacokinetic (CYP3A4 Inhibition)",
            "note": "Clarithromycin strongly inhibits Atorvastatin metabolism, increasing the risk of rhabdomyolysis.",
            "safer_alternatives": ["Azithromycin (does not inhibit CYP3A4)", "Pravastatin or Rosuvastatin (not metabolized by CYP3A4)"],
            "food_lifestyle_warnings": ["Avoid grapefruit juice", "Limit heavy, unaccustomed physical exertion"]
        },
        {
            "pair": {"fluoxetine", "phenelzine"},
            "severity": "High",
            "severity_score": 99,
            "interaction_type": "Pharmacodynamic (Excess Serotonin)",
            "note": "Absolute contraindication. Extremely high risk of fatal Serotonin Syndrome.",
            "safer_alternatives": ["Allow a 5-week washout period when switching between these agents"],
            "food_lifestyle_warnings": ["Avoid tyramine-rich foods (aged cheeses, cured meats)", "Avoid St. John's Wort"]
        },
        {
            "pair": {"ciprofloxacin", "tizanidine"},
            "severity": "High",
            "severity_score": 94,
            "interaction_type": "Pharmacokinetic (CYP1A2 Inhibition)",
            "note": "Contraindicated. Ciprofloxacin significantly increases Tizanidine levels causing severe hypotension and sedation.",
            "safer_alternatives": ["Levofloxacin (weaker CYP1A2 inhibitor)", "Alternative muscle relaxants (e.g., Cyclobenzaprine)"],
            "food_lifestyle_warnings": ["Avoid driving or operating heavy machinery", "Avoid alcohol"]
        },
        {
            "pair": {"spironolactone", "potassium"},
            "severity": "High",
            "severity_score": 95,
            "interaction_type": "Pharmacodynamic (Additive)",
            "note": "Severe hyperkalemia risk leading to cardiac arrhythmias.",
            "safer_alternatives": ["Discontinue potassium supplements while on Spironolactone", "Use a loop diuretic instead if supplements are mandatory"],
            "food_lifestyle_warnings": ["Avoid potassium-enriched salt substitutes", "Limit high-potassium foods"]
        },
        {
            "pair": {"methotrexate", "trimethoprim"},
            "severity": "High",
            "severity_score": 91,
            "interaction_type": "Pharmacodynamic (Folate Antagonism)",
            "note": "Severe bone marrow suppression risk due to additive anti-folate effects.",
            "safer_alternatives": ["Amoxicillin or Cephalexin for infections if appropriate", "Alternative immunosuppressants"],
            "food_lifestyle_warnings": ["Avoid alcohol", "Ensure adequate hydration"]
        },
        {
            "pair": {"carbamazepine", "erythromycin"},
            "severity": "High",
            "severity_score": 87,
            "interaction_type": "Pharmacokinetic (CYP3A4 Inhibition)",
            "note": "Erythromycin increases Carbamazepine levels, causing neurotoxicity (dizziness, ataxia).",
            "safer_alternatives": ["Azithromycin (does not inhibit CYP3A4)", "Alternative anticonvulsants (e.g., Levetiracetam)"],
            "food_lifestyle_warnings": ["Avoid grapefruit juice", "Do not operate heavy machinery if dizzy"]
        },
        {
            "pair": {"phenytoin", "estrogen"},
            "severity": "High",
            "severity_score": 89,
            "interaction_type": "Pharmacokinetic (CYP3A4 Induction)",
            "note": "Phenytoin induces metabolism of estrogen, leading to contraceptive failure.",
            "safer_alternatives": ["Non-hormonal contraceptives (e.g., copper IUD)", "Use Levetiracetam or Valproate which do not induce CYP3A4 as strongly"],
            "food_lifestyle_warnings": ["Use barrier methods", "Maintain consistent dietary habits"]
        },
        {
            "pair": {"azithromycin", "amiodarone"},
            "severity": "High",
            "severity_score": 86,
            "interaction_type": "Pharmacodynamic (Additive QT Prolongation)",
            "note": "Combined use increases the risk of prolonged QT interval and Torsades de Pointes.",
            "safer_alternatives": ["Amoxicillin or Doxycycline (less effect on QT interval)"],
            "food_lifestyle_warnings": ["Avoid other QT-prolonging agents", "Maintain normal magnesium and potassium levels"]
        },
        {
            "pair": {"metoprolol", "verapamil"},
            "severity": "High",
            "severity_score": 90,
            "interaction_type": "Pharmacodynamic (Additive Negative Chronotropy)",
            "note": "High risk of severe bradycardia and AV block.",
            "safer_alternatives": ["Amlodipine (Dihydropyridine CCB, less effect on heart rate)", "Alternative antihypertensive classes"],
            "food_lifestyle_warnings": ["Monitor pulse regularly", "Avoid strenuous exercise if symptomatic"]
        },

        # Moderate Risk
        {
            "pair": {"simvastatin", "amlodipine"},
            "severity": "Moderate",
            "severity_score": 65,
            "interaction_type": "Pharmacokinetic (CYP3A4 Inhibition)",
            "note": "Amlodipine can slightly increase Simvastatin levels. Dose limit for Simvastatin is 20mg daily when combined.",
            "safer_alternatives": ["Rosuvastatin or Pravastatin (not metabolized via CYP3A4)"],
            "food_lifestyle_warnings": ["Avoid Grapefruit juice", "Report unexplained muscle pain immediately"]
        },
        {
            "pair": {"omeprazole", "clopidogrel"},
            "severity": "Moderate",
            "severity_score": 70,
            "interaction_type": "Pharmacokinetic (CYP2C19 Inhibition)",
            "note": "Omeprazole may reduce the antiplatelet effect of Clopidogrel.",
            "safer_alternatives": ["Pantoprazole (less CYP2C19 inhibition)", "Alternative antiplatelets (e.g., Prasugrel, Ticagrelor)"],
            "food_lifestyle_warnings": ["Eat smaller, frequent meals for reflux", "Avoid late-night eating"]
        },
        {
            "pair": {"ibuprofen", "aspirin"},
            "severity": "Moderate",
            "severity_score": 68,
            "interaction_type": "Pharmacodynamic (Competitive Binding)",
            "note": "Ibuprofen can antagonize the cardioprotective effect of Aspirin and increase GI bleeding risk.",
            "safer_alternatives": ["Acetaminophen for pain", "Take Aspirin at least 2 hours before Ibuprofen"],
            "food_lifestyle_warnings": ["Take with food to minimize GI upset", "Avoid alcohol"]
        },
        {
            "pair": {"levothyroxine", "calcium"},
            "severity": "Moderate",
            "severity_score": 60,
            "interaction_type": "Pharmacokinetic (Decreased Absorption)",
            "note": "Calcium supplements can bind to Levothyroxine, reducing its absorption.",
            "safer_alternatives": ["Separate administration by at least 4 hours"],
            "food_lifestyle_warnings": ["Take Levothyroxine on an empty stomach", "Avoid taking with milk or coffee"]
        },
        {
            "pair": {"warfarin", "acetaminophen"},
            "severity": "Moderate",
            "severity_score": 55,
            "interaction_type": "Pharmacodynamic (Interference with Vitamin K Cycle)",
            "note": "High doses or prolonged use of Acetaminophen may increase INR.",
            "safer_alternatives": ["Limit Acetaminophen to < 2g per day", "Monitor INR if taking regularly"],
            "food_lifestyle_warnings": ["Strictly avoid alcohol", "Maintain steady Vitamin K diet"]
        },
        {
            "pair": {"albuterol", "propranolol"},
            "severity": "Moderate",
            "severity_score": 75,
            "interaction_type": "Pharmacodynamic (Antagonism)",
            "note": "Propranolol (non-selective beta-blocker) antagonizes the bronchodilating effect of Albuterol.",
            "safer_alternatives": ["Cardioselective beta-blockers (e.g., Metoprolol, Bisoprolol)", "Alternative asthma therapies"],
            "food_lifestyle_warnings": ["Avoid respiratory triggers (smoke, allergens)", "Monitor peak flow"]
        },
        {
            "pair": {"sildenafil", "tamsulosin"},
            "severity": "Moderate",
            "severity_score": 65,
            "interaction_type": "Pharmacodynamic (Additive Vasodilation)",
            "note": "Risk of symptomatic hypotension when initiated together.",
            "safer_alternatives": ["Start Tamsulosin at lowest dose", "Take medications at different times of the day"],
            "food_lifestyle_warnings": ["Rise slowly from sitting or lying down", "Stay well hydrated"]
        },
        {
            "pair": {"citalopram", "omeprazole"},
            "severity": "Moderate",
            "severity_score": 62,
            "interaction_type": "Pharmacokinetic (CYP2C19 Inhibition)",
            "note": "Omeprazole increases Citalopram levels. Max Citalopram dose is 20mg daily.",
            "safer_alternatives": ["Pantoprazole (weaker inhibitor)", "Sertraline or Escitalopram"],
            "food_lifestyle_warnings": ["Monitor for palpitations", "Report unexplained dizziness"]
        },
        {
            "pair": {"furosemide", "ibuprofen"},
            "severity": "Moderate",
            "severity_score": 68,
            "interaction_type": "Pharmacodynamic (Renal Prostaglandin Inhibition)",
            "note": "Ibuprofen can reduce the diuretic effect of Furosemide and increase renal strain.",
            "safer_alternatives": ["Acetaminophen for pain relief", "Monitor weight and BP closely if combination is required"],
            "food_lifestyle_warnings": ["Monitor daily weight for fluid retention", "Limit dietary sodium"]
        },
        {
            "pair": {"clopidogrel", "aspirin"},
            "severity": "Moderate",
            "severity_score": 72,
            "interaction_type": "Pharmacodynamic (Additive Antiplatelet)",
            "note": "Elevated bleeding risk, though frequently prescribed together intentionally post-stent placement.",
            "safer_alternatives": ["Use lowest effective dose of Aspirin (e.g., 81mg)", "Monitor closely and add PPI if GI risk is high"],
            "food_lifestyle_warnings": ["Report any unusual bleeding or bruising", "Avoid NSAIDs like Ibuprofen"]
        },

        # Low Risk / Safe
        {
            "pair": {"metformin", "lisinopril"},
            "severity": "Low",
            "severity_score": 15,
            "interaction_type": "Pharmacodynamic (No significant interaction)",
            "note": "Generally safe combination. Lisinopril is often protective for diabetic kidneys.",
            "safer_alternatives": ["No changes required"],
            "food_lifestyle_warnings": ["Maintain hydration", "Monitor kidney function annually"]
        }
    ]

    matched_interactions = []
    
    # Check combinations
    for interaction in INTERACTIONS_DB:
        if interaction["pair"].issubset(normalized):
            matched_interactions.append({
                "drugs": " + ".join([d.title() for d in interaction["pair"]]),
                "severity": interaction["severity"],
                "severity_score": interaction["severity_score"],
                "interaction_type": interaction["interaction_type"],
                "note": interaction["note"],
                "safer_alternatives": interaction["safer_alternatives"],
                "food_lifestyle_warnings": interaction["food_lifestyle_warnings"]
            })

    if not matched_interactions:
        matched_interactions.append({
            "drugs": ", ".join(payload.drugs),
            "severity": "Low",
            "severity_score": 5,
            "interaction_type": "No known specific interaction in local database",
            "note": "No high-confidence interaction detected in the local knowledge base. Verify against institutional formulary before prescribing.",
            "safer_alternatives": ["Standard prescribing guidelines apply"],
            "food_lifestyle_warnings": ["Take as directed", "Report any unexpected side effects to your physician"]
        })

    return {"interactions": matched_interactions}


@app.post("/drugs/analyze")
def analyze_drug(payload: DrugAnalysisRequest, token: TokenPayload = Depends(verify_token)) -> dict[str, Any]:
    patient_context: dict[str, Any] = {}
    if payload.patient_id:
        if token.role == "doctor" and token.doctor_id and not repo_doctor_can_access(token.doctor_id, payload.patient_id):
            raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
        if token.role == "patient" and token.patient_id != payload.patient_id:
            raise HTTPException(status_code=403, detail="Patient can only analyze drugs for their own account.")
        patient = get_patient_by_public_id(payload.patient_id)
        if patient is None:
            raise HTTPException(status_code=404, detail="Patient not found.")
        patient_context = {
            "patient_id": patient["patient_id"],
            "age": patient["age"],
            "gender": patient["gender"],
            "condition": patient.get("condition"),
            "risk": patient.get("risk"),
            "previous_disease_history": patient.get("previous_disease_history", []),
            "latest_vitals": patient.get("latest_vitals", {}),
        }
    return analyze_drug_with_gemini(payload.drug_name, patient_context)


@app.post("/clinical/outcomes")
def get_treatment_outcomes(payload: TreatmentOutcomeRequest, token: TokenPayload = Depends(require_doctor)) -> list[dict[str, Any]]:
    if token.doctor_id and not repo_doctor_can_access(token.doctor_id, payload.patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    condition = payload.condition.lower()
    if "diabetes" in condition:
        return [
            {"treatment": "Metformin + diet control", "success": 82, "risk": 16, "recovery_weeks": "12-16"},
            {"treatment": "GLP-1 agonist escalation", "success": 86, "risk": 18, "recovery_weeks": "8-12"},
        ]
    return [
        {"treatment": "Medication optimization", "success": 78, "risk": 12, "recovery_weeks": "8-12"},
        {"treatment": "Interventional cardiology review", "success": 88, "risk": 35, "recovery_weeks": "4-6"},
    ]


@app.get("/federation/nodes")
def get_nodes(token: TokenPayload = Depends(require_doctor)) -> list[dict[str, Any]]:
    return repo_get_nodes()


@app.post("/federation/round/start")
def start_federated_round(token: TokenPayload = Depends(require_doctor)) -> dict[str, Any]:
    return repo_start_federated_round()


@app.get("/federation/stats")
def get_federation_stats(token: TokenPayload = Depends(require_doctor)) -> dict[str, Any]:
    return repo_get_federation_stats()


@app.get("/models")
def get_models(token: TokenPayload = Depends(require_doctor)) -> list[dict[str, Any]]:
    return repo_get_models()


@app.get("/audit/logs")
def get_audit_logs(limit: int = 50, token: TokenPayload = Depends(require_doctor)) -> list[dict[str, Any]]:
    return repo_get_audit_logs(limit)


@app.get("/auth/demo-credentials")
def get_demo_credentials() -> dict[str, Any]:
    return {
        "doctor_id": "DOC-4892",
        "doctor_password": "doctor123",
        "patient_user_id": "alex.patient",
        "patient_password": "patient123",
        "patient_accounts": [
            {"user_id": "alex.patient", "password": "patient123", "patient_id": "PNX-84731", "name": "Alex Johnson"},
            {"user_id": "maria.patient", "password": "patient123", "patient_id": "PNX-29183", "name": "Maria Chen"},
        ],
    }


@app.get("/federation/training-summary")
def get_training_summary(token: TokenPayload = Depends(require_doctor)) -> dict[str, Any]:
    if not TRAINING_SUMMARY_PATH.exists():
        raise HTTPException(status_code=404, detail="Training summary not found. Run the synthetic federated trainer first.")
    return json.loads(TRAINING_SUMMARY_PATH.read_text(encoding="utf-8"))
