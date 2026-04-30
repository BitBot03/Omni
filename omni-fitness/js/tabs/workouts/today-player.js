/* ─────────────────────────────────────────────────────────────
   TODAY · LIVE PLAYER (set logging, modals, persistence helpers)
   Depends on: apexDB, wkState, wkSettings, wkTimer, ui.js (esc/toast)
   ───────────────────────────────────────────────────────────── */

window.wkTodayHelpers = (() => {

    /* ── Tracking type normalization ────────────────────────── */
    function normalizeTT(raw) {
        const s = String(raw || 'Weight + Reps').toLowerCase();
        if (s.includes('assist')) return 'assisted_weight_reps';
        if (s.includes('body'))   return 'bodyweight_reps';
        if (s.includes('distance')) return 'distance_time';
        if (s === 'time' || s.includes('time') && !s.includes('reps')) return 'time';
        return 'weight_reps';
    }

    /* ── Calculations ───────────────────────────────────────── */
    function setVolume(set) {
        if (!set) return 0;
        const w = Number(set.weight) || 0;
        const r = Number(set.reps) || 0;
        return w * r;
    }
    function epley1RM(weight, reps) {
        const w = Number(weight) || 0, r = Number(reps) || 0;
        if (w <= 0 || r <= 0) return 0;
        return w * (1 + r / 30);
    }
    function fmtElapsed(startedAt) {
        if (!startedAt) return '0:00';
        const ms = Date.now() - new Date(startedAt).getTime();
        const total = Math.max(0, Math.floor(ms / 1000));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        return h > 0
            ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
            : `${m}:${String(s).padStart(2,'0')}`;
    }

    /* ── Hydrate session.exercises[].sets from workoutSets store ── */
    async function hydrateSessionSets(session) {
        if (!session) return;
        const all = await apexDB.getByIndex('workoutSets', 'sessionId', session.id);
        const byEx = new Map();
        for (const s of (all || [])) {
            if (!byEx.has(s.sessionExerciseId)) byEx.set(s.sessionExerciseId, []);
            byEx.get(s.sessionExerciseId).push(s);
        }
        for (const ex of (session.exercises || [])) {
            const list = (byEx.get(ex.id) || []).sort((a,b) => (a.setIndex||0) - (b.setIndex||0));
            ex.sets = list;
        }
    }

    async function persistSession(session) {
        if (!session) return;
        await apexDB.put('activeSession', session);
    }

    function emit(reason = 'todayUpdated') {
        document.dispatchEvent(new CustomEvent('workoutsChanged', { detail: { reason } }));
    }

    /* ── PR detection ───────────────────────────────────────── */
    async function checkAndUpdatePR(exerciseId, set) {
        const w = Number(set.weight) || 0, r = Number(set.reps) || 0;
        if (w <= 0 || r <= 0) return null;
        const e1 = epley1RM(w, r);
        const existing = await apexDB.get('personalRecords', exerciseId);
        const prev = existing || { id: exerciseId, exerciseId, bestWeight: 0, bestE1RM: 0, bestReps: 0 };
        const prs = [];
        if (w > (prev.bestWeight || 0)) { prs.push({ kind:'weight', value:w, prev:prev.bestWeight||0 }); prev.bestWeight = w; }
        if (e1 > (prev.bestE1RM || 0)) { prs.push({ kind:'e1rm', value:e1, prev:prev.bestE1RM||0 }); prev.bestE1RM = e1; }
        if (r > (prev.bestReps || 0)) { prs.push({ kind:'reps', value:r, prev:prev.bestReps||0 }); prev.bestReps = r; }
        if (prs.length) {
            prev.lastUpdated = new Date().toISOString();
            await apexDB.put('personalRecords', prev);
        }
        return prs.length ? prs : null;
    }

    return {
        normalizeTT, setVolume, epley1RM, fmtElapsed,
        hydrateSessionSets, persistSession, emit, checkAndUpdatePR
    };
})();

/* ─────────────────────────────────────────────────────────────
   LOG SET MODAL
   wkOpenSetModal(exerciseId, setIndex)  setIndex is 1-based
   ───────────────────────────────────────────────────────────── */
