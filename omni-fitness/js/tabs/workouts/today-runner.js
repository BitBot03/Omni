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

const WK_DEBUG = false; // set true to enable verbose console logs

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
        this.prevPhase    = WK_PHASE.IDLE;
        this.currentIndex = 0;
        this.endAt        = 0;
        this.stepStartAt  = Date.now();
        this.pauseRemain  = 0;

        // Completion tracking by stepId (never by index alone)
        this.completedStepIds = new Set();
        this.skippedStepIds   = new Set();

        // Re-entrancy guards
        this._advancing   = false;
        this._nextLocked  = false;

        // Per-step timer-end guard: stepId of the step whose countdown just fired
        this._endedStepIds = new Set();

        this._rafId       = null;
        this._tickBound   = this._tick.bind(this);
        this._onChanged   = this._onChanged.bind(this);

        // Resume from persisted runner state
        this._restoreFromSession();

        document.addEventListener('workoutsChanged', this._onChanged);

        if (WK_DEBUG) {
            console.group('[WkRunner] Session started — full queue:');
            this.steps.forEach((s, i) => {
                if (s.type === 'SET') {
                    console.log(`  [${i}] SET  stepId=${s.stepId}  ex=${s.exName}  set=${s.setIndex}/${s.totalSets}  timed=${s.isTimed}  timerSec=${s.timerSec}`);
                } else {
                    console.log(`  [${i}] REST stepId=${s.stepId}  dur=${s.durationSec}s  label="${s.label}"`);
                }
            });
            console.groupEnd();
        }
    }

    /* ════════ STEP QUEUE BUILDER ════════════════════════════ */
    _buildQueue(session) {
        const steps     = [];
        const defRest   = 90;
        const exercises = session.exercises || [];
        const blocks    = (session.blocks || []).slice().sort((a,b) => (a.order||0)-(b.order||0));
        const sid       = session.id || 'sess';

        const makeSetStep = (ex, setIdx, totalSets, block, type, roundIdx) => {
            const tt = this._normTT(ex.trackingTypeSnapshot || ex.trackingType);
            const isTimed = this._isTimedTracking(tt, ex);
            const timerSec = isTimed ? this._resolveTimerSec(tt, ex) : 0;
            const rIdx = roundIdx != null ? roundIdx : setIdx;
            const stepId = `${sid}|${block.id}|${ex.id}|SET|set:${setIdx}|round:${rIdx}`;
            return {
                type: 'SET',
                stepId,
                exId: ex.id,
                exName: ex.exerciseName || ex.exerciseNameSnapshot || 'Exercise',
                color: ex.color || (window.EXERCISE_PALETTE && window.EXERCISE_PALETTE[0]) || '#FF3B30',
                setIndex: setIdx,
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

        let restCounter = 0;
        const makeRestStep = (durationSec, label, color) => {
            const stepId = `${sid}|REST|${restCounter++}`;
            return {
                type: 'REST',
                stepId,
                durationSec,
                label,
                color: color || window.REST_COLOR || '#00FFC4'
            };
        };

        const processBlock = (block, exs) => {
            const type = (block.type || 'normal').toLowerCase();
            const isGroup = (type === 'superset' || type === 'giant' || type === 'circuit');

            if (!isGroup) {
                for (const ex of exs) {
                    const totalSets = Number(ex.targetSets) || 3;
                    for (let i = 1; i <= totalSets; i++) {
                        steps.push(makeSetStep(ex, i, totalSets, block, type, null));
                        if (i < totalSets) {
                            const rest = Number(ex.restSeconds) || defRest;
                            steps.push(makeRestStep(rest, `Rest · ${ex.exerciseName || 'Next set'}`));
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
                        steps.push(makeSetStep(ex, round, Number(ex.targetSets)||3, block, type, round));
                    }
                    if (round < maxRounds && blockRest > 0) {
                        steps.push(makeRestStep(blockRest, `${block.name||'Round'} · round ${round} rest`));
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

    _isTimedTracking(tt, ex) {
        const mode = String(ex.setTimerMode || '').toLowerCase();
        if (mode === 'fixed_time' || mode === 'rep_pace') return true;
        if (mode === 'manual' || mode === 'none') return false;
        return tt === 'time' || tt === 'weight_time' || tt === 'distance_time';
    }

    _resolveTimerSec(tt, ex) {
        const explicit = Number(ex.setTimeSec);
        if (explicit > 0) return explicit;
        if (tt === 'time') {
            const v = Number(ex.repMax || ex.repMin) || 0;
            if (v > 0) return v;
        }
        const mode = String(ex.setTimerMode || '').toLowerCase();
        if (mode === 'rep_pace' && ex.tempo) {
            const t = String(ex.tempo).split(/[^0-9.]/).filter(Boolean).map(Number);
            const perRep = t.reduce((s,n) => s + (Number(n)||0), 0);
            const reps = Number(ex.repMax || ex.repMin) || 8;
            if (perRep > 0) return Math.round(perRep * reps);
        }
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

    get cssPhase() {
        switch (this.phase) {
            case WK_PHASE.IDLE:        return 'idle';
            case WK_PHASE.RESTING:     return 'rest';
            case WK_PHASE.PAUSED:      return 'paused';
            case WK_PHASE.COMPLETE:    return 'complete';
            case WK_PHASE.AWAIT_LOG:   return 'work';
            default:                   return 'work';
        }
    }

    /* ════════ TIMING / DURATION HELPERS ═════════════════════ */
    _stepEstSec(step) {
        if (!step) return 0;
        if (step.type === 'REST') return Number(step.durationSec) || 0;
        if (step.timerSec > 0)    return step.timerSec;
        return 45;
    }

    _stepCountdownSec(step) {
        if (!step) return 0;
        if (step.type === 'REST') return Number(step.durationSec) || 0;
        if (step.type === 'SET' && step.timerSec > 0) return step.timerSec;
        return 0;
    }

    get useTimeMode() {
        if (!this.steps.length) return false;
        const known = this.steps.filter(s => this._stepEstSec(s) > 0).length;
        return (known / this.steps.length) >= 0.6;
    }

    get totalEstimatedSec() {
        return this.steps.reduce((sum, s) => sum + this._stepEstSec(s), 0);
    }

    _completedEstSec() {
        let s = 0;
        for (let i = 0; i < Math.min(this.currentIndex, this.steps.length); i++) {
            s += this._stepEstSec(this.steps[i]);
        }
        return s;
    }

    _currentStepFrac() {
        const step = this.currentStep;
        if (!step) return 0;
        if (this.phase === WK_PHASE.COMPLETE) return 1;

        const cd = this._stepCountdownSec(step);
        const now = Date.now();
        if (cd > 0) {
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
        if (step.type === 'SET' && this.phase === WK_PHASE.AWAIT_LOG) return 1;
        const elapsed = (now - this.stepStartAt) / 1000;
        const est = this._stepEstSec(step);
        return Math.max(0, Math.min(0.98, est > 0 ? elapsed / est : 0));
    }

    get overallFraction() {
        if (!this.totalSteps) return 0;
        if (this.phase === WK_PHASE.COMPLETE) return 1;

        if (this.useTimeMode) {
            const total = this.totalEstimatedSec;
            if (total <= 0) return 0;
            const partial = this._currentStepFrac() * this._stepEstSec(this.currentStep);
            return Math.min(1, (this._completedEstSec() + partial) / total);
        }
        return Math.min(1, (this.currentIndex + this._currentStepFrac()) / this.totalSteps);
    }

    get estimatedRemainingSec() {
        if (this.phase === WK_PHASE.COMPLETE) return 0;
        let rem = 0;
        for (let i = this.currentIndex + 1; i < this.steps.length; i++) {
            rem += this._stepEstSec(this.steps[i]);
        }
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

        if (this.phase === WK_PHASE.PAUSED) {
            this.phase = this.prevPhase || this._phaseForCurrentStep();
            const cd = this._stepCountdownSec(this.currentStep);
            if (cd > 0 && this.pauseRemain > 0) {
                this.endAt = Date.now() + this.pauseRemain * 1000;
            } else if (cd === 0 && this.pauseRemain > 0) {
                this.stepStartAt = Math.max(0, Date.now() - (this.pauseRemain * 1000));
            }
            this.pauseRemain = 0;
        } else {
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
        } else if (cd === 0 && this.phase === WK_PHASE.WORK_MANUAL) {
            this.pauseRemain = Math.max(0, (Date.now() - this.stepStartAt) / 1000);
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

    /* Context-aware ⏩ next button
       Debounced 200ms to prevent double-tap races.
       SET steps: auto-log then advance.
       REST steps: skip rest.
    */
    next() {
        // Debounce: ignore rapid taps
        if (this._nextLocked) {
            if (WK_DEBUG) console.warn('[WkRunner] next() debounced — too rapid');
            return;
        }
        this._nextLocked = true;
        setTimeout(() => { this._nextLocked = false; }, 200);

        const step = this.currentStep;
        if (!step) return;

        if (step.type === 'REST') {
            // Skip rest
            this.advance('skipRest');
            return;
        }

        if (step.type === 'SET') {
            // Stop any running timer for this step
            if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }

            const wasActive = this.phase === WK_PHASE.WORK_TIMED
                || this.phase === WK_PHASE.WORK_MANUAL
                || this.phase === WK_PHASE.AWAIT_LOG;
            const wasRunning = this.isRunning || wasActive;

            // Transition to AWAIT_LOG while we wait for the log to save
            this.phase   = WK_PHASE.AWAIT_LOG;
            this.endAt   = 0;
            this._persistRunnerState();
            this.updateHUD();

            // Determine elapsed duration for auto-log
            let dur = step.timerSec || 0;
            if (!dur) {
                const elapsed = Math.floor((Date.now() - this.stepStartAt) / 1000);
                dur = elapsed > 0 ? elapsed : 0;
            }

            // Check if already logged
            const session = window.wkState && window.wkState.activeSession;
            const ex = session && (session.exercises||[]).find(e => e.id === step.exId);
            const alreadyLogged = ex && (ex.sets||[]).some(s => s.setIndex === step.setIndex);

            if (alreadyLogged) {
                // Already logged — just advance
                this._wasRunningBeforeLog = wasRunning;
                this.advance('next:alreadyLogged');
            } else if (typeof window.wkAutoLogSet === 'function') {
                // Store wasRunning so _syncStepsToLogs can restore it after the async log
                this._wasRunningBeforeLog = wasRunning;
                window.wkAutoLogSet(step.exId, step.setIndex, { durationSec: dur });
                // advance() will be called by _syncStepsToLogs once setLogged fires
            } else {
                // No auto-log available — open modal
                this._wasRunningBeforeLog = wasRunning;
                this.logCurrent();
            }
        }
    }

    prev() {
        if (this.currentIndex <= 0) return;
        const oldIdx = this.currentIndex;
        this.currentIndex--;
        this.stepStartAt = Date.now();
        this.phase = this._phaseForCurrentStep();
        const cd = this._stepCountdownSec(this.currentStep);
        this.endAt = cd > 0 ? Date.now() + cd * 1000 : 0;
        this.pauseRemain = 0;
        // Clear step-ended guard for the step we're going back to
        const prevStep = this.currentStep;
        if (prevStep) this._endedStepIds.delete(prevStep.stepId);
        if (this.isRunning && !this._rafId) this._rafId = requestAnimationFrame(this._tickBound);
        this._persistRunnerState();
        this.updateHUD();
        this._updateLoggerSync();
        if (WK_DEBUG) console.log(`[WkRunner] prev(): ${oldIdx} → ${this.currentIndex}`);

        if (prevStep && prevStep.type === 'SET' && typeof window.wkUnlogSet === 'function') {
            window.wkUnlogSet(prevStep.exId, prevStep.setIndex);
        }
    }

    skipRest() {
        const step = this.currentStep;
        if (!step || step.type !== 'REST') return;
        this.advance('skipRest');
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

    /* ════════ SINGLE CURSOR AUTHORITY: advance(cause) ═══════
       ONLY this function moves currentIndex.
       All callers (next, skipRest, _syncStepsToLogs, _onCountdownDone)
       must go through here. Re-entrancy guard prevents double-advance.
    */
    advance(cause) {
        if (this._advancing) {
            if (WK_DEBUG) console.warn(`[WkRunner] advance("${cause}") blocked — already advancing`);
            return;
        }
        this._advancing = true;

        try {
            const oldIndex = this.currentIndex;
            const oldStepId = this.currentStep && this.currentStep.stepId;

            if (this.currentIndex >= this.totalSteps - 1) {
                this.currentIndex = this.totalSteps;
                this.phase = WK_PHASE.COMPLETE;
                this.endAt = 0;
                if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
                this._persistRunnerState();
                this.updateHUD();
                this._updateLoggerSync();
                if (typeof toast === 'function') toast('All planned sets done! Great work 💪');
                if (WK_DEBUG) console.log(`[WkRunner] advance("${cause}"): COMPLETE — queue exhausted`);
                return;
            }

            // Determine if we should keep running after the advance
            // Use _wasRunningBeforeLog if set (for SET → advance after async log)
            let wasRunning;
            if (this._wasRunningBeforeLog !== undefined) {
                wasRunning = this._wasRunningBeforeLog;
                delete this._wasRunningBeforeLog;
            } else {
                wasRunning = this.isRunning
                    || this.phase === WK_PHASE.AWAIT_LOG
                    || (this.phase === WK_PHASE.PAUSED && this.prevPhase !== WK_PHASE.IDLE);
            }

            this.currentIndex++;
            this.stepStartAt = Date.now();
            this.pauseRemain = 0;

            const newStep = this.currentStep;
            const newStepId = newStep && newStep.stepId;

            // Clear timer-end guard for new step
            if (newStep) this._endedStepIds.delete(newStep.stepId);

            const jumpBy = this.currentIndex - oldIndex;
            if (WK_DEBUG) {
                console.log(`[WkRunner] advance("${cause}"): [${oldIndex}](${oldStepId}) → [${this.currentIndex}](${newStepId})  wasRunning=${wasRunning}`);
                if (jumpBy > 1) console.warn(`[WkRunner] WARNING: cursor jumped by ${jumpBy}`);
            }

            if (wasRunning) {
                this.phase = this._phaseForCurrentStep();
                const cd = this._stepCountdownSec(newStep);
                this.endAt = cd > 0 ? Date.now() + cd * 1000 : 0;
                if (!this._rafId) this._rafId = requestAnimationFrame(this._tickBound);
            } else {
                this.phase = WK_PHASE.PAUSED;
                this.prevPhase = this._phaseForCurrentStep();
                const cd = this._stepCountdownSec(newStep);
                this.pauseRemain = cd > 0 ? cd : 0;
                this.endAt = 0;
            }

            this._persistRunnerState();
            this.updateHUD();
            this._updateLoggerSync();
        } finally {
            this._advancing = false;
        }
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
                if (rem <= 0) {
                    this._onCountdownDone(step);
                    return;
                }
            }
        }
        this.updateHUD();
        this._rafId = requestAnimationFrame(this._tickBound);
    }

    _onCountdownDone(step) {
        // Per-step guard: fire exactly once per step
        if (this._endedStepIds.has(step.stepId)) {
            if (WK_DEBUG) console.warn(`[WkRunner] _onCountdownDone: DUPLICATE for stepId=${step.stepId} — ignored`);
            this._rafId = null;
            return;
        }
        this._endedStepIds.add(step.stepId);
        if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }

        if (step.type === 'REST') {
            this._vibrate([100, 60, 180]);
            this._beep(660, 0.06, 0.15);
            if (typeof toast === 'function') toast('Rest done — go!');
            this.advance('restEnd');
            return;
        }

        // SET timed: auto-log then advance
        this._vibrate([120]);
        this._beep(880, 0.06, 0.12);

        const wasRunning = true; // was running when timer fired
        this._wasRunningBeforeLog = wasRunning;
        this.phase = WK_PHASE.AWAIT_LOG;
        this.endAt = 0;
        this._persistRunnerState();
        this.updateHUD();

        if (typeof window.wkAutoLogSet === 'function') {
            window.wkAutoLogSet(step.exId, step.setIndex, { durationSec: step.timerSec });
            // advance() called by _syncStepsToLogs once setLogged fires
        } else {
            if (typeof toast === 'function') toast('Set timer done — log it!');
        }
    }

    _onChanged(e) {
        const reason = e && e.detail && e.detail.reason;

        if (reason === 'exerciseAdded' || reason === 'exerciseRemoved') {
            // Rebuild queue but preserve cursor position by stepId
            const currentStepId = this.currentStep && this.currentStep.stepId;
            this.steps = this._buildQueue(this.session);
            // Try to find the same step by id; fall back to nearest valid index
            if (currentStepId) {
                const newIdx = this.steps.findIndex(s => s.stepId === currentStepId);
                this.currentIndex = newIdx >= 0 ? newIdx : Math.min(this.currentIndex, Math.max(0, this.steps.length - 1));
            } else {
                this.currentIndex = Math.min(this.currentIndex, Math.max(0, this.steps.length - 1));
            }
            this._renderOuterSegments();
            this._persistRunnerState();
            this.updateHUD();
            this._updateLoggerSync();
            return;
        }

        if (reason !== 'setLogged' && reason !== 'setUpdated' && reason !== 'setDeleted') return;
        this._syncStepsToLogs();
        this._updateLoggerSync();
        this.updateHUD();
    }

    _syncStepsToLogs() {
        const session = window.wkState && window.wkState.activeSession;
        if (!session) return;
        const step = this.currentStep;
        if (!step || step.type !== 'SET') return;

        // Only advance if the CURRENT step's set is now logged
        const ex = (session.exercises||[]).find(e => e.id === step.exId);
        if (!ex) return;
        const hasLogged = (ex.sets||[]).some(s => s.setIndex === step.setIndex);
        if (!hasLogged) return;

        // Already completed via stepId? Don't advance twice
        if (this.completedStepIds.has(step.stepId)) {
            if (WK_DEBUG) console.warn(`[WkRunner] _syncStepsToLogs: step ${step.stepId} already completed — skipping advance`);
            return;
        }
        this.completedStepIds.add(step.stepId);

        // If we're not in AWAIT_LOG (e.g. user logged via table row while running),
        // stop the RAF and transition to AWAIT_LOG first
        if (this.phase !== WK_PHASE.AWAIT_LOG) {
            if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
            this.phase = WK_PHASE.AWAIT_LOG;
            this.endAt = 0;
        }

        const auto = window.wkSettings && window.wkSettings.get().autoRestTimer;

        // _wasRunningBeforeLog may have been set by next() or _onCountdownDone
        // If not set, default to keeping the session running
        const wasRunningFlag = this._wasRunningBeforeLog !== undefined
            ? this._wasRunningBeforeLog
            : true;

        const keepRunning = wasRunningFlag && auto !== false;

        // Pass the resolved flag explicitly to advance()
        this._wasRunningBeforeLog = keepRunning;

        this.advance('setLogged');
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
            completedStepIds: Array.from(this.completedStepIds),
            skippedStepIds: Array.from(this.skippedStepIds),
            savedAt: Date.now()
        };
        if (window.wkTodayHelpers && window.wkTodayHelpers.persistSession) {
            window.wkTodayHelpers.persistSession(session).catch(()=>{});
        }
    }

    _restoreFromSession() {
        const r = this.session && this.session._runner;
        if (!r) return;
        this.currentIndex = Math.min(Math.max(0, Number(r.currentIndex) || 0), this.totalSteps);
        this.completedStepIds = new Set(Array.isArray(r.completedStepIds) ? r.completedStepIds : []);
        this.skippedStepIds   = new Set(Array.isArray(r.skippedStepIds)   ? r.skippedStepIds   : []);
        this.prevPhase    = r.prevPhase || WK_PHASE.IDLE;
        this.stepStartAt  = Number(r.stepStartAt) || Date.now();
        this.pauseRemain  = Number(r.pauseRemain) || 0;

        const phase = r.phase || WK_PHASE.IDLE;
        if (phase === WK_PHASE.WORK_TIMED || phase === WK_PHASE.WORK_MANUAL || phase === WK_PHASE.RESTING) {
            this.prevPhase = phase;
            this.phase = WK_PHASE.PAUSED;
            if (r.endAt && r.endAt > r.savedAt) {
                this.pauseRemain = Math.max(0, (r.endAt - r.savedAt) / 1000);
            } else {
                const cd = this._stepCountdownSec(this.currentStep);
                this.pauseRemain = this.pauseRemain || cd;
            }
            this.endAt = 0;
        } else {
            this.phase = phase;
            this.endAt = 0;
        }
    }

    /* ════════ LOGGER SYNC (table rows) ══════════════════════ */
    _updateLoggerSync() {
        const container = document.getElementById('wkTodayPlayer');
        if (!container) return;
        const session = window.wkState && window.wkState.activeSession;
        if (!session) return;

        // Build map: exId:setIndex → logged?
        const loggedMap = new Map();
        for (const ex of (session.exercises||[])) {
            for (const s of (ex.sets||[])) {
                loggedMap.set(`${ex.id}:${s.setIndex}`, true);
            }
        }

        // Current step info
        const curStep = this.currentStep;
        const curExId    = curStep && curStep.type === 'SET' ? curStep.exId    : null;
        const curSetIdx  = curStep && curStep.type === 'SET' ? curStep.setIndex : null;
        const curStepId  = curStep ? curStep.stepId : null;

        container.querySelectorAll('[data-exercise-id][data-set-index]').forEach(row => {
            const exId   = row.dataset.exerciseId;
            const setIdx = Number(row.dataset.setIndex);
            const key    = `${exId}:${setIdx}`;

            const isDone    = loggedMap.has(key);
            const isCurrent = (exId === curExId && setIdx === curSetIdx);

            // Find step in queue for skipped check — prefer stepId match
            const stepInQueue = this.steps.find(
                s => s.type === 'SET' && s.exId === exId && s.setIndex === setIdx
            );
            const isSkipped = !isDone && stepInQueue && this.skippedStepIds.has(stepInQueue.stepId);

            row.classList.toggle('is-done', isDone);
            row.classList.toggle('is-skipped', isSkipped);
            row.classList.toggle('wkt-current-set', isCurrent);
            // Legacy class for backwards compat
            row.classList.toggle('done', isDone);
        });

        // Update exercise completion badges
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
        if (this.isRunning && !this._rafId) {
            this._rafId = requestAnimationFrame(this._tickBound);
        }
    }

    _renderOuterSegments() {
        const trackGroup = document.getElementById('wktOuterSegmentsTrack');
        const fillGroup  = document.getElementById('wktOuterSegments');
        if (!trackGroup || !fillGroup) return;
        if (!this.steps.length) { trackGroup.innerHTML = ''; fillGroup.innerHTML = ''; return; }

        const C_OUTER = 904.8;
        const useTime = this.useTimeMode;
        const totalUnits = useTime ? this.totalEstimatedSec : this.steps.length;
        const gapDeg = 1.5;

        let html = '';
        let offset = 0;
        for (let i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];
            const units = useTime ? this._stepEstSec(step) : 1;
            const dashLength = (units / totalUnits) * C_OUTER;
            const color = step.color || (step.type === 'REST' ? (window.REST_COLOR || '#00FFC4') : '#FF3B30');
            const fillLength = Math.max(1, dashLength - gapDeg);

            html += `<circle cx="160" cy="160" r="144" fill="transparent" stroke="${color}" stroke-width="9"
                data-step-id="${step.stepId}"
                data-dash-full="${fillLength}"
                stroke-dasharray="${fillLength} ${C_OUTER}"
                stroke-dashoffset="${-offset}" />`;
            offset += dashLength;
        }
        trackGroup.innerHTML = html;
        fillGroup.innerHTML  = html;
    }

    _setupScrollObserver() {
        const hud  = document.getElementById('wktHud');
        const mini = document.getElementById('wktMiniHud');
        if (!hud || !mini || !('IntersectionObserver' in window)) return;
        if (this._hudObserver) this._hudObserver.disconnect();
        this._hudObserver = new IntersectionObserver(([entry]) => {
            mini.classList.toggle('visible', !entry.isIntersecting);
        }, { threshold: 0.1 });
        this._hudObserver.observe(hud);
    }

    /* ════════ HUD UPDATE ════════════════════════════════════ */
    _syncOuterSegments() {
        const fillGroup = document.getElementById('wktOuterSegments');
        if (!fillGroup || !this.steps.length) return;
        const C_OUTER = 904.8;

        let exList = (this.session && this.session.exercises) ? this.session.exercises : [];

        for (let i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];
            const circ = fillGroup.children[i];
            if (!circ) continue;

            let isComplete = false;
            const isCurrent = (i === this.currentIndex);

            if (this.skippedStepIds.has(step.stepId)) {
                isComplete = false;
            } else if (this.completedStepIds.has(step.stepId)) {
                isComplete = true;
            } else if (step.type === 'SET') {
                const ex = exList.find(e => e.id === step.exId);
                if (ex && ex.sets) {
                    isComplete = ex.sets.some(s => s.setIndex === step.setIndex);
                }
            } else if (step.type === 'REST') {
                isComplete = (i < this.currentIndex);
            }

            const fillLength = parseFloat(circ.getAttribute('data-dash-full')) || 0;

            if (this.phase === WK_PHASE.COMPLETE || isComplete) {
                circ.setAttribute('stroke-dasharray', `${fillLength} ${C_OUTER}`);
                circ.style.opacity = '1';
            } else if (isCurrent) {
                const frac = this._currentStepFrac();
                circ.setAttribute('stroke-dasharray', `${Math.max(0, fillLength * frac)} ${C_OUTER}`);
                circ.style.opacity = '1';
            } else {
                circ.setAttribute('stroke-dasharray', `0 ${C_OUTER}`);
                circ.style.opacity = '0';
            }
        }
    }

    updateHUD() {
        const step = this.currentStep;
        const now  = Date.now();
        const sessionElapsed = Math.floor((now - this.sessionStart) / 1000);

        let innerFrac    = 0;
        let countdownSec = 0;
        let stepLabel    = '';
        let stepSub      = '';

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
                let repStr = '';
                if (step.repMin && step.repMax) {
                    repStr = `${step.repMin}–${step.repMax} reps`;
                } else if (step.repMin || step.repMax) {
                    repStr = `${step.repMin || step.repMax} reps`;
                } else if (step.timerSec > 0) {
                    repStr = `${step.timerSec}s`;
                }

                stepLabel = step.exName;
                stepSub   = repStr || `Set ${step.setIndex}/${step.totalSets}`;

                if (this.phase === WK_PHASE.AWAIT_LOG) {
                    countdownSec = 0;
                    innerFrac    = 1;
                    stepSub      = `Tap "Log Set"${repStr ? ' · ' + repStr : ''}`;
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
                    if (this.phase === WK_PHASE.WORK_MANUAL) {
                        const elapsed = Math.floor((now - this.stepStartAt) / 1000);
                        countdownSec  = -elapsed;
                        innerFrac     = 1;
                    } else if (this.phase === WK_PHASE.PAUSED && this.prevPhase === WK_PHASE.WORK_MANUAL) {
                        const elapsed = Math.floor(this.pauseRemain || 0);
                        countdownSec  = -elapsed;
                        innerFrac     = 1;
                    } else {
                        countdownSec = 0;
                        innerFrac    = 0;
                    }
                }
            }
        }

        const outerFrac  = this.overallFraction;
        const pctText    = `${Math.round(outerFrac * 100)}%`;
        const timeLeftStr = this._fmtHms(this.estimatedRemainingSec);

        /* SVG rings */
        const C_OUTER = 904.8, C_INNER = 703.7;
        this._syncOuterSegments();
        this._setAttr('wktRingInner', 'stroke-dashoffset', C_INNER * (1 - innerFrac));

        /* Theme color */
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
        if (phaseBadgeEl) phaseBadgeEl.style.display = 'none';

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
                && (this.phase === WK_PHASE.WORK_TIMED
                    || this.phase === WK_PHASE.WORK_MANUAL
                    || this.phase === WK_PHASE.IDLE
                    || this.phase === WK_PHASE.PAUSED);
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
        const endIdx   = Math.min(this.steps.length, this.currentIndex + 4);
        const slice    = this.steps.slice(startIdx, endIdx);

        el.innerHTML = slice.map((step, i) => {
            const absIdx    = startIdx + i;
            const isCurrent = absIdx === this.currentIndex;
            const isPast    = absIdx < this.currentIndex;
            const isRest    = step.type === 'REST';
            const color = step.color || (isRest ? (window.REST_COLOR || '#00FFC4') : (window.EXERCISE_PALETTE && window.EXERCISE_PALETTE[0] ? window.EXERCISE_PALETTE[0] : '#FF3B30'));
            const name   = isRest ? `⏱ Rest · ${this._fmtMs(step.durationSec)}` :
                `${step.exName} · Set ${step.setIndex}/${step.totalSets}`;
            return `<div class="wkt-queue-item ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''} ${isRest ? 'rest' : ''}" data-step-id="${step.stepId}">
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
