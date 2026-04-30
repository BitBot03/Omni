/* ─────────────────────────────────────────────────────────────
   TODAY · WORKOUT RUNNER (step queue + HUD engine)
   Single source of truth for the live workout player.

   Phases:
     IDLE         – session not started yet
     WORK_TIMED   – timed work step (timer counting down)
     WORK_MANUAL  – manual work step (stopwatch counting up)
     RESTING      – rest interval (timer counting down)
     AWAIT_LOG    – timed work finished, waiting for user to log set
     PAUSED       – any phase paused by user
     COMPLETE     – queue exhausted

   Public API (window.wkRunner):
     .start(), .pause(), .togglePlay()
     .next()        – context-aware ⏩
     .prev()        – step back one
     .skipRest()    – end rest immediately
     .logCurrent()  – open the set-log modal for current SET
     .attachDOM(), .destroy()
   ───────────────────────────────────────────────────────────── */

const WK_PHASE = {
    IDLE:        'idle',
    WORK_TIMED:  'work_timed',
    WORK_MANUAL: 'work_manual',
    RESTING:     'resting',
    AWAIT_LOG:   'await_log',
    PAUSED:      'paused',
    COMPLETE:    'complete'
};

class WkRunner {
    constructor(session) {
        this.session      = session;
        this.sessionStart = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
        this.steps        = this._buildQueue(session);

        // State machine
        this.phase        = WK_PHASE.IDLE;
        this.prevPhase    = WK_PHASE.IDLE; // remember pre-pause phase
        this.currentIndex = 0;
        this.endAt        = 0;             // ms when current timed step ends
        this.stepStartAt  = Date.now();    // ms when current step started
        this.pauseRemain  = 0;             // remaining sec when paused (timed steps)
        this.skippedSteps = new Set();

        this._rafId       = null;
        this._tickBound   = this._tick.bind(this);
        this._onChanged   = this._onChanged.bind(this);

        // Resume from persisted runner state
        this._restoreFromSession();

        document.addEventListener('workoutsChanged', this._onChanged);
    }

    /* ════════ STEP QUEUE BUILDER ════════════════════════════ */
    _buildQueue(session) {
        const steps     = [];
        const defRest   = 90;
        const exercises = session.exercises || [];
        const blocks    = (session.blocks || []).slice().sort((a,b) => (a.order||0)-(b.order||0));

        const makeSetStep = (ex, i, totalSets, block, type) => {
            const tt = this._normTT(ex.trackingTypeSnapshot || ex.trackingType);
            const isTimed = this._isTimedTracking(tt, ex);
            const timerSec = isTimed ? this._resolveTimerSec(tt, ex) : 0;
            return {
                type: 'SET',
                exId: ex.id,
                exName: ex.exerciseName || ex.exerciseNameSnapshot || 'Exercise',
                color: ex.color || (window.EXERCISE_PALETTE && window.EXERCISE_PALETTE[0]) || '#FF3B30',
                setIndex: i,
                totalSets,
                blockId: block.id,
                blockName: block.name || 'Block',
                blockType: type,
                trackingType: tt,
                isTimed,
                timerSec,
                repMin: ex.repMin || 0,
                repMax: ex.repMax || 0,
                tempo: ex.tempo || null
            };
        };

        const processBlock = (block, exs) => {
            const type = (block.type || 'normal').toLowerCase();
            const isGroup = (type === 'superset' || type === 'giant' || type === 'circuit');

            if (!isGroup) {
                for (const ex of exs) {
                    const totalSets = Number(ex.targetSets) || 3;
                    for (let i = 1; i <= totalSets; i++) {
                        steps.push(makeSetStep(ex, i, totalSets, block, type));
                        if (i < totalSets) {
                            const rest = Number(ex.restSeconds) || defRest;
                            steps.push({ type:'REST', durationSec: rest, label: `Rest · ${ex.exerciseName || 'Next set'}`, color: window.REST_COLOR || '#00FFC4' });
                        }
                    }
                }
            } else {
                // Round-based for superset/giant/circuit
                const maxRounds = Math.max(...exs.map(e => Number(e.targetSets)||3), 1);
                const blockRest = Number(block.restAfterBlockSeconds) || defRest;
                for (let round = 1; round <= maxRounds; round++) {
                    const roundExs = exs.filter(e => round <= (Number(e.targetSets)||3));
                    for (const ex of roundExs) {
                        steps.push(makeSetStep(ex, round, Number(ex.targetSets)||3, block, type));
                    }
                    if (round < maxRounds && blockRest > 0) {
                        steps.push({ type:'REST', durationSec: blockRest, label: `${block.name||'Round'} · round ${round} rest`, color: window.REST_COLOR || '#00FFC4' });
                    }
                }
            }
        };

        if (blocks.length) {
            for (const block of blocks) {
                const exs = exercises.filter(e => e.blockId === block.id);
                if (exs.length) processBlock(block, exs);
            }
            const orphans = exercises.filter(e => !blocks.some(b => b.id === e.blockId));
            if (orphans.length) processBlock({ id:'_orphan', name:'Workout', type:'normal' }, orphans);
        } else if (exercises.length) {
            processBlock({ id:'_all', name:'Workout', type:'normal' }, exercises);
        }

        return steps;
    }

