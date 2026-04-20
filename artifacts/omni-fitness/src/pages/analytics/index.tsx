import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell
} from "recharts";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { motion } from "framer-motion";

const TEAL = "#00D4FF";
const ORANGE = "#FF7A00";
const GREEN = "#39FF14";

const dayLabels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function MuscleBar({ label, pct, color = TEAL, delay = 0 }: { label: string; pct: number; color?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="space-y-1.5"
    >
      <div className="flex justify-between items-center">
        <span className="stat-label">{label}</span>
        <span className="text-xs font-black" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: "easeOut", delay: delay + 0.2 }}
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
    </motion.div>
  );
}

function InsightCard({ title, body, color }: { title: string; body: string; color: string }) {
  return (
    <div
      className="p-4 rounded-2xl flex flex-col gap-2"
      style={{ background: `${color}10`, border: `1px solid ${color}25` }}
    >
      <p className="stat-label" style={{ color }}>{title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

export default function AnalyticsHub() {
  const { data: summary } = useGetDashboardSummary();
  const weeklyVolume = summary?.weeklyVolume ?? [];

  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;
  const chartData = dayLabels.map((day, i) => ({
    day,
    volume: weeklyVolume[i]?.volume ?? 0,
    isToday: i === todayIdx,
  }));

  return (
    <div className="p-4 md:p-6 space-y-5 pb-24 md:pb-6">

      <header>
        <p className="stat-label mb-0.5">PERFORMANCE INTEL</p>
        <h1 className="font-display text-4xl md:text-5xl text-white uppercase italic tracking-wide">Analytics</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Volume Chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="omni-card p-5 md:col-span-2"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="stat-label">WEEKLY TRAINING VOLUME</p>
              <p className="text-[10px] text-muted-foreground tracking-widest">LBS / WEEK</p>
            </div>
            <span
              className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded"
              style={{ color: TEAL, background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)" }}
            >
              LIVE
            </span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="35%" margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em" }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9 }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px" }}
                  formatter={(val: number) => [`${val.toLocaleString()} lbs`, ""]}
                />
                <Bar dataKey="volume" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {chartData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.isToday ? TEAL : "rgba(255,255,255,0.09)"}
                      style={{ filter: entry.isToday ? `drop-shadow(0 0 6px ${TEAL})` : "none" }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Muscle Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="omni-card p-5 space-y-4"
        >
          <p className="stat-label">MUSCLE SATURATION</p>
          <MuscleBar label="CHEST (PEC MAJOR)" pct={88} color={ORANGE} delay={0.2} />
          <MuscleBar label="DELTOIDS" pct={34} color={TEAL} delay={0.25} />
          <MuscleBar label="TRICEPS" pct={72} color={TEAL} delay={0.3} />
          <MuscleBar label="QUADRICEPS" pct={91} color={ORANGE} delay={0.35} />
          <MuscleBar label="LATS" pct={55} color={TEAL} delay={0.4} />
          <MuscleBar label="HAMSTRINGS" pct={61} color={GREEN} delay={0.45} />
        </motion.div>

        {/* AI Insights */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="md:col-span-3"
        >
          <p className="stat-label mb-3">AI-DERIVED INSIGHTS</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <InsightCard
              title="STRONG CORRELATION"
              body="Days with 7+ hours of sleep show a 15% increase in average lifting volume. Protect your sleep window."
              color={TEAL}
            />
            <InsightCard
              title="RECOVERY NOTE"
              body="Your chest recovery is lagging. Consider an extra rest day before the next push session to maximize gains."
              color={ORANGE}
            />
            <InsightCard
              title="HABIT TREND"
              body="Protein goal hit 6 days in a row. Maintaining consistent nutrition directly supports muscle protein synthesis."
              color={GREEN}
            />
          </div>
        </motion.div>

      </div>
    </div>
  );
}
