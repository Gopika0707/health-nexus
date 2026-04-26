import { Activity, AlertTriangle, CheckCircle2, CopyPlus, Info, ShieldCheck, User, Utensils } from "lucide-react";

type Interaction = {
  drugs: string;
  severity: string;
  note: string;
  severity_score: number;
  interaction_type: string;
  safer_alternatives: string[];
  food_lifestyle_warnings: string[];
};

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

export default function PrescriptionSafety({ interactions, drugs, context, isLoading }: PrescriptionSafetyProps) {
  const topInteraction = interactions.reduce<Interaction | null>((prev, curr) => {
    if (!prev) return curr;
    return curr.severity_score > prev.severity_score ? curr : prev;
  }, null);

  const getSeverityBadge = (score: number) => {
    if (score >= 80) return { label: "HIGH RISK", color: "bg-red-100 text-red-800 border-red-200", bar: "bg-red-500" };
    if (score >= 50) return { label: "MODERATE RISK", color: "bg-amber-100 text-amber-900 border-amber-200", bar: "bg-amber-500" };
    return { label: "LOW RISK", color: "bg-emerald-100 text-emerald-900 border-emerald-200", bar: "bg-emerald-500" };
  };

  const badge = topInteraction ? getSeverityBadge(topInteraction.severity_score) : getSeverityBadge(0);

  const insufficientData =
    !context.age || context.age <= 0 || !context.gender || !(context.conditions && context.conditions.trim().length > 0);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 animate-pulse space-y-4">
        <div className="h-4 w-32 bg-muted rounded"></div>
        <div className="h-2 w-full bg-muted rounded"></div>
        <div className="h-2 w-4/5 bg-muted rounded"></div>
        <div className="h-2 w-full bg-muted rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Severity Scoring Dashboard */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
          <Activity className="w-4 h-4" /> Severity Scoring Dashboard
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <span className="text-base font-semibold">{drugs.length ? drugs.join(" + ") : "No drugs entered"}</span>
          </div>
          <span className={`text-xs px-3 py-1 font-bold rounded-full border ${badge.color}`}>
            {badge.label}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs font-medium text-muted-foreground mb-1">
            <span>Safety Score</span>
            <span>{topInteraction?.severity_score ?? 0} / 100</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full ${badge.bar} transition-all duration-500 ease-out`} 
              style={{ width: `${topInteraction?.severity_score ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      {insufficientData ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
          <div className="text-xs">
            <div className="font-semibold">Insufficient Context</div>
            Insufficient patient data for safe prescribing recommendation. Further evaluation required.
          </div>
        </div>
      ) : (
        <>
          {/* Patient Context Overview (Optional but good for safety) */}
          <div className="rounded-2xl border border-border bg-card p-4">
             <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
               <User className="w-4 h-4" /> PATIENT CONTEXT
             </div>
             <div className="flex flex-wrap gap-2 text-xs">
               <span className="px-2 py-1 bg-muted rounded">Age: {context.age}</span>
               <span className="px-2 py-1 bg-muted rounded">Gender: {context.gender}</span>
               <span className="px-2 py-1 bg-muted rounded">Conditions: {context.conditions}</span>
               <span className="px-2 py-1 bg-muted rounded">Kidney: {context.kidneyStatus || "Normal"}</span>
               <span className="px-2 py-1 bg-muted rounded">Liver: {context.liverStatus || "Normal"}</span>
             </div>
          </div>

          {/* 2. Interaction Type Breakdown */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
              <Info className="w-4 h-4" /> Interaction Type Breakdown
            </div>
            {interactions.map((interaction, idx) => (
              <div key={idx} className="p-3 bg-muted/50 rounded-lg space-y-2 border border-border/50">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">{interaction.interaction_type || "General Interaction"}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {interaction.note}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 3. Safer Alternatives Engine */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                <ShieldCheck className="w-4 h-4" /> Safer Alternatives Engine
              </div>
              <ul className="space-y-2">
                {(topInteraction?.safer_alternatives || ["No safer alternatives flagged"]).map((alt, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CopyPlus className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{alt}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 4. Food & Lifestyle Interaction Checker */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                <Utensils className="w-4 h-4" /> Food & Lifestyle Interactions
              </div>
              <ul className="space-y-2">
                {(topInteraction?.food_lifestyle_warnings || ["No major food/lifestyle warnings"]).map((warn, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <span>{warn}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