    _normTT(raw) {
        const s = String(raw||'Weight + Reps').toLowerCase();
        if (s.includes('assist')) return 'assisted_weight_reps';
        if (s.includes('body'))   return 'bodyweight_reps';
        if (s.includes('distance')) return 'distance_time';
        if (s === 'weight_time' || (s.includes('weight') && s.includes('time'))) return 'weight_time';
        if (s === 'time' || (s.includes('time') && !s.includes('reps'))) return 'time';
        return 'weight_reps';
    }

    /* True if this set step should run a countdown timer */
    _isTimedTracking(tt, ex) {
        // Explicit per-exercise timer mode wins
        const mode = String(ex.setTimerMode || '').toLowerCase();
        if (mode === 'fixed_time' || mode === 'rep_pace') return true;
        if (mode === 'manual' || mode === 'none') return false;
        // Implicit by tracking type
        return tt === 'time' || tt === 'weight_time' || tt === 'distance_time';
    }

    /* Resolve fixed timer duration in seconds for a SET step */
    _resolveTimerSec(tt, ex) {
        const explicit = Number(ex.setTimeSec);
        if (explicit > 0) return explicit;
        // For 'time' tracking, repMin/repMax are interpreted as seconds
        if (tt === 'time') {
            const v = Number(ex.repMax || ex.repMin) || 0;
            if (v > 0) return v;
        }
        // rep_pace: use tempo (sum of digits) × repMax
        const mode = String(ex.setTimerMode || '').toLowerCase();
        if (mode === 'rep_pace' && ex.tempo) {
            const t = String(ex.tempo).split(/[^0-9.]/).filter(Boolean).map(Number);
            const perRep = t.reduce((s,n) => s + (Number(n)||0), 0);
            const reps = Number(ex.repMax || ex.repMin) || 8;
            if (perRep > 0) return Math.round(perRep * reps);
        }
        // Reasonable default for distance_time / weight_time without explicit timer
        if (tt === 'weight_time' || tt === 'distance_time') return 30;
        return 0;
    }

    /* ════════ PROPERTIES ════════════════════════════════════ */
    get currentStep() { return this.steps[this.currentIndex] || null; }
    get totalSteps()  { return this.steps.length; }

    get isRunning() {
        return this.phase !== WK_PHASE.IDLE
            && this.phase !== WK_PHASE.PAUSED
            && this.phase !== WK_PHASE.COMPLETE;
    }
    get isPaused() { return this.phase === WK_PHASE.PAUSED; }

    /* Map internal phase to data-phase used by CSS theme */
    get cssPhase() {
        switch (this.phase) {
            case WK_PHASE.IDLE:        return 'idle';
            case WK_PHASE.RESTING:     return 'rest';
            case WK_PHASE.PAUSED:      return 'paused';
            case WK_PHASE.COMPLETE:    return 'complete';
            case WK_PHASE.AWAIT_LOG:   return 'work';   // styled like work, with AWAIT badge
            default:                   return 'work';
        }
    }

    /* ════════ TIMING / DURATION HELPERS ═════════════════════ */
    /* Estimated duration of any step (sec). Manual sets get a default 45s estimate. */
    _stepEstSec(step) {
        if (!step) return 0;
        if (step.type === 'REST') return Number(step.durationSec) || 0;
        if (step.timerSec > 0)    return step.timerSec;
        return 45; // manual set estimate
    }

    /* Real countdown duration for a step (0 means open-ended / manual) */
    _stepCountdownSec(step) {
        if (!step) return 0;
        if (step.type === 'REST') return Number(step.durationSec) || 0;
        if (step.type === 'SET' && step.timerSec > 0) return step.timerSec;
        return 0;
    }

    /* Whether outer ring should be sized by time vs equal steps */
    get useTimeMode() {
        if (!this.steps.length) return false;
        const known = this.steps.filter(s => this._stepEstSec(s) > 0).length;
        return (known / this.steps.length) >= 0.6;
    }

    /* Total estimated session seconds (for outer ring time mode + time-left) */
    get totalEstimatedSec() {
        return this.steps.reduce((sum, s) => sum + this._stepEstSec(s), 0);
    }

    /* Sum of step est durations BEFORE current index */
    _completedEstSec() {
        let s = 0;
        for (let i = 0; i < Math.min(this.currentIndex, this.steps.length); i++) {
            s += this._stepEstSec(this.steps[i]);
        }
        return s;
    }

