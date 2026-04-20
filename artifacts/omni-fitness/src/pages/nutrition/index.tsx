import { useGetDashboardSummary, useListNutritionLogs, useListHabits, useLogHabit } from "@workspace/api-client-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { Plus, Check } from "lucide-react";
import { motion } from "framer-motion";

const TEAL = "#00D4FF";
const GREEN = "#39FF14";

function MacroBar({ label, current, goal, color }: { label: string; current: number; goal: number; color: string }) {
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="stat-label">{label}</span>
        <span className="text-xs font-black text-white">{current}<span className="text-muted-foreground font-normal">/{goal}g</span></span>
      </div>
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
    </div>
  );
}

export default function NutritionHub() {
  const { data: summary } = useGetDashboardSummary();
  const { data: logs } = useListNutritionLogs({ date: format(new Date(), "yyyy-MM-dd") });
  const { data: habits } = useListHabits();
  const { mutate: logHabit } = useLogHabit();

  const calories = summary?.todayCalories ?? 0;
  const goal = summary?.calorieGoal ?? 2500;
  const protein = summary?.todayProtein ?? 0;
  const remaining = Math.max(0, goal - calories);
  const calPct = goal > 0 ? Math.min(100, (calories / goal) * 100) : 0;

  const chartData = [
    { name: "Consumed", value: calories },
    { name: "Remaining", value: remaining },
  ];
  const COLORS = [TEAL, "rgba(255,255,255,0.07)"];

  const mealCategories = ["breakfast", "lunch", "dinner", "snack"];

  return (
    <div className="p-4 md:p-6 space-y-5 pb-24 md:pb-6">

      <header>
        <p className="stat-label mb-0.5">FUEL PROTOCOL</p>
        <h1 className="font-display text-4xl md:text-5xl text-white uppercase italic tracking-wide">Nutrition</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Calorie Ring */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="omni-card p-5 flex flex-col items-center justify-center"
        >
          <p className="stat-label mb-4 self-start">DAILY CALORIES</p>
          <div className="w-40 h-40 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                  startAngle={90} endAngle={-270}
                >
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-white">{calories.toLocaleString()}</span>
              <span className="stat-label">/ {goal.toLocaleString()}</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 w-full">
            <div className="text-center">
              <p className="text-lg font-black" style={{ color: TEAL }}>{remaining.toLocaleString()}</p>
              <p className="stat-label">REMAINING</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black" style={{ color: GREEN }}>{Math.round(calPct)}%</p>
              <p className="stat-label">COMPLETE</p>
            </div>
          </div>
        </motion.div>

        {/* Macros */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="omni-card p-5 space-y-5"
        >
          <p className="stat-label">MACRONUTRIENTS</p>
          <MacroBar label="PROTEIN" current={protein} goal={180} color={TEAL} />
          <MacroBar label="CARBS" current={Math.round(calories * 0.4 / 4)} goal={300} color="#8B5CF6" />
          <MacroBar label="FATS" current={Math.round(calories * 0.3 / 9)} goal={80} color={GREEN} />
          <MacroBar label="FIBER" current={18} goal={35} color="#FF7A00" />
        </motion.div>

        {/* Habits */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="omni-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <p className="stat-label">DAILY HABITS</p>
            <span className="text-[10px] font-bold" style={{ color: TEAL }}>
              {summary?.habitsCompletedToday ?? 0}/{summary?.totalHabits ?? 0}
            </span>
          </div>
          <div className="space-y-2">
            {habits?.map((habit) => (
              <button
                key={habit.id}
                onClick={() => logHabit({ data: { habitId: habit.id, date: format(new Date(), "yyyy-MM-dd"), completed: true } })}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/4 hover:bg-white/8 transition-all group border border-white/5"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border transition-all"
                  style={{
                    borderColor: `${TEAL}60`,
                    background: "rgba(0,212,255,0.08)",
                  }}
                >
                  <Check className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" style={{ color: TEAL }} />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{habit.name}</p>
                  {habit.targetValue && (
                    <p className="stat-label text-[9px]">TARGET {habit.targetValue} {habit.unit ?? ""}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Today's Meals */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="md:col-span-3"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="stat-label">TODAY'S MEALS</p>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{ background: "rgba(0,212,255,0.1)", color: TEAL, border: "1px solid rgba(0,212,255,0.2)" }}
            >
              <Plus className="w-3.5 h-3.5" />
              LOG FOOD
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {mealCategories.map((cat) => {
              const catLogs = logs?.filter(l => l.mealCategory === cat) ?? [];
              const catCals = catLogs.reduce((s, l) => s + l.calories, 0);
              return (
                <div key={cat} className="omni-card p-4">
                  <p className="stat-label capitalize mb-2">{cat}</p>
                  <p className="text-xl font-black text-white">{catCals.toLocaleString()}</p>
                  <p className="stat-label">KCAL</p>
                  <div className="mt-3 space-y-1">
                    {catLogs.slice(0, 2).map((log) => (
                      <p key={log.id} className="text-[11px] text-muted-foreground truncate">{log.foodName}</p>
                    ))}
                    {catLogs.length === 0 && (
                      <p className="text-[11px] text-muted-foreground italic">Empty</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
