/* ----------------------------------------------------
   FINAL WORKOUT TAB MASTER SPEC
   Exercises Subtab Intelligence Pass
---------------------------------------------------- */

// --- STATE ---
const exState = {
    allExercises: [],
    customExercises: [],
    merged: [],
    enriched: [], // Merged + dynamic stats
    routines: [],
    searchQuery: '',
    filterMuscle: 'all',
    filterEquip: 'all',
    filterPattern: 'All',
    sortBy: 'Alphabetical',
    viewMode: 'library', // 'library', 'detail', 'form'
    selectedExercise: null,
    searchTimeout: null,
};

// --- DATA AGGREGATION ENGINE ---
async function loadAllExercises() {
    exState.allExercises = await apexDB.getAll('exerciseLibrary');
    exState.customExercises = await apexDB.getAll('customExercises');
    exState.routines = await apexDB.getAll('routines');
    const allSets = await apexDB.getAll('workoutSets') || [];
    
    // Merge, ensuring custom flag
    const builtIn = exState.allExercises.map(ex => ({ ...ex, isCustom: false }));
    const custom = exState.customExercises.map(ex => ({ ...ex, isCustom: true }));
    exState.merged = [...builtIn, ...custom];

    // Build fast lookup for stats based on workout history
    const statsMap = {};
    allSets.forEach(set => {
        if (!statsMap[set.exerciseName]) {
            statsMap[set.exerciseName] = { sets: [], lifetimeVolume: 0, sessions: new Set() };
        }
        statsMap[set.exerciseName].sets.push(set);
        statsMap[set.exerciseName].lifetimeVolume += (Number(set.weight) || 0) * (Number(set.reps) || 0);
        if (set.sessionId) statsMap[set.exerciseName].sessions.add(set.sessionId);
    });

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // Enrich exercises with computed metrics
    exState.enriched = exState.merged.map(ex => {
        const stats = statsMap[ex.name] || { sets: [], lifetimeVolume: 0, sessions: new Set() };
        
        // Usage calculations
        const usageCount = stats.sets.length;
        const sessionCount = stats.sessions.size;
        let lastUsed = null;
        let isRecentlyUsed = false;

        // Sort sets by date to get history metrics
        const sortedSets = [...stats.sets].sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
        if (sortedSets.length > 0) {
            lastUsed = new Date(sortedSets[sortedSets.length - 1].createdAt);
            isRecentlyUsed = (now - lastUsed.getTime()) < sevenDaysMs;
        }

        // RPE (pull integer values from strings like "RPE 8")
        const validRPEs = stats.sets.map(s => Number(s.rpe?.replace(/[^0-9.]/g, ''))).filter(n => !isNaN(n) && n>0);
        const avgRPE = validRPEs.length ? (validRPEs.reduce((a,b)=>a+b,0)/validRPEs.length).toFixed(1) : null;

        return {
            ...ex,
            usageCount,
            sessionCount,
            lastUsed,
            isRecentlyUsed,
            lifetimeVolume: stats.lifetimeVolume,
            avgRPE,
            sortedSets // Kept for detail view trend logic
        };
    });
}

// Global Alternative Engine
window.getAlternativeExercises = function(exerciseId) {
    const target = exState.enriched.find(e => e.id === exerciseId);
    if (!target) return [];

    return exState.enriched
        .filter(ex => ex.id !== target.id)
        .map(ex => {
            let score = 0;
            const sameMuscle = ex.primaryMuscle === target.primaryMuscle;
            const sameEquip = ex.equipment === target.equipment;
            const samePattern = ex.movementPattern === target.movementPattern;

            if (sameMuscle && sameEquip) score += 3;
            else if (sameMuscle) score += 2;
            else if (samePattern) score += 1;

            return { exercise: ex, score };
        })
        .filter(item => item.score > 0)
        .sort((a,b) => b.score - a.score || b.exercise.usageCount - a.exercise.usageCount)
        .map(item => item.exercise)
        .slice(0, 5); // Return top 5
};

const EX_MUSCLES = [
    { id: 'all', label: 'Show All' },
    { id: 'shoulders', label: 'Shoulders / Delts' },
    { id: 'biceps', label: 'Biceps' },
    { id: 'triceps', label: 'Triceps' },
    { id: 'forearms', label: 'Forearms / Grip' },
    { id: 'chest', label: 'Chest' },
    { id: 'back', label: 'Back' },
    { id: 'core', label: 'Core' },
    { id: 'traps', label: 'Traps / Upper Back' },
    { id: 'glutes', label: 'Glutes' },
    { id: 'quads', label: 'Quads' },
    { id: 'hamstrings', label: 'Hamstrings' },
    { id: 'calves', label: 'Calves' },
    { id: 'adductors', label: 'Adductors (Inner Thigh)' },
    { id: 'abductors', label: 'Abductors (Outer Hip)' },
    { id: 'hip_flexors', label: 'Hip Flexors' },
    { id: 'full_body', label: 'Full Body' },
    { id: 'cardio', label: 'Cardio / Conditioning' },
    { id: 'other', label: 'Uncategorized / Other' }
];

