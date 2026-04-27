/* ─────────────────────────────────────────────────────────────
   TODAY · LIVE WORKOUT PLAYER (controller + rendering)
   States:
     1) IDLE           – No active session
     2) ACTIVE         – Session in progress (sticky bar + blocks + timer)
     3) FINISH SUMMARY – Modal on finish

   Persistence: apexDB
   Events: dispatches "workoutsChanged" after every mutation
   ───────────────────────────────────────────────────────────── */

window.renderTabToday = async function(container) {
    const session = window.wkState && window.wkState.activeSession;

    if (!session) {
        renderIdle(container);
        wkTimer && wkTimer.stop && wkTimer.stop();
        wkWake  && wkWake.release && wkWake.release();
        return;
    }

    // Hydrate sets from store before rendering active
    await window.wkTodayHelpers.hydrateSessionSets(session);
    renderActive(container, session);

    // Acquire wake lock if user wants it
    if (window.wkSettings.get().keepScreenAwake) wkWake.acquire();

    // Start (or refresh) the elapsed-timer ticker
    startElapsedTicker();
};

/* ═════════════════════════════════════════════════════════════
   IDLE STATE
   ═════════════════════════════════════════════════════════════ */
function renderIdle(container) {
    const history = (window.wkState && window.wkState.history) || [];
    const last    = history[0] || null;
    const routines = (window.wkState && window.wkState.routines) || [];

    const weekVolume = computeWeekVolume(history);

    container.innerHTML = `
    <div class="wk-today-idle">
        <div class="wk-today-hero">
            <p class="eyebrow">Ready to train?</p>
            <h2>Start your next session.</h2>
            <p class="lead">Open a routine, do a quick custom workout, or repeat your last session. Everything is logged offline and synced to your history.</p>
            <div class="wk-today-hero-actions">
                <button class="wk-today-btn primary" onclick="wkStartEmptyWorkout()">▶  Start Empty Workout</button>
                <button class="wk-today-btn ghost" onclick="wkPickRoutine()" ${routines.length ? '' : 'disabled'}>📋  From Routine</button>
                <button class="wk-today-btn ghost" onclick="wkRepeatLastWorkout()" ${last ? '' : 'disabled'}>↻  Repeat Last</button>
            </div>
        </div>

        <div class="wk-today-ctx-grid">
            <div class="wk-today-ctx-card">
                <p class="lbl">This week</p>
                <p class="val">${formatVolume(weekVolume)}</p>
                <p class="sub">total volume</p>
            </div>
            <div class="wk-today-ctx-card">
                <p class="lbl">Sessions</p>
                <p class="val">${history.length}</p>
                <p class="sub">all-time</p>
            </div>
            <div class="wk-today-ctx-card">
                <p class="lbl">Last session</p>
                <p class="val" style="font-size:16px;">${last ? esc(last.name || 'Workout') : '—'}</p>
                <p class="sub">${last ? formatLastTime(last.completedAt || last.startedAt) : 'No history yet'}</p>
            </div>
        </div>
    </div>`;
}

/* ═════════════════════════════════════════════════════════════
   ACTIVE STATE
   ═════════════════════════════════════════════════════════════ */
