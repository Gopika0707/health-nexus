from __future__ import annotations

import base64
import json
import os
import re
from pathlib import Path
from typing import Any
from urllib import error, parse, request

from backend.env_loader import load_env


load_env()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
SECURE_REPORTS_DIR = Path(__file__).resolve().parent / "secure_reports"


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


def _fallback_report_explanation(report: dict[str, Any], patient: dict[str, Any] | None = None, error_note: str | None = None) -> dict[str, Any]:
    findings = list(report.get("findings") or [])
    follow_up = report.get("follow_up") or "Review this report with a clinician."
    patient_name = patient.get("full_name", "This patient") if patient else "This patient"
    note = "Detailed explanation served from local fallback analyzer."
    if error_note:
        note = f"{note} {error_note}"
    return {
        "detailed_explanation": (
            f"{patient_name}'s report is categorized as {str(report.get('risk_level', 'unknown')).lower()} risk. "
            f"Key observations: {', '.join(findings[:4]) if findings else 'no structured findings were available'}. "
            f"Recommended next step: {follow_up}"
        ),
        "patient_friendly_summary": str(report.get("ai_summary") or "No summary available.").strip(),
        "clinical_takeaways": findings[:5] if findings else ["No structured findings were available in the report payload."],
        "recommended_questions": [
            "What does this report mean in simple terms?",
            "What follow-up tests or appointments are needed next?",
            "Should any medication, diet, or daily activity change now?",
        ],
        "recommendations": list(report.get("recommendations") or [follow_up])[:5],
        "note": note,
    }


def _resolve_report_file(report: dict[str, Any]) -> Path | None:
    file_url = str(report.get("file_url") or "").strip()
    if not file_url.startswith("/secure-reports/"):
        return None
    candidate = SECURE_REPORTS_DIR / Path(file_url).name
    return candidate if candidate.exists() else None


def explain_report_with_gemini(report: dict[str, Any], patient: dict[str, Any] | None = None) -> dict[str, Any]:
    report_file = _resolve_report_file(report)
    patient_context = {
        "patient_id": patient.get("patient_id") if patient else None,
        "full_name": patient.get("full_name") if patient else None,
        "age": patient.get("age") if patient else None,
        "gender": patient.get("gender") if patient else None,
        "condition": patient.get("condition") if patient else None,
        "risk": patient.get("risk") if patient else None,
        "previous_disease_history": patient.get("previous_disease_history", []) if patient else [],
        "latest_vitals": patient.get("latest_vitals", {}) if patient else {},
    }

    prompt = f"""
You are a clinical report explainer. Return only valid JSON.

Patient context:
{json.dumps(patient_context, ensure_ascii=True)}

Structured report context:
{json.dumps(report, ensure_ascii=True)}

Explain the uploaded report in a clinically useful but patient-readable way.
If a source file is attached, use it together with the structured report data.

Return JSON with exactly these keys:
{{
  "detailed_explanation": "paragraph with detailed explanation",
  "patient_friendly_summary": "short simple-language summary",
  "clinical_takeaways": ["string"],
  "recommended_questions": ["string"],
  "recommendations": ["string"],
  "note": "short medical safety note"
}}
""".strip()

    if not GEMINI_API_KEY:
        return _fallback_report_explanation(report, patient, "Missing Gemini API key.")

    parts: list[dict[str, Any]] = [{"text": prompt}]
    if report_file is not None:
        mime_type = "application/pdf" if report_file.suffix.lower() == ".pdf" else "text/plain"
        parts.append(
            {
                "inlineData": {
                    "mimeType": mime_type,
                    "data": base64.b64encode(report_file.read_bytes()).decode("ascii"),
                }
            }
        )

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{parse.quote(GEMINI_MODEL)}:generateContent?key={parse.quote(GEMINI_API_KEY)}"
    )
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
    }
    req = request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=40) as response:
            body = json.loads(response.read().decode("utf-8"))
        text = body["candidates"][0]["content"]["parts"][0]["text"]
        parsed = _extract_json(text)
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        return _fallback_report_explanation(report, patient, f"Gemini HTTP error: {exc.code}. {detail[:180]}")
    except Exception as exc:
        return _fallback_report_explanation(report, patient, f"Gemini request failed: {exc}")

    return {
        "detailed_explanation": str(parsed.get("detailed_explanation") or report.get("explanation") or report.get("ai_summary") or "").strip(),
        "patient_friendly_summary": str(parsed.get("patient_friendly_summary") or report.get("ai_summary") or "").strip(),
        "clinical_takeaways": [str(item).strip() for item in parsed.get("clinical_takeaways", []) if str(item).strip()] or list(report.get("findings") or []),
        "recommended_questions": [str(item).strip() for item in parsed.get("recommended_questions", []) if str(item).strip()],
        "recommendations": [str(item).strip() for item in parsed.get("recommendations", []) if str(item).strip()] or list(report.get("recommendations") or []),
        "note": str(parsed.get("note") or "Verify details with your clinician before making treatment decisions.").strip(),
    }


