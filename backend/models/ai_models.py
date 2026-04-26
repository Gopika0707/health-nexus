"""
=============================================
HEALTH NEXUS — AI Model Definitions

Models used across the platform:
  1. VitalsPredictorLSTM      — Vitals trend forecasting
  2. AnomalyDetectorIsolation — Vital anomaly detection
  3. MedicalReportNLP         — ClinicalBERT report analysis
  4. MentalHealthClassifier   — Burnout/depression screening
  5. SurvivalAnalysis (Cox)   — Treatment outcome prediction
=============================================
"""

from typing import List, Dict, Optional
import numpy as np


# ── 1. LSTM Vitals Forecaster ─────────────────
class VitalsForecastConfig:
    """
    LSTM / Temporal Transformer for 7–30 day vital sign prediction.
    Inputs: historical readings (heart rate, BP, SpO2, glucose, temp)
    Outputs: predicted values + confidence intervals
    """
    MODEL_TYPE = "LSTM"
    SEQUENCE_LENGTH = 30      # 30-day look-back window
    FORECAST_HORIZON = 7      # 7-day forecast
    HIDDEN_SIZE = 128
    NUM_LAYERS = 3
    DROPOUT = 0.2
    FEATURES = ["heart_rate", "systolic_bp", "diastolic_bp", "blood_sugar",
                 "spo2", "temperature", "bmi", "respiratory_rate"]


# ── 2. Anomaly Detector ───────────────────────
class AnomalyDetectionConfig:
    """
    Isolation Forest + Z-score ensemble for vital anomaly detection.
    Flags readings that deviate significantly from patient's baseline.
    """
    # Isolation Forest
    N_ESTIMATORS = 200
    CONTAMINATION = 0.05      # Expected anomaly rate
    MAX_FEATURES = 1.0

    # Z-score threshold
    ZSCORE_THRESHOLD = 2.5

    @staticmethod
    def compute_zscore(values: List[float]) -> List[float]:
        arr = np.array(values)
        mean, std = arr.mean(), arr.std()
        return list((arr - mean) / (std + 1e-8))

    @staticmethod
    def detect_zscore_anomalies(values: List[float], threshold: float = 2.5) -> List[bool]:
        zscores = AnomalyDetectionConfig.compute_zscore(values)
        return [abs(z) > threshold for z in zscores]


# ── 3. Medical NLP (ClinicalBERT / MedGemma) ──
class MedicalNLPConfig:
    """
    ClinicalBERT for medical report analysis.
    Extracts: diagnoses, abnormalities, medications, severity.

    Model: emilyalsentzer/Bio_ClinicalBERT (HuggingFace)
    Fallback: Google MedGemma (via Vertex AI)
    """
    CLINICALBERT_MODEL = "emilyalsentzer/Bio_ClinicalBERT"
    MEDGEMMA_MODEL = "google/medgemma-4b"

    # OCR pipeline
    OCR_BACKEND = "google_vision"          # or "tesseract"
    PDF_BACKEND = "pymupdf"

    # Output schema
    SEVERITY_SCALE = (0, 100)
    RISK_LEVELS = ["Low", "Moderate", "High", "Critical"]

    @staticmethod
    def severity_to_risk(score: int) -> str:
        if score < 25:   return "Low"
        if score < 50:   return "Moderate"
        if score < 75:   return "High"
        return "Critical"


# ── 4. Mental Health Classifier ───────────────
class MentalHealthConfig:
    """
    Multi-label classifier for mental wellness assessment.
    Screens for burnout, depression, anxiety, sleep disorders.

    Input features: mood scores, sleep hours, stress levels, activity patterns
    Output: wellness_score (0–100), burnout_risk, recommendations
    """
    BURNOUT_THRESHOLD = 40        # Score < 40 → high burnout risk
    DEPRESSION_THRESHOLD = 35
    SLEEP_NORMAL_HOURS = (7, 9)

    WELLNESS_DIMENSIONS = ["Mood", "Sleep", "Energy", "Focus", "Social", "Stress"]

    PHQ9_QUESTIONS = [
        "Little interest or pleasure in doing things",
        "Feeling down, depressed, or hopeless",
        "Trouble falling or staying asleep, or sleeping too much",
        "Feeling tired or having little energy",
        "Poor appetite or overeating",
    ]


# ── 5. Treatment Outcome Predictor (Cox) ──────
class SurvivalAnalysisConfig:
    """
    Cox Proportional Hazards model for treatment outcome prediction.
    Compares survival/recovery curves across treatment modalities.

    Libraries: lifelines (Python), scikit-survival
    """
    TIME_UNIT = "weeks"
    MAX_FOLLOWUP_WEEKS = 52

    TREATMENT_OPTIONS = [
        "Medication A",
        "Medication B",
        "Surgical Intervention",
        "Robotic Surgery",
        "Traditional Therapy",
    ]

    RISK_FACTORS = [
        "age", "gender", "bmi", "smoking", "diabetes",
        "hypertension", "prior_cardiac_event", "cholesterol",
    ]
