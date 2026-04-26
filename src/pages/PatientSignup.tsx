import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { CheckCircle2, Hospital } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BLOOD_GROUPS, FAMILY_DISEASES } from "@/constants/health";
import { authService } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";

const steps = [
  { id: 1, title: "Personal Details", subtitle: "Identity and account information" },
  { id: 2, title: "Genetic Details", subtitle: "Family and inherited health risks" },
  { id: 3, title: "Environmental Details", subtitle: "Lifestyle and daily context" },
] as const;

type FormState = {
  userId: string;
  password: string;
  fullName: string;
  age: string;
  gender: "male" | "female" | "other";
  email: string;
  phone: string;
  bloodGroup: typeof BLOOD_GROUPS[number];
  chronicIllness: string;
  geneticConditions: string;
  familyHistory: string[];
  smoking: "no" | "yes" | "occasional";
  alcohol: "none" | "moderate" | "high";
  activity: "low" | "moderate" | "high";
  sleepHours: string;
  diet: "vegetarian" | "non-vegetarian" | "vegan" | "other";
  stressLevel: "low" | "medium" | "high";
  occupation: string;
  location: string;
};

const initialForm: FormState = {
  userId: "",
  password: "",
  fullName: "",
  age: "",
  gender: "male",
  email: "",
  phone: "",
  bloodGroup: "O+",
  chronicIllness: "None",
  geneticConditions: "None",
  familyHistory: [],
  smoking: "no",
  alcohol: "none",
  activity: "moderate",
  sleepHours: "7",
  diet: "other",
  stressLevel: "medium",
  occupation: "",
  location: "",
};

