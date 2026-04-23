// ════════════════════════════════════════════════════════════════
//  OMNI Routines Planning Engine  — Full Implementation
// ════════════════════════════════════════════════════════════════
;(function () {

// ── CONSTANTS ──────────────────────────────────────────────────

const RT_GOALS = {
    strength:    { label: 'Strength',    color: '#ff7a00', bg: 'rgba(255,122,0,0.12)'  },
    hypertrophy: { label: 'Hypertrophy', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
    endurance:   { label: 'Endurance',   color: '#39ff14', bg: 'rgba(57,255,20,0.10)'  },
    general:     { label: 'General',     color: '#00d4ff', bg: 'rgba(0,212,255,0.10)'  },
};

const RT_DAYS = {
    'null':'Any Day', mon:'Mon', tue:'Tue', wed:'Wed',
    thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun'
};

const RT_BLOCK_TYPES = {
    normal:'Standard', superset:'Superset', giant:'Giant Set', circuit:'Circuit'
};

const RT_PROG_RULES = {
    none:'None', double_progression:'Double Progression',
    linear:'Linear Load', rpe_based:'RPE Based', percent_1rm:'% of 1RM'
};

const RT_COLORS = [
    '#00d4ff','#39ff14','#ff7a00','#8b5cf6','#ff4d5f','#f59e0b','#ec4899','#06b6d4'
];

const RT_ICONS = ['🏋️','💪','🔥','⚡','🎯','🚀','🏃','🧠','🦾','🏆'];

// ── STATE ───────────────────────────────────────────────────────

const rt = {
    view: 'programs',
    progId: null,
    routineId: null,
    editing: null,   // { routine, blocks, items, isNew }
    picker: { open: false, blockId: null, q: '', filtered: [] },
    moveDialog: { open: false, routineId: null },
    confirmDialog: { open: false, msg: '', onConfirm: null },
    programs: [],
    routines: [],
    blocks: [],
    items: [],
    exerciseLib: [],
    templates: [],
    _seeded: false,
};

// ── DB HELPERS ──────────────────────────────────────────────────

async function rtLoad() {
    const [progs, routines, blocks, items, lib, custom, tmpl] = await Promise.all([
        apexDB.getAll('programs'),
        apexDB.getAll('routines'),
        apexDB.getAll('routineBlocks'),
        apexDB.getAll('routineItems'),
        apexDB.getAll('exerciseLibrary'),
        apexDB.getAll('customExercises'),
        apexDB.getAll('routineTemplates'),
    ]);
    rt.programs  = progs.sort((a,b) => (a.order||0)-(b.order||0));
    rt.routines  = routines.sort((a,b) => (a.order||0)-(b.order||0));
    rt.blocks    = blocks.sort((a,b) => (a.order||0)-(b.order||0));
    rt.items     = items.sort((a,b) => (a.order||0)-(b.order||0));
    rt.exerciseLib = [
        ...lib.map(e => ({ ...e, isCustom: false })),
        ...custom.map(e => ({ ...e, isCustom: true })),
    ].sort((a,b) => a.name.localeCompare(b.name));
    rt.templates = tmpl;
}

// ── UTILS ───────────────────────────────────────────────────────

function uid() {
    return 'rt_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

function rtEmit() {
    document.dispatchEvent(new CustomEvent('workoutsChanged', { detail: { reason: 'routinesUpdated' } }));
}

function rtRedraw() {
    const root = document.getElementById('rtRoot');
    if (!root) return;
    injectRtStyles();
    const views = {
        programs:      renderProgramsView,
        routineList:   renderRoutineListView,
        routineDetail: renderRoutineDetailView,
        routineEditor: renderRoutineEditorView,
        templates:     renderTemplatesView,
    };
    root.innerHTML = (views[rt.view] || renderProgramsView)();
    if (rt.picker.open)     renderPickerOverlay();
    if (rt.moveDialog.open) renderMoveOverlay();
}

function metrics(routineId) {
    const its = rt.items.filter(i => i.routineId === routineId);
    const totalSets = its.reduce((s,i) => s + (Number(i.targetSets)||3), 0);
    const exCount   = new Set(its.map(i => i.exerciseId)).size;
    const avgRest   = its.length ? its.reduce((s,i) => s+(Number(i.restSeconds)||90),0)/its.length : 90;
    const estMin    = Math.round(totalSets * (42 + avgRest) / 60);
    const equipSet  = new Set(its.map(i => {
        const ex = rt.exerciseLib.find(e => e.id === i.exerciseId);
        return ex ? (ex.equipment || 'Bodyweight') : 'Bodyweight';
    }));
    const muscleSet = new Set(its.map(i => {
        const ex = rt.exerciseLib.find(e => e.id === i.exerciseId);
        return ex ? (ex.primaryMuscle || ex.muscle || '') : '';
    }).filter(Boolean));
    return { totalSets, exCount, estMin, equipment: [...equipSet], muscles: [...muscleSet] };
}

function goalChip(tag) {
    const g = RT_GOALS[tag] || RT_GOALS.general;
    return `<span class="rt-goal-chip" style="background:${g.bg};color:${g.color};border-color:${g.color}40;">${g.label}</span>`;
}

function dayChip(day) {
    if (!day || day === 'null') return '';
    return `<span class="rt-day-chip">${RT_DAYS[day]||day}</span>`;
}

function blockTypeChip(type) {
    const labels = { normal:'', superset:'⚡ Superset', giant:'💥 Giant Set', circuit:'🔄 Circuit' };
    return labels[type] ? `<span class="rt-block-type-chip">${labels[type]}</span>` : '';
}

function progColor(prog) { return prog ? (prog.color || RT_COLORS[0]) : RT_COLORS[0]; }
function progIcon(prog)  { return prog ? (prog.icon  || '🏋️') : '🏋️'; }

function activeProgram()  { return rt.programs.find(p => p.id === rt.progId); }
function activeRoutine()  { return rt.routines.find(r => r.id === rt.routineId); }
function routineBlocks(rId) { return rt.blocks.filter(b => b.routineId === (rId||rt.routineId)); }
function blockItems(bId)    { return rt.items.filter(i => i.blockId === bId); }

function exName(id) {
    const ex = rt.exerciseLib.find(e => e.id === id);
    return ex ? ex.name : id;
}

function routineCountForProg(pId) {
    return rt.routines.filter(r => r.programId === pId && !r.archived).length;
}

// ── STARTER TEMPLATES ───────────────────────────────────────────

const TEMPLATES = [
    {
        id: 'tpl_ppl',
        name: 'Push / Pull / Legs',
        description: 'Classic 3-day split. Push muscles Monday, pull muscles Wednesday, legs Friday. Ideal for intermediate lifters.',
        daysPerWeek: 3,
        equipment: 'Barbell, Dumbbell, Cable',
        color: '#00d4ff',
        icon: '💪',
        goalTag: 'hypertrophy',
        routines: [
            {
                name: 'Push Day',
                goalTag: 'hypertrophy',
                assignedDay: 'mon',
                defaultRestSeconds: 120,
                blocks: [
                    {
                        name: 'Primary Push', type: 'normal',
                        items: [
                            { exerciseId:'bench-press',    sets:4, repMin:6,  repMax:10, rest:150, prog:'double_progression' },
                            { exerciseId:'overhead-press', sets:3, repMin:8,  repMax:12, rest:120, prog:'double_progression' },
                        ]
                    },
                    {
                        name: 'Accessory Push', type: 'superset',
                        items: [
                            { exerciseId:'incline-db-press', sets:3, repMin:10, repMax:15, rest:90, prog:'double_progression' },
                            { exerciseId:'lateral-raise',    sets:3, repMin:15, repMax:20, rest:60, prog:'none' },
                        ]
                    }
                ]
            },
            {
                name: 'Pull Day',
                goalTag: 'hypertrophy',
                assignedDay: 'wed',
                defaultRestSeconds: 120,
                blocks: [
                    {
                        name: 'Primary Pull', type: 'normal',
                        items: [
                            { exerciseId:'deadlift',    sets:3, repMin:3, repMax:6,   rest:210, prog:'linear' },
                            { exerciseId:'barbell-row', sets:4, repMin:6, repMax:10,  rest:150, prog:'double_progression' },
                        ]
                    },
                    {
                        name: 'Vertical Pull', type: 'normal',
                        items: [
                            { exerciseId:'pull-up',      sets:3, repMin:6,  repMax:12, rest:120, prog:'double_progression' },
                            { exerciseId:'lat-pulldown', sets:3, repMin:10, repMax:14, rest:90,  prog:'double_progression' },
                        ]
                    }
                ]
            },
            {
                name: 'Leg Day',
                goalTag: 'hypertrophy',
                assignedDay: 'fri',
                defaultRestSeconds: 120,
                blocks: [
                    {
                        name: 'Squat Pattern', type: 'normal',
                        items: [
                            { exerciseId:'back-squat', sets:4, repMin:5, repMax:8, rest:180, prog:'linear' },
                            { exerciseId:'leg-press',  sets:3, repMin:10, repMax:15, rest:120, prog:'double_progression' },
                        ]
                    },
                    {
                        name: 'Hinge + Core', type: 'superset',
                        items: [
                            { exerciseId:'romanian-deadlift', sets:3, repMin:8,  repMax:12, rest:120, prog:'double_progression' },
                            { exerciseId:'plank',             sets:3, repMin:30, repMax:60, rest:60,  prog:'none' },
                        ]
                    }
                ]
            }
        ]
    },
    {
        id: 'tpl_ul',
        name: 'Upper / Lower',
        description: '4-day strength & hypertrophy split. Upper body twice, lower body twice per week. Great for building balanced strength.',
        daysPerWeek: 4,
        equipment: 'Barbell, Dumbbell',
        color: '#8b5cf6',
        icon: '⚡',
        goalTag: 'strength',
        routines: [
            {
                name: 'Upper A — Strength',
                goalTag: 'strength',
                assignedDay: 'mon',
                defaultRestSeconds: 150,
                blocks: [
                    {
                        name: 'Horizontal', type: 'normal',
                        items: [
                            { exerciseId:'bench-press', sets:4, repMin:4, repMax:6, rest:180, prog:'linear' },
                            { exerciseId:'barbell-row', sets:4, repMin:4, repMax:6, rest:180, prog:'linear' },
                        ]
                    },
                    {
                        name: 'Vertical', type: 'normal',
                        items: [
                            { exerciseId:'overhead-press', sets:3, repMin:6, repMax:8, rest:120, prog:'linear' },
                            { exerciseId:'pull-up',        sets:3, repMin:6, repMax:8, rest:120, prog:'double_progression' },
                        ]
                    }
                ]
            },
            {
                name: 'Lower A — Strength',
                goalTag: 'strength',
                assignedDay: 'tue',
                defaultRestSeconds: 180,
                blocks: [
                    {
                        name: 'Squat + Hinge', type: 'normal',
                        items: [
                            { exerciseId:'back-squat', sets:5, repMin:3, repMax:5, rest:210, prog:'linear' },
                            { exerciseId:'deadlift',   sets:3, repMin:3, repMax:5, rest:210, prog:'linear' },
                        ]
                    },
                    {
                        name: 'Accessory', type: 'normal',
                        items: [
                            { exerciseId:'plank', sets:3, repMin:30, repMax:60, rest:60, prog:'none' },
                        ]
                    }
                ]
            },
            {
                name: 'Upper B — Volume',
                goalTag: 'hypertrophy',
                assignedDay: 'thu',
                defaultRestSeconds: 90,
                blocks: [
                    {
                        name: 'Push Volume', type: 'normal',
                        items: [
                            { exerciseId:'incline-db-press', sets:4, repMin:10, repMax:15, rest:90, prog:'double_progression' },
                            { exerciseId:'lateral-raise',    sets:4, repMin:15, repMax:20, rest:60, prog:'none' },
                        ]
                    },
                    {
                        name: 'Pull Volume', type: 'normal',
                        items: [
                            { exerciseId:'lat-pulldown', sets:4, repMin:10, repMax:14, rest:90, prog:'double_progression' },
                            { exerciseId:'barbell-row',  sets:3, repMin:10, repMax:14, rest:90, prog:'double_progression' },
                        ]
                    }
                ]
            },
            {
                name: 'Lower B — Volume',
                goalTag: 'hypertrophy',
                assignedDay: 'fri',
                defaultRestSeconds: 90,
                blocks: [
                    {
                        name: 'Leg Volume', type: 'normal',
                        items: [
                            { exerciseId:'leg-press',         sets:4, repMin:12, repMax:16, rest:90,  prog:'double_progression' },
                            { exerciseId:'romanian-deadlift', sets:4, repMin:10, repMax:14, rest:120, prog:'double_progression' },
                        ]
                    }
                ]
            }
        ]
    },
    {
        id: 'tpl_fb',
        name: 'Full Body 3×/Week',
        description: 'Full-body training three times per week. Perfect for beginners or those short on time. Hits every muscle group each session.',
        daysPerWeek: 3,
        equipment: 'Barbell, Bodyweight',
        color: '#39ff14',
        icon: '🎯',
        goalTag: 'general',
        routines: [
            {
                name: 'Full Body A',
                goalTag: 'general',
                assignedDay: 'mon',
                defaultRestSeconds: 120,
                blocks: [
                    {
                        name: 'Compound Lifts', type: 'normal',
                        items: [
                            { exerciseId:'back-squat',   sets:3, repMin:8, repMax:10, rest:120, prog:'double_progression' },
                            { exerciseId:'bench-press',  sets:3, repMin:8, repMax:10, rest:120, prog:'double_progression' },
                            { exerciseId:'barbell-row',  sets:3, repMin:8, repMax:10, rest:120, prog:'double_progression' },
                        ]
                    },
                    {
                        name: 'Core & Accessories', type: 'superset',
                        items: [
                            { exerciseId:'plank',       sets:3, repMin:30, repMax:60, rest:45, prog:'none' },
                            { exerciseId:'lateral-raise', sets:3, repMin:12, repMax:15, rest:60, prog:'none' },
                        ]
                    }
                ]
            },
            {
                name: 'Full Body B',
                goalTag: 'general',
                assignedDay: 'wed',
                defaultRestSeconds: 120,
                blocks: [
                    {
                        name: 'Compound Lifts', type: 'normal',
                        items: [
                            { exerciseId:'deadlift',         sets:3, repMin:5, repMax:8,  rest:180, prog:'linear' },
                            { exerciseId:'overhead-press',   sets:3, repMin:8, repMax:12, rest:120, prog:'double_progression' },
                            { exerciseId:'pull-up',          sets:3, repMin:6, repMax:10, rest:120, prog:'double_progression' },
                        ]
                    },
                    {
                        name: 'Hypertrophy', type: 'normal',
                        items: [
                            { exerciseId:'incline-db-press', sets:3, repMin:10, repMax:15, rest:90, prog:'double_progression' },
                        ]
                    }
                ]
            },
            {
                name: 'Full Body C',
                goalTag: 'general',
                assignedDay: 'fri',
                defaultRestSeconds: 120,
                blocks: [
                    {
                        name: 'Compound Lifts', type: 'normal',
                        items: [
                            { exerciseId:'back-squat',        sets:3, repMin:8,  repMax:12, rest:120, prog:'double_progression' },
                            { exerciseId:'romanian-deadlift', sets:3, repMin:10, repMax:14, rest:120, prog:'double_progression' },
                            { exerciseId:'lat-pulldown',      sets:3, repMin:10, repMax:14, rest:90,  prog:'double_progression' },
                        ]
                    },
                    {
                        name: 'Isolation', type: 'superset',
                        items: [
                            { exerciseId:'lateral-raise', sets:3, repMin:15, repMax:20, rest:60, prog:'none' },
                            { exerciseId:'plank',         sets:3, repMin:45, repMax:60, rest:45, prog:'none' },
                        ]
                    }
                ]
            }
        ]
    },
    {
        id: 'tpl_db',
        name: 'Dumbbells Only',
        description: 'Full-body program using only dumbbells and bodyweight. Train anywhere — no barbell needed.',
        daysPerWeek: 3,
        equipment: 'Dumbbell, Bodyweight',
        color: '#ff7a00',
        icon: '🔥',
        goalTag: 'general',
        routines: [
            {
                name: 'Dumbbell Full Body A',
                goalTag: 'general',
                assignedDay: 'mon',
                defaultRestSeconds: 90,
                blocks: [
                    {
                        name: 'Push + Pull', type: 'superset',
                        items: [
                            { exerciseId:'incline-db-press', sets:4, repMin:10, repMax:15, rest:90, prog:'double_progression' },
                            { exerciseId:'lat-pulldown',     sets:4, repMin:10, repMax:15, rest:90, prog:'double_progression' },
                        ]
                    },
                    {
                        name: 'Legs + Core', type: 'superset',
                        items: [
                            { exerciseId:'romanian-deadlift', sets:3, repMin:12, repMax:16, rest:90, prog:'double_progression' },
                            { exerciseId:'plank',             sets:3, repMin:40, repMax:60, rest:45, prog:'none' },
                        ]
                    },
                    {
                        name: 'Shoulders', type: 'normal',
                        items: [
                            { exerciseId:'lateral-raise', sets:3, repMin:15, repMax:20, rest:60, prog:'none' },
                        ]
                    }
                ]
            },
            {
                name: 'Dumbbell Full Body B',
                goalTag: 'general',
                assignedDay: 'wed',
                defaultRestSeconds: 90,
                blocks: [
                    {
                        name: 'Push + Pull', type: 'superset',
                        items: [
                            { exerciseId:'incline-db-press', sets:4, repMin:12, repMax:16, rest:90, prog:'double_progression' },
                            { exerciseId:'pull-up',          sets:4, repMin:6,  repMax:12, rest:90, prog:'double_progression' },
                        ]
                    },
                    {
                        name: 'Legs', type: 'normal',
                        items: [
                            { exerciseId:'leg-press',         sets:4, repMin:12, repMax:15, rest:90,  prog:'double_progression' },
                            { exerciseId:'romanian-deadlift', sets:3, repMin:12, repMax:15, rest:90,  prog:'double_progression' },
                        ]
                    }
                ]
            },
            {
                name: 'Dumbbell Full Body C',
                goalTag: 'general',
                assignedDay: 'fri',
                defaultRestSeconds: 90,
                blocks: [
                    {
                        name: 'Circuit', type: 'circuit',
                        items: [
                            { exerciseId:'incline-db-press',  sets:3, repMin:12, repMax:15, rest:45, prog:'none' },
                            { exerciseId:'lat-pulldown',      sets:3, repMin:12, repMax:15, rest:45, prog:'none' },
                            { exerciseId:'romanian-deadlift', sets:3, repMin:12, repMax:15, rest:45, prog:'none' },
                            { exerciseId:'lateral-raise',     sets:3, repMin:15, repMax:20, rest:30, prog:'none' },
                            { exerciseId:'plank',             sets:3, repMin:30, repMax:45, rest:30, prog:'none' },
                        ]
                    }
                ]
            }
        ]
    },
];

async function seedRoutineTemplates() {
    if (rt._seeded) return;
    const existing = await apexDB.getAll('routineTemplates');
    if (existing.length === 0) {
        for (const t of TEMPLATES) {
            await apexDB.put('routineTemplates', t);
        }
    }
    rt._seeded = true;
}

// ── ENTRY POINT ─────────────────────────────────────────────────

window.renderTabRoutines = async function (container) {
    if (!document.getElementById('rtRoot')) {
        container.innerHTML = `<div id="rtRoot" style="animation:fadeUp 0.3s ease;"><p class="muted" style="text-align:center;padding:40px;">Loading Routines...</p></div>`;
    }
    await seedRoutineTemplates();
    await rtLoad();
    rtRedraw();
};

// ── NAVIGATION HELPERS ───────────────────────────────────────────

window.rtNav = function (view, params = {}) {
    rt.view = view;
    if (params.progId     !== undefined) rt.progId = params.progId;
    if (params.routineId  !== undefined) rt.routineId = params.routineId;
    if (params.editing    !== undefined) rt.editing = params.editing;
    rt.picker.open = false;
    rt.moveDialog.open = false;
    rt.confirmDialog.open = false;
    rtRedraw();
};

// ══════════════════════════════════════════════════════════════════
//  VIEW — PROGRAMS
// ══════════════════════════════════════════════════════════════════

function renderProgramsView() {
    const active  = rt.programs.filter(p => !p.archived);
    const archived = rt.programs.filter(p => p.archived);

    return `
    <div class="rt-header">
        <div>
            <h2 class="rt-title">Programs</h2>
            <p class="rt-sub">${active.length} active program${active.length !== 1 ? 's' : ''}</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="rt-btn rt-btn-ghost" onclick="rtNav('templates')">📦 Templates</button>
            <button class="rt-btn rt-btn-teal" onclick="rtOpenCreateProgram()">＋ New Program</button>
        </div>
    </div>

    ${active.length === 0 ? `
    <div class="rt-empty">
        <div class="rt-empty-icon">🗂️</div>
        <h3>No programs yet</h3>
        <p>Organize your routines into programs (e.g. "Strength Block", "Summer Cut").</p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:16px;">
            <button class="rt-btn rt-btn-teal" onclick="rtOpenCreateProgram()">＋ Create Program</button>
            <button class="rt-btn rt-btn-ghost" onclick="rtNav('templates')">📦 Import Templates</button>
        </div>
    </div>
    ` : `
    <div class="rt-prog-grid">
        ${active.map((p,i) => renderProgramCard(p, i, active.length)).join('')}
    </div>
    `}

    ${archived.length > 0 ? `
    <details style="margin-top:24px;">
        <summary class="rt-section-label" style="cursor:pointer;">ARCHIVED (${archived.length})</summary>
        <div class="rt-prog-grid" style="margin-top:12px;">
            ${archived.map(p => renderProgramCard(p, 0, 0, true)).join('')}
        </div>
    </details>
    ` : ''}
    `;
}

function renderProgramCard(p, idx, total, isArchived = false) {
    const col = progColor(p);
    const icon = progIcon(p);
    const count = routineCountForProg(p.id);
    return `
    <div class="rt-prog-card" style="border-left:4px solid ${col};" onclick="rtOpenProgram('${p.id}')">
        <div class="rt-prog-card-top">
            <div class="rt-prog-icon" style="background:${col}18;border:1px solid ${col}35;">${icon}</div>
            <div class="rt-prog-menu" onclick="event.stopPropagation()">
                <button class="rt-icon-btn" onclick="rtProgMenu(event,'${p.id}',${isArchived},${idx},${total})">⋯</button>
            </div>
        </div>
        <h3 class="rt-prog-name">${esc(p.name)}</h3>
        <p class="rt-prog-meta">${count} routine${count !== 1 ? 's' : ''}</p>
        ${isArchived ? `<span class="rt-tag rt-tag-muted">Archived</span>` : ''}
        <div class="rt-prog-arrow" style="color:${col};">→</div>
    </div>`;
}

window.rtOpenProgram = function (id) {
    rt.progId = id;
    rt.view = 'routineList';
    rtRedraw();
};

window.rtProgMenu = function (e, id, isArchived, idx, total) {
    e.stopPropagation();
    const prog = rt.programs.find(p => p.id === id);
    if (!prog) return;

    const items = [
        { label: '✏️ Rename',     fn: `rtRenameProgram('${id}')` },
        { label: isArchived ? '📤 Unarchive' : '📥 Archive', fn: `rtArchiveProgram('${id}',${!isArchived})` },
        !isArchived && idx > 0 ? { label: '⬆️ Move Up',   fn: `rtReorderProgram('${id}',-1)` } : null,
        !isArchived && idx < total-1 ? { label: '⬇️ Move Down', fn: `rtReorderProgram('${id}',1)` } : null,
        { label: '🗑️ Delete', fn: `rtDeleteProgram('${id}')`, danger: true },
    ].filter(Boolean);

    showFloatingMenu(e, items);
};

window.rtOpenCreateProgram = function () {
    const name  = prompt('Program name:');
    if (!name || !name.trim()) return;
    const color = RT_COLORS[rt.programs.length % RT_COLORS.length];
    const icon  = RT_ICONS[rt.programs.length % RT_ICONS.length];
    const prog  = {
        id: uid(), name: name.trim(), color, icon,
        order: rt.programs.length, archived: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    apexDB.put('programs', prog).then(async () => {
        await rtLoad(); rtEmit(); rtRedraw();
    });
};

window.rtRenameProgram = function (id) {
    const prog = rt.programs.find(p => p.id === id);
    if (!prog) return;
    const name = prompt('Rename program:', prog.name);
    if (!name || !name.trim()) return;
    apexDB.put('programs', { ...prog, name: name.trim(), updatedAt: new Date().toISOString() }).then(async () => {
        await rtLoad(); rtEmit(); rtRedraw();
    });
};

window.rtArchiveProgram = function (id, archived) {
    const prog = rt.programs.find(p => p.id === id);
    if (!prog) return;
    apexDB.put('programs', { ...prog, archived, updatedAt: new Date().toISOString() }).then(async () => {
        await rtLoad(); rtEmit(); rtRedraw();
    });
};

window.rtReorderProgram = async function (id, dir) {
    const arr = rt.programs.filter(p => !p.archived);
    const idx = arr.findIndex(p => p.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= arr.length) return;
    const a = arr[idx], b = arr[swapIdx];
    const ao = a.order, bo = b.order;
    await apexDB.put('programs', { ...a, order: bo });
    await apexDB.put('programs', { ...b, order: ao });
    await rtLoad(); rtEmit(); rtRedraw();
};

window.rtDeleteProgram = function (id) {
    const prog = rt.programs.find(p => p.id === id);
    if (!prog) return;
    const routineCount = routineCountForProg(id);
    rtConfirm(
        `Delete program "<strong>${esc(prog.name)}</strong>"? This will permanently delete all ${routineCount} routine${routineCount !== 1 ? 's' : ''} inside it.`,
        async () => {
            const pRoutines = rt.routines.filter(r => r.programId === id);
            for (const r of pRoutines) {
                const rBlocks = rt.blocks.filter(b => b.routineId === r.id);
                for (const b of rBlocks) {
                    const bItems = rt.items.filter(i => i.blockId === b.id);
                    await apexDB.deleteBatch('routineItems', bItems.map(i => i.id));
                    await apexDB.delete('routineBlocks', b.id);
                }
                await apexDB.delete('routines', r.id);
            }
            await apexDB.delete('programs', id);
            await rtLoad(); rtEmit();
            rt.view = 'programs'; rtRedraw();
        }
    );
};

// ══════════════════════════════════════════════════════════════════
//  VIEW — ROUTINE LIST
// ══════════════════════════════════════════════════════════════════

function renderRoutineListView() {
    const prog = activeProgram();
    if (!prog) { rt.view = 'programs'; return renderProgramsView(); }
    const col = progColor(prog);
    const routines = rt.routines.filter(r => r.programId === prog.id && !r.archived);
    const archived  = rt.routines.filter(r => r.programId === prog.id && r.archived);

    return `
    <div class="rt-breadcrumb">
        <button class="rt-back-btn" onclick="rtNav('programs')">← Programs</button>
        <span class="rt-breadcrumb-sep">›</span>
        <span style="color:${col};">${esc(prog.name)}</span>
    </div>
    <div class="rt-header" style="margin-top:8px;">
        <div>
            <h2 class="rt-title" style="color:${col};">${progIcon(prog)} ${esc(prog.name)}</h2>
            <p class="rt-sub">${routines.length} routine${routines.length !== 1 ? 's' : ''}</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="rt-btn rt-btn-ghost" onclick="rtNav('templates')">📦 Import</button>
            <button class="rt-btn rt-btn-teal" onclick="rtNewRoutine('${prog.id}')">＋ New Routine</button>
        </div>
    </div>

    ${routines.length === 0 ? `
    <div class="rt-empty">
        <div class="rt-empty-icon">${progIcon(prog)}</div>
        <h3>No routines in this program</h3>
        <p>Create your first routine or import one of the starter templates.</p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:16px;">
            <button class="rt-btn rt-btn-teal" onclick="rtNewRoutine('${prog.id}')">＋ Create Routine</button>
            <button class="rt-btn rt-btn-ghost" onclick="rtNav('templates')">📦 Import Template</button>
        </div>
    </div>
    ` : `
    <div style="display:flex;flex-direction:column;gap:14px;">
        ${routines.map(r => renderRoutineCard(r, prog)).join('')}
    </div>
    `}

    ${archived.length > 0 ? `
    <details style="margin-top:24px;">
        <summary class="rt-section-label" style="cursor:pointer;">ARCHIVED (${archived.length})</summary>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px;">
            ${archived.map(r => renderRoutineCard(r, prog, true)).join('')}
        </div>
    </details>
    ` : ''}
    `;
}

function renderRoutineCard(r, prog, isArchived = false) {
    const m = metrics(r.id);
    const col = progColor(prog);
    const g = RT_GOALS[r.goalTag] || RT_GOALS.general;
    return `
    <div class="rt-routine-card" onclick="rtOpenRoutine('${r.id}')">
        <div class="rt-routine-card-body">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
                        <h3 class="rt-routine-name">${esc(r.name)}</h3>
                        ${isArchived ? `<span class="rt-tag rt-tag-muted">Archived</span>` : ''}
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
                        ${goalChip(r.goalTag)}
                        ${dayChip(r.assignedDay)}
                    </div>
                </div>
                <div onclick="event.stopPropagation()">
                    <button class="rt-icon-btn" onclick="rtRoutineMenu(event,'${r.id}','${prog.id}',${isArchived})">⋯</button>
                </div>
            </div>
            <div class="rt-metric-row">
                <div class="rt-metric"><span>${m.exCount}</span><small>Exercises</small></div>
                <div class="rt-metric"><span>${m.totalSets}</span><small>Total Sets</small></div>
                <div class="rt-metric"><span>~${m.estMin}m</span><small>Est. Duration</small></div>
                ${m.equipment.length ? `<div class="rt-metric"><span style="font-size:11px;">${m.equipment.slice(0,2).join(', ')}</span><small>Equipment</small></div>` : ''}
            </div>
        </div>
        <div class="rt-routine-card-action" style="background:${col}10;border-left:1px solid ${col}30;">
            <button class="rt-btn rt-btn-teal" style="font-size:12px;padding:8px 16px;" onclick="event.stopPropagation();rtStartRoutine('${r.id}')">▶ Start</button>
        </div>
    </div>`;
}

window.rtOpenRoutine = function (id) {
    rt.routineId = id;
    rt.view = 'routineDetail';
    rtRedraw();
};

window.rtNewRoutine = function (programId) {
    const now = new Date().toISOString();
    const rid = uid();
    rt.editing = {
        isNew: true,
        routine: {
            id: rid, programId, name: '',
            description: '', goalTag: 'general',
            assignedDay: 'null', defaultRestSeconds: 90,
            archived: false, createdAt: now, updatedAt: now
        },
        blocks: [],
        items: []
    };
    rt.view = 'routineEditor';
    rtRedraw();
};

window.rtRoutineMenu = function (e, id, progId, isArchived) {
    e.stopPropagation();
    const items = [
        { label: '▶ Start',      fn: `rtStartRoutine('${id}')` },
        { label: '✏️ Edit',      fn: `rtEditRoutine('${id}')` },
        { label: '📋 Duplicate', fn: `rtDuplicateRoutine('${id}')` },
        { label: '↗️ Move To…',  fn: `rtOpenMoveDialog('${id}')` },
        { label: isArchived ? '📤 Unarchive' : '📥 Archive', fn: `rtArchiveRoutine('${id}',${!isArchived})` },
        { label: '📤 Export JSON', fn: `rtExportRoutine('${id}')` },
        { label: '🗑️ Delete', fn: `rtDeleteRoutine('${id}')`, danger: true },
    ];
    showFloatingMenu(e, items);
};

window.rtEditRoutine = function (id) {
    const r = rt.routines.find(r => r.id === id);
    if (!r) return;
    rt.editing = {
        isNew: false,
        routine: { ...r },
        blocks: rt.blocks.filter(b => b.routineId === id).map(b => ({...b})),
        items: rt.items.filter(i => i.routineId === id).map(i => ({...i})),
    };
    rt.view = 'routineEditor';
    rtRedraw();
};

window.rtArchiveRoutine = async function (id, archived) {
    const r = rt.routines.find(r => r.id === id);
    if (!r) return;
    await apexDB.put('routines', { ...r, archived, updatedAt: new Date().toISOString() });
    await rtLoad(); rtEmit(); rtRedraw();
};

window.rtDuplicateRoutine = async function (id) {
    const r = rt.routines.find(r => r.id === id);
    if (!r) return;
    const now = new Date().toISOString();
    const newRid = uid();
    const blocks = rt.blocks.filter(b => b.routineId === id);
    const blockMap = {};
    const newBlocks = blocks.map(b => {
        const nb = { ...b, id: uid(), routineId: newRid };
        blockMap[b.id] = nb.id;
        return nb;
    });
    const newItems = rt.items.filter(i => i.routineId === id).map(i => ({
        ...i, id: uid(), routineId: newRid, blockId: blockMap[i.blockId] || i.blockId
    }));
    const newRoutine = { ...r, id: newRid, name: r.name + ' (Copy)', createdAt: now, updatedAt: now };
    await apexDB.put('routines', newRoutine);
    for (const b of newBlocks) await apexDB.put('routineBlocks', b);
    for (const i of newItems) await apexDB.put('routineItems', i);
    await rtLoad(); rtEmit();
    toast('Routine duplicated');
    rtRedraw();
};

window.rtDeleteRoutine = function (id) {
    const r = rt.routines.find(r => r.id === id);
    if (!r) return;
    rtConfirm(`Delete routine "<strong>${esc(r.name)}</strong>"? This cannot be undone.`, async () => {
        const rBlocks = rt.blocks.filter(b => b.routineId === id);
        for (const b of rBlocks) {
            await apexDB.deleteBatch('routineItems', rt.items.filter(i => i.blockId === b.id).map(i => i.id));
            await apexDB.delete('routineBlocks', b.id);
        }
        await apexDB.delete('routines', id);
        await rtLoad(); rtEmit();
        rt.routineId = null; rt.view = 'routineList'; rtRedraw();
    });
};

window.rtOpenMoveDialog = function (id) {
    rt.moveDialog = { open: true, routineId: id };
    rtRedraw();
};

// ══════════════════════════════════════════════════════════════════
//  VIEW — ROUTINE DETAIL
// ══════════════════════════════════════════════════════════════════

function renderRoutineDetailView() {
    const r = activeRoutine();
    if (!r) { rt.view = 'routineList'; return renderRoutineListView(); }
    const prog = rt.programs.find(p => p.id === r.programId);
    const col = progColor(prog);
    const g = RT_GOALS[r.goalTag] || RT_GOALS.general;
    const m = metrics(r.id);
    const rBlocks = routineBlocks(r.id);

    // Muscle distribution
    const muscleMap = {};
    rt.items.filter(i => i.routineId === r.id).forEach(item => {
        const ex = rt.exerciseLib.find(e => e.id === item.exerciseId);
        const muscle = ex ? (ex.primaryMuscle || ex.muscle || 'Other') : 'Other';
        muscleMap[muscle] = (muscleMap[muscle] || 0) + (Number(item.targetSets) || 3);
    });
    const totalMuscleSets = Object.values(muscleMap).reduce((a,b) => a+b, 0);
    const muscles = Object.entries(muscleMap).sort((a,b) => b[1]-a[1]);

    return `
    <div class="rt-breadcrumb">
        <button class="rt-back-btn" onclick="rtNav('routineList')">← ${prog ? esc(prog.name) : 'Back'}</button>
    </div>

    <div class="rt-detail-header" style="border-top:3px solid ${col};">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">
            <div>
                <h2 class="rt-detail-title">${esc(r.name)}</h2>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
                    ${goalChip(r.goalTag)}
                    ${dayChip(r.assignedDay)}
                </div>
                ${r.description ? `<p class="rt-detail-desc">${esc(r.description)}</p>` : ''}
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;">
                <button class="rt-btn rt-btn-ghost" onclick="rtEditRoutine('${r.id}')">✏️ Edit</button>
                <button class="rt-btn rt-btn-teal rt-start-btn" onclick="rtStartRoutine('${r.id}')">▶ Start Routine</button>
            </div>
        </div>

        <div class="rt-metric-row rt-metric-row-large" style="margin-top:20px;">
            <div class="rt-metric-card"><span>${m.exCount}</span><small>Exercises</small></div>
            <div class="rt-metric-card"><span>${m.totalSets}</span><small>Total Sets</small></div>
            <div class="rt-metric-card"><span>~${m.estMin}m</span><small>Est. Duration</small></div>
            ${r.defaultRestSeconds ? `<div class="rt-metric-card"><span>${r.defaultRestSeconds}s</span><small>Default Rest</small></div>` : ''}
        </div>
    </div>

    ${m.equipment.length ? `
    <div class="rt-equip-row">
        <p class="rt-section-label">EQUIPMENT</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${m.equipment.map(eq => `<span class="rt-tag rt-tag-equip">${esc(eq)}</span>`).join('')}
        </div>
    </div>
    ` : ''}

    ${muscles.length > 0 ? `
    <div class="rt-card" style="margin-bottom:16px;">
        <p class="rt-section-label" style="margin-bottom:12px;">MUSCLE DISTRIBUTION</p>
        <div style="display:flex;flex-direction:column;gap:8px;">
            ${muscles.slice(0,6).map(([muscle, sets]) => `
            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                    <span style="font-size:12px;font-weight:700;color:var(--soft);">${esc(muscle)}</span>
                    <span style="font-size:11px;color:var(--muted);">${sets} sets</span>
                </div>
                <div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;">
                    <div style="height:100%;width:${Math.round(sets/totalMuscleSets*100)}%;background:${col};border-radius:2px;transition:width 0.6s ease;"></div>
                </div>
            </div>`).join('')}
        </div>
    </div>
    ` : ''}

    <p class="rt-section-label">BLOCKS & EXERCISES</p>
    ${rBlocks.length === 0 ? `<div class="rt-empty" style="padding:30px;"><p class="muted">No exercises added yet. <button class="rt-link" onclick="rtEditRoutine('${r.id}')">Edit Routine</button> to add some.</p></div>` : ''}
    <div style="display:flex;flex-direction:column;gap:14px;margin-top:10px;">
        ${rBlocks.map(b => {
            const its = blockItems(b.id);
            return `
            <div class="rt-detail-block">
                <div class="rt-detail-block-header">
                    <span class="rt-detail-block-name">${esc(b.name)}</span>
                    ${blockTypeChip(b.type)}
                    ${b.restAfterBlockSeconds ? `<span class="rt-tag rt-tag-muted">${b.restAfterBlockSeconds}s between rounds</span>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;gap:0;">
                    ${its.map((item, idx) => {
                        const ex = rt.exerciseLib.find(e => e.id === item.exerciseId);
                        const repStr = item.repMax ? `${item.repMin||0}–${item.repMax}` : (item.repMin || '?');
                        const rpe = item.targetRPE ? ` · RPE ${item.targetRPE}` : '';
                        const tempo = item.tempo ? ` · ${item.tempo}` : '';
                        return `
                        <div class="rt-detail-exercise ${idx > 0 ? 'rt-detail-exercise-border' : ''}">
                            <div class="rt-detail-ex-num">${idx+1}</div>
                            <div class="rt-detail-ex-body">
                                <div class="rt-detail-ex-name">${esc(item.exerciseNameSnapshot || (ex ? ex.name : item.exerciseId))}</div>
                                <div class="rt-detail-ex-meta">
                                    <span>${item.targetSets||3} sets × ${repStr} reps</span>
                                    <span>· ${item.restSeconds||90}s rest</span>
                                    ${rpe}<span>${tempo}</span>
                                    ${item.progressionRule && item.progressionRule !== 'none' ? `<span class="rt-tag rt-tag-prog">${RT_PROG_RULES[item.progressionRule]||item.progressionRule}</span>` : ''}
                                </div>
                                ${item.notes ? `<p class="rt-detail-ex-notes">${esc(item.notes)}</p>` : ''}
                            </div>
                            ${item.targetWeight ? `<div class="rt-detail-ex-weight">${esc(String(item.targetWeight))} kg</div>` : ''}
                        </div>`;
                    }).join('')}
                </div>
                ${b.restAfterBlockSeconds ? `<div class="rt-detail-block-rest">⏱ ${b.restAfterBlockSeconds}s rest after block</div>` : ''}
            </div>`;
        }).join('')}
    </div>

    <div style="display:flex;gap:12px;margin-top:28px;justify-content:center;flex-wrap:wrap;">
        <button class="rt-btn rt-btn-ghost" onclick="rtExportRoutine('${r.id}')">📤 Export JSON</button>
        <button class="rt-btn rt-btn-ghost" onclick="rtDuplicateRoutine('${r.id}')">📋 Duplicate</button>
        <button class="rt-btn rt-btn-danger" onclick="rtDeleteRoutine('${r.id}')">🗑️ Delete</button>
        <button class="rt-btn rt-btn-teal rt-start-btn" onclick="rtStartRoutine('${r.id}')">▶ Start Routine</button>
    </div>
    `;
}

// ══════════════════════════════════════════════════════════════════
//  VIEW — ROUTINE EDITOR
// ══════════════════════════════════════════════════════════════════

function renderRoutineEditorView() {
    if (!rt.editing) { rt.view = 'routineList'; return renderRoutineListView(); }
    const { routine, blocks, items, isNew } = rt.editing;

    return `
    <div class="rt-breadcrumb">
        <button class="rt-back-btn" onclick="rtCancelEdit()">${isNew ? '← Discard' : '← Cancel'}</button>
    </div>
    <div class="rt-header">
        <h2 class="rt-title">${isNew ? '＋ New Routine' : '✏️ Edit Routine'}</h2>
        <button class="rt-btn rt-btn-teal" onclick="rtSaveRoutine()">💾 Save</button>
    </div>

    <!-- Routine Fields -->
    <div class="rt-card rt-editor-fields">
        <p class="rt-section-label">ROUTINE DETAILS</p>
        <div class="rt-field-group">
            <label class="rt-label">Name <span style="color:var(--danger);">*</span></label>
            <input id="rtf-name" class="rt-input" type="text" placeholder="e.g. Push Day A" value="${esc(routine.name)}" oninput="rtEditorField('name',this.value)">
        </div>
        <div class="rt-field-group">
            <label class="rt-label">Description</label>
            <textarea id="rtf-desc" class="rt-input rt-textarea" placeholder="Optional notes about this routine..." oninput="rtEditorField('description',this.value)">${esc(routine.description||'')}</textarea>
        </div>
        <div class="rt-field-row">
            <div class="rt-field-group">
                <label class="rt-label">Goal</label>
                <select id="rtf-goal" class="rt-select" onchange="rtEditorField('goalTag',this.value)">
                    ${Object.entries(RT_GOALS).map(([k,v]) => `<option value="${k}" ${routine.goalTag===k?'selected':''}>${v.label}</option>`).join('')}
                </select>
            </div>
            <div class="rt-field-group">
                <label class="rt-label">Day</label>
                <select id="rtf-day" class="rt-select" onchange="rtEditorField('assignedDay',this.value)">
                    ${Object.entries(RT_DAYS).map(([k,v]) => `<option value="${k}" ${(routine.assignedDay||'null')===k?'selected':''}>${v}</option>`).join('')}
                </select>
            </div>
            <div class="rt-field-group">
                <label class="rt-label">Default Rest (sec)</label>
                <input id="rtf-rest" class="rt-input" type="number" min="0" max="600" value="${routine.defaultRestSeconds||90}" oninput="rtEditorField('defaultRestSeconds',+this.value)">
            </div>
        </div>
    </div>

    <!-- Blocks -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin:20px 0 12px;">
        <p class="rt-section-label" style="margin:0;">BLOCKS</p>
        <button class="rt-btn rt-btn-ghost rt-btn-sm" onclick="rtAddBlock()">＋ Add Block</button>
    </div>

    <div id="rt-blocks-container">
        ${blocks.length === 0 ? `
        <div class="rt-empty" style="padding:24px;">
            <p class="muted">No blocks yet. Add a block to organize your exercises.</p>
            <button class="rt-btn rt-btn-ghost" style="margin-top:12px;" onclick="rtAddBlock()">＋ Add Block</button>
        </div>
        ` : blocks.map((b, bi) => renderEditorBlock(b, bi, blocks.length, items)).join('')}
    </div>

    <div style="display:flex;gap:12px;margin-top:24px;justify-content:flex-end;flex-wrap:wrap;">
        <button class="rt-btn rt-btn-ghost" onclick="rtCancelEdit()">Cancel</button>
        ${!isNew ? `<button class="rt-btn rt-btn-danger" onclick="rtDeleteRoutine('${routine.id}')">🗑️ Delete</button>` : ''}
        <button class="rt-btn rt-btn-teal" onclick="rtSaveRoutine()">💾 Save Routine</button>
    </div>
    `;
}

function renderEditorBlock(b, bi, total, items) {
    const bItems = items.filter(i => i.blockId === b.id);
    return `
    <div class="rt-editor-block" data-block-id="${b.id}">
        <div class="rt-editor-block-header">
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                <div style="display:flex;flex-direction:column;gap:2px;">
                    <button class="rt-order-btn" onclick="rtReorderBlock('${b.id}',-1)" ${bi===0?'disabled':''}>▲</button>
                    <button class="rt-order-btn" onclick="rtReorderBlock('${b.id}',1)"  ${bi===total-1?'disabled':''}>▼</button>
                </div>
                <input class="rt-input rt-block-name-input" type="text" value="${esc(b.name)}" placeholder="Block name" oninput="rtUpdateBlock('${b.id}','name',this.value)">
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
                <select class="rt-select rt-select-sm" onchange="rtUpdateBlock('${b.id}','type',this.value)">
                    ${Object.entries(RT_BLOCK_TYPES).map(([k,v]) => `<option value="${k}" ${b.type===k?'selected':''}>${v}</option>`).join('')}
                </select>
                <button class="rt-icon-btn rt-icon-btn-danger" onclick="rtDeleteBlock('${b.id}')" title="Delete block">✕</button>
            </div>
        </div>

        <div class="rt-editor-block-items">
            ${bItems.length === 0 ? `<p class="muted" style="padding:12px 0;font-size:13px;">No exercises. Add one below.</p>` : ''}
            ${bItems.map((item, ii) => renderEditorItem(item, ii, bItems.length)).join('')}
        </div>

        <div class="rt-editor-block-footer">
            <button class="rt-btn rt-btn-ghost rt-btn-sm" onclick="rtOpenPicker('${b.id}')">＋ Add Exercise</button>
            <div style="display:flex;align-items:center;gap:8px;">
                <label class="rt-label" style="margin:0;white-space:nowrap;">Block rest</label>
                <input class="rt-input rt-input-sm" type="number" min="0" max="600" placeholder="0" value="${b.restAfterBlockSeconds||''}" oninput="rtUpdateBlock('${b.id}','restAfterBlockSeconds',+this.value)" style="width:70px;">
                <span class="rt-label" style="margin:0;">s</span>
            </div>
        </div>
    </div>`;
}

function renderEditorItem(item, ii, total) {
    const ex = rt.exerciseLib.find(e => e.id === item.exerciseId);
    const name = item.exerciseNameSnapshot || (ex ? ex.name : item.exerciseId);
    return `
    <div class="rt-editor-item" data-item-id="${item.id}">
        <div class="rt-editor-item-top">
            <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
                <div style="display:flex;flex-direction:column;gap:2px;">
                    <button class="rt-order-btn" onclick="rtReorderItem('${item.id}',-1)" ${ii===0?'disabled':''}>▲</button>
                    <button class="rt-order-btn" onclick="rtReorderItem('${item.id}',1)"  ${ii===total-1?'disabled':''}>▼</button>
                </div>
                <span class="rt-editor-ex-name">${esc(name)}</span>
                ${ex ? `<span class="rt-tag rt-tag-muted" style="font-size:10px;">${esc(ex.primaryMuscle||ex.muscle||'')}</span>` : ''}
            </div>
            <button class="rt-icon-btn rt-icon-btn-danger" onclick="rtDeleteItem('${item.id}')" title="Remove">✕</button>
        </div>
        <div class="rt-editor-item-fields">
            <div class="rt-editor-field-mini">
                <label>Sets</label>
                <input type="number" class="rt-input rt-input-xs" min="1" max="20" value="${item.targetSets||3}" oninput="rtUpdateItem('${item.id}','targetSets',+this.value)">
            </div>
            <div class="rt-editor-field-mini">
                <label>Rep Min</label>
                <input type="number" class="rt-input rt-input-xs" min="1" max="100" value="${item.repMin||6}" oninput="rtUpdateItem('${item.id}','repMin',+this.value)">
            </div>
            <div class="rt-editor-field-mini">
                <label>Rep Max</label>
                <input type="number" class="rt-input rt-input-xs" min="1" max="100" value="${item.repMax||12}" oninput="rtUpdateItem('${item.id}','repMax',+this.value)">
            </div>
            <div class="rt-editor-field-mini">
                <label>Rest (s)</label>
                <input type="number" class="rt-input rt-input-xs" min="0" max="600" value="${item.restSeconds||90}" oninput="rtUpdateItem('${item.id}','restSeconds',+this.value)">
            </div>
            <div class="rt-editor-field-mini">
                <label>Weight</label>
                <input type="number" class="rt-input rt-input-xs" min="0" step="0.5" placeholder="—" value="${item.targetWeight||''}" oninput="rtUpdateItem('${item.id}','targetWeight',+this.value||null)">
            </div>
            <div class="rt-editor-field-mini">
                <label>RPE</label>
                <input type="number" class="rt-input rt-input-xs" min="1" max="10" step="0.5" placeholder="—" value="${item.targetRPE||''}" oninput="rtUpdateItem('${item.id}','targetRPE',+this.value||null)">
            </div>
            <div class="rt-editor-field-mini">
                <label>Tempo</label>
                <input type="text" class="rt-input rt-input-xs" placeholder="e.g. 3-1-1" value="${item.tempo||''}" oninput="rtUpdateItem('${item.id}','tempo',this.value)">
            </div>
            <div class="rt-editor-field-mini rt-editor-field-progression">
                <label>Progression</label>
                <select class="rt-select rt-select-xs" onchange="rtUpdateItem('${item.id}','progressionRule',this.value)">
                    ${Object.entries(RT_PROG_RULES).map(([k,v]) => `<option value="${k}" ${(item.progressionRule||'none')===k?'selected':''}>${v}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="rt-editor-item-notes">
            <input type="text" class="rt-input rt-input-sm" placeholder="Coach notes (optional)" value="${esc(item.notes||'')}" oninput="rtUpdateItem('${item.id}','notes',this.value)" style="font-style:italic;">
        </div>
    </div>`;
}

// Editor field update
window.rtEditorField = function (field, value) {
    if (!rt.editing) return;
    rt.editing.routine[field] = value;
};

// Block operations
window.rtAddBlock = function () {
    if (!rt.editing) return;
    const newBlock = {
        id: uid(),
        routineId: rt.editing.routine.id,
        name: `Block ${rt.editing.blocks.length + 1}`,
        type: 'normal',
        order: rt.editing.blocks.length,
        restAfterBlockSeconds: 0,
    };
    rt.editing.blocks.push(newBlock);
    rtRedraw();
};

window.rtUpdateBlock = function (blockId, field, value) {
    if (!rt.editing) return;
    const b = rt.editing.blocks.find(b => b.id === blockId);
    if (b) b[field] = value;
};

window.rtDeleteBlock = function (blockId) {
    if (!rt.editing) return;
    rt.editing.blocks = rt.editing.blocks.filter(b => b.id !== blockId);
    rt.editing.items = rt.editing.items.filter(i => i.blockId !== blockId);
    rtRedraw();
};

window.rtReorderBlock = function (blockId, dir) {
    if (!rt.editing) return;
    const arr = rt.editing.blocks;
    const idx = arr.findIndex(b => b.id === blockId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    arr.forEach((b, i) => { b.order = i; });
    rtRedraw();
};

// Item operations
window.rtUpdateItem = function (itemId, field, value) {
    if (!rt.editing) return;
    const i = rt.editing.items.find(i => i.id === itemId);
    if (i) i[field] = value;
};

window.rtDeleteItem = function (itemId) {
    if (!rt.editing) return;
    rt.editing.items = rt.editing.items.filter(i => i.id !== itemId);
    rtRedraw();
};

window.rtReorderItem = function (itemId, dir) {
    if (!rt.editing) return;
    const item = rt.editing.items.find(i => i.id === itemId);
    if (!item) return;
    const blockItems = rt.editing.items.filter(i => i.blockId === item.blockId).sort((a,b) => a.order-b.order);
    const idx = blockItems.findIndex(i => i.id === itemId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= blockItems.length) return;
    [blockItems[idx].order, blockItems[newIdx].order] = [blockItems[newIdx].order, blockItems[idx].order];
    rtRedraw();
};

// Save routine
window.rtSaveRoutine = async function () {
    if (!rt.editing) return;
    const { routine, blocks, items, isNew } = rt.editing;

    if (!routine.name.trim()) {
        toast('Routine name is required');
        const inp = document.getElementById('rtf-name');
        if (inp) { inp.focus(); inp.classList.add('rt-input-error'); }
        return;
    }

    routine.updatedAt = new Date().toISOString();

    // Re-order blocks and items
    blocks.forEach((b, i) => { b.order = i; b.routineId = routine.id; });
    items.forEach((item, i) => { item.order = i; item.routineId = routine.id; });

    // Write to DB
    if (isNew) {
        await apexDB.put('routines', routine);
    } else {
        // Delete removed blocks and items
        const existingBlocks = rt.blocks.filter(b => b.routineId === routine.id);
        const existingItems  = rt.items.filter(i => i.routineId === routine.id);
        const blockIds  = new Set(blocks.map(b => b.id));
        const itemIds   = new Set(items.map(i => i.id));
        for (const b of existingBlocks) if (!blockIds.has(b.id)) await apexDB.delete('routineBlocks', b.id);
        for (const i of existingItems)  if (!itemIds.has(i.id))  await apexDB.delete('routineItems', i.id);
        await apexDB.put('routines', routine);
    }

    for (const b of blocks) await apexDB.put('routineBlocks', b);
    for (const item of items) await apexDB.put('routineItems', item);

    await rtLoad();
    rtEmit();
    toast(isNew ? 'Routine created!' : 'Routine saved!');
    rt.editing = null;
    rt.routineId = routine.id;
    rt.view = 'routineDetail';
    rtRedraw();
};

window.rtCancelEdit = function () {
    rt.editing = null;
    rt.view = rt.routineId ? 'routineList' : 'routineList';
    rtRedraw();
};

// ══════════════════════════════════════════════════════════════════
//  VIEW — TEMPLATES
// ══════════════════════════════════════════════════════════════════

function renderTemplatesView() {
    const backView = rt.progId ? 'routineList' : 'programs';
    return `
    <div class="rt-breadcrumb">
        <button class="rt-back-btn" onclick="rtNav('${backView}')">← Back</button>
    </div>
    <div class="rt-header">
        <div>
            <h2 class="rt-title">📦 Starter Templates</h2>
            <p class="rt-sub">Import a ready-to-use program with full routines, blocks, and exercises.</p>
        </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px;">
        ${TEMPLATES.map(t => renderTemplateCard(t)).join('')}
    </div>
    `;
}

function renderTemplateCard(t) {
    const g = RT_GOALS[t.goalTag] || RT_GOALS.general;
    return `
    <div class="rt-template-card" style="border-left:4px solid ${t.color};">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
            <div style="flex:1;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                    <span style="font-size:24px;">${t.icon}</span>
                    <div>
                        <h3 style="margin:0;font-size:18px;font-weight:800;">${esc(t.name)}</h3>
                        <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">
                            <span class="rt-tag" style="background:${g.bg};color:${g.color};border-color:${g.color}40;">${g.label}</span>
                            <span class="rt-tag rt-tag-muted">${t.daysPerWeek}×/week</span>
                            <span class="rt-tag rt-tag-muted">${t.equipment}</span>
                        </div>
                    </div>
                </div>
                <p style="font-size:13px;color:var(--soft);margin:0 0 10px;">${esc(t.description)}</p>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    ${t.routines.map(r => `<span class="rt-tag rt-tag-muted">${esc(r.name)}</span>`).join('')}
                </div>
            </div>
            <button class="rt-btn rt-btn-teal" style="flex-shrink:0;" onclick="rtImportTemplate('${t.id}')">Import →</button>
        </div>
    </div>`;
}

window.rtImportTemplate = async function (templateId) {
    const tpl = TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;

    const now = new Date().toISOString();
    const progId = uid();
    const prog = {
        id: progId, name: tpl.name, color: tpl.color, icon: tpl.icon,
        order: rt.programs.length, archived: false, createdAt: now, updatedAt: now
    };
    await apexDB.put('programs', prog);

    for (let ri = 0; ri < tpl.routines.length; ri++) {
        const tr = tpl.routines[ri];
        const routineId = uid();
        const routine = {
            id: routineId, programId: progId, name: tr.name,
            description: tr.description || '',
            goalTag: tr.goalTag || 'general',
            assignedDay: tr.assignedDay || 'null',
            defaultRestSeconds: tr.defaultRestSeconds || 90,
            archived: false, order: ri, createdAt: now, updatedAt: now
        };
        await apexDB.put('routines', routine);

        for (let bi = 0; bi < tr.blocks.length; bi++) {
            const tb = tr.blocks[bi];
            const blockId = uid();
            const block = {
                id: blockId, routineId, name: tb.name, type: tb.type || 'normal',
                order: bi, restAfterBlockSeconds: tb.restAfterBlock || 0
            };
            await apexDB.put('routineBlocks', block);

            for (let ii = 0; ii < tb.items.length; ii++) {
                const ti = tb.items[ii];
                const ex = rt.exerciseLib.find(e => e.id === ti.exerciseId);
                const item = {
                    id: uid(), routineId, blockId, order: ii,
                    exerciseId: ti.exerciseId,
                    exerciseNameSnapshot: ex ? ex.name : ti.exerciseId,
                    trackingTypeSnapshot: ex ? (ex.trackingType || 'Weight + Reps') : 'Weight + Reps',
                    targetSets: ti.sets || 3,
                    repMin: ti.repMin || 8,
                    repMax: ti.repMax || 12,
                    targetWeight: null,
                    targetRPE: null,
                    restSeconds: ti.rest || 90,
                    tempo: null,
                    notes: null,
                    progressionRule: ti.prog || 'none',
                };
                await apexDB.put('routineItems', item);
            }
        }
    }

    await rtLoad();
    rtEmit();
    toast(`"${tpl.name}" imported!`);
    rt.progId = progId;
    rt.view = 'routineList';
    rtRedraw();
};

// ══════════════════════════════════════════════════════════════════
//  START ROUTINE
// ══════════════════════════════════════════════════════════════════

window.rtStartRoutine = async function (id) {
    const r = rt.routines.find(r => r.id === id);
    if (!r) return;
    const rBlocks = rt.blocks.filter(b => b.routineId === id).sort((a,b) => a.order-b.order);
    const rItems  = [];
    for (const b of rBlocks) {
        const its = rt.items.filter(i => i.blockId === b.id).sort((a,b) => a.order-b.order);
        rItems.push(...its);
    }

    const session = {
        id: 'active',
        name: r.name,
        routineId: r.id,
        startedAt: new Date().toISOString(),
        exercises: rItems.map(item => ({
            id: uid(),
            exerciseId:   item.exerciseId,
            exerciseName: item.exerciseNameSnapshot,
            targetSets:   item.targetSets || 3,
            repMin:       item.repMin,
            repMax:       item.repMax,
            restSeconds:  item.restSeconds || 90,
            targetWeight: item.targetWeight,
            targetRPE:    item.targetRPE,
            tempo:        item.tempo,
            notes:        item.notes,
            sets: []
        })),
        notes: ''
    };

    await apexDB.put('activeSession', session);
    window.wkState.activeSession = session;

    rtEmit();
    toast(`Starting: ${r.name}`);

    // Switch to Today tab
    window.wkState.currentTab = 'today';
    document.querySelectorAll('#workoutInternalNav .nav-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === 'today');
    });
    if (typeof window.drawWorkoutPanel === 'function') {
        window.drawWorkoutPanel();
    }
};

// ══════════════════════════════════════════════════════════════════
//  EXPORT
// ══════════════════════════════════════════════════════════════════

window.rtExportRoutine = function (id) {
    const r = rt.routines.find(r => r.id === id);
    if (!r) return;
    const rBlocks = rt.blocks.filter(b => b.routineId === id);
    const rItems  = rt.items.filter(i => i.routineId === id);
    const payload = {
        exportedAt: new Date().toISOString(),
        routine: r,
        blocks: rBlocks,
        items: rItems
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `routine-${r.name.replace(/\s+/g,'-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Routine exported');
};

// ══════════════════════════════════════════════════════════════════
//  EXERCISE PICKER MODAL
// ══════════════════════════════════════════════════════════════════

window.rtOpenPicker = function (blockId) {
    rt.picker = { open: true, blockId, q: '', filtered: [...rt.exerciseLib] };
    renderPickerOverlay();
};

function renderPickerOverlay() {
    let existing = document.getElementById('rtPickerOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'rtPickerOverlay';
    overlay.className = 'rt-overlay';
    overlay.innerHTML = `
    <div class="rt-modal rt-picker-modal" onclick="event.stopPropagation()">
        <div class="rt-modal-header">
            <h3 class="rt-modal-title">Add Exercise</h3>
            <button class="rt-icon-btn" onclick="rtClosePicker()">✕</button>
        </div>
        <div style="padding:16px;border-bottom:1px solid var(--line);">
            <input id="rtPickerSearch" class="rt-input" type="text" placeholder="Search exercises…" value="${esc(rt.picker.q)}"
                oninput="rtPickerSearch(this.value)" autofocus>
        </div>
        <div id="rtPickerList" class="rt-picker-list">
            ${renderPickerList()}
        </div>
    </div>`;
    overlay.onclick = () => rtClosePicker();
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('rtPickerSearch')?.focus(), 50);
}

function renderPickerList() {
    const list = rt.picker.q
        ? rt.exerciseLib.filter(e => e.name.toLowerCase().includes(rt.picker.q.toLowerCase()) || (e.primaryMuscle||'').toLowerCase().includes(rt.picker.q.toLowerCase()) || (e.muscle||'').toLowerCase().includes(rt.picker.q.toLowerCase()))
        : rt.exerciseLib;

    if (!list.length) return `<p class="muted" style="text-align:center;padding:20px;">No exercises match.</p>`;
    return list.map(ex => {
        const muscle = ex.primaryMuscle || ex.muscle || '';
        const equip  = ex.equipment || '';
        return `
        <div class="rt-picker-item" onclick="rtPickExercise('${ex.id}')">
            <div>
                <div class="rt-picker-item-name">${esc(ex.name)}</div>
                <div class="rt-picker-item-meta">${esc(muscle)} · ${esc(equip)}</div>
            </div>
            <span style="color:var(--teal);font-size:18px;font-weight:800;">＋</span>
        </div>`;
    }).join('');
}

window.rtPickerSearch = function (q) {
    rt.picker.q = q;
    const list = document.getElementById('rtPickerList');
    if (list) list.innerHTML = renderPickerList();
};

window.rtPickExercise = function (exerciseId) {
    if (!rt.editing || !rt.picker.blockId) return;
    const ex = rt.exerciseLib.find(e => e.id === exerciseId);
    if (!ex) return;

    const blockItems = rt.editing.items.filter(i => i.blockId === rt.picker.blockId);
    const r = rt.editing.routine;
    const item = {
        id: uid(),
        routineId: r.id,
        blockId: rt.picker.blockId,
        order: blockItems.length,
        exerciseId: ex.id,
        exerciseNameSnapshot: ex.name,
        trackingTypeSnapshot: ex.trackingType || 'Weight + Reps',
        targetSets: ex.defaultSets || 3,
        repMin: parseInt((ex.defaultReps||'8').split('-')[0]) || 8,
        repMax: parseInt((ex.defaultReps||'12').split('-')[1]||ex.defaultReps||'12') || 12,
        targetWeight: null,
        targetRPE: null,
        restSeconds: ex.defaultRest || r.defaultRestSeconds || 90,
        tempo: ex.tempo || null,
        notes: null,
        progressionRule: 'double_progression',
    };
    rt.editing.items.push(item);
    rtClosePicker();
    rtRedraw();
};

window.rtClosePicker = function () {
    rt.picker.open = false;
    const el = document.getElementById('rtPickerOverlay');
    if (el) el.remove();
};

// ══════════════════════════════════════════════════════════════════
//  MOVE ROUTINE DIALOG
// ══════════════════════════════════════════════════════════════════

function renderMoveOverlay() {
    let existing = document.getElementById('rtMoveOverlay');
    if (existing) existing.remove();

    const r = rt.routines.find(r => r.id === rt.moveDialog.routineId);
    const otherProgs = rt.programs.filter(p => !p.archived && p.id !== (r ? r.programId : null));

    const overlay = document.createElement('div');
    overlay.id = 'rtMoveOverlay';
    overlay.className = 'rt-overlay';
    overlay.innerHTML = `
    <div class="rt-modal" style="max-width:380px;" onclick="event.stopPropagation()">
        <div class="rt-modal-header">
            <h3 class="rt-modal-title">Move Routine To…</h3>
            <button class="rt-icon-btn" onclick="rtCloseMoveDialog()">✕</button>
        </div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:8px;">
            ${otherProgs.length === 0
                ? `<p class="muted">No other programs. Create another program first.</p>`
                : otherProgs.map(p => `
                    <button class="rt-picker-item" style="border:none;cursor:pointer;text-align:left;" onclick="rtMoveRoutineTo('${rt.moveDialog.routineId}','${p.id}')">
                        <span style="font-size:20px;">${progIcon(p)}</span>
                        <div>
                            <div class="rt-picker-item-name">${esc(p.name)}</div>
                            <div class="rt-picker-item-meta">${routineCountForProg(p.id)} routines</div>
                        </div>
                    </button>`).join('')}
        </div>
    </div>`;
    overlay.onclick = () => rtCloseMoveDialog();
    document.body.appendChild(overlay);
}

window.rtMoveRoutineTo = async function (routineId, toProgramId) {
    const r = rt.routines.find(r => r.id === routineId);
    if (!r) return;
    await apexDB.put('routines', { ...r, programId: toProgramId, updatedAt: new Date().toISOString() });
    await rtLoad(); rtEmit();
    rtCloseMoveDialog();
    toast('Routine moved');
    rt.view = 'routineList';
    rtRedraw();
};

window.rtCloseMoveDialog = function () {
    rt.moveDialog.open = false;
    const el = document.getElementById('rtMoveOverlay');
    if (el) el.remove();
};

// ══════════════════════════════════════════════════════════════════
//  CONFIRM DIALOG
// ══════════════════════════════════════════════════════════════════

function rtConfirm(msg, onConfirm) {
    let existing = document.getElementById('rtConfirmOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'rtConfirmOverlay';
    overlay.className = 'rt-overlay';
    overlay.innerHTML = `
    <div class="rt-modal rt-confirm-modal" onclick="event.stopPropagation()">
        <div class="rt-modal-header">
            <h3 class="rt-modal-title" style="color:var(--danger);">⚠️ Confirm</h3>
        </div>
        <div style="padding:16px 20px;">
            <p style="margin:0 0 20px;line-height:1.6;color:var(--soft);">${msg}</p>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button class="rt-btn rt-btn-ghost" onclick="rtCloseConfirm()">Cancel</button>
                <button class="rt-btn rt-btn-danger" id="rtConfirmBtn">Delete</button>
            </div>
        </div>
    </div>`;
    overlay.onclick = () => rtCloseConfirm();
    document.body.appendChild(overlay);

    document.getElementById('rtConfirmBtn').onclick = () => {
        rtCloseConfirm();
        onConfirm();
    };
}

window.rtCloseConfirm = function () {
    const el = document.getElementById('rtConfirmOverlay');
    if (el) el.remove();
};

// ══════════════════════════════════════════════════════════════════
//  FLOATING CONTEXT MENU
// ══════════════════════════════════════════════════════════════════

function showFloatingMenu(e, items) {
    // Remove any existing menus
    document.querySelectorAll('.rt-context-menu, .rt-context-overlay').forEach(el => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'rt-context-overlay';
    overlay.onclick = () => { overlay.remove(); menu.remove(); };
    document.body.appendChild(overlay);

    const menu = document.createElement('div');
    menu.className = 'rt-context-menu';
    menu.innerHTML = items.map(item => `
        <button class="rt-context-item ${item.danger ? 'rt-context-item-danger' : ''}"
            onclick="document.querySelector('.rt-context-overlay')?.click(); ${item.fn}">
            ${item.label}
        </button>`).join('');

    document.body.appendChild(menu);

    // Position menu near the trigger button
    const rect = e.currentTarget.getBoundingClientRect();
    const mw = 200;
    let left = rect.right - mw;
    let top  = rect.bottom + 4;
    if (left < 8) left = 8;
    if (top + 300 > window.innerHeight) top = rect.top - 4 - Math.min(items.length * 44, 260);
    menu.style.left = `${left}px`;
    menu.style.top  = `${top}px`;
}

// ══════════════════════════════════════════════════════════════════
//  STYLES INJECTION
// ══════════════════════════════════════════════════════════════════

function injectRtStyles() {
    if (document.getElementById('rtStylesTag')) return;
    const s = document.createElement('style');
    s.id = 'rtStylesTag';
    s.textContent = `
/* ── ROUTINES — Scoped Styles ── */
.rt-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; gap:12px; flex-wrap:wrap; }
.rt-title { font-family:'Space Grotesk',Inter,sans-serif; font-size:clamp(22px,4vw,30px); font-weight:800; letter-spacing:-0.03em; margin:0; }
.rt-sub { font-size:13px; color:var(--muted); margin:3px 0 0; font-weight:600; }
.rt-section-label { font-size:10px; font-weight:900; letter-spacing:0.15em; color:var(--muted); text-transform:uppercase; margin:0 0 8px; }

/* Buttons */
.rt-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 18px; border-radius:20px; font-size:13px; font-weight:800; border:none; cursor:pointer; transition:all 0.18s ease; white-space:nowrap; }
.rt-btn-teal   { background:rgba(0,212,255,0.12); color:var(--teal); border:1px solid rgba(0,212,255,0.3); }
.rt-btn-teal:hover  { background:rgba(0,212,255,0.2); box-shadow:0 0 20px rgba(0,212,255,0.2); transform:translateY(-1px); }
.rt-btn-ghost  { background:rgba(255,255,255,0.04); color:var(--soft); border:1px solid rgba(255,255,255,0.1); }
.rt-btn-ghost:hover  { background:rgba(255,255,255,0.08); color:var(--text); }
.rt-btn-danger { background:rgba(255,77,95,0.12); color:var(--danger); border:1px solid rgba(255,77,95,0.3); }
.rt-btn-danger:hover { background:rgba(255,77,95,0.2); }
.rt-btn-sm { padding:7px 14px; font-size:12px; border-radius:14px; }
.rt-icon-btn { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; color:var(--soft); font-size:14px; padding:6px 10px; cursor:pointer; transition:0.2s; }
.rt-icon-btn:hover { background:rgba(255,255,255,0.1); color:var(--text); }
.rt-icon-btn-danger:hover { background:rgba(255,77,95,0.15); color:var(--danger); border-color:rgba(255,77,95,0.3); }
.rt-order-btn { background:transparent; border:1px solid rgba(255,255,255,0.08); border-radius:6px; color:var(--muted); font-size:9px; padding:2px 5px; cursor:pointer; display:block; transition:0.2s; }
.rt-order-btn:hover:not([disabled]) { background:rgba(255,255,255,0.1); color:var(--text); }
.rt-order-btn[disabled] { opacity:0.25; cursor:default; }
.rt-link { background:none; border:none; color:var(--teal); font-size:inherit; font-weight:700; cursor:pointer; text-decoration:underline; }
.rt-start-btn { padding:11px 22px; font-size:14px; box-shadow:0 4px 20px rgba(0,212,255,0.25); }

/* Inputs */
.rt-input { width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:var(--text); padding:10px 14px; font-size:14px; font-weight:500; outline:none; transition:border-color 0.2s; font-family:inherit; }
.rt-input:focus { border-color:rgba(0,212,255,0.4); box-shadow:0 0 0 3px rgba(0,212,255,0.08); }
.rt-input-error { border-color:var(--danger) !important; }
.rt-textarea { resize:vertical; min-height:70px; }
.rt-select { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:var(--text); padding:10px 14px; font-size:14px; font-weight:600; outline:none; cursor:pointer; transition:border-color 0.2s; font-family:inherit; width:100%; }
.rt-select:focus { border-color:rgba(0,212,255,0.4); }
.rt-select option { background:#0c121a; }
.rt-select-sm { padding:7px 10px; font-size:12px; border-radius:10px; width:auto; }
.rt-select-xs { padding:5px 8px; font-size:11px; border-radius:8px; width:100%; }
.rt-input-sm { padding:7px 10px; font-size:13px; border-radius:10px; }
.rt-input-xs { padding:5px 8px; font-size:12px; border-radius:8px; width:100%; min-width:0; }
.rt-label { font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.06em; display:block; margin-bottom:5px; }

/* Tags */
.rt-tag { display:inline-flex; align-items:center; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; border:1px solid transparent; }
.rt-goal-chip  { display:inline-flex; align-items:center; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; border:1px solid transparent; }
.rt-day-chip   { background:rgba(255,255,255,0.06); color:var(--soft); border:1px solid rgba(255,255,255,0.1); display:inline-flex; align-items:center; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; }
.rt-block-type-chip { background:rgba(139,92,246,0.12); color:#a78bfa; border:1px solid rgba(139,92,246,0.25); display:inline-flex; align-items:center; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:700; }
.rt-tag-muted  { background:rgba(255,255,255,0.05); color:var(--muted); border-color:rgba(255,255,255,0.08); }
.rt-tag-equip  { background:rgba(0,212,255,0.07); color:var(--soft); border-color:rgba(0,212,255,0.2); }
.rt-tag-prog   { background:rgba(245,158,11,0.1); color:#fbbf24; border-color:rgba(245,158,11,0.25); }

/* Program Grid */
.rt-prog-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px,1fr)); gap:16px; }
.rt-prog-card { background:linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015)); border:1px solid rgba(255,255,255,0.08); border-radius:22px; padding:22px; cursor:pointer; transition:all 0.2s ease; position:relative; overflow:hidden; }
.rt-prog-card:hover { transform:translateY(-4px); box-shadow:0 16px 40px rgba(0,0,0,0.4); border-color:rgba(255,255,255,0.15); }
.rt-prog-card-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; }
.rt-prog-icon { width:44px; height:44px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:22px; }
.rt-prog-name { font-size:17px; font-weight:800; margin:0 0 5px; letter-spacing:-0.02em; }
.rt-prog-meta { font-size:12px; color:var(--muted); margin:0; font-weight:600; }
.rt-prog-arrow { position:absolute; bottom:18px; right:20px; font-size:20px; font-weight:900; opacity:0.6; transition:transform 0.2s; }
.rt-prog-card:hover .rt-prog-arrow { transform:translateX(4px); opacity:1; }

/* Routine Card */
.rt-routine-card { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:22px; overflow:hidden; cursor:pointer; transition:all 0.2s ease; display:flex; }
.rt-routine-card:hover { background:rgba(255,255,255,0.04); border-color:rgba(255,255,255,0.13); transform:translateX(4px); }
.rt-routine-card-body { flex:1; padding:18px 20px; min-width:0; }
.rt-routine-card-action { padding:16px 14px; display:flex; align-items:center; }
.rt-routine-name { font-size:16px; font-weight:800; margin:0; letter-spacing:-0.02em; }
.rt-metric-row { display:flex; gap:16px; flex-wrap:wrap; }
.rt-metric { text-align:center; min-width:60px; }
.rt-metric span { display:block; font-size:16px; font-weight:800; font-family:'Space Grotesk',Inter,sans-serif; color:var(--text); }
.rt-metric small { font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.08em; }

/* Detail View */
.rt-breadcrumb { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
.rt-back-btn { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:12px; color:var(--soft); padding:8px 14px; font-size:13px; font-weight:700; cursor:pointer; transition:0.2s; }
.rt-back-btn:hover { background:rgba(255,255,255,0.08); color:var(--text); }
.rt-breadcrumb-sep { color:var(--muted); }
.rt-detail-header { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.07); border-radius:22px; padding:24px; margin-bottom:18px; }
.rt-detail-title { font-family:'Space Grotesk',Inter,sans-serif; font-size:clamp(20px,4vw,28px); font-weight:800; letter-spacing:-0.03em; margin:0; }
.rt-detail-desc { font-size:13px; color:var(--soft); margin:10px 0 0; line-height:1.6; }
.rt-metric-row-large .rt-metric span { font-size:22px; }
.rt-equip-row { margin-bottom:16px; }
.rt-card { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:18px; padding:18px; }
.rt-detail-block { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.07); border-radius:18px; overflow:hidden; }
.rt-detail-block-header { display:flex; align-items:center; gap:10px; padding:14px 18px; border-bottom:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.02); flex-wrap:wrap; }
.rt-detail-block-name { font-size:14px; font-weight:800; color:var(--text); }
.rt-detail-exercise { display:flex; align-items:flex-start; gap:14px; padding:14px 18px; transition:background 0.2s; }
.rt-detail-exercise:hover { background:rgba(255,255,255,0.02); }
.rt-detail-exercise-border { border-top:1px solid rgba(255,255,255,0.04); }
.rt-detail-ex-num { width:24px; height:24px; border-radius:50%; background:rgba(0,212,255,0.1); border:1px solid rgba(0,212,255,0.25); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; color:var(--teal); flex-shrink:0; margin-top:1px; }
.rt-detail-ex-body { flex:1; min-width:0; }
.rt-detail-ex-name { font-size:14px; font-weight:700; margin-bottom:4px; }
.rt-detail-ex-meta { display:flex; gap:8px; flex-wrap:wrap; font-size:12px; color:var(--muted); font-weight:600; align-items:center; }
.rt-detail-ex-notes { font-size:12px; color:var(--muted); margin:5px 0 0; font-style:italic; }
.rt-detail-ex-weight { font-size:13px; font-weight:800; color:var(--teal); white-space:nowrap; padding-top:2px; }
.rt-detail-block-rest { padding:8px 18px; background:rgba(0,212,255,0.04); font-size:11px; color:var(--muted); font-weight:700; border-top:1px solid rgba(255,255,255,0.04); }