function renderActive(container, session) {
    const exercises = session.exercises || [];
    const blocks    = (session.blocks || []).slice().sort((a,b) => (a.order||0) - (b.order||0));
    const settings  = window.wkSettings.get();

    let blocksHtml = '';
    if (blocks.length) {
        for (const b of blocks) {
            const blockExs = exercises.filter(e => e.blockId === b.id);
            if (!blockExs.length) continue;
            blocksHtml += renderBlock(b, blockExs);
        }
        // Any exercises that don't belong to a block
        const orphans = exercises.filter(e => !blocks.some(b => b.id === e.blockId));
        if (orphans.length) {
            blocksHtml += renderBlock({ id:'_orphan', name:'Other', type:'normal' }, orphans);
        }
    } else if (exercises.length) {
        blocksHtml = renderBlock({ id:'_all', name:'Workout', type:'normal' }, exercises);
    } else {
        blocksHtml = `
        <div class="wk-today-empty">
            <h3>No exercises yet</h3>
            <p>Add exercises to start logging sets.</p>
        </div>`;
    }

    container.innerHTML = `
    <div class="wk-today-bar" id="wkSessionBar">
        <div class="wk-today-bar-left">
            <div>
                <div class="wk-today-bar-name" title="${esc(session.name)}">${esc(session.name || 'Workout')}</div>
                ${session.programName ? `<div style="font-size:11px;color:var(--muted);font-weight:700;">${esc(session.programName)}</div>` : ''}
            </div>
            <div class="wk-today-bar-time" id="wkElapsedTime">${window.wkTodayHelpers.fmtElapsed(session.startedAt)}</div>
            <div class="wk-today-bar-badges">
                <span class="wk-today-badge ${navigator.onLine ? 'online' : 'offline'}">${navigator.onLine ? 'Online' : 'Offline'}</span>
                <span class="wk-today-badge save">Autosave</span>
            </div>
        </div>
        <div class="wk-today-bar-actions">
            <button class="wk-today-btn ghost sm" onclick="wkOpenNotesModal('session')">📝 Notes</button>
            <button class="wk-today-btn danger sm" onclick="wkCancelSession()">✕ Cancel</button>
            <button class="wk-today-btn green sm" onclick="wkOpenFinishSummary()">✓ Finish</button>
        </div>
    </div>

    <div id="wkTodayPlayer">
        ${blocksHtml}
        <div class="wk-today-add-ex-bar">
            <button class="wk-today-btn teal" onclick="wkOpenExercisePicker()">+ Add Exercise</button>
        </div>
    </div>`;

    // Block collapse handlers
    container.querySelectorAll('.wk-today-block-head').forEach(h => {
        h.onclick = () => {
            const block = h.closest('.wk-today-block');
            block.classList.toggle('collapsed');
        };
    });
}

function renderBlock(block, exercises) {
    const typeClass = (block.type || 'normal').toLowerCase();
    const typeLabel = ({
        normal:'Standard', standard:'Standard',
        superset:'⚡ Superset', giant:'💥 Giant Set', circuit:'🔄 Circuit'
    })[typeClass] || 'Standard';
    const totalTargetSets = exercises.reduce((s,e) => s + (Number(e.targetSets) || 0), 0);
    const totalDoneSets   = exercises.reduce((s,e) => s + ((e.sets || []).length), 0);
    const restBlock = Number(block.restAfterBlockSeconds) || 0;

    return `
    <div class="wk-today-block" data-block-id="${esc(block.id)}">
        <div class="wk-today-block-head">
            <span class="wk-today-block-name">${esc(block.name || 'Block')}</span>
            <span class="wk-today-block-chip ${typeClass}">${typeLabel}</span>
            ${restBlock > 0 ? `<span class="wk-today-block-chip standard">${restBlock}s round rest</span>` : ''}
            <span class="wk-today-block-summary">${exercises.length} ex · ${totalDoneSets}/${totalTargetSets} sets</span>
            <span class="wk-today-block-toggle">▾</span>
        </div>
        <div class="wk-today-block-body">
            ${exercises.map(ex => renderExercise(ex)).join('')}
        </div>
    </div>`;
}