def _wrap_text(text: str, line_length: int = 90) -> list[str]:
    words = text.replace("\r", "").split()
    lines: list[str] = []
    current = ""
    for word in words:
        proposed = word if not current else f"{current} {word}"
        if len(proposed) <= line_length:
            current = proposed
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


def _escape_pdf_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_report_analysis_pdf(patient: dict[str, Any], report: dict[str, Any], analysis: dict[str, Any]) -> bytes:
    lines = [
        f"Patient: {patient.get('full_name', '')}",
        f"Patient ID: {patient.get('patient_id', '')}",
        f"Report: {report.get('name', '')}",
        f"Type: {report.get('type', '')}",
        f"Risk Level: {report.get('risk_level', '')}",
        "",
        "Patient-Friendly Summary",
        *_wrap_text(str(analysis.get("patient_friendly_summary", ""))),
        "",
        "Detailed Explanation",
        *_wrap_text(str(analysis.get("detailed_explanation", ""))),
        "",
        "Clinical Takeaways",
    ]
    for item in analysis.get("clinical_takeaways", []):
        lines.extend(_wrap_text(f"- {item}"))
    lines.append("")
    lines.append("Recommendations")
    for item in analysis.get("recommendations", []):
        lines.extend(_wrap_text(f"- {item}"))
    lines.append("")
    lines.append(f"Note: {analysis.get('note', '')}")

    page_height = 792
    start_y = 760
    line_step = 14
    max_lines_per_page = 48
    pages = [lines[i : i + max_lines_per_page] for i in range(0, len(lines), max_lines_per_page)] or [[]]

    objects: list[bytes] = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    page_refs = " ".join(f"{4 + index * 2} 0 R" for index in range(len(pages)))
    objects.append(f"<< /Type /Pages /Count {len(pages)} /Kids [{page_refs}] >>".encode("ascii"))
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    for index, page_lines in enumerate(pages):
        content_commands = ["BT", "/F1 11 Tf", f"72 {start_y} Td"]
        for line_index, line in enumerate(page_lines):
            if line_index > 0:
                content_commands.append(f"0 -{line_step} Td")
            content_commands.append(f"({_escape_pdf_text(line)}) Tj")
        content_commands.append("ET")
        content_stream = "\n".join(content_commands).encode("latin-1", errors="replace")
        content_obj = b"<< /Length " + str(len(content_stream)).encode("ascii") + b" >>\nstream\n" + content_stream + b"\nendstream"
        page_obj = f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 {page_height}] /Resources << /Font << /F1 3 0 R >> >> /Contents {5 + index * 2} 0 R >>".encode("ascii")
        objects.append(page_obj)
        objects.append(content_obj)

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n".encode("ascii"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")

    xref_start = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%EOF".encode("ascii")
    )
    return bytes(pdf)