    /* Fraction of CURRENT step completed (0..1) */
    _currentStepFrac() {
        const step = this.currentStep;
        if (!step) return 0;
        if (this.phase === WK_PHASE.COMPLETE) return 1;

        const cd = this._stepCountdownSec(step);
        const now = Date.now();
        if (cd > 0) {
            // Timed (REST or WORK_TIMED) — fill as time elapses
            if (this.phase === WK_PHASE.AWAIT_LOG) return 1;
            if (this.phase === WK_PHASE.PAUSED) {
                const used = cd - this.pauseRemain;
                return Math.max(0, Math.min(1, used / cd));
            }
            if (this.endAt > 0) {
                const rem = Math.max(0, (this.endAt - now) / 1000);
                return Math.max(0, Math.min(1, 1 - rem / cd));
            }
            return 0;
        }
        // Manual SET: visualize against estimate, capped
        if (step.type === 'SET' && this.phase === WK_PHASE.AWAIT_LOG) return 1;
        const elapsed = (now - this.stepStartAt) / 1000;
        const est = this._stepEstSec(step);
        return Math.max(0, Math.min(0.98, est > 0 ? elapsed / est : 0));
    }

    /* Outer-ring overall fraction (0..1) including partial current step */
    get overallFraction() {
        if (!this.totalSteps) return 0;
        if (this.phase === WK_PHASE.COMPLETE) return 1;

        if (this.useTimeMode) {
            const total = this.totalEstimatedSec;
            if (total <= 0) return 0;
            const partial = this._currentStepFrac() * this._stepEstSec(this.currentStep);
            return Math.min(1, (this._completedEstSec() + partial) / total);
        }
        // Step mode: each step is equal weight
        return Math.min(1, (this.currentIndex + this._currentStepFrac()) / this.totalSteps);
    }

    /* Estimated seconds remaining in the session */
    get estimatedRemainingSec() {
        if (this.phase === WK_PHASE.COMPLETE) return 0;
        let rem = 0;
        for (let i = this.currentIndex + 1; i < this.steps.length; i++) {
            rem += this._stepEstSec(this.steps[i]);
        }
        // current step remaining
        const step = this.currentStep;
        if (step) {
            const cd = this._stepCountdownSec(step);
            if (cd > 0) {
                if (this.phase === WK_PHASE.PAUSED) rem += this.pauseRemain;
                else if (this.endAt > 0) rem += Math.max(0, (this.endAt - Date.now()) / 1000);
                else rem += cd;
            } else {
                rem += this._stepEstSec(step) * (1 - this._currentStepFrac());
            }
        }
        return Math.max(0, Math.round(rem));
    }

    /* ════════ PLAYBACK CONTROLS ═════════════════════════════ */
    start() {
        if (!this.totalSteps) return;
        if (this.phase === WK_PHASE.COMPLETE) return;

        // Resume from pause: restore prevPhase + endAt
        if (this.phase === WK_PHASE.PAUSED) {
            this.phase = this.prevPhase || this._phaseForCurrentStep();
            const cd = this._stepCountdownSec(this.currentStep);
            if (cd > 0 && this.pauseRemain > 0) {
                this.endAt = Date.now() + this.pauseRemain * 1000;
            }
            this.pauseRemain = 0;
        } else {
            // Fresh start of current step
            this.phase = this._phaseForCurrentStep();
            this.stepStartAt = Date.now();
            const cd = this._stepCountdownSec(this.currentStep);
            this.endAt = cd > 0 ? Date.now() + cd * 1000 : 0;
        }

        if (!this._rafId) this._rafId = requestAnimationFrame(this._tickBound);
        this._persistRunnerState();
        this.updateHUD();
    }

    pause() {
        if (this.phase === WK_PHASE.PAUSED || this.phase === WK_PHASE.IDLE
            || this.phase === WK_PHASE.COMPLETE) return;
        this.prevPhase = this.phase;
        const cd = this._stepCountdownSec(this.currentStep);
        if (cd > 0 && this.endAt > 0) {
            this.pauseRemain = Math.max(0, (this.endAt - Date.now()) / 1000);
        }
        this.phase = WK_PHASE.PAUSED;
        if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
        this._persistRunnerState();
        this.updateHUD();
    }

    togglePlay() {
        if (this.isRunning) this.pause();
        else this.start();
    }

    /* Context-aware ⏩  next button */
    next() {
        const step = this.currentStep;
        if (!step) return;

        // During WORK steps: prefer opening the log modal
        if (step.type === 'SET'
            && (this.phase === WK_PHASE.WORK_TIMED
                || this.phase === WK_PHASE.WORK_MANUAL
                || this.phase === WK_PHASE.IDLE
                || this.phase === WK_PHASE.PAUSED)) {
            this.logCurrent();
            return;
        }

        // AWAIT_LOG / RESTING / COMPLETE: skip forward
        if (step.type === 'SET' && this.phase === WK_PHASE.AWAIT_LOG) {
            // Mark as skipped if not logged
            const session = window.wkState && window.wkState.activeSession;
            const ex = session && (session.exercises||[]).find(e => e.id === step.exId);
            const isLogged = ex && (ex.sets||[]).some(s => s.setIndex === step.setIndex);
            if (!isLogged) this.skippedSteps.add(this.currentIndex);
        }
        this._advance();
        this._updateLoggerSync();
    }

