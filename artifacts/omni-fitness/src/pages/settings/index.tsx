import { Save, User, Key, Database, Shield } from "lucide-react";
import { motion } from "framer-motion";

const TEAL = "#00D4FF";

function SettingSection({
  icon: Icon,
  title,
  delay = 0,
  children,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="omni-card p-5 space-y-5"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color: TEAL }} />
        <p className="stat-label text-white">{title}</p>
      </div>
      {children}
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="stat-label">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors";

export default function Settings() {
  return (
    <div className="p-4 md:p-6 space-y-5 pb-24 md:pb-6 max-w-3xl">

      <header>
        <p className="stat-label mb-0.5">SYSTEM CONFIG</p>
        <h1 className="font-display text-4xl md:text-5xl text-white uppercase italic tracking-wide">Settings</h1>
      </header>

      <SettingSection icon={User} title="PROFILE & BODY" delay={0.05}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="DISPLAY NAME">
            <input type="text" className={inputCls} defaultValue="Athlete" />
          </Field>
          <Field label="HEIGHT (CM)">
            <input type="number" className={inputCls} defaultValue="180" />
          </Field>
          <Field label="BODY WEIGHT (KG)">
            <input type="number" className={inputCls} defaultValue="82" />
          </Field>
          <Field label="AGE">
            <input type="number" className={inputCls} defaultValue="28" />
          </Field>
        </div>
      </SettingSection>

      <SettingSection icon={Key} title="AI CONFIGURATION" delay={0.1}>
        <Field label="OPENAI API KEY (BYOK)">
          <input type="password" placeholder="sk-..." className={`${inputCls} font-mono tracking-widest`} />
        </Field>
        <div
          className="flex items-start gap-2 p-3 rounded-xl text-xs text-muted-foreground"
          style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.1)" }}
        >
          <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: TEAL }} />
          Stored locally in your browser via localStorage. Never sent to any remote server. Your key, your data.
        </div>
        <Field label="AI MODEL">
          <select className={inputCls}>
            <option value="gpt-4o">GPT-4o (Recommended)</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast)</option>
          </select>
        </Field>
      </SettingSection>

      <SettingSection icon={Database} title="NUTRITION TARGETS" delay={0.15}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["TRAINING CALORIES", "REST CALORIES", "PROTEIN (G)", "CARBS (G)"].map((label, i) => (
            <Field key={label} label={label}>
              <input type="number" className={inputCls} defaultValue={[2800, 2200, 180, 300][i]} />
            </Field>
          ))}
        </div>
      </SettingSection>

      <SettingSection icon={Database} title="DATA MANAGEMENT" delay={0.2}>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            className="flex-1 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all"
            style={{ background: "rgba(0,212,255,0.08)", color: TEAL, border: "1px solid rgba(0,212,255,0.2)" }}
          >
            EXPORT JSON
          </button>
          <button
            className="flex-1 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all"
            style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            IMPORT BACKUP
          </button>
          <button
            className="flex-1 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase text-red-500/70 border border-red-500/20 transition-all hover:border-red-500/40 hover:text-red-500"
          >
            CLEAR ALL DATA
          </button>
        </div>
      </SettingSection>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold tracking-widest uppercase text-sm transition-all"
        style={{
          background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,212,255,0.1))",
          color: TEAL,
          border: "1px solid rgba(0,212,255,0.3)",
          boxShadow: "0 0 20px rgba(0,212,255,0.15)",
        }}
      >
        <Save className="w-4 h-4" />
        SAVE CONFIGURATION
      </motion.button>

    </div>
  );
}
