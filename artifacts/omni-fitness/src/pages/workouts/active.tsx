import { useState, useEffect } from "lucide-react";
// Placeholder for live workout since we need basic functionality quickly.
// Will flesh out later.
import { Play, Square, Timer, Plus, Check } from "lucide-react";
import { Link } from "wouter";

export default function LiveWorkout() {
  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-8 flex flex-col pb-32">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-glow-primary">EMPTY WORKOUT</h1>
          <p className="text-primary font-mono text-xl">00:00</p>
        </div>
        <Link href="/workouts">
          <button className="bg-destructive/20 text-destructive px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-destructive/30">
            <Square className="w-5 h-5" fill="currentColor" />
            FINISH
          </button>
        </Link>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center">
         <div className="glass-panel p-8 rounded-3xl text-center w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-muted-foreground">Add Exercise to Start</h2>
            <button className="bg-primary text-black px-8 py-4 rounded-full font-black text-xl flex items-center justify-center gap-2 w-full hover:scale-105 transition-transform glow-primary">
              <Plus className="w-6 h-6" strokeWidth={3} />
              ADD EXERCISE
            </button>
         </div>
      </div>
    </div>
  );
}
