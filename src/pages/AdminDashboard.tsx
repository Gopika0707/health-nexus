import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Hospital, Globe, Activity, BarChart3, Shield, Database, RefreshCw,
  CheckCircle, AlertCircle, XCircle, TrendingUp, Zap, Lock, LogOut,
  Server, Cpu, Radio, Play, Pause, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const nodes = [
  { id: "NODE-001", name: "Metro General Hospital", location: "New York, USA", status: "training", patients: 1240, accuracy: 87.4, round: 12 },
  { id: "NODE-002", name: "St. Mary Medical Center", location: "London, UK", status: "idle", patients: 890, accuracy: 85.1, round: 11 },
  { id: "NODE-003", name: "Tokyo Medical University", location: "Tokyo, JP", status: "training", patients: 2100, accuracy: 89.2, round: 12 },
  { id: "NODE-004", name: "Mumbai Health Institute", location: "Mumbai, IN", status: "idle", patients: 1560, accuracy: 84.7, round: 11 },
  { id: "NODE-005", name: "São Paulo Hospital", location: "SP, Brazil", status: "offline", patients: 780, accuracy: 83.2, round: 10 },
  { id: "NODE-006", name: "Berlin Medical Center", location: "Berlin, DE", status: "training", patients: 1100, accuracy: 88.0, round: 12 },
];

const accuracyData = Array.from({ length: 12 }, (_, i) => ({
  round: `R${i + 1}`,
  global: 70 + i * 1.8 + Math.random() * 1.5,
  local_avg: 68 + i * 1.6 + Math.random() * 2,
}));

const lossData = Array.from({ length: 12 }, (_, i) => ({
  round: `R${i + 1}`,
  loss: Math.max(0.05, 0.85 - i * 0.07 + Math.random() * 0.03),
}));

const statusStyle = {
  training: { color: "bg-status-normal", icon: Activity, label: "Training" },
  idle: { color: "bg-status-warning", icon: Pause, label: "Idle" },
  offline: { color: "bg-status-critical", icon: XCircle, label: "Offline" },
};

const models = [
  { name: "CardiacNet v2.4", type: "CNN - Cardiac Imaging", status: "active", accuracy: 89.2, nodes: 5, deployed: "Feb 28" },
  { name: "VitalLSTM v1.8", type: "LSTM - Vitals Forecasting", status: "active", accuracy: 87.1, nodes: 5, deployed: "Feb 20" },
  { name: "CardiacNet v2.3", type: "CNN - Cardiac Imaging", status: "frozen", accuracy: 87.4, nodes: 0, deployed: "Jan 15" },
];

