// =============================================
// HEALTH NEXUS — API Service Layer
// All backend calls go through this module.
// Swap mock data for real fetch() calls when
// connecting to the FastAPI backend.
// =============================================

import { API_ENDPOINTS } from "@/constants/health";
import type {
  Patient, VitalReading, MedicalReport, DietPlan,
  DrugInfo, MentalHealthAssessment, HospitalNode,
  FederatedRound, AIModel, AuditLog, DoctorDashboardData,
  DoctorPatient, ClinicalRecommendation, FederatedTrainingSummary, ReportExplanation, VitalForecast,
} from "@/types";

// ── Auth token helpers ────────────────────────
const getToken = () => localStorage.getItem("hn_token");
const jsonHeaders = (includeAuth = true) => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(includeAuth && token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// ── Generic fetch wrapper ─────────────────────
async function apiFetch<T>(url: string, options?: RequestInit, includeAuth = true): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { ...jsonHeaders(includeAuth), ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "API Error");
  }
  return res.json() as Promise<T>;
}

type RegisterPayload = {
  user_id: string;
  password: string;
  full_name: string;
  age: number;
  gender: Patient["gender"];
  email: string;
  phone?: string;
  blood_group: Patient["blood_group"];
  chronic_illness?: string;
  genetic_conditions?: string;
  family_history: Patient["family_history"];
  lifestyle: Patient["lifestyle"];
};

// =============================================
// AUTH SERVICE
// =============================================
export const authService = {
  login: async (credentials: { user_id: string; password: string; role: string }) => {
    return apiFetch<{ access_token: string; token_type: string }>(
      API_ENDPOINTS.login,
      { method: "POST", body: JSON.stringify(credentials) },
      false,
    );
  },

  register: async (payload: RegisterPayload) => {
    return apiFetch<{ patient_id: string; message: string }>(
      API_ENDPOINTS.register,
      { method: "POST", body: JSON.stringify(payload) },
      false,
    );
  },
};