const EX_EQUIPMENT = [
    { id: 'all', label: 'Show All' },
    { id: 'barbell', label: 'Barbell' },
    { id: 'dumbbell', label: 'Dumbbell' },
    { id: 'kettlebell', label: 'Kettlebell' },
    { id: 'ez_bar', label: 'EZ Bar / Curl Bar' },
    { id: 'trap_bar', label: 'Trap Bar / Hex Bar' },
    { id: 'smith_machine', label: 'Smith Machine' },
    { id: 'machine', label: 'Machine (Plate/Pin)' },
    { id: 'cable', label: 'Cable / Pulley' },
    { id: 'band', label: 'Resistance Band' },
    { id: 'bodyweight', label: 'Bodyweight' },
    { id: 'suspension', label: 'Rings / TRX' },
    { id: 'landmine', label: 'Landmine' },
    { id: 'medicine_ball', label: 'Medicine Ball' },
    { id: 'sled', label: 'Sled' },
    { id: 'cardio_machine', label: 'Cardio Machine' },
    { id: 'other', label: 'Other / Misc' }
];

function getExLabel(type, rawValue) {
    if(!rawValue) return 'Unknown';
    if(type === 'muscle') {
        const m = EX_MUSCLES.find(x => x.id === rawValue);
        return m ? m.label.split(' / ')[0].split(' (')[0] : (rawValue === 'All' ? 'All' : rawValue);
    }
    if(type === 'equip') {
        const e = EX_EQUIPMENT.find(x => x.id === rawValue);
        return e ? e.label.split(' (')[0].split(' / ')[0] : (rawValue === 'All' ? 'All' : rawValue);
    }
    return rawValue;
}

// --- LOGIC FUNCTIONS ---
function filterExercises() {
    let result = exState.enriched;
    
    if (exState.searchQuery) {
        const q = exState.searchQuery.toLowerCase();
        result = result.filter(ex => ex.name.toLowerCase().includes(q) || (ex.primaryMuscle && ex.primaryMuscle.toLowerCase().includes(q)));
    }
    
    if (exState.filterMuscle !== 'all' && exState.filterMuscle !== 'All') result = result.filter(ex => ex.primaryMuscle === exState.filterMuscle);
    if (exState.filterEquip !== 'all' && exState.filterEquip !== 'All') result = result.filter(ex => ex.equipment === exState.filterEquip);
    if (exState.filterPattern !== 'All') result = result.filter(ex => ex.movementPattern === exState.filterPattern);
    
    return result;
}

function sortExercises(list) {
    return list.sort((a, b) => {
        if (exState.sortBy === 'Alphabetical') return a.name.localeCompare(b.name);
        if (exState.sortBy === 'Recently Used') return (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0);
        if (exState.sortBy === 'Most Used') return b.usageCount - a.usageCount;
        if (exState.sortBy === 'Custom First') {
            if (a.isCustom === b.isCustom) return a.name.localeCompare(b.name);
            return a.isCustom ? -1 : 1;
        }
        return 0;
    });
}

// --- GLOBAL EXPORTS ---
window.saveCustomExercise = async function() {
    const idField = document.getElementById('exId').value;
    const isEdit = !!idField;
    const nameStr = document.getElementById('exName').value.trim();

    if (!nameStr) return toast("Exercise name is required.");

    // Duplicate Check
    const duplicate = exState.enriched.find(e => e.name.toLowerCase() === nameStr.toLowerCase() && e.id !== idField);
    if (duplicate) return toast("An exercise with this name already exists.");

    // Secondary Muscles Array from JSON
    let secondaryMuscles = [];
    try {
        const secVal = document.getElementById('exSecMuscle').value;
        secondaryMuscles = secVal ? JSON.parse(secVal) : [];
    } catch(e) {}

    const data = {
        id: isEdit ? idField : 'custom_' + Date.now(),
        name: nameStr,
        primaryMuscle: document.getElementById('exMuscle').value || 'Uncategorized',
        secondaryMuscles,
        equipment: document.getElementById('exEquip').value || 'Bodyweight',
        movementPattern: document.getElementById('exPattern').value || 'Other',
        trackingType: document.getElementById('exTrackType').value || 'Weight + Reps',
        notes: document.getElementById('exNotes').value.trim(),
        isCustom: true,
        usageCount: isEdit && exState.selectedExercise ? exState.selectedExercise.usageCount : 0,
        createdAt: isEdit ? document.getElementById('exCreatedAt').value : new Date().toISOString()
    };
    
    await apexDB.put('customExercises', data);
    document.dispatchEvent(new Event('exerciseLibraryUpdated'));
    toast("Exercise saved");
    exState.viewMode = 'library';
    renderExTab();
};

window.deleteCustomExercise = async function(id) {
    if(confirm("Permanently delete this custom exercise?")) {
        await apexDB.delete('customExercises', id);
        toast("Exercise deleted");
        exState.selectedExercise = null;
        exState.viewMode = 'library';
        document.dispatchEvent(new Event('exerciseLibraryUpdated'));
    }
};

window.openExerciseDetail = function(id) {
    exState.selectedExercise = exState.enriched.find(e => e.id === id);
    exState.viewMode = 'detail';
    renderExTab();
};

window.openExerciseForm = function(id = null) {
    exState.selectedExercise = id ? exState.enriched.find(e => e.id === id) : null;
    exState.viewMode = 'form';
    renderExTab();
};

window.setExView = function(view) {
    exState.viewMode = view;
    renderExTab();
};

// --- RENDERING ---
window.renderTabExercises = async function(container) {
    if (!document.getElementById('exSubtabInner')) {
        container.innerHTML = `<div id="exSubtabInner" style="animation:fadeUp 0.3s ease;"><p class="muted" style="text-align:center; padding: 40px;">Loading Library...</p></div>`;
    }
    await loadAllExercises();
    renderExTab();
};

document.addEventListener('exerciseLibraryUpdated', async () => {
    if (window.wkState && window.wkState.currentTab === 'exercises') {
        await loadAllExercises();
        renderExTab();
    }
});

