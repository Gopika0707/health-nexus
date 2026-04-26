import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Shield, Brain, Activity, Users, Lock, Zap, ChevronRight,
  Heart, FlaskConical, Globe, ArrowRight, Star, CheckCircle2,
  Hospital, Stethoscope, BarChart3, Database
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Shield, title: "Privacy-First Architecture", desc: "Raw patient data never leaves local hospital nodes. Only encrypted model weights are transmitted.", color: "text-primary" },
  { icon: Brain, title: "Federated AI Learning", desc: "Collaborative model training across hospitals using FedAvg aggregation with differential privacy.", color: "text-accent" },
  { icon: Activity, title: "Real-Time Vital Monitoring", desc: "AI-powered LSTM trend prediction with anomaly detection and personalized health thresholds.", color: "text-secondary" },
  { icon: Lock, title: "HIPAA/GDPR Compliant", desc: "SOC2-aligned architecture with JWT auth, end-to-end encryption, and full audit trails.", color: "text-health-normal" },
  { icon: FlaskConical, title: "Clinical NLP Analysis", desc: "ClinicalBERT and MedGemma powered report analysis extracting insights from MRI, CT, X-ray.", color: "text-primary" },
  { icon: Zap, title: "Instant AI Diagnostics", desc: "Drug interaction checks, treatment outcome prediction, and mental wellness scoring in seconds.", color: "text-health-warning" },
];

const stats = [
  { value: "500+", label: "Hospitals Connected" },
  { value: "2M+", label: "Patients Protected" },
  { value: "99.9%", label: "Data Privacy Rate" },
  { value: "47ms", label: "Avg. Response Time" },
];

