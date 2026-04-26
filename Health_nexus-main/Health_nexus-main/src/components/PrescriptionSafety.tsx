import { AlertCircle, AlertTriangle, CheckCircle2, ClipboardList, HeartPulse, ShieldCheck, Stethoscope, User } from "lucide-react";

type Interaction = { drugs: string; severity: string; note: string };

export type PrescriptionContext = {
  age?: number;
  gender?: string;
  conditions?: string;
  allergies?: string;
  currentMedications?: string;
  kidneyStatus?: string;
  liverStatus?: string;
};

interface PrescriptionSafetyProps {
  interactions: Interaction[];
  drugs: string[];
  context: PrescriptionContext;
  isLoading?: boolean;
}

const severityRank = (severity: string) => {
  const s = severity.toLowerCase();
  if (s.includes("contra") || s.includes("severe") || s.includes("high") || s.includes("major")) return 3;
  if (s.includes("moderate") || s.includes("medium")) return 2;
  return 1; // low or unknown
};

const severityBadge = (severity: string) => {
  const rank = severityRank(severity);
  if (rank === 3) return { label: "HIGH !", color: "bg-red-100 text-red-800 border-red-200" };
  if (rank === 2) return { label: "MEDIUM !", color: "bg-amber-100 text-amber-900 border-amber-200" };
  return { label: "LOW", color: "bg-emerald-100 text-emerald-900 border-emerald-200" };
};

const guidanceBySeverity = {
  high: {
    verdict: "Use only if benefit is compelling; document rationale and obtain informed consent.",
    guidance: [
      "Avoid routine co-prescription; consider alternative pathway where possible.",
      "If required, use lowest effective dose and shortest duration.",
      "Check for duplicate pharmacologic effects before dispensing.",
    ],
    alternatives: [
      "Consider monotherapy if indication allows.",
      "Switch to an agent with lower interaction potential (e.g., clopidogrel instead of dual anticoagulants).",
    ],
    monitoring: [
      "Tight INR/renal/liver function monitoring where relevant.",
      "Watch for bleeding, bruising, GI upset, CNS changes.",
      "Follow up within 3-5 days after initiation or dose change.",
    ],
  },
  medium: {
    verdict: "Proceed with caution; adjust doses and monitor closely.",
    guidance: [
      "Limit overlapping mechanisms; space dosing when feasible.",
      "Review indication strength; deprescribe non-essential agents.",
      "Document monitoring plan in the chart.",
    ],
    alternatives: [
      "Prefer single-agent therapy when clinically acceptable.",
      "Choose drugs from different classes to reduce overlap.",
    ],
    monitoring: [
      "Baseline labs before start; repeat in 1\u20132 weeks.",
      "Track symptom triggers the patient can self-report.",
    ],
  },
  low: {
    verdict: "No major interaction flagged; maintain standard precautions.",
    guidance: [
      "Confirm adherence and educate on warning signs.",
      "Reassess if new symptoms or medications are added.",
    ],
    alternatives: ["Not usually required; reassess only if tolerance issues arise."],
    monitoring: ["Routine follow up and vitals as per condition severity."],
  },
};

export default function PrescriptionSafety({ interactions, drugs, context, isLoading }: PrescriptionSafetyProps) {
  const topInteraction = interactions.reduce<Interaction | null>((prev, curr) => {
    if (!prev) return curr;
    return severityRank(curr.severity) > severityRank(prev.severity) ? curr : prev;
  }, null);

  const severityKey =
    severityRank(topInteraction?.severity ?? "low") === 3
      ? "high"
      : severityRank(topInteraction?.severity ?? "low") === 2
        ? "medium"
        : "low";

  const preset = guidanceBySeverity[severityKey];
  const badge = severityBadge(topInteraction?.severity ?? "Low");

  const insufficientData =
    !context.age || context.age <= 0 || !context.gender || !(context.conditions && context.conditions.trim().length > 0);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-3"></div>
        <div className="h-3 w-full bg-muted rounded mb-2"></div>
        <div className="h-3 w-4/5 bg-muted rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <ClipboardList className="w-4 h-4" /> Id="ps1" INTERACTION CHECK
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{drugs.length ? drugs.join(" + ") : "No drugs entered"}</span>
          <span className={`text-[11px] px-2 py-1 rounded-full border ${badge.color}`}>{badge.label}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Clinical Risk: {topInteraction?.note ?? "No interaction risk returned by the model."}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <User className="w-4 h-4" /> Id="ps2" PATIENT RISK CONTEXT
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-muted/50 p-2">Age: {context.age ?? "Not set"}</div>
          <div className="rounded-lg bg-muted/50 p-2">Gender: {context.gender || "Not set"}</div>
          <div className="rounded-lg bg-muted/50 p-2">Conditions: {context.conditions || "Not provided"}</div>
          <div className="rounded-lg bg-muted/50 p-2">Allergies: {context.allergies || "None noted"}</div>
          <div className="rounded-lg bg-muted/50 p-2">Current meds: {context.currentMedications || "Not provided"}</div>
          <div className="rounded-lg bg-muted/50 p-2">Kidney status: {context.kidneyStatus || "Not documented"}</div>
          <div className="rounded-lg bg-muted/50 p-2">Liver status: {context.liverStatus || "Not documented"}</div>
        </div>
        <p className="text-xs font-semibold text-foreground">
          Overall Risk Level: {badge.label}
        </p>
      </div>

      {insufficientData ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
          <div className="text-xs">
            <div className="font-semibold">Id="ps8"</div>
            Insufficient patient data for safe prescribing recommendation. Further evaluation required.
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Stethoscope className="w-4 h-4" /> Id="ps3" PRESCRIBING GUIDANCE
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {preset.guidance.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <ShieldCheck className="w-4 h-4" /> Id="ps4" SAFER ALTERNATIVES
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {preset.alternatives.map((alt) => (
                <li key={alt} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">-</span>
                  <span>{alt}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">
              Note: Selection depends on clinical indication and patient goals.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <HeartPulse className="w-4 h-4" /> Id="ps5" MONITORING RECOMMENDATIONS
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {preset.monitoring.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <AlertCircle className="w-4 h-4 text-destructive" /> Id="ps6" FINAL SAFETY DECISION
            </div>
            <p className="text-sm font-semibold text-foreground">{preset.verdict}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <ClipboardList className="w-4 h-4" /> Id="ps7" AI REASONING
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">-</span>
                <span>
                  Interaction signal: {topInteraction?.note ?? "No specific mechanism returned; using general safety fallback."}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">-</span>
                <span>
                  Patient factors: age {context.age ?? "n/a"}, gender {context.gender || "n/a"}, conditions {context.conditions || "n/a"}.
                </span>
              </li>
              {context.allergies ? (
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">-</span>
                  <span>Allergy flags: {context.allergies}.</span>
                </li>
              ) : null}
              {(context.kidneyStatus || context.liverStatus) ? (
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">-</span>
                  <span>
                    Organ function: Kidney {context.kidneyStatus || "n/a"}, Liver {context.liverStatus || "n/a"}.
                  </span>
                </li>
              ) : null}
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">-</span>
                <span>Decision is supportive, not a prescription; clinician oversight required.</span>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