export default function AdminDashboard() {
  const [section, setSection] = useState("overview");
  const [fedRound, setFedRound] = useState(12);
  const [isRunning, setIsRunning] = useState(false);

  const trainingNodes = nodes.filter(n => n.status === "training").length;
  const avgAccuracy = (nodes.reduce((a, n) => a + n.accuracy, 0) / nodes.length).toFixed(1);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-gradient-to-b from-[hsl(214_84%_14%)] to-[hsl(220_30%_10%)] text-white">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
              <Hospital className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-lg">Health<span className="text-accent">Nexus</span></span>
          </div>
          <div className="mt-2 text-xs text-white/40 uppercase tracking-wider">Global Controller</div>
        </div>

        <nav className="flex-1 px-4 pt-4 space-y-1">
          {[
            { id: "overview", label: "System Overview", icon: Globe },
            { id: "nodes", label: "Hospital Nodes", icon: Server },
            { id: "federated", label: "Federated Training", icon: Cpu },
            { id: "registry", label: "Model Registry", icon: Database },
            { id: "audit", label: "Audit Trail", icon: Shield },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                section === item.id
                  ? "bg-accent/20 text-accent font-medium"
                  : "text-white/50 hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <Button asChild variant="ghost" size="sm" className="w-full text-white/40 hover:text-white hover:bg-white/5">
            <Link to="/">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Link>
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="font-display font-bold text-foreground">Admin Control Panel</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 bg-health-normal rounded-full animate-pulse" />
              Federation Round {fedRound} — {trainingNodes} nodes active
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Differential Privacy: ON
            </div>
            <Button onClick={() => setIsRunning(!isRunning)} size="sm" className={`${isRunning ? "bg-health-warning text-white" : "gradient-primary text-white"} border-0`}>
              {isRunning ? <><Pause className="w-4 h-4 mr-1" />Pause</> : <><Play className="w-4 h-4 mr-1" />Start Round</>}
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">

          {/* Overview */}
          {section === "overview" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Active Nodes", value: `${trainingNodes}/6`, icon: Server, gradient: "from-primary to-primary-glow" },
                  { label: "Global Accuracy", value: `${avgAccuracy}%`, icon: TrendingUp, gradient: "from-secondary to-accent" },
                  { label: "Fed Round", value: `#${fedRound}`, icon: RefreshCw, gradient: "from-primary-deep to-primary" },
                  { label: "Privacy Budget ε", value: "0.42", icon: Lock, gradient: "from-health-normal to-teal-500" },
                ].map((s, i) => (
                  <div key={i} className={`bg-gradient-to-br ${s.gradient} rounded-2xl p-4 text-white`}>
                    <s.icon className="w-6 h-6 mb-2 opacity-70" />
                    <div className="font-display text-3xl font-bold">{s.value}</div>
                    <div className="text-xs text-white/70 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* FedAvg Accuracy */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card rounded-2xl p-5 border border-border">
                  <h3 className="font-semibold text-foreground text-sm mb-1">Accuracy — Local vs Global</h3>
                  <p className="text-xs text-muted-foreground mb-4">FedAvg aggregation across 12 rounds</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={accuracyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 25% 90%)" />
                      <XAxis dataKey="round" tick={{ fontSize: 10 }} />
                      <YAxis domain={[65, 95]} tick={{ fontSize: 10 }} unit="%" />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="global" stroke="hsl(214 84% 40%)" strokeWidth={2.5} dot={false} name="Global Model" />
                      <Line type="monotone" dataKey="local_avg" stroke="hsl(195 85% 48%)" strokeWidth={2} dot={false} strokeDasharray="4 4" name="Local Avg" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-card rounded-2xl p-5 border border-border">
                  <h3 className="font-semibold text-foreground text-sm mb-1">Loss Convergence</h3>
                  <p className="text-xs text-muted-foreground mb-4">Global model training loss per round</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={lossData}>
                      <defs>
                        <linearGradient id="lossGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(0 84% 55%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(0 84% 55%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 25% 90%)" />
                      <XAxis dataKey="round" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="loss" stroke="hsl(0 84% 55%)" fill="url(#lossGrad)" strokeWidth={2} name="Loss" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}

          {/* Nodes */}
          {section === "nodes" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <h2 className="font-display text-xl font-bold text-foreground">Hospital Node Grid</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {nodes.map((node, i) => {
                  const cfg = statusStyle[node.status as keyof typeof statusStyle];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-card rounded-2xl border border-border p-5 hover:shadow-card transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Radio className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground font-mono">{node.id}</span>
                        </div>
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                          <cfg.icon className="w-3 h-3" />{cfg.label}
                        </span>
                      </div>
                      <h4 className="font-semibold text-foreground text-sm mb-0.5">{node.name}</h4>
                      <p className="text-xs text-muted-foreground mb-3">{node.location}</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-muted rounded-lg p-2">
                          <div className="font-bold text-sm text-foreground">{node.patients.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">Patients</div>
                        </div>
                        <div className="bg-muted rounded-lg p-2">
                          <div className="font-bold text-sm text-foreground">{node.accuracy}%</div>
                          <div className="text-xs text-muted-foreground">Accuracy</div>
                        </div>
                        <div className="bg-muted rounded-lg p-2">
                          <div className="font-bold text-sm text-foreground">R{node.round}</div>
                          <div className="text-xs text-muted-foreground">Round</div>
                        </div>
                      </div>
                      {node.status === "training" && (
                        <div className="mt-3">
                          <div className="text-xs text-muted-foreground mb-1">Training progress</div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-health-normal to-accent rounded-full animate-[shimmer_2s_linear_infinite] bg-[length:200%_100%]" style={{ width: "68%" }} />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Model Registry */}
          {section === "registry" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              <h2 className="font-display text-xl font-bold text-foreground">Model Registry</h2>
              <div className="space-y-3">
                {models.map((m, i) => (
                  <div key={i} className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
                    <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                      <Database className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-foreground text-sm">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.type} • Deployed {m.deployed} • {m.nodes} nodes</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${m.status === "active" ? "bg-status-normal" : "bg-muted text-muted-foreground"}`}>
                        {m.status}
                      </span>
                      <span className="text-sm font-bold text-foreground">{m.accuracy}%</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-xs h-7">Rollback</Button>
                        <Button size="sm" variant="outline" className="text-xs h-7">
                          {m.status === "active" ? "Freeze" : "Deploy"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Audit */}
          {section === "audit" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              <h2 className="font-display text-xl font-bold text-foreground">Federated Learning Audit Trail</h2>
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/30">
                  <div className="grid grid-cols-5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>Timestamp</span><span>Round</span><span>Node</span><span>Action</span><span>Status</span>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {[
                    { time: "2025-03-04 09:32:14", round: "R12", node: "NODE-001", action: "Weight Δw transmitted (DP applied)", status: "success" },
                    { time: "2025-03-04 09:30:05", round: "R12", node: "NODE-003", action: "Local training completed", status: "success" },
                    { time: "2025-03-04 09:28:52", round: "R12", node: "NODE-006", action: "Gradient clipping applied", status: "success" },
                    { time: "2025-03-04 09:25:18", round: "R11", node: "GLOBAL", action: "FedAvg aggregation completed", status: "success" },
                    { time: "2025-03-04 09:20:03", round: "R11", node: "NODE-005", action: "Connection lost — node offline", status: "error" },
                    { time: "2025-03-04 09:15:44", round: "R11", node: "NODE-002", action: "Secure encryption verified", status: "success" },
                  ].map((log, i) => (
                    <div key={i} className="grid grid-cols-5 gap-2 p-3 text-xs hover:bg-muted/30 transition-colors">
                      <span className="text-muted-foreground font-mono">{log.time}</span>
                      <span className="font-medium text-foreground">{log.round}</span>
                      <span className="text-primary">{log.node}</span>
                      <span className="text-muted-foreground col-span-1 truncate">{log.action}</span>
                      <span className={`flex items-center gap-1 font-medium ${log.status === "success" ? "text-health-normal" : "text-health-critical"}`}>
                        {log.status === "success" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {log.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Federated Training Section */}
          {section === "federated" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <h2 className="font-display text-xl font-bold text-foreground">Federated Learning Engine</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Algorithm", value: "FedAvg", icon: Cpu },
                  { label: "Aggregation Rounds", value: "12/50", icon: RefreshCw },
                  { label: "DP Noise (σ)", value: "0.01", icon: Lock },
                  { label: "Gradient Clip (C)", value: "1.0", icon: Shield },
                ].map((s, i) => (
                  <div key={i} className="bg-card rounded-2xl border border-border p-4">
                    <s.icon className="w-5 h-5 text-primary mb-2" />
                    <div className="font-display text-xl font-bold text-foreground">{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* FL Workflow */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-semibold text-foreground text-sm mb-4">Federated Learning Workflow</h3>
                <div className="flex flex-col gap-0">
                  {[
                    { step: 1, title: "Initialize Global Model", desc: "Server distributes initial weights to all participating nodes", done: true },
                    { step: 2, title: "Distribute to Nodes", desc: "Encrypted model parameters sent via secure channel (TLS 1.3)", done: true },
                    { step: 3, title: "Local Training", desc: "Each hospital trains on local patient data — data never leaves node", done: true },
                    { step: 4, title: "Apply Differential Privacy", desc: "Gaussian noise added (σ=0.01) before weight extraction", done: true },
                    { step: 5, title: "Encrypt & Transmit Δw", desc: "Only gradient deltas transmitted — no raw data shared", done: true },
                    { step: 6, title: "FedAvg Aggregation", desc: "Server aggregates weighted average of all received deltas", active: true },
                    { step: 7, title: "Redistribute Updated Model", desc: "New global model distributed to all nodes for next round", done: false },
                    { step: 8, title: "Log & Audit", desc: "All operations recorded in immutable audit trail", done: false },
                  ].map((s, i) => (
                    <div key={i} className="flex gap-4 pb-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          s.done ? "bg-health-normal text-white" : s.active ? "gradient-primary text-white animate-pulse" : "bg-muted text-muted-foreground"
                        }`}>{s.done ? <CheckCircle className="w-4 h-4" /> : s.step}</div>
                        {i < 7 && <div className={`w-0.5 h-full mt-1 ${s.done ? "bg-health-normal" : "bg-border"}`} />}
                      </div>
                      <div className="pb-2">
                        <div className={`text-sm font-semibold ${s.active ? "text-primary" : s.done ? "text-foreground" : "text-muted-foreground"}`}>{s.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="px-6 py-3 bg-muted/50 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            <span className="font-semibold text-foreground">Medical Disclaimer:</span> AI-generated health insights are for informational purposes only. Always consult a qualified healthcare provider.
          </p>
        </div>
      </main>
    </div>
  );
}
