import { motion } from "framer-motion";
import { UtensilsCrossed, Flame, Apple, Coffee, Moon, AlertTriangle } from "lucide-react";

const mealPlan = [
  {
    meal: "Breakfast",
    time: "8:00 AM",
    icon: Coffee,
    calories: 420,
    items: ["Oatmeal with banana & walnuts", "Greek yogurt (low-fat)", "Green tea"],
    macros: { protein: 18, carbs: 62, fat: 12 },
  },
  {
    meal: "Lunch",
    time: "1:00 PM",
    icon: Apple,
    calories: 580,
    items: ["Grilled chicken breast (120g)", "Brown rice (1 cup)", "Mixed vegetables", "Dal soup"],
    macros: { protein: 42, carbs: 68, fat: 14 },
  },
  {
    meal: "Dinner",
    time: "7:30 PM",
    icon: Moon,
    calories: 440,
    items: ["Paneer tikka / Baked salmon", "Quinoa (½ cup)", "Sautéed spinach & carrots"],
    macros: { protein: 35, carbs: 40, fat: 18 },
  },
];

const avoidList = ["Processed sugar", "White bread", "Deep-fried foods", "Carbonated drinks", "Trans fats"];
const micronutrients = [
  { name: "Vitamin D", target: "600 IU", current: "480 IU", pct: 80 },
  { name: "Iron", target: "18 mg", current: "14 mg", pct: 78 },
  { name: "Calcium", target: "1000 mg", current: "850 mg", pct: 85 },
  { name: "Omega-3", target: "1.6 g", current: "1.2 g", pct: 75 },
];

export default function DietTab() {
  const totalCalories = mealPlan.reduce((a, m) => a + m.calories, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">AI Diet Planner</h2>
        <p className="text-sm text-muted-foreground">Personalized plan based on BMI, conditions, activity & preferences</p>
      </div>

      {/* Calorie Target */}
      <div className="bg-gradient-to-br from-secondary to-accent rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70 text-sm mb-1">Daily Calorie Target</p>
            <div className="font-display text-4xl font-bold">1,890</div>
            <p className="text-white/70 text-sm mt-1">Based on Mifflin-St Jeor formula</p>
          </div>
          <div className="text-right">
            <Flame className="w-12 h-12 text-white/30 ml-auto mb-2" />
            <div className="text-sm">
              <span className="font-semibold">{totalCalories} kcal</span>
              <span className="text-white/70"> planned</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full mt-2 w-32">
              <div className="h-full bg-white rounded-full" style={{ width: `${(totalCalories / 1890) * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/20">
          {[
            { label: "Protein", value: "95g", pct: "20%" },
            { label: "Carbs", value: "240g", pct: "52%" },
            { label: "Fat", value: "44g", pct: "21%" },
          ].map((m, i) => (
            <div key={i} className="text-center">
              <div className="font-bold text-lg">{m.value}</div>
              <div className="text-xs text-white/60">{m.label} ({m.pct})</div>
            </div>
          ))}
        </div>
      </div>

      {/* Today's Meal Plan */}
      <div>
        <h3 className="font-semibold text-foreground mb-3">Today's Meal Plan</h3>
        <div className="space-y-3">
          {mealPlan.map((meal, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-2xl p-4 border border-border"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                  <meal.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-semibold text-foreground text-sm">{meal.meal}</span>
                      <span className="text-xs text-muted-foreground ml-2">{meal.time}</span>
                    </div>
                    <span className="text-sm font-bold text-primary">{meal.calories} kcal</span>
                  </div>
                  <ul className="space-y-1">
                    {meal.items.map((item, j) => (
                      <li key={j} className="text-xs text-muted-foreground">• {item}</li>
                    ))}
                  </ul>
                  <div className="flex gap-3 mt-2">
                    {Object.entries(meal.macros).map(([key, val]) => (
                      <span key={key} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground capitalize">{key}: {val}g</span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Avoid List */}
        <div className="bg-destructive/5 rounded-2xl p-5 border border-destructive/20">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" /> Foods to Avoid
          </h3>
          <ul className="space-y-2">
            {avoidList.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="w-1.5 h-1.5 bg-destructive rounded-full" />{item}
              </li>
            ))}
          </ul>
        </div>

        {/* Micronutrients */}
        <div className="bg-card rounded-2xl p-5 border border-border">
          <h3 className="font-semibold text-foreground mb-3">Micronutrient Targets</h3>
          <div className="space-y-3">
            {micronutrients.map((n, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{n.name}</span>
                  <span>{n.current} / {n.target}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full">
                  <div className="h-full gradient-primary rounded-full" style={{ width: `${n.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
