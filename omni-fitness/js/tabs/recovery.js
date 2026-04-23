window.activeSessions = window.activeSessions || {};

window.startRecoverySession = (id, minutes, btnText) => {
  if (window.stopActiveBreathing) window.stopActiveBreathing();
  if (window.activeSessions[id]) return;
  const durationMs = minutes * 60 * 1000;
  let elapsed = 0;
  const actionsDiv = document.getElementById(`actions-${id}`);
  
  if (actionsDiv) {
    actionsDiv.innerHTML = `
      <div style="display:flex; gap:10px;">
        <button class="btn btn-teal" style="flex:1; position:relative; overflow:hidden;" onclick="togglePauseSession('${id}'); event.stopPropagation();">
          <div id="fill-${id}" class="progress-fill" style="position:absolute; left:0; top:0; bottom:0; background:rgba(255,255,255,0.25); width:0%;"></div>
          <span style="position:relative; z-index:1;" id="lbl-${id}">Pause</span>
        </button>
        <button class="btn btn-danger" onclick="stopRecoverySession('${id}', ${minutes}, '${btnText}'); event.stopPropagation();">Cancel</button>
      </div>
    `;
  }
  
  const intv = setInterval(() => {
    const sess = window.activeSessions[id];
    if (!sess || sess.paused) return;
    sess.elapsed += 1000;
    const pct = Math.min((sess.elapsed / sess.durationMs) * 100, 100);
    const fill = document.getElementById(`fill-${id}`);
    if (fill) fill.style.width = `${pct}%`;
    
    if (sess.elapsed >= sess.durationMs) {
      stopRecoverySession(id, minutes, btnText);
      toast('Session completed successfully');
    }
  }, 1000);
  
  window.activeSessions[id] = { intv, elapsed, durationMs, paused: false };
};

window.stopRecoverySession = (id, minutes, btnText) => {
  if (window.activeSessions[id]) {
    clearInterval(window.activeSessions[id].intv);
    delete window.activeSessions[id];
  }
  const actionsDiv = document.getElementById(`actions-${id}`);
  if (actionsDiv) {
    actionsDiv.innerHTML = `<button class="btn btn-teal btn-full" onclick="startRecoverySession('${id}', ${minutes}, '${btnText}'); event.stopPropagation();">${btnText}</button>`;
  }
};

window.togglePauseSession = (id) => {
  const sess = window.activeSessions[id];
  if (!sess) return;
  sess.paused = !sess.paused;
  const lbl = document.getElementById(`lbl-${id}`);
  if (lbl) lbl.textContent = sess.paused ? 'Resume' : 'Pause';
};

