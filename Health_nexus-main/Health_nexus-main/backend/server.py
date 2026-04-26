from __future__ import annotations

import json
from typing import Any
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

import backend.data_store as data_store
from backend.auth import LoginRequest, TokenPayload, TokenResponse, create_access_token, require_doctor, require_patient, verify_password, verify_token
from backend.clinical_engine import analyze_clinical_case
from backend.data_store import (
    MYSQL_DATABASE,
    MYSQL_HOST,
    MYSQL_PORT,
    MYSQL_USER,
    append_audit as repo_append_audit,
    create_report_and_update_patient,
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
    delete_patient_vitals as repo_delete_patient_vitals,
    update_patient_vitals as repo_update_patient_vitals,
    start_federated_round as repo_start_federated_round,
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


class PatientVitalsUpdateRequest(BaseModel):
    heart_rate: int = Field(ge=0, le=300)
    systolic_bp: int = Field(ge=0, le=300)
    diastolic_bp: int = Field(ge=0, le=200)
    blood_sugar: int = Field(ge=0, le=1000)
    oxygen_level: int = Field(ge=0, le=100)
    temperature: float = Field(ge=80, le=110)
    bmi: float = Field(ge=0, le=100)


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

    recommendations = []
    if normalized.get("2") in {"< 4", "4-5"}:
        recommendations.append("Prioritize sleep recovery and maintain a fixed bedtime this week.")
    if normalized.get("3") in {"very high", "high"}:
        recommendations.append("Use short stress-reset breaks and consider speaking with a clinician if symptoms persist.")
    if normalized.get("1") in {"very low", "low"}:
        recommendations.append("Track mood changes daily and reach out to a trusted support system.")
    if normalized.get("4") in {"exhausted", "tired"}:
        recommendations.append("Reduce overload where possible and build in light recovery activity.")
    if not recommendations:
        recommendations = [
            "Maintain your current routine and continue regular sleep and hydration habits.",
            "Repeat the check-in regularly to monitor changes in stress and mood.",
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
        "recommendations": recommendations[:3],
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


@app.get("/patients/{patient_id}/vitals")
def get_patient_vitals_endpoint(patient_id: str, token: TokenPayload = Depends(verify_token)) -> list[dict[str, Any]]:
    if token.role == "doctor" and token.doctor_id and not repo_doctor_can_access(token.doctor_id, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only access their own vitals.")
    return get_patient_vitals(patient_id)


@app.put("/patients/{patient_id}/vitals")
def update_patient_vitals_endpoint(
    patient_id: str,
    payload: PatientVitalsUpdateRequest,
    token: TokenPayload = Depends(verify_token),
) -> dict[str, Any]:
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only update their own vitals.")
    if token.role == "doctor" and token.doctor_id and not repo_doctor_can_access(token.doctor_id, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    return repo_update_patient_vitals(patient_id, payload.model_dump())


@app.delete("/patients/{patient_id}/vitals")
def delete_patient_vitals_endpoint(
    patient_id: str,
    token: TokenPayload = Depends(verify_token),
) -> dict[str, Any]:
    if token.role == "patient" and token.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Patient can only delete their own vitals.")
    if token.role == "doctor" and token.doctor_id and not repo_doctor_can_access(token.doctor_id, patient_id):
        raise HTTPException(status_code=403, detail="Doctor is not authorized for this patient.")
    return repo_delete_patient_vitals(patient_id)


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
    normalized = [drug.strip().lower() for drug in payload.drugs if drug.strip()]
    interactions = []
    if {"warfarin", "aspirin"}.issubset(normalized):
        interactions.append(
            {
                "drugs": "Warfarin + Aspirin",
                "severity": "High",
                "note": "Concurrent use increases bleeding risk. Consider alternative antiplatelet strategy or tighter INR monitoring.",
            }
        )
    if {"metformin", "lisinopril"}.issubset(normalized):
        interactions.append(
            {
                "drugs": "Metformin + Lisinopril",
                "severity": "Low",
                "note": "Generally acceptable combination. Monitor renal function and blood pressure during routine review.",
            }
        )
    if not interactions:
        interactions.append(
            {
                "drugs": ", ".join(payload.drugs),
                "severity": "Low",
                "note": "No high-confidence interaction detected in the local knowledge base. Verify against institutional formulary before prescribing.",
            }
        )
    return {"interactions": interactions}


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
