import { useState, useEffect } from "react";
import { Activity, Wind } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function RecoveryHub() {
  const [breathingPhase, setBreathingPhase] = useState<"inhale" | "hold" | "exhale" | "rest">("inhale");
  const [isBreathing, setIsBreathing] = useState(false);

  useEffect(() => {
    if (!isBreathing) return;

    let timer: NodeJS.Timeout;
    if (breathingPhase === "inhale") timer = setTimeout(() => setBreathingPhase("hold"), 4000);
    else if (breathingPhase === "hold") timer = setTimeout(() => setBreathingPhase("exhale"), 4000);
    else if (breathingPhase === "exhale") timer = setTimeout(() => setBreathingPhase("rest"), 4000);
    else timer = setTimeout(() => setBreathingPhase("inhale"), 4000);

    return () => clearTimeout(timer);
  }, [breathingPhase, isBreathing]);

  return (
    <div className="p-6 md:p-8 space-y-8 pb-24 md:pb-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Recovery</h1>
        <p className="text-muted-foreground mt-2">Optimize your downtime</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="glass-panel p-8 rounded-3xl flex flex-col items-center justify-center min-h-[400px]">
          <h2 className="text-xl font-bold mb-8">Box Breathing</h2>
          
          <div className="relative w-64 h-64 flex items-center justify-center mb-8 cursor-pointer" onClick={() => setIsBreathing(!isBreathing)}>
            {/* Base circle */}
            <div className="absolute inset-0 rounded-full border-4 border-secondary/20" />
            
            {/* Animated breathing circle */}
            <motion.div
              className="absolute bg-secondary/30 rounded-full blur-xl"
              animate={{
                width: isBreathing && (breathingPhase === "inhale" || breathingPhase === "hold") ? 256 : 100,
                height: isBreathing && (breathingPhase === "inhale" || breathingPhase === "hold") ? 256 : 100,
                opacity: isBreathing && (breathingPhase === "inhale" || breathingPhase === "hold") ? 0.8 : 0.3,
              }}
              transition={{ duration: 4, ease: "easeInOut" }}
            />
            
            <div className="relative z-10 text-center">
              {isBreathing ? (
                <div className="text-2xl font-bold text-glow-secondary capitalize">{breathingPhase}</div>
              ) : (
                <div className="flex flex-col items-center">
                  <Wind className="w-8 h-8 mb-2 text-secondary" />
                  <span className="font-bold">Tap to Start</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Inhale 4s</span> • <span>Hold 4s</span> • <span>Exhale 4s</span> • <span>Hold 4s</span>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Daily Metrics</h2>
          <div className="space-y-4">
            <div className="glass-panel p-4 rounded-xl">
              <label className="text-sm font-bold text-muted-foreground block mb-2">Morning Weight (lbs)</label>
              <input type="number" className="bg-black/50 border border-border rounded-lg px-4 py-3 w-full font-mono text-xl focus:ring-1 focus:ring-primary outline-none" placeholder="0.0" />
            </div>
            <div className="glass-panel p-4 rounded-xl">
              <label className="text-sm font-bold text-muted-foreground block mb-2">Sleep (Hours)</label>
              <input type="number" step="0.5" className="bg-black/50 border border-border rounded-lg px-4 py-3 w-full font-mono text-xl focus:ring-1 focus:ring-primary outline-none" placeholder="0.0" />
            </div>
            <div className="glass-panel p-4 rounded-xl">
              <label className="text-sm font-bold text-muted-foreground block mb-2">Readiness Score (1-10)</label>
              <div className="flex gap-2">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex-1 h-12 rounded-lg bg-black/50 border border-border flex items-center justify-center cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors">
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
