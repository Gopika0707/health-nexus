// =============================================
// HEALTH NEXUS — Health Domain Constants
// =============================================

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;

export const FAMILY_DISEASES = [
  "Diabetes",
  "Hypertension",
  "Heart Disease",
  "Cancer",
  "Stroke",
  "Thyroid Disorders",
] as const;

export const SPECIALTIES = [
  "Cardiology",
  "Neurology",
  "Oncology",
  "General Medicine",
  "Pediatrics",
  "Orthopedics",
  "Radiology",
  "Dermatology",
  "Other",
] as const;

// ── Vital Normal Ranges (default — adjusted by AI per patient profile) ──
export const VITAL_RANGES = {
  heart_rate:      { min: 60,  max: 100, unit: "bpm",    label: "Heart Rate" },
  systolic_bp:     { min: 90,  max: 120, unit: "mmHg",   label: "Systolic BP" },
  diastolic_bp:    { min: 60,  max: 80,  unit: "mmHg",   label: "Diastolic BP" },
  blood_sugar:     { min: 70,  max: 99,  unit: "mg/dL",  label: "Blood Sugar" },
  spo2:            { min: 95,  max: 100, unit: "%",       label: "SpO₂" },
  temperature:     { min: 97,  max: 99,  unit: "°F",     label: "Temperature" },
  bmi:             { min: 18.5,max: 24.9,unit: "kg/m²",  label: "BMI" },
  respiratory_rate:{ min: 12,  max: 20,  unit: "/min",   label: "Respiratory Rate" },
} as const;

// ── Risk color coding ────────────────────────
export const RISK_COLORS = {
  normal:   "bg-status-normal",
  warning:  "bg-status-warning",
  critical: "bg-status-critical",
} as const;

export const RISK_TEXT_COLORS = {
  normal:   "text-health-normal",
  warning:  "text-health-warning",
  critical: "text-health-critical",
} as const;

// ── Federated Learning Config ────────────────
export const FL_CONFIG = {
  algorithm: "FedAvg",
  min_nodes_for_round: 2,
  target_rounds: 50,
  gradient_clip_norm: 1.0,
  dp_noise_multiplier: 0.01,
  dp_max_grad_norm: 1.0,
  local_epochs: 5,
  batch_size: 32,
  learning_rate: 0.001,
} as const;

// ── API Endpoints (consumed by frontend services) ──
export const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export const API_ENDPOINTS = {
  // Auth
  login:          `${API_BASE}/auth/login`,
  register:       `${API_BASE}/auth/register`,
  refresh:        `${API_BASE}/auth/refresh`,

  // Patient
  patientMe:      `${API_BASE}/patients/me`,
  patientProfile: (id: string) => `${API_BASE}/patients/${id}`,
  patientEvents:  (id: string, token: string) => `${API_BASE}/patients/${id}/events?access_token=${encodeURIComponent(token)}`,
  vitals:         (id: string) => `${API_BASE}/patients/${id}/vitals`,
  vitalForecast:  (id: string) => `${API_BASE}/patients/${id}/vitals/forecast`,
  reports:        (id: string) => `${API_BASE}/patients/${id}/reports`,
  reportExplain:  (patientId: string, reportId: string) => `${API_BASE}/patients/${patientId}/reports/${reportId}/explain`,
  liveTracking:   (id: string) => `${API_BASE}/patients/${id}/live-tracking`,
  reportUpdate:   (patientId: string, reportId: string) => `${API_BASE}/patients/${patientId}/reports/${reportId}`,
  dietPlan:       (id: string) => `${API_BASE}/patients/${id}/diet`,
  mentalHealth:   (id: string) => `${API_BASE}/patients/${id}/mental-health`,

  // Drug Analyzer
  drugAnalyze:    `${API_BASE}/drugs/analyze`,
  drugSearch:     (name: string) => `${API_BASE}/drugs/search?q=${name}`,

  // Doctor
  doctorDashboard: (id: string) => `${API_BASE}/doctors/${id}/dashboard`,
  doctorPatients: (id: string) => `${API_BASE}/doctors/${id}/patients`,
  clinicalAnalyze: `${API_BASE}/clinical/analyze`,
  soapNote:       `${API_BASE}/clinical/soap`,
  prescriptionCheck: `${API_BASE}/clinical/prescription/check`,
  treatmentOutcome: `${API_BASE}/clinical/outcomes`,

  // Admin / Federated
  nodes:          `${API_BASE}/federation/nodes`,
  startRound:     `${API_BASE}/federation/round/start`,
  fedStats:       `${API_BASE}/federation/stats`,
  trainingSummary:`${API_BASE}/federation/training-summary`,
  modelRegistry:  `${API_BASE}/models`,
  auditLogs:      `${API_BASE}/audit/logs`,
} as const;
