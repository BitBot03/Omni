/* ─────────────────────────────────────────────────────────────
   TODAY · LIVE WORKOUT PLAYER (controller + rendering)
   States:
     1) IDLE           – No active session
     2) ACTIVE         – Session in progress (HUD + logger)
     3) FINISH SUMMARY – Modal on finish

   Persistence: apexDB
   Events: dispatches "workoutsChanged" after every mutation
   ───────────────────────────────────────────────────────────── */

window.renderTabToday = async function(container) {
    const session = window.wkState && window.wkState.activeSession;

    if (!session) {
        renderIdle(container);
        document.body.classList.remove('wkt-active');
        if (window.wkRunner) { window.wkRunner.destroy(); window.wkRunner = null; }
        wkTimer && wkTimer.stop && wkTimer.stop();
        wkWake  && wkWake.release && wkWake.release();
        return;
    }

    document.body.classList.add('wkt-active');

    // Hydrate sets from store before rendering active
    await window.wkTodayHelpers.hydrateSessionSets(session);
    renderActive(container, session);

    // Acquire wake lock if user wants it
    if (window.wkSettings.get().keepScreenAwake) wkWake.acquire();

    // Start elapsed ticker (for sticky bar)
    startElapsedTicker();
};

/* ═════════════════════════════════════════════════════════════
   IDLE STATE
   ═════════════════════════════════════════════════════════════ */
