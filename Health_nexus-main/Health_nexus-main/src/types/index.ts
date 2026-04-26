// =============================================
// HEALTH NEXUS — Shared TypeScript Types
// =============================================

// ── Auth & Roles ──────────────────────────────
export type UserRole = "patient" | "doctor" | "admin";

export interface JWTPayload {
  user_id: string;
  role: UserRole;
  patient_id?: string;
  doctor_id?: string;
  exp: number;
  iat: number;
}

// ── Patient ────────────────────────────────────
export interface Patient {
  patient_id: string;        // Auto-generated UUID (e.g. PNX-2025-84731)
  user_id: string;
  full_name: string;
  age: number;
  gender: "male" | "female" | "other";
  email: string;
  phone?: string;
  blood_group: BloodGroup;
  chronic_illness?: string;
  genetic_conditions?: string;
  family_history: FamilyDisease[];
  lifestyle: PatientLifestyle;
  created_at: string;
  condition?: string;
  risk?: RiskLevel;
  last_visit?: string;
  previous_disease_history?: string[];
  latest_vitals: {
    heart_rate: number;
    systolic_bp: number;
    diastolic_bp: number;
    blood_sugar: number;
    cholesterol: number;
    ecg: string;
    oxygen_level: number;
    temperature?: number;
    bmi?: number;
  };
  vitals_history?: VitalReading[];
  recommendation?: string;
  reports?: MedicalReport[];
}

export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-";

export type FamilyDisease =
  | "Diabetes"
  | "Hypertension"
  | "Heart Disease"
  | "Cancer"
  | "Stroke"
  | "Thyroid Disorders";

export interface PatientLifestyle {
  smoking: "no" | "yes" | "occasional";
  alcohol: "none" | "moderate" | "high";
  activity: "low" | "moderate" | "high";
  sleep_hours: number;
  diet: "vegetarian" | "non-vegetarian" | "vegan" | "other";
  occupation?: string;
  stress_level: "low" | "medium" | "high";
  location?: string;
}

// ── Doctor ────────────────────────────────────
export interface Doctor {
  doctor_id: string;
  full_name: string;
  specialty: string;
  hospital: string;
  experience_years: number;
  license_number: string;
  active_patients: number;
}

export interface DoctorPatient {
  patient_id: string;
  user_id: string;
  full_name: string;
  age: number;
  gender: "male" | "female" | "other";
  email: string;
  blood_group: BloodGroup;
  condition: string;
  risk: RiskLevel;
  last_visit: string;
  recommendation: string;
  previous_disease_history: string[];
  latest_vitals: {
    heart_rate: number;
    systolic_bp: number;
    diastolic_bp: number;
    blood_sugar: number;
    cholesterol: number;
    ecg: string;
    oxygen_level: number;
    temperature?: number;
    bmi?: number;
  };
  vitals_history?: VitalReading[];
  reports: MedicalReport[];
}

export interface DoctorDashboardData {
  doctor: Doctor;
  patients: DoctorPatient[];
  overview: {
    active_patients: number;
    critical_cases: number;
    consultations_today: number;
    ai_flags: number;
  };
  risk_distribution: Record<RiskLevel, number>;
  recent_flags: Array<{
    patient: string;
    level: RiskLevel;
    flag: string;
  }>;
  federated_snapshot: {
    current_round: number;
    global_accuracy: number;
    model_version: string;
  };
}

// ── Vitals ────────────────────────────────────
export type VitalStatus = "normal" | "warning" | "critical";

export interface VitalReading {
  id: string;
  patient_id: string;
  timestamp: string;
  heart_rate: number;
  systolic_bp: number;
  diastolic_bp: number;
  blood_sugar: number;
  spo2: number;
  temperature: number;
  bmi: number;
  respiratory_rate: number;
  status: VitalStatus;
}

export interface VitalForecast {
  timestamp: string;
  heart_rate_forecast: number;
  confidence_lower: number;
  confidence_upper: number;
}