function renderExercise(ex) {
    const tt = window.wkTodayHelpers.normalizeTT(ex.trackingTypeSnapshot || ex.trackingType);
    const target = Number(ex.targetSets) || 3;
    const completed = (ex.sets || []).length;
    const allDone = completed >= target;
    const progress = ex.progressionRule && ex.progressionRule !== 'none' ? ex.progressionRule : null;
    const repStr = (ex.repMin && ex.repMax) ? `${ex.repMin}–${ex.repMax}` : (ex.repMin || ex.repMax || '—');
    const settings = window.wkSettings.get();

    const meta = [];
    if (tt === 'weight_reps' || tt === 'bodyweight_reps' || tt === 'assisted_weight_reps') {
        meta.push(`${target} sets × ${repStr} reps`);
    } else if (tt === 'time') {
        meta.push(`${target} sets × time`);
    } else if (tt === 'distance_time') {
        meta.push(`${target} sets · distance/time`);
    }
    if (ex.restSeconds) meta.push(`${ex.restSeconds}s rest`);
    if (ex.tempo) meta.push(`tempo ${ex.tempo}`);
    if (ex.targetWeight) meta.push(`@ ${ex.targetWeight}${settings.units}`);

    return `
    <div class="wk-today-ex ${allDone ? 'complete' : ''}" data-ex-id="${esc(ex.id)}">
        <div class="wk-today-ex-head">
            <div style="min-width:0;">
                <p class="wk-today-ex-name">${esc(ex.exerciseName || ex.exerciseNameSnapshot || ex.exerciseId)}</p>
                <div class="wk-today-ex-meta">
                    ${meta.map(m => `<span>${esc(m)}</span>`).join('<span class="dot">•</span>')}
                    ${progress ? `<span class="wk-today-ex-prog">${esc(progress)}</span>` : ''}
                </div>
                ${ex.notes ? `<div style="font-size:12px;color:var(--soft);margin-top:6px;font-style:italic;">"${esc(ex.notes)}"</div>` : ''}
            </div>
            <div class="wk-today-ex-actions">
                <button class="wk-today-ex-iconbtn" title="Notes" onclick="wkOpenNotesModal('exercise','${esc(ex.id)}')">📝</button>
                <button class="wk-today-ex-iconbtn" title="Remove" onclick="wkRemoveExerciseFromSession('${esc(ex.id)}')">×</button>
            </div>
        </div>
        ${renderSetsTable(ex, tt, target)}
        <div class="wk-today-ex-foot">
            <button class="wk-today-btn ghost sm" onclick="wkAddExtraSet('${esc(ex.id)}')">+ Add Set</button>
        </div>
    </div>`;
}

function renderSetsTable(ex, tt, target) {
    const sets = (ex.sets || []).slice().sort((a,b) => (a.setIndex||0) - (b.setIndex||0));
    const settings = window.wkSettings.get();
    const units = settings.units;

    const headers = setColumnHeaders(tt, units);
    const totalRows = Math.max(target, ...sets.map(s => s.setIndex || 0));

    let rows = '';
    for (let i = 1; i <= totalRows; i++) {
        const set = sets.find(s => s.setIndex === i);
        rows += renderSetRow(ex.id, i, set, tt, units);
    }

    return `
    <div class="wk-today-sets" style="grid-template-columns:${headers.cols};">
        <div class="wk-today-sets-head">
            ${headers.labels.map(l => `<div>${l}</div>`).join('')}
        </div>
        ${rows}
    </div>`;
}

function setColumnHeaders(tt, units) {
    if (tt === 'time') return { cols:'36px 1fr 60px 50px', labels:['#','Time','RPE','✓'] };
    if (tt === 'distance_time') return { cols:'36px 1fr 1fr 60px 50px', labels:['#','Distance','Time','RPE','✓'] };
    if (tt === 'bodyweight_reps') return { cols:'36px 1fr 1fr 60px 50px', labels:['#','Reps',`+${units}`,'RPE','✓'] };
    if (tt === 'assisted_weight_reps') return { cols:'36px 1fr 1fr 60px 50px', labels:['#','Reps',`-${units}`,'RPE','✓'] };
    return { cols:'36px 1fr 1fr 60px 50px', labels:['#',units,'Reps','RPE','✓'] };
}