async function renderExTab() {
    const root = document.getElementById('exSubtabInner');
    if (!root) return;

    if (exState.viewMode === 'library') {
        root.innerHTML = renderLibraryHTML();
        bindLibraryEvents();
    } else if (exState.viewMode === 'detail') {
        root.innerHTML = await renderDetailHTML(exState.selectedExercise);
    } else if (exState.viewMode === 'form') {
        root.innerHTML = renderFormHTML(exState.selectedExercise);
    }
}

// ----------------------------------------------------
// UI TEMPLATES
// ----------------------------------------------------

function renderCard(ex) {
    const muscleLabel = getExLabel('muscle', ex.primaryMuscle || 'other');
    const equipLabel = getExLabel('equip', ex.equipment || 'other');

    return `
        <article class="card hover-lift" style="cursor:pointer; padding: 18px;" onclick="openExerciseDetail('${ex.id}')">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                <h3 style="margin: 0; font-size:18px; font-weight:700; letter-spacing:-0.01em;">${esc(ex.name)}</h3>
                <div style="display:flex; align-items:center; gap:8px;">
                    ${ex.isCustom ? `<span style="color:var(--teal);" title="Custom Exercise created by you">${Icons.customUser(16)}</span>` : ''}
                    ${ex.isRecentlyUsed ? `<span style="width:8px; height:8px; border-radius:50%; background:var(--green); box-shadow:0 0 8px var(--green);"></span>` : ''}
                </div>
            </div>
            <div style="display:flex; gap: 6px; flex-wrap:wrap; margin-bottom: 14px;">
                <span class="pill" style="background:rgba(255,255,255,0.08); color:var(--text); font-weight:600; font-size:10px; padding: 4px 8px;">${esc(muscleLabel)}</span>
                <span class="pill" style="background:rgba(255,255,255,0.04); color:var(--soft); font-weight:600; font-size:10px; padding: 4px 8px;">${esc(equipLabel)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:12px; color:var(--soft); font-weight:500;">${esc(ex.movementPattern && ex.movementPattern !== 'Other' ? ex.movementPattern : 'Standard')} Pattern</span>
                ${ex.usageCount > 0 ? `<span style="font-size:12px; color:var(--teal); font-weight:600;">Used ${ex.usageCount}x</span>` : `<span style="font-size:12px; opacity:0.4;">Never used</span>`}
            </div>
        </article>
    `;
}