window.wkOpenSetModal = function(sessionExerciseId, setIndex) {
    const session = window.wkState && window.wkState.activeSession;
    if (!session) return;
    const ex = (session.exercises || []).find(e => e.id === sessionExerciseId);
    if (!ex) return;

    const H        = window.wkTodayHelpers;
    const tt       = H.normalizeTT(ex.trackingTypeSnapshot || ex.trackingType);
    const settings = window.wkSettings.get();
    const units    = settings.units;
    const step     = settings.weightStep;

    const existing = (ex.sets || []).find(s => s.setIndex === setIndex);
    const prevSet  = (ex.sets || []).filter(s => s.setIndex < setIndex).slice(-1)[0];

    // Defaults: previous set values, or routine targets
    const repTarget = ex.repMax || ex.repMin || 8;
    const wTarget   = Number(ex.targetWeight) || 0;

    const state = {
        weight: existing ? Number(existing.weight) || 0 : (prevSet ? Number(prevSet.weight) || wTarget : wTarget),
        reps:   existing ? Number(existing.reps)   || 0 : (prevSet ? Number(prevSet.reps)   || repTarget : repTarget),
        addedWeight: existing ? Number(existing.addedWeight) || 0 : (prevSet ? Number(prevSet.addedWeight) || 0 : 0),
        durationSec: existing ? Number(existing.durationSec) || 0 : (prevSet ? Number(prevSet.durationSec) || 30 : 30),
        distance: existing ? Number(existing.distance) || 0 : (prevSet ? Number(prevSet.distance) || 1 : 1),
        distanceUnit: existing ? (existing.distanceUnit || 'km') : (prevSet ? (prevSet.distanceUnit || 'km') : 'km'),
        type:   existing ? (existing.type || 'working') : 'working',
        rpe:    existing ? (existing.rpe || ex.targetRPE || 7) : (ex.targetRPE || 7),
        notes:  existing ? (existing.notes || '') : ''
    };

    // Build modal
    const overlay = document.createElement('div');
    overlay.className = 'wk-today-modal-overlay';
    overlay.id = 'wkSetModal';

    function fieldStepper(label, key, stepVal, opts = {}) {
        const min = opts.min ?? 0;
        const sub = opts.sub ?? '';
        return `
        <div class="wk-today-field">
            <p class="wk-today-field-label"><span>${label}</span>${sub ? `<span style="font-weight:700;color:var(--soft);letter-spacing:.06em;">${sub}</span>` : ''}</p>
            <div class="wk-today-stepper">
                <button data-step="${key}" data-delta="${-stepVal}" type="button">−</button>
                <input type="number" id="wkSet_${key}" value="${state[key]}" min="${min}" step="${stepVal}" />
                <button data-step="${key}" data-delta="${stepVal}" type="button">+</button>
            </div>
        </div>`;
    }

    function fieldChips(label, key, options) {
        return `
        <div class="wk-today-field">
            <p class="wk-today-field-label"><span>${label}</span></p>
            <div class="wk-today-chips" data-chips="${key}">
                ${options.map(opt => `<button type="button" class="wk-today-chip ${opt.value} ${state[key]===opt.value?'active':''}" data-val="${opt.value}">${opt.label}</button>`).join('')}
            </div>
        </div>`;
    }

    function fieldRPE() {
        if (!settings.enableRPE) return '';
        return `
        <div class="wk-today-field">
            <p class="wk-today-field-label"><span>RPE</span><span style="color:var(--muted);">Rate of Perceived Exertion</span></p>
            <div class="wk-today-rpe">
                <input type="range" min="1" max="10" step="0.5" value="${state.rpe}" id="wkSet_rpe" class="slider" />
                <span class="wk-today-rpe-val" id="wkSet_rpeVal">${state.rpe}</span>
            </div>
        </div>`;
    }

    function fieldDuration() {
        const m = Math.floor(state.durationSec / 60);
        const s = state.durationSec % 60;
        return `
        <div class="wk-today-field">
            <p class="wk-today-field-label"><span>Duration</span><span style="color:var(--muted);">mm:ss</span></p>
            <div style="display:grid;grid-template-columns:1fr 16px 1fr;gap:8px;align-items:center;">
                <input type="number" id="wkSet_durMin" class="wk-today-input" min="0" value="${m}" style="text-align:center;font-size:18px;font-weight:800;" />
                <span style="text-align:center;font-size:20px;font-weight:900;color:var(--muted);">:</span>
                <input type="number" id="wkSet_durSec" class="wk-today-input" min="0" max="59" value="${s}" style="text-align:center;font-size:18px;font-weight:800;" />
            </div>
        </div>`;
    }

    let body = '';
    if (tt === 'weight_reps') {
        body += fieldStepper(`Weight (${units})`, 'weight', step);
        body += fieldStepper('Reps', 'reps', 1, { sub: ex.repMin && ex.repMax ? `target ${ex.repMin}–${ex.repMax}` : '' });
    } else if (tt === 'bodyweight_reps') {
        body += fieldStepper('Reps', 'reps', 1);
        body += fieldStepper(`Added Weight (${units})`, 'addedWeight', step, { sub: 'optional' });
    } else if (tt === 'assisted_weight_reps') {
        body += fieldStepper('Reps', 'reps', 1);
        body += fieldStepper(`Assistance (${units})`, 'weight', step, { sub: 'reduces bodyweight' });
    } else if (tt === 'time') {
        body += fieldDuration();
    } else if (tt === 'distance_time') {
        body += `
        <div class="wk-today-field">
            <p class="wk-today-field-label"><span>Distance</span></p>
            <div style="display:grid;grid-template-columns:1fr 90px;gap:8px;">
                <input type="number" id="wkSet_distance" class="wk-today-input" min="0" step="0.1" value="${state.distance}" style="text-align:center;font-size:18px;font-weight:800;" />
                <select id="wkSet_distanceUnit" class="wk-today-input" style="font-size:14px;text-align:center;">
                    <option value="m" ${state.distanceUnit==='m'?'selected':''}>m</option>
                    <option value="km" ${state.distanceUnit==='km'?'selected':''}>km</option>
                    <option value="mi" ${state.distanceUnit==='mi'?'selected':''}>mi</option>
                </select>
            </div>
        </div>`;
        body += fieldDuration();
    }

    body += fieldChips('Set Type', 'type', [
        { value:'warmup',  label:'Warmup' },
        { value:'working', label:'Working' },
        { value:'drop',    label:'Drop' },
        { value:'failure', label:'Failure' },
        { value:'tempo',   label:'Tempo' }
    ]);
    body += fieldRPE();
    body += `
        <div class="wk-today-field">
            <p class="wk-today-field-label"><span>Notes</span><span style="color:var(--muted);">optional</span></p>
            <textarea class="wk-today-textarea" id="wkSet_notes" placeholder="How did it feel?">${esc(state.notes)}</textarea>
        </div>`;

    overlay.innerHTML = `
    <div class="wk-today-modal" onclick="event.stopPropagation()">
        <div class="wk-today-modal-head">
            <div>
                <p class="wk-today-modal-title">Set ${setIndex} ${existing ? '· Edit' : ''}</p>
                <p class="wk-today-modal-sub">${esc(ex.exerciseName || ex.exerciseNameSnapshot || 'Exercise')}</p>
            </div>
            <button class="wk-today-modal-close" type="button" id="wkSetModalClose" aria-label="Close">×</button>
        </div>
        ${body}
        <div class="wk-today-modal-foot">
            ${existing ? `<button class="wk-today-btn danger" id="wkSetDelete" type="button">Delete</button>` : ''}
            <button class="wk-today-btn ghost" id="wkSetCancel" type="button">Cancel</button>
            <button class="wk-today-btn green" id="wkSetSave" type="button">${existing ? 'Update Set' : 'Save Set'}</button>
        </div>
    </div>`;

    document.body.appendChild(overlay);

    // Close interactions
    function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) {
        if (e.key === 'Escape') close();
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
    }
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    overlay.querySelector('#wkSetModalClose').onclick = close;
    overlay.querySelector('#wkSetCancel').onclick = close;

    // Steppers
    overlay.querySelectorAll('[data-step]').forEach(btn => {
        btn.onclick = () => {
            const key = btn.dataset.step;
            const delta = Number(btn.dataset.delta);
            const input = overlay.querySelector(`#wkSet_${key}`);
            const cur = Number(input.value) || 0;
            const next = Math.max(0, cur + delta);
            input.value = key === 'reps' ? Math.round(next) : next;
            state[key] = Number(input.value);
        };
    });
    overlay.querySelectorAll('input[type=number]').forEach(inp => {
        inp.oninput = () => {
            const key = inp.id.replace('wkSet_', '');
            state[key] = Number(inp.value) || 0;
        };
    });

    // Chips
    overlay.querySelectorAll('[data-chips]').forEach(group => {
        const key = group.dataset.chips;
        group.querySelectorAll('.wk-today-chip').forEach(chip => {
            chip.onclick = () => {
                group.querySelectorAll('.wk-today-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                state[key] = chip.dataset.val;
            };
        });
    });

    // RPE
    const rpeInp = overlay.querySelector('#wkSet_rpe');
    if (rpeInp) {
        rpeInp.oninput = () => {
            state.rpe = Number(rpeInp.value);
            overlay.querySelector('#wkSet_rpeVal').textContent = state.rpe;
        };
    }

    // Notes
    overlay.querySelector('#wkSet_notes').oninput = (e) => { state.notes = e.target.value; };

    // Delete
    if (existing) {
        overlay.querySelector('#wkSetDelete').onclick = async () => {
            await apexDB.delete('workoutSets', existing.id);
            ex.sets = (ex.sets || []).filter(s => s.id !== existing.id);
            await window.wkTodayHelpers.persistSession(session);
            window.wkTodayHelpers.emit('setDeleted');
            window.drawWorkoutPanel();
            toast('Set deleted');
            close();
        };
    }

    async function save() {
        // Capture duration if applicable
        const durMin = Number(overlay.querySelector('#wkSet_durMin')?.value) || 0;
        const durSec = Number(overlay.querySelector('#wkSet_durSec')?.value) || 0;
        state.durationSec = durMin * 60 + durSec;
        const distInp = overlay.querySelector('#wkSet_distance');
        const distUnitSel = overlay.querySelector('#wkSet_distanceUnit');
        if (distInp) state.distance = Number(distInp.value) || 0;
        if (distUnitSel) state.distanceUnit = distUnitSel.value;

        // Build set record
        const record = existing ? { ...existing } : {
            id: 'set_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6),
            sessionId: session.id,
            sessionExerciseId: ex.id,
            exerciseId: ex.exerciseId,
            setIndex,
            trackingType: tt,
            createdAt: new Date().toISOString()
        };
        record.weight       = state.weight;
        record.reps         = state.reps;
        record.addedWeight  = state.addedWeight;
        record.durationSec  = state.durationSec;
        record.distance     = state.distance;
        record.distanceUnit = state.distanceUnit;
        record.type         = state.type;
        record.rpe          = settings.enableRPE ? state.rpe : null;
        record.notes        = state.notes;
        record.units        = units;
        record.completedAt  = new Date().toISOString();

        // Persist
        await apexDB.put('workoutSets', record);

        // Update in-memory
        ex.sets = ex.sets || [];
        const i = ex.sets.findIndex(s => s.id === record.id);
        if (i >= 0) ex.sets[i] = record; else ex.sets.push(record);
        ex.sets.sort((a,b) => (a.setIndex||0) - (b.setIndex||0));
        await window.wkTodayHelpers.persistSession(session);

        // PR detection (only for weight_reps and only on new sets, not warmup)
        let prs = null;
        if (!existing && tt === 'weight_reps' && record.type !== 'warmup') {
            prs = await window.wkTodayHelpers.checkAndUpdatePR(ex.exerciseId, record);
        }

        window.wkTodayHelpers.emit(existing ? 'setUpdated' : 'setLogged');
        window.drawWorkoutPanel();
        close();
        toast(existing ? 'Set updated' : (prs ? '🏆 New personal record!' : 'Set saved'));

        // Auto rest timer
        if (!existing && window.wkSettings.get().autoRestTimer) {
            window.wkMaybeStartRest(ex, setIndex, session);
        }
    }

    overlay.querySelector('#wkSetSave').onclick = save;

    // Autofocus first numeric field
    setTimeout(() => {
        const first = overlay.querySelector('input[type=number]');
        if (first) { first.focus(); first.select && first.select(); }
    }, 60);
};