/* Editor */
.rt-editor-fields { margin-bottom:16px; }
.rt-field-group { margin-bottom:14px; }
.rt-field-row { display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; }
@media(max-width:600px){ .rt-field-row { grid-template-columns:1fr 1fr; } }
.rt-editor-block { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.08); border-radius:18px; margin-bottom:14px; overflow:hidden; }
.rt-editor-block-header { display:flex; align-items:center; gap:10px; padding:12px 14px; background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.06); }
.rt-block-name-input { background:transparent; border:1px solid rgba(255,255,255,0.06); border-radius:8px; color:var(--text); font-size:14px; font-weight:700; padding:6px 10px; flex:1; outline:none; }
.rt-block-name-input:focus { border-color:rgba(0,212,255,0.35); }
.rt-editor-block-items { padding:12px 14px; }
.rt-editor-block-footer { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-top:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.15); flex-wrap:wrap; gap:10px; }
.rt-editor-item { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:12px; margin-bottom:10px; }
.rt-editor-item-top { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.rt-editor-ex-name { font-size:14px; font-weight:700; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rt-editor-item-fields { display:grid; grid-template-columns: repeat(auto-fill, minmax(90px,1fr)); gap:8px; margin-bottom:8px; }
.rt-editor-field-mini label { font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.05em; display:block; margin-bottom:3px; }
.rt-editor-field-progression { grid-column: span 2; }
.rt-editor-item-notes { margin-top:4px; }

/* Templates */
.rt-template-card { background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.08); border-radius:22px; padding:22px; transition:all 0.2s ease; }
.rt-template-card:hover { background:rgba(255,255,255,0.04); transform:translateX(4px); }

/* Empty State */
.rt-empty { text-align:center; padding:48px 24px; }
.rt-empty-icon { font-size:48px; margin-bottom:12px; }
.rt-empty h3 { font-size:18px; font-weight:800; margin:0 0 8px; }
.rt-empty p { color:var(--muted); margin:0; font-size:14px; }

/* Overlay & Modal */
.rt-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(8px); z-index:9998; display:flex; align-items:center; justify-content:center; padding:16px; animation:rtFadeIn 0.2s ease; }
.rt-modal { background:linear-gradient(180deg,rgba(14,20,28,0.98),rgba(8,12,18,0.99)); border:1px solid rgba(255,255,255,0.1); border-radius:24px; width:100%; max-width:520px; max-height:90vh; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 24px 80px rgba(0,0,0,0.7); animation:rtSlideUp 0.25s cubic-bezier(0.16,1,0.3,1); }
.rt-modal-header { display:flex; justify-content:space-between; align-items:center; padding:18px 20px; border-bottom:1px solid rgba(255,255,255,0.07); }
.rt-modal-title { font-size:17px; font-weight:800; margin:0; }
.rt-picker-modal { max-width:460px; }
.rt-picker-list { overflow-y:auto; padding:8px; flex:1; display:flex; flex-direction:column; gap:4px; }
.rt-picker-item { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border-radius:12px; cursor:pointer; transition:0.15s; background:transparent; border:none; width:100%; color:var(--text); }
.rt-picker-item:hover { background:rgba(0,212,255,0.07); }
.rt-picker-item-name { font-size:14px; font-weight:700; text-align:left; }
.rt-picker-item-meta { font-size:12px; color:var(--muted); font-weight:600; text-align:left; }
.rt-confirm-modal { max-width:400px; }

