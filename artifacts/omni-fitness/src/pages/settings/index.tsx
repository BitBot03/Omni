import { Save, User, Key, Database } from "lucide-react";

export default function Settings() {
  return (
    <div className="p-6 md:p-8 space-y-8 pb-24 md:pb-8 max-w-3xl mx-auto">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Configure your OS</p>
      </header>

      <div className="space-y-6">
        <section className="glass-panel p-6 rounded-3xl space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Profile & Body
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-2">Display Name</label>
              <input type="text" className="bg-black/50 border border-border rounded-lg px-4 py-3 w-full outline-none focus:ring-1 focus:ring-primary" defaultValue="Athlete" />
            </div>
            <div>
              <label className="text-sm font-bold text-muted-foreground block mb-2">Height (cm)</label>
              <input type="number" className="bg-black/50 border border-border rounded-lg px-4 py-3 w-full outline-none focus:ring-1 focus:ring-primary" defaultValue="180" />
            </div>
          </div>
        </section>

        <section className="glass-panel p-6 rounded-3xl space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Key className="w-5 h-5 text-secondary" />
            AI Configuration
          </h2>
          <div>
            <label className="text-sm font-bold text-muted-foreground block mb-2">OpenAI API Key (BYOK)</label>
            <input type="password" placeholder="sk-..." className="bg-black/50 border border-border rounded-lg px-4 py-3 w-full outline-none focus:ring-1 focus:ring-secondary font-mono" />
            <p className="text-xs text-muted-foreground mt-2">Stored locally in your browser. Never sent to our servers.</p>
          </div>
        </section>

        <section className="glass-panel p-6 rounded-3xl space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Database className="w-5 h-5 text-muted-foreground" />
            Data Management
          </h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <button className="bg-white/5 hover:bg-white/10 border border-border px-6 py-3 rounded-xl font-medium transition-colors">
              Export JSON
            </button>
            <button className="bg-white/5 hover:bg-white/10 border border-border px-6 py-3 rounded-xl font-medium transition-colors text-destructive hover:text-destructive hover:border-destructive/50">
              Erase All Data
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