/* ─────────────────────────────────────────────────────────────
   REST TIMER LOGIC
   - Standard block: rest after every set using ex.restSeconds
   - Superset/Giant/Circuit: rest only when round complete
   ───────────────────────────────────────────────────────────── */
window.wkMaybeStartRest = function(ex, setIndex, session) {
    const block = (session.blocks || []).find(b => b.id === ex.blockId);
    const blockType = block ? (block.type || 'normal') : 'normal';
    const restEx = Number(ex.restSeconds) || 0;
    const restBlock = block ? Number(block.restAfterBlockSeconds) || 0 : 0;

    if (!block || blockType === 'normal' || blockType === 'standard') {
        if (restEx > 0) wkTimer.start(restEx, ex.exerciseName || 'Next set');
        return;
    }

    // Group block — check round complete
    const blockExs = (session.exercises || []).filter(e => e.blockId === block.id);
    const allDone = blockExs.every(e => (e.sets || []).some(s => s.setIndex === setIndex));
    if (allDone) {
        if (restBlock > 0) wkTimer.start(restBlock, `Round ${setIndex} complete · ${block.name}`);
    }
    // Otherwise: continue immediately to next exercise in superset (no rest)
};

/* ─────────────────────────────────────────────────────────────
   ADD-EXERCISE PICKER
   ───────────────────────────────────────────────────────────── */