function renderLibraryHTML() {
    const list = sortExercises(filterExercises());
    const recentExercises = [...exState.enriched].filter(e => e.lastUsed).sort((a,b) => b.lastUsed - a.lastUsed).slice(0, 5);

    return `
        <style>
            .custom-filter-btn {
                appearance: none;
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 14px;
                padding: 10px 16px;
                color: var(--text);
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                white-space: nowrap;
                transition: all 0.2s ease;
                box-shadow: inset 0 2px rgba(255,255,255,0.02), 0 4px 14px rgba(0,0,0,0.15);
            }
            .custom-filter-btn:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.15); transform: translateY(-1px); }
            .custom-filter-btn.active { background: rgba(0,212,255,0.1); border-color: rgba(0,212,255,0.3); color: var(--teal); }
            .custom-filter-btn.sort-btn { background: transparent; border-color: transparent; box-shadow: none; padding: 10px 4px; color: var(--teal); }
            .custom-filter-btn.sort-btn:hover { background: rgba(0,212,255,0.05); }
            .custom-filter-btn .chevron { transition: transform 0.2s; }
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

            /* Contextual Dropdown */
            .ex-dropdown-overlay {
                position: fixed; inset: 0; z-index: 9998;
                /* Transparent to avoid dimming background */
            }
            .ex-dropdown-menu {
                position: fixed; z-index: 9999;
                background: linear-gradient(180deg, rgba(20,26,33,0.95) 0%, rgba(10,14,20,0.98) 100%);
                backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 16px;
                box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px rgba(255,255,255,0.05);
                min-width: 220px; max-width: 280px;
                max-height: 320px;
                display: flex; flex-direction: column;
                animation: dropPop 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                transform-origin: top left;
            }
            .ex-dropdown-list {
                overflow-y: auto;
                padding: 8px;
                display: flex; flex-direction: column; gap: 4px;
            }
            .ex-dropdown-item {
                padding: 10px 14px;
                border-radius: 10px;
                font-size: 14px; font-weight: 600;
                color: var(--soft);
                cursor: pointer;
                display: flex; align-items: center; justify-content: space-between;
                transition: all 0.15s ease;
            }
            .ex-dropdown-item:hover { background: rgba(255,255,255,0.06); color: #fff; }
            .ex-dropdown-item.selected { background: rgba(0,212,255,0.08); color: var(--teal); }
            
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
            
            @keyframes dropPop {
                from { opacity: 0; transform: translateY(-8px) scale(0.96); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
        </style>

        <div class="ex-library-header" style="margin-bottom: 24px; animation: fadeUp 0.3s ease;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px; flex-wrap:wrap; gap:16px;">
                <div>
                    <h2 style="font-family:'Space Grotesk', sans-serif; margin:0; font-size:28px; font-weight:800; letter-spacing:-0.03em;">Exercises</h2>
                    <p class="muted small" style="margin:4px 0 0 0; letter-spacing:0.02em;">${exState.merged.length} master exercises synced</p>
                </div>
                <button class="btn btn-teal" style="padding: 10px 20px; border-radius: 20px; font-size: 14px; display:flex; align-items:center; gap:8px; font-weight: 800; box-shadow: 0 4px 20px rgba(0,212,255,0.3);" onclick="openExerciseForm()">
                    ${Icons.plus(20, 2.5)}
                    New
                </button>
            </div>
            
            <div style="margin-bottom: 24px;">
                <!-- Modern Search Bar -->
                <div style="position:relative; width: 100%; margin-bottom: 12px; border-radius: 20px; background: rgba(255,255,255,0.02); box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);">
                    ${Icons.search(18, 1.5, 'position:absolute; left:16px; top:50%; transform:translateY(-50%); color:var(--teal);')}
                    <input type="text" id="exSearch" oninput="exOnSearchInput(this.value)" placeholder="Search any exercise by name, muscle, equipment..." value="${exState.searchQuery}" style="width:100%; padding: 16px 20px 16px 48px; background: transparent; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; color: #fff; font-size: 15px; font-weight: 500; outline: none; transition: border-color 0.2s;">
                </div>
                
                <!-- Native-Free Triggers Row -->
                <div style="display:flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; align-items: center;" class="hide-scrollbar">
                    
                    <button onclick="window.openExDropdown(event, 'muscle')" class="custom-filter-btn ${exState.filterMuscle !== 'All' && exState.filterMuscle !== 'all' ? 'active' : ''}">
                        <span style="opacity:0.6; margin-right:2px; font-weight:600;">Muscle:</span> ${getExLabel('muscle', exState.filterMuscle)}
                        ${Icons.chevronDown(14)}
                    </button>
                    
                    <button onclick="window.openExDropdown(event, 'equip')" class="custom-filter-btn ${exState.filterEquip !== 'All' && exState.filterEquip !== 'all' ? 'active' : ''}">
                        <span style="opacity:0.6; margin-right:2px; font-weight:600;">Equip:</span> ${getExLabel('equip', exState.filterEquip)}
                        ${Icons.chevronDown(14)}
                    </button>

                    <div style="flex-grow: 1; min-width: 12px;"></div> <!-- Flexible Spacer -->

                    <button onclick="window.openExDropdown(event, 'sort')" class="custom-filter-btn sort-btn" style="flex-shrink:0;">
                         ${Icons.filter(18, 2)}
                         <span style="margin-left:4px;">${exState.sortBy}</span>
                    </button>
                </div>
            </div>
        </div>

        ${recentExercises.length > 0 && exState.searchQuery === '' && exState.filterMuscle === 'All' && exState.filterEquip === 'All' ? `
            <div style="margin-bottom: 28px;">
                <p class="stat-label" style="margin-bottom:14px; display:flex; align-items:center; gap:8px; font-size:11px;">
                    <span style="width:8px; height:8px; border-radius:50%; background:var(--green); display:inline-block; box-shadow:0 0 10px var(--green);"></span> RECENTLY USED
                </p>
                <div style="display:flex; gap:16px; overflow-x:auto; padding-bottom:12px; scroll-snap-type: x mandatory;" class="hide-scrollbar">
                    ${recentExercises.map(ex => `<div style="min-width: 260px; scroll-snap-align: start;">${renderCard(ex)}</div>`).join('')}
                </div>
            </div>
        ` : ''}

        <div id="exListContainer" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:16px;">
            ${list.map(ex => renderCard(ex)).join('')}
            ${list.length === 0 ? `<div class="card span-full" style="text-align:center; grid-column: 1 / -1; padding: 40px;"><p class="muted">No exercises match your criteria.</p></div>` : ''}
        </div>
    `;
}

// Highly Optimized Live Search
window.exOnSearchInput = function(val) {
    clearTimeout(exState.searchTimeout);
    exState.searchTimeout = setTimeout(() => {
        exState.searchQuery = val.trim();
        window.updateExListDOM();
    }, 150);
};

window.updateExListDOM = function() {
    const list = sortExercises(filterExercises());
    const container = document.getElementById('exListContainer');
    if (container) {
        container.innerHTML = `
            ${list.map(ex => renderCard(ex)).join('')}
            ${list.length === 0 ? `<div class="card span-full" style="text-align:center; grid-column: 1 / -1; padding: 40px;"><p class="muted">No exercises match your criteria.</p></div>` : ''}
        `;
    }
};