function renderSetRow(sexId, idx, set, tt, units) {
    const done = !!set;
    const typeCls = done ? (set.type || 'working') : '';
    const click = `onclick="wkOpenSetModal('${esc(sexId)}', ${idx})"`;

    function cell(content, opts = {}) {
        return `<div class="wk-today-set-cell">${content || '<span class="wk-today-set-empty">—</span>'}</div>`;
    }
    function fmtDur(secs) {
        const s = Number(secs) || 0;
        const m = Math.floor(s/60), r = s%60;
        return `${m}:${String(r).padStart(2,'0')}`;
    }

    let cells = '';
    cells += `<div class="wk-today-set-cell">${done ? '<span class="wk-today-set-checkmark">✓</span>' : idx}</div>`;

    if (tt === 'time') {
        cells += cell(done ? fmtDur(set.durationSec) : '');
    } else if (tt === 'distance_time') {
        cells += cell(done ? `${set.distance || 0} ${esc(set.distanceUnit || 'km')}` : '');
        cells += cell(done ? fmtDur(set.durationSec) : '');
    } else if (tt === 'bodyweight_reps') {
        cells += cell(done ? `${set.reps || 0}` : '');
        cells += cell(done ? `${set.addedWeight || 0}` : '');
    } else if (tt === 'assisted_weight_reps') {
        cells += cell(done ? `${set.reps || 0}` : '');
        cells += cell(done ? `${set.weight || 0}` : '');
    } else {
        cells += cell(done ? `${set.weight || 0}` : '');
        cells += cell(done ? `${set.reps || 0}` : '');
    }

    cells += `<div class="wk-today-set-cell">${done && set.rpe != null ? set.rpe : '<span class="wk-today-set-empty">—</span>'}</div>`;
    cells += `<div class="wk-today-set-cell">${done ? '<span class="wk-today-set-checkmark">✓</span>' : '<span class="wk-today-set-empty">tap</span>'}</div>`;

    return `<div class="wk-today-set-row ${done ? 'done' : ''} ${typeCls}" ${click}>${cells}</div>`;
}

/* ═════════════════════════════════════════════════════════════
   ELAPSED TIMER (every second, no full re-render)
   ═════════════════════════════════════════════════════════════ */
let _elapsedInterval = null;
function startElapsedTicker() {
    if (_elapsedInterval) clearInterval(_elapsedInterval);
    _elapsedInterval = setInterval(() => {
        const session = window.wkState && window.wkState.activeSession;
        const node = document.getElementById('wkElapsedTime');
        if (!session || !node) {
            clearInterval(_elapsedInterval); _elapsedInterval = null;
            return;
        }
        node.textContent = window.wkTodayHelpers.fmtElapsed(session.startedAt);
    }, 1000);
}

/* ═════════════════════════════════════════════════════════════
   ACTIONS — Idle
   ═════════════════════════════════════════════════════════════ */
window.wkStartEmptyWorkout = async function() {
    if (window.wkState.activeSession) {
        if (!confirm('You have an active workout. Replace it with a new empty workout?')) return;
        await apexDB.delete('activeSession', 'active');
    }
    const session = {
        id: 'active',
        name: 'Quick Start',
        startedAt: new Date().toISOString(),
        status: 'active',
        blocks: [],
        exercises: [],
        notes: ''
    };
    await apexDB.put('activeSession', session);
    window.wkState.activeSession = session;
    window.wkTodayHelpers.emit('sessionStarted');
    window.drawWorkoutPanel();
    toast('Quick workout started — add exercises');
    setTimeout(() => window.wkOpenExercisePicker(), 250);
};

window.wkPickRoutine = function() {
    // Switch to Routines tab
    if (window.wkState) window.wkState.currentTab = 'routines';
    document.querySelectorAll('#workoutInternalNav .nav-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === 'routines');
    });
    window.drawWorkoutPanel();
};

