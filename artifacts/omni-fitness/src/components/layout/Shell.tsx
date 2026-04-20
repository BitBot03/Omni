import { Link, useLocation } from "wouter";
import { BarChart2, Dumbbell, HeartPulse, LayoutDashboard, Salad, Settings, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/workouts", icon: Dumbbell, label: "Workouts" },
  { href: "/nutrition", icon: Salad, label: "Nutrition" },
  { href: "/recovery", icon: HeartPulse, label: "Recovery" },
  { href: "/analytics", icon: BarChart2, label: "Analytics" },
  { href: "/ai", icon: MessageSquare, label: "AI Coach" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground">

      {/* ── Desktop Icon Sidebar ── */}
      <aside className="hidden md:flex w-[60px] flex-col items-center py-5 border-r border-border/50 bg-[#080808] z-20 shrink-0">
        {/* Logo mark */}
        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-6 shrink-0">
          <span className="text-primary font-black text-sm leading-none font-display">O</span>
        </div>

        {/* Nav icons */}
        <nav className="flex flex-col items-center gap-1 flex-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  title={item.label}
                  className={cn(
                    "relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer group",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <item.icon className="h-4.5 w-4.5" strokeWidth={isActive ? 2.5 : 1.75} />
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full glow-primary" />
                  )}
                  {/* Tooltip */}
                  <span className="absolute left-full ml-3 px-2 py-1 text-xs font-medium bg-[#111] border border-border rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Settings at bottom */}
        <Link href="/settings">
          <div
            title="Settings"
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer group relative",
              location.startsWith("/settings")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            <Settings className="h-4.5 w-4.5" strokeWidth={1.75} />
            <span className="absolute left-full ml-3 px-2 py-1 text-xs font-medium bg-[#111] border border-border rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
              Settings
            </span>
          </div>
        </Link>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0 scroll-smooth">
          {children}
        </div>
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[68px] bg-[#080808] border-t border-border/50 z-50">
        <div className="flex h-full items-center justify-around px-2">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-200",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 1.75} />
                  {isActive && <div className="w-1 h-1 mt-1 rounded-full bg-primary" />}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
