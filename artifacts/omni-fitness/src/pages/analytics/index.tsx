import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { Brain, TrendingUp } from "lucide-react";
import { useGetDashboardSummary } from "@workspace/api-client-react";

const mockRadarData = [
  { subject: "Chest", A: 120, fullMark: 150 },
  { subject: "Back", A: 98, fullMark: 150 },
  { subject: "Legs", A: 86, fullMark: 150 },
  { subject: "Shoulders", A: 99, fullMark: 150 },
  { subject: "Arms", A: 85, fullMark: 150 },
  { subject: "Core", A: 65, fullMark: 150 },
];

export default function AnalyticsHub() {
  const { data: summary } = useGetDashboardSummary();

  const volumeData = summary?.weeklyVolume || [];

  return (
    <div className="p-6 md:p-8 space-y-8 pb-24 md:pb-8">
      <header>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-2">Data-driven performance</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="glass-panel p-6 rounded-3xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Weekly Volume
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" tickFormatter={(val) => val.split('-')[2]} />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15,15,15,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#39FF14' }}
                />
                <Line type="monotone" dataKey="volume" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: 'hsl(var(--primary))', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="glass-panel p-6 rounded-3xl">
          <h2 className="text-xl font-bold mb-6">Muscle Focus</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={mockRadarData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                <Radar name="Sets" dataKey="A" stroke="hsl(var(--secondary))" fill="hsl(var(--secondary))" fillOpacity={0.3} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="md:col-span-2 glass-panel p-6 rounded-3xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Brain className="w-5 h-5 text-secondary" />
            AI Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-black/30 p-4 rounded-xl border border-primary/20">
              <h3 className="font-bold text-primary mb-1">Strong Correlation</h3>
              <p className="text-sm text-muted-foreground">Days with 7+ hours of sleep show a 15% increase in average lifting volume.</p>
            </div>
            <div className="bg-black/30 p-4 rounded-xl border border-secondary/20">
              <h3 className="font-bold text-secondary mb-1">Recovery Note</h3>
              <p className="text-sm text-muted-foreground">Your chest recovery is lagging behind. Consider an extra rest day before pressing.</p>
            </div>
            <div className="bg-black/30 p-4 rounded-xl border border-border">
              <h3 className="font-bold mb-1">Habit Trend</h3>
              <p className="text-sm text-muted-foreground">You've hit your protein goal 6 days in a row. Keep the streak alive!</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