/* Context Menu */
.rt-context-overlay { position:fixed; inset:0; z-index:9990; }
.rt-context-menu { position:fixed; z-index:9991; background:linear-gradient(180deg,rgba(14,20,28,0.97),rgba(8,12,18,0.99)); border:1px solid rgba(255,255,255,0.1); border-radius:16px; box-shadow:0 12px 40px rgba(0,0,0,0.6); min-width:190px; overflow:hidden; animation:rtDropPop 0.18s cubic-bezier(0.16,1,0.3,1); }
.rt-context-item { display:block; width:100%; text-align:left; background:none; border:none; padding:12px 16px; font-size:13px; font-weight:700; color:var(--soft); cursor:pointer; transition:0.15s; font-family:inherit; }
.rt-context-item:hover { background:rgba(255,255,255,0.06); color:var(--text); }
.rt-context-item-danger { color:var(--danger) !important; }
.rt-context-item-danger:hover { background:rgba(255,77,95,0.1) !important; }

@keyframes rtFadeIn   { from{opacity:0} to{opacity:1} }
@keyframes rtSlideUp  { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:none} }
@keyframes rtDropPop  { from{opacity:0;transform:translateY(-6px) scale(0.95)} to{opacity:1;transform:none} }
`;
    document.head.appendChild(s);
}

// Listen for workoutsChanged to reload data if currently on routines tab
document.addEventListener('workoutsChanged', async () => {
    if (window.wkState && window.wkState.currentTab === 'routines') {
        await rtLoad();
        rtRedraw();
    }
});

})(); // end IIFE