    prev() {
        if (this.currentIndex <= 0) return;
        this.currentIndex--;
        this.stepStartAt = Date.now();
        this.phase = this._phaseForCurrentStep();
        const cd = this._stepCountdownSec(this.currentStep);
        this.endAt = cd > 0 ? Date.now() + cd * 1000 : 0;
        this.pauseRemain = 0;
        if (this.isRunning && !this._rafId) this._rafId = requestAnimationFrame(this._tickBound);
        this._persistRunnerState();
        this.updateHUD();
    }

    skipRest() {
        const step = this.currentStep;
        if (!step || step.type !== 'REST') return;
        this._advance();
    }

    logCurrent() {
        const step = this.currentStep;
        if (!step || step.type !== 'SET') return;
        if (typeof window.wkOpenSetModal === 'function') {
            window.wkOpenSetModal(step.exId, step.setIndex);
        }
    }

    stop() {
        if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    }

    destroy() {
        this.stop();
        document.removeEventListener('workoutsChanged', this._onChanged);
        if (this._hudObserver) { this._hudObserver.disconnect(); this._hudObserver = null; }
    }

    /* ════════ INTERNALS ═════════════════════════════════════ */
    _phaseForCurrentStep() {
        const step = this.currentStep;
        if (!step) return this.totalSteps > 0 ? WK_PHASE.COMPLETE : WK_PHASE.IDLE;
        if (step.type === 'REST') return WK_PHASE.RESTING;
        return step.timerSec > 0 ? WK_PHASE.WORK_TIMED : WK_PHASE.WORK_MANUAL;
    }

    _tick() {
        if (!this.isRunning) { this._rafId = null; return; }
        const step = this.currentStep;
        if (step) {
            const cd = this._stepCountdownSec(step);
            if (cd > 0 && this.endAt > 0) {
                const rem = (this.endAt - Date.now()) / 1000;
                if (rem <= 0) { this._onCountdownDone(step); return; }
            }
        }
        this.updateHUD();
        this._rafId = requestAnimationFrame(this._tickBound);
    }

    _onCountdownDone(step) {
        if (step.type === 'REST') {
            this._vibrate([100, 60, 180]);
            this._beep(660, 0.06, 0.15);
            if (typeof toast === 'function') toast('Rest done — go!');
            this._advance();
            return;
        }
        // SET: timed work finished → AWAIT_LOG
        this._vibrate([120]);
        this._beep(880, 0.06, 0.12);
        if (typeof toast === 'function') toast('Set timer done — log it!');
        this.phase = WK_PHASE.AWAIT_LOG;
        this.endAt = 0;
        if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
        this._persistRunnerState();
        this.updateHUD();
        // If user enabled auto-rest, opening modal save will trigger _syncStepsToLogs which advances
    }

    _advance() {
        if (this.currentIndex >= this.totalSteps - 1) {
            this.currentIndex = this.totalSteps;
            this.phase = WK_PHASE.COMPLETE;
            this.endAt = 0;
            if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
            this._persistRunnerState();
            this.updateHUD();
            if (typeof toast === 'function') toast('All planned sets done! Great work 💪');
            return;
        }
        const wasRunning = this.isRunning;
        this.currentIndex++;
        this.stepStartAt = Date.now();
        this.pauseRemain = 0;
        this.phase = wasRunning ? this._phaseForCurrentStep() : WK_PHASE.PAUSED;

        const step = this.currentStep;
        const cd = this._stepCountdownSec(step);
        if (wasRunning) {
            this.endAt = cd > 0 ? Date.now() + cd * 1000 : 0;
            if (!this._rafId) this._rafId = requestAnimationFrame(this._tickBound);
        } else {
            this.prevPhase = this._phaseForCurrentStep();
            if (cd > 0) this.pauseRemain = cd;
            this.endAt = 0;
        }
        this._persistRunnerState();
        this.updateHUD();
    }

    _onChanged(e) {
        const reason = e && e.detail && e.detail.reason;
        if (reason === 'exerciseAdded' || reason === 'exerciseRemoved') {
            // Rebuild queue, keep cursor as best we can
            const oldIdx = this.currentIndex;
            this.steps = this._buildQueue(this.session);
            this.currentIndex = Math.min(oldIdx, Math.max(0, this.steps.length - 1));
            this._renderOuterSegments();
            this._persistRunnerState();
            this.updateHUD();
            return;
        }
        if (reason !== 'setLogged' && reason !== 'setUpdated') return;
        this._syncStepsToLogs();
        this._updateLoggerSync();
        this.updateHUD();
    }

    _syncStepsToLogs() {
        const session = window.wkState && window.wkState.activeSession;
        if (!session) return;
        const step = this.currentStep;
        if (!step || step.type !== 'SET') return;
        const ex = (session.exercises||[]).find(e => e.id === step.exId);
        if (!ex) return;
        const hasLogged = (ex.sets||[]).some(s => s.setIndex === step.setIndex);
        if (!hasLogged) return;

        // From AWAIT_LOG or WORK_*, advance to next step (likely REST).
        // If autoRestTimer is on and we were running, keep running through rest.
        const wasRunningBefore = this.phase !== WK_PHASE.PAUSED && this.phase !== WK_PHASE.IDLE;
        const auto = window.wkSettings && window.wkSettings.get().autoRestTimer;

        // Advance, then auto-start the new step if appropriate
        this._advance();
        if (auto && wasRunningBefore && !this.isRunning && this.phase !== WK_PHASE.COMPLETE) {
            this.start();
        }
    }

