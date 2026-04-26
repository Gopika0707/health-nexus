import { useState } from "react";
import { motion } from "framer-motion";
import { Search, AlertTriangle, CheckCircle, XCircle, Info, Pill, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const sampleDrugs = [
  {
    name: "Metformin 500mg",
    purpose: "Type 2 diabetes management",
    status: "approved",
    dosage: "500mg twice daily with meals",
    sideEffects: ["Nausea", "Diarrhea", "B12 deficiency (long-term)"],
    suitability: 92,
    interactions: [],
    note: "Suitable for your profile. Monitor kidney function annually.",
  },
  {
    name: "Ibuprofen 400mg",
    purpose: "Anti-inflammatory, pain relief",
    status: "approved",
    dosage: "400mg up to 3 times daily",
    sideEffects: ["GI irritation", "Risk of bleeding", "Kidney stress"],
    suitability: 65,
    interactions: ["Avoid with blood thinners", "Use caution with ACE inhibitors"],
    note: "Use with caution. Consider paracetamol as safer alternative for your profile.",
  },
];

const statusConfig = {
  approved: { color: "bg-status-normal", icon: CheckCircle, label: "Approved" },
  restricted: { color: "bg-status-warning", icon: AlertTriangle, label: "Restricted" },
  banned: { color: "bg-status-critical", icon: XCircle, label: "Banned" },
};

export default function DrugTab() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);

  const handleSearch = () => { if (query.trim()) setSearched(true); };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Drug Analyzer</h2>
        <p className="text-sm text-muted-foreground">FDA • DrugBank • RxNorm • WHO alerts powered safety check</p>
      </div>

      {/* Search */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search drug name, generic name, or brand..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch} className="gradient-primary text-white border-0">
            Analyze
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {["Aspirin", "Metformin", "Lisinopril", "Atorvastatin"].map(d => (
            <button
              key={d}
              onClick={() => { setQuery(d); setSearched(true); }}
              className="text-xs bg-muted hover:bg-primary/10 hover:text-primary px-3 py-1.5 rounded-full transition-colors text-muted-foreground"
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Drug Cards */}
      <div>
        <h3 className="font-semibold text-foreground mb-3">Current Medications Analysis</h3>
        <div className="space-y-4">
          {sampleDrugs.map((drug, i) => {
            const config = statusConfig[drug.status as keyof typeof statusConfig];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-card rounded-2xl border border-border overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
                        <Pill className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{drug.purpose}</p>
                      </div>
                    </div>
                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
                      <config.icon className="w-3.5 h-3.5" />
                      {config.label}
                    </span>
                  </div>

                  {/* Suitability Score */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Suitability for Your Profile</span>
                      <span className="font-semibold text-foreground">{drug.suitability}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full">
                      <div
                        className={`h-full rounded-full ${drug.suitability >= 80 ? "bg-health-normal" : drug.suitability >= 60 ? "bg-health-warning" : "bg-health-critical"}`}
                        style={{ width: `${drug.suitability}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-foreground mb-2">Dosage Guidance</p>
                      <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">{drug.dosage}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground mb-2">Side Effects</p>
                      <div className="flex flex-wrap gap-1">
                        {drug.sideEffects.map((s, j) => (
                          <span key={j} className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {drug.interactions.length > 0 && (
                    <div className="mt-3 bg-health-warning/10 rounded-xl p-3">
                      <p className="text-xs font-medium text-health-warning mb-1.5 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Interaction Warnings
                      </p>
                      {drug.interactions.map((inter, j) => (
                        <p key={j} className="text-xs text-muted-foreground">• {inter}</p>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 bg-primary/5 rounded-xl p-3 flex items-start gap-2">
                    <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">{drug.note}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
