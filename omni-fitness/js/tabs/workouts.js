/* ----------------------------------------------------
   FINAL WORKOUT TAB MASTER SPEC
   OMNI Fitness OS - Workouts Logic Engine Controller
---------------------------------------------------- */

// ----------------------------------------------------
// STATE & CACHE
// ----------------------------------------------------
window.wkState = {
    exercises: [],
    routines: [],
    history: [],
    activeSession: null,
    currentTab: 'today'
};

window.loadWorkoutState = async function() {
    window.wkState.exercises = await apexDB.getAll('exerciseLibrary');
    window.wkState.routines = await apexDB.getAll('routines');
    window.wkState.history = await apexDB.getAll('workoutSessions');
    window.wkState.history.sort((a,b) => new Date(b.startedAt) - new Date(a.startedAt));
    
    // Check for cached active session
    window.wkState.activeSession = await apexDB.get('activeSession', 'active');
};

// ----------------------------------------------------
// UI COMPONENTS
// ----------------------------------------------------
window.stickFigure = function(type="push") {
    return `<div class="stick-stage ${type}"><div class="floor"></div><div class="stick"><span class="head"></span><span class="torso"></span><span class="arm left"></span><span class="arm right"></span><span class="leg left"></span><span class="leg right"></span><span class="load"></span></div><div class="motion-rings"><i></i><i></i><i></i></div></div>`;
};

// ----------------------------------------------------
// MAIN ROUTER
// ----------------------------------------------------
window.renderWorkouts = async function() {
    view().innerHTML = `<div class="page"><p class="muted" style="text-align:center; margin-top:40px;">Booting Workout Engine...</p></div>`;
    
    await window.loadWorkoutState();
    
    view().innerHTML = `
        <section class="page workouts-page">
            ${header("Training Engine", "Workouts")}
            
            <div class="nav-tabs" id="workoutInternalNav" style="margin-bottom: 24px;">
                <button class="nav-tab ${window.wkState.currentTab==='today'?'active':''}" data-tab="today">Today</button>
                <button class="nav-tab ${window.wkState.currentTab==='routines'?'active':''}" data-tab="routines">Routines</button>
                <button class="nav-tab ${window.wkState.currentTab==='exercises'?'active':''}" data-tab="exercises">Exercises</button>
                <button class="nav-tab ${window.wkState.currentTab==='history'?'active':''}" data-tab="history">History</button>
                <button class="nav-tab ${window.wkState.currentTab==='progress'?'active':''}" data-tab="progress">Progress</button>
            </div>
            
            <div id="wkPanelContainer"></div>
        </section>
    `;

    document.querySelectorAll('#workoutInternalNav .nav-tab').forEach(b => {
        b.onclick = () => {
            window.wkState.currentTab = b.dataset.tab;
            document.querySelectorAll('#workoutInternalNav .nav-tab').forEach(t => t.classList.remove('active'));
            b.classList.add('active');
            window.drawWorkoutPanel();
        };
    });

    window.drawWorkoutPanel();
};

window.drawWorkoutPanel = function() {
    const container = document.getElementById('wkPanelContainer');
    if (!container) return;
    
    if (window.wkState.currentTab === 'today') window.renderTabToday(container);
    if (window.wkState.currentTab === 'routines') window.renderTabRoutines(container);
    if (window.wkState.currentTab === 'exercises') window.renderTabExercises(container);
    if (window.wkState.currentTab === 'history') window.renderTabHistory(container);
    if (window.wkState.currentTab === 'progress') window.renderTabProgress(container);
};

// Global Event Listener for Reactivity
document.addEventListener('workoutUpdated', async () => {
    if (window.location.hash.startsWith('#/workouts')) {
        await window.loadWorkoutState();
        window.drawWorkoutPanel();
    }
});