import { useGetDashboardSummary } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";

const TEAL = "#00D4FF";
const ORANGE = "#FF7A00";
const MUTED = "rgba(255,255,255,0.07)";

// ─── Muscle Body Silhouette SVG ───────────────────────────────────────────────
function MuscleSilhouette({ activeGroups = ["chest", "shoulders"] }: { activeGroups?: string[] }) {
  const isActive = (g: string) => activeGroups.includes(g);
  const heat = (g: string) =>
    isActive(g) ? "rgba(255,100,0,0.55)" : "rgba(255,255,255,0.06)";

  return (
    <svg viewBox="0 0 120 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Head */}
      <ellipse cx="60" cy="22" rx="14" ry="17" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
      {/* Neck */}
      <rect x="53" y="37" width="14" height="10" rx="3" fill="rgba(255,255,255,0.07)" />
      {/* Torso */}
      <path d="M35 47 Q30 55 30 75 L30 120 Q30 130 45 132 L75 132 Q90 130 90 120 L90 75 Q90 55 85 47 Z"
        fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
      {/* Chest left */}
      <ellipse cx="48" cy="65" rx="14" ry="10" fill={heat("chest")}
        style={{ filter: isActive("chest") ? "blur(6px)" : "none", opacity: isActive("chest") ? 0.9 : 0.4 }} />
      {/* Chest right */}
      <ellipse cx="72" cy="65" rx="14" ry="10" fill={heat("chest")}
        style={{ filter: isActive("chest") ? "blur(6px)" : "none", opacity: isActive("chest") ? 0.9 : 0.4 }} />
      {/* Abs */}
      <rect x="50" y="80" width="8" height="8" rx="2" fill="rgba(255,255,255,0.07)" />
      <rect x="62" y="80" width="8" height="8" rx="2" fill="rgba(255,255,255,0.07)" />
      <rect x="50" y="92" width="8" height="8" rx="2" fill="rgba(255,255,255,0.07)" />
      <rect x="62" y="92" width="8" height="8" rx="2" fill="rgba(255,255,255,0.07)" />
      <rect x="50" y="104" width="8" height="8" rx="2" fill="rgba(255,255,255,0.07)" />
      <rect x="62" y="104" width="8" height="8" rx="2" fill="rgba(255,255,255,0.07)" />
      {/* Left shoulder */}
      <ellipse cx="31" cy="55" rx="9" ry="8" fill={heat("shoulders")}
        style={{ filter: isActive("shoulders") ? "blur(5px)" : "none", opacity: isActive("shoulders") ? 0.85 : 0.4 }} />
      {/* Right shoulder */}
      <ellipse cx="89" cy="55" rx="9" ry="8" fill={heat("shoulders")}
        style={{ filter: isActive("shoulders") ? "blur(5px)" : "none", opacity: isActive("shoulders") ? 0.85 : 0.4 }} />
      {/* Left arm */}
      <path d="M24 62 Q16 72 14 95 Q18 102 22 95 Q26 72 32 65 Z"
        fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
      {/* Right arm */}
      <path d="M96 62 Q104 72 106 95 Q102 102 98 95 Q94 72 88 65 Z"
        fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
      {/* Left forearm */}
      <path d="M14 95 Q10 115 12 130 Q16 132 18 130 Q20 115 22 95 Z"
        fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
      {/* Right forearm */}
      <path d="M106 95 Q110 115 108 130 Q104 132 102 130 Q100 115 98 95 Z"
        fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
      {/* Pelvis */}
      <path d="M38 130 Q38 145 60 148 Q82 145 82 130 Z"
        fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
      {/* Left thigh */}
      <rect x="36" y="148" width="20" height="40" rx="8" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
      {/* Right thigh */}
      <rect x="64" y="148" width="20" height="40" rx="8" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
      {/* Left calf */}
      <rect x="38" y="192" width="16" height="26" rx="7" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
      {/* Right calf */}
      <rect x="66" y="192" width="16" height="26" rx="7" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
    </svg>
  );
}

