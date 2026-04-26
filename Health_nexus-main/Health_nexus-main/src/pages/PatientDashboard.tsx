import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Bell,
  Brain,
  CheckCircle,
  FileText,
  Heart,
  LogOut,
  Pill,
  Salad,
  Sparkles,
  Thermometer,
  TrendingUp,
  Upload,
  User,
  Wind,
  XCircle,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { drugService, patientService } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import type { DietPlan, DrugInfo, MedicalReport, MentalHealthAssessment, Patient, ReportExplanation, VitalForecast, VitalReading } from "@/types";

type DashboardSection = "vitals" | "reports" | "diet" | "drugs" | "mental";

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { role, userId, patientId, isAuthenticated, logout } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [forecast, setForecast] = useState<VitalForecast[]>([]);
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [mentalHealth, setMentalHealth] = useState<MentalHealthAssessment | null>(null);
  const [drugQuery, setDrugQuery] = useState("Metformin");
  const [drugResult, setDrugResult] = useState<DrugInfo | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [reportExplanation, setReportExplanation] = useState<ReportExplanation | null>(null);
  const [isExplainingReport, setIsExplainingReport] = useState(false);
  const [activeSection, setActiveSection] = useState<DashboardSection>("vitals");
  const [mentalAnswers, setMentalAnswers] = useState<Record<string, string>>({});
  const [isGeneratingMentalHealth, setIsGeneratingMentalHealth] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const suitabilityConfig = {
    suitable: { label: "Suitable", tone: "bg-health-normal/10 text-health-normal", icon: CheckCircle },
    use_with_caution: { label: "Use With Caution", tone: "bg-health-warning/10 text-health-warning", icon: AlertTriangle },
    not_suitable: { label: "Not Suitable", tone: "bg-health-critical/10 text-health-critical", icon: XCircle },
    unknown: { label: "Unknown", tone: "bg-muted text-muted-foreground", icon: AlertTriangle },
  } as const;

  const navItems = [
    { id: "vitals", label: "Vital Monitoring", icon: Activity },
    { id: "reports", label: "Report Analysis", icon: FileText },
    { id: "diet", label: "AI Diet Planner", icon: Salad },
    { id: "drugs", label: "Drug Analyzer", icon: Pill },
    { id: "mental", label: "Mental Health", icon: Brain },
  ] as const;

  const refreshDashboard = useCallback(async (silent = false) => {
    if (!isAuthenticated || role !== "patient") {
      setError("Patient session not found. Sign in again.");
      setIsLoading(false);
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }
    setError("");

    try {
      if (!patientId) {
        localStorage.removeItem("hn_token");
        navigate("/patient/login", { replace: true });
        return;
      }

      const currentPatient = await patientService.getProfile(patientId);
      const [currentVitals, currentForecast, currentReports, currentDiet, currentMental] = await Promise.all([
        patientService.getVitals(patientId),
        patientService.getVitalForecast(patientId),
        patientService.getReports(patientId),
        patientService.getDietPlan(patientId),
        patientService.getMentalHealth(patientId),
      ]);

      setPatient(currentPatient);
      setVitals(currentVitals);
      setForecast(currentForecast.forecasts);
      setReports(currentReports);
      setDietPlan(currentDiet);
      setMentalHealth(currentMental);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load patient dashboard.";
      if (
        message.includes("Patient access required") ||
        message.includes("Invalid authentication token") ||
        message.includes("Token expired") ||
        message.includes("Not authenticated")
      ) {
        localStorage.removeItem("hn_token");
        navigate("/patient/login", { replace: true });
        return;
      }
      setError(message);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, navigate, patientId, role]);

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    if (!isAuthenticated || role !== "patient") return;
    const timer = window.setInterval(() => {
      void refreshDashboard(true);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, refreshDashboard, role]);

  useEffect(() => {
    if (!selectedReportId && reports.length > 0) {
      setSelectedReportId(reports[0].id);
    }
  }, [reports, selectedReportId]);

  const latestVital = vitals.at(-1);
  const nextForecast = forecast[0] ?? null;
  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null,
    [reports, selectedReportId]
  );
  const currentVitals = latestVital ?? {
    heart_rate: patient.latest_vitals.heart_rate,
    systolic_bp: patient.latest_vitals.systolic_bp,
    diastolic_bp: patient.latest_vitals.diastolic_bp,
    blood_sugar: patient.latest_vitals.blood_sugar,
    spo2: patient.latest_vitals.oxygen_level,
    temperature: patient.latest_vitals.temperature ?? 98.4,
    bmi: patient.latest_vitals.bmi ?? 24.5,
  };
  const trendData = vitals.map((vital) => ({
    date: new Date(vital.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    heart_rate: vital.heart_rate,
    blood_sugar: vital.blood_sugar,
  }));

  const handleDrugCheck = async () => {
    if (!drugQuery.trim() || !patient?.patient_id) return;

    setError("");
    try {
      const result = await drugService.analyzeDrug({ drug_name: drugQuery, patient_id: patient.patient_id });
      setDrugResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to analyze drug.");
    }
  };

  const handleReportUpload = async () => {
    if (!patient || !uploadFile) {
      setError("Choose a report file before uploading.");
      return;
    }

    setError("");
    setIsUploading(true);
    try {
      const uploadedReport = await patientService.uploadReport(patient.patient_id, {
        file: uploadFile,
        age: patient.age,
        gender: patient.gender,
        systolic_bp: patient.latest_vitals.systolic_bp,
        diastolic_bp: patient.latest_vitals.diastolic_bp,
        sugar_level: patient.latest_vitals.blood_sugar,
        cholesterol: patient.latest_vitals.cholesterol,
        ecg: patient.latest_vitals.ecg,
        heart_rate: patient.latest_vitals.heart_rate,
        oxygen_level: patient.latest_vitals.oxygen_level,
        previous_disease_history: patient.previous_disease_history ?? [],
      });
      setReports((current) => [uploadedReport, ...current.filter((report) => report.id !== uploadedReport.id)]);
      setSelectedReportId(uploadedReport.id);
      setReportExplanation(null);
      setUploadFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload report.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleExplainReport = async () => {
    if (!patient || !selectedReport) return;
    setError("");
    setIsExplainingReport(true);
    try {
      const explanation = await patientService.explainReport(patient.patient_id, selectedReport.id);
      setReportExplanation(explanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate detailed report explanation.");
    } finally {
      setIsExplainingReport(false);
    }
  };

  const handleMentalOptionSelect = (questionId: string, option: string) => {
    setMentalAnswers((current) => ({ ...current, [questionId]: option }));
  };

  const handleMentalHealthSubmit = async () => {
    if (!patient) return;
    if (Object.keys(mentalAnswers).length < 4) {
      setError("Answer all four mental health questions before generating the assessment.");
      return;
    }

    setError("");
    setIsGeneratingMentalHealth(true);
    try {
      const result = await patientService.submitMentalHealthAnswers(patient.patient_id, mentalAnswers);
      setMentalHealth(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate mental health assessment.");
    } finally {
      setIsGeneratingMentalHealth(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading patient dashboard...</div>;
  }

  if (!patient) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">{error || "Patient data unavailable."}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="hidden lg:flex w-64 flex-col bg-[#0d376f] text-white">
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/15">
              <FileText className="h-5 w-5 text-cyan-300" />
            </div>
            <span className="font-display text-2xl font-bold">Health<span className="text-cyan-300">Nexus</span></span>
          </div>
        </div>

        <div className="m-4 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-500">
            <User className="h-5 w-5" />
          </div>
          <div className="font-semibold">{patient.full_name}</div>
          <div className="mt-1 text-sm text-white/65">{patient.patient_id}</div>
          <div className="mt-4 flex gap-2 text-xs">
            <span className="rounded-full bg-green-500/15 px-3 py-1 text-green-300">O+</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">Age {patient.age}</span>
          </div>
        </div>

        <div className="px-4 py-2 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition-colors ${
                activeSection === item.id ? "bg-sky-600/40 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-auto border-t border-white/10 p-4">
          <Button variant="ghost" size="sm" onClick={logout} className="w-full justify-start text-white/70 hover:bg-white/5 hover:text-white">
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold text-slate-900">Patient Dashboard</h1>
              <p className="mt-1 text-sm text-slate-500">Current account: {userId} | {patient.patient_id}</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live sync from doctor portal every 3 seconds
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden rounded-full bg-green-50 px-4 py-2 text-sm text-green-700 md:block">All Vitals Normal</div>
              <Button variant="outline" size="sm"><Bell className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={logout} className="inline-flex">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
              <div className="grid h-10 w-10 place-items-center rounded-full bg-sky-500 text-white">
                <User className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {error ? <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
            {[
              { label: "Heart Rate", value: currentVitals.heart_rate ?? "-", unit: "bpm", icon: Heart },
              { label: "Blood Pressure", value: `${currentVitals.systolic_bp ?? "-"} / ${currentVitals.diastolic_bp ?? "-"}`, unit: "mmHg", icon: Activity },
              { label: "Blood Sugar", value: currentVitals.blood_sugar ?? "-", unit: "mg/dL", icon: Sparkles },
              { label: "SpO2", value: currentVitals.spo2 ?? "-", unit: "%", icon: Wind },
              { label: "Temperature", value: currentVitals.temperature ?? "98.4", unit: "°F", icon: Thermometer },
              { label: "BMI", value: currentVitals.bmi ?? "24.5", unit: "kg/m²", icon: TrendingUp },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-4">
                <item.icon className="mb-3 h-5 w-5 text-slate-400" />
                <div className="font-display text-3xl font-bold text-slate-900">{item.value}</div>
                <div className="text-xs text-slate-500">{item.unit}</div>
                <div className="mt-1 text-sm text-slate-600">{item.label}</div>
              </div>
            ))}
          </div>

          {activeSection === "vitals" ? (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-4xl font-bold text-slate-900">Vital Monitoring Engine</h2>
                <p className="mt-2 text-lg text-slate-500">Live tracking from the doctor portal. Updates refresh automatically.</p>
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <h3 className="font-semibold text-slate-900">Heart Rate Trend + Forecast</h3>
                  <p className="text-sm text-slate-500">7-day historical + 3-day AI prediction</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#dbe4f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="heart_rate" stroke="#2563eb" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="blood_sugar" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <h3 className="font-semibold text-slate-900">Current AI Recommendation</h3>
                  <div className="mt-4 rounded-2xl bg-sky-50 p-4 text-sm text-slate-700">
                    {selectedReport?.ai_summary ?? "Low immediate risk. Continue preventive monitoring and routine follow-up."}
                  </div>
                  <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    Follow-up: {selectedReport?.follow_up ?? "Continue routine monitoring."}
                  </div>
                  {nextForecast ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                      Forecast: next heart-rate trend may move toward {nextForecast.heart_rate_forecast} bpm.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "reports" ? (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-4xl font-bold text-slate-900">Medical Report Analysis</h2>
                <p className="mt-2 text-lg text-slate-500">ClinicalBERT + MedGemma powered report intelligence</p>
              </div>
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-sky-600 text-white">
                  <Upload className="h-8 w-8" />
                </div>
                <div className="mt-6 text-2xl font-semibold text-slate-900">Upload Medical Reports</div>
                <div className="mt-2 text-slate-500">MRI, CT, X-ray, Blood Reports, PDFs</div>
                <input
                  type="file"
                  accept=".pdf,.json,.txt"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="mx-auto mt-6 block text-sm text-slate-500"
                />
                <Button onClick={handleReportUpload} disabled={!uploadFile || isUploading} className="mt-4 bg-sky-600 text-white hover:bg-sky-700">
                  {isUploading ? "Uploading..." : "Browse Files"}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { step: "STEP 01", title: "OCR Extraction", subtitle: "Google Vision / Tesseract", color: "from-blue-600 to-blue-500" },
                    { step: "STEP 02", title: "NLP Analysis", subtitle: "ClinicalBERT", color: "from-cyan-600 to-cyan-500" },
                    { step: "STEP 03", title: "Risk Scoring", subtitle: "0-100 severity index", color: "from-amber-500 to-orange-500" },
                    { step: "STEP 04", title: "Plain Summary", subtitle: "Patient-readable output", color: "from-emerald-500 to-green-400" },
                  ].map((item) => (
                    <div key={item.step} className={`rounded-3xl bg-gradient-to-r ${item.color} p-5 text-white`}>
                      <div className="text-xs font-semibold text-white/75">{item.step}</div>
                      <div className="mt-3 text-2xl font-bold">{item.title}</div>
                      <div className="mt-2 text-sm text-white/80">{item.subtitle}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <h3 className="font-semibold text-slate-900">Previous Reports</h3>
                  <div className="mt-4 space-y-3">
                    {reports.length ? reports.map((report) => (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => {
                          setSelectedReportId(report.id);
                          setReportExplanation(null);
                        }}
                        className={`w-full rounded-2xl border p-4 text-left ${
                          selectedReport?.id === report.id ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-semibold text-slate-900">{report.name}</div>
                            <div className="text-sm text-slate-500">{report.type} • {new Date(report.date).toLocaleDateString()}</div>
                          </div>
                          <div className="text-right text-sm text-slate-500">
                            <div className="inline-flex rounded-full bg-green-50 px-3 py-1 text-green-700">{report.risk_level}</div>
                            <div className="mt-2">Severity: {report.severity_score}/100</div>
                          </div>
                        </div>
                      </button>
                    )) : (
                      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No previous reports available.</div>
                    )}
                  </div>
                </div>
              </div>
              {selectedReport ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-semibold text-slate-900">{selectedReport.name}</h3>
                      <p className="text-sm text-slate-500">{selectedReport.type} • {new Date(selectedReport.date).toLocaleString()}</p>
                    </div>
                    <div className="rounded-full bg-sky-50 px-4 py-2 text-sm text-sky-700">{selectedReport.risk_level}</div>
                  </div>
                  <p className="mt-4 text-slate-700">{selectedReport.ai_summary}</p>
                  <div className="mt-4">
                    <Button onClick={handleExplainReport} disabled={isExplainingReport} className="bg-sky-600 text-white hover:bg-sky-700">
                      {isExplainingReport ? "Explaining..." : "Explain With Gemini"}
                    </Button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {selectedReport.findings.length ? selectedReport.findings.map((finding) => (
                      <div key={finding} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">{finding}</div>
                    )) : null}
                  </div>
                  {reportExplanation ? (
                    <div className="mt-6 space-y-4">
                      <div className="rounded-2xl bg-sky-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">Detailed Explanation</div>
                        <p className="mt-2 text-sm text-slate-700">{reportExplanation.detailed_explanation}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">Patient-Friendly Summary</div>
                        <p className="mt-2 text-sm text-slate-700">{reportExplanation.patient_friendly_summary}</p>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <div className="text-sm font-semibold text-slate-900">Clinical Takeaways</div>
                          <div className="mt-3 space-y-2 text-sm text-slate-700">
                            {reportExplanation.clinical_takeaways.map((item) => <div key={item}>{item}</div>)}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <div className="text-sm font-semibold text-slate-900">Recommended Questions</div>
                          <div className="mt-3 space-y-2 text-sm text-slate-700">
                            {reportExplanation.recommended_questions.map((item) => <div key={item}>{item}</div>)}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <div className="text-sm font-semibold text-slate-900">Recommendations</div>
                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                          {reportExplanation.recommendations.map((item) => <div key={item}>{item}</div>)}
                        </div>
                        <div className="mt-4 text-xs text-slate-500">{reportExplanation.note}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {activeSection === "diet" ? (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-4xl font-bold text-slate-900">AI Diet Planner</h2>
                <p className="mt-2 text-lg text-slate-500">Personalized plan based on BMI, conditions, activity and preferences</p>
              </div>
              <div className="rounded-3xl bg-gradient-to-r from-cyan-600 to-teal-500 p-6 text-white">
                <div className="text-sm text-white/80">Daily Calorie Target</div>
                <div className="mt-2 font-display text-6xl font-bold">{dietPlan?.daily_calorie_target ?? "-"}</div>
                <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                  <div><div className="text-3xl font-bold">95g</div><div className="text-sm text-white/80">Protein</div></div>
                  <div><div className="text-3xl font-bold">240g</div><div className="text-sm text-white/80">Carbs</div></div>
                  <div><div className="text-3xl font-bold">44g</div><div className="text-sm text-white/80">Fat</div></div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="space-y-4 xl:col-span-2">
                  <h3 className="text-2xl font-semibold text-slate-900">Today's Meal Plan</h3>
                  {dietPlan?.meals.map((meal) => (
                    <div key={meal.meal} className="rounded-3xl border border-slate-200 bg-white p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xl font-semibold text-slate-900">{meal.meal}</div>
                          <div className="text-sm text-slate-500">{meal.time}</div>
                          <div className="mt-3 space-y-1 text-sm text-slate-600">
                            {meal.items.map((item) => <div key={item}>{item}</div>)}
                          </div>
                        </div>
                        <div className="text-sm font-medium text-sky-700">{meal.calories} kcal</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  <div className="rounded-3xl border border-red-200 bg-red-50 p-5">
                    <h3 className="text-xl font-semibold text-slate-900">Foods To Avoid</h3>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      {dietPlan?.avoid_list.map((item) => <div key={item}>{item}</div>)}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-5">
                    <h3 className="text-xl font-semibold text-slate-900">Micronutrient Targets</h3>
                    <div className="mt-4 space-y-4">
                      {dietPlan?.micronutrients.map((item) => (
                        <div key={item.name}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-700">{item.name}</span>
                            <span className="text-slate-500">{item.percentage}%</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-sky-600" style={{ width: `${item.percentage}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === "drugs" ? (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-4xl font-bold text-slate-900">Drug Analyzer</h2>
                <p className="mt-2 text-lg text-slate-500">Review suitability, side effects, regulatory bans, and patient-specific safety.</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <Textarea value={drugQuery} onChange={(e) => setDrugQuery(e.target.value)} className="min-h-24" />
                <Button onClick={handleDrugCheck} className="mt-4 bg-sky-600 text-white hover:bg-sky-700">Analyze Drug</Button>
                {drugResult ? (
                  <div className="mt-6 rounded-3xl bg-slate-50 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-2xl font-semibold text-slate-900">Drug analysis summary</div>
                        <div className="text-sm text-slate-500">Details for the submitted medication.</div>
                      </div>
                      {(() => {
                        const config = suitabilityConfig[drugResult.patient_suitability];
                        const Icon = config.icon;
                        return (
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium ${config.tone}`}>
                            <Icon className="h-4 w-4" />
                            {config.label}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-3">
                      <div className="rounded-2xl bg-white p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Regulatory Status</div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">{drugResult.status}</div>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Suitability Score</div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">{drugResult.suitability_score}/100</div>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500">Banned Anywhere?</div>
                        <div className="mt-2 text-lg font-semibold text-slate-900">
                          {drugResult.banned_markets?.length ? "Yes" : "No confirmed ban"}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">Primary Usage</div>
                      <div className="mt-2">{drugResult.purpose}</div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600">
                      <div className="font-semibold text-slate-900">Suitable For This Patient?</div>
                      <div className="mt-2">{drugResult.patient_suitability_reason}</div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">Usage Guidance</div>
                      <div className="mt-2">{drugResult.dosage_guidance}</div>
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl bg-white p-4">
                        <div className="font-semibold text-slate-900">Common Side Effects</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {drugResult.side_effects.map((effect) => (
                            <span key={effect} className="rounded-full bg-red-50 px-3 py-1 text-sm text-red-700">
                              {effect}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <div className="font-semibold text-slate-900">Notable Interactions</div>
                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                          {drugResult.interactions.map((item) => (
                            <div key={item}>{item}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-white p-4">
                      <div className="font-semibold text-slate-900">Country Ban Status</div>
                      {drugResult.banned_markets?.length ? (
                        <div className="mt-3 space-y-3">
                          {drugResult.banned_markets.map((item) => (
                            <div key={`${item.country}-${item.reason}`} className="rounded-2xl bg-amber-50 p-4 text-sm text-slate-700">
                              <div className="font-semibold text-slate-900">{item.country}</div>
                              <div className="mt-1">{item.reason}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-slate-600">
                          No confirmed country or regional ban was returned by the analyzer.
                        </div>
                      )}
                    </div>
                    {drugResult.safer_alternatives?.length ? (
                      <div className="mt-4 rounded-2xl bg-white p-4">
                        <div className="font-semibold text-slate-900">Safer Alternatives</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {drugResult.safer_alternatives.map((item) => (
                            <span key={item} className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4 text-sm text-slate-500">{drugResult.note}</div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeSection === "mental" ? (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-4xl font-bold text-slate-900">Mental Health Monitoring</h2>
                <p className="mt-2 text-lg text-slate-500">AI-powered burnout, depression screening & wellness scoring</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <h3 className="text-2xl font-semibold text-slate-900">Daily Wellness Check-In</h3>
                <p className="mt-2 text-sm text-slate-500">Answer 4 quick questions for your AI mental health score</p>
                <div className="mt-8 space-y-8">
                  {[
                    { id: "1", question: "How would you rate your mood today?", options: ["Very Low", "Low", "Neutral", "Good", "Excellent"] },
                    { id: "2", question: "How many hours did you sleep last night?", options: ["< 4", "4-5", "6-7", "7-8", "> 8"] },
                    { id: "3", question: "Current stress level?", options: ["Very High", "High", "Moderate", "Low", "Minimal"] },
                    { id: "4", question: "Physical energy levels?", options: ["Exhausted", "Tired", "Average", "Energized", "Very Active"] },
                  ].map((item) => (
                    <div key={item.id}>
                      <div className="text-lg font-medium text-slate-900">{item.question}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.options.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => handleMentalOptionSelect(item.id, option)}
                            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                              mentalAnswers[item.id] === option
                                ? "border-sky-500 bg-sky-50 text-slate-900"
                                : "border-slate-200 bg-white text-slate-500 hover:border-sky-300 hover:text-slate-900"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleMentalHealthSubmit}
                  disabled={isGeneratingMentalHealth}
                  className="mt-8 bg-sky-400 text-white hover:bg-sky-500"
                >
                  {isGeneratingMentalHealth ? "Generating..." : "Generate AI Assessment"}
                </Button>
                {mentalHealth ? (
                  <div className="mt-8 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    Wellness score: <span className="font-semibold text-slate-900">{mentalHealth.wellness_score}</span> | Burnout risk: <span className="font-semibold text-slate-900">{mentalHealth.burnout_risk}</span>
                    {mentalHealth.recommendations?.length ? (
                      <div className="mt-4 space-y-2">
                        {mentalHealth.recommendations.map((recommendation) => (
                          <div key={recommendation} className="rounded-xl bg-white p-3 text-slate-600">{recommendation}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
            <span className="font-semibold text-slate-900">Medical Disclaimer:</span> AI-generated insights are for informational purposes only. Always consult a qualified healthcare provider.
          </div>
        </div>
      </main>
    </div>
  );
}