window.wkRepeatLastWorkout = async function() {
    const history = (window.wkState && window.wkState.history) || [];
    const last = history[0];
    if (!last) return;

    if (window.wkState.activeSession) {
        if (!confirm('Replace your active workout with a copy of the last one?')) return;
        await apexDB.delete('activeSession', 'active');
    }

    const cloned = {
        id: 'active',
        name: last.name || 'Workout',
        routineId: last.routineId || null,
        programId: last.programId || null,
        programName: last.programName || null,
        startedAt: new Date().toISOString(),
        status: 'active',
        blocks: JSON.parse(JSON.stringify(last.blocks || [])),
        exercises: (last.exercises || []).map(e => {
            const c = JSON.parse(JSON.stringify(e));
            c.id = 'sex_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,5);
            c.sets = [];
            return c;
        }),
        notes: ''
    };
    await apexDB.put('activeSession', cloned);
    window.wkState.activeSession = cloned;
    window.wkTodayHelpers.emit('sessionStarted');
    window.drawWorkoutPanel();
    toast(`Repeating: ${cloned.name}`);
};

/* ═════════════════════════════════════════════════════════════
   ACTIONS — Active
   ═════════════════════════════════════════════════════════════ */
window.wkCancelSession = async function() {
    if (!confirm('Cancel this workout? All logged sets will be discarded.')) return;
    const session = window.wkState.activeSession;
    if (session) {
        const sets = await apexDB.getByIndex('workoutSets', 'sessionId', session.id);
        for (const s of (sets || [])) await apexDB.delete('workoutSets', s.id);
    }
    await apexDB.delete('activeSession', 'active');
    window.wkState.activeSession = null;
    if (_elapsedInterval) { clearInterval(_elapsedInterval); _elapsedInterval = null; }
    wkTimer && wkTimer.stop && wkTimer.stop();
    wkWake  && wkWake.release && wkWake.release();
    await window.loadWorkoutState();
    window.wkTodayHelpers.emit('sessionCancelled');
    window.drawWorkoutPanel();
    toast('Workout cancelled');
};

/* Backward-compat aliases (kept so older buttons keep working) */
window.todayCancelSession = window.wkCancelSession;
window.startEmptySession  = window.wkStartEmptyWorkout;

/* ═════════════════════════════════════════════════════════════
   FINISH SUMMARY
   ═════════════════════════════════════════════════════════════ */
window.wkOpenFinishSummary = async function() {
    const session = window.wkState && window.wkState.activeSession;
    if (!session) return;

    await window.wkTodayHelpers.hydrateSessionSets(session);
    const stats = computeSessionStats(session);
    const settings = window.wkSettings.get();

    const overlay = document.createElement('div');
    overlay.className = 'wk-today-modal-overlay';
    overlay.innerHTML = `
    <div class="wk-today-modal wk-today-summary" onclick="event.stopPropagation()">
        <div class="wk-today-modal-head">
            <div>
                <p class="wk-today-modal-title">Finish Workout</p>
                <p class="wk-today-modal-sub">${esc(session.name)} · review &amp; save</p>
            </div>
            <button class="wk-today-modal-close" type="button" id="wkFinClose">×</button>
        </div>

        <div class="wk-today-summary-stats">
            <div class="wk-today-summary-stat"><b>${stats.duration}</b><span>Duration</span></div>
            <div class="wk-today-summary-stat"><b>${stats.totalSets}</b><span>Sets logged</span></div>
            <div class="wk-today-summary-stat"><b>${formatVolume(stats.volume)}</b><span>Total volume</span></div>
            <div class="wk-today-summary-stat"><b>${settings.enableRPE ? (stats.avgRpe || '—') : '—'}</b><span>Avg RPE</span></div>
        </div>

        ${stats.totalSets === 0 ? `
            <div class="wk-today-empty" style="margin-bottom:14px;">
                <p>No sets were logged yet. You can save anyway as a "logged session" or discard.</p>
            </div>` : ''
        }

        <div class="wk-today-modal-foot">
            <button class="wk-today-btn danger" type="button" id="wkFinDiscard">Discard</button>
            <button class="wk-today-btn ghost" type="button" id="wkFinBack">Back</button>
            <button class="wk-today-btn primary" type="button" id="wkFinSave">Save &amp; Close</button>
        </div>
    </div>`;
    document.body.appendChild(overlay);

    function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    overlay.querySelector('#wkFinClose').onclick = close;
    overlay.querySelector('#wkFinBack').onclick = close;
    overlay.querySelector('#wkFinDiscard').onclick = async () => { close(); await window.wkCancelSession(); };
    overlay.querySelector('#wkFinSave').onclick = async () => { close(); await window.wkSaveAndCloseSession(stats); };
};