export default function PatientSignup() {
  const { login } = useAuth();
  const [step, setStep] = useState<(typeof steps)[number]["id"]>(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stepMeta = useMemo(() => steps.find((item) => item.id === step)!, [step]);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleFamilyHistory = (value: string) => {
    setForm((current) => ({
      ...current,
      familyHistory: current.familyHistory.includes(value)
        ? current.familyHistory.filter((item) => item !== value)
        : [...current.familyHistory, value],
    }));
  };

  const validateStep = (targetStep: number) => {
    if (targetStep === 1) {
      const age = Number(form.age);
      if (!form.userId.trim()) return "User ID is required.";
      if (form.password.trim().length < 6) return "Password must be at least 6 characters.";
      if (!form.fullName.trim()) return "Full name is required.";
      if (!form.email.trim()) return "Email is required.";
      if (!Number.isFinite(age) || age <= 0) return "Enter a valid age.";
    }

    if (targetStep === 2) {
      if (!form.chronicIllness.trim()) return "Enter chronic illness details or use None.";
      if (!form.geneticConditions.trim()) return "Enter genetic condition details or use None.";
    }

    if (targetStep === 3) {
      const sleepHours = Number(form.sleepHours);
      if (!Number.isFinite(sleepHours) || sleepHours <= 0 || sleepHours > 24) {
        return "Enter valid sleep hours between 1 and 24.";
      }
    }

    return "";
  };

  const goNext = () => {
    const validationMessage = validateStep(step);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    setError("");
    setStep((current) => (current < 3 ? ((current + 1) as 1 | 2 | 3) : current));
  };

  const goBack = () => {
    setError("");
    setStep((current) => (current > 1 ? ((current - 1) as 1 | 2 | 3) : current));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationMessage = validateStep(3);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await authService.register({
        user_id: form.userId.trim(),
        password: form.password,
        full_name: form.fullName.trim(),
        age: Number(form.age),
        gender: form.gender,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        blood_group: form.bloodGroup,
        chronic_illness: form.chronicIllness.trim(),
        genetic_conditions: form.geneticConditions.trim(),
        family_history: form.familyHistory,
        lifestyle: {
          smoking: form.smoking,
          alcohol: form.alcohol,
          activity: form.activity,
          sleep_hours: Number(form.sleepHours),
          diet: form.diet,
          stress_level: form.stressLevel,
          occupation: form.occupation.trim() || undefined,
          location: form.location.trim() || undefined,
        },
      });
      const response = await authService.login({
        user_id: form.userId.trim(),
        password: form.password,
        role: "patient",
      });
      login(response.access_token, "/patient/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create the account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <Hospital className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-2xl text-white">Health<span className="text-white/70">Nexus</span></span>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-3xl p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">Create Patient Account</h2>
              <p className="text-sm text-muted-foreground mt-1">{stepMeta.subtitle}</p>
            </div>
            <div className="text-sm text-muted-foreground">Step {step} of 3</div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {steps.map((item) => {
              const isActive = item.id === step;
              const isCompleted = item.id < step;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-4 transition-colors ${
                    isActive
                      ? "border-primary bg-primary/10"
                      : isCompleted
                        ? "border-health-normal/30 bg-health-normal/10"
                        : "border-border bg-background/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-foreground">{item.title}</div>
                    {isCompleted ? <CheckCircle2 className="h-4 w-4 text-health-normal" /> : null}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.subtitle}</div>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {step === 1 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>User ID</Label>
                  <Input className="mt-1" value={form.userId} onChange={(e) => updateForm("userId", e.target.value)} />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input className="mt-1" type="password" value={form.password} onChange={(e) => updateForm("password", e.target.value)} />
                </div>
                <div>
                  <Label>Full Name</Label>
                  <Input className="mt-1" value={form.fullName} onChange={(e) => updateForm("fullName", e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input className="mt-1" type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} />
                </div>
                <div>
                  <Label>Age</Label>
                  <Input className="mt-1" type="number" min="1" value={form.age} onChange={(e) => updateForm("age", e.target.value)} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input className="mt-1" value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} />
                </div>
                <div>
                  <Label>Gender</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.gender}
                    onChange={(e) => updateForm("gender", e.target.value as FormState["gender"])}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <Label>Blood Group</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.bloodGroup}
                    onChange={(e) => updateForm("bloodGroup", e.target.value as FormState["bloodGroup"])}
                  >
                    {BLOOD_GROUPS.map((group) => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Chronic Illness</Label>
                    <Input className="mt-1" value={form.chronicIllness} onChange={(e) => updateForm("chronicIllness", e.target.value)} />
                  </div>
                  <div>
                    <Label>Genetic Conditions</Label>
                    <Input className="mt-1" value={form.geneticConditions} onChange={(e) => updateForm("geneticConditions", e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label>Family History</Label>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {FAMILY_DISEASES.map((condition) => {
                      const checked = form.familyHistory.includes(condition);
                      return (
                        <label key={condition} className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFamilyHistory(condition)}
                            className="h-4 w-4 rounded border-border"
                          />
                          <span>{condition}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Leave all unchecked if there is no known family history.</p>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Smoking</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.smoking}
                    onChange={(e) => updateForm("smoking", e.target.value as FormState["smoking"])}
                  >
                    <option value="no">No</option>
                    <option value="occasional">Occasional</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                <div>
                  <Label>Alcohol</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.alcohol}
                    onChange={(e) => updateForm("alcohol", e.target.value as FormState["alcohol"])}
                  >
                    <option value="none">None</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <Label>Activity Level</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.activity}
                    onChange={(e) => updateForm("activity", e.target.value as FormState["activity"])}
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <Label>Diet Type</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.diet}
                    onChange={(e) => updateForm("diet", e.target.value as FormState["diet"])}
                  >
                    <option value="vegetarian">Vegetarian</option>
                    <option value="non-vegetarian">Non-Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <Label>Sleep Hours</Label>
                  <Input className="mt-1" type="number" min="1" max="24" value={form.sleepHours} onChange={(e) => updateForm("sleepHours", e.target.value)} />
                </div>
                <div>
                  <Label>Stress Level</Label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.stressLevel}
                    onChange={(e) => updateForm("stressLevel", e.target.value as FormState["stressLevel"])}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <Label>Occupation</Label>
                  <Input className="mt-1" value={form.occupation} onChange={(e) => updateForm("occupation", e.target.value)} />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input className="mt-1" value={form.location} onChange={(e) => updateForm("location", e.target.value)} />
                </div>
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={goBack} disabled={step === 1 || isSubmitting}>
                Back
              </Button>
              <div className="flex gap-3">
                {step < 3 ? (
                  <Button type="button" onClick={goNext} className="gradient-primary text-white border-0">
                    Continue
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting} className="gradient-primary text-white border-0">
                    {isSubmitting ? "Creating Account..." : "Create Account"}
                  </Button>
                )}
              </div>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already registered? <Link to="/patient/login" className="text-primary hover:underline">Patient login</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
