import { motion } from "framer-motion";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { TrendingUp, AlertCircle, CheckCircle, Zap } from "lucide-react";

const heartData = [
  { time: "Mon", value: 72, forecast: null },
  { time: "Tue", value: 75, forecast: null },
  { time: "Wed", value: 78, forecast: null },
  { time: "Thu", value: 74, forecast: null },
  { time: "Fri", value: 80, forecast: null },
  { time: "Sat", value: 77, forecast: null },
  { time: "Sun", value: 78, forecast: null },
  { time: "Mon+", value: null, forecast: 76 },
  { time: "Tue+", value: null, forecast: 77 },
  { time: "Wed+", value: null, forecast: 75 },
];

const bpData = [
  { time: "Mon", systolic: 120, diastolic: 80 },
  { time: "Tue", systolic: 122, diastolic: 82 },
  { time: "Wed", systolic: 118, diastolic: 78 },
  { time: "Thu", systolic: 125, diastolic: 85 },
  { time: "Fri", systolic: 121, diastolic: 80 },
  { time: "Sat", systolic: 119, diastolic: 79 },
  { time: "Sun", systolic: 122, diastolic: 81 },
];

const sugarData = [
  { time: "6AM", value: 88 },
  { time: "9AM", value: 105 },
  { time: "12PM", value: 140 },
  { time: "3PM", value: 95 },
  { time: "6PM", value: 120 },
  { time: "9PM", value: 98 },
];

const vitals = [
  { name: "Heart Rate", value: 78, unit: "bpm", min: 60, max: 100, status: "normal", color: "#ef4444" },
  { name: "SpO₂", value: 98, unit: "%", min: 95, max: 100, status: "normal", color: "#3b82f6" },
  { name: "Temperature", value: 98.4, unit: "°F", min: 97, max: 99, status: "normal", color: "#f59e0b" },
  { name: "BMI", value: 24.5, unit: "kg/m²", min: 18.5, max: 24.9, status: "normal", color: "#10b981" },
];

export default function VitalsTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Vital Monitoring Engine</h2>
          <p className="text-sm text-muted-foreground">AI-powered trend analysis with 7-day forecast</p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full">
          <Zap className="w-3.5 h-3.5" /> LSTM Prediction Active
        </div>
      </div>

      {/* Vitals Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {vitals.map((v, i) => {
          const pct = ((v.value - v.min) / (v.max - v.min)) * 100;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-2xl p-4 border border-border shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">{v.name}</span>
                <CheckCircle className="w-4 h-4 text-health-normal" />
              </div>
              <div className="font-display text-2xl font-bold text-foreground mb-1">
                {v.value}<span className="text-sm font-normal text-muted-foreground ml-1">{v.unit}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full mt-3">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(Math.max(pct, 5), 95)}%`, backgroundColor: v.color }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{v.min}</span><span>{v.max}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm">Heart Rate Trend + Forecast</h3>
              <p className="text-xs text-muted-foreground">7-day historical + 3-day AI prediction</p>
            </div>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={heartData}>
              <defs>
                <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(214 84% 40%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(214 84% 40%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="hrForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(195 85% 48%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(195 85% 48%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 25% 90%)" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis domain={[60, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="hsl(214 84% 40%)" fill="url(#hrGrad)" strokeWidth={2} dot={false} connectNulls={false} name="Actual" />
              <Area type="monotone" dataKey="forecast" stroke="hsl(195 85% 48%)" fill="url(#hrForecast)" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls={false} name="Forecast" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-2xl p-5 border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm">Blood Pressure (7-Day)</h3>
              <p className="text-xs text-muted-foreground">Systolic / Diastolic mmHg</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={bpData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 25% 90%)" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis domain={[60, 140]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="systolic" stroke="hsl(0 84% 55%)" strokeWidth={2} dot={false} name="Systolic" />
              <Line type="monotone" dataKey="diastolic" stroke="hsl(214 84% 40%)" strokeWidth={2} dot={false} name="Diastolic" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Blood Sugar Daily */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <h3 className="font-semibold text-foreground text-sm mb-4">Blood Sugar — Today's Profile</h3>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={sugarData}>
            <defs>
              <linearGradient id="sugarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(38 92% 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 25% 90%)" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis domain={[70, 160]} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="hsl(38 92% 50%)" fill="url(#sugarGrad)" strokeWidth={2} dot={false} name="mg/dL" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* AI Insights */}
      <div className="bg-primary/5 rounded-2xl p-5 border border-primary/20">
        <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" /> AI Health Insights
        </h3>
        <div className="space-y-2">
          {[
            { icon: CheckCircle, color: "text-health-normal", text: "All vitals within personalized normal range based on your age, gender, and lifestyle profile." },
            { icon: TrendingUp, color: "text-primary", text: "Heart rate trending slightly upward this week. Consider more rest if work stress is high." },
            { icon: AlertCircle, color: "text-health-warning", text: "Post-meal blood sugar peaked at 140 mg/dL. Monitor carbohydrate intake." },
          ].map(({ icon: Icon, color, text }, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <Icon className={`w-4 h-4 ${color} mt-0.5 flex-shrink-0`} />
              <span className="text-muted-foreground">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