window.wkOpenExercisePicker = function(blockId = null) {
    const list = (window.wkState && window.wkState.exercises) || [];
    const overlay = document.createElement('div');
    overlay.className = 'wk-today-modal-overlay';
    overlay.innerHTML = `
    <div class="wk-today-modal wk-today-picker" onclick="event.stopPropagation()">
        <div class="wk-today-modal-head">
            <div>
                <p class="wk-today-modal-title">Add Exercise</p>
                <p class="wk-today-modal-sub">Pick from your library</p>
            </div>
            <button class="wk-today-modal-close" type="button" id="wkPickClose">×</button>
        </div>
        <input type="text" class="wk-today-search" id="wkPickSearch" placeholder="Search exercises…" autocomplete="off" />
        <div class="wk-today-picker-list" id="wkPickList"></div>
    </div>`;
    document.body.appendChild(overlay);

    function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    overlay.querySelector('#wkPickClose').onclick = close;

    const listEl = overlay.querySelector('#wkPickList');
    const searchEl = overlay.querySelector('#wkPickSearch');

    function renderList(filter = '') {
        const f = filter.trim().toLowerCase();
        const items = list.filter(ex => !f
            || (ex.name || '').toLowerCase().includes(f)
            || (ex.primaryMuscle || ex.muscle || '').toLowerCase().includes(f)
            || (ex.equipment || '').toLowerCase().includes(f)
        ).slice(0, 80);
        if (!items.length) {
            listEl.innerHTML = `<div class="wk-today-empty"><p>No exercises match "${esc(filter)}"</p></div>`;
            return;
        }
        listEl.innerHTML = items.map(ex => `
            <div class="wk-today-picker-item" data-id="${esc(ex.id)}">
                <div>
                    <div class="nm">${esc(ex.name)}</div>
                    <div class="meta">${esc(ex.primaryMuscle || ex.muscle || '')} ${ex.equipment ? `· ${esc(ex.equipment)}` : ''}</div>
                </div>
                <span class="wk-today-btn teal sm">+ Add</span>
            </div>`).join('');
        listEl.querySelectorAll('.wk-today-picker-item').forEach(it => {
            it.onclick = () => {
                const id = it.dataset.id;
                const ex = list.find(e => e.id === id);
                if (ex) { addExerciseToSession(ex, blockId); close(); }
            };
        });
    }

    searchEl.oninput = (e) => renderList(e.target.value);
    renderList('');
    setTimeout(() => searchEl.focus(), 80);
};