    /* ════════ RUNNER STATE PERSISTENCE ═════════════════════ */
    _persistRunnerState() {
        const session = this.session;
        if (!session) return;
        session._runner = {
            currentIndex: this.currentIndex,
            phase: this.phase,
            prevPhase: this.prevPhase,
            endAt: this.endAt,
            stepStartAt: this.stepStartAt,
            pauseRemain: this.pauseRemain,
            skipped: Array.from(this.skippedSteps),
            savedAt: Date.now()
        };
        if (window.wkTodayHelpers && window.wkTodayHelpers.persistSession) {
            // Fire-and-forget
            window.wkTodayHelpers.persistSession(session).catch(()=>{});
        }
    }

    _restoreFromSession() {
        const r = this.session && this.session._runner;
        if (!r) return;
        this.currentIndex = Math.min(Math.max(0, Number(r.currentIndex) || 0), this.totalSteps);
        this.skippedSteps = new Set(Array.isArray(r.skipped) ? r.skipped : []);
        this.prevPhase    = r.prevPhase || WK_PHASE.IDLE;
        this.stepStartAt  = Number(r.stepStartAt) || Date.now();
        this.pauseRemain  = Number(r.pauseRemain) || 0;

        const phase = r.phase || WK_PHASE.IDLE;
        // If session was running when persisted, come back PAUSED so user explicitly resumes.
        if (phase === WK_PHASE.WORK_TIMED || phase === WK_PHASE.WORK_MANUAL || phase === WK_PHASE.RESTING) {
            this.prevPhase = phase;
            this.phase = WK_PHASE.PAUSED;
            // If endAt was in future when paused, derive remaining
            if (r.endAt && r.endAt > r.savedAt) {
                this.pauseRemain = Math.max(0, (r.endAt - r.savedAt) / 1000);
            } else {
                const cd = this._stepCountdownSec(this.currentStep);
                this.pauseRemain = this.pauseRemain || cd;
            }
            this.endAt = 0;
        } else {
            this.phase = phase;
            this.endAt = 0; // never restore endAt across reloads
        }
    }

    /* ════════ LOGGER SYNC (table rows) ══════════════════════ */
    _updateLoggerSync() {
        const container = document.getElementById('wkTodayPlayer');
        if (!container) return;
        const session = window.wkState && window.wkState.activeSession;
        if (!session) return;

        const loggedMap = new Map();
        for (const ex of (session.exercises||[])) {
            for (const s of (ex.sets||[])) {
                loggedMap.set(`${ex.id}:${s.setIndex}`, true);
            }
        }

        container.querySelectorAll('[data-exercise-id][data-set-index]').forEach(row => {
            const exId   = row.dataset.exerciseId;
            const setIdx = Number(row.dataset.setIndex);
            const isDone = loggedMap.has(`${exId}:${setIdx}`);
            const stepIdx = this.steps.findIndex(
                s => s.type === 'SET' && s.exId === exId && s.setIndex === setIdx
            );
            const isSkipped = !isDone && stepIdx >= 0 && this.skippedSteps.has(stepIdx);
            const isCurrent = this.currentStep
                && this.currentStep.type === 'SET'
                && this.currentStep.exId === exId
                && this.currentStep.setIndex === setIdx;

            row.classList.toggle('is-done', isDone);
            row.classList.toggle('is-skipped', isSkipped);
            row.classList.toggle('wkt-current-set', !!isCurrent);
        });

        container.querySelectorAll('[data-ex-id]').forEach(exEl => {
            const exId = exEl.dataset.exId;
            const ex = (session.exercises||[]).find(e => e.id === exId);
            if (!ex) return;
            const target = Number(ex.targetSets) || 0;
            const done   = (ex.sets||[]).length;
            exEl.classList.toggle('complete', done >= target && target > 0);
        });
    }

    /* ════════ DOM ATTACH + RENDER ═══════════════════════════ */
    attachDOM() {
        this._setupScrollObserver();
        this._renderOuterSegments();
        this.updateHUD();
        this._updateLoggerSync();
        // Resume rAF if we're already running
        if (this.isRunning && !this._rafId) {
            this._rafId = requestAnimationFrame(this._tickBound);
        }
    }

    _renderOuterSegments() {
        const trackGroup = document.getElementById('wktOuterSegmentsTrack');
        const fillGroup = document.getElementById('wktOuterSegments');
        if (!trackGroup || !fillGroup) return;
        if (!this.steps.length) { trackGroup.innerHTML = ''; fillGroup.innerHTML = ''; return; }

        const C_OUTER = 904.8; // 2π × 144
        const useTime = this.useTimeMode;
        const totalUnits = useTime ? this.totalEstimatedSec : this.steps.length;
        const gapDeg = 1.5; // visual gap between segments

        let html = '';
        let offset = 0;
        for (const step of this.steps) {
            const units = useTime ? this._stepEstSec(step) : 1;
            const dashLength = (units / totalUnits) * C_OUTER;
            const color = step.color || (step.type === 'REST' ? (window.REST_COLOR || '#00FFC4') : '#FF3B30');
            html += `<circle cx="160" cy="160" r="144" fill="transparent" stroke="${color}" stroke-width="9"
                stroke-dasharray="${Math.max(1, dashLength - gapDeg)} ${C_OUTER}"
                stroke-dashoffset="${-offset}" />`;
            offset += dashLength;
        }
        trackGroup.innerHTML = html;
        fillGroup.innerHTML  = html;
    }