function renderIdle(container) {
    const history  = (window.wkState && window.wkState.history) || [];
    const last     = history[0] || null;
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
   ACTIVE STATE — TIMER HUD + LOGGER
   ═════════════════════════════════════════════════════════════ */
function renderActive(container, session) {
    const exercises = session.exercises || [];
    const blocks    = (session.blocks || []).slice().sort((a,b) => (a.order||0) - (b.order||0));

    // Build logger HTML (same as before, reused in bottom sheet on mobile)
    const loggerHtml = buildLoggerHtml(session, blocks, exercises);

    // Init runner if needed (keep existing if session unchanged)
    if (!window.wkRunner || window.wkRunner.session !== session) {
        window.wkRunnerInit(session);
    }

    container.innerHTML = `
    <!-- ══ STICKY SESSION BAR ══════════════════════════════════ -->
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

    <!-- ══ MAIN HUD ════════════════════════════════════════════ -->
    <div class="wkt-hud" id="wktHud">

        <!-- Top stat bar (mirrors reference image: ELAPSED | SET | TIME LEFT) -->
        <div class="wkt-topbar">
            <div class="wkt-topstat">
                <span class="wkt-ts-label">ELAPSED TIME</span>
                <span class="wkt-ts-val mono" id="wktTsElapsed">00:00</span>
            </div>
            <div class="wkt-topstat center">
                <span class="wkt-ts-label">SET</span>
                <span class="wkt-ts-val mono" id="wktTsSet">—</span>
            </div>
            <div class="wkt-topstat end">
                <span class="wkt-ts-label">TIME LEFT</span>
                <span class="wkt-ts-val mono" id="wktTsLeft">—</span>
            </div>
        </div>

        <!-- Next up (shows below top bar) -->
        <div class="wkt-nextup" id="wktNextup" style="display:none">
            <span class="wkt-nextup-lbl">NEXT UP</span>
            <span class="wkt-nextup-val" id="wktNextupVal">—</span>
        </div>

        <!-- Two-column body on desktop, single col on mobile -->
        <div class="wkt-hud-body">

            <!-- LEFT / CENTER: Dual Ring + Controls -->
            <div class="wkt-ring-col">
                <div class="wkt-ring-wrap">
                    <svg class="wkt-svg" viewBox="0 0 320 320" aria-hidden="true">
                        <!-- Outer ring track (overall workout progress) -->
                        <circle class="wkt-ring-track outer-track" cx="160" cy="160" r="144"
                            stroke-dasharray="904.8 904.8" stroke-dashoffset="0"/>
                        <!-- Outer ring fill -->
                        <circle class="wkt-ring-progress outer-fill" cx="160" cy="160" r="144"
                            id="wktRingOuter"
                            stroke-dasharray="904.8 904.8" stroke-dashoffset="904.8"/>
                        <!-- Inner ring track (current interval) -->
                        <circle class="wkt-ring-track inner-track" cx="160" cy="160" r="112"
                            stroke-dasharray="703.7 703.7" stroke-dashoffset="0"/>
                        <!-- Inner ring fill -->
                        <circle class="wkt-ring-progress inner-fill" cx="160" cy="160" r="112"
                            id="wktRingInner"
                            stroke-dasharray="703.7 703.7" stroke-dashoffset="703.7"/>
                    </svg>

                    <!-- Center content overlay -->
                    <div class="wkt-ring-center">
                        <div class="wkt-phase-badge wkt-phase-badge--idle" id="wktPhaseBadge">READY</div>
                        <div class="wkt-rc-name" id="wktRcName">Ready</div>
                        <div class="wkt-rc-time" id="wktRcTime">—</div>
                        <div class="wkt-rc-sub" id="wktRcSub">Press ▶ to start</div>
                    </div>

                    <!-- Overall progress % (top-right of ring) -->
                    <div class="wkt-outer-pct" id="wktOuterPct">0%</div>
                </div>

                <!-- Playback controls -->
                <div class="wkt-controls">
                    <button class="wkt-btn-ctrl" id="wktBtnPrev"
                        title="Previous" onclick="window.wkRunner && window.wkRunner.prev()">⏮</button>
                    <button class="wkt-btn-ctrl primary" id="wktBtnPlay"
                        onclick="window.wkRunner && window.wkRunner.togglePlay()">▶</button>
                    <button class="wkt-btn-ctrl" id="wktBtnNext"
                        title="Next" onclick="window.wkRunner && window.wkRunner.next()">⏭</button>
                    <button class="wkt-btn-ctrl list-fab" id="wktBtnList"
                        title="Open logger" onclick="wktToggleSheet()">☰</button>
                </div>
            </div>

            <!-- RIGHT: Stats + Queue (desktop only) -->
            <div class="wkt-stats-col">
                <!-- 2×2 Stats grid -->
                <div class="wkt-stats-grid">
                    <div class="wkt-stat-card">
                        <span class="wkt-stat-lbl">ELAPSED</span>
                        <span class="wkt-stat-val mono" id="wktStatElapsed">0:00</span>
                    </div>
                    <div class="wkt-stat-card">
                        <span class="wkt-stat-lbl">EST. LEFT</span>
                        <span class="wkt-stat-val mono" id="wktStatLeft">—</span>
                    </div>
                    <div class="wkt-stat-card">
                        <span class="wkt-stat-lbl">SETS DONE</span>
                        <span class="wkt-stat-val" id="wktStatSets">0</span>
                    </div>
                    <div class="wkt-stat-card">
                        <span class="wkt-stat-lbl">PROGRESS</span>
                        <span class="wkt-stat-val" id="wktStatPct">0%</span>
                    </div>
                </div>

                <!-- Action buttons -->
                <div class="wkt-hud-actions">
                    <button class="wkt-action-btn skip" id="wktBtnSkipRest"
                        onclick="window.wkRunner && window.wkRunner.skipRest()" disabled>
                        Skip Rest
                    </button>
                    <button class="wkt-action-btn log" id="wktBtnLog"
                        onclick="window.wkRunner && window.wkRunner.logCurrent()" disabled>
                        Log Set
                    </button>
                </div>

                <!-- Queue preview -->
                <div class="wkt-queue">
                    <div class="wkt-queue-header">NOW / NEXT UP</div>
                    <div class="wkt-queue-list" id="wktQueueList"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- Sticky mini-HUD (visible when main HUD is scrolled away) -->
    <div class="wkt-mini-hud" id="wktMiniHud"></div>

    <!-- ══ LOGGER DIVIDER (desktop) ════════════════════════════ -->
    <div class="wkt-logger-divider">
        <span>DETAILED LOG</span>
        <span class="wkt-divider-hint">↓ scroll to log sets</span>
    </div>

    <!-- ══ DETAILED LOGGER ══════════════════════════════════════ -->
    <div id="wkTodayPlayer">
        ${loggerHtml}
    </div>

    <!-- ══ MOBILE BOTTOM SHEET (slides up over HUD) ════════════ -->
    <div class="wkt-sheet-backdrop" id="wktSheetBackdrop" onclick="wktToggleSheet()"></div>
    <div class="wkt-sheet" id="wktSheet">
        <div class="wkt-sheet-handle" onclick="wktToggleSheet()"></div>
        <div class="wkt-sheet-head">
            <span class="wkt-sheet-title">Workout Log</span>
            <div style="display:flex;gap:8px;">
                <button class="wk-today-btn green sm" onclick="wkOpenFinishSummary();wktToggleSheet();">✓ Finish</button>
                <button class="wkt-sheet-close" onclick="wktToggleSheet()">✕</button>
            </div>
        </div>
        <div class="wkt-sheet-body" id="wktSheetBody"></div>
    </div>
    `;

    // Block collapse handlers (in main logger)
    container.querySelectorAll('#wkTodayPlayer .wk-today-block-head').forEach(h => {
        h.onclick = () => h.closest('.wk-today-block').classList.toggle('collapsed');
    });

    // Attach runner to new DOM (re-connects after re-render)
    if (window.wkRunner) {
        window.wkRunner.session = session;
        window.wkRunner.sessionStart = session.startedAt
            ? new Date(session.startedAt).getTime() : Date.now();
        window.wkRunner.attachDOM();
        window.wkRunner._updateLoggerSync();
    }
}

/* ── Build logger HTML ──────────────────────────────────────── */
function buildLoggerHtml(session, blocks, exercises) {
    let blocksHtml = '';
    if (blocks.length) {
        for (const b of blocks) {
            const blockExs = exercises.filter(e => e.blockId === b.id);
            if (!blockExs.length) continue;
            blocksHtml += renderBlock(b, blockExs, session);
        }
        const orphans = exercises.filter(e => !blocks.some(b => b.id === e.blockId));
        if (orphans.length) {
            blocksHtml += renderBlock({ id:'_orphan', name:'Other', type:'normal' }, orphans, session);
        }
    } else if (exercises.length) {
        blocksHtml = renderBlock({ id:'_all', name:'Workout', type:'normal' }, exercises, session);
    } else {
        blocksHtml = `
        <div class="wk-today-empty">
            <h3>No exercises yet</h3>
            <p>Add exercises below to start logging sets.</p>
        </div>`;
    }

    return `${blocksHtml}
    <div class="wk-today-add-ex-bar">
        <button class="wk-today-btn teal" onclick="wkOpenExercisePicker()">+ Add Exercise</button>
    </div>`;
}

function renderBlock(block, exercises, session) {
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

        // Highlight if this is the runner's current step
        const runner = window.wkRunner;
        const isCurrent = runner && runner.currentStep &&
            runner.currentStep.type === 'SET' &&
            runner.currentStep.exId === ex.id &&
            runner.currentStep.setIndex === i;

        rows += renderSetRow(ex.id, i, set, tt, units, isCurrent);
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

function renderSetRow(sexId, idx, set, tt, units, isCurrent) {
    const done = !!set;
    const typeCls = done ? (set.type || 'working') : '';
    const click = `onclick="wkOpenSetModal('${esc(sexId)}', ${idx})"`;

    function cell(content) {
        return `<div class="wk-today-set-cell">${content || '<span class="wk-today-set-empty">—</span>'}</div>`;
    }
    function fmtDur(secs) {
        const s = Number(secs) || 0;
        const m = Math.floor(s/60), r = s%60;
        return `${m}:${String(r).padStart(2,'0')}`;
    }

    let cells = '';
    cells += `<div class="wk-today-set-cell">${done ? '<span class="wk-today-set-checkmark">✓</span>' : idx}</div>`;
    // NOTE: data-exercise-id + data-set-index are used by the runner's _updateLoggerSync()

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

    const doneCls  = done ? 'done is-done' : '';
    const curCls   = isCurrent ? 'wkt-current-set' : '';
    return `<div class="wk-today-set-row ${doneCls} ${typeCls} ${curCls}"
        data-exercise-id="${esc(sexId)}" data-set-index="${idx}" ${click}>${cells}</div>`;
}

/* ═════════════════════════════════════════════════════════════
   ELAPSED TICKER (sticky bar only, every second)
   ═════════════════════════════════════════════════════════════ */
let _elapsedInterval = null;
function startElapsedTicker() {
    if (_elapsedInterval) clearInterval(_elapsedInterval);
    _elapsedInterval = setInterval(() => {
        const session = window.wkState && window.wkState.activeSession;
        const node = document.getElementById('wkElapsedTime');
        if (!session || !node) { clearInterval(_elapsedInterval); _elapsedInterval = null; return; }
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
   ACTIONS — Active session
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
    document.body.classList.remove('wkt-active');
    if (_elapsedInterval) { clearInterval(_elapsedInterval); _elapsedInterval = null; }
    if (window.wkRunner) { window.wkRunner.destroy(); window.wkRunner = null; }
    wkTimer && wkTimer.stop && wkTimer.stop();
    wkWake  && wkWake.release && wkWake.release();
    await window.loadWorkoutState();
    window.wkTodayHelpers.emit('sessionCancelled');
    window.drawWorkoutPanel();
    toast('Workout cancelled');
};

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
                <p>No sets were logged yet. You can save anyway or discard.</p>
            </div>` : ''}

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

    const sets = await apexDB.getByIndex('workoutSets', 'sessionId', 'active');
    for (const s of (sets || [])) {
        s.sessionId = completed.id;
        await apexDB.put('workoutSets', s);
    }

    await apexDB.put('workoutSessions', completed);
    await apexDB.delete('activeSession', 'active');
    window.wkState.activeSession = null;
    document.body.classList.remove('wkt-active');
    if (_elapsedInterval) { clearInterval(_elapsedInterval); _elapsedInterval = null; }
    if (window.wkRunner) { window.wkRunner.destroy(); window.wkRunner = null; }
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
    const durationSec = session.startedAt
        ? Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000) : 0;
    const h = Math.floor(durationSec / 3600);
    const m = Math.floor((durationSec % 3600) / 60);
    const s = durationSec % 60;
    const duration = h > 0
        ? `${h}h ${m}m ${s}s`
        : m > 0 ? `${m}m ${s}s` : `${s}s`;
    return {
        totalSets,
        volume,
        durationSec,
        duration,
        avgRpe: rpeCount ? (rpeSum / rpeCount).toFixed(1) : null
    };
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
    if (window.location.hash && !window.location.hash.startsWith('#/workouts')) return;
    if (e.detail && (e.detail.reason === 'sessionFinished' || e.detail.reason === 'sessionCancelled')) {
        await window.loadWorkoutState();
    }
    window.drawWorkoutPanel();
});
