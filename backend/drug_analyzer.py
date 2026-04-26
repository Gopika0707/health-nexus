from __future__ import annotations

import json
import os
import re
from typing import Any
from urllib import error, parse, request

from backend.env_loader import load_env


load_env()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

LOCAL_DRUG_KB: dict[str, dict[str, Any]] = {
    "metformin": {
        "generic_name": "Metformin",
        "purpose": "Used to improve blood sugar control in type 2 diabetes and insulin resistance.",
        "status": "approved",
        "dosage_guidance": "Usually taken with meals; dosing should be individualized by a clinician.",
        "side_effects": ["Nausea", "Diarrhea", "Abdominal discomfort", "Metallic taste"],
        "interactions": ["Use caution in renal impairment.", "Review contrast imaging plans with a clinician."],
        "safer_alternatives": ["Lifestyle modification", "Extended-release metformin"],
    },
    "aspirin": {
        "generic_name": "Aspirin",
        "purpose": "Used for pain relief, fever reduction, and antiplatelet therapy in selected cardiovascular settings.",
        "status": "approved",
        "dosage_guidance": "Dose varies by indication; avoid self-prescribing long-term use without clinician guidance.",
        "side_effects": ["Gastric irritation", "Bleeding risk", "Heartburn"],
        "interactions": ["Increased bleeding risk with warfarin or other anticoagulants."],
        "safer_alternatives": ["Acetaminophen for simple fever/pain in some patients"],
    },
    "ibuprofen": {
        "generic_name": "Ibuprofen",
        "purpose": "NSAID used for pain, inflammation, and fever control.",
        "status": "approved",
        "dosage_guidance": "Use the lowest effective dose for the shortest duration possible.",
        "side_effects": ["Gastric irritation", "Kidney strain", "Fluid retention"],
        "interactions": ["Use caution with anticoagulants, kidney disease, and uncontrolled hypertension."],
        "safer_alternatives": ["Acetaminophen depending on indication"],
    },
    "paracetamol": {
        "generic_name": "Paracetamol",
        "purpose": "Used for mild-to-moderate pain and fever relief.",
        "status": "approved",
        "dosage_guidance": "Avoid exceeding daily dose limits; use carefully in liver disease.",
        "side_effects": ["Nausea", "Rare rash", "Liver toxicity in overdose"],
        "interactions": ["Use caution with alcohol misuse or severe liver disease."],
        "safer_alternatives": [],
    },
    "acetaminophen": {
        "generic_name": "Acetaminophen",
        "purpose": "Used for mild-to-moderate pain and fever relief.",
        "status": "approved",
        "dosage_guidance": "Avoid exceeding daily dose limits; use carefully in liver disease.",
        "side_effects": ["Nausea", "Rare rash", "Liver toxicity in overdose"],
        "interactions": ["Use caution with alcohol misuse or severe liver disease."],
        "safer_alternatives": [],
    },
    "lisinopril": {
        "generic_name": "Lisinopril",
        "purpose": "ACE inhibitor used for hypertension, heart failure, and kidney protection in selected patients.",
        "status": "approved",
        "dosage_guidance": "Requires blood pressure and kidney monitoring under clinician supervision.",
        "side_effects": ["Dry cough", "Dizziness", "High potassium", "Kidney function changes"],
        "interactions": ["Use caution with potassium supplements and dehydration."],
        "safer_alternatives": ["ARB class medications in some patients"],
    },
    "atorvastatin": {
        "generic_name": "Atorvastatin",
        "purpose": "Statin used to reduce LDL cholesterol and cardiovascular risk.",
        "status": "approved",
        "dosage_guidance": "Usually taken once daily with periodic liver and lipid monitoring.",
        "side_effects": ["Muscle aches", "Mild GI upset", "Liver enzyme elevation"],
        "interactions": ["Review interacting antibiotics and antifungals that may raise statin levels."],
        "safer_alternatives": ["Rosuvastatin in selected patients", "Lifestyle modification"],
    },
    "amlodipine": {
        "generic_name": "Amlodipine",
        "purpose": "Calcium channel blocker used for hypertension and angina control.",
        "status": "approved",
        "dosage_guidance": "Dose should be titrated gradually with blood pressure monitoring.",
        "side_effects": ["Ankle swelling", "Flushing", "Headache", "Dizziness"],
        "interactions": ["Use caution with other blood-pressure-lowering medicines."],
        "safer_alternatives": ["Lisinopril", "Losartan"],
    },
    "losartan": {
        "generic_name": "Losartan",
        "purpose": "ARB used for hypertension and kidney protection in selected patients.",
        "status": "approved",
        "dosage_guidance": "Requires kidney function and potassium monitoring during treatment.",
        "side_effects": ["Dizziness", "High potassium", "Kidney function changes"],
        "interactions": ["Use caution with potassium supplements and dehydration."],
        "safer_alternatives": ["Lisinopril in some patients", "Amlodipine"],
    },
    "rosuvastatin": {
        "generic_name": "Rosuvastatin",
        "purpose": "Statin used to lower cholesterol and reduce cardiovascular event risk.",
        "status": "approved",
        "dosage_guidance": "Usually taken once daily; periodic lipid and liver review is recommended.",
        "side_effects": ["Muscle pain", "Headache", "Constipation", "Liver enzyme elevation"],
        "interactions": ["Use caution with interacting lipid-lowering agents or severe kidney impairment."],
        "safer_alternatives": ["Atorvastatin", "Lifestyle modification"],
    },
    "clopidogrel": {
        "generic_name": "Clopidogrel",
        "purpose": "Antiplatelet medicine used to reduce clot risk after stroke, heart attack, or stenting.",
        "status": "approved",
        "dosage_guidance": "Should be used under clinician supervision, especially around procedures or surgery.",
        "side_effects": ["Bruising", "Bleeding risk", "Stomach upset", "Rash"],
        "interactions": ["Bleeding risk increases with aspirin, NSAIDs, or anticoagulants."],
        "safer_alternatives": ["Aspirin in selected cases", "Ticagrelor under specialist guidance"],
    },
    "warfarin": {
        "generic_name": "Warfarin",
        "purpose": "Anticoagulant used to prevent and treat blood clots in selected high-risk patients.",
        "status": "restricted",
        "dosage_guidance": "Requires INR monitoring and careful clinician-supervised dose adjustment.",
        "side_effects": ["Bleeding", "Bruising", "Skin changes", "Drug-food interaction burden"],
        "interactions": ["Many antibiotics, pain medicines, and vitamin K intake changes can alter effect."],
        "safer_alternatives": ["Apixaban in selected patients"],
    },
    "apixaban": {
        "generic_name": "Apixaban",
        "purpose": "Direct oral anticoagulant used for atrial fibrillation and venous clot prevention or treatment.",
        "status": "approved",
        "dosage_guidance": "Dose depends on renal function, age, and clinical indication.",
        "side_effects": ["Bleeding", "Bruising", "Nausea"],
        "interactions": ["Use caution with strong CYP3A4 or P-gp interacting medicines and other anticoagulants."],
        "safer_alternatives": ["Warfarin in selected monitored patients"],
    },
    "amoxicillin": {
        "generic_name": "Amoxicillin",
        "purpose": "Penicillin-class antibiotic used for selected bacterial infections.",
        "status": "approved",
        "dosage_guidance": "Use only for clinician-confirmed bacterial indications and complete the prescribed course.",
        "side_effects": ["Rash", "Diarrhea", "Nausea", "Yeast overgrowth"],
        "interactions": ["Review penicillin allergy history and anticoagulant use."],
        "safer_alternatives": ["Azithromycin in some non-allergic scenarios", "Symptom-based care when antibiotics are not indicated"],
    },
    "azithromycin": {
        "generic_name": "Azithromycin",
        "purpose": "Macrolide antibiotic used for selected respiratory, skin, and other bacterial infections.",
        "status": "approved",
        "dosage_guidance": "Should be used only when clinically indicated; avoid unnecessary antibiotic exposure.",
        "side_effects": ["Nausea", "Diarrhea", "Abdominal pain", "QT prolongation risk"],
        "interactions": ["Use caution with other QT-prolonging medicines and rhythm disorders."],
        "safer_alternatives": ["Amoxicillin when appropriate", "Culture-guided antibiotic selection"],
    },
    "cetirizine": {
        "generic_name": "Cetirizine",
        "purpose": "Antihistamine used for allergic rhinitis, itching, and hives.",
        "status": "approved",
        "dosage_guidance": "Usually taken once daily; monitor drowsiness in sensitive patients.",
        "side_effects": ["Drowsiness", "Dry mouth", "Fatigue"],
        "interactions": ["Alcohol or sedating medicines may increase drowsiness."],
        "safer_alternatives": ["Loratadine", "Non-drug allergen avoidance"],
    },
    "omeprazole": {
        "generic_name": "Omeprazole",
        "purpose": "Proton pump inhibitor used for acid reflux, ulcers, and acid suppression.",
        "status": "approved",
        "dosage_guidance": "Best used for clear indications and reviewed if long-term therapy is needed.",
        "side_effects": ["Headache", "Abdominal discomfort", "Diarrhea", "Low magnesium with prolonged use"],
        "interactions": ["Long-term use may affect absorption of some medicines and nutrients."],
        "safer_alternatives": ["Pantoprazole", "Lifestyle modification for reflux"],
    },
    "pantoprazole": {
        "generic_name": "Pantoprazole",
        "purpose": "Proton pump inhibitor used for acid reflux and ulcer-related acid suppression.",
        "status": "approved",
        "dosage_guidance": "Use the lowest effective dose and reassess need for extended therapy.",
        "side_effects": ["Headache", "Nausea", "Diarrhea", "Low magnesium with prolonged use"],
        "interactions": ["Review long-term use with medicines affected by gastric acidity."],
        "safer_alternatives": ["Omeprazole", "Lifestyle modification for reflux"],
    },
    "levothyroxine": {
        "generic_name": "Levothyroxine",
        "purpose": "Thyroid hormone replacement used in hypothyroidism.",
        "status": "approved",
        "dosage_guidance": "Usually taken on an empty stomach with dose titration guided by thyroid labs.",
        "side_effects": ["Palpitations if over-replaced", "Tremor", "Sweating", "Weight changes"],
        "interactions": ["Iron, calcium, and some antacids can reduce absorption if taken together."],
        "safer_alternatives": [],
    },
    "insulin glargine": {
        "generic_name": "Insulin Glargine",
        "purpose": "Long-acting insulin used for baseline blood sugar control in diabetes.",
        "status": "approved",
        "dosage_guidance": "Requires individualized dosing, glucose monitoring, and hypoglycemia education.",
        "side_effects": ["Low blood sugar", "Weight gain", "Injection-site reactions"],
        "interactions": ["Food intake changes, exercise, and other glucose-lowering medicines affect response."],
        "safer_alternatives": ["Other basal insulin regimens under clinician guidance"],
    },
    "salbutamol": {
        "generic_name": "Salbutamol",
        "purpose": "Short-acting bronchodilator used for quick relief of bronchospasm and wheeze.",
        "status": "approved",
        "dosage_guidance": "Use as rescue therapy; frequent need suggests clinician review of underlying control.",
        "side_effects": ["Tremor", "Palpitations", "Nervousness", "Mild headache"],
        "interactions": ["Use caution in poorly controlled arrhythmia or severe tachycardia."],
        "safer_alternatives": ["Controller inhalers for prevention under clinician guidance"],
    },
    "furosemide": {
        "generic_name": "Furosemide",
        "purpose": "Loop diuretic used for edema and fluid overload states.",
        "status": "approved",
        "dosage_guidance": "Requires monitoring of fluid status, kidney function, and electrolytes.",
        "side_effects": ["Dehydration", "Low potassium", "Dizziness", "Frequent urination"],
        "interactions": ["Use caution with other blood-pressure-lowering agents and dehydration risk."],
        "safer_alternatives": ["Torsemide in selected patients", "Fluid and salt review under clinician guidance"],
    },
    "prednisone": {
        "generic_name": "Prednisone",
        "purpose": "Corticosteroid used for inflammatory, allergic, and autoimmune conditions.",
        "status": "restricted",
        "dosage_guidance": "Use only under clinician supervision and avoid abrupt long-term discontinuation.",
        "side_effects": ["Raised blood sugar", "Mood changes", "Weight gain", "Fluid retention"],
        "interactions": ["Use caution with diabetes, infection risk, and ulcer-prone patients."],
        "safer_alternatives": ["Topical or inhaled steroid options in selected cases", "Condition-specific steroid-sparing regimens"],
    },
    "empagliflozin": {
        "generic_name": "Empagliflozin",
        "purpose": "SGLT2 inhibitor used for type 2 diabetes and selected heart or kidney protection settings.",
        "status": "approved",
        "dosage_guidance": "Requires hydration review and clinician monitoring of renal status and infection symptoms.",
        "side_effects": ["Genital yeast infection", "Urinary frequency", "Dehydration", "Rare ketoacidosis"],
        "interactions": ["Use caution with diuretics, low blood pressure, or poor oral intake."],
        "safer_alternatives": ["Metformin", "Sitagliptin in selected patients"],
    },
    "sitagliptin": {
        "generic_name": "Sitagliptin",
        "purpose": "DPP-4 inhibitor used to improve blood sugar control in type 2 diabetes.",
        "status": "approved",
        "dosage_guidance": "Dose may need adjustment in renal impairment and should be guided by a clinician.",
        "side_effects": ["Headache", "Nasopharyngitis", "GI upset", "Rare pancreatitis concern"],
        "interactions": ["Review kidney function and other glucose-lowering therapies."],
        "safer_alternatives": ["Metformin", "Empagliflozin in selected patients"],
    },
}