    _setupScrollObserver() {
        const hud = document.getElementById('wktHud');
        const mini = document.getElementById('wktMiniHud');
        if (!hud || !mini || !('IntersectionObserver' in window)) return;
        if (this._hudObserver) this._hudObserver.disconnect();
        this._hudObserver = new IntersectionObserver(([entry]) => {
            mini.classList.toggle('visible', !entry.isIntersecting);
        }, { threshold: 0.1 });
        this._hudObserver.observe(hud);
    }

    /* ════════ HUD UPDATE ════════════════════════════════════ */
    updateHUD() {
        const step = this.currentStep;
        const now = Date.now();
        const sessionElapsed = Math.floor((now - this.sessionStart) / 1000);

        /* Inner ring fraction + countdown text */
        let innerFrac = 0;
        let countdownSec = 0; // positive = countdown, negative = stopwatch
        let stepLabel = '';
        let stepSub = '';

        const playIcon = this.isRunning
            ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
            : (this.phase === WK_PHASE.COMPLETE
                ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>'
                : '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>');

        if (this.phase === WK_PHASE.COMPLETE || (!step && this.totalSteps > 0 && this.currentIndex >= this.totalSteps)) {
            stepLabel = 'Complete!';
            stepSub   = 'All sets done';
            innerFrac = 1;
        } else if (!step) {
            stepLabel = 'Ready';
            stepSub   = 'Press ▶ to start';
        } else {
            const cd = this._stepCountdownSec(step);
            if (step.type === 'REST') {
                stepLabel = 'Rest';
                stepSub   = step.label || 'Next set';
                if (this.phase === WK_PHASE.PAUSED) {
                    countdownSec = Math.ceil(this.pauseRemain || cd);
                    innerFrac    = cd > 0 ? Math.max(0, Math.min(1, 1 - (this.pauseRemain || cd) / cd)) : 0;
                } else if (this.phase === WK_PHASE.RESTING && cd > 0 && this.endAt > 0) {
                    const rem = Math.max(0, (this.endAt - now) / 1000);
                    countdownSec = Math.ceil(rem);
                    innerFrac    = 1 - rem / cd;
                } else {
                    countdownSec = cd;
                    innerFrac    = 0;
                }
            } else {
                // SET
                const repStr = step.repMin && step.repMax ? `${step.repMin}–${step.repMax} reps` : '';
                stepLabel = step.exName;
                stepSub   = `Set ${step.setIndex}/${step.totalSets}${repStr ? ' · ' + repStr : ''}`;

                if (this.phase === WK_PHASE.AWAIT_LOG) {
                    countdownSec = 0;
                    innerFrac    = 1;
                    stepSub      = `Tap “Log Set” · Set ${step.setIndex}/${step.totalSets}`;
                } else if (cd > 0) {
                    if (this.phase === WK_PHASE.PAUSED) {
                        countdownSec = Math.ceil(this.pauseRemain || cd);
                        innerFrac    = Math.max(0, Math.min(1, 1 - (this.pauseRemain || cd) / cd));
                    } else if (this.phase === WK_PHASE.WORK_TIMED && this.endAt > 0) {
                        const rem = Math.max(0, (this.endAt - now) / 1000);
                        countdownSec = Math.ceil(rem);
                        innerFrac    = 1 - rem / cd;
                    } else {
                        countdownSec = cd;
                        innerFrac    = 0;
                    }
                } else {
                    // Manual stopwatch (counts up while running)
                    if (this.phase === WK_PHASE.WORK_MANUAL) {
                        const elapsed = Math.floor((now - this.stepStartAt) / 1000);
                        countdownSec = -elapsed;
                        innerFrac = Math.min(0.98, elapsed / 90);
                    } else {
                        countdownSec = 0;
                        innerFrac = 0;
                    }
                }
            }
        }

        const outerFrac = this.overallFraction;
        const pctText   = `${Math.round(outerFrac * 100)}%`;
        const timeLeftStr = this._fmtHms(this.estimatedRemainingSec);

        /* SVG rings */
        const C_OUTER = 904.8, C_INNER = 703.7;
        this._setAttr('wktRingOuter', 'stroke-dashoffset', C_OUTER * (1 - outerFrac));
        this._setAttr('wktRingInner', 'stroke-dashoffset', C_INNER * (1 - innerFrac));

        /* Theme color for HUD + mini */
        const cssPhase = this.cssPhase;
        let hue = '#00d4ff';
        if (cssPhase === 'complete') hue = '#39ff14';
        else if (cssPhase === 'paused') hue = '#b4becd';
        else if (cssPhase === 'rest') hue = window.REST_COLOR || '#00FFC4';
        else if (step && step.color) hue = step.color;

        const r = parseInt(hue.slice(1, 3), 16) || 0;
        const g = parseInt(hue.slice(3, 5), 16) || 212;
        const b = parseInt(hue.slice(5, 7), 16) || 255;

        const huds = [document.getElementById('wktHud'), document.getElementById('wktMiniHud')].filter(Boolean);
        huds.forEach(hud => {
            hud.style.setProperty('--ph-clr', hue);
            hud.style.setProperty('--ph-clr-rgb', `${r}, ${g}, ${b}`);
            hud.style.setProperty('--ph-glow', `rgba(${r},${g},${b},.52)`);
            hud.style.setProperty('--ph-dim',  `rgba(${r},${g},${b},.14)`);
            hud.style.setProperty('--ph-border', `rgba(${r},${g},${b},.28)`);
            hud.style.setProperty('--ph-text', hue);
            hud.style.setProperty('--out-clr', `rgba(${r},${g},${b},.65)`);
        });

        const hudEl = document.getElementById('wktHud');
        if (hudEl && hudEl.dataset.phase !== cssPhase) hudEl.dataset.phase = cssPhase;

        /* Center text */
        const timeDisplay = countdownSec < 0
            ? this._fmtMs(-countdownSec)
            : (countdownSec > 0 ? this._fmtMs(countdownSec) : (this.phase === WK_PHASE.AWAIT_LOG ? 'LOG' : ''));

        this._setText('wktRcName', stepLabel);
        this._setText('wktRcTime', timeDisplay);
        this._setText('wktRcSub',  stepSub);
        this._setText('wktOuterPct', pctText);

        /* Top bar */
        this._setText('wktTsElapsed', this._fmtHms(sessionElapsed));
        const setInfo = step && step.type === 'SET' ? `${step.setIndex}/${step.totalSets}` : '—';
        this._setText('wktTsSet', setInfo);
        this._setText('wktTsLeft', timeLeftStr);

        /* Stats column */
        this._setText('wktStatElapsed', this._fmtHms(sessionElapsed));
        this._setText('wktStatLeft', timeLeftStr);
        this._setText('wktStatSets', String(this._countLoggedSets()));
        this._setText('wktStatPct', pctText);

        /* Play button */
        const playBtn = document.getElementById('wktBtnPlay');
        if (playBtn) playBtn.innerHTML = playIcon;

        /* Phase badge */
        const phaseBadgeEl = document.getElementById('wktPhaseBadge');
        if (phaseBadgeEl) {
            const phaseTextMap = {
                [WK_PHASE.IDLE]: 'READY',
                [WK_PHASE.WORK_TIMED]: 'WORK',
                [WK_PHASE.WORK_MANUAL]: 'WORK',
                [WK_PHASE.RESTING]: 'REST',
                [WK_PHASE.AWAIT_LOG]: 'AWAIT LOG',
                [WK_PHASE.PAUSED]: 'PAUSED',
                [WK_PHASE.COMPLETE]: 'DONE'
            };
            phaseBadgeEl.textContent = phaseTextMap[this.phase] || 'READY';
            phaseBadgeEl.className = 'wkt-phase-badge wkt-phase-badge--' + cssPhase;
        }

        /* Action buttons */
        const skipBtn = document.getElementById('wktBtnSkipRest');
        if (skipBtn) {
            const canSkip = step && step.type === 'REST' && this.phase === WK_PHASE.RESTING;
            skipBtn.disabled = !canSkip;
            skipBtn.classList.toggle('active', canSkip);
        }
        const logBtn = document.getElementById('wktBtnLog');
        if (logBtn) {
            const isSet = step && step.type === 'SET' && this.phase !== WK_PHASE.COMPLETE;
            logBtn.disabled = !isSet;
            logBtn.classList.toggle('active', isSet);
            logBtn.textContent = (this.phase === WK_PHASE.AWAIT_LOG) ? 'Log Set →' : 'Log Set';
        }
        const nextBtn = document.getElementById('wktBtnNext');
        if (nextBtn) {
            const isSetWork = step && step.type === 'SET'
                && (this.phase === WK_PHASE.WORK_TIMED || this.phase === WK_PHASE.WORK_MANUAL || this.phase === WK_PHASE.IDLE || this.phase === WK_PHASE.PAUSED);
            nextBtn.title = isSetWork ? 'Log set' : 'Skip';
        }

        /* Next-up text */
        const nextStep = this.steps[this.currentIndex + 1];
        let nextText = '';
        if (nextStep) {
            if (nextStep.type === 'REST') nextText = `Break · ${this._fmtMs(nextStep.durationSec)}`;
            else nextText = `${nextStep.exName} · Set ${nextStep.setIndex}/${nextStep.totalSets}`;
        }
        this._setText('wktNextupVal', nextText || '—');
        const nextupEl = document.getElementById('wktNextup');
        if (nextupEl) nextupEl.style.display = nextText ? '' : 'none';

        /* Queue */
        this._renderQueue();

        /* Mini HUD */
        this._updateMiniHud(stepLabel, timeDisplay, cssPhase === 'rest', innerFrac, outerFrac, playIcon);
    }

