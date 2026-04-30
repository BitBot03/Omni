/* ─────────────────────────────────────────────────────────────
   TODAY · WORKOUT RUNNER (step queue + HUD engine)
   Builds a flattened step queue from the active session and
   drives the dual-ring HUD, auto-advances rest timers, and
   integrates with existing set-log modals.

   Public API (via window.wkRunner):
     new WkRunner(session) → instance
     .start()        → begin timing current step
     .pause()        → pause
     .togglePlay()   → start or pause
     .next()         → skip to next step
     .prev()         → go back one step
     .skipRest()     → end rest immediately (only during REST)
     .logCurrent()   → open wkOpenSetModal for current SET step
     .attachDOM()    → (re)connect to DOM after re-render
     .destroy()      → cleanup, remove listeners

   Events emitted on document:
     'wkRunnerTick'  → every rAF frame while running
   ───────────────────────────────────────────────────────────── */

class WkRunner {
    constructor(session) {
        this.session      = session;
        this.sessionStart = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
        this.steps        = this._buildQueue(session);
        this.currentIndex = 0;
        this.isRunning    = false;
        this.isPaused     = false;
        this.endAt        = 0;
        this.stepStartAt  = Date.now();
        this._rafId       = null;
        this._tickBound   = this._tick.bind(this);
        this._onChanged   = this._onChanged.bind(this);
        this.skippedSteps = new Set(); // indices of SET steps skipped without logging
        document.addEventListener('workoutsChanged', this._onChanged);
    }