// =============================================
// PATIENT SERVICE
// =============================================
export const patientService = {
  getCurrent: () =>
    apiFetch<Patient>(API_ENDPOINTS.patientMe),

  getProfile: (patientId: string) =>
    apiFetch<Patient>(API_ENDPOINTS.patientProfile(patientId)),

  getVitals: (patientId: string) =>
    apiFetch<VitalReading[]>(API_ENDPOINTS.vitals(patientId)),

  updateVitals: (
    patientId: string,
    payload: {
      heart_rate: number;
      systolic_bp: number;
      diastolic_bp: number;
      blood_sugar: number;
      oxygen_level?: number;
      temperature: number;
      bmi: number;
    }
  ) =>
    apiFetch<Patient>(API_ENDPOINTS.vitals(patientId), {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  getVitalForecast: async (patientId: string) => {
    const response = await apiFetch<{ forecasts: Array<{ timestamp: string; heart_rate: number }> }>(
      API_ENDPOINTS.vitalForecast(patientId)
    );
    return {
      forecasts: response.forecasts.map((item) => ({
        timestamp: item.timestamp,
        heart_rate_forecast: item.heart_rate,
        confidence_lower: Math.max(item.heart_rate - 3, 0),
        confidence_upper: item.heart_rate + 3,
      })),
    };
  },

  getReports: (patientId: string) =>
    apiFetch<MedicalReport[]>(API_ENDPOINTS.reports(patientId)),

  explainReport: (patientId: string, reportId: string) =>
    apiFetch<ReportExplanation>(API_ENDPOINTS.reportExplain(patientId, reportId), { method: "POST" }),

  uploadReport: (
    patientId: string,
    payload: {
      file: File;
      age: number;
      gender: string;
      systolic_bp: number;
      diastolic_bp: number;
      sugar_level: number;
      cholesterol: number;
      ecg: string;
      heart_rate: number;
      oxygen_level: number;
      previous_disease_history: string[];
    }
  ) => {
    const form = new FormData();
    form.append("file", payload.file);
    form.append("age", String(payload.age));
    form.append("gender", payload.gender);
    form.append("systolic_bp", String(payload.systolic_bp));
    form.append("diastolic_bp", String(payload.diastolic_bp));
    form.append("sugar_level", String(payload.sugar_level));
    form.append("cholesterol", String(payload.cholesterol));
    form.append("ecg", payload.ecg);
    form.append("heart_rate", String(payload.heart_rate));
    form.append("oxygen_level", String(payload.oxygen_level));
    form.append("previous_disease_history", payload.previous_disease_history.join(", "));
    return fetch(API_ENDPOINTS.reports(patientId), {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    }).then(async (response) => {
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(err.detail ?? "API Error");
      }
      return response.json() as Promise<MedicalReport>;
    });
  },

  getDietPlan: (patientId: string) =>
    apiFetch<DietPlan>(API_ENDPOINTS.dietPlan(patientId)),

  getMentalHealth: (patientId: string) =>
    apiFetch<MentalHealthAssessment>(API_ENDPOINTS.mentalHealth(patientId)),

  submitMentalHealthAnswers: (patientId: string, answers: Record<string, string>) =>
    apiFetch<MentalHealthAssessment>(
      API_ENDPOINTS.mentalHealth(patientId),
      { method: "POST", body: JSON.stringify({ answers }) }
    ),
};

// =============================================
// DRUG SERVICE
// =============================================
export const drugService = {
  analyzeDrug: (payload: { drug_name: string; patient_id: string }) =>
    apiFetch<DrugInfo>(API_ENDPOINTS.drugAnalyze, {
      method: "POST", body: JSON.stringify(payload),
    }),

  searchDrug: (name: string) =>
    apiFetch<DrugInfo[]>(API_ENDPOINTS.drugSearch(name)),

  checkInteraction: (drugs: string[]) =>
    apiFetch<{ interactions: Array<{ drugs: string; severity: string; note: string }> }>(
      API_ENDPOINTS.prescriptionCheck,
      { method: "POST", body: JSON.stringify({ drugs }) }
    ),
};

// =============================================
// DOCTOR SERVICE
// =============================================
export const doctorService = {
  getDashboard: (doctorId: string) =>
    apiFetch<DoctorDashboardData>(API_ENDPOINTS.doctorDashboard(doctorId)),

  getPatients: (doctorId: string) =>
    apiFetch<DoctorPatient[]>(API_ENDPOINTS.doctorPatients(doctorId)),

  analyzeClinicalReport: (payload: {
    patient_id: string;
    age: number;
    gender: string;
    systolic_bp: number;
    diastolic_bp: number;
    sugar_level: number;
    cholesterol: number;
    ecg: string;
    heart_rate: number;
    oxygen_level: number;
    previous_disease_history: string[];
  }) =>
    apiFetch<ClinicalRecommendation>(API_ENDPOINTS.clinicalAnalyze, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  generateSOAP: (payload: { patient_id: string; visit_notes: string }) =>
    apiFetch<{ soap: string }>(API_ENDPOINTS.soapNote, {
      method: "POST", body: JSON.stringify(payload),
    }),

  updatePatientVitals: (
    patientId: string,
    payload: {
      heart_rate: number;
      systolic_bp: number;
      diastolic_bp: number;
      blood_sugar: number;
      oxygen_level: number;
      temperature: number;
      bmi: number;
    }
  ) =>
    apiFetch<Patient>(API_ENDPOINTS.vitals(patientId), {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deletePatientVitals: (patientId: string) =>
    apiFetch<Patient>(API_ENDPOINTS.vitals(patientId), {
      method: "DELETE",
    }),

  getTreatmentOutcomes: (payload: { patient_id: string; condition: string }) =>
    apiFetch<Array<{ treatment: string; success: number; risk: number; recovery_weeks: string }>>(
      API_ENDPOINTS.treatmentOutcome,
      { method: "POST", body: JSON.stringify(payload) }
    ),
};

// =============================================
// FEDERATED LEARNING SERVICE (Admin)
// =============================================
export const federationService = {
  getNodes: () =>
    apiFetch<HospitalNode[]>(API_ENDPOINTS.nodes),

  startFederatedRound: () =>
    apiFetch<{ round: number; message: string }>(
      API_ENDPOINTS.startRound, { method: "POST" }
    ),

  getFedStats: () =>
    apiFetch<{ rounds: FederatedRound[]; current_round: number }>(API_ENDPOINTS.fedStats),

  getTrainingSummary: () =>
    apiFetch<FederatedTrainingSummary>(API_ENDPOINTS.trainingSummary),

  getModelRegistry: () =>
    apiFetch<AIModel[]>(API_ENDPOINTS.modelRegistry),

  updateModelStatus: (modelId: string, action: "deploy" | "freeze" | "rollback") =>
    apiFetch<{ message: string }>(
      `${API_ENDPOINTS.modelRegistry}/${modelId}/${action}`,
      { method: "POST" }
    ),

  getAuditLogs: (limit = 50) =>
    apiFetch<AuditLog[]>(`${API_ENDPOINTS.auditLogs}?limit=${limit}`),
};
