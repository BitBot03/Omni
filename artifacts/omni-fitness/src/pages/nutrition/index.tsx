import { useGetDashboardSummary, useListNutritionLogs, useListHabits } from "@workspace/api-client-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { Plus, CheckCircle2, Circle } from "lucide-react";

export default function NutritionHub() {
  const { data: summary } = useGetDashboardSummary();
  const { data: logs } = useListNutritionLogs({ date: format(new Date(), "yyyy-MM-dd") });
  const { data: habits } = useListHabits();

  const calories = summary?.todayCalories || 0;
  const goal = summary?.calorieGoal || 2500;
  
  const chartData = [
    { name: "Consumed", value: calories },
    { name: "Remaining", value: Math.max(0, goal - calories) }
  ];
  const COLORS = ["hsl(var(--secondary))", "hsl(var(--muted))"];

  return (
    <div className="p-6 md:p-8 space-y-8 pb-24 md:pb-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Nutrition & Habits</h1>
        <p className="text-muted-foreground mt-2">Fuel your performance</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="glass-panel p-6 rounded-3xl flex flex-col items-center justify-center relative">
          <h2 className="text-xl font-bold absolute top-6 left-6">Daily Calories</h2>
          <div className="w-48 h-48 mt-8 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-glow-secondary">{calories}</span>
              <span className="text-sm text-muted-foreground">/ {goal}</span>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Today's Meals</h2>
            <button className="w-10 h-10 rounded-full bg-secondary/20 text-secondary flex items-center justify-center hover:bg-secondary/30 transition-colors">
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-3">
            {["Breakfast", "Lunch", "Dinner", "Snacks"].map((meal) => {
              const mealLogs = logs?.filter(l => l.meal.toLowerCase() === meal.toLowerCase()) || [];
              const mealCals = mealLogs.reduce((sum, l) => sum + l.calories, 0);
              
              return (
                <div key={meal} className="glass-panel p-4 rounded-xl flex justify-between items-center cursor-pointer hover:bg-white/5 transition-colors">
                  <div>
                    <h3 className="font-bold">{meal}</h3>
                    <p className="text-sm text-muted-foreground">{mealLogs.length} items</p>
                  </div>
                  <div className="font-mono">{mealCals} kcal</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="md:col-span-2 space-y-4">
          <h2 className="text-2xl font-bold">Daily Habits</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {habits?.map(habit => (
              <div key={habit.id} className="glass-panel p-4 rounded-xl flex items-center justify-between cursor-pointer group">
                <div>
                  <h3 className="font-bold">{habit.name}</h3>
                  <p className="text-xs text-muted-foreground">{habit.currentStreak} day streak</p>
                </div>
                <Circle className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            ))}
            {(!habits || habits.length === 0) && (
              <div className="text-muted-foreground italic col-span-3">No habits configured yet.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