    /* ── Step queue builder ───────────────────────────────── */
    _buildQueue(session) {
        const steps    = [];
        const defRest  = 90;
        const exercises= session.exercises || [];
        const blocks   = (session.blocks || []).slice().sort((a,b) => (a.order||0)-(b.order||0));

        const processBlock = (block, exs) => {
            const type = (block.type || 'normal').toLowerCase();
            const isGroup = (type === 'superset' || type === 'giant' || type === 'circuit');

            if (!isGroup) {
                // Standard: linear set order per exercise
                for (const ex of exs) {
                    const totalSets = Number(ex.targetSets) || 3;
                    const tt = this._normTT(ex.trackingTypeSnapshot || ex.trackingType);
                    const timerSec = tt === 'time' ? (Number(ex.setTimeSec) || 0) : 0;
                    for (let i = 1; i <= totalSets; i++) {
                        steps.push({
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
                            timerSec,
                            repMin: ex.repMin || 0,
                            repMax: ex.repMax || 0,
                        });
                        if (i < totalSets) {
                            const rest = Number(ex.restSeconds) || defRest;
                            steps.push({ type:'REST', durationSec: rest, label: `Rest · ${ex.exerciseName || 'Next set'}`, color: window.REST_COLOR || '#00FFC4' });
                        }
                    }
                }
            } else {
                // Superset/Giant/Circuit: round-based
                const maxRounds = Math.max(...exs.map(e => Number(e.targetSets)||3), 1);
                const blockRest = Number(block.restAfterBlockSeconds) || defRest;
                for (let round = 1; round <= maxRounds; round++) {
                    const roundExs = exs.filter(e => round <= (Number(e.targetSets)||3));
                    for (const ex of roundExs) {
                        const tt = this._normTT(ex.trackingTypeSnapshot || ex.trackingType);
                        const timerSec = tt === 'time' ? (Number(ex.setTimeSec) || 0) : 0;
                        steps.push({
                            type: 'SET',
                            exId: ex.id,
                            exName: ex.exerciseName || ex.exerciseNameSnapshot || 'Exercise',
                            color: ex.color || (window.EXERCISE_PALETTE && window.EXERCISE_PALETTE[0]) || '#FF3B30',
                            setIndex: round,
                            totalSets: Number(ex.targetSets)||3,
                            blockId: block.id,
                            blockName: block.name || 'Block',
                            blockType: type,
                            trackingType: tt,
                            timerSec,
                            repMin: ex.repMin || 0,
                            repMax: ex.repMax || 0,
                        });
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
        if (s === 'time' || (s.includes('time') && !s.includes('reps'))) return 'time';
        return 'weight_reps';
    }

    /* ── Playback controls ───────────────────────────────── */
    start() {
        if (this.isRunning && !this.isPaused) return;
        this.isRunning = true;
        this.isPaused  = false;
        const step = this.currentStep;
        if (step) {
            const dur = this._stepDuration(step);
            if (dur > 0) {
                this.endAt = Date.now() + dur * 1000;
            }
        }
        this.stepStartAt = Date.now();
        if (!this._rafId) this._rafId = requestAnimationFrame(this._tickBound);
        this.updateHUD();
    }

    pause() {
        if (!this.isRunning) return;
        this.isPaused = true;
        if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
        this.updateHUD();
    }

    togglePlay() {
        if (!this.isRunning || this.isPaused) this.start();
        else this.pause();
    }

    next() {
        const step = this.currentStep;
        if (step && step.type === 'SET') {
            // Mark as skipped if not yet logged
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
        const dur = this._stepDuration(this.currentStep);
        this.endAt = dur > 0 ? Date.now() + dur * 1000 : 0;
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
        this.isRunning = false;
        this.isPaused  = false;
        if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    }

    destroy() {
        this.stop();
        document.removeEventListener('workoutsChanged', this._onChanged);
    }

    /* ── Properties ──────────────────────────────────────── */
    get currentStep() { return this.steps[this.currentIndex] || null; }
    get totalSteps()  { return this.steps.length; }

    get overallFraction() {
        if (!this.totalSteps) return 0;
        return Math.min(1, this.currentIndex / this.totalSteps);
    }

    get totalEstimatedSec() {
        return this.steps.reduce((s, step) => {
            if (step.type === 'REST') return s + step.durationSec;
            if (step.type === 'SET' && step.timerSec > 0) return s + step.timerSec;
            return s + 45; // estimate 45s per manual set
        }, 0);
    }

    /* ── Internals ───────────────────────────────────────── */
    _stepDuration(step) {
        if (!step) return 0;
        if (step.type === 'REST') return step.durationSec || 0;
        if (step.type === 'SET' && step.timerSec > 0) return step.timerSec;
        return 0; // manual set: no fixed duration
    }

    _tick() {
        if (!this.isRunning || this.isPaused) { this._rafId = null; return; }
        const step = this.currentStep;
        if (step) {
            const dur = this._stepDuration(step);
            if (dur > 0 && this.endAt > 0) {
                const remaining = Math.max(0, (this.endAt - Date.now()) / 1000);
                if (remaining <= 0) {
                    this._onStepComplete(step);
                    return;
                }
            }
        }
        this.updateHUD();
        this._rafId = requestAnimationFrame(this._tickBound);
    }

    _onStepComplete(step) {
        if (step.type === 'REST') {
            this._vibrate([100, 60, 180]);
            this._beep(660, 0.06, 0.15);
            if (typeof toast === 'function') toast('Rest done — go!');
            this._advance();
        } else if (step.type === 'SET') {
            // Timed set complete
            this._vibrate([120]);
            this._beep(880, 0.06, 0.12);
            if (typeof toast === 'function') toast(`Set timer done — log it!`);
            // Pause runner, let user log
            this.isPaused = true;
            this._rafId = null;
            this.updateHUD();
        }
    }

    _advance() {
        if (this.currentIndex >= this.totalSteps - 1) {
            // Reached end
            this.currentIndex = Math.min(this.currentIndex + 1, this.totalSteps);
            this.isRunning = false;
            this.isPaused  = false;
            if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
            this.updateHUD();
            if (typeof toast === 'function') toast('All planned sets done! Great work 💪');
            return;
        }
        this.currentIndex++;
        this.stepStartAt = Date.now();
        const step = this.currentStep;
        const dur  = this._stepDuration(step);
        this.endAt = (dur > 0 && this.isRunning && !this.isPaused)
            ? Date.now() + dur * 1000 : 0;
        this.updateHUD();
        if (this.isRunning && !this.isPaused && this._rafId === null) {
            this._rafId = requestAnimationFrame(this._tickBound);
        }
    }

    _onChanged(e) {
        const reason = e && e.detail && e.detail.reason;
        if (reason !== 'setLogged' && reason !== 'setUpdated') return;
        this._syncStepsToLogs();
        this._updateLoggerSync();
        this.updateHUD();
    }

    _syncStepsToLogs() {
        // Advance past any SET steps that now have a logged set
        const session = window.wkState && window.wkState.activeSession;
        if (!session) return;
        // Check if current step is already logged
        const step = this.currentStep;
        if (!step || step.type !== 'SET') return;
        const ex = (session.exercises||[]).find(e => e.id === step.exId);
        if (!ex) return;
        const hasLogged = (ex.sets||[]).some(s => s.setIndex === step.setIndex);
        if (hasLogged) {
            // Move to next step and start rest if running
            const wasRunning = this.isRunning && !this.isPaused;
            this._advance();
            if (!wasRunning && this.isRunning) {
                // Auto-start rest if autoRestTimer enabled
                if (window.wkSettings && window.wkSettings.get().autoRestTimer) {
                    this.start();
                }
            }
        }
    }

    /* ── Logger sync: mark rows done/skipped in real-time ── */
    _updateLoggerSync() {
        const container = document.getElementById('wkTodayPlayer');
        if (!container) return;
        const session = window.wkState && window.wkState.activeSession;
        if (!session) return;

        // Build quick lookup of logged sets: "exId:setIndex" → true
        const loggedMap = new Map();
        for (const ex of (session.exercises||[])) {
            for (const s of (ex.sets||[])) {
                loggedMap.set(`${ex.id}:${s.setIndex}`, true);
            }
        }

        // Update each set row
        container.querySelectorAll('[data-exercise-id][data-set-index]').forEach(row => {
            const exId   = row.dataset.exerciseId;
            const setIdx = Number(row.dataset.setIndex);
            const isDone = loggedMap.has(`${exId}:${setIdx}`);
            // Find step index to check skipped
            const stepIdx = this.steps.findIndex(
                s => s.type === 'SET' && s.exId === exId && s.setIndex === setIdx
            );
            const isSkipped = !isDone && stepIdx >= 0 && this.skippedSteps.has(stepIdx);
            row.classList.toggle('is-done', isDone);
            row.classList.toggle('is-skipped', isSkipped);
        });

        // Mark exercise cards as complete when all sets logged
        container.querySelectorAll('[data-ex-id]').forEach(exEl => {
            const exId = exEl.dataset.exId;
            const ex = (session.exercises||[]).find(e => e.id === exId);
            if (!ex) return;
            const target = Number(ex.targetSets) || 0;
            const done   = (ex.sets||[]).length;
            exEl.classList.toggle('complete', done >= target && target > 0);
        });
    }

    /* ── DOM attachment & HUD update ─────────────────────── */
    attachDOM() {
        // Called after every re-render to re-connect to new DOM nodes
        this._setupScrollObserver();
        this._renderOuterSegments();
        this.updateHUD();
    }

    _renderOuterSegments() {
        const trackGroup = document.getElementById('wktOuterSegmentsTrack');
        const fillGroup = document.getElementById('wktOuterSegments');
        if (!trackGroup || !fillGroup) return;

        const totalSteps = this.steps.length;
        if (totalSteps === 0) return;

        let html = '';
        let currentOffset = 0;
        const C_OUTER = 904.8; // circumference

        this.steps.forEach(step => {
            const fraction = 1 / totalSteps;
            const dashLength = fraction * C_OUTER;
            
            const color = step.color || (step.type === 'REST' ? (window.REST_COLOR || '#00FFC4') : '#FF3B30');

            html += `<circle cx="160" cy="160" r="144" fill="transparent" stroke="${color}" stroke-width="9" 
                        stroke-dasharray="${Math.max(1, dashLength - 1.5)} ${C_OUTER}" 
                        stroke-dashoffset="${-currentOffset}" />`;
            currentOffset += dashLength;
        });

        trackGroup.innerHTML = html;
        fillGroup.innerHTML = html;
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

    updateHUD() {
        const step  = this.currentStep;
        const now   = Date.now();
        const sessionElapsed = Math.floor((now - this.sessionStart) / 1000);

        /* ── Inner ring ─────────────────────────────────── */
        let innerFrac = 0;
        let countdownSec = 0;
        let isRest = false;
        let stepLabel = '';
        let stepSub   = '';
        let playIcon  = (this.isRunning && !this.isPaused) 
            ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>' 
            : '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

        if (step) {
            const dur = this._stepDuration(step);
            if (step.type === 'REST') {
                isRest = true;
                stepLabel = 'Rest';
                stepSub   = step.label || 'Next set';
                if (dur > 0 && this.endAt > 0 && this.isRunning && !this.isPaused) {
                    const rem = Math.max(0, (this.endAt - now) / 1000);
                    innerFrac   = 1 - (rem / dur); // fills as time passes
                    countdownSec = Math.ceil(rem);
                } else if (dur > 0) {
                    countdownSec = dur;
                    innerFrac = 0;
                }
            } else { // SET
                const repStr = step.repMin && step.repMax ? `${step.repMin}–${step.repMax} reps` : '';
                stepLabel = step.exName;
                stepSub   = `Set ${step.setIndex}/${step.totalSets}${repStr ? ' · ' + repStr : ''}`;

                if (dur > 0 && this.isRunning && !this.isPaused && this.endAt > 0) {
                    const rem = Math.max(0, (this.endAt - now) / 1000);
                    innerFrac    = 1 - (rem / dur);
                    countdownSec = Math.ceil(rem);
                } else if (dur > 0) {
                    countdownSec = dur;
                    innerFrac = 0;
                } else {
                    // Manual set: show stopwatch since stepStartAt
                    const elapsed = Math.floor((now - this.stepStartAt) / 1000);
                    innerFrac = Math.min(0.98, elapsed / 90); // visual arc, not depleting
                    countdownSec = -elapsed; // negative = count-up
                }
            }
        } else if (this.currentIndex >= this.totalSteps && this.totalSteps > 0) {
            stepLabel = 'Complete!';
            stepSub   = 'All sets done';
            innerFrac = 1;
            playIcon  = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>';
        } else {
            stepLabel = 'Ready';
            stepSub   = 'Press ▶ to start';
        }

        /* ── Outer ring: overall progress ─────────────────── */
        const outerFrac = this.overallFraction;
        const pctText   = `${Math.round(outerFrac * 100)}%`;

        /* ── Time left estimate ──────────────────────────── */
        let timeLeftStr = '—';
        const totalSec  = this.totalEstimatedSec;
        if (totalSec > 0) {
            const timeLeftSec = Math.max(0, totalSec - sessionElapsed);
            timeLeftStr = this._fmt(timeLeftSec);
        }

        /* ── Update DOM ──────────────────────────────────── */
        // SVG rings
        const C_OUTER = 904.8; // 2π×144
        const C_INNER = 703.7; // 2π×112
        this._setAttr('wktRingOuter', 'stroke-dashoffset', C_OUTER * (1 - outerFrac));
        this._setAttr('wktRingInner', 'stroke-dashoffset', C_INNER * (1 - innerFrac));
        // Ring color class & inline theme
        const ringInner = document.getElementById('wktRingInner');
        if (ringInner) {
            ringInner.classList.toggle('rest', isRest);
        }

        const els = [document.getElementById('wktHud'), document.getElementById('wktMiniHud')].filter(Boolean);
        let hue = '#00d4ff';
        if (this.currentIndex >= this.totalSteps && this.totalSteps > 0) {
            hue = '#39ff14'; // complete green
        } else if (!this.isRunning || this.isPaused) {
            hue = '#b4becd'; // paused gray
        } else if (step && step.color) {
            hue = step.color;
        } else if (isRest) {
            hue = window.REST_COLOR || '#00FFC4';
        }

        const r = parseInt(hue.slice(1, 3), 16) || 0;
        const g = parseInt(hue.slice(3, 5), 16) || 212;
        const b = parseInt(hue.slice(5, 7), 16) || 255;

        els.forEach(hud => {
            hud.style.setProperty('--ph-clr', hue);
            hud.style.setProperty('--ph-clr-rgb', `${r}, ${g}, ${b}`);
            hud.style.setProperty('--ph-glow', `rgba(${r},${g},${b},.52)`);
            hud.style.setProperty('--ph-dim', `rgba(${r},${g},${b},.14)`);
            hud.style.setProperty('--ph-border', `rgba(${r},${g},${b},.28)`);
            hud.style.setProperty('--ph-text', hue);
            hud.style.setProperty('--out-clr', `rgba(${r},${g},${b},.65)`);
        });

        // Center text
        const timeDisplay = countdownSec < 0
            ? this._fmtMs(-countdownSec) // stopwatch
            : (step && this._stepDuration(step) > 0 ? this._fmtMs(countdownSec) : '');

        this._setText('wktRcName', stepLabel);
        this._setText('wktRcTime', timeDisplay);
        this._setText('wktRcSub', stepSub);
        this._setText('wktOuterPct', pctText);

        // Top bar
        this._setText('wktTsElapsed', this._fmtHms(sessionElapsed));
        const setInfo = step && step.type === 'SET' ? `${step.setIndex}/${step.totalSets}` : '—';
        this._setText('wktTsSet', setInfo);
        this._setText('wktTsLeft', timeLeftStr);

        // Stats col
        this._setText('wktStatElapsed', this._fmtHms(sessionElapsed));
        this._setText('wktStatLeft', timeLeftStr);
        const setsDone = this._countLoggedSets();
        this._setText('wktStatSets', String(setsDone));
        this._setText('wktStatPct', pctText);

        // Play button
        const playBtn = document.getElementById('wktBtnPlay');
        if (playBtn) playBtn.innerHTML = playIcon;

        // Phase: set data-phase on HUD root for CSS variable switching
        const hudEl = document.getElementById('wktHud');
        if (hudEl) {
            let phase = 'idle';
            if (this.currentIndex >= this.totalSteps && this.totalSteps > 0) {
                phase = 'complete';
            } else if (this.isPaused) {
                phase = 'paused';
            } else if (this.isRunning && step && step.type === 'REST') {
                phase = 'rest';
            } else if (this.isRunning && step) {
                phase = 'work';
            }
            if (hudEl.dataset.phase !== phase) hudEl.dataset.phase = phase;
        }

        // Phase badge text
        const phaseBadgeEl = document.getElementById('wktPhaseBadge');
        if (phaseBadgeEl) {
            const phaseMap = { work:'WORK', rest:'REST', paused:'PAUSED', idle:'READY', complete:'DONE' };
            const ph = hudEl ? hudEl.dataset.phase : 'idle';
            phaseBadgeEl.textContent = phaseMap[ph] || 'READY';
            phaseBadgeEl.className = 'wkt-phase-badge wkt-phase-badge--' + (ph || 'idle');
        }

        // Skip rest button
        const skipBtn = document.getElementById('wktBtnSkipRest');
        if (skipBtn) {
            const canSkip = step && step.type === 'REST' && this.isRunning && !this.isPaused;
            skipBtn.disabled = !canSkip;
            skipBtn.classList.toggle('active', canSkip);
        }

        // Log button: highlight if current step is SET
        const logBtn = document.getElementById('wktBtnLog');
        if (logBtn) {
            const isSet = step && step.type === 'SET';
            logBtn.disabled = !isSet;
            logBtn.classList.toggle('active', isSet);
        }

        // Next-up text (mobile)
        const nextStep = this.steps[this.currentIndex + 1];
        let nextText = '';
        if (nextStep) {
            if (nextStep.type === 'REST') nextText = `Break · ${this._fmtMs(nextStep.durationSec)}`;
            else nextText = `${nextStep.exName} · Set ${nextStep.setIndex}/${nextStep.totalSets}`;
        }
        this._setText('wktNextupVal', nextText || '—');
        const nextupEl = document.getElementById('wktNextup');
        if (nextupEl) nextupEl.style.display = nextText ? '' : 'none';

        // Queue list (desktop)
        this._renderQueue();

        // Mini HUD
        this._updateMiniHud(stepLabel, timeDisplay, isRest, innerFrac, outerFrac, playIcon);
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
                <span class="wkt-qi-dot" style="background-color: ${color}; ${isCurrent ? `box-shadow: 0 0 7px ${color}80; border-color: ${color};` : 'border-color: ' + color + '80;'}"></span>
                <span class="wkt-qi-text" style="${isCurrent ? `color: ${color}; font-weight: 700;` : ''}">${esc(name)}</span>
            </div>`;
        }).join('');
    }

    _updateMiniHud(label, time, isRest, innerFrac, outerFrac, playIcon) {
        const mini = document.getElementById('wktMiniHud');
        if (!mini) return;
        const C = 100.5; // 2π×16
        const innerOff = C * (1 - innerFrac);
        const outerOff = C * (1 - outerFrac);
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

    /* ── Helpers ──────────────────────────────────────────── */
    _fmt(s) {
        s = Math.max(0, Math.round(s));
        const m = Math.floor(s / 60), sec = s % 60;
        return `${m}:${String(sec).padStart(2,'0')}`;
    }
    _fmtMs(s) { return this._fmt(s); }
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
        if (el) el.textContent = text;
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
        try { if (navigator.vibrate) navigator.vibrate(pattern); } catch(e){}
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

window.wkRunnerInit = function(session) {
    if (window.wkRunner) window.wkRunner.destroy();
    window.wkRunner = new WkRunner(session);
};

/* ── Intercept rest timer when runner is active ─────────── */
// today-player.js is loaded before this script, so wkMaybeStartRest is defined.
(function() {
    const _orig = window.wkMaybeStartRest;
    window.wkMaybeStartRest = function(ex, setIndex, session) {
        if (window.wkRunner && window.wkRunner.isRunning) {
            // Runner handles rest display; skip floating widget but sync steps
            window.wkRunner._syncStepsToLogs();
            return;
        }
        _orig && _orig(ex, setIndex, session);
    };
})();
