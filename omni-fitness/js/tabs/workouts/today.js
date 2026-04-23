window.renderTabToday = async function(container) {
    if (window.wkState.activeSession) {
        // ACTIVE SESSION STATE
        container.innerHTML = `<p>Active session running... (TODO)</p>`;
    } else {
        // IDLE STATE
        const lastSession = window.wkState.history.length > 0 ? window.wkState.history[0] : null;
        const volumeThisWeek = 0; // TODO sum weekly volume
        
        container.innerHTML = `
            <div class="workout-hero" style="margin-bottom:24px;">
                <div class="hero-copy">
                    <p class="eyebrow">Ready to train?</p>
                    <h2>Start a new session or pick up where you left off.</h2>
                    <div class="hero-actions">
                        <button class="btn btn-teal" onclick="startEmptySession()">${icons.play} Start Empty Workout</button>
                    </div>
                </div>
                <!-- Rely on stickFigure being defined globally in workouts.js -->
                <div class="hero-figure">${typeof stickFigure !== 'undefined' ? stickFigure("squat") : ''}</div>
            </div>
            
            <div class="grid grid-2">
                <div class="card glass">
                    <p class="stat-label">This Week's Volume</p>
                    <h2>0 kg</h2>
                </div>
                <div class="card glass">
                    <p class="stat-label">Last Session</p>
                    <h2>${lastSession ? esc(lastSession.name) : "No recent workouts"}</h2>
                </div>
            </div>
        `;
    }
};

window.startEmptySession = async function() {
    window.wkState.activeSession = {
        id: 'active',
        name: 'Custom Workout',
        startedAt: new Date().toISOString(),
        exercises: [],
        notes: ''
    };
    await apexDB.put('activeSession', window.wkState.activeSession);
    document.dispatchEvent(new Event('workoutUpdated'));
};