const roles = [
  {
    icon: Heart,
    title: "Patient Portal",
    desc: "Monitor vitals, analyze reports, plan diet, check drug safety & mental wellness",
    cta: "Access Patient Portal",
    link: "/patient/login",
    signup: "/patient/signup",
    gradient: "from-primary to-accent",
  },
  {
    icon: Stethoscope,
    title: "Doctor Suite",
    desc: "Clinical AI assistant, prescription safety, treatment outcome predictor & case reviews",
    cta: "Doctor Login",
    link: "/doctor/login",
    signup: null,
    gradient: "from-secondary to-accent",
  },
  {
    icon: BarChart3,
    title: "Admin Control",
    desc: "Federated learning orchestration, global model registry, hospital node management",
    cta: "Admin Dashboard",
    link: "/admin/dashboard",
    signup: null,
    gradient: "from-primary-deep to-primary",
  },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/10">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
              <Hospital className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">Health<span className="text-gradient">Nexus</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#roles" className="hover:text-foreground transition-colors">Portals</a>
            <a href="#stats" className="hover:text-foreground transition-colors">Impact</a>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/patient/login">Sign In</Link>
            </Button>
            <Button asChild size="sm" className="gradient-primary text-white border-0 shadow-glow">
              <Link to="/patient/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen gradient-hero flex items-center justify-center overflow-hidden pt-16">
        {/* Background elements */}
        <div className="absolute inset-0 bg-dot-pattern bg-dot opacity-20" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />

        {/* Floating medical icons */}
        {[
          { Icon: Heart, pos: "top-1/4 left-[8%]", delay: "0s", size: "w-10 h-10" },
          { Icon: Activity, pos: "top-1/3 right-[10%]", delay: "0.5s", size: "w-8 h-8" },
          { Icon: Brain, pos: "bottom-1/3 left-[12%]", delay: "1s", size: "w-9 h-9" },
          { Icon: Shield, pos: "bottom-1/4 right-[8%]", delay: "0.3s", size: "w-8 h-8" },
          { Icon: Database, pos: "top-1/2 left-[5%]", delay: "0.8s", size: "w-7 h-7" },
          { Icon: Globe, pos: "top-1/2 right-[5%]", delay: "1.2s", size: "w-7 h-7" },
        ].map(({ Icon, pos, delay, size }, i) => (
          <motion.div
            key={i}
            className={`absolute ${pos} glass rounded-2xl p-3 animate-float hidden lg:flex`}
            style={{ animationDelay: delay }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.1 }}
          >
            <Icon className={`${size} text-white/70`} />
          </motion.div>
        ))}

        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-sm text-white/80 mb-8 border border-white/20">
              <div className="w-2 h-2 bg-health-normal rounded-full animate-pulse" />
              <span>Federated Learning • Privacy-Preserving • HIPAA Compliant</span>
            </div>

            <h1 className="font-display text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              The Future of<br />
              <span className="text-gradient-hero">Clinical Intelligence</span>
            </h1>

            <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
              Privacy-preserving federated AI platform enabling hospitals to collaboratively train
              models without ever sharing raw patient data.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="bg-white text-primary font-semibold hover:bg-white/90 shadow-lg px-8 h-12 text-base">
                <Link to="/patient/signup">
                  Start as Patient <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8 h-12 text-base">
                <Link to="/doctor/login">Doctor Portal</Link>
              </Button>
            </div>
          </motion.div>

          {/* Hero stats preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto"
          >
            {stats.map((s, i) => (
              <div key={i} className="glass rounded-2xl p-4 border border-white/10">
                <div className="font-display text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-white/60 mt-1">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-background relative">
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-30" />
        <div className="container mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              <Zap className="w-3.5 h-3.5" /> Core Capabilities
            </div>
            <h2 className="font-display text-4xl font-bold text-foreground mb-4">
              Healthcare AI, <span className="text-gradient">Reimagined</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Every feature built with privacy at its core, compliance by design.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-border"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
                  <f.icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Role Portals */}
      <section id="roles" className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl font-bold text-foreground mb-4">
              Choose Your <span className="text-gradient">Portal</span>
            </h2>
            <p className="text-muted-foreground text-lg">Role-based access with tailored AI capabilities</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {roles.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="glass-card rounded-3xl overflow-hidden border border-border hover:shadow-xl transition-all duration-300 hover:-translate-y-2"
              >
                <div className={`bg-gradient-to-br ${r.gradient} p-8 text-white`}>
                  <r.icon className="w-12 h-12 mb-4 opacity-90" />
                  <h3 className="font-display text-2xl font-bold mb-2">{r.title}</h3>
                  <p className="text-white/80 text-sm leading-relaxed">{r.desc}</p>
                </div>
                <div className="p-6 flex flex-col gap-3">
                  <Button asChild className="w-full gradient-primary text-white border-0">
                    <Link to={r.link}>
                      {r.cta} <ChevronRight className="ml-1 w-4 h-4" />
                    </Link>
                  </Button>
                  {r.signup && (
                    <Button asChild variant="outline" className="w-full">
                      <Link to={r.signup}>Create Account</Link>
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 gradient-hero">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-4xl font-bold text-white mb-6">
              Trusted by Leading Healthcare Institutions
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-6 mb-12">
              {["HIPAA Compliant", "GDPR Aligned", "SOC2 Ready", "HL7 FHIR", "ISO 27001"].map((badge, i) => (
                <div key={i} className="flex items-center gap-2 glass rounded-full px-4 py-2 text-white text-sm border border-white/20">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  {badge}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild size="lg" className="bg-white text-primary font-semibold hover:bg-white/90 px-8 h-12">
                <Link to="/patient/signup">
                  Get Started Free <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground/5 border-t border-border py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 gradient-primary rounded-lg flex items-center justify-center">
                <Hospital className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold text-lg">Health<span className="text-gradient">Nexus</span></span>
            </div>
            <div className="text-center text-xs text-muted-foreground max-w-2xl px-4">
              <span className="font-semibold text-foreground">Medical Disclaimer:</span> This system provides AI-generated health insights for informational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider before making medical decisions.
            </div>
            <div className="text-xs text-muted-foreground">© 2025 HealthNexus. All rights reserved.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