window.wkSaveAndCloseSession = async function(precomputedStats) {
    const session = window.wkState && window.wkState.activeSession;
    if (!session) return;
    const stats = precomputedStats || computeSessionStats(session);

    const completed = {
        ...session,
        id: 'wks_' + Date.now().toString(36),
        status: 'completed',
        completedAt: new Date().toISOString(),
        totals: {
            durationSec: stats.durationSec,
            totalSets: stats.totalSets,
            totalVolume: stats.volume,
            avgRpe: stats.avgRpe || null
        }
    };

    // Re-link sets (sessionId stays as 'active' originally; relink to the new completed id)
    const sets = await apexDB.getByIndex('workoutSets', 'sessionId', 'active');
    for (const s of (sets || [])) {
        s.sessionId = completed.id;
        await apexDB.put('workoutSets', s);
    }

    await apexDB.put('workoutSessions', completed);
    await apexDB.delete('activeSession', 'active');
    window.wkState.activeSession = null;
    if (_elapsedInterval) { clearInterval(_elapsedInterval); _elapsedInterval = null; }
    wkTimer && wkTimer.stop && wkTimer.stop();
    wkWake  && wkWake.release && wkWake.release();
    await window.loadWorkoutState();
    window.wkTodayHelpers.emit('sessionFinished');
    window.drawWorkoutPanel();
    toast(`Workout saved · ${stats.totalSets} sets · ${formatVolume(stats.volume)}`);
};

/* ═════════════════════════════════════════════════════════════
   STATS
   ═════════════════════════════════════════════════════════════ */
function computeSessionStats(session) {
    let totalSets = 0, volume = 0, rpeSum = 0, rpeCount = 0;
    for (const ex of (session.exercises || [])) {
        for (const s of (ex.sets || [])) {
            totalSets++;
            volume += window.wkTodayHelpers.setVolume(s);
            if (s.rpe != null && !isNaN(s.rpe)) { rpeSum += Number(s.rpe); rpeCount++; }
        }
    }
    const startedAt = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const durationSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const h = Math.floor(durationSec/3600), m = Math.floor((durationSec%3600)/60);
    const duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
    const avgRpe = rpeCount ? (Math.round((rpeSum/rpeCount)*10)/10) : null;
    return { totalSets, volume, durationSec, duration, avgRpe };
}

function computeWeekVolume(history) {
    const start = new Date();
    start.setHours(0,0,0,0);
    start.setDate(start.getDate() - start.getDay());
    let v = 0;
    for (const s of (history || [])) {
        const t = s.completedAt || s.startedAt;
        if (!t) continue;
        if (new Date(t).getTime() >= start.getTime()) {
            v += (s.totals && s.totals.totalVolume) || 0;
        }
    }
    return v;
}

function formatVolume(v) {
    const u = window.wkSettings.get().units;
    if (!v) return `0 ${u}`;
    if (v >= 10000) return `${(v/1000).toFixed(1)}k ${u}`;
    return `${Math.round(v).toLocaleString()} ${u}`;
}

function formatLastTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString();
}

/* ═════════════════════════════════════════════════════════════
   REACTIVITY — re-render on workoutsChanged
   ═════════════════════════════════════════════════════════════ */
document.addEventListener('workoutsChanged', async (e) => {
    if (!window.wkState) return;
    if (window.wkState.currentTab !== 'today') return;
    // Lightweight: do not reload everything if reason is trivial; full panel redraw is cheap
    if (window.location.hash && !window.location.hash.startsWith('#/workouts')) return;
    // Refresh history reference if needed (after finish)
    if (e.detail && (e.detail.reason === 'sessionFinished' || e.detail.reason === 'sessionCancelled')) {
        await window.loadWorkoutState();
    }
    window.drawWorkoutPanel();
});
