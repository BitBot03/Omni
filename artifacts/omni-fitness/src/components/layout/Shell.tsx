import { Link, useLocation } from "wouter";
import {
  Activity,
  BarChart2,
  Dumbbell,
  HeartPulse,
  Home,
  MessageSquare,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AICoachFab } from "./AICoachFab";

const navItems = [
  { href: "/", label: "God Mode", icon: Home },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/nutrition", label: "Nutrition", icon: Activity },
  { href: "/recovery", label: "Recovery", icon: HeartPulse },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border glass-panel">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tighter text-glow-primary">
            OMNI <span className="text-primary">OS</span>
          </h1>
        </div>
        <nav className="flex-1 space-y-2 p-4">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="block">
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary glow-primary"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border/50">
          <Link href="/settings" className="block">
            <div
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                location.startsWith("/settings")
                  ? "bg-primary/10 text-primary glow-primary"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <Settings className="h-5 w-5" />
              <span className="font-medium">Settings</span>
            </div>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0 scroll-smooth">
          {children}
        </div>
        <AICoachFab />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 glass-panel border-t border-border z-50 px-6 pb-safe">
        <div className="flex h-full items-center justify-between">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center w-full h-full">
                <div
                  className={cn(
                    "flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all duration-200",
                    isActive ? "text-primary text-glow-primary" : "text-muted-foreground"
                  )}
                >
                  <item.icon className="h-6 w-6 mb-1" />
                  {isActive && <div className="w-1 h-1 rounded-full bg-primary glow-primary" />}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