// ── Medical Reports ───────────────────────────
export type ReportType = "MRI" | "CT" | "X-Ray" | "Blood Report" | "PDF" | "DICOM" | "JSON";
export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";

export interface MedicalReport {
  id: string;
  patient_id: string;
  name: string;
  type: ReportType;
  date: string;
  severity_score: number;   // 0–100
  risk_level: RiskLevel;
  findings: string[];
  ai_summary: string;
  follow_up?: string;
  file_url?: string;
  explanation?: string;
  recommendations?: string[];
  model_version?: string;
}

export interface ReportExplanation {
  detailed_explanation: string;
  patient_friendly_summary: string;
  clinical_takeaways: string[];
  recommended_questions: string[];
  recommendations: string[];
  note: string;
}

export interface ClinicalRecommendation extends MedicalReport {
  explanation: string;
  recommendations: string[];
  model_version: string;
}

// ── Drug Analyzer ─────────────────────────────
export type DrugStatus = "approved" | "restricted" | "banned";
export type PatientDrugSuitability = "suitable" | "use_with_caution" | "not_suitable" | "unknown";

export interface DrugInfo {
  name: string;
  generic_name?: string;
  purpose: string;
  status: DrugStatus;
  dosage_guidance: string;
  side_effects: string[];
  interactions: string[];
  suitability_score: number;    // 0–100
  patient_suitability: PatientDrugSuitability;
  patient_suitability_reason: string;
  banned_countries?: string[];
  banned_markets?: Array<{ country: string; reason: string }>;
  safer_alternatives?: string[];
  note: string;
}

// ── Diet Plan ─────────────────────────────────
export interface Meal {
  meal: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  time: string;
  calories: number;
  items: string[];
  macros: { protein: number; carbs: number; fat: number };
}

export interface DietPlan {
  patient_id: string;
  daily_calorie_target: number;
  meals: Meal[];
  avoid_list: string[];
  micronutrients: MicronutrientTarget[];
}

export interface MicronutrientTarget {
  name: string;
  target: string;
  current: string;
  percentage: number;
}

// ── Mental Health ─────────────────────────────
export interface MentalHealthAssessment {
  patient_id: string;
  date: string;
  wellness_score: number;   // 0–100
  burnout_risk: "Low" | "Low-Moderate" | "Moderate" | "High";
  dimensions: WellnessDimension[];
  recommendations: string[];
}

export interface WellnessDimension {
  subject: "Mood" | "Sleep" | "Energy" | "Focus" | "Social" | "Stress";
  value: number;
}

// ── Federated Learning ────────────────────────
export type NodeStatus = "training" | "idle" | "offline";

export interface HospitalNode {
  id: string;
  name: string;
  location: string;
  status: NodeStatus;
  patient_count: number;
  local_accuracy: number;
  current_round: number;
}

export interface FederatedRound {
  round_number: number;
  global_accuracy: number;
  local_avg_accuracy: number;
  loss: number;
  nodes_participated: number;
  timestamp: string;
}

export interface TrainingRoundSummary {
  round_number: number;
  global_accuracy: number;
  global_loss: number;
  nodes_participated: number;
  local_metrics: Array<{
    node_id: string;
    samples: number;
    accuracy: number;
    loss: number;
  }>;
}

export interface FederatedTrainingSummary {
  data_dir: string;
  rounds: number;
  local_epochs: number;
  learning_rate: number;
  noise_multiplier: number;
  hospitals: string[];
  feature_count: number;
  weights: number[];
  bias: number;
  history: TrainingRoundSummary[];
  final_accuracy: number;
  final_loss: number;
}

export interface AIModel {
  id: string;
  name: string;
  type: string;
  status: "active" | "frozen" | "deprecated";
  global_accuracy: number;
  deployed_nodes: number;
  deployed_at: string;
  version: string;
}

// ── Audit ─────────────────────────────────────
export interface AuditLog {
  id: string;
  timestamp: string;
  round: string;
  node_id: string;
  action: string;
  status: "success" | "error" | "warning";
  metadata?: Record<string, unknown>;
}