// ─── Habit Dot Grid ───────────────────────────────────────────────────────────
function HabitDotGrid({ rate = 0.85 }: { rate?: number }) {
  const cols = 10;
  const rows = 5;
  const total = cols * rows;
  const filledCount = Math.round(total * rate);

  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full aspect-square transition-all"
          style={{
            background: i < filledCount ? TEAL : "rgba(255,255,255,0.1)",
            boxShadow: i < filledCount ? `0 0 6px 1px rgba(0,212,255,0.5)` : "none",
            width: "100%",
          }}
        />
      ))}
    </div>
  );
}

// ─── Weekly Volume Bar Chart ──────────────────────────────────────────────────
const dayLabels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function VolumeChart({ volumeData }: { volumeData: { date: string; volume: number }[] }) {
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;

  const chartData = dayLabels.map((day, i) => {
    const match = volumeData[i];
    return { day, volume: match?.volume || 0, isToday: i === todayIdx };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} barCategoryGap="30%" margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="day"
          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={false}
          contentStyle={{
            background: "#111",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          labelStyle={{ color: TEAL, fontWeight: 700, marginBottom: 2 }}
          formatter={(val: number) => [`${val.toLocaleString()} lbs`, ""]}
        />
        <Bar dataKey="volume" radius={[4, 4, 0, 0]} maxBarSize={32}>
          {chartData.map((entry, idx) => (
            <Cell
              key={idx}
              fill={entry.isToday ? TEAL : "rgba(255,255,255,0.1)"}
              style={{ filter: entry.isToday ? `drop-shadow(0 0 6px ${TEAL})` : "none" }}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Muscle Progress Bar ──────────────────────────────────────────────────────
function MuscleBar({ label, pct, color = TEAL }: { label: string; pct: number; color?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="stat-label">{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();

  const readiness = summary?.readinessScore ?? 94;
  const streak = summary?.currentStreak ?? 0;
  const weeklyVolume = summary?.weeklyVolume ?? [];
  const habitRate = summary?.habitConsistency ?? 0.85;
  const todayCalories = summary?.todayCalories ?? 0;
  const calorieGoal = summary?.calorieGoal ?? 2500;

  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;
  const todayLabel = dayLabels[todayIdx];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-background p-4 md:p-6 pb-24 md:pb-6 space-y-5"
    >

      {/* ── Header ── */}
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div>
            <p className="stat-label mb-0.5">GOD-MODE DASHBOARD</p>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-4xl md:text-5xl tracking-wide text-white leading-none uppercase italic">
                PROJECT OMNI
              </h1>
              <span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded border border-primary/40 text-primary bg-primary/8 uppercase mt-1">
                v1.0 OFFLINE
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="stat-label">SYNC STATUS</p>
            <p className="text-xs font-bold tracking-widest text-glow-primary" style={{ color: TEAL }}>LOCAL_ENCRYPTED</p>
          </div>
          <div className="text-right">
            <p className="stat-label">CURRENT STREAK</p>
            <p className="text-sm font-black tracking-widest font-display text-glow-orange italic" style={{ color: ORANGE }}>
              {streak} DAYS
            </p>
          </div>
        </div>
      </header>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* ── Row 1 ── */}

        {/* Card 1: Readiness Score */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="omni-card p-5 flex flex-col justify-between min-h-[220px]"
        >
          <p className="stat-label">READINESS SCORE</p>
          <div className="flex-1 flex items-center mt-2">
            {isLoading ? (
              <div className="readiness-number text-white/20">--</div>
            ) : (
              <div className="relative">
                <span className="readiness-number">{readiness}</span>
                <span className="text-3xl font-black text-white/60 ml-1 align-top mt-4 inline-block">%</span>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Central Nervous System fully recovered. Volume ceiling increased by{" "}
              <span className="font-bold text-white">12%</span> for today's push session.
            </p>
            <div className="flex gap-2">
              {[0.88, 0.72, 0.95, 0.60].map((v, i) => (
                <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-white/8">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${v * 100}%`,
                      background: v > 0.8 ? TEAL : v > 0.6 ? "#8B5CF6" : "#FF7A00",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Card 2: Weekly Training Volume */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="omni-card p-5 min-h-[220px] flex flex-col"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="stat-label">WEEKLY TRAINING VOLUME</p>
              <p className="text-[10px] text-muted-foreground tracking-widest">LBS / WEEK</p>
            </div>
            <span
              className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded uppercase"
              style={{ color: TEAL, background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)" }}
            >
              TODAY
            </span>
          </div>
          <div className="flex-1 min-h-[130px]">
            <VolumeChart volumeData={weeklyVolume} />
          </div>
        </motion.div>

        {/* Card 3: Muscle Saturation */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="omni-card p-5 min-h-[220px] flex flex-col"
        >
          <p className="stat-label mb-3">MUSCLE SATURATION</p>
          <div className="flex-1 flex items-center justify-center">
            <div className="h-44 w-24">
              <MuscleSilhouette activeGroups={["chest", "shoulders"]} />
            </div>
          </div>
        </motion.div>

        {/* ── Row 2 ── */}

        {/* Card 4: AI Super-Coach Insight */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="omni-card-teal p-5 min-h-[200px] flex flex-col justify-between"
        >
          <p className="flex items-center gap-2 stat-label text-primary/80">
            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" style={{ boxShadow: `0 0 6px ${TEAL}` }} />
            AI SUPER-COACH INSIGHT
          </p>
          <blockquote className="mt-3 text-sm md:text-base leading-relaxed italic text-white/90">
            "Your{" "}
            <strong className="font-black text-white not-italic">Sleep Quality (+14% vs avg)</strong>{" "}
            correlates with a{" "}
            <strong className="font-black not-italic" style={{ color: TEAL }}>4kg projected increase</strong>{" "}
            in your Bench Press 1RM for today's session."
          </blockquote>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-primary/20" />
            <span className="text-[10px] text-primary/60 tracking-widest uppercase font-semibold">
              {todayLabel} ANALYSIS
            </span>
          </div>
        </motion.div>

        {/* Card 5: Habit Consistency */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="omni-card p-5 min-h-[200px] flex flex-col"
        >
          <p className="stat-label mb-4">HABIT CONSISTENCY</p>
          <div className="flex-1">
            <HabitDotGrid rate={habitRate} />
          </div>
          <div className="mt-3 pt-3 border-t border-white/6 flex items-baseline justify-between">
            <p className="stat-label">LAST 30 DAYS</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-white">{((habitRate) * 100).toFixed(1)}%</span>
              <span className="text-xs font-bold" style={{ color: TEAL }}>+2.1%</span>
            </div>
          </div>
        </motion.div>

        {/* Card 6: Muscle Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="omni-card p-5 min-h-[200px] flex flex-col justify-center gap-4"
        >
          <MuscleBar label="CHEST (PEC MAJOR)" pct={88} color={ORANGE} />
          <MuscleBar label="DELTOIDS" pct={34} color={TEAL} />
          <MuscleBar label="TRICEPS" pct={72} color={TEAL} />
          <MuscleBar label="QUADRICEPS" pct={91} color={ORANGE} />
          <MuscleBar label="LATS" pct={55} color={TEAL} />
        </motion.div>

      </div>

      {/* ── Calories Strip ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="omni-card p-4 flex items-center gap-6"
      >
        <div>
          <p className="stat-label mb-1">DAILY CALORIES</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{todayCalories.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">/ {calorieGoal.toLocaleString()} kcal</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-white/8 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((todayCalories / calorieGoal) * 100, 100)}%` }}
              transition={{ duration: 1.4, ease: "easeOut", delay: 0.5 }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${TEAL}, ${TEAL}cc)`, boxShadow: `0 0 8px ${TEAL}` }}
            />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="stat-label mb-1">REMAINING</p>
          <span className="text-lg font-black" style={{ color: TEAL }}>
            {Math.max(calorieGoal - todayCalories, 0).toLocaleString()}
          </span>
        </div>
      </motion.div>

    </motion.div>
  );
}
