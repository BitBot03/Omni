import { useListWorkouts, useListRoutines } from "@workspace/api-client-react";
import { Play, Plus, ChevronRight, CalendarDays, Dumbbell } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { format } from "date-fns";

const TEAL = "#00D4FF";

export default function WorkoutsHub() {
  const { data: workouts, isLoading: isLoadingWorkouts } = useListWorkouts({ limit: 8 });
  const { data: routines, isLoading: isLoadingRoutines } = useListRoutines();

  return (
    <div className="p-4 md:p-6 space-y-5 pb-24 md:pb-6">

      {/* Header */}
      <header>
        <p className="stat-label mb-0.5">TRAINING HUB</p>
        <h1 className="font-display text-4xl md:text-5xl text-white uppercase italic tracking-wide">Workouts</h1>
      </header>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/workouts/active">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="omni-card p-5 cursor-pointer group border border-primary/20 hover:border-primary/50 transition-all"
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
              style={{ background: "rgba(0,212,255,0.1)" }}
            >
              <Play className="w-5 h-5 ml-0.5" style={{ color: TEAL }} fill={TEAL} />
            </div>
            <p className="font-black text-white text-base">START WORKOUT</p>
            <p className="stat-label mt-0.5">Empty session</p>
          </motion.div>
        </Link>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="omni-card p-5 cursor-pointer border border-dashed border-white/10 hover:border-white/20 transition-all"
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 bg-white/5">
            <Plus className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="font-black text-white text-base">NEW ROUTINE</p>
          <p className="stat-label mt-0.5">Build a plan</p>
        </motion.div>
      </div>

      {/* Routines */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="stat-label">MY ROUTINES</p>
          <span className="text-[10px] text-muted-foreground">{routines?.length || 0} plans</span>
        </div>
        {isLoadingRoutines ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="omni-card p-4 rounded-2xl min-w-[200px] animate-pulse h-28" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {routines?.map((routine, idx) => (
              <motion.div
                key={routine.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className="omni-card p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(0,212,255,0.1)" }}
                  >
                    <Dumbbell className="w-4 h-4" style={{ color: TEAL }} />
                  </div>
                  <span className="stat-label text-[9px]">{routine.exercises?.length || 0} EXERCISES</span>
                </div>
                <p className="font-bold text-white text-sm mb-1">{routine.name}</p>
                {routine.description && (
                  <p className="text-[11px] text-muted-foreground mb-3 line-clamp-1">{routine.description}</p>
                )}
                <Link href={`/workouts/active?routineId=${routine.id}`}>
                  <button
                    className="w-full py-2 rounded-xl text-xs font-bold tracking-widest uppercase transition-all"
                    style={{
                      background: "rgba(0,212,255,0.1)",
                      color: TEAL,
                      border: "1px solid rgba(0,212,255,0.2)",
                    }}
                  >
                    START
                  </button>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Workouts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="stat-label">RECENT SESSIONS</p>
          <span className="text-[10px] text-muted-foreground">{workouts?.length || 0} logged</span>
        </div>
        {isLoadingWorkouts ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="omni-card p-4 h-16 animate-pulse" />
            ))}
          </div>
        ) : workouts?.length === 0 ? (
          <div className="omni-card p-6 text-center">
            <p className="text-muted-foreground text-sm italic">No sessions logged yet. Start your first workout.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {workouts?.map((workout, idx) => (
              <motion.div
                key={workout.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="omni-card p-4 flex items-center justify-between group hover:border-white/15 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{workout.name || "Workout Session"}</p>
                    <p className="stat-label text-[10px]">
                      {format(new Date(workout.startedAt ?? new Date()), "EEE, MMM d")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {workout.totalVolume !== null && (
                    <div className="text-right">
                      <p className="text-xs font-black text-white">{(workout.totalVolume ?? 0).toLocaleString()}</p>
                      <p className="stat-label text-[9px]">LBS</p>
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