async function addExerciseToSession(libEx, blockId = null) {
    const session = window.wkState && window.wkState.activeSession;
    if (!session) return;

    // Ensure an "Added" block exists if none specified and no blocks
    if (!blockId) {
        let added = (session.blocks || []).find(b => b.id === '_added');
        if (!added) {
            added = { id:'_added', name:'Added', type:'normal', order:9999, restAfterBlockSeconds:0 };
            session.blocks = session.blocks || [];
            session.blocks.push(added);
        }
        blockId = '_added';
    }

    const newEx = {
        id: 'sex_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,5),
        blockId,
        exerciseId: libEx.id,
        exerciseName: libEx.name,
        exerciseNameSnapshot: libEx.name,
        color: libEx.color || window.EXERCISE_PALETTE[session.exercises ? session.exercises.length % window.EXERCISE_PALETTE.length : 0] || '#FF3B30',
        trackingTypeSnapshot: libEx.trackingType || 'Weight + Reps',
        targetSets: 3,
        repMin: 8, repMax: 12,
        restSeconds: 90,
        targetWeight: null, targetRPE: null, tempo: null, notes: null,
        progressionRule: 'none',
        sets: []
    };
    session.exercises = session.exercises || [];
    session.exercises.push(newEx);
    await window.wkTodayHelpers.persistSession(session);
    window.wkTodayHelpers.emit('exerciseAdded');
    window.drawWorkoutPanel();
    toast(`Added: ${libEx.name}`);
}
window.wkAddExerciseToSession = addExerciseToSession;