    _renderQueue() {
        const el = document.getElementById('wktQueueList');
        if (!el) return;
        const startIdx = Math.max(0, this.currentIndex - 1);
        const endIdx   = Math.min(this.steps.length, this.currentIndex + 6);
        const slice    = this.steps.slice(startIdx, endIdx);

        el.innerHTML = slice.map((step, i) => {
            const absIdx  = startIdx + i;
            const isCurrent = absIdx === this.currentIndex;
            const isPast = absIdx < this.currentIndex;
            const isRest = step.type === 'REST';
            const color = step.color || (isRest ? (window.REST_COLOR || '#00FFC4') : (window.EXERCISE_PALETTE && window.EXERCISE_PALETTE[0] ? window.EXERCISE_PALETTE[0] : '#FF3B30'));
            const name   = isRest ? `⏱ Rest · ${this._fmtMs(step.durationSec)}` :
                `${step.exName} · Set ${step.setIndex}/${step.totalSets}`;
            return `<div class="wkt-queue-item ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''} ${isRest ? 'rest' : ''}">
                <span class="wkt-qi-dot" style="background-color: ${color}; ${isCurrent ? `box-shadow: 0 0 7px ${color}80;` : ''}"></span>
                <span class="wkt-qi-text" style="${isCurrent ? `color: ${color}; font-weight: 800;` : ''}">${esc(name)}</span>
            </div>`;
        }).join('');
    }

