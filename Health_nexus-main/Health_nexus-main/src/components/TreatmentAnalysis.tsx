import { CheckCircle, AlertCircle, Clock, TrendingUp, Zap, User, Heart, Activity, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface PatientDetails {
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
}

interface TreatmentAnalysisData {
  treatment_comparison: {
    medication: { success_rate: number; risk_level: string; recovery_time: string; best_for: string };
    surgery: { success_rate: number; risk_level: string; recovery_time: string; best_for: string };
    robotic_surgery: { success_rate: number; risk_level: string; recovery_time: string; best_for: string };
    lifestyle_changes: { success_rate: number; risk_level: string; recovery_time: string; best_for: string };
  };
  recommended_approach: {
    primary_treatment: string;
    reason: string[];
  };
  combined_plan: string[];
  risk_analysis: {
    medication_risk: string;
    surgical_risk: string;
    robotic_surgery_risk: string;
    lifestyle_risk: string;
    special_considerations: string[];
  };
  outcome_prediction: {
    medication: { probability: number; notes: string };
    surgery: { success_rate: number; notes: string };
    robotic_surgery: { success_rate: number; notes: string };
    lifestyle: { timeline: string; notes: string };
  };
  treatment_timeline: { phase: string; duration: string; action: string }[];
  ai_reasoning: string[];
}

interface TreatmentAnalysisProps {
  data: TreatmentAnalysisData | null;
  isLoading: boolean;
  onLoad: (patientData: PatientDetails) => void;
  initialPatientData?: Partial<PatientDetails>;
}

export default function TreatmentAnalysis({ data, isLoading, onLoad, initialPatientData }: TreatmentAnalysisProps) {
  const [patientForm, setPatientForm] = useState<PatientDetails>({
    name: initialPatientData?.name || "",
    age: initialPatientData?.age || 0,
    gender: initialPatientData?.gender || "",
    bmi: initialPatientData?.bmi || 0,
    systolic_bp: initialPatientData?.systolic_bp || 0,
    diastolic_bp: initialPatientData?.diastolic_bp || 0,
    blood_sugar: initialPatientData?.blood_sugar || 0,
    cholesterol: initialPatientData?.cholesterol || 0,
    heart_rate: initialPatientData?.heart_rate || 0,
    oxygen_level: initialPatientData?.oxygen_level || 0,
    condition: initialPatientData?.condition || "",
    medical_history: initialPatientData?.medical_history || "",
    allergies: initialPatientData?.allergies || "",
    current_medications: initialPatientData?.current_medications || "",
    symptoms: initialPatientData?.symptoms || "",
  });

  const handleInputChange = (field: keyof PatientDetails, value: any) => {
    setPatientForm(prev => ({
      ...prev,
      [field]: field === "name" || field === "gender" || field === "condition" || field === "medical_history" || field === "allergies" || field === "current_medications" || field === "symptoms"
        ? value
        : Number(value) || 0
    }));
  };

  const handleGenerateAnalysis = () => {
    onLoad(patientForm);
  };

  const getRiskColor = (risk: string) => {
    const riskLevel = risk.toLowerCase();
    if (riskLevel.includes("low") && !riskLevel.includes("very")) return "bg-green-100 text-green-800 border-green-300";
    if (riskLevel.includes("very low")) return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (riskLevel.includes("medium")) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (riskLevel.includes("high")) return "bg-red-100 text-red-800 border-red-300";
    return "bg-gray-100 text-gray-800 border-gray-300";
  };

  return (
    <div className="space-y-6">
      {/* Patient Details Input Form */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Patient Information</h3>
            <p className="text-xs text-muted-foreground">Enter or verify patient details for treatment analysis</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Personal Info */}
          <div>
            <Label className="text-xs font-medium">Patient Name</Label>
            <Input
              placeholder="Full name"
              value={patientForm.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Age</Label>
            <Input
              type="number"
              placeholder="Age in years"
              value={patientForm.age || ""}
              onChange={(e) => handleInputChange("age", e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Gender</Label>
            <Input
              placeholder="Male / Female / Other"
              value={patientForm.gender}
              onChange={(e) => handleInputChange("gender", e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">BMI</Label>
            <Input
              type="number"
              step="0.1"
              placeholder="Body Mass Index"
              value={patientForm.bmi || ""}
              onChange={(e) => handleInputChange("bmi", e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Vitals */}
          <div>
            <Label className="text-xs font-medium">Systolic BP (mmHg)</Label>
            <Input
              type="number"
              placeholder="Systolic"
              value={patientForm.systolic_bp || ""}
              onChange={(e) => handleInputChange("systolic_bp", e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Diastolic BP (mmHg)</Label>
            <Input
              type="number"
              placeholder="Diastolic"
              value={patientForm.diastolic_bp || ""}
              onChange={(e) => handleInputChange("diastolic_bp", e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Blood Sugar (mg/dL)</Label>
            <Input
              type="number"
              placeholder="Blood sugar level"
              value={patientForm.blood_sugar || ""}
              onChange={(e) => handleInputChange("blood_sugar", e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Cholesterol (mg/dL)</Label>
            <Input
              type="number"
              placeholder="Cholesterol level"
              value={patientForm.cholesterol || ""}
              onChange={(e) => handleInputChange("cholesterol", e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Heart Rate (bpm)</Label>
            <Input
              type="number"
              placeholder="Heart rate"
              value={patientForm.heart_rate || ""}
              onChange={(e) => handleInputChange("heart_rate", e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-medium">Oxygen Level (%)</Label>
            <Input
              type="number"
              placeholder="SpO2"
              value={patientForm.oxygen_level || ""}
              onChange={(e) => handleInputChange("oxygen_level", e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        {/* Medical Information */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <h4 className="font-semibold text-sm">Medical Information</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium">Primary Condition</Label>
              <Input
                placeholder="e.g., Hypertension, Diabetes, COPD"
                value={patientForm.condition}
                onChange={(e) => handleInputChange("condition", e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Current Allergies</Label>
              <Input
                placeholder="e.g., Penicillin, Aspirin, Sulfa"
                value={patientForm.allergies}
                onChange={(e) => handleInputChange("allergies", e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-xs font-medium">Medical History</Label>
              <Textarea
                placeholder="Previous diseases, surgeries, treatments..."
                value={patientForm.medical_history}
                onChange={(e) => handleInputChange("medical_history", e.target.value)}
                className="mt-1 min-h-24"
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Current Medications</Label>
              <Textarea
                placeholder="Current medications separated by commas..."
                value={patientForm.current_medications}
                onChange={(e) => handleInputChange("current_medications", e.target.value)}
                className="mt-1 min-h-20"
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Current Symptoms</Label>
              <Textarea
                placeholder="Patient reported symptoms..."
                value={patientForm.symptoms}
                onChange={(e) => handleInputChange("symptoms", e.target.value)}
                className="mt-1 min-h-20"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <Button
            onClick={handleGenerateAnalysis}
            disabled={isLoading || !patientForm.name || !patientForm.age}
            className="gradient-primary text-white border-0 flex-1"
          >
            {isLoading ? "Analyzing..." : "Generate Treatment Analysis"}
          </Button>
        </div>
      </div>

      {/* Treatment Analysis Results - Only show after analysis is generated */}
      {/* Treatment Analysis Results - Only show after analysis is generated */}
      {data && Object.keys(data).length > 0 ? (
        <>
          {/* 1. Treatment Comparison Table */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Treatment Comparison
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  name: "Medication",
                  data: data.treatment_comparison?.medication,
                },
                {
                  name: "Surgery",
                  data: data.treatment_comparison?.surgery,
                },
                {
                  name: "Robotic Surgery",
                  data: data.treatment_comparison?.robotic_surgery,
                },
                {
                  name: "Lifestyle Changes",
                  data: data.treatment_comparison?.lifestyle_changes,
                },
              ].map((item) => (
                <div key={item.name} className="rounded-xl border border-border bg-muted/50 p-4 space-y-3">
                  <h4 className="font-semibold text-sm">{item.name}</h4>
                  {item.data && (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Success Rate</p>
                        <p className="text-2xl font-bold text-primary">{item.data.success_rate}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Risk Level</p>
                        <span className={`inline-block text-xs px-3 py-1 rounded-full border ${getRiskColor(item.data.risk_level)}`}>
                          {item.data.risk_level}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Recovery</p>
                        <p className="text-sm font-medium">{item.data.recovery_time}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Best For</p>
                        <p className="text-xs font-medium text-foreground">{item.data.best_for}</p>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 2. Recommended Approach */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" /> Recommended Approach
            </h3>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Primary Treatment</p>
                <p className="text-lg font-bold text-primary">{data.recommended_approach?.primary_treatment}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-semibold">Clinical Reasoning:</p>
                <ul className="space-y-1">
                  {data.recommended_approach?.reason?.map((reason, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">•</span> {reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 3. Combined Treatment Plan */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Combined Treatment Plan
            </h3>
            <div className="space-y-2">
              {data.combined_plan?.map((plan, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-muted/50 rounded-lg p-3">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{plan}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Risk & Safety Analysis */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600" /> Risk & Safety Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Medication Risk</p>
                <p className="text-sm font-semibold mt-1">{data.risk_analysis?.medication_risk}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Surgical Risk</p>
                <p className="text-sm font-semibold mt-1">{data.risk_analysis?.surgical_risk}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Robotic Surgery Risk</p>
                <p className="text-sm font-semibold mt-1">{data.risk_analysis?.robotic_surgery_risk}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Lifestyle Risk</p>
                <p className="text-sm font-semibold mt-1">{data.risk_analysis?.lifestyle_risk}</p>
              </div>
            </div>
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-destructive mb-2">Special Considerations:</p>
              <ul className="space-y-1">
                {data.risk_analysis?.special_considerations?.map((consideration, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-destructive mt-0.5">⚠</span> {consideration}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 5. Outcome Prediction */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Outcome Prediction
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  name: "Medication",
                  data: data.outcome_prediction?.medication,
                  metric: "probability",
                },
                {
                  name: "Surgery",
                  data: data.outcome_prediction?.surgery,
                  metric: "success_rate",
                },
                {
                  name: "Robotic Surgery",
                  data: data.outcome_prediction?.robotic_surgery,
                  metric: "success_rate",
                },
                {
                  name: "Lifestyle Changes",
                  data: data.outcome_prediction?.lifestyle,
                  metric: "timeline",
                },
              ].map((item) => (
                <div key={item.name} className="rounded-xl bg-muted/50 p-4 space-y-2">
                  <h4 className="font-semibold text-sm">{item.name}</h4>
                  {item.data && (
                    <>
                      {item.metric !== "timeline" && (
                        <div>
                          <p className="text-xs text-muted-foreground">Success/Improvement</p>
                          <p className="text-2xl font-bold text-primary">{(item.data as any)[item.metric]}%</p>
                        </div>
                      )}
                      {item.metric === "timeline" && (
                        <div>
                          <p className="text-xs text-muted-foreground">Timeline</p>
                          <p className="text-sm font-semibold">{(item.data as any).timeline}</p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">{(item.data as any).notes}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 6. Treatment Timeline */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Treatment Timeline
            </h3>
            <div className="space-y-3">
              {data.treatment_timeline?.map((phase, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold">
                      {idx + 1}
                    </div>
                    {idx < (data.treatment_timeline?.length || 0) - 1 && (
                      <div className="w-0.5 h-12 bg-border mt-2"></div>
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="font-semibold text-sm">{phase.phase}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium">Duration:</span> {phase.duration}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">{phase.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 7. AI Explanation */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">AI Reasoning</h3>
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              {data.ai_reasoning?.map((point, idx) => (
                <p key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary font-bold mt-0.5">•</span>
                  {point}
                </p>
              ))}
            </div>
          </div>

          {/* Safety Notice */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs font-semibold text-amber-900 mb-2">⚠️ IMPORTANT DISCLAIMER</p>
            <p className="text-xs text-amber-800">
              This analysis is AI-generated and should be used as a supportive tool only. It does not replace professional medical judgment. 
              Always consult with qualified healthcare professionals for final treatment decisions. Patient safety is paramount.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