// --- Native-Free Dropdown Menus ---
window.openExDropdown = function(e, type) {
    if (document.getElementById('exDropdownContainer')) {
        const isSame = document.getElementById('exDropdownContainer').dataset.type === type;
        window.closeExDropdown();
        if (isSame) return; // User clicked the same button, close it.
    }

    const rect = e.currentTarget.getBoundingClientRect();
    
    let options = [];
    let currentValue = '';
    
    if (type === 'muscle') {
        options = EX_MUSCLES;
        currentValue = exState.filterMuscle;
    } else if (type === 'equip') {
        options = EX_EQUIPMENT;
        currentValue = exState.filterEquip;
    } else if (type === 'sort') {
        options = [
            {id: 'Alphabetical', label: 'Alphabetical'}, 
            {id: 'Recently Used', label: 'Recently Used'}, 
            {id: 'Most Used', label: 'Most Used'}, 
            {id: 'Custom First', label: 'Custom First'}
        ];
        currentValue = exState.sortBy;
    }

    const html = `
        <div class="ex-dropdown-overlay" onclick="window.closeExDropdown()"></div>
        <div class="ex-dropdown-menu" style="top: ${rect.bottom + 8}px; left: ${rect.left}px;">
            <div class="ex-dropdown-list custom-scrollbar">
                ${options.map(opt => `
                    <div class="ex-dropdown-item ${opt.id === currentValue ? 'selected' : ''}" onclick="window.selectExDropdownOption('${type}', '${opt.id}')">
                        <span>${opt.label}</span>
                        ${opt.id === currentValue ? Icons.checkFill(16) : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    const div = document.createElement('div');
    div.id = "exDropdownContainer";
    div.dataset.type = type;
    div.innerHTML = html;
    document.body.appendChild(div);

    // Reposition if offscreen to the right
    const menu = div.querySelector('.ex-dropdown-menu');
    if (rect.left + menu.offsetWidth > window.innerWidth - 16) {
        menu.style.left = 'auto';
        menu.style.right = '16px'; // 16px padding from screen edge
        // Note: transform-origin could be shifted to top-right here, but top-left still looks okay.
        menu.style.transformOrigin = 'top right';
    }
};

window.closeExDropdown = function() {
    const dropdown = document.getElementById('exDropdownContainer');
    if (dropdown) {
        dropdown.remove();
    }
};

window.selectExDropdownOption = function(type, value) {
    if (type === 'muscle') exState.filterMuscle = value;
    if (type === 'equip') exState.filterEquip = value;
    if (type === 'sort') exState.sortBy = value;
    
    window.closeExDropdown();
    renderExTab();
};

window.openFormDropdown = function(e, fieldKey) {
    if (document.getElementById('formDropdownContainer')) {
        const isSame = document.getElementById('formDropdownContainer').dataset.key === fieldKey;
        window.closeFormDropdown();
        if (isSame) return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    let options = [];
    let currentValue = document.getElementById(fieldKey).value;
    let isMulti = fieldKey === 'exSecMuscle';
    
    // Parse current values
    if (isMulti) {
        try { currentValue = JSON.parse(currentValue); } catch(err) { currentValue = []; }
    }
    
    // Configs
    if (fieldKey === 'exMuscle' || fieldKey === 'exSecMuscle') {
        options = EX_MUSCLES.filter(m => m.id !== 'all');
    } else if (fieldKey === 'exEquip') {
        options = EX_EQUIPMENT.filter(e => e.id !== 'all');
    } else if (fieldKey === 'exPattern') {
        options = ['Push (Horizontal)', 'Push (Vertical)', 'Pull (Horizontal)', 'Pull (Vertical)', 'Squat', 'Hinge', 'Lunge', 'Carry', 'Core', 'Rotation / Anti-Rotation', 'Mobility / Stretching', 'Cardio / Conditioning', 'Other'].map(p => ({id: p, label: p}));
    } else if (fieldKey === 'exTrackType') {
        options = ['Weight + Reps', 'Bodyweight + Reps', 'Assisted Weight + Reps', 'Time', 'Distance', 'Distance + Time', 'Weight + Time', 'Weight + Distance'].map(p => ({id: p, label: p}));
    }

    const html = `
        <div class="ex-dropdown-overlay" onclick="window.closeFormDropdown()"></div>
        <div class="ex-dropdown-menu" style="top: ${rect.bottom + 8}px; left: ${rect.left}px; min-width: ${Math.max(220, rect.width)}px;">
            <div class="ex-dropdown-list custom-scrollbar">
                ${options.map(opt => {
                    const isSelected = isMulti ? currentValue.includes(opt.id) : currentValue === opt.id;
                    return `
                    <div class="ex-dropdown-item ${isSelected ? 'selected' : ''}" onclick="window.selectFormOption(event, '${fieldKey}', '${opt.id}', ${isMulti})">
                        <span>${opt.label}</span>
                        ${isSelected ? Icons.checkFill(16) : ''}
                    </div>
                `}).join('')}
            </div>
        </div>
    `;

    const div = document.createElement('div');
    div.id = "formDropdownContainer";
    div.dataset.key = fieldKey;
    div.innerHTML = html;
    document.body.appendChild(div);

    const menu = div.querySelector('.ex-dropdown-menu');
    if (rect.left + menu.offsetWidth > window.innerWidth - 16) {
        menu.style.left = 'auto';
        menu.style.right = '16px';
        menu.style.transformOrigin = 'top right';
    }
};

window.closeFormDropdown = function() {
    const dropdown = document.getElementById('formDropdownContainer');
    if (dropdown) dropdown.remove();
};

window.selectFormOption = function(e, fieldKey, value, isMulti) {
    if (isMulti) {
        e.stopPropagation(); // keep menu open for multi-select
        const input = document.getElementById(fieldKey);
        let curr = [];
        try { curr = JSON.parse(input.value); } catch(e){}
        if (curr.includes(value)) curr = curr.filter(x => x !== value);
        else curr.push(value);
        input.value = JSON.stringify(curr);
        
        const btn = document.getElementById('btn_' + fieldKey);
        btn.querySelector('.val-text').textContent = curr.length ? curr.length + ' selected' : 'Select Secondary...';
        
        window.closeFormDropdown();
        btn.click(); // Re-open to refresh ticks immediately
    } else {
        document.getElementById(fieldKey).value = value;
        const opt = (fieldKey.includes('Muscle') ? EX_MUSCLES : fieldKey === 'exEquip' ? EX_EQUIPMENT : null)?.find(x => x.id === value);
        document.getElementById('btn_' + fieldKey).querySelector('.val-text').textContent = opt ? opt.label : value;
        window.closeFormDropdown();
    }
};

function bindLibraryEvents() {
    // Input event is handled natively by oninput="exOnSearchInput(this.value)"
    // The previous native select bindings are obsolete here
}

async function renderDetailHTML(ex) {
    if(!ex) return '<p>Exercise not found.</p>';
    
    const alts = window.getAlternativeExercises(ex.id);
    
    // Advanced Performance Trends Computation
    let best1RM = 0;
    let bestWeight = 0;
    let lastSessionWeight = '--';
    let trendTag = '<span class="badge" style="background:rgba(255,255,255,0.05); color:var(--soft);">Need Data</span>';

    try {
        const pr = await apexDB.getByIndex('personalRecords', 'exerciseId', ex.id);
        if (pr && pr.length > 0) {
            bestWeight = pr[0].bestWeight || 0;
            best1RM = pr[0].best1RM || 0;
        }

        // Trend logic based on session history
        if (ex.sortedSets.length > 0) {
            const sessionsMap = new Map();
            ex.sortedSets.forEach(s => {
                if(!s.sessionId) return;
                if(!sessionsMap.has(s.sessionId)) sessionsMap.set(s.sessionId, []);
                sessionsMap.get(s.sessionId).push(Number(s.weight) || 0);
            });

            const sessionIds = Array.from(sessionsMap.keys());
            if (sessionIds.length > 0) {
                const lastId = sessionIds[sessionIds.length - 1];
                lastSessionWeight = Math.max(...sessionsMap.get(lastId));
            }

            // If we have at least 3 sessions, check logic trend
            if (sessionIds.length >= 3) {
                const maxWeights = sessionIds.slice(-3).map(id => Math.max(...sessionsMap.get(id)));
                if (maxWeights[2] > maxWeights[1] && maxWeights[1] >= maxWeights[0]) {
                    trendTag = '<span class="badge green">📈 Improving</span>';
                } else if (maxWeights[2] < maxWeights[1] && maxWeights[1] <= maxWeights[0]) {
                    trendTag = '<span class="badge" style="color:red; background:rgba(255,0,0,0.1);">📉 Declining</span>';
                } else {
                    trendTag = '<span class="badge" style="color:var(--teal); background:rgba(0,212,255,0.1);">Stable</span>';
                }
            }
        }
    } catch(e) {}

    // Find linked routines
    const linkedRoutines = exState.routines.filter(r => (r.exercises || []).some(item => (typeof item === 'string' ? item : item.name) === ex.name));

    return `
        <div style="animation:fadeUp 0.3s ease; max-width:800px; margin:0 auto; padding-bottom: 40px;">
            <button class="btn hover-lift" onclick="setExView('library')" style="margin-bottom:16px; display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:30px; font-weight:800; padding:10px 20px;">
                ${Icons.back(18, 1.5)}
                Back
            </button>
            
            <div class="card" style="border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 16px 40px rgba(0,0,0,0.3); padding: 24px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
                    <div>
                        <h1 style="font-family:'Space Grotesk', sans-serif; margin:0 0 12px 0; line-height:1; font-size: 28px;">${esc(ex.name)}</h1>
                        <div>
                            ${trendTag}
                        </div>
                    </div>
                    ${ex.isCustom ? `
                        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                            <button class="btn hover-lift" onclick="openExerciseForm('${ex.id}')" style="padding:0; width:28px; height:28px; border-radius:50%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; color:var(--text);" title="Edit Exercise">
                                ${Icons.edit(14, 2)}
                            </button>
                            <button class="btn hover-lift" onclick="deleteCustomExercise('${ex.id}')" style="padding:0; width:28px; height:28px; border-radius:50%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; color:var(--text);" title="Delete Exercise">
                                ${Icons.trash(14, 1.5)}
                            </button>
                        </div>
                    ` : ''}
                </div>
                
                <div class="chip-row" style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:24px;">
                    <span class="pill" style="background:rgba(255,255,255,0.08); color:var(--text); font-weight:600;">${esc(ex.primaryMuscle || 'Misc')}</span>
                    ${ex.secondaryMuscles && ex.secondaryMuscles.length > 0 ? `<span class="pill" style="background:rgba(255,255,255,0.04); color:var(--soft); font-weight:600;">${esc(ex.secondaryMuscles.join(', '))}</span>` : ''}
                    <span class="pill" style="background:rgba(255,255,255,0.04); color:var(--soft); font-weight:600;">${esc(ex.equipment || 'No Equip')}</span>
                    <span class="pill" style="background:rgba(255,255,255,0.04); color:var(--soft); font-weight:600;">${esc(ex.movementPattern || 'Standard')} Pattern</span>
                    ${ex.isCustom ? `<span style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.05); color:var(--soft);" title="Custom Exercise">${Icons.customUser(15)}</span>` : ''}
                </div>

                <!-- Intelligence Metrics Matrix -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:12px; margin: 24px 0;">
                    <div class="glass" style="padding:16px; border-radius:14px;">
                        <p class="stat-label">Last Session</p>
                        <h3 style="margin:4px 0 0 0; color:var(--text);">${lastSessionWeight !== '--' ? lastSessionWeight + ' kg' : '--'}</h3>
                        <p class="small muted" style="margin:6px 0 0 0">${ex.lastUsed ? new Date(ex.lastUsed).toLocaleDateString() : 'Never'}</p>
                    </div>
                    <div class="glass" style="padding:16px; border-radius:14px;">
                        <p class="stat-label">All-Time PR</p>
                        <h3 style="margin:4px 0 0 0; color:var(--teal);">${bestWeight > 0 ? bestWeight + ' kg' : '--'}</h3>
                        <p class="small muted" style="margin:6px 0 0 0">Epley 1RM: ${best1RM > 0 ? best1RM : '--'}</p>
                    </div>
                    <div class="glass" style="padding:16px; border-radius:14px;">
                        <p class="stat-label">Lifetime Vol.</p>
                        <h3 style="margin:4px 0 0 0;">${typeof money === 'function' ? money(ex.lifetimeVolume) : ex.lifetimeVolume}</h3>
                        <p class="small muted" style="margin:6px 0 0 0">${ex.sessionCount} Sessions</p>
                    </div>
                    ${ex.avgRPE ? `
                    <div class="glass" style="padding:16px; border-radius:14px;">
                        <p class="stat-label">Avg RPE</p>
                        <h3 style="margin:4px 0 0 0; color:var(--orange);">${ex.avgRPE}</h3>
                        <p class="small muted" style="margin:6px 0 0 0">Intensity Track</p>
                    </div>` : ''}
                </div>

                <div class="grid grid-2" style="gap:24px;">
                    ${ex.notes || (ex.cues && ex.cues.length) ? `
                        <div>
                            <p class="stat-label" style="margin-bottom:8px;">Form Notes / Cues</p>
                            <div class="glass" style="padding:16px; border-radius:12px; line-height:1.6; font-size:14px; color:var(--soft);">
                                ${ex.cues ? `<ul style="margin:0; padding-left:16px;">${ex.cues.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
                                ${ex.notes ? `<p style="margin:${ex.cues?'12px 0 0 0':'0'};">${esc(ex.notes)}</p>` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <div>
                        <p class="stat-label" style="margin-bottom:8px;">Used In Routines</p>
                        <div class="glass" style="padding:16px; border-radius:12px;">
                            ${linkedRoutines.length > 0 ? 
                                `<div class="chip-row" style="margin:0;">` + linkedRoutines.map(r => `<span class="pill" style="border:1px solid rgba(255,255,255,0.1);">${esc(r.name)}</span>`).join('') + `</div>`
                                : `<p class="muted small" style="margin:0;">Not permanently added to any routines yet.</p>`}
                        </div>
                    </div>
                </div>
            </div>

            ${alts.length > 0 ? `
                <div style="margin-top:32px;">
                    <p class="stat-label" style="margin-bottom:12px;">Alternative Replacements</p>
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; max-height:165px; overflow-y:auto; padding-bottom: 16px; mask-image: linear-gradient(to bottom, black 65%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 65%, transparent 100%);" class="custom-scrollbar">
                        ${alts.map(a => `
                            <article class="card glass hover-lift" style="padding:14px; cursor:pointer; height:fit-content;" onclick="openExerciseDetail('${a.id}')">
                                <b style="display:block; margin-bottom:4px; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(a.name)}</b>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <p class="small muted" style="margin:0;">${esc(a.equipment)}</p>
                                    <span class="pill" style="font-size:9px; padding:2px 6px;">Used ${a.usageCount}x</span>
                                </div>
                            </article>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div style="margin-top:40px; display:flex; flex-direction:column; gap:12px;">
                <button class="btn btn-teal hover-lift" style="width:100%; padding:18px; border-radius:30px; font-size:16px; font-weight:800; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="toast('Live integration coming in Phase 4');">
                    ${Icons.playFill(22)}
                    Start Workout
                </button>
                <button class="btn hover-lift" style="width:100%; padding:18px; border-radius:30px; font-size:16px; font-weight:800; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); display:flex; justify-content:center; align-items:center; gap:8px;">
                    ${Icons.plus(22, 2.5)}
                    Add to a Routine
                </button>
            </div>
        </div>

        <style>
            .hover-lift { transition: transform 0.2s, box-shadow 0.2s; }
            .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
        </style>
    `;
}

function renderFormHTML(ex = null) {
    const isEdit = !!ex;
    const trackingTypes = ['Weight + Reps', 'Bodyweight + Reps', 'Assisted Weight + Reps', 'Time', 'Distance', 'Distance + Time', 'Weight + Time', 'Weight + Distance'];
    const patterns = ['Push (Horizontal)', 'Push (Vertical)', 'Pull (Horizontal)', 'Pull (Vertical)', 'Squat', 'Hinge', 'Lunge', 'Carry', 'Core', 'Rotation / Anti-Rotation', 'Mobility / Stretching', 'Cardio / Conditioning', 'Other'];
    
    // Handle secondary muscles prepopulation
    let selectedSec = [];
    if(ex && ex.secondaryMuscles) {
        if(Array.isArray(ex.secondaryMuscles)) selectedSec = ex.secondaryMuscles;
        else selectedSec = [ex.secondaryMuscles];
    }

    return `
        <div style="max-width: 600px; margin: 0 auto; animation:fadeUp 0.3s ease; padding-bottom: 40px;">
            <button class="btn hover-lift" onclick="setExView('library')" style="margin-bottom:20px; display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:30px; font-weight:800; padding:10px 20px;">
                ${Icons.back(18, 1.5)}
                Back
            </button>
            
            <div class="card" style="border: 1px solid rgba(0,212,255,0.2); box-shadow: 0 16px 40px rgba(0,0,0,0.3);">
                <h2 style="font-family:'Space Grotesk', sans-serif; margin-bottom:24px;">${isEdit ? 'Edit Custom Exercise' : 'Draft New Exercise'}</h2>
                
                <input type="hidden" id="exId" value="${isEdit ? ex.id : ''}">
                <input type="hidden" id="exCreatedAt" value="${isEdit ? ex.createdAt : ''}">
                
                <div class="field" style="margin-bottom:20px;">
                    <label class="stat-label">Exercise Name (Unique)*</label>
                    <input type="text" id="exName" class="input" placeholder="e.g. Deficit Reverse Lunge" value="${isEdit ? esc(ex.name) : ''}" style="font-size:16px; padding:12px;">
                </div>

                <div class="grid grid-2" style="gap:20px; margin-bottom:20px;">
                    <div class="field">
                        <label class="stat-label">Primary Muscle</label>
                        <button type="button" id="btn_exMuscle" class="input hover-lift" style="display:flex; justify-content:space-between; align-items:center; text-align:left; font-family:inherit; font-size:15px; background:rgba(255,255,255,0.02);" onclick="window.openFormDropdown(event, 'exMuscle')">
                            <span class="val-text">${ex && ex.primaryMuscle ? getExLabel('muscle', ex.primaryMuscle) : 'Select Primary...'}</span>
                            ${Icons.chevronDown(16, 2.5)}
                        </button>
                        <input type="hidden" id="exMuscle" value="${isEdit ? esc(ex.primaryMuscle) : ''}">
                    </div>
                    <div class="field">
                        <label class="stat-label">Movement Pattern</label>
                        <button type="button" id="btn_exPattern" class="input hover-lift" style="display:flex; justify-content:space-between; align-items:center; text-align:left; font-family:inherit; font-size:15px; background:rgba(255,255,255,0.02);" onclick="window.openFormDropdown(event, 'exPattern')">
                            <span class="val-text">${ex && ex.movementPattern ? esc(ex.movementPattern) : 'Select Pattern...'}</span>
                            ${Icons.chevronDown(16, 2.5)}
                        </button>
                        <input type="hidden" id="exPattern" value="${isEdit ? esc(ex.movementPattern) : ''}">
                    </div>
                </div>

                <div class="field" style="margin-bottom:20px;">
                    <label class="stat-label">Secondary / Synergist Muscles</label>
                    <button type="button" id="btn_exSecMuscle" class="input hover-lift" style="display:flex; justify-content:space-between; align-items:center; text-align:left; font-family:inherit; font-size:15px; background:rgba(255,255,255,0.02);" onclick="window.openFormDropdown(event, 'exSecMuscle')">
                        <span class="val-text">${selectedSec.length ? selectedSec.length + ' selected' : 'Select Secondary...'}</span>
                        ${Icons.chevronDown(16, 2.5)}
                    </button>
                    <input type="hidden" id="exSecMuscle" value='${JSON.stringify(selectedSec)}'>
                </div>

                <div class="grid grid-2" style="gap:20px; margin-bottom:20px;">
                    <div class="field">
                        <label class="stat-label">Equipment Base</label>
                        <button type="button" id="btn_exEquip" class="input hover-lift" style="display:flex; justify-content:space-between; align-items:center; text-align:left; font-family:inherit; font-size:15px; background:rgba(255,255,255,0.02);" onclick="window.openFormDropdown(event, 'exEquip')">
                            <span class="val-text">${ex && ex.equipment ? getExLabel('equip', ex.equipment) : 'Select Base...'}</span>
                            ${Icons.chevronDown(16, 2.5)}
                        </button>
                        <input type="hidden" id="exEquip" value="${isEdit ? esc(ex.equipment) : ''}">
                    </div>
                    <div class="field">
                        <label class="stat-label">Progress Tracking</label>
                        <button type="button" id="btn_exTrackType" class="input hover-lift" style="display:flex; justify-content:space-between; align-items:center; text-align:left; font-family:inherit; font-size:15px; background:rgba(255,255,255,0.02);" onclick="window.openFormDropdown(event, 'exTrackType')">
                            <span class="val-text">${ex && ex.trackingType ? esc(ex.trackingType) : 'Weight + Reps'}</span>
                            ${Icons.chevronDown(16, 2.5)}
                        </button>
                        <input type="hidden" id="exTrackType" value="${isEdit ? esc(ex.trackingType) : 'Weight + Reps'}">
                    </div>
                </div>

                <div class="field" style="margin-bottom:32px;">
                    <label class="stat-label">Internal Notes / Execution Cues</label>
                    <textarea id="exNotes" class="input" rows="4" placeholder="Brief coaching reminders for when you perform this exercise...">${isEdit ? esc(ex.notes || '') : ''}</textarea>
                </div>

                <div style="display:flex; gap:12px;">
                    <button class="btn btn-teal hover-lift" onclick="saveCustomExercise()" style="width: 100%; padding: 18px; border-radius: 30px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:8px;">
                        ${Icons.save(20, 2.5)}
                        Save to Library
                    </button>
                </div>
            </div>
        </div>
        <style>
            /* Contextual Dropdown re-inclusion since this view unmounts the library styles */
            .ex-dropdown-overlay {
                position: fixed; inset: 0; z-index: 9998;
            }
            .ex-dropdown-menu {
                position: fixed; z-index: 9999;
                background: linear-gradient(180deg, rgba(20,26,33,0.95) 0%, rgba(10,14,20,0.98) 100%);
                backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 16px;
                box-shadow: 0 12px 40px rgba(0,0,0,0.5), inset 0 1px rgba(255,255,255,0.05);
                min-width: 220px; max-width: 280px;
                max-height: 320px;
                display: flex; flex-direction: column;
                animation: dropPop 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                transform-origin: top left;
            }
            .ex-dropdown-list {
                overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px;
            }
            .ex-dropdown-item {
                padding: 10px 14px; border-radius: 10px; cursor: pointer;
                font-size: 14px; font-weight: 500; color: var(--text);
                display: flex; justify-content: space-between; align-items: center;
                transition: background 0.15s, color 0.15s;
            }
            .ex-dropdown-item:hover, .ex-dropdown-item.selected {
                background: rgba(255,255,255,0.08);
            }
            .ex-dropdown-item.selected { color: var(--teal); }
            @keyframes dropPop {
                from { opacity: 0; transform: scale(0.95) translateY(-10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .hover-lift { transition: transform 0.2s, box-shadow 0.2s; }
            .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
        </style>
    `;
}