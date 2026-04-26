import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Hospital, Eye, EyeOff, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";

export default function DoctorLogin() {
  const { login } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ doctorId: "", password: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await authService.login({
        user_id: form.doctorId.trim(),
        password: form.password,
        role: "doctor",
      });
      login(response.access_token, "/doctor/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-dot-pattern bg-dot opacity-20" />
      <div className="w-full max-w-md relative z-10">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <Hospital className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-2xl text-white">Health<span className="text-white/70">Nexus</span></span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-secondary to-accent rounded-xl flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Doctor Portal</h2>
              <p className="text-xs text-muted-foreground">Federated clinical intelligence access</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Doctor ID</Label>
              <Input
                className="mt-1"
                placeholder="DOC-4892"
                value={form.doctorId}
                onChange={(e) => setForm((prev) => ({ ...prev, doctorId: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Password</Label>
              <div className="relative mt-1">
                <Input
                  type={showPass ? "text" : "password"}
                  placeholder="Secure password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-secondary to-accent text-white border-0 h-11 font-semibold mt-2">
              {isSubmitting ? "Signing in..." : "Access Clinical Suite"}
            </Button>
          </form>

          <div className="mt-4 rounded-2xl bg-muted/60 p-4 text-xs text-muted-foreground">
            Demo access: `DOC-4892` / `doctor123`
          </div>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              Patient?{" "}
              <Link to="/patient/login" className="text-primary font-medium hover:underline">Patient login</Link>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              <Link to="/" className="text-muted-foreground hover:text-foreground">Back to home</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
