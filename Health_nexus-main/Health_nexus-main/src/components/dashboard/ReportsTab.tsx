import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, Brain, AlertCircle, CheckCircle, TrendingDown, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

const mockReports = [
  {
    name: "Complete Blood Count (CBC)",
    date: "Feb 28, 2025",
    type: "Blood Report",
    severity: 25,
    risk: "Low",
    status: "normal",
    findings: ["Hemoglobin: 14.2 g/dL (Normal)", "WBC: 6800/μL (Normal)", "Platelets: 220K/μL (Normal)"],
    summary: "All parameters within normal reference ranges. No significant abnormalities detected.",
  },
  {
    name: "Chest X-Ray",
    date: "Jan 15, 2025",
    type: "X-Ray",
    severity: 15,
    risk: "Low",
    status: "normal",
    findings: ["Lung fields clear", "No cardiomegaly", "Normal bony thorax"],
    summary: "No acute cardiopulmonary findings. Routine follow-up recommended.",
  },
];

export default function ReportsTab() {
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Medical Report Analysis</h2>
        <p className="text-sm text-muted-foreground">ClinicalBERT + MedGemma powered report intelligence</p>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); }}
        className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all cursor-pointer ${
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
        }`}
      >
        <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Upload className="w-8 h-8 text-white" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">Upload Medical Reports</h3>
        <p className="text-sm text-muted-foreground mb-4">MRI, CT, X-ray, Blood Reports, PDFs, DICOM files</p>
        <Button className="gradient-primary text-white border-0">
          Browse Files
        </Button>
        <p className="text-xs text-muted-foreground mt-3">Supports PDF, DICOM, JPEG, PNG — Max 50MB</p>
      </div>

      {/* Processing Pipeline Info */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { step: "01", title: "OCR Extraction", desc: "Google Vision / Tesseract", color: "from-primary to-primary-glow" },
          { step: "02", title: "NLP Analysis", desc: "ClinicalBERT", color: "from-secondary to-accent" },
          { step: "03", title: "Risk Scoring", desc: "0–100 severity index", color: "from-health-warning to-orange-400" },
          { step: "04", title: "Plain Summary", desc: "Patient-readable output", color: "from-health-normal to-teal-400" },
        ].map((s, i) => (
          <div key={i} className={`bg-gradient-to-br ${s.color} rounded-xl p-4 text-white`}>
            <div className="text-xs font-bold opacity-70 mb-1">STEP {s.step}</div>
            <div className="font-semibold text-sm">{s.title}</div>
            <div className="text-xs opacity-70 mt-0.5">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Reports List */}
      <div>
        <h3 className="font-semibold text-foreground mb-3">Previous Reports</h3>
        <div className="space-y-3">
          {mockReports.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-2xl border border-border overflow-hidden"
            >
              <button
                onClick={() => setSelected(selected === i ? null : i)}
                className="w-full p-4 flex items-center gap-4 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-foreground text-sm">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.type} • {r.date}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    r.risk === "Low" ? "bg-status-normal" : r.risk === "Moderate" ? "bg-status-warning" : "bg-status-critical"
                  }`}>
                    {r.risk} Risk
                  </div>
                  <div className="text-xs text-muted-foreground">Severity: {r.severity}/100</div>
                </div>
              </button>

              {selected === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="border-t border-border p-4 bg-muted/20"
                >
                  {/* Severity Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Severity Score</span><span>{r.severity}/100</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full">
                      <div className="h-full bg-health-normal rounded-full" style={{ width: `${r.severity}%` }} />
                    </div>
                  </div>

                  {/* Findings */}
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
                      <Brain className="w-3 h-3 text-primary" /> AI Extracted Findings
                    </h4>
                    <ul className="space-y-1">
                      {r.findings.map((f, j) => (
                        <li key={j} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle className="w-3 h-3 text-health-normal" />{f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Summary */}
                  <div className="bg-primary/5 rounded-xl p-3 mb-4">
                    <p className="text-xs text-foreground leading-relaxed">{r.summary}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs">
                      <Download className="w-3 h-3 mr-1" /> Download PDF
                    </Button>
                    <Button size="sm" className="gradient-primary text-white border-0 text-xs">
                      <Eye className="w-3 h-3 mr-1" /> Full Analysis
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
