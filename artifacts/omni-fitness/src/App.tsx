import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Shell } from "@/components/layout/Shell";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import WorkoutsHub from "@/pages/workouts";
import LiveWorkout from "@/pages/workouts/active";
import NutritionHub from "@/pages/nutrition";
import RecoveryHub from "@/pages/recovery";
import AnalyticsHub from "@/pages/analytics";
import AiCoach from "@/pages/ai";
import Settings from "@/pages/settings";

const queryClient = new QueryClient();

function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/workouts" component={WorkoutsHub} />
        <Route path="/workouts/active" component={LiveWorkout} />
        <Route path="/nutrition" component={NutritionHub} />
        <Route path="/recovery" component={RecoveryHub} />
        <Route path="/analytics" component={AnalyticsHub} />
        <Route path="/ai" component={AiCoach} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
