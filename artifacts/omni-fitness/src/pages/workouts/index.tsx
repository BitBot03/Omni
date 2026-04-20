import { useListWorkouts, useListRoutines } from "@workspace/api-client-react";
import { Play, Plus, Search, CalendarDays } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function WorkoutsHub() {
  const { data: workouts, isLoading: isLoadingWorkouts } = useListWorkouts({ limit: 10 });
  const { data: routines, isLoading: isLoadingRoutines } = useListRoutines();

  return (
    <div className="p-6 md:p-8 space-y-8 pb-24 md:pb-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Workouts</h1>
          <p className="text-muted-foreground mt-2">Start a session or build a routine</p>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/workouts/active">
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4 cursor-pointer hover:bg-white/5 transition-all group">
            <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center group-hover:scale-110 transition-transform glow-primary">
              <Play className="w-6 h-6 ml-1" fill="currentColor" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-glow-primary">Start Empty Workout</h3>
              <p className="text-muted-foreground">Log as you go</p>
            </div>
          </div>
        </Link>
        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4 cursor-pointer hover:bg-white/5 transition-all group border-dashed border-2 border-border">
          <div className="w-12 h-12 rounded-full bg-secondary/20 text-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-glow-secondary">Create Routine</h3>
            <p className="text-muted-foreground">Build a structured plan</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">My Routines</h2>
        {isLoadingRoutines ? (
          <div className="text-muted-foreground">Loading routines...</div>
        ) : routines?.length === 0 ? (
          <div className="text-muted-foreground italic">No routines yet. Create one above.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {routines?.map((routine) => (
              <div key={routine.id} className="glass-panel p-4 rounded-xl flex flex-col gap-2">
                <h3 className="font-bold">{routine.name}</h3>
                <p className="text-sm text-muted-foreground">{routine.exercises?.length || 0} exercises</p>
                <Link href={`/workouts/active?routineId=${routine.id}`}>
                  <button className="mt-2 bg-primary/20 text-primary px-4 py-2 rounded-lg font-medium hover:bg-primary/30 transition-colors w-full text-center">
                    Start Routine
                  </button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Recent History</h2>
        {isLoadingWorkouts ? (
          <div className="text-muted-foreground">Loading history...</div>
        ) : workouts?.length === 0 ? (
          <div className="text-muted-foreground italic">No past workouts found.</div>
        ) : (
          <div className="space-y-4">
            {workouts?.map((workout) => (
              <div key={workout.id} className="glass-panel p-4 rounded-xl flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold">{workout.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(workout.startedAt), "MMM d, yyyy")} • {Math.floor((workout.duration || 0) / 60)} min
                    </p>
                  </div>
                </div>
                <div className="text-right hidden md:block">
                  <div className="font-mono">{workout.totalVolume?.toLocaleString() || 0} lbs</div>
                  <div className="text-xs text-muted-foreground">{workout.totalSets || 0} sets</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
