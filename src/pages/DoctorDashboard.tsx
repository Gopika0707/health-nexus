import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Bell, Brain, CheckCircle, Database, ImageIcon, LineChartIcon, LogOut, Microscope, Pill, Search, Stethoscope, TrendingUp, Upload, User, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { doctorService, drugService, federationService, patientService } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import TreatmentAnalysis from "@/components/TreatmentAnalysis";
import PrescriptionSafety, { PrescriptionContext } from "@/components/PrescriptionSafety";
import type { AIModel, AuditLog, ClinicalRecommendation, DoctorDashboardData, DoctorPatient, FederatedRound, FederatedTrainingSummary, RiskLevel } from "@/types";
type AnalysisForm = {
  age: number;
  gender: string;
  systolic_bp: number;
  diastolic_bp: number;
  sugar_level: number;
  cholesterol: number;
  ecg: string;
  heart_rate: number;
  oxygen_level: number;
  previous_disease_history: string;
};
type LiveTrackingForm = {
  condition: string;
  recommendation: string;
  risk: RiskLevel;
  last_visit: string;
  heart_rate: number;
  systolic_bp: number;
  diastolic_bp: number;
  blood_sugar: number;
  cholesterol: number;
  ecg: string;
  oxygen_level: number;
};
type TreatmentOutcome = {
  treatment: string;
  success: number;
  risk: number;
  recovery_weeks: string;
};
type TreatmentPatientData = {
  name: string;
  age: number;
  gender: string;
  bmi: number;
  systolic_bp: number;
  diastolic_bp: number;
  blood_sugar: number;
  cholesterol: number;
  heart_rate: number;
  oxygen_level: number;
  condition: string;
  medical_history: string;
  allergies: string;
  current_medications: string;
  symptoms: string;
};
const riskTone: Record<string, string> = {
  Low: "bg-status-normal",
  Moderate: "bg-status-warning",
  High: "bg-status-critical",
  Critical: "bg-status-critical",
};
function buildForm(patient: DoctorPatient): AnalysisForm {
  return {
    age: patient.age,
    gender: patient.gender,
    systolic_bp: patient.latest_vitals.systolic_bp,
    diastolic_bp: patient.latest_vitals.diastolic_bp,
    sugar_level: patient.latest_vitals.blood_sugar,
    cholesterol: patient.latest_vitals.cholesterol,
    ecg: patient.latest_vitals.ecg,
    heart_rate: patient.latest_vitals.heart_rate,
    oxygen_level: patient.latest_vitals.oxygen_level,
    previous_disease_history: patient.previous_disease_history.join(", "),
  };
}
function buildLiveTrackingForm(patient: DoctorPatient): LiveTrackingForm {
  return {
    condition: patient.condition,
    recommendation: patient.recommendation,
    risk: patient.risk,
    last_visit: patient.last_visit,
    heart_rate: patient.latest_vitals.heart_rate,
    systolic_bp: patient.latest_vitals.systolic_bp,
    diastolic_bp: patient.latest_vitals.diastolic_bp,
    blood_sugar: patient.latest_vitals.blood_sugar,
    cholesterol: patient.latest_vitals.cholesterol,
    ecg: patient.latest_vitals.ecg,
    oxygen_level: patient.latest_vitals.oxygen_level,
  };
}
export default function DoctorDashboard() {
  const { doctorId, userId, isAuthenticated, logout, role } = useAuth();
  const resolvedDoctorId = doctorId ?? userId ?? "";
  const [section, setSection] = useState("overview");
  const [dashboard, setDashboard] = useState<DoctorDashboardData | null>(null);
  const [rounds, setRounds] = useState<FederatedRound[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [trainingSummary, setTrainingSummary] = useState<FederatedTrainingSummary | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [search, setSearch] = useState("");
  const [analysisForm, setAnalysisForm] = useState<AnalysisForm | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ClinicalRecommendation | null>(null);
  const [liveTrackingForm, setLiveTrackingForm] = useState<LiveTrackingForm | null>(null);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [reportDraft, setReportDraft] = useState({
    name: "",
    ai_summary: "",
    follow_up: "",
    explanation: "",
    severity_score: 0,
    risk_level: "Low" as RiskLevel,
  });
  const [visitNotes, setVisitNotes] = useState("");
  const [soapNote, setSoapNote] = useState("");
  const [prescriptionInput, setPrescriptionInput] = useState("Warfarin, Aspirin");
  const [interactions, setInteractions] = useState<Array<{ drugs: string; severity: string; note: string }>>([]);
  const [checkedDrugs, setCheckedDrugs] = useState<string[]>([]);
  const [prescriptionContext, setPrescriptionContext] = useState<PrescriptionContext>({
    age: undefined,
    gender: "",
    conditions: "",
    allergies: "",
    currentMedications: "",
    kidneyStatus: "",
    liverStatus: "",
  });
  const [treatmentAnalysis, setTreatmentAnalysis] = useState<Record<string, unknown> | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const loadData = useCallback(async () => {
    if (!resolvedDoctorId) return;
    setIsLoading(true);
    setError("");
    try {
      const [dashboardData, fedStats, registry, logs, training] = await Promise.all([
        doctorService.getDashboard(resolvedDoctorId),
        federationService.getFedStats(),
        federationService.getModelRegistry(),
        federationService.getAuditLogs(12),
        federationService.getTrainingSummary().catch(() => null),
      ]);
      setDashboard(dashboardData);
      setRounds(fedStats.rounds);
      setModels(registry);
      setAuditLogs(logs);
      setTrainingSummary(training);
      const firstPatient = dashboardData.patients[0];
      if (firstPatient) setSelectedPatientId((current) => current || firstPatient.patient_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [resolvedDoctorId]);
  useEffect(() => {
    if (!isAuthenticated) {
      setError("Doctor session not found. Sign in again.");
      setIsLoading(false);
      return;
    }
    void loadData();
  }, [isAuthenticated, loadData]);
  const selectedPatient = useMemo(
    () => dashboard?.patients.find((patient) => patient.patient_id === selectedPatientId) ?? null,
    [dashboard, selectedPatientId]
  );
  const selectedReport = useMemo(
    () => selectedPatient?.reports.find((report) => report.id === selectedReportId) ?? selectedPatient?.reports[0] ?? null,
    [selectedPatient, selectedReportId]
  );
  useEffect(() => {
    if (!selectedPatient) return;
    setAnalysisForm(buildForm(selectedPatient));
    setSelectedReportId((current) => {
      const nextReportId = selectedPatient.reports[0]?.id ?? "";
      return current && selectedPatient.reports.some((report) => report.id === current) ? current : nextReportId;
    });
    setLiveTrackingForm(buildLiveTrackingForm(selectedPatient));
    setPrescriptionContext({
      age: selectedPatient.age,
      gender: selectedPatient.gender,
      conditions: selectedPatient.condition,
      allergies: "",
      currentMedications: "",
      kidneyStatus: "",
      liverStatus: "",
    });
  }, [selectedPatient]);
  useEffect(() => {
    if (!selectedReport) {
      setReportDraft({
        name: "",
        ai_summary: "",
        follow_up: "",
        explanation: "",
        severity_score: 0,
        risk_level: "Low",
      });
      setAnalysisResult(null);
      return;
    }
    setAnalysisResult(selectedReport as ClinicalRecommendation);
    setReportDraft({
      name: selectedReport.name,
      ai_summary: selectedReport.ai_summary,
      follow_up: selectedReport.follow_up ?? "",
      explanation: selectedReport.explanation ?? "",
      severity_score: selectedReport.severity_score,
      risk_level: selectedReport.risk_level,
    });
  }, [selectedReport]);
  const filteredPatients = useMemo(() => {
    const items = dashboard?.patients ?? [];
    const q = search.trim().toLowerCase();
    return q ? items.filter((patient) => patient.patient_id.toLowerCase().includes(q) || patient.full_name.toLowerCase().includes(q)) : items;
  }, [dashboard, search]);
  const syntheticPatients = useMemo(() => (dashboard?.patients ?? []).filter((patient) => patient.user_id.startsWith("SYN-")), [dashboard]);
  const riskChartData = dashboard ? Object.entries(dashboard.risk_distribution).map(([level, count]) => ({ level, count })) : [];
  const roundChartData = rounds.map((round) => ({ round: `R${round.round_number}`, accuracy: round.global_accuracy }));
  const trainingChartData = trainingSummary?.history.map((round) => ({ round: `R${round.round_number}`, accuracy: round.global_accuracy, loss: round.global_loss })) ?? [];
  const latestTrainingRound = trainingSummary?.history.at(-1) ?? null;
  const handleAnalyze = async () => {
    if (!selectedPatient || !analysisForm) return;
    setIsSubmitting(true);
    try {
      const payload = {
        patient_id: selectedPatient.patient_id,
        ...analysisForm,
        previous_disease_history: analysisForm.previous_disease_history.split(",").map((item) => item.trim()).filter(Boolean),
      };
      const result = uploadFile
        ? await patientService.uploadReport(selectedPatient.patient_id, { file: uploadFile, ...payload })
        : await doctorService.analyzeClinicalReport(payload);
      setAnalysisResult(result as ClinicalRecommendation);
      setSelectedReportId(result.id);
      setUploadFile(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to analyze report.");
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleLiveTrackingSave = async () => {
    if (!selectedPatient || !liveTrackingForm) return;
    setIsSubmitting(true);
    try {
      await doctorService.updateLiveTracking(selectedPatient.patient_id, {
        latest_vitals: {
          heart_rate: liveTrackingForm.heart_rate,
          systolic_bp: liveTrackingForm.systolic_bp,
          diastolic_bp: liveTrackingForm.diastolic_bp,
          blood_sugar: liveTrackingForm.blood_sugar,
          cholesterol: liveTrackingForm.cholesterol,
          ecg: liveTrackingForm.ecg,
          oxygen_level: liveTrackingForm.oxygen_level,
        },
        recommendation: liveTrackingForm.recommendation,
        condition: liveTrackingForm.condition,
        risk: liveTrackingForm.risk,
        last_visit: liveTrackingForm.last_visit,
      });
      setError(""); // Clear any previous errors
      // Show success feedback
      const successMsg = "Vitals updated! Changes are being synced to patient portal...";
      console.log(successMsg);
      // Set a temporary success message
      const originalError = error;
      setError(successMsg);
      setTimeout(() => {
        setError(originalError);
      }, 3000);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update live tracking.");
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleReportUpdate = async () => {
    if (!selectedPatient) return;
    const reportId = selectedReportId || selectedPatient.reports[0]?.id;
    const report = selectedPatient.reports.find((item) => item.id === reportId);
    if (!report) {
      setError("Choose a report before updating it.");
      return;
    }
    setIsSubmitting(true);
    try {
      await doctorService.updateReport(selectedPatient.patient_id, report.id, {
        name: report.name,
        follow_up: report.follow_up,
        ai_summary: report.ai_summary,
        explanation: report.explanation,
        recommendations: report.recommendations,
        severity_score: report.severity_score,
        risk_level: report.risk_level,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update report.");
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleReportDelete = async () => {
    if (!selectedPatient) return;
    const reportId = selectedReportId || selectedPatient.reports[0]?.id;
    if (!reportId) {
      setError("Choose a report before deleting it.");
      return;
    }
    setIsSubmitting(true);
    try {
      await doctorService.deleteReport(selectedPatient.patient_id, reportId);
      setSelectedReportId("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete report.");
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleSoap = async () => {
    if (!selectedPatient || !visitNotes.trim()) return;
    setIsSubmitting(true);
    try {
      const result = await doctorService.generateSOAP({ patient_id: selectedPatient.patient_id, visit_notes: visitNotes });
      setSoapNote(result.soap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate SOAP note.");
    } finally {
      setIsSubmitting(false);
    }
  };
  const updatePrescriptionContext = (field: keyof PrescriptionContext, value: string) => {
    setPrescriptionContext((prev) => ({
      ...prev,
      [field]: field === "age" ? (Number(value) || undefined) : value,
    }));
  };
  const handlePrescription = async () => {
    const parsedDrugs = prescriptionInput.split(",").map((item) => item.trim()).filter(Boolean);
    if (!parsedDrugs.length) {
      setError("Enter at least one drug to check.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await drugService.checkInteraction(parsedDrugs);
      setInteractions(result.interactions);
      setCheckedDrugs(parsedDrugs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to check prescription safety.");
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleTreatmentAnalysis = async (patientData: TreatmentPatientData) => {
    if (!selectedPatient) return;
    setIsSubmitting(true);
    try {
      const result = await doctorService.getTreatmentOutcomes({ patient_id: selectedPatient.patient_id, condition: selectedPatient.condition });
      
      // Transform the simple outcomes data to comprehensive treatment analysis
      const analysis = generateTreatmentAnalysis(result, selectedPatient, patientData);
      setTreatmentAnalysis(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate treatment analysis.");
    } finally {
      setIsSubmitting(false);
    }
  };
  const generateTreatmentAnalysis = (outcomes: TreatmentOutcome[], patient: DoctorPatient, patientData: TreatmentPatientData) => {
    // Build comprehensive analysis from outcomes data and patient input
    const medication = outcomes.find((o) => o.treatment.toLowerCase().includes("medication")) || { treatment: "Medication", success: 75, risk: 20, recovery_weeks: "2-4" };
    const surgery = outcomes.find((o) => o.treatment.toLowerCase().includes("surgery")) || { treatment: "Surgery", success: 85, risk: 45, recovery_weeks: "4-8" };
    const robotic = outcomes.find((o) => o.treatment.toLowerCase().includes("robotic")) || { treatment: "Robotic Surgery", success: 90, risk: 25, recovery_weeks: "2-3" };
    const lifestyle = outcomes.find((o) => o.treatment.toLowerCase().includes("lifestyle")) || { treatment: "Lifestyle Changes", success: 60, risk: 5, recovery_weeks: "8-12" };
    const severity = patient.risk === "High" || patient.risk === "Critical" ? "severe" : patient.risk === "Moderate" ? "moderate" : "mild";
    const isPrimaryMedication = severity === "mild" || severity === "moderate";
    return {
      treatment_comparison: {
        medication: {
          success_rate: medication.success,
          risk_level: "Low",
          recovery_time: medication.recovery_weeks + " weeks",
          best_for: "Mild to moderate cases"
        },
        surgery: {
          success_rate: surgery.success,
          risk_level: "Medium/High",
          recovery_time: surgery.recovery_weeks + " weeks",
          best_for: "Severe or advanced conditions"
        },
        robotic_surgery: {
          success_rate: robotic.success,
          risk_level: "Low/Medium",
          recovery_time: robotic.recovery_weeks + " weeks",
          best_for: "Precision-required cases"
        },
        lifestyle_changes: {
          success_rate: lifestyle.success,
          risk_level: "Very Low",
          recovery_time: lifestyle.recovery_weeks + " weeks",
          best_for: "Early-stage or preventive care"
        }
      },
      recommended_approach: {
        primary_treatment: isPrimaryMedication ? "Medication + Lifestyle Changes" : "Consider Surgical Options",
        reason: [
          `Based on patient's ${severity} condition severity`,
          `Age (${patient.age}) and risk profile (${patient.risk})`,
          `Risk vs benefit analysis favors non-invasive approach initially`,
          `Escalation path available if condition worsens`
        ]
      },
      combined_plan: [
        isPrimaryMedication && "Start with targeted medication therapy",
        isPrimaryMedication && "Implement strict lifestyle modifications including diet and exercise",
        "Monitor vitals and symptoms weekly",
        severity !== "mild" && "Schedule follow-up imaging/tests in 4 weeks",
        !isPrimaryMedication && "Prepare for potential surgical consultation if medical management fails",
        "Consider robotic surgery if precision intervention needed"
      ].filter(Boolean),
      risk_analysis: {
        medication_risk: "Low",
        surgical_risk: severity === "severe" ? "Medium" : "Medium/High",
        robotic_surgery_risk: "Low",
        lifestyle_risk: "Minimal",
        special_considerations: [
          patient.previous_disease_history?.includes("hypertension") && "Diabetes increases surgical risk",
          patient.latest_vitals?.systolic_bp > 140 && "High BP requires careful monitoring before surgery",
          patient.previous_disease_history?.includes("allergies") && "Consider medication allergies before prescription"
        ].filter(Boolean)
      },
      outcome_prediction: {
        medication: {
          probability: medication.success,
          notes: "Improvement expected within 2-4 weeks with medication compliance"
        },
        surgery: {
          success_rate: surgery.success,
          notes: "Higher success rate but longer recovery period"
        },
        robotic_surgery: {
          success_rate: robotic.success,
          notes: "Highest precision with faster recovery than traditional surgery"
        },
        lifestyle: {
          timeline: "Gradual improvement over weeks to months",
          notes: "Long-term benefits with sustained lifestyle changes"
        }
      },
      treatment_timeline: [
        {
          phase: "Week 1-2: Stabilization",
          duration: "2 weeks",
          action: "Medication initiation, baseline monitoring, dietary counseling"
        },
        {
          phase: "Week 3-6: Adaptation",
          duration: "4 weeks",
          action: "Lifestyle changes implementation, medication adjustment if needed"
        },
        {
          phase: "Week 7-12: Evaluation",
          duration: "6 weeks",
          action: "Comprehensive assessment, outcome measurement, future planning"
        },
        {
          phase: "Ongoing: Maintenance",
          duration: "Long-term",
          action: severity === "severe" ? "Surgical option evaluation if no improvement" : "Continued management and prevention"
        }
      ],
      ai_reasoning: [
        `Patient: ${patientData.name}, Age ${patientData.age}, ${patientData.gender}`,
        `Presenting condition: ${patientData.condition} with ${severity} severity`,
        `Current vitals: BP ${patientData.systolic_bp}/${patientData.diastolic_bp} mmHg, Blood Sugar ${patientData.blood_sugar} mg/dL, HR ${patientData.heart_rate} bpm`,
        `Risk profile: ${patient.risk} - Non-invasive treatments (medication + lifestyle) show ${medication.success}% success rate`,
        patientData.allergies && `Allergies documented: ${patientData.allergies}`,
        patientData.current_medications && `Current medications: ${patientData.current_medications}`,
        patientData.symptoms && `Reported symptoms: ${patientData.symptoms}`,
        `Surgical options reserved for cases showing insufficient medical management response`,
        `Robotic surgery provides ${robotic.success}% success with faster recovery if needed`,
        `Recommendation prioritizes patient safety with graduated escalation approach`,
        "Analysis is AI-generated and requires physician validation before clinical implementation"
      ].filter(Boolean)
    };
  };
  if (isLoading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading dashboard...</div>;
  if (!dashboard) return <div className="min-h-screen grid place-items-center text-muted-foreground">{error || "Dashboard unavailable."}</div>;
  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex flex-col w-64 bg-gradient-to-b from-[hsl(174_72%_20%)] to-[hsl(174_72%_14%)] text-white">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-white" />
            <span className="font-display font-bold text-lg">Health<span className="text-secondary">Nexus</span></span>
          </div>
        </div>
        <div className="p-4 m-4 rounded-2xl bg-white/8 border border-white/10 text-sm">
          <div className="font-semibold">{dashboard.doctor.full_name}</div>
          <div className="text-xs text-white/60">{dashboard.doctor.doctor_id}</div>
          <div className="mt-2 text-xs text-white/80">{syntheticPatients.length} imported synthetic FL demo cases</div>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {[
            { id: "overview", label: "Overview", icon: Activity },
            { id: "patients", label: "Patient Access", icon: Users },
            { id: "ai-assistant", label: "AI Assistant", icon: Brain },
            { id: "prescription", label: "Prescription", icon: Pill },
            { id: "outcomes", label: "Outcomes", icon: TrendingUp },
          ].map((item) => (
            <button key={item.id} onClick={() => setSection(item.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${section === item.id ? "bg-secondary/30 text-secondary" : "text-white/60 hover:bg-white/5 hover:text-white"}`}>
              <item.icon className="w-4 h-4" /> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <Button variant="ghost" size="sm" onClick={logout} className="w-full text-white/40 hover:text-white hover:bg-white/5"><LogOut className="w-4 h-4 mr-2" /> Sign Out</Button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-foreground">Clinical Dashboard</h1>
            <p className="text-xs text-muted-foreground">{dashboard.doctor.hospital}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end rounded-xl border border-border bg-muted/40 px-3 py-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Current Account</span>
              <span className="text-xs font-medium text-foreground">{userId} | {role}</span>
            </div>
            <div className="text-xs rounded-full bg-primary/10 px-3 py-1.5 text-primary">{dashboard.federated_snapshot.model_version} - Round {dashboard.federated_snapshot.current_round}</div>
            <Button variant="outline" size="sm"><Bell className="w-4 h-4" /></Button>
            <div className="w-8 h-8 bg-gradient-to-br from-secondary to-accent rounded-full flex items-center justify-center"><User className="w-4 h-4 text-white" /></div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error ? <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
          {section === "overview" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Active Patients", value: dashboard.overview.active_patients, icon: Users, color: "from-primary to-primary-glow" },
                  { label: "Synthetic Cases", value: syntheticPatients.length, icon: Database, color: "from-sky-500 to-cyan-500" },
                  { label: "FL Accuracy", value: trainingSummary ? `${trainingSummary.final_accuracy}%` : "n/a", icon: Brain, color: "from-primary-deep to-primary" },
                  { label: "Models", value: models.length, icon: Activity, color: "from-secondary to-accent" },
                ].map((item) => (
                  <div key={item.label} className={`bg-gradient-to-br ${item.color} rounded-2xl p-4 text-white`}>
                    <item.icon className="w-6 h-6 mb-2 opacity-80" />
                    <div className="font-display text-3xl font-bold">{item.value}</div>
                    <div className="text-xs text-white/70 mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card rounded-2xl p-5 border border-border">
                  <h3 className="font-semibold text-sm mb-4">Risk Distribution</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={riskChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 25% 90%)" />
                      <XAxis dataKey="level" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(174 72% 38%)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-card rounded-2xl p-5 border border-border">
                  <h3 className="font-semibold text-sm mb-4">Federated Accuracy</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={roundChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 25% 90%)" />
                      <XAxis dataKey="round" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="accuracy" stroke="hsl(174 72% 38%)" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}
          {section === "patients" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-sm">Live Tracking Control Center</h3>
                    <p className="text-xs text-muted-foreground">Create a snapshot, update the live vitals, or remove a report. Patient view refreshes from the same record.</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">Auto-sync ready</span>
                </div>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-10" placeholder="Search by Patient ID or name..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1fr] gap-6">
                <div className="space-y-3">
                  {filteredPatients.map((patient) => (
                    <button key={patient.patient_id} onClick={() => setSelectedPatientId(patient.patient_id)} className={`w-full rounded-2xl border bg-card p-4 text-left ${selectedPatientId === patient.patient_id ? "border-primary" : "border-border"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-sm">{patient.full_name}</div>
                          <div className="text-xs text-muted-foreground mt-1">{patient.patient_id} - Age {patient.age} - {patient.condition}</div>
                        </div>
                        {patient.user_id.startsWith("SYN-") ? <span className="text-[10px] rounded-full bg-primary/10 px-2 py-1 text-primary">Synthetic FL</span> : null}
                      </div>
                      <span className={`mt-3 inline-flex text-xs px-2 py-1 rounded-full ${riskTone[patient.risk]}`}>{patient.risk}</span>
                    </button>
                  ))}
                </div>
                {selectedPatient && liveTrackingForm ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold">{selectedPatient.full_name}</h3>
                          <p className="text-xs text-muted-foreground">{selectedPatient.patient_id} - Last visit {selectedPatient.last_visit}</p>
                        </div>
                        <span className={`inline-flex text-xs px-2 py-1 rounded-full ${riskTone[selectedPatient.risk]}`}>{selectedPatient.risk}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-muted/50 p-3">BP: {selectedPatient.latest_vitals.systolic_bp}/{selectedPatient.latest_vitals.diastolic_bp}</div>
                        <div className="rounded-xl bg-muted/50 p-3">Sugar: {selectedPatient.latest_vitals.blood_sugar}</div>
                        <div className="rounded-xl bg-muted/50 p-3">HR: {selectedPatient.latest_vitals.heart_rate}</div>
                        <div className="rounded-xl bg-muted/50 p-3">SpO2: {selectedPatient.latest_vitals.oxygen_level}%</div>
                      </div>
                      <Textarea value={liveTrackingForm.recommendation} onChange={(e) => setLiveTrackingForm((prev) => prev ? { ...prev, recommendation: e.target.value } : prev)} className="min-h-24" />
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs text-muted-foreground">Condition</label><Input value={liveTrackingForm.condition} onChange={(e) => setLiveTrackingForm((prev) => prev ? { ...prev, condition: e.target.value } : prev)} /></div>
                        <div><label className="text-xs text-muted-foreground">Risk</label><Input value={liveTrackingForm.risk} onChange={(e) => setLiveTrackingForm((prev) => prev ? { ...prev, risk: e.target.value as RiskLevel } : prev)} /></div>
                        <div><label className="text-xs text-muted-foreground">Last Visit</label><Input value={liveTrackingForm.last_visit} onChange={(e) => setLiveTrackingForm((prev) => prev ? { ...prev, last_visit: e.target.value } : prev)} /></div>
                        <div><label className="text-xs text-muted-foreground">ECG</label><Input value={liveTrackingForm.ecg} onChange={(e) => setLiveTrackingForm((prev) => prev ? { ...prev, ecg: e.target.value } : prev)} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs text-muted-foreground">Heart Rate</label><Input type="number" value={liveTrackingForm.heart_rate} onChange={(e) => setLiveTrackingForm((prev) => prev ? { ...prev, heart_rate: Number(e.target.value) } : prev)} /></div>
                        <div><label className="text-xs text-muted-foreground">Blood Sugar</label><Input type="number" value={liveTrackingForm.blood_sugar} onChange={(e) => setLiveTrackingForm((prev) => prev ? { ...prev, blood_sugar: Number(e.target.value) } : prev)} /></div>
                        <div><label className="text-xs text-muted-foreground">Systolic BP</label><Input type="number" value={liveTrackingForm.systolic_bp} onChange={(e) => setLiveTrackingForm((prev) => prev ? { ...prev, systolic_bp: Number(e.target.value) } : prev)} /></div>
                        <div><label className="text-xs text-muted-foreground">Diastolic BP</label><Input type="number" value={liveTrackingForm.diastolic_bp} onChange={(e) => setLiveTrackingForm((prev) => prev ? { ...prev, diastolic_bp: Number(e.target.value) } : prev)} /></div>
                        <div><label className="text-xs text-muted-foreground">Cholesterol</label><Input type="number" value={liveTrackingForm.cholesterol} onChange={(e) => setLiveTrackingForm((prev) => prev ? { ...prev, cholesterol: Number(e.target.value) } : prev)} /></div>
                        <div><label className="text-xs text-muted-foreground">Oxygen Level</label><Input type="number" value={liveTrackingForm.oxygen_level} onChange={(e) => setLiveTrackingForm((prev) => prev ? { ...prev, oxygen_level: Number(e.target.value) } : prev)} /></div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={handleAnalyze} disabled={isSubmitting} className="gradient-primary text-white border-0">{isSubmitting ? "Working..." : "Create Clinical Snapshot"}</Button>
                        <Button onClick={handleLiveTrackingSave} disabled={isSubmitting} variant="outline" title="Save vitals and sync to patient portal">{isSubmitting ? "Updating..." : "Save & Sync Vitals"}</Button>
                        <Button onClick={handleReportDelete} disabled={isSubmitting || !selectedReport} variant="destructive">Delete Selected Report</Button>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-sm">Reports</h3>
                          <p className="text-xs text-muted-foreground">Pick one report to edit or remove.</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{selectedPatient.reports.length} total</span>
                      </div>
                      <div className="space-y-2">
                        {selectedPatient.reports.map((report) => (
                          <button
                            key={report.id}
                            type="button"
                            onClick={() => setSelectedReportId(report.id)}
                            className={`w-full rounded-xl border p-3 text-left ${selectedReport?.id === report.id ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold">{report.name}</div>
                                <div className="text-xs text-muted-foreground">{report.type} - {new Date(report.date).toLocaleString()}</div>
                              </div>
                              <span className="rounded-full bg-muted px-2 py-1 text-[10px] uppercase tracking-wide">{report.risk_level}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                      {selectedReport ? (
                        <div className="space-y-3 rounded-xl bg-muted/30 p-4">
                          <Input value={reportDraft.name} onChange={(e) => setReportDraft((prev) => ({ ...prev, name: e.target.value }))} />
                          <Textarea value={reportDraft.ai_summary} onChange={(e) => setReportDraft((prev) => ({ ...prev, ai_summary: e.target.value }))} className="min-h-24" />
                          <Textarea value={reportDraft.follow_up} onChange={(e) => setReportDraft((prev) => ({ ...prev, follow_up: e.target.value }))} className="min-h-20" />
                          <div className="grid grid-cols-2 gap-3">
                            <Input type="number" value={reportDraft.severity_score} onChange={(e) => setReportDraft((prev) => ({ ...prev, severity_score: Number(e.target.value) }))} />
                            <Input value={reportDraft.risk_level} onChange={(e) => setReportDraft((prev) => ({ ...prev, risk_level: e.target.value as RiskLevel }))} />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={async () => {
                                if (!selectedPatient) return;
                                setIsSubmitting(true);
                                try {
                                  await doctorService.updateReport(selectedPatient.patient_id, selectedReport.id, reportDraft);
                                  await loadData();
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : "Unable to save report changes.");
                                } finally {
                                  setIsSubmitting(false);
                                }
                              }}
                              disabled={isSubmitting}
                            >
                              Save Report
                            </Button>
                            <Button onClick={handleReportDelete} disabled={isSubmitting} variant="destructive">Delete</Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}

          {section === "ai-assistant" && selectedPatient && analysisForm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <div><h3 className="font-semibold text-sm">Federated Report Analyzer</h3><p className="text-xs text-muted-foreground">Generate recommendation text from report uploads or structured clinical fields.</p></div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["age", "Age"], ["systolic_bp", "Systolic BP"], ["diastolic_bp", "Diastolic BP"], ["sugar_level", "Sugar Level"],
                    ["cholesterol", "Cholesterol"], ["heart_rate", "Heart Rate"], ["oxygen_level", "Oxygen Level"],
                  ].map(([field, label]) => (
                    <div key={field}><label className="text-xs text-muted-foreground">{label}</label><Input type="number" value={analysisForm[field as keyof AnalysisForm] as number} onChange={(e) => setAnalysisForm((prev) => prev ? { ...prev, [field]: Number(e.target.value) } : prev)} /></div>
                  ))}
                </div>
                <Input value={analysisForm.gender} onChange={(e) => setAnalysisForm((prev) => prev ? { ...prev, gender: e.target.value } : prev)} placeholder="Gender" />
                <Input value={analysisForm.ecg} onChange={(e) => setAnalysisForm((prev) => prev ? { ...prev, ecg: e.target.value } : prev)} placeholder="ECG summary" />
                <Textarea value={analysisForm.previous_disease_history} onChange={(e) => setAnalysisForm((prev) => prev ? { ...prev, previous_disease_history: e.target.value } : prev)} />
                <div className="rounded-2xl border border-dashed border-border p-4"><label className="flex items-center gap-2 text-sm text-muted-foreground"><Upload className="w-4 h-4" /> Optional medical report upload</label><Input type="file" className="mt-3" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} /></div>
                <Button onClick={handleAnalyze} disabled={isSubmitting} className="gradient-primary text-white border-0">{isSubmitting ? "Analyzing..." : "Generate Clinical Recommendation"}</Button>
                <Textarea placeholder="Visit notes for SOAP generation" value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)} />
                <Button onClick={handleSoap} disabled={isSubmitting || !visitNotes.trim()} variant="outline">Generate SOAP Note</Button>
                {soapNote ? <pre className="whitespace-pre-wrap rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">{soapNote}</pre> : null}
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <h3 className="font-semibold text-sm">Recommendation Panel</h3>
                {analysisResult ? (
                  <>
                    <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4"><span className={`text-xs rounded-full px-2 py-0.5 ${riskTone[analysisResult.risk_level]}`}>{analysisResult.risk_level} Risk</span><p className="mt-3 text-sm font-medium">{analysisResult.ai_summary}</p><p className="mt-2 text-xs text-muted-foreground">{analysisResult.follow_up}</p></div>
                    <div className="space-y-2">{analysisResult.findings.map((finding) => <div key={finding} className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">{finding}</div>)}</div>
                    <div className="space-y-2">{analysisResult.recommendations.map((item) => <div key={item} className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground"><CheckCircle className="mt-0.5 h-4 w-4 text-health-normal" /><span>{item}</span></div>)}</div>
                    <div className="text-xs text-muted-foreground">{analysisResult.explanation}</div>
                  </>
                ) : <p className="text-sm text-muted-foreground">No analysis generated yet.</p>}
              </div>
            </motion.div>
          )}
          {section === "outcomes" && selectedPatient && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              <TreatmentAnalysis 
                data={treatmentAnalysis} 
                isLoading={isSubmitting}
                onLoad={handleTreatmentAnalysis}
                initialPatientData={{
                  name: selectedPatient.full_name,
                  age: selectedPatient.age,
                  gender: selectedPatient.gender || "",
                  bmi: 0,
                  systolic_bp: selectedPatient.latest_vitals?.systolic_bp || 0,
                  diastolic_bp: selectedPatient.latest_vitals?.diastolic_bp || 0,
                  blood_sugar: selectedPatient.latest_vitals?.blood_sugar || 0,
                  cholesterol: selectedPatient.latest_vitals?.cholesterol || 0,
                  heart_rate: selectedPatient.latest_vitals?.heart_rate || 0,
                  oxygen_level: selectedPatient.latest_vitals?.oxygen_level || 0,
                  condition: selectedPatient.condition || "",
                  medical_history: selectedPatient.previous_disease_history?.join(", ") || "",
                  allergies: "",
                  current_medications: "",
                  symptoms: "",
                }}
              />
            </motion.div>
          )}
          {section === "prescription" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-5">
                <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                  <div>
                    <h3 className="font-semibold text-sm">Prescription Safety AI</h3>
                    <p className="text-xs text-muted-foreground">AI converts interaction signals into structured guidance. Enter drugs and patient context.</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Drugs to evaluate (comma separated)</p>
                    <Input value={prescriptionInput} onChange={(e) => setPrescriptionInput(e.target.value)} placeholder="Warfarin, Aspirin" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Age</p>
                      <Input type="number" value={prescriptionContext.age ?? ""} onChange={(e) => updatePrescriptionContext("age", e.target.value)} />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Gender</p>
                      <Input value={prescriptionContext.gender ?? ""} onChange={(e) => updatePrescriptionContext("gender", e.target.value)} placeholder="male / female / other" />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Primary conditions</p>
                      <Input value={prescriptionContext.conditions ?? ""} onChange={(e) => updatePrescriptionContext("conditions", e.target.value)} placeholder="e.g., hypertension, diabetes" />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Allergies</p>
                      <Input value={prescriptionContext.allergies ?? ""} onChange={(e) => updatePrescriptionContext("allergies", e.target.value)} placeholder="e.g., penicillin, sulfa" />
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Current medications</p>
                      <Textarea value={prescriptionContext.currentMedications ?? ""} onChange={(e) => updatePrescriptionContext("currentMedications", e.target.value)} placeholder="Current medications separated by commas" className="min-h-20" />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Kidney status</p>
                      <Input value={prescriptionContext.kidneyStatus ?? ""} onChange={(e) => updatePrescriptionContext("kidneyStatus", e.target.value)} placeholder="eGFR, CKD stage, or 'normal'" />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Liver status</p>
                      <Input value={prescriptionContext.liverStatus ?? ""} onChange={(e) => updatePrescriptionContext("liverStatus", e.target.value)} placeholder="LFTs, cirrhosis status, or 'normal'" />
                    </div>
                  </div>
                  <Button onClick={handlePrescription} disabled={isSubmitting} className="w-full gradient-primary text-white border-0">
                    {isSubmitting ? "Analyzing..." : "Run Safety Check"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Safety assistant outputs supportive guidance only. Clinical judgment and local protocols remain primary.
                  </p>
                </div>
                <PrescriptionSafety
                  interactions={interactions}
                  drugs={checkedDrugs}
                  context={prescriptionContext}
                  isLoading={isSubmitting}
                />
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-semibold text-sm mb-3">Recent Audit Events</h3>
                <div className="space-y-2">{auditLogs.slice(0, 5).map((log) => <div key={log.id} className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">{log.action}</span> - {log.node_id} - {log.timestamp}</div>)}</div>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
