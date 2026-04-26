import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Heart, Moon, Zap, AlertCircle, CheckCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

const wellnessData = [
  { subject: "Mood", value: 72 },
  { subject: "Sleep", value: 65 },
  { subject: "Energy", value: 78 },
  { subject: "Focus", value: 60 },
  { subject: "Social", value: 70 },
  { subject: "Stress", value: 45 },
];

const questions = [
  { q: "How would you rate your mood today?", options: ["Very Low", "Low", "Neutral", "Good", "Excellent"] },
  { q: "How many hours did you sleep last night?", options: ["< 4", "4-5", "6-7", "7-8", "> 8"] },
  { q: "Current stress level?", options: ["Very High", "High", "Moderate", "Low", "Minimal"] },
  { q: "Physical energy levels?", options: ["Exhausted", "Tired", "Average", "Energized", "Very Active"] },
];

export default function MentalHealthTab() {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [assessed, setAssessed] = useState(false);

  const score = 74;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Mental Health Monitoring</h2>
        <p className="text-sm text-muted-foreground">AI-powered burnout, depression screening & wellness scoring</p>
      </div>

      {!assessed ? (
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-semibold text-foreground mb-1">Daily Wellness Check-In</h3>
          <p className="text-sm text-muted-foreground mb-6">Answer 4 quick questions for your AI mental health score</p>
          <div className="space-y-5">
            {questions.map((q, i) => (
              <div key={i}>
                <p className="text-sm font-medium text-foreground mb-2">{i + 1}. {q.q}</p>
                <div className="flex flex-wrap gap-2">
                  {q.options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => setAnswers(p => ({ ...p, [i]: opt }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        answers[i] === opt
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Button
            onClick={() => setAssessed(true)}
            disabled={Object.keys(answers).length < 4}
            className="mt-6 gradient-primary text-white border-0"
          >
            Generate AI Assessment <ChevronRight className="ml-1 w-4 h-4" />
          </Button>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Score Card */}
          <div className="bg-gradient-to-br from-primary to-accent rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm mb-1">Mental Wellness Score</p>
                <div className="font-display text-5xl font-bold">{score}<span className="text-2xl">/100</span></div>
                <p className="text-white/80 text-sm mt-2 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-300" /> Moderate-Good — Monitored
                </p>
              </div>
              <div className="text-right">
                <Brain className="w-16 h-16 text-white/20" />
                <div className="mt-2 text-sm">
                  <div className="text-white/70">Burnout Risk</div>
                  <div className="font-semibold">Low-Moderate</div>
                </div>
              </div>
            </div>
          </div>

          {/* Radar Chart */}
          <div className="bg-card rounded-2xl p-5 border border-border">
            <h3 className="font-semibold text-foreground mb-3 text-sm">Wellness Dimensions</h3>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={wellnessData}>
                <PolarGrid stroke="hsl(214 25% 88%)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <Radar name="Wellness" dataKey="value" stroke="hsl(214 84% 40%)" fill="hsl(214 84% 40%)" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Insights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: Moon, color: "text-primary", bg: "bg-primary/10", title: "Sleep Quality", value: "Moderate", desc: "6.5 hrs avg. Target 7-8 hrs for better recovery." },
              { icon: Zap, color: "text-health-warning", bg: "bg-health-warning/10", title: "Stress Indicator", value: "Elevated", desc: "Work stress patterns detected. Consider mindfulness breaks." },
              { icon: Heart, color: "text-health-normal", bg: "bg-health-normal/10", title: "Emotional State", value: "Stable", desc: "No depression screening flags. Continue positive habits." },
              { icon: Brain, color: "text-accent", bg: "bg-accent/10", title: "Cognitive Load", value: "Moderate", desc: "Focus capacity slightly reduced. Breaks every 90 min recommended." },
            ].map(({ icon: Icon, color, bg, title, value, desc }, i) => (
              <div key={i} className="bg-card rounded-2xl p-4 border border-border">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">{title}</div>
                    <div className={`text-xs font-medium ${color}`}>{value}</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          <div className="bg-primary/5 rounded-2xl p-5 border border-primary/20">
            <h3 className="font-semibold text-foreground mb-3 text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" /> AI Recommendations
            </h3>
            <ul className="space-y-2">
              {[
                "Try 10-min guided meditation before bed — apps: Headspace, Calm",
                "Maintain consistent wake time even on weekends",
                "Short 5-min walk every 90 minutes during work hours",
                "Consider speaking with a wellness counselor if stress persists >2 weeks",
              ].map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-health-normal mt-0.5 flex-shrink-0" />{rec}
                </li>
              ))}
            </ul>
          </div>

          <Button
            variant="outline"
            onClick={() => { setAssessed(false); setAnswers({}); }}
            className="w-full"
          >
            Retake Assessment
          </Button>
        </motion.div>
      )}
    </div>
  );
}