    _updateMiniHud(label, time, isRest, innerFrac, outerFrac, playIcon) {
        const mini = document.getElementById('wktMiniHud');
        if (!mini) return;
        mini.innerHTML = `
            <div class="wkt-mini-ring-wrap">
                <svg viewBox="0 0 40 40" class="wkt-mini-svg">
                    <circle class="wkt-mini-track" cx="20" cy="20" r="17"/>
                    <circle class="wkt-mini-fill outer" cx="20" cy="20" r="17"
                        stroke-dasharray="106.8 106.8"
                        stroke-dashoffset="${(106.8*(1-outerFrac)).toFixed(1)}"/>
                    <circle class="wkt-mini-track" cx="20" cy="20" r="12"/>
                    <circle class="wkt-mini-fill ${isRest?'rest':''}" cx="20" cy="20" r="12"
                        stroke-dasharray="75.4 75.4"
                        stroke-dashoffset="${(75.4*(1-innerFrac)).toFixed(1)}"/>
                </svg>
            </div>
            <div class="wkt-mini-info">
                <span class="wkt-mini-name">${esc(label)}</span>
                ${time ? `<span class="wkt-mini-time">${esc(time)}</span>` : ''}
            </div>
            <button class="wkt-mini-play" onclick="window.wkRunner && window.wkRunner.togglePlay()">${playIcon}</button>`;
    }

    /* ════════ FORMAT HELPERS ════════════════════════════════ */
    _fmtMs(s) {
        s = Math.max(0, Math.round(s));
        const m = Math.floor(s / 60), sec = s % 60;
        return `${m}:${String(sec).padStart(2,'0')}`;
    }
    _fmtHms(s) {
        s = Math.max(0, Math.round(s));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return h > 0
            ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
            : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    }
    _setText(id, text) {
        const el = document.getElementById(id);
        if (el && el.textContent !== text) el.textContent = text;
    }
    _setAttr(id, attr, val) {
        const el = document.getElementById(id);
        if (el) el.setAttribute(attr, val);
    }
    _countLoggedSets() {
        const session = window.wkState && window.wkState.activeSession;
        if (!session) return 0;
        return (session.exercises||[]).reduce((s, ex) => s + ((ex.sets||[]).length), 0);
    }
    _vibrate(pattern) {
        try {
            if (window.wkSettings && !window.wkSettings.get().timerVibrate) return;
            if (navigator.vibrate) navigator.vibrate(pattern);
        } catch(e){}
    }
    _beep(freq, gain, dur) {
        try {
            if (!window.wkSettings || !window.wkSettings.get().timerSound) return;
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = freq; g.gain.value = gain;
            o.start(); o.stop(ctx.currentTime + dur);
        } catch(e) {}
    }
}

/* ── Global singleton ─────────────────────────────────────── */
window.wkRunner = null;
window.WK_PHASE = WK_PHASE;

window.wkRunnerInit = function(session) {
    if (window.wkRunner) window.wkRunner.destroy();
    window.wkRunner = new WkRunner(session);
};

/* ── Suppress floating rest widget while runner is active ─ */
(function() {
    const _orig = window.wkMaybeStartRest;
    window.wkMaybeStartRest = function(ex, setIndex, session) {
        if (window.wkRunner) {
            // Runner handles rest visually; skip the floating widget.
            window.wkRunner._syncStepsToLogs();
            return;
        }
        _orig && _orig(ex, setIndex, session);
    };
})();
