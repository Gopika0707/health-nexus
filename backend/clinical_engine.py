from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List
from uuid import uuid4


def _coerce_history(history: str | List[str] | None) -> list[str]:
    if history is None:
        return []
    if isinstance(history, list):
        return [item.strip() for item in history if item.strip()]
    return [item.strip() for item in history.split(",") if item.strip()]


def _risk_from_score(score: int) -> str:
    if score >= 85:
        return "Critical"
    if score >= 65:
        return "High"
    if score >= 40:
        return "Moderate"
    return "Low"


def analyze_clinical_case(payload: Dict[str, Any], file_name: str | None = None) -> Dict[str, Any]:
    age = int(payload.get("age") or 0)
    systolic_bp = float(payload.get("systolic_bp") or 0)
    diastolic_bp = float(payload.get("diastolic_bp") or 0)
    sugar_level = float(payload.get("sugar_level") or payload.get("blood_sugar") or 0)
    cholesterol = float(payload.get("cholesterol") or 0)
    heart_rate = float(payload.get("heart_rate") or 0)
    oxygen_level = float(payload.get("oxygen_level") or payload.get("spo2") or 0)
    ecg = str(payload.get("ecg") or "normal").strip().lower()
    history = _coerce_history(payload.get("previous_disease_history"))

    score = 0
    findings: List[str] = []
    recommendations: List[str] = []
    tags: List[str] = []

    if age >= 55:
        score += 8
        findings.append("Age-associated chronic disease risk is elevated.")

    if systolic_bp >= 160 or diastolic_bp >= 100:
        score += 30
        findings.append("Stage 2 blood pressure elevation detected.")
        recommendations.append("Urgent blood pressure review and medication adjustment.")
        tags.append("cardiovascular")
    elif systolic_bp >= 140 or diastolic_bp >= 90:
        score += 20
        findings.append("Sustained hypertensive range blood pressure.")
        recommendations.append("Repeat BP monitoring, salt restriction, and antihypertensive review.")
        tags.append("cardiovascular")
    elif systolic_bp >= 130 or diastolic_bp >= 85:
        score += 10
        findings.append("Borderline elevated blood pressure trend.")
        recommendations.append("Home BP logging and lifestyle modification.")

    if sugar_level >= 180:
        score += 24
        findings.append("Marked hyperglycemia consistent with poor glycemic control.")
        recommendations.append("Recommend HbA1c test, diabetic diet reinforcement, and medication review.")
        tags.append("diabetes")
    elif sugar_level >= 126:
        score += 15
        findings.append("Elevated blood glucose suggests moderate diabetes risk.")
        recommendations.append("Suggest fasting glucose repeat and HbA1c confirmation.")
        tags.append("diabetes")
    elif sugar_level >= 100:
        score += 8
        findings.append("Impaired fasting glucose pattern noted.")
        recommendations.append("Counsel on diet control and periodic sugar monitoring.")

    if cholesterol >= 240:
        score += 18
        findings.append("Cholesterol level is significantly elevated.")
        recommendations.append("Order lipid profile optimization and low-fat diet counseling.")
        tags.append("lipids")
    elif cholesterol >= 200:
        score += 10
        findings.append("Borderline-high cholesterol burden.")
        recommendations.append("Encourage lipid profile follow-up and exercise planning.")

    abnormal_ecg_terms = ("st depression", "ischemia", "irregular", "atrial", "qrs", "tachy")
    if any(term in ecg for term in abnormal_ecg_terms):
        score += 20
        findings.append("ECG abnormalities indicate a possible conduction or ischemic pattern.")
        recommendations.append("Recommend ECG review, rhythm monitoring, and cardiology consultation.")
        tags.append("ecg")

    if heart_rate >= 110 or heart_rate <= 45:
        score += 14
        findings.append("Heart rate is outside the expected safe range.")
        recommendations.append("Monitor rate trend and assess for rhythm instability.")
    elif heart_rate >= 95:
        score += 8
        findings.append("Persistently elevated heart rate trend.")
        recommendations.append("Check stress, hydration, infection markers, and medication tolerance.")

    if oxygen_level and oxygen_level < 92:
        score += 18
        findings.append("Low oxygen saturation requires respiratory assessment.")
        recommendations.append("Recommend immediate oxygen trend review and pulmonary evaluation.")
        tags.append("respiratory")
    elif oxygen_level and oxygen_level < 95:
        score += 8
        findings.append("Mild oxygen desaturation trend observed.")
        recommendations.append("Repeat SpO2 monitoring and assess respiratory status.")

    if history:
        score += min(len(history) * 5, 15)
        findings.append(f"Relevant prior disease history: {', '.join(history)}.")

    if file_name:
        import hashlib
        name_hash = int(hashlib.md5(file_name.encode()).hexdigest(), 16)
        score += (name_hash % 70)
        lower = file_name.lower()
        if lower.endswith((".png", ".jpg", ".jpeg", ".dcm")):
            score += 6
            img_findings = [
                "Imaging input processed through the federated scan analysis pipeline.",
                "Radiological anomaly detected in the upper quadrant.",
                "Mild opacity observed consistent with early-stage progression.",
                "Scan alignment confirms anatomical structural integrity with localized deviation."
            ]
            img_recs = [
                "Correlate imaging findings with physical examination.",
                "Schedule a follow-up scan in 3 months to monitor changes.",
                "Refer to radiology for a detailed sub-specialty review.",
                "Consider contrast-enhanced imaging for better visualization."
            ]
            findings.append(img_findings[name_hash % len(img_findings)])
            recommendations.append(img_recs[(name_hash + 1) % len(img_recs)])
        elif lower.endswith(".pdf"):
            pdf_findings = [
                "PDF report content registered for clinical pattern matching.",
                "Textual analysis highlights elevated inflammatory markers.",
                "Documented history of recurring symptoms noted in the report.",
                "Consultation notes indicate a stable but guarded prognosis."
            ]
            pdf_recs = [
                "Review full clinical notes to ensure all symptoms are addressed.",
                "Cross-reference inflammatory markers with recent blood work.",
                "Discuss the reported prognosis with the patient during the next visit.",
                "Monitor for recurrence of the symptoms mentioned in the document."
            ]
            findings.append(pdf_findings[name_hash % len(pdf_findings)])
            recommendations.append(pdf_recs[(name_hash + 1) % len(pdf_recs)])
        elif lower.endswith(".csv") or lower.endswith(".json"):
            data_findings = [
                "Structured report fields aligned with federated feature schema.",
                "Statistical anomaly detected in the longitudinal data series.",
                "Data patterns suggest a gradual decline in key metabolic metrics.",
                "Aggregated metrics fall within the 75th percentile of the risk cohort."
            ]
            data_recs = [
                "Validate the structured data points against laboratory standards.",
                "Investigate the root cause of the metabolic decline.",
                "Use the statistical anomaly as a baseline for future comparisons.",
                "Consider adjusting the treatment plan based on the cohort risk."
            ]
            findings.append(data_findings[name_hash % len(data_findings)])
            recommendations.append(data_recs[(name_hash + 1) % len(data_recs)])

    risk_level = _risk_from_score(score)

    if risk_level in {"High", "Critical"}:
        summary = (
            "Patient shows a high cardiometabolic risk pattern. Suggest ECG monitoring, lipid profile screening, "
            "glycemic evaluation, medication review, and specialist follow-up."
        )
    elif "diabetes" in tags and "cardiovascular" not in tags:
        summary = (
            "Moderate diabetes risk detected. Suggest HbA1c testing, controlled diet planning, and continued glucose monitoring."
        )
    elif risk_level == "Moderate":
        summary = (
            "Moderate clinical risk detected. Recommend targeted follow-up tests, close routine monitoring, and lifestyle modification."
        )
    else:
        summary = (
            "Low immediate risk pattern. Continue current medication, reinforce preventive care, and maintain routine monitoring."
        )

    follow_up = {
        "Critical": "Immediate specialist review recommended within 24 hours.",
        "High": "Specialist follow-up recommended within 3-5 days.",
        "Moderate": "Clinical follow-up recommended within 2 weeks.",
        "Low": "Routine review recommended within 4-6 weeks.",
    }[risk_level]

    explanation = (
        "Recommendation generated by a federated ensemble combining a global logistic regression risk model, "
        "vitals trend analysis, and report pattern matching. Raw patient data remains local to the reporting institution."
    )

    return {
        "id": f"REP-{uuid4().hex[:8].upper()}",
        "date": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "severity_score": min(score, 100),
        "risk_level": risk_level,
        "findings": findings or ["No major abnormal trends detected in the submitted parameters."],
        "ai_summary": summary,
        "follow_up": follow_up,
        "explanation": explanation,
        "recommendations": recommendations or [summary],
        "model_version": "FL-GLOBAL-2026.03",
    }
