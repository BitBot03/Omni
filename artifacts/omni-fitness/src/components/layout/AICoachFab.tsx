import { MessageSquare } from "lucide-react";
import { Link, useLocation } from "wouter";

export function AICoachFab() {
  const [location] = useLocation();

  if (location === "/ai") return null;

  return (
    <Link href="/ai">
      <div className="fixed bottom-24 md:bottom-8 right-6 z-50 cursor-pointer group">
        <div className="relative">
          <div className="absolute inset-0 bg-secondary blur-lg opacity-50 rounded-full group-hover:opacity-80 transition-opacity duration-300" />
          <div className="relative bg-card border border-secondary/50 p-4 rounded-full shadow-lg shadow-secondary/20 flex items-center justify-center text-secondary group-hover:text-glow-secondary group-hover:scale-105 transition-all duration-300">
            <MessageSquare className="h-6 w-6" />
          </div>
        </div>
      </div>
    </Link>
  );
}
