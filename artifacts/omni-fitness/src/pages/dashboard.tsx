import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Activity, Flame, Trophy, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Initializing God Mode...</div>;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 md:p-8 space-y-8 pb-24 md:pb-8"
    >
      <header>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">God Mode</h1>
        <p className="text-muted-foreground mt-2">Your daily fitness command center</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric Cards */}
        <div className="glass-panel p-4 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center gap-2 text-primary">
            <Flame className="w-5 h-5" />
            <span className="font-semibold">Streak</span>
          </div>
          <div className="text-3xl font-black text-glow-primary">{summary?.currentStreak || 0}</div>
          <div className="text-xs text-muted-foreground">Days active</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center gap-2 text-secondary">
            <Activity className="w-5 h-5" />
            <span className="font-semibold">Readiness</span>
          </div>
          <div className="text-3xl font-black text-glow-secondary">{summary?.readinessScore || 0}</div>
          <div className="text-xs text-muted-foreground">Recovery score</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center gap-2 text-primary">
            <Trophy className="w-5 h-5" />
            <span className="font-semibold">Volume</span>
          </div>
          <div className="text-3xl font-black text-glow-primary">
            {(summary?.totalVolumeToday || 0).toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">Lbs lifted today</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center gap-2 text-secondary">
            <Zap className="w-5 h-5" />
            <span className="font-semibold">Calories</span>
          </div>
          <div className="text-3xl font-black text-glow-secondary">
            {summary?.todayCalories || 0}
            <span className="text-lg text-muted-foreground ml-1">/ {summary?.calorieGoal || 2500}</span>
          </div>
          <div className="text-xs text-muted-foreground">Daily burn</div>
        </div>
      </div>

    </motion.div>
  );
}