window.addRecItem = (blockType) => {
  const c = ['teal', 'green', 'orange', 'purple', 'soft'];
  state.recovery[blockType].push({
    id: blockType + Date.now(),
    title: 'New Custom Session',
    desc: 'Description regarding recovery goals.',
    plan: '',
    time: 10,
    icon: blockType === 'mobility' ? 'univMobility' : (blockType === 'therapies' ? 'univProtocol' : 'playCircle'),
    colorClass: c[Math.floor(Math.random() * c.length)]
  });
  save();
  renderRecovery();
  setTimeout(() => window.openRecEdit(blockType, state.recovery[blockType].length - 1), 50);
};
window.toggleBlockEdit = (blockType) => {
  state.recoveryEditMode = state.recoveryEditMode || {};
  state.recoveryEditMode[blockType] = !state.recoveryEditMode[blockType];
  renderRecovery();
};
window.delRecItem = (blockType, idx) => {
  state.recovery[blockType].splice(idx, 1);
  save();
  document.getElementById('recModal').style.display = 'none';
  renderRecovery();
};
window.openRecEdit = (blockType, idx) => {
  const item = state.recovery[blockType][idx];
  let modal = document.getElementById('recModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'recModal';
    modal.className = 'glass-modal';
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <div class="rec-modal-content card" style="max-width: 460px; width: 90%; margin: auto; position: relative; max-height: 90vh; overflow-y: auto;">
      <h3 style="margin-bottom:10px;">Edit: ${esc(item.title)}</h3>
      
      <div class="field" style="margin-top:16px;">
        <label class="stat-label">Session Name</label>
        <input type="text" id="recEditTitle" class="input" value="${esc(item.title)}">
      </div>
      
      <div class="field" style="margin-top:10px;">
        <label class="stat-label">Scientific Description / Notes</label>
        <textarea id="recEditDesc" class="input" rows="3">${esc(item.desc)}</textarea>
      </div>

      <div class="field" style="margin-top:10px;">
        <label class="stat-label">Plan / Sequence (Optional, One per line)</label>
        <textarea id="recEditPlan" class="input" rows="3" placeholder="Pigeon Pose - 2 min/side&#10;Couch Stretch - 90 sec/side">${esc(item.plan || '')}</textarea>
      </div>

      <div class="field" style="margin-top:10px;">
        <label class="stat-label" style="display:flex; justify-content:space-between">
          <span>Target Duration (Max 90m)</span>
          <b id="recEditTimeVal" class="teal">${item.time} MIN</b>
        </label>
        <div style="margin-top:10px; padding:0 6px;">
           <input type="range" id="recEditTime" min="1" max="90" value="${item.time}" class="slider" oninput="document.getElementById('recEditTimeVal').innerText=this.value+' MIN'">
        </div>
      </div>
      
      <div class="row" style="margin-top:28px; gap:10px;">
        ${blockType !== 'meditation' ? `<button class="btn btn-danger" onclick="delRecItem('${blockType}', ${idx})" style="flex:1;">Delete</button>` : ''}
        <button class="btn btn-teal" onclick="saveRecEdit('${blockType}', ${idx})" style="flex:2;">Save Changes</button>
      </div>
      <button class="btn btn-icon" style="position:absolute; top:12px; right:12px; padding:6px; border:none; background:transparent;" onclick="document.getElementById('recModal').style.display='none'">
        ${Icons.close(18, 2)}
      </button>
    </div>
  `;
  modal.style.display = 'flex';
};
window.saveRecEdit = (blockType, idx) => {
  const item = state.recovery[blockType][idx];
  item.title = document.getElementById('recEditTitle').value;
  item.desc = document.getElementById('recEditDesc').value;
  item.plan = document.getElementById('recEditPlan').value;
  item.time = parseInt(document.getElementById('recEditTime').value, 10);
  save();
  document.getElementById('recModal').style.display = 'none';
  renderRecovery();
};
window.moveRecItem = (blockType, idx, dir) => {
  const arr = state.recovery[blockType];
  const newIdx = idx + dir;
  if(newIdx >= 0 && newIdx < arr.length) {
    const temp = arr[idx];
    arr[idx] = arr[newIdx];
    arr[newIdx] = temp;
    save();
    renderRecovery();
  }
};

function renderRecovery() {
  if (!state.recovery) {
    state.recovery = {
      blockOrder: ['meditation', 'mobility', 'therapies'],
      meditation: [],
      mobility: [
          { id: 'mob1', title: 'Lower Body Flush', desc: 'Clears metabolic waste and restores hip symmetry post-squatting or heavy running.', plan: 'Pigeon Pose - 2 min/side\nCouch Stretch - 90 sec/side\nAsian Squat - 2 min', time: 15, icon: 'playCircle', colorClass: 'orange' },
          { id: 'mob2', title: 'Upper Body Release', desc: 'Counters modern desk posture by opening up the anterior chain and mobilizing the T-spine.', plan: 'Thoracic Extensions - 2 min\nDoorway Pec Stretch - 90 sec/side\nBanded Lat Distraction - 1 min/side', time: 12, icon: 'playCircle', colorClass: 'teal' },
          { id: 'mob3', title: 'Full Body Down-Regulation', desc: 'A comprehensive, slow-flow sequence connecting deep tissue stretches with long exhales to pull your body into a parasympathetic healing state. Ideal before bed.', plan: '', time: 30, icon: 'playCircle', colorClass: 'purple' },
          { id: 'mob4', title: 'Morning Primer', desc: 'A quick sequence of dynamic movements to oil the joints and prepare the central nervous system for the day.', plan: "Cat-Cow\\nBird-Dog\\nWorld's Greatest Stretch", time: 5, icon: 'playCircle', colorClass: 'soft' }
      ],
      therapies: [
          { id: 'phys1', title: 'Cold Plunge / Ice Bath', desc: 'Improves circulation via vasoconstriction, reduces delayed onset muscle soreness (DOMS), and spikes dopamine levels for lasting energy. Optimal: 3 mins @ 4°C.', plan: '', time: 3, icon: 'snow', colorClass: 'teal' },
          { id: 'phys2', title: 'Dry Sauna', desc: 'Activates heat-shock proteins to repair damaged cells, mimics cardiovascular exercise, and flushes toxins through deep sweating. Optimal: 20 mins @ 85°C.', plan: '', time: 20, icon: 'flame', colorClass: 'orange' },
          { id: 'phys3', title: 'Percussive Massage', desc: 'Uses rapid striking to desensitize precise nerve endings, releasing tight knots and significantly increasing local blood flow. Best used pre/post workout.', plan: '', time: 10, icon: 'activity', colorClass: 'purple' },
          { id: 'phys4', title: 'Epsom Salt Bath', desc: 'Breaks down into magnesium and sulfate in water. Absorbed through skin to replenish magnesium, deeply relaxing the central nervous system.', plan: '', time: 15, icon: 'check', colorClass: 'green' }
      ]
    };
    save();
  }

  // Ensure mindfulness icons are perfectly mapped without destroying user's order or text modifications
  const medDefaults = {
    'med1': { id: 'med1', title: 'Post-Workout Integration', desc: 'Lower cortisol and heart rate immediately post-training to transition from a sympathetic (fight/flight) to parasympathetic state to begin recovery.', plan: '', time: 10, icon: 'mindIntegration', colorClass: 'green' },
    'med2': { id: 'med2', title: 'NSDR Protocol', desc: 'A condensed nervous system reset designed by Dr. Andrew Huberman. Resets your dopamine baseline and greatly improves alertness if done mid-day.', plan: '', time: 12, icon: 'snow', colorClass: 'teal' },
    'med3': { id: 'med3', title: 'Morning Clarity', desc: 'A brief mindfulness practice to set intentions and optimize focus for the day before caffeine intake.', plan: '', time: 10, icon: 'sunrise', colorClass: 'orange' },
    'med4': { id: 'med4', title: 'Deep Sleep Nidra', desc: 'Non-Sleep Deep Rest (NSDR) focusing on body-scan techniques to drop your brain waves into the restorative delta state. Best used in bed to transition to deep sleep.', plan: '', time: 22, icon: 'moon', colorClass: 'purple' }
  };
  
  // Filter out any garbage items and map correctly
  let activeMeds = state.recovery.meditation.filter(m => medDefaults[m.id]).map(m => {
    m.icon = medDefaults[m.id].icon;
    m.colorClass = medDefaults[m.id].colorClass;
    return m;
  });

  // Restore any missing ones at the end
  ['med1', 'med2', 'med3', 'med4'].forEach(id => {
    if (!activeMeds.find(m => m.id === id)) {
      activeMeds.push({ ...medDefaults[id] });
    }
  });

  state.recovery.meditation = activeMeds;

  // Forcefully apply universal minimal icons to existing user data
  const rc = ['teal', 'green', 'orange', 'purple', 'soft'];
  let needsSave = false;
  if (state.recovery.mobility) {
      state.recovery.mobility = state.recovery.mobility.map(m => {
          m.icon = 'univMobility';
          if (!m.rndCol) { m.colorClass = rc[Math.floor(Math.random() * rc.length)]; m.rndCol = true; needsSave = true; }
          return m;
      });
  }
  
  if (state.recovery.therapies) {
      state.recovery.therapies = state.recovery.therapies.map(t => {
          t.icon = 'univProtocol';
          if (!t.rndCol) { t.colorClass = rc[Math.floor(Math.random() * rc.length)]; t.rndCol = true; needsSave = true; }
          return t;
      });
  }
  if (needsSave) save();

  view().innerHTML = `
    <section class="page">
      ${header("Central Nervous System", "Recovery Hub")}

      <div class="nav-tabs" id="recoveryTabs">
        <button class="nav-tab active" data-tab="protocols">Mind & Body</button>
        <button class="nav-tab" data-tab="metrics">Data & Insights</button>
      </div>

      <div id="recoveryPanel"></div>
    </section>
  `;

  const drawPanel = (tab) => {
    document.querySelectorAll('#recoveryTabs .nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    const panel = document.getElementById('recoveryPanel');

    if (tab === 'protocols') {
      let panelBlock = `
        <div class="bento-grid" style="grid-template-columns: 1fr;">
          
          <!-- 1. BREATHWORK ENGINE -->
          <div class="card bento-12 breathing-card" style="background:radial-gradient(circle at center top, rgba(0,212,255,0.05), transparent 60%), var(--panel)">
            <div class="breathing-header" style="flex-wrap:wrap; gap:12px; position:relative; z-index:40;">
              <p class="stat-label flex-1" style="min-width:200px; display:flex; align-items:center; gap:10px;">
                <span class="icon-box" style="width:36px; height:36px; border-radius:8px; box-shadow:none; flex-shrink:0;">${icons.wind}</span>
                <span style="font-size:22px; font-weight:800; text-transform:none; letter-spacing:-0.03em; color:var(--text); font-family: 'Space Grotesk', Inter, sans-serif;">Breathwork Engine</span>
              </p>
              
              <div class="custom-select" id="breathSelect" style="display:none;" onclick="this.classList.toggle('open')">
                <div class="select-trigger">
                  <span id="breathModeText">Box Breathing</span>
                  ${Icons.chevronDown(12)}
                </div>
                <div class="select-options"></div>
              </div>
            </div>
            
            <div style="margin-bottom:28px; padding:12px 16px; background:rgba(0,212,255,0.03); border-left:3px solid var(--teal); border-radius:6px; position:relative; z-index:30;">
              <p id="breathDescText" class="small muted" style="line-height:1.5;">Used by Navy SEALs to rapidly regulate the autonomic nervous system. Perfect for high-stress situations.</p>
            </div>
            
            <div class="breathing-widget-layout">
              <!-- Left side: Breathing ring -->
              <div class="breath-ring-layer" id="breathTool">
                 <div class="breath-ring-bg" id="breathRingBg"></div>
                 
                 <div class="breath-ring-inner">
                    <!-- Inner text layout -->
                    <div class="breath-center-info">
                        <b id="phaseText" class="teal" style="font-size:16px; letter-spacing:0.15em; text-transform:uppercase; display:block; margin-bottom:2px; transition: color 0.3s;">INHALE</b>
                        <div id="phaseTime" class="breath-time-val">4.0S</div>
                        <div style="width:40px; height:1px; background:rgba(255,255,255,0.2); margin:4px auto 6px auto;"></div>
                        <div id="phaseMethod" style="font-size:11px; color:var(--soft); text-transform:uppercase; letter-spacing:0.1em; font-weight:600;">NOSE</div>
                    </div>
                 </div>

                 <!-- Orbit Wrapper -->
                 <div class="orbiter-wrapper" id="orbiterRingWrapper">
                    <div class="orbiter-dot"></div>
                 </div>
                 
                 <div class="play-hint-overlay" id="breathPlayHint">TAP TO START</div>
              </div>

              <!-- Right side: Stats -->
              <div class="breath-stats-col">
                 <div class="stat-box">
                    <div class="stat-label" style="font-size:11px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px; color:var(--soft);">Completed<br>Cycle</div>
                    <div id="b-cycles" style="font-size:36px; font-weight:800; font-family:'Space Grotesk', sans-serif; color:var(--text); line-height:1;">0</div>
                 </div>
                 <hr style="width:60px; border:none; border-top:1px solid rgba(255,255,255,0.08); margin:0;">
                 <div class="stat-box">
                    <div class="stat-label" style="font-size:11px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px; color:var(--soft);">Session Time</div>
                    <div id="b-elapsed" style="font-size:36px; font-weight:800; font-family:'Space Grotesk', sans-serif; color:var(--text); line-height:1;">0:00</div>
                 </div>
              </div>
            </div>

            <div style="margin-top:10px; text-align:center;">
               <div class="breathing-pills" id="breathModePills">
                 <button class="b-pill active" data-val="box">Box Breath</button>
                 <button class="b-pill" data-val="sleep">Sleep</button>
                 <button class="b-pill" data-val="coherence">Coherence</button>
                 <button class="b-pill" data-val="focus">Focus</button>
                 <button class="b-pill" data-val="vigor">Vigor</button>
                 <button class="b-pill" data-val="charge">Charge</button>
               </div>
            </div>
          </div>

          <!-- 2. SLEEP LOG -->
          <div class="card bento-12" style="background: radial-gradient(circle at right top, rgba(139, 92, 246, 0.05), transparent 60%); margin-top: 18px; padding: 18px 24px;">
            <div class="row" style="flex-wrap: wrap; gap: 16px;">
              <div>
                <p class="stat-label">Rest & Regeneration</p>
                <h2 style="font-size: 20px;">Sleep Log</h2>
              </div>
              
              <div class="row" style="gap: 20px; flex-wrap: wrap;">
                <div>
                  <p class="stat-label" style="margin-bottom: 8px;">Time Slept</p>
                  <div class="row" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 12px; padding: 4px; justify-content:center;">
                    <input type="number" class="input" style="width: 48px; height: 36px; min-height: 36px; text-align: right; border: none; background: transparent; font-size: 18px; font-weight: 800; padding: 0;" value="07" min="0" max="23">
                    <span style="font-size: 18px; font-weight: 800; margin: 0 4px; color: var(--muted)">:</span>
                    <input type="number" class="input" style="width: 48px; height: 36px; min-height: 36px; text-align: left; border: none; background: transparent; font-size: 18px; font-weight: 800; padding: 0;" value="30" min="0" max="59" step="1">
                    <span class="muted font-mono" style="font-size: 13px; font-weight: 700; margin: 0 10px 0 2px;">HRS</span>
                  </div>
                </div>

                <div style="border-left: 1px solid rgba(255,255,255,0.1); padding-left: 20px; display: flex; flex-direction: column; justify-content: center;">
                  <div class="row" style="justify-content: flex-start; gap: 8px;">
                     <span class="badge green" style="background: rgba(57, 255, 20, 0.1); border-color: rgba(57, 255, 20, 0.3); font-size: 11px; padding: 4px 10px;">GOOD</span>
                     <span class="tiny muted">Target: <b style="color:var(--purple)">08 : 00 HRS</b></span>
                  </div>
                  <p class="tiny muted" style="margin-top: 6px;">Based on CNS fatigue</p>
                </div>
              </div>
            </div>
          </div>

          `;

      const blockRenderer = (blockType) => {
        let title, subtitle, actBtnLabel;
        if (blockType === 'meditation') {
          title = "Mindfulness Hub"; subtitle = "Guided Meditation"; actBtnLabel = "Play Audio";
        } else if (blockType === 'mobility') {
          title = "Active Recovery Library"; subtitle = "Mobility & Stretching"; actBtnLabel = "Start Flow";
        } else if (blockType === 'therapies') {
          title = "Protocols & Treatments"; subtitle = "Physical Therapies"; actBtnLabel = "Start Protocol";
        }
        
        state.recoveryEditMode = state.recoveryEditMode || {};
        const isEditing = !!state.recoveryEditMode[blockType];

        const itemsList = state.recovery[blockType] || [];
        
        const itemsHtml = itemsList.map((it, i) => {
          let planHtml = '';
          if (it.plan && it.plan.trim() !== '') {
            planHtml = `
              <div class="small muted" style="margin-bottom:12px; line-height:1.6; padding-left:2px;">
                <b style="color:var(--${it.colorClass})">Sequence / Movements:</b>
                <ul style="margin:4px 0; padding-left:16px;">
                  ${it.plan.split('\\n').filter(x=>x.trim()).map(x=>`<li>${esc(x.trim())}</li>`).join('')}
                </ul>
              </div>
            `;
          }

          return `
          <div class="expanding-item" onclick="if(!${isEditing}) { toggleAccordion(this, '${it.id}'); }">
            <div class="row" style="gap:14px; position:relative;">
              <div class="icon-box session-icon" style="background:var(--${it.colorClass}-10, rgba(255,255,255,0.1));color:var(--${it.colorClass});border-color:var(--${it.colorClass}-20, rgba(255,255,255,0.2))">${icons[it.icon] || icons.playCircle}</div>
              <div style="flex:1">
                <b style="font-size:14px;display:block;">${esc(it.title)}</b>
                <p class="tiny muted">${it.time} MIN</p>
              </div>
              ${isEditing ? `
                <div class="row layout-actions" style="gap:4px;">
                  <button class="btn btn-icon" style="padding:5px;" onclick="moveRecItem('${blockType}', ${i}, -1); event.stopPropagation();">↑</button>
                  <button class="btn btn-icon" style="padding:5px;" onclick="moveRecItem('${blockType}', ${i}, 1); event.stopPropagation();">↓</button>
                </div>
              ` : ``}
            </div>
            <div class="expand-body" ${isEditing ? 'style="display:none;"' : ''}>
              <hr style="border:0;border-top:1px solid rgba(255,255,255,0.05);margin:12px 0">
              <div class="small muted" style="margin-bottom:12px; line-height:1.5">${esc(it.desc)}</div>
              ${planHtml}
              <div class="row" style="gap:10px;">
                <div id="actions-${it.id}" style="flex:1;">
                  <button class="btn btn-teal btn-full" onclick="startRecoverySession('${it.id}', ${it.time}, '${actBtnLabel}'); event.stopPropagation();">${actBtnLabel}</button>
                </div>
                <button class="btn btn-icon" style="flex:none; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; padding:0; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);" onclick="openRecEdit('${blockType}', ${i}); event.stopPropagation();" title="Edit Options">
                  ${Icons.sliders(20, 2, 'color:var(--muted)')}
                </button>
              </div>
            </div>
          </div>
          `;
        }).join('');

        return `
          <div class="card bento-12" style="position:relative;">
            <div class="section-head" style="margin-top:0; display:flex; justify-content:space-between; align-items:flex-start; gap:14px; position:relative;">
              <div style="flex:1; padding-right:32px;">
                <p class="stat-label">${subtitle}</p>
                <h2 style="font-size:22px">${title}</h2>
              </div>
              <button style="position:absolute; top:0; right:0; width:32px; height:32px; padding:0; border-radius:8px; display:flex; align-items:center; justify-content:center; border:none; cursor:pointer; background:${isEditing ? 'rgba(0,212,255,0.1)' : 'transparent'}; color:${isEditing ? 'var(--teal)' : 'var(--soft)'}" onclick="toggleBlockEdit('${blockType}')" title="${isEditing ? 'Save Changes' : 'Arrange Protocols'}">
                ${isEditing 
                  ? `<div style="width:16px;height:16px;display:flex;align-items:center;justify-content:center;fill:currentColor">${icons.check}</div>`
                  : Icons.edit(20, 2)
                }
              </button>
            </div>
            <div class="grid grid-2">
              ${itemsHtml}
              ${isEditing && blockType !== 'meditation' ? `
                <div style="grid-column: 1 / -1; margin-top:8px;">
                  <button class="btn btn-full" style="border-style:dashed; color:var(--soft); background:transparent;" onclick="addRecItem('${blockType}')">+ Add New Protocol Sequence</button>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      };
      
      panel.innerHTML = panelBlock + state.recovery.blockOrder.map(b => blockRenderer(b)).join('') + `</div>`;
      setupBreathing();
    }
    else if (tab === 'metrics') {
      panel.innerHTML = `
        <div class="bento-grid">
          
          <!-- RECOVERY CONTINUITY -->
          <div class="card bento-12 expanding-item" onclick="toggleAccordion(this, 'streak-dropdown')" style="cursor: pointer; display:block; padding-bottom: 22px;">
            <div class="row" style="align-items:flex-start;">
              <div>
                <p class="stat-label" style="display:flex; align-items:center; gap: 6px;"><span style="font-size: 14px;">🔥</span> 5-Day Active Recovery Chain</p>
                <h2 style="font-size: 22px; margin-top:6px;">Recovery Continuity</h2>
              </div>
              <div class="icon-box" style="transform: scale(0.85); background:transparent; border:none; box-shadow:none; color: var(--muted); pointer-events: none;">${Icons.chevronDown(24)}</div>
            </div>
            
            <div class="streak-strip" style="display:flex; justify-content:space-between; margin-top: 24px; padding: 0 4px;">
               ${['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day, i) => {
                 let color = i === 3 ? 'var(--danger)' : 'var(--green)';
                 let shadow = i === 3 ? 'rgba(255,77,95,0.4)' : 'rgba(57,255,20,0.4)';
                 return `<div style="text-align:center;"><p class="tiny muted" style="font-weight:700;">${day}</p><div style="margin: 10px auto 0; width: 14px; height: 14px; border-radius: 50%; background: ${color}; box-shadow: 0 0 10px ${shadow}; border: 1px solid rgba(255,255,255,0.1);"></div></div>`;
               }).join('')}
            </div>

            <div class="expand-body" style="margin-top:24px;">
              <hr style="border:0;border-top:1px solid rgba(255,255,255,0.05);margin:0 0 20px 0;">
              <div class="history-list stack" style="gap:20px; text-align:left;">
                <div>
                  <div class="row" style="margin-bottom:10px;">
                    <b style="font-size: 15px; color: var(--text);">21 Apr 2026</b>
                    <span class="badge" style="background: rgba(0,212,255,0.08); color: var(--teal); border-color: rgba(0,212,255,0.2);">25 MIN TOTAL</span>
                  </div>
                  <p class="tiny muted" style="text-transform:uppercase; letter-spacing:0.1em; color:var(--soft); font-weight:700; margin-bottom:4px;">Mindfulness</p>
                  <p class="small muted" style="margin-left: 12px; margin-bottom: 2px;">• NSDR &ndash; 10 min</p>
                  <p class="small muted" style="margin-left: 12px;">• Box Breath &ndash; 5 min</p>
                  
                  <p class="tiny muted" style="text-transform:uppercase; letter-spacing:0.1em; color:var(--soft); font-weight:700; margin-top:10px; margin-bottom:4px;">Mobility</p>
                  <p class="small muted" style="margin-left: 12px;">• Upper Body Release &ndash; 10 min</p>
                </div>

                <hr style="border:0;border-top:1px dotted rgba(255,255,255,0.1);">

                <div>
                  <div class="row" style="margin-bottom:10px;">
                    <b style="font-size: 15px; color: var(--text);">20 Apr 2026</b>
                    <span class="badge" style="background: rgba(0,212,255,0.08); color: var(--teal); border-color: rgba(0,212,255,0.2);">15 MIN TOTAL</span>
                  </div>
                  <p class="tiny muted" style="text-transform:uppercase; letter-spacing:0.1em; color:var(--soft); font-weight:700; margin-bottom:4px;">Mobility</p>
                  <p class="small muted" style="margin-left: 12px;">• Lower Body Flush &ndash; 15 min</p>
                </div>

                <hr style="border:0;border-top:1px dashed rgba(255,77,95,0.3);">

                <div>
                  <div class="row">
                    <b style="font-size: 15px; color: var(--muted);">19 Apr 2026</b>
                  </div>
                  <p class="small" style="margin-top: 6px; color: var(--danger); font-weight:600;">No recovery logged</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- RECOVERY SUMMARY -->
          <div class="card bento-12" style="display:flex; flex-direction:column;">
            <p class="stat-label" style="margin-bottom: 24px;">Recovery Summary (Last 7 Days)</p>
            <div class="stack" style="gap: 18px; flex:1; justify-content:center;">
              <div class="row">
                <span class="muted small" style="font-weight:600;">Total Recovery Time</span>
                <b style="font-size: 16px; color: var(--text); font-family: 'Space Grotesk', sans-serif;">84 min</b>
              </div>
              <hr style="border:0;border-top:1px dashed rgba(255,255,255,0.05); margin:0;">
              <div class="row">
                <span class="muted small" style="font-weight:600;">Sessions Completed</span>
                <b style="font-size: 16px; color: var(--text); font-family: 'Space Grotesk', sans-serif;">12</b>
              </div>
              <hr style="border:0;border-top:1px dashed rgba(255,255,255,0.05); margin:0;">
              <div class="row">
                <span class="muted small" style="font-weight:600;">Recovery Streak</span>
                <b style="font-size: 16px; color: var(--green); font-family: 'Space Grotesk', sans-serif;">5 days</b>
              </div>
              <hr style="border:0;border-top:1px dashed rgba(255,255,255,0.05); margin:0;">
              <div class="row">
                <span class="muted small" style="font-weight:600;">Avg Daily Recovery</span>
                <b style="font-size: 16px; color: var(--teal); font-family: 'Space Grotesk', sans-serif;">26 min</b>
              </div>
            </div>
          </div>

        </div>
      `;
    }
  };

  let breathTimer;
  let elapsedTimer;
  let running = false;
  let timeInMs = 0;
  
  const setupBreathing = () => {
    const tool = document.getElementById('breathTool');
    if(!tool) return;
    const ringBg = document.getElementById('breathRingBg');
    const phaseText = document.getElementById('phaseText');
    const phaseTime = document.getElementById('phaseTime');
    const phaseMethod = document.getElementById('phaseMethod');
    const orbiterWrapper = document.getElementById('orbiterRingWrapper');
    const elapsedEl = document.getElementById('b-elapsed');
    const cyclesEl = document.getElementById('b-cycles');
    
    const profiles = {
      box: { p: [4, 4, 4, 4], names: ['INHALE', 'HOLD', 'EXHALE', 'HOLD'], methods: ['NOSE', '-', 'MOUTH', '-'], colors: ['#00D4FF', '#2a2a35', '#8B5CF6', '#2a2a35'], desc: "Used by Navy SEALs to rapidly regulate the autonomic nervous system. Perfect for high-stress situations." },
      sleep: { p: [4, 7, 8, 0], names: ['INHALE', 'HOLD', 'EXHALE', ''], methods: ['NOSE', '-', 'MOUTH', ''], colors: ['#00D4FF', '#2a2a35', '#8B5CF6', 'transparent'], desc: "Based on the 4-7-8 technique by Dr. Andrew Weil. Acts as a natural tranquilizer for the nervous system to promote deep sleep." },
      coherence: { p: [5.5, 0, 5.5, 0], names: ['INHALE', '', 'EXHALE', ''], methods: ['NOSE', '', 'NOSE', ''], colors: ['#00D4FF', 'transparent', '#8B5CF6', 'transparent'], desc: "Synchronizes the heart, brain, and nervous system to a resonant frequency. Promotes emotional balance and physiological resilience." },
      focus: { p: [6, 2, 6, 0], names: ['INHALE', 'HOLD', 'EXHALE', ''], methods: ['NOSE', '-', 'MOUTH', ''], colors: ['#00D4FF', '#2a2a35', '#8B5CF6', 'transparent'], desc: "A structured pattern to direct attention and clear mental fog. Floods the brain with oxygen while maintaining nervous system control." },
      vigor: { p: [4, 2, 6, 0], names: ['INHALE', 'HOLD', 'EXHALE', ''], methods: ['NOSE', '-', 'MOUTH', ''], colors: ['#00D4FF', '#2a2a35', '#8B5CF6', 'transparent'], desc: "Designed to stimulate energy reserves and increase alertness. The longer exhalation helps maintain composure while energizing." },
      charge: { p: [1, 0, 1, 0], names: ['INHALE', '', 'EXHALE', ''], methods: ['NOSE', '', 'NOSE', ''], colors: ['#00D4FF', 'transparent', '#8B5CF6', 'transparent'], desc: "Rapid, powerful breathing patterned after traditional practices to hyper-oxygenate the body. Use for a quick, intense burst of energy." }
    };

    let currentProfile = profiles['box'];
    let running = false;
    let rafId = null;
    let cycleStartTime = 0;
    let cycles = 0;
    
    const descText = document.getElementById('breathDescText');
    const breathPills = document.querySelectorAll('.b-pill');
    
    const updateShape = () => {
      let total = currentProfile.p.reduce((a,b) => a+b, 0);
      let grad = [];
      let acc = 0;
      currentProfile.p.forEach((val, i) => {
         if(val > 0) {
           let startPct = (acc / total) * 100;
           let endPct = ((acc + val) / total) * 100;
           grad.push(`${currentProfile.colors[i]} ${startPct}% ${endPct}%`);
           acc += val;
         }
      });
      ringBg.style.background = `conic-gradient(${grad.join(', ')})`;
    };
    updateShape();

    breathPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        breathPills.forEach(p => p.classList.remove('active'));
        e.target.classList.add('active');
        const val = e.target.dataset.val;
        currentProfile = profiles[val];
        if (descText) descText.textContent = currentProfile.desc;
        updateShape();
        if(running) stop();
        else {
           phaseText.textContent = currentProfile.names[0];
           phaseTime.textContent = currentProfile.p[0].toFixed(1) + 'S';
           phaseMethod.textContent = currentProfile.methods[0];
           phaseText.style.color = '#00D4FF';
        }
      });
    });

    const renderLoop = (timestamp) => {
       if(!running) return;
       if(!cycleStartTime) cycleStartTime = timestamp;
       
       let totalSec = currentProfile.p.reduce((a,b)=>a+b, 0);
       let cycleElapsedSec = (timestamp - cycleStartTime) / 1000;
       
       if (cycleElapsedSec >= totalSec) {
          cycleStartTime = timestamp;
          cycleElapsedSec = 0;
          cycles++;
          cyclesEl.textContent = cycles;
       }

       let acc = 0;
       let pIdx = 0;
       let phaseElapsed = 0;
       for(let i=0; i<currentProfile.p.length; i++) {
          if(currentProfile.p[i] === 0) continue;
          if(cycleElapsedSec >= acc && cycleElapsedSec < acc + currentProfile.p[i]) {
             pIdx = i;
             phaseElapsed = cycleElapsedSec - acc;
             break;
          }
          acc += currentProfile.p[i];
       }

       let remainSec = currentProfile.p[pIdx] - phaseElapsed;
       phaseTime.textContent = Math.max(0, remainSec).toFixed(1) + 'S';
       
       if(phaseText.textContent !== currentProfile.names[pIdx]) {
          phaseText.textContent = currentProfile.names[pIdx];
          phaseMethod.textContent = currentProfile.methods[pIdx];
          // Update colors dynamically based on segment color
          if(currentProfile.names[pIdx] === 'INHALE') phaseText.style.color = '#00D4FF';
          else if (currentProfile.names[pIdx] === 'EXHALE') phaseText.style.color = '#8B5CF6';
          else phaseText.style.color = '#fff';
       }

       let turnPct = cycleElapsedSec / totalSec;
       orbiterWrapper.style.transform = `rotate(${turnPct * 360}deg)`;

       rafId = requestAnimationFrame(renderLoop);
    };

    const stop = () => {
      running = false;
      tool.classList.remove('running');
      clearInterval(elapsedTimer);
      cancelAnimationFrame(rafId);
      
      orbiterWrapper.style.transform = `rotate(0deg)`;
      phaseText.textContent = 'INHALE';
      phaseText.style.color = '#00D4FF';
      phaseTime.textContent = currentProfile.p[0].toFixed(1) + 'S';
      phaseMethod.textContent = currentProfile.methods[0];
      
      cycles = 0;
      cyclesEl.textContent = '0';
      elapsedEl.textContent = '0:00';
      cycleStartTime = 0;
    };

    window.stopActiveBreathing = () => {
      if (running) stop();
    };

    tool.onclick = () => {
      if (running) {
        stop();
      } else {
        running = true;
        tool.classList.add('running');
        tool.classList.remove('wrapped');
        
        cycleStartTime = performance.now();
        cycles = 0;
        cyclesEl.textContent = '0';
        
        let sec = 0;
        elapsedTimer = setInterval(() => {
          sec++;
          elapsedEl.textContent = `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
        }, 1000);
        
        rafId = requestAnimationFrame(renderLoop);
      }
    };
    
    // Default startup state
    stop();
    cleanup = stop;
  };

  document.getElementById('recoveryTabs').addEventListener('click', (e) => {
    if(e.target.classList.contains('nav-tab')) drawPanel(e.target.dataset.tab);
  });

  drawPanel('protocols');
}