/* ─────────────────────────────────────────────────────────────
   NOTES MODAL
   ───────────────────────────────────────────────────────────── */
window.wkOpenNotesModal = function(target = 'session', exerciseId = null) {
    const session = window.wkState && window.wkState.activeSession;
    if (!session) return;
    const ex = exerciseId ? (session.exercises || []).find(e => e.id === exerciseId) : null;
    const cur = target === 'session' ? (session.notes || '') : (ex ? (ex.notes || '') : '');

    const overlay = document.createElement('div');
    overlay.className = 'wk-today-modal-overlay';
    overlay.innerHTML = `
    <div class="wk-today-modal" onclick="event.stopPropagation()">
        <div class="wk-today-modal-head">
            <div>
                <p class="wk-today-modal-title">${target === 'session' ? 'Session Notes' : 'Exercise Notes'}</p>
                <p class="wk-today-modal-sub">${ex ? esc(ex.exerciseName) : esc(session.name)}</p>
            </div>
            <button class="wk-today-modal-close" type="button" id="wkNoteClose">×</button>
        </div>
        <textarea class="wk-today-textarea" id="wkNoteText" style="min-height:140px;" placeholder="Add a note…">${esc(cur)}</textarea>
        <div class="wk-today-modal-foot">
            <button class="wk-today-btn ghost" type="button" id="wkNoteCancel">Cancel</button>
            <button class="wk-today-btn green" type="button" id="wkNoteSave">Save</button>
        </div>
    </div>`;
    document.body.appendChild(overlay);

    function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    overlay.querySelector('#wkNoteClose').onclick = close;
    overlay.querySelector('#wkNoteCancel').onclick = close;
    overlay.querySelector('#wkNoteSave').onclick = async () => {
        const v = overlay.querySelector('#wkNoteText').value;
        if (target === 'session') session.notes = v;
        else if (ex) ex.notes = v;
        await window.wkTodayHelpers.persistSession(session);
        window.wkTodayHelpers.emit('notesUpdated');
        window.drawWorkoutPanel();
        toast('Notes saved');
        close();
    };
    setTimeout(() => overlay.querySelector('#wkNoteText').focus(), 60);
};

/* ─────────────────────────────────────────────────────────────
   ADD-SET HELPER (extra set beyond target)
   ───────────────────────────────────────────────────────────── */
window.wkAddExtraSet = function(sessionExerciseId) {
    const session = window.wkState && window.wkState.activeSession;
    if (!session) return;
    const ex = (session.exercises || []).find(e => e.id === sessionExerciseId);
    if (!ex) return;
    const completed = (ex.sets || []).length;
    const target    = Number(ex.targetSets) || 0;
    const nextIdx   = Math.max(target, completed) + 1;
    // Bump targetSets to include new set so it always shows
    ex.targetSets = Math.max(target, nextIdx);
    window.wkTodayHelpers.persistSession(session).then(() => window.drawWorkoutPanel());
    window.wkOpenSetModal(sessionExerciseId, nextIdx);
};

/* ─────────────────────────────────────────────────────────────
   REMOVE EXERCISE FROM SESSION
   ───────────────────────────────────────────────────────────── */
window.wkRemoveExerciseFromSession = async function(sessionExerciseId) {
    if (!confirm('Remove this exercise and all its logged sets?')) return;
    const session = window.wkState && window.wkState.activeSession;
    if (!session) return;
    const ex = (session.exercises || []).find(e => e.id === sessionExerciseId);
    if (ex && ex.sets) {
        for (const s of ex.sets) await apexDB.delete('workoutSets', s.id);
    }
    session.exercises = (session.exercises || []).filter(e => e.id !== sessionExerciseId);
    await window.wkTodayHelpers.persistSession(session);
    window.wkTodayHelpers.emit('exerciseRemoved');
    window.drawWorkoutPanel();
    toast('Exercise removed');
};
