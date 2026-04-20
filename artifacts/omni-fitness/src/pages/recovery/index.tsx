import { useState, useEffect } from "react";
import { Wind } from "lucide-react";
import { motion } from "framer-motion";

const TEAL = "#00D4FF";
const ORANGE = "#FF7A00";
const GREEN = "#39FF14";

const phases = ["INHALE", "HOLD", "EXHALE", "REST"] as const;
type Phase = typeof phases[number];
const phaseDurations: Record<Phase, number> = { INHALE: 4000, HOLD: 4000, EXHALE: 4000, REST: 2000 };
const phaseColors: Record<Phase, string> = { INHALE: TEAL, HOLD: "#8B5CF6", EXHALE: ORANGE, REST: GREEN };

function RecoveryBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="stat-label">{label}</span>
        <span className="text-xs font-black" style={{ color }}>{value}<span className="text-muted-foreground font-normal">/{max}</span></span>
      </div>
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(value / max) * 100}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
    </div>
  );
}

export default function RecoveryHub() {
  const [phase, setPhase] = useState<Phase>("INHALE");
  const [isBreathing, setIsBreathing] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isBreathing) return;
    const timer = setTimeout(() => {
      const nextIdx = (phases.indexOf(phase) + 1) % phases.length;
      setPhase(phases[nextIdx]);
    }, phaseDurations[phase]);
    return () => clearTimeout(timer);
  }, [phase, isBreathing]);

  useEffect(() => {
    if (!isBreathing) { setSeconds(0); return; }
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isBreathing]);

  const color = phaseColors[phase];

  return (
    <div className="p-4 md:p-6 space-y-5 pb-24 md:pb-6">

      <header>
        <p className="stat-label mb-0.5">CNS RECOVERY</p>
        <h1 className="font-display text-4xl md:text-5xl text-white uppercase italic tracking-wide">Recovery</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Breathing */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="omni-card p-5 md:col-span-1 flex flex-col items-center"
        >
          <div className="flex items-center justify-between w-full mb-5">
            <p className="stat-label">BOX BREATHING</p>
            <Wind className="w-4 h-4 text-muted-foreground" />
          </div>

          <div
            className="relative w-52 h-52 flex items-center justify-center cursor-pointer mb-5"
            onClick={() => setIsBreathing(!isBreathing)}
          >
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border border-white/10" />
            {/* Animated pulse */}
            <motion.div
              className="absolute rounded-full"
              animate={{
                width: isBreathing && (phase === "INHALE" || phase === "HOLD") ? 200 : 100,
                height: isBreathing && (phase === "INHALE" || phase === "HOLD") ? 200 : 100,
                opacity: isBreathing ? 0.35 : 0.1,
              }}
              transition={{ duration: phaseDurations[phase] / 1000, ease: "easeInOut" }}
              style={{ background: color, filter: "blur(20px)" }}
            />
            {/* Center circle */}
            <motion.div
              className="relative z-10 rounded-full border-2 flex items-center justify-center w-28 h-28"
              animate={{ borderColor: color, boxShadow: `0 0 20px ${color}50` }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-center">
                {isBreathing ? (
                  <>
                    <p className="text-sm font-black tracking-widest" style={{ color }}>{phase}</p>
                    <p className="stat-label">{Math.round(phaseDurations[phase] / 1000)}s</p>
                  </>
                ) : (
                  <p className="stat-label">TAP TO START</p>
                )}
              </div>
            </motion.div>
          </div>

          {isBreathing && (
            <div className="flex items-center gap-2 mb-3">
              {phases.map(p => (
                <div
                  key={p}
                  className="h-1 flex-1 rounded-full transition-all duration-300"
                  style={{ background: p === phase ? phaseColors[p] : "rgba(255,255,255,0.1)" }}
                />
              ))}
            </div>
          )}

          <div className="flex justify-between w-full">
            <div>
              <p className="stat-label">ELAPSED</p>
              <p className="text-lg font-black text-white">
                {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
              </p>
            </div>
            <div className="text-right">
              <p className="stat-label">CYCLES</p>
              <p className="text-lg font-black" style={{ color: TEAL }}>
                {Math.floor(seconds / 16)}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Recovery Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="omni-card p-5 space-y-5"
        >
          <p className="stat-label">RECOVERY METRICS</p>
          <RecoveryBar label="SLEEP QUALITY" value={7.5} max={9} color={TEAL} />
          <RecoveryBar label="HRV SCORE" value={68} max={100} color={GREEN} />
          <RecoveryBar label="CNS READINESS" value={82} max={100} color={TEAL} />
          <RecoveryBar label="SORENESS LEVEL" value={3} max={10} color={ORANGE} />
          <RecoveryBar label="HYDRATION" value={2.1} max={3} color="#8B5CF6" />
        </motion.div>

        {/* Muscle Recovery Status */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="omni-card p-5 space-y-5"
        >
          <p className="stat-label">MUSCLE RECOVERY STATUS</p>
          {[
            { label: "CHEST", pct: 68, color: ORANGE },
            { label: "BACK", pct: 92, color: GREEN },
            { label: "SHOULDERS", pct: 55, color: ORANGE },
            { label: "LEGS", pct: 85, color: TEAL },
            { label: "ARMS", pct: 78, color: TEAL },
            { label: "CORE", pct: 95, color: GREEN },
          ].map(({ label, pct, color }) => (
            <div key={label} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="stat-label">{label}</span>
                <span className="text-xs font-bold" style={{ color }}>
                  {pct >= 80 ? "READY" : pct >= 60 ? "PARTIAL" : "FATIGUED"}
                </span>
              </div>
              <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: color, boxShadow: `0 0 5px ${color}` }}
                />
              </div>
            </div>
          ))}
        </motion.div>

      </div>
    </div>
  );
}