def _extract_json(raw_text: str) -> dict[str, Any]:
    text = raw_text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)
    else:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            text = text[start : end + 1]
    return json.loads(text)


def _normalize_banned_markets(items: Any) -> list[dict[str, str]]:
    if not isinstance(items, list):
        return []
    normalized: list[dict[str, str]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        country = str(item.get("country", "")).strip()
        reason = str(item.get("reason", "")).strip()
        if country:
            normalized.append({"country": country, "reason": reason or "Reason not specified."})
    return normalized


def _default_response(drug_name: str, error_note: str | None = None) -> dict[str, Any]:
    note = "Live regulatory analysis is currently unavailable."
    if error_note:
        note = f"{note} {error_note}"
    return {
        "name": drug_name,
        "generic_name": drug_name,
        "purpose": "Drug usage information unavailable.",
        "status": "restricted",
        "dosage_guidance": "Use only under licensed clinician guidance.",
        "side_effects": ["Information unavailable"],
        "interactions": ["Check institutional formulary and regulator advisories before prescribing."],
        "suitability_score": 50,
        "patient_suitability": "unknown",
        "patient_suitability_reason": "Patient-specific suitability could not be determined.",
        "banned_countries": [],
        "banned_markets": [],
        "safer_alternatives": [],
        "note": note,
    }


def _local_fallback_response(drug_name: str, patient_context: dict[str, Any] | None = None, error_note: str | None = None) -> dict[str, Any]:
    key = drug_name.strip().lower()
    base = LOCAL_DRUG_KB.get(key)
    if base is None:
        return _default_response(drug_name, error_note)

    patient_context = patient_context or {}
    history = [str(item).lower() for item in patient_context.get("previous_disease_history", [])]
    latest_vitals = patient_context.get("latest_vitals", {}) if isinstance(patient_context.get("latest_vitals", {}), dict) else {}

    patient_suitability = "suitable"
    rationale = "No high-risk patient-specific issues were detected from the available local context."

    if key == "metformin" and ("kidney disease" in history or latest_vitals.get("blood_sugar", 0) < 70):
        patient_suitability = "use_with_caution"
        rationale = "Use caution if renal function is reduced or if glucose trends suggest hypoglycemia risk."
    elif key in {"ibuprofen", "aspirin"} and ("hypertension" in history or latest_vitals.get("systolic_bp", 0) >= 140):
        patient_suitability = "use_with_caution"
        rationale = "NSAID or antiplatelet use may require review in elevated blood pressure or bleeding-risk settings."
    elif key == "lisinopril" and latest_vitals.get("systolic_bp", 0) < 100:
        patient_suitability = "use_with_caution"
        rationale = "Low blood pressure trends suggest this medication should be reviewed carefully."

    note = "Served from local fallback analyzer."
    if error_note:
        note = f"{note} {error_note}"

    return {
        "name": drug_name.strip().title(),
        "generic_name": base["generic_name"],
        "purpose": base["purpose"],
        "status": base["status"],
        "dosage_guidance": base["dosage_guidance"],
        "side_effects": base["side_effects"],
        "interactions": base["interactions"],
        "suitability_score": 72 if patient_suitability == "suitable" else 58,
        "patient_suitability": patient_suitability,
        "patient_suitability_reason": rationale,
        "banned_countries": [],
        "banned_markets": [],
        "safer_alternatives": base["safer_alternatives"],
        "note": note,
    }


def analyze_drug_with_gemini(drug_name: str, patient_context: dict[str, Any] | None = None) -> dict[str, Any]:
    if not drug_name.strip():
        raise ValueError("Drug name is required.")

    prompt = f"""
You are a medical drug safety assistant. Return only valid JSON.

Task:
- Analyze the drug "{drug_name}".
- Include normal usage, common side effects, notable interactions, and regulatory status.
- Specifically state whether it is banned in any country or region.
- If banned or withdrawn somewhere, list the country/region and a short reason.
- If it is not banned anywhere that you are confident about, return an empty banned_markets array.
- Be conservative: do not invent bans. If uncertain, mention uncertainty in note instead.

Patient context:
{json.dumps(patient_context or {{}}, ensure_ascii=True)}

Return JSON with exactly these keys:
{{
  "name": "string",
  "generic_name": "string",
  "purpose": "short paragraph on primary uses",
  "status": "approved" | "restricted" | "banned",
  "dosage_guidance": "general guidance only, not a prescription",
  "side_effects": ["string"],
  "interactions": ["string"],
  "suitability_score": 0,
  "patient_suitability": "suitable" | "use_with_caution" | "not_suitable" | "unknown",
  "patient_suitability_reason": "short explanation using patient context when available",
  "banned_markets": [{{"country": "string", "reason": "string"}}],
  "safer_alternatives": ["string"],
  "note": "short summary with regulatory caution"
}}
""".strip()

    if not GEMINI_API_KEY:
        return _local_fallback_response(drug_name, patient_context, "Missing Gemini API key.")

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{parse.quote(GEMINI_MODEL)}:generateContent?key={parse.quote(GEMINI_API_KEY)}"
    )
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    req = request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=25) as response:
            body = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        return _local_fallback_response(drug_name, patient_context, f"Gemini HTTP error: {exc.code}. {detail[:180]}")
    except Exception as exc:
        return _local_fallback_response(drug_name, patient_context, f"Gemini request failed: {exc}")

    try:
        text = body["candidates"][0]["content"]["parts"][0]["text"]
        parsed = _extract_json(text)
    except Exception as exc:
        return _local_fallback_response(drug_name, patient_context, f"Could not parse Gemini response: {exc}")

    banned_markets = _normalize_banned_markets(parsed.get("banned_markets"))
    status = str(parsed.get("status", "restricted")).strip().lower()
    if status not in {"approved", "restricted", "banned"}:
        status = "restricted"

    side_effects = [str(item).strip() for item in parsed.get("side_effects", []) if str(item).strip()]
    interactions = [str(item).strip() for item in parsed.get("interactions", []) if str(item).strip()]
    safer_alternatives = [str(item).strip() for item in parsed.get("safer_alternatives", []) if str(item).strip()]
    patient_suitability = str(parsed.get("patient_suitability", "unknown")).strip().lower()
    if patient_suitability not in {"suitable", "use_with_caution", "not_suitable", "unknown"}:
        patient_suitability = "unknown"
    patient_suitability_reason = str(
        parsed.get("patient_suitability_reason") or "No patient-specific suitability rationale returned."
    ).strip()

    try:
        suitability_score = int(parsed.get("suitability_score", 50))
    except Exception:
        suitability_score = 50
    suitability_score = max(0, min(100, suitability_score))

    return {
        "name": str(parsed.get("name") or drug_name).strip(),
        "generic_name": str(parsed.get("generic_name") or drug_name).strip(),
        "purpose": str(parsed.get("purpose") or "Usage information unavailable.").strip(),
        "status": status,
        "dosage_guidance": str(parsed.get("dosage_guidance") or "Use only under clinician guidance.").strip(),
        "side_effects": side_effects or ["Information unavailable"],
        "interactions": interactions or ["No interaction summary returned."],
        "suitability_score": suitability_score,
        "patient_suitability": patient_suitability,
        "patient_suitability_reason": patient_suitability_reason,
        "banned_countries": [item["country"] for item in banned_markets],
        "banned_markets": banned_markets,
        "safer_alternatives": safer_alternatives,
        "note": str(parsed.get("note") or "Regulatory and safety summary generated by Gemini. Verify against local regulator databases before prescribing.").strip(),
    }
