/* ────────────────────────────────────────────────────────────
   WORKOUTS · PROGRESS SUB-TAB  — Final Master Edition
   Phase 0: Cleanup  | Phase 1: Pro UX  | Phase 2: Intelligence
   Phase 3: Workload | Phase 4: Sessions Polish
   ──────────────────────────────────────────────────────────── */
(function () {

  /* ── MODULE STATE ──────────────────────────────────────── */
  const pgSt = {
    seg: 'overview',
    range: '30d',
    selExId: null,
    selSessId: null,
    sessView: 'list',
    exSearch: '',
    sessSearch: '',
    exFavOnly: false,
    sessions: [],
    allSets: [],
    library: [],
    prs: [],
    routines: [],
    _container: null,
    _undoTimer: null,
  };

  /* ── FAVORITES (localStorage) ───────────────────────────── */
  function getFavs() {
    try { return new Set(JSON.parse(localStorage.getItem('omniPgFavs') || '[]')); }
    catch { return new Set(); }
  }
  function saveFavs(s) { localStorage.setItem('omniPgFavs', JSON.stringify([...s])); }
  function toggleFav(id) {
    const f = getFavs();
    if (f.has(id)) f.delete(id); else f.add(id);
    saveFavs(f);
  }
  function isFav(id) { return getFavs().has(id); }

  /* ── HELPERS ────────────────────────────────────────────── */
  const H = () => window.wkTodayHelpers;
  const normTT = t => H() ? H().normalizeTT(t) : 'weight_reps';
  const e1RM  = (w, r) => H() ? H().epley1RM(w, r) : Number(w) * (1 + Number(r) / 30);

  function fmtDur(s) {
    s = Math.round(s || 0);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}h${m > 0 ? ' ' + m + 'm' : ''}`;
    if (m > 0) return `${m}m${sec > 0 ? ' ' + sec + 's' : ''}`;
    return `${sec}s`;
  }
  function fmtDate(iso, short) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', short
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtWt(v) { return (v != null && v !== '') ? `${v} kg` : '—'; }
  function fmtN(v, dec = 1) { const n = Number(v); return (isNaN(n) || n === 0) ? '—' : n.toFixed(dec); }
  function fmtVol(v) {
    if (!v) return '0 kg';
    return v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v)} kg`;
  }
  function fmtDelta(cur, prev, isVol) {
    if (prev === 0 || prev == null) return null;
    const diff = cur - prev;
    const pct  = Math.round((diff / prev) * 100);
    const sign = diff >= 0 ? '+' : '';
    const cls  = diff > 0 ? 'pos' : diff < 0 ? 'neg' : 'neu';
    const label = isVol ? `${sign}${fmtVol(Math.abs(diff))}` : `${sign}${diff}`;
    return { cls, label, pct: `${sign}${pct}%` };
  }

  /* ── DATE RANGE HELPERS ─────────────────────────────────── */
  function getRangeStart(range) {
    const now = new Date();
    if (range === '7d')  return new Date(now - 7  * 86400000);
    if (range === '30d') return new Date(now - 30 * 86400000);
    if (range === '90d') return new Date(now - 90 * 86400000);
    if (range === 'ytd') return new Date(now.getFullYear(), 0, 1);
    return new Date(0);
  }
  function getFiltered() {
    const cut = getRangeStart(pgSt.range);
    return pgSt.sessions.filter(s => s.status === 'completed' && new Date(s.startedAt) >= cut);
  }
  function getPrevFiltered() {
    if (pgSt.range === 'all') return [];
    const curStart  = getRangeStart(pgSt.range);
    const rangeMs   = Date.now() - curStart.getTime();
    const prevEnd   = new Date(curStart.getTime() - 1);
    const prevStart = new Date(curStart.getTime() - rangeMs);
    return pgSt.sessions.filter(s =>
      s.status === 'completed' &&
      new Date(s.startedAt) >= prevStart &&
      new Date(s.startedAt) <= prevEnd
    );
  }
  function getExById(id) {
    return pgSt.library.find(e => e.id === id) || null;
  }

  /* ── DATA LOADING ───────────────────────────────────────── */
  async function loadData() {
    const [sessions, allSets, lib, custom, prs, routines] = await Promise.all([
      apexDB.getAll('workoutSessions'),
      apexDB.getAll('workoutSets'),
      apexDB.getAll('exerciseLibrary'),
      apexDB.getAll('customExercises'),
      apexDB.getAll('personalRecords'),
      apexDB.getAll('routines').catch(() => []),
    ]);
    pgSt.sessions = sessions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    pgSt.allSets  = allSets;
    pgSt.library  = [...lib, ...custom.map(e => ({ ...e, isCustom: true }))];
    pgSt.prs      = prs;
    pgSt.routines = routines;
  }

  /* ── ENTRY POINT ────────────────────────────────────────── */
  window.renderTabProgress = async function (container) {
    pgSt._container = container;
    container.innerHTML = `<div class="pg-wrap"><p class="muted" style="text-align:center;padding:60px 0;font-size:14px;">Loading Progress…</p></div>`;
    await loadData();
    renderPg();
  };

  /* ── GLOBAL HANDLERS ────────────────────────────────────── */
  window.pgSetSeg = function (seg) {
    pgSt.seg = seg;
    renderPg();
  };
  window.pgSetRange = function (range) {
    pgSt.range = range;
    renderPg();
  };
  window.pgSelectEx = function (id) {
    pgSt.selExId = id;
    const pane = document.getElementById('pgDetailPane');
    if (pane) pane.innerHTML = renderExDetail();
    document.querySelectorAll('.pg-list-item[data-ex-id]').forEach(el => {
      el.classList.toggle('active', el.dataset.exId === id);
    });
  };
  window.pgSelectSess = function (id) {
    pgSt.selSessId = id;
    const pane = document.getElementById('pgDetailPane');
    if (pane) {
      pane.innerHTML = `<div id="pgSessDetailWrap"><p class="muted" style="padding:30px;text-align:center;">Loading…</p></div>`;
      renderSessDetailAsync(id);
    }
    document.querySelectorAll('.pg-sess-item').forEach(el => {
      el.classList.toggle('active', el.dataset.sessId === id);
    });
  };
  window.pgSetSessView = function (v) {
    pgSt.sessView = v;
    const filtered = getFiltered();
    const el = document.getElementById('pgContent');
    if (el) { el.innerHTML = renderSessions(filtered); bindAfterRender(); }
  };
  window.pgToggleFav = function (id, e) {
    e && e.stopPropagation();
    toggleFav(id);
    // Refresh just the icon
    document.querySelectorAll(`.pg-pin-btn[data-fav-id="${id}"]`).forEach(btn => {
      btn.classList.toggle('pinned', isFav(id));
      btn.title = isFav(id) ? 'Unpin' : 'Pin';
    });
    if (pgSt.exFavOnly) { updateExList(); }
  };
  window.pgToggleFavOnly = function () {
    pgSt.exFavOnly = !pgSt.exFavOnly;
    const chip = document.getElementById('pgFavChip');
    if (chip) chip.classList.toggle('active', pgSt.exFavOnly);
    updateExList();
  };
  // Deep-link helpers
  window.pgSt_openLastSess = function () {
    const f = getFiltered();
    if (f[0]) { pgSt.selSessId = f[0].id; pgSetSeg('sessions'); }
  };
  window.pgSt_openExFromOverview = function (id) {
    pgSt.selExId = id; pgSetSeg('exercises');
  };
  window.pgSt_openExAndHighlightPR = function (id) {
    pgSt.selExId = id; pgSetSeg('exercises');
  };
  window.pgSt_openSessFromEx = function (sessId) {
    pgSt.selSessId = sessId; pgSetSeg('sessions');
  };

  /* ── MAIN RENDER ────────────────────────────────────────── */
  function renderPg() {
    const c = pgSt._container;
    if (!c) return;
    const ranges = [['7d','7D'],['30d','30D'],['90d','90D'],['ytd','YTD'],['all','All']];
    const segs   = [['overview','⚡ Overview'],['exercises','📈 Exercises'],['records','🏆 Records'],['sessions','📋 Sessions']];

    c.innerHTML = `
      <div class="pg-wrap" id="pgWrap">
        <div class="pg-ctrl-row">
          <div class="pg-seg-bar">
            ${segs.map(([v,l]) => `<button class="pg-seg-btn${pgSt.seg===v?' active':''}" onclick="pgSetSeg('${v}')">${l}</button>`).join('')}
          </div>
          <div class="pg-range-row">
            ${ranges.map(([v,l]) => `<button class="pg-range-pill${pgSt.range===v?' active':''}" onclick="pgSetRange('${v}')">${l}</button>`).join('')}
          </div>
        </div>
        <div id="pgContent"></div>
      </div>`;
    renderContent();
    ensureTooltipDiv();
  }

  function renderContent() {
    const el = document.getElementById('pgContent');
    if (!el) return;
    const filtered = getFiltered();
    if      (pgSt.seg === 'overview')   el.innerHTML = renderOverview(filtered);
    else if (pgSt.seg === 'exercises')  el.innerHTML = renderExercises(filtered);
    else if (pgSt.seg === 'records')    el.innerHTML = renderRecords(filtered);
    else if (pgSt.seg === 'sessions')   el.innerHTML = renderSessions(filtered);
    bindAfterRender();
  }

  function bindAfterRender() {
    const exIn = document.getElementById('pgExSearch');
    if (exIn) { exIn.value = pgSt.exSearch; exIn.oninput = e => { pgSt.exSearch = e.target.value; updateExList(); }; }
    const sIn = document.getElementById('pgSessSearch');
    if (sIn) { sIn.value = pgSt.sessSearch; sIn.oninput = e => { pgSt.sessSearch = e.target.value; updateSessList(); }; }
    if (pgSt.seg === 'sessions' && pgSt.selSessId) renderSessDetailAsync(pgSt.selSessId);
    if (pgSt.seg === 'exercises' && pgSt.selExId) {
      setTimeout(() => {
        document.querySelectorAll('.pg-list-item[data-ex-id]').forEach(el => {
          el.classList.toggle('active', el.dataset.exId === pgSt.selExId);
        });
      }, 0);
    }
  }

  function ensureTooltipDiv() {
    if (!document.getElementById('pgChartTip')) {
      const t = document.createElement('div');
      t.id = 'pgChartTip';
      t.className = 'pg-chart-tip';
      document.body.appendChild(t);
    }
  }

  /* ── SVG Tooltip ─────────────────────────────────────────── */
  window.pgShowTip = function (e, text) {
    const t = document.getElementById('pgChartTip');
    if (!t) return;
    t.innerHTML = text;
    t.style.display = 'block';
    t.style.left = (e.clientX + 14) + 'px';
    t.style.top  = (e.clientY - 38) + 'px';
  };
  window.pgHideTip = function () {
    const t = document.getElementById('pgChartTip');
    if (t) t.style.display = 'none';
  };

  /* ══════════════════════════════════════════════════════════
     OVERVIEW
     ══════════════════════════════════════════════════════════ */
  function renderOverview(filtered) {
    const prev       = getPrevFiltered();
    const totalSets  = filtered.reduce((s, x) => s + (x.totals?.totalSets || 0), 0);
    const totalVol   = filtered.reduce((s, x) => s + (x.totals?.totalVolume || 0), 0);
    const totalDur   = filtered.reduce((s, x) => s + (x.totals?.durationSec || 0), 0);
    const prevSets   = prev.reduce((s, x) => s + (x.totals?.totalSets || 0), 0);
    const prevVol    = prev.reduce((s, x) => s + (x.totals?.totalVolume || 0), 0);
    const prevSess   = prev.length;
    const last       = filtered[0] || null;
    const cut        = getRangeStart(pgSt.range);
    const newPRs     = pgSt.prs.filter(p => p.lastUpdated && new Date(p.lastUpdated) >= cut);
    const wBuckets   = weekBuckets(filtered, 12);
    const vBuckets   = weekVolBuckets(filtered, 12);

    const dSess   = fmtDelta(filtered.length, prevSess);
    const dSets   = fmtDelta(totalSets, prevSets);
    const dVol    = fmtDelta(totalVol, prevVol, true);

    function deltaHtml(d) {
      if (!d) return '';
      return `<div class="pg-delta ${d.cls}">${d.cls==='pos'?'▲':d.cls==='neg'?'▼':''}${d.label} <span style="opacity:.6;">(${d.pct})</span></div>`;
    }

    // Workload averages (per week)
    const weekCount = Math.max(1, wBuckets.length);
    const avgSessWk  = (wBuckets.reduce((a,b)=>a+b.v,0)/weekCount).toFixed(1);
    const sBuckets   = weekSetBuckets(filtered, pgSt.allSets, 12);
    const avgSetsWk  = (sBuckets.reduce((a,b)=>a+b.v,0)/weekCount).toFixed(0);
    const avgVolWk   = fmtVol(vBuckets.reduce((a,b)=>a+b.v,0)/weekCount);
    const tBuckets   = weekTimeBuckets(filtered, 12);
    const avgTimeWk  = fmtDur(tBuckets.reduce((a,b)=>a+b.v,0)/weekCount);

    // Set type distribution
    const sessIds = new Set(filtered.map(s=>s.id));
    const periodSets = pgSt.allSets.filter(s=>sessIds.has(s.sessionId));
    const typeCounts = { working:0, warmup:0, drop:0, failure:0, other:0 };
    for (const s of periodSets) {
      const t = s.type || 'working';
      if (typeCounts[t] !== undefined) typeCounts[t]++; else typeCounts.other++;
    }
    const totalSetCount = periodSets.length || 1;

    // Routine insights
    const routineNames = {};
    for (const s of filtered) {
      const n = s.name || 'Unnamed';
      routineNames[n] = (routineNames[n] || 0) + 1;
    }
    const topRoutine = Object.entries(routineNames).sort((a,b)=>b[1]-a[1])[0];
    const routineVolMap = {};
    for (const s of filtered) {
      const n = s.name || 'Unnamed';
      routineVolMap[n] = (routineVolMap[n] || 0) + (s.totals?.totalVolume || 0);
    }
    const highVolRoutine = Object.entries(routineVolMap).sort((a,b)=>b[1]-a[1])[0];

    return `
      <div style="animation:fadeUp .28s ease; display:flex; flex-direction:column; gap:16px;">

        <!-- Stat Cards with deltas -->
        <div class="pg-stat-grid">
          <div class="pg-stat-card" style="--pg-accent:var(--teal)">
            <p class="pg-stat-lbl">Sessions</p>
            <p class="pg-stat-val">${filtered.length}</p>
            <p class="pg-stat-sub">${pgSt.range==='all'?'all time':'in range'}</p>
            ${deltaHtml(dSess)}
          </div>
          <div class="pg-stat-card" style="--pg-accent:var(--orange)">
            <p class="pg-stat-lbl">Total Sets</p>
            <p class="pg-stat-val">${totalSets}</p>
            <p class="pg-stat-sub">working sets</p>
            ${deltaHtml(dSets)}
          </div>
          <div class="pg-stat-card" style="--pg-accent:var(--green)">
            <p class="pg-stat-lbl">Tonnage</p>
            <p class="pg-stat-val">${fmtVol(totalVol)}</p>
            <p class="pg-stat-sub">weight × reps</p>
            ${deltaHtml(dVol)}
          </div>
          <div class="pg-stat-card" style="--pg-accent:var(--purple)">
            <p class="pg-stat-lbl">Training Time</p>
            <p class="pg-stat-val">${totalDur > 0 ? fmtDur(totalDur) : '—'}</p>
            <p class="pg-stat-sub">total active</p>
          </div>
          <div class="pg-stat-card" style="--pg-accent:var(--green)">
            <p class="pg-stat-lbl">New PRs</p>
            <p class="pg-stat-val">${newPRs.length}</p>
            <p class="pg-stat-sub">${newPRs.length > 0 ? 'records broken' : 'keep lifting'}</p>
          </div>
          <div class="pg-stat-card" style="--pg-accent:var(--teal)">
            <p class="pg-stat-lbl">Last Session</p>
            <p class="pg-stat-val" style="font-size:18px;">${last ? fmtDate(last.startedAt, true) : '—'}</p>
            <p class="pg-stat-sub">${last ? `${(last.exercises||[]).length || '?'} exercise${((last.exercises||[]).length||0)!==1?'s':''}` : 'No sessions yet'}</p>
          </div>
        </div>

        <!-- Workload Panel -->
        <div class="pg-chart-card">
          <div class="pg-chart-head">
            <span class="pg-chart-title">⚡ Weekly Workload Averages</span>
            <span style="font-size:11px;color:var(--muted);">Per week in range</span>
          </div>
          <div class="pg-workload-grid">
            <div class="pg-workload-item">
              <div class="pg-workload-val">${avgSessWk}</div>
              <div class="pg-workload-lbl">Sessions / Wk</div>
            </div>
            <div class="pg-workload-item">
              <div class="pg-workload-val">${avgSetsWk}</div>
              <div class="pg-workload-lbl">Sets / Wk</div>
            </div>
            <div class="pg-workload-item">
              <div class="pg-workload-val">${avgVolWk}</div>
              <div class="pg-workload-lbl">Tonnage / Wk</div>
            </div>
            <div class="pg-workload-item">
              <div class="pg-workload-val">${avgTimeWk}</div>
              <div class="pg-workload-lbl">Time / Wk</div>
            </div>
          </div>
        </div>

        <!-- Set Type Distribution + Routine Insights -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">
          ${periodSets.length > 0 ? `
          <div class="pg-chart-card">
            <div class="pg-chart-head">
              <span class="pg-chart-title">Set Type Breakdown</span>
              <span style="font-size:11px;color:var(--muted);">${periodSets.length} sets</span>
            </div>
            <div style="height:8px;border-radius:6px;overflow:hidden;display:flex;gap:0;">
              ${typeCounts.working  ? `<div style="flex:${typeCounts.working};background:var(--teal);opacity:.8;" title="Working"></div>` : ''}
              ${typeCounts.warmup   ? `<div style="flex:${typeCounts.warmup};background:var(--orange);opacity:.75;" title="Warmup"></div>` : ''}
              ${typeCounts.drop     ? `<div style="flex:${typeCounts.drop};background:var(--purple);opacity:.75;" title="Drop"></div>` : ''}
              ${typeCounts.failure  ? `<div style="flex:${typeCounts.failure};background:var(--danger);opacity:.75;" title="Failure"></div>` : ''}
              ${typeCounts.other    ? `<div style="flex:${typeCounts.other};background:rgba(255,255,255,.2);" title="Other"></div>` : ''}
            </div>
            <div class="pg-dist-legend">
              ${typeCounts.working  ? `<div class="pg-dist-legend-item"><div class="pg-dist-legend-dot" style="background:var(--teal)"></div>${Math.round(typeCounts.working/totalSetCount*100)}% Working</div>` : ''}
              ${typeCounts.warmup   ? `<div class="pg-dist-legend-item"><div class="pg-dist-legend-dot" style="background:var(--orange)"></div>${Math.round(typeCounts.warmup/totalSetCount*100)}% Warmup</div>` : ''}
              ${typeCounts.drop     ? `<div class="pg-dist-legend-item"><div class="pg-dist-legend-dot" style="background:var(--purple)"></div>${Math.round(typeCounts.drop/totalSetCount*100)}% Drop</div>` : ''}
              ${typeCounts.failure  ? `<div class="pg-dist-legend-item"><div class="pg-dist-legend-dot" style="background:var(--danger)"></div>${Math.round(typeCounts.failure/totalSetCount*100)}% Failure</div>` : ''}
            </div>
          </div>` : ''}

          ${topRoutine ? `
          <div class="pg-chart-card">
            <div class="pg-chart-head">
              <span class="pg-chart-title">Training Insights</span>
            </div>
            <div class="pg-routine-grid">
              <div class="pg-routine-item">
                <div class="pg-routine-item-lbl">Most Frequent</div>
                <div class="pg-routine-item-val">${esc(topRoutine[0])}</div>
                <div class="pg-routine-item-sub">${topRoutine[1]} session${topRoutine[1]!==1?'s':''}</div>
              </div>
              ${highVolRoutine ? `
              <div class="pg-routine-item">
                <div class="pg-routine-item-lbl">Highest Volume</div>
                <div class="pg-routine-item-val">${esc(highVolRoutine[0])}</div>
                <div class="pg-routine-item-sub">${fmtVol(highVolRoutine[1])} total</div>
              </div>` : ''}
            </div>
          </div>` : ''}
        </div>

        <!-- Consistency Heatmap -->
        <div class="pg-chart-card">
          <div class="pg-chart-head">
            <span class="pg-chart-title">Consistency Heatmap</span>
            <span style="font-size:11px;color:var(--muted);">Last 16 weeks</span>
          </div>
          ${drawHeatmap(pgSt.sessions.filter(s => s.status === 'completed'))}
        </div>

        <!-- Weekly Sparklines -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">
          <div class="pg-chart-card">
            <div class="pg-chart-head">
              <span class="pg-chart-title">Sessions / Week</span>
              <span class="pg-chart-peak">${wBuckets.length ? Math.max(...wBuckets.map(b=>b.v)) : 0} peak</span>
            </div>
            ${wBuckets.length >= 2 ? barSparkline(wBuckets, 'var(--teal)') : '<div class="pg-chart-empty">Not enough data yet</div>'}
          </div>
          <div class="pg-chart-card">
            <div class="pg-chart-head">
              <span class="pg-chart-title">Volume / Week</span>
              <span class="pg-chart-peak">${vBuckets.some(b=>b.v>0) ? fmtVol(Math.max(...vBuckets.map(b=>b.v))) : '—'}</span>
            </div>
            ${vBuckets.some(b=>b.v>0) && vBuckets.length >= 2 ? barSparkline(vBuckets, 'var(--green)') : '<div class="pg-chart-empty">No volume data yet</div>'}
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="pg-chart-card">
          <p class="pg-chart-title" style="margin-bottom:14px;">Quick Actions</p>
          <div class="pg-action-row">
            ${last ? `<button class="pg-btn teal" onclick="pgSt_openLastSess()">▶ Open Last Session</button>` : ''}
            <button class="pg-btn ghost" onclick="pgSetSeg('exercises')">📈 Exercise Progress</button>
            <button class="pg-btn ghost" onclick="pgSetSeg('records')">🏆 View All PRs</button>
          </div>
        </div>

        <!-- Recent PRs enriched -->
        ${newPRs.length > 0 ? `
          <div class="pg-chart-card">
            <div class="pg-chart-head">
              <span class="pg-chart-title">🏆 Recent PRs</span>
              <button class="pg-btn ghost sm" onclick="pgSetSeg('records')">See All</button>
            </div>
            <div class="pg-pr-grid">
              ${newPRs.slice(0,6).map(pr => {
                const ex = getExById(pr.id);
                if (!ex) return '';
                const tt = normTT(ex.trackingType || '');
                const ctx = buildPrContext(pr.id, tt);
                return `
                  <div class="pg-pr-card" onclick="pgSt_openExAndHighlightPR('${ex.id}')">
                    <div class="pg-pr-icon">🏋️</div>
                    <div class="pg-pr-body">
                      <div class="pg-pr-name">${esc(ex.name)}</div>
                      <div class="pg-pr-val">${pr.bestE1RM ? fmtN(pr.bestE1RM)+' kg e1RM' : pr.bestWeight ? fmtWt(pr.bestWeight) : '—'}</div>
                      ${ctx.line ? `<div class="pg-pr-context">${ctx.line}</div>` : ''}
                      <div class="pg-pr-date">${fmtDate(pr.lastUpdated,true)}</div>
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>` : ''}

        ${filtered.length === 0 ? `
          <div class="pg-empty">
            <div class="pg-empty-icon">🏋️</div>
            <div class="pg-empty-title">No sessions in this range</div>
            <div class="pg-empty-sub">Complete workouts to see progress data here.</div>
          </div>` : ''}
      </div>`;
  }

  /* ── PR Context Builder ─────────────────────────────────── */
  function buildPrContext(exId, tt) {
    const sets = pgSt.allSets.filter(s => s.exerciseId === exId);
    if (!sets.length) return { line: '', delta: '' };
    let prSet = null, line = '', delta = '';

    if (tt === 'weight_reps') {
      prSet = sets.reduce((best, s) => {
        return e1RM(Number(s.weight)||0, Number(s.reps)||0) >
               e1RM(Number(best.weight)||0, Number(best.reps)||0) ? s : best;
      }, sets[0]);
      if (prSet && prSet.weight && prSet.reps) {
        line = `${prSet.reps} reps @ ${prSet.weight} kg`;
        // Find 2nd best for delta
        const sorted = [...sets]
          .filter(s => s !== prSet && (Number(s.weight)||0) > 0)
          .sort((a,b) => e1RM(Number(b.weight)||0,Number(b.reps)||0) - e1RM(Number(a.weight)||0,Number(a.reps)||0));
        if (sorted[0]) {
          const diff = (Number(prSet.weight)||0) - (Number(sorted[0].weight)||0);
          if (diff > 0) delta = `+${diff} kg vs prev best`;
        }
      }
    } else if (tt === 'bodyweight_reps' || tt === 'assisted_weight_reps') {
      prSet = sets.reduce((best, s) => (Number(s.reps)||0) > (Number(best.reps)||0) ? s : best, sets[0]);
      if (prSet?.reps) {
        line = `${prSet.reps} reps best set`;
        const sorted = [...sets].filter(s=>s!==prSet).sort((a,b)=>(Number(b.reps)||0)-(Number(a.reps)||0));
        if (sorted[0] && (Number(sorted[0].reps)||0) > 0) delta = `+${(Number(prSet.reps)||0)-(Number(sorted[0].reps)||0)} reps vs prev`;
      }
    } else if (tt === 'time') {
      prSet = sets.filter(s=>s.durationSec>0).reduce((best, s) => (s.durationSec||0) > (best.durationSec||0) ? s : best, sets[0]);
      if (prSet?.durationSec) line = `${fmtDur(prSet.durationSec)} best`;
    } else if (tt === 'distance_time') {
      const withDist = sets.filter(s=>Number(s.distance)>0);
      if (withDist.length) {
        prSet = withDist.reduce((best, s) => (Number(s.distance)||0) > (Number(best.distance)||0) ? s : best, withDist[0]);
        line = `${prSet.distance} ${prSet.distanceUnit||'km'}`;
      }
    }
    return { line, delta };
  }

  /* ══════════════════════════════════════════════════════════
     EXERCISES
     ══════════════════════════════════════════════════════════ */
  function buildExList(filtered) {
    const sessIds    = new Set(filtered.map(s => s.id));
    const sets       = pgSt.allSets.filter(s => sessIds.has(s.sessionId));
    const sessDateMap = {};
    for (const s of pgSt.sessions) sessDateMap[s.id] = s.startedAt;

    const map = new Map();
    for (const s of sets) {
      const key = s.exerciseId || s.exerciseName || 'unknown';
      if (!map.has(key)) map.set(key, { sets: [], name: s.exerciseName || key, exerciseId: s.exerciseId, trackingType: s.trackingType });
      map.get(key).sets.push(s);
    }

    const list = [];
    for (const [key, data] of map.entries()) {
      const ex  = getExById(key) || { id: key, name: data.name, trackingType: data.trackingType || 'Weight + Reps' };
      const tt  = normTT(ex.trackingType || data.trackingType || '');
      const sessCount = new Set(data.sets.map(s => s.sessionId)).size;
      const lastDate  = data.sets.map(s => s.completedAt || sessDateMap[s.sessionId] || '').filter(Boolean).sort().at(-1);

      let stat = '';
      if (tt === 'weight_reps') {
        const best = Math.max(...data.sets.map(s => e1RM(Number(s.weight)||0, Number(s.reps)||0)));
        if (best > 0) stat = fmtN(best) + ' kg e1RM';
      } else if (tt === 'bodyweight_reps' || tt === 'assisted_weight_reps') {
        const best = Math.max(...data.sets.map(s => Number(s.reps)||0));
        if (best > 0) stat = `${best} reps`;
      } else if (tt === 'time') {
        const vals = data.sets.filter(s => s.durationSec > 0).map(s => s.durationSec);
        if (vals.length) stat = fmtDur(Math.max(...vals));
      } else if (tt === 'distance_time') {
        const d = data.sets.reduce((a, s) => a + (Number(s.distance)||0), 0);
        if (d > 0) stat = fmtN(d, 2) + ' km';
      }

      const hist  = computeSessHistory(ex.id || key, sets, sessIds, tt, sessDateMap);
      const spark  = hist.slice(-8).map(d => d.primary || 0);
      const trend  = computeTrend(hist.map(d => d.primary));
      const fav    = isFav(ex.id || key);

      list.push({ ex, sets: data.sets, lastDate, stat, spark, sessCount, trend, fav });
    }
    list.sort((a, b) => {
      if (a.fav !== b.fav) return a.fav ? -1 : 1;
      return (b.lastDate || '').localeCompare(a.lastDate || '') || b.sessCount - a.sessCount;
    });
    return list;
  }

  function renderExercises(filtered) {
    const all = buildExList(filtered);
    const q   = pgSt.exSearch.toLowerCase();
    let vis   = q ? all.filter(e => e.ex.name.toLowerCase().includes(q)) : all;
    if (pgSt.exFavOnly) vis = vis.filter(e => e.fav);

    const leftHtml = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        <div class="pg-search-wrap" style="flex:1;min-width:140px;margin-bottom:0;">
          ${Icons.search(14, 1.5, 'position:absolute;left:11px;top:50%;transform:translateY(-50%);opacity:.45;pointer-events:none;')}
          <input id="pgExSearch" class="pg-search-input" placeholder="Search exercises…">
        </div>
        <button id="pgFavChip" class="pg-fav-chip${pgSt.exFavOnly?' active':''}" onclick="pgToggleFavOnly()">⭐ Pinned</button>
      </div>
      <div id="pgExList">
        ${vis.length ? vis.map(item => exListItem(item)).join('') : emptyList(pgSt.exFavOnly ? 'No pinned exercises' : 'No exercises found')}
      </div>`;

    const rightHtml = pgSt.selExId ? renderExDetail() : `
      <div class="pg-empty">
        <div class="pg-empty-icon">👈</div>
        <div class="pg-empty-title">Select an exercise</div>
        <div class="pg-empty-sub">Pick an exercise from the list to see detailed progress charts.</div>
      </div>`;

    return `
      <div style="animation:fadeUp .28s ease;">
        ${all.length === 0 ? `
          <div class="pg-empty" style="padding:60px 20px;">
            <div class="pg-empty-icon">📊</div>
            <div class="pg-empty-title">No exercise data yet</div>
            <div class="pg-empty-sub">Complete workouts to see per-exercise progress here.</div>
          </div>` : `
          <div class="pg-split">
            <div class="pg-list-pane">${leftHtml}</div>
            <div class="pg-detail-pane" id="pgDetailPane">${rightHtml}</div>
          </div>`}
      </div>`;
  }

  function exListItem(item) {
    const active = pgSt.selExId === item.ex.id;
    const trendTag = item.trend ? `<span class="pg-trend-tag ${item.trend}">${item.trend==='up'?'▲ Up':item.trend==='down'?'▼ Down':'– Stable'}</span>` : '';
    return `
      <div class="pg-list-item${active?' active':''}" data-ex-id="${item.ex.id}" onclick="pgSelectEx('${item.ex.id}')">
        <div class="pg-li-icon">💪</div>
        <div class="pg-li-body">
          <div class="pg-li-name">${esc(item.ex.name)}</div>
          <div class="pg-li-sub">${item.sessCount} session${item.sessCount!==1?'s':''} · ${item.lastDate ? fmtDate(item.lastDate,true) : '—'}</div>
          ${item.spark.length >= 3 ? `<div class="pg-li-spark">${sparkline(item.spark, 64, 16, '#00d4ff')}</div>` : ''}
        </div>
        <div class="pg-li-right">
          <div class="pg-li-stat">${item.stat}</div>
          ${trendTag}
          <button class="pg-pin-btn${item.fav?' pinned':''}" data-fav-id="${item.ex.id}"
            onclick="pgToggleFav('${item.ex.id}',event)" title="${item.fav?'Unpin':'Pin'}">⭐</button>
        </div>
      </div>`;
  }

  function updateExList() {
    const el = document.getElementById('pgExList');
    if (!el) return;
    const all = buildExList(getFiltered());
    const q   = pgSt.exSearch.toLowerCase();
    let vis   = q ? all.filter(e => e.ex.name.toLowerCase().includes(q)) : all;
    if (pgSt.exFavOnly) vis = vis.filter(e => e.fav);
    el.innerHTML = vis.length ? vis.map(exListItem).join('') : emptyList(pgSt.exFavOnly ? 'No pinned exercises' : 'No exercises match');
  }

  /* ── Trend Computation ──────────────────────────────────── */
  function computeTrend(vals) {
    const recent = vals.filter(v => v > 0).slice(-6);
    if (recent.length < 3) return null;
    const n = recent.length;
    const xMean = (n - 1) / 2;
    const yMean = recent.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (recent[i] - yMean);
      den += (i - xMean) ** 2;
    }
    const slope = den ? num / den : 0;
    const rel   = yMean ? slope / yMean : 0;
    if (rel >  0.025) return 'up';
    if (rel < -0.025) return 'down';
    return 'stable';
  }

  /* ── Exercise Session History Computation ─────────────── */
  function computeSessHistory(exerciseId, filteredSets, sessIds, tt, sessDateMap) {
    const exSets = filteredSets.filter(s => s.exerciseId === exerciseId);
    const bySess = new Map();
    for (const s of exSets) {
      if (!bySess.has(s.sessionId)) bySess.set(s.sessionId, []);
      bySess.get(s.sessionId).push(s);
    }
    const result = [];
    for (const [sessId, sets] of bySess.entries()) {
      const date = sessDateMap[sessId];
      if (!date) continue;
      let primary = 0, secondary = 0, volume = 0;
      if (tt === 'weight_reps') {
        primary   = Math.max(...sets.map(s => e1RM(Number(s.weight)||0, Number(s.reps)||0)));
        secondary = Math.max(...sets.map(s => Number(s.weight)||0));
        volume    = sets.reduce((a, s) => a + (Number(s.weight)||0) * (Number(s.reps)||0), 0);
      } else if (tt === 'bodyweight_reps' || tt === 'assisted_weight_reps') {
        primary   = Math.max(...sets.map(s => Number(s.reps)||0));
        secondary = sets.reduce((a, s) => a + (Number(s.reps)||0), 0);
        volume    = secondary;
      } else if (tt === 'time') {
        const vals = sets.filter(s => s.durationSec > 0).map(s => s.durationSec);
        primary   = vals.length ? Math.max(...vals) : 0;
        secondary = vals.reduce((a, b) => a + b, 0);
      } else if (tt === 'distance_time') {
        primary   = sets.reduce((a, s) => a + (Number(s.distance)||0), 0);
        secondary = sets.reduce((a, s) => a + (Number(s.durationSec)||0), 0);
        volume    = primary;
      }
      result.push({ date, sessId, primary, secondary, volume, sets });
    }
    return result.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /* ── Exercise Detail (right panel) ────────────────────── */
  function renderExDetail() {
    const id = pgSt.selExId;
    const ex = getExById(id);
    if (!ex) return `<div class="pg-empty"><div class="pg-empty-title">Exercise not found</div></div>`;

    const tt          = normTT(ex.trackingType || '');
    const filtered    = getFiltered();
    const sessIds     = new Set(filtered.map(s => s.id));
    const filtSets    = pgSt.allSets.filter(s => sessIds.has(s.sessionId));
    const sessDateMap = {};
    for (const s of pgSt.sessions) sessDateMap[s.id] = s.startedAt;
    const hist        = computeSessHistory(id, filtSets, sessIds, tt, sessDateMap);
    const pr          = pgSt.prs.find(p => p.id === id);
    const ctx         = buildPrContext(id, tt);
    const trend       = computeTrend(hist.map(d => d.primary));
    const fav         = isFav(id);

    // Plateau detection: no improvement in last 6+ sessions
    let plateauTag = '';
    if (hist.length >= 6) {
      const recent = hist.slice(-6).map(d => d.primary).filter(v => v > 0);
      const plateauTrend = computeTrend(recent);
      if (plateauTrend === 'down' || plateauTrend === 'stable') {
        plateauTag = `<span class="pg-plateau-tag">⚠ No improvement in last ${recent.length} sessions</span>`;
      }
    }

    // Charts
    let charts = '';
    if (hist.length < 2) {
      charts = `<div class="pg-chart-card"><div class="pg-chart-empty" style="padding:30px;">Log at least 2 sessions with this exercise to see charts.</div></div>`;
    } else if (tt === 'weight_reps') {
      const e1d  = hist.map(d => ({ x: d.date, y: d.primary   })).filter(d => d.y > 0);
      const wtd  = hist.map(d => ({ x: d.date, y: d.secondary })).filter(d => d.y > 0);
      const vold = hist.map(d => ({ x: d.date, y: d.volume    })).filter(d => d.y > 0);
      charts = `
        ${e1d.length>=2  ? chartCard('Estimated 1RM (Epley)',  fmtN(Math.max(...e1d.map(d=>d.y)))+' kg', lineChart(e1d,'#00d4ff','kg e1RM')) : ''}
        ${wtd.length>=2  ? chartCard('Top Set Weight',         fmtN(Math.max(...wtd.map(d=>d.y)),0)+' kg', lineChart(wtd,'#ff7a00','kg')) : ''}
        ${vold.length>=2 ? chartCard('Volume / Session',       fmtVol(Math.max(...vold.map(d=>d.y))),   barChart(vold,'#8b5cf6','kg')) : ''}`;
    } else if (tt === 'bodyweight_reps' || tt === 'assisted_weight_reps') {
      const rpd  = hist.map(d => ({ x: d.date, y: d.primary  })).filter(d => d.y > 0);
      const totd = hist.map(d => ({ x: d.date, y: d.volume   })).filter(d => d.y > 0);
      charts = `
        ${rpd.length>=2  ? chartCard('Best Reps / Session',   Math.max(...rpd.map(d=>d.y))+' reps', lineChart(rpd,'#00d4ff','reps')) : ''}
        ${totd.length>=2 ? chartCard('Total Reps / Session',  Math.max(...totd.map(d=>d.y))+' reps', barChart(totd,'#39ff14','reps')) : ''}`;
    } else if (tt === 'time') {
      const td  = hist.map(d => ({ x: d.date, y: d.primary  })).filter(d => d.y > 0);
      const tot = hist.map(d => ({ x: d.date, y: d.secondary})).filter(d => d.y > 0);
      charts = `
        ${td.length>=2  ? chartCard('Best Time / Session',  fmtDur(Math.max(...td.map(d=>d.y))),  lineChart(td,'#00d4ff','sec')) : ''}
        ${tot.length>=2 ? chartCard('Total Time / Session', fmtDur(Math.max(...tot.map(d=>d.y))), barChart(tot,'#8b5cf6','sec')) : ''}`;
    } else if (tt === 'distance_time') {
      const dd = hist.map(d => ({ x: d.date, y: d.primary })).filter(d => d.y > 0);
      charts = dd.length>=2 ? chartCard('Distance / Session', fmtN(Math.max(...dd.map(d=>d.y)),2)+' km', lineChart(dd,'#00d4ff','km')) : '';
    }

    // Best Sets table
    const allExSets = pgSt.allSets.filter(s => s.exerciseId === id);
    let bestSets = [];
    if (tt === 'weight_reps') {
      bestSets = [...allExSets].filter(s => Number(s.weight)>0||Number(s.reps)>0)
        .sort((a, b) => e1RM(b.weight,b.reps) - e1RM(a.weight,a.reps)).slice(0, 8);
    } else {
      bestSets = [...allExSets].sort((a, b) => new Date(b.completedAt||0) - new Date(a.completedAt||0)).slice(0, 8);
    }

    let bestHead = '', bestRows = '';
    if (bestSets.length) {
      if (tt === 'weight_reps') {
        bestHead = `<tr><th>Date</th><th>Weight</th><th>Reps</th><th>e1RM</th></tr>`;
        bestRows = bestSets.map((s, i) => `
          <tr>
            <td>${fmtDate(sessDateMap[s.sessionId]||s.completedAt, true)}</td>
            <td class="${i===0?'hi':''}">${fmtWt(s.weight)}</td>
            <td>${s.reps||'—'}</td>
            <td class="${i===0?'hi':''}">${fmtN(e1RM(s.weight,s.reps))} kg</td>
          </tr>`).join('');
      } else if (tt === 'bodyweight_reps' || tt === 'assisted_weight_reps') {
        bestHead = `<tr><th>Date</th>${tt==='assisted_weight_reps'?'<th>Assist</th>':''}<th>Reps</th></tr>`;
        bestRows = bestSets.map((s, i) => `
          <tr>
            <td>${fmtDate(sessDateMap[s.sessionId]||s.completedAt, true)}</td>
            ${tt==='assisted_weight_reps'?`<td>${s.addedWeight?'-'+s.addedWeight+' kg':'—'}</td>`:''}
            <td class="${i===0?'hi':''}">${s.reps||'—'}</td>
          </tr>`).join('');
      } else if (tt === 'time') {
        bestHead = `<tr><th>Date</th><th>Duration</th></tr>`;
        bestRows = bestSets.map((s, i) => `
          <tr>
            <td>${fmtDate(sessDateMap[s.sessionId]||s.completedAt, true)}</td>
            <td class="${i===0?'hi':''}">${fmtDur(s.durationSec)}</td>
          </tr>`).join('');
      } else if (tt === 'distance_time') {
        bestHead = `<tr><th>Date</th><th>Distance</th><th>Time</th></tr>`;
        bestRows = bestSets.map((s, i) => `
          <tr>
            <td>${fmtDate(sessDateMap[s.sessionId]||s.completedAt, true)}</td>
            <td class="${i===0?'hi':''}">${s.distance ? s.distance+' '+(s.distanceUnit||'km') : '—'}</td>
            <td>${fmtDur(s.durationSec)}</td>
          </tr>`).join('');
      }
    }

    const sessWithEx = filtered.filter(sess => hist.some(h => h.sessId === sess.id));

    return `
      <div style="animation:fadeUp .22s ease;display:flex;flex-direction:column;gap:14px;">

        <!-- Header -->
        <div class="pg-sess-detail-header">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <div>
              <h2 class="pg-detail-title">${esc(ex.name)}</h2>
              <p class="pg-detail-meta">${(ex.primaryMuscle||'').replace(/_/g,' ')}${ex.primaryMuscle&&ex.trackingType?' · ':''}${ex.trackingType||'Weight + Reps'}</p>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              ${trend ? `<span class="pg-trend-tag ${trend}">${trend==='up'?'▲ Trending Up':trend==='down'?'▼ Declining':'– Stable'}</span>` : ''}
              <button class="pg-pin-btn${fav?' pinned':''}" data-fav-id="${id}" onclick="pgToggleFav('${id}',event)" title="${fav?'Unpin':'Pin'}">⭐</button>
              <div style="font-size:12px;color:var(--muted);">${sessWithEx.length} session${sessWithEx.length!==1?'s':''}</div>
            </div>
          </div>
          ${pr ? `
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
              ${pr.bestWeight ? `<span class="pg-pr-badge">🏋️ ${fmtWt(pr.bestWeight)} max</span>` : ''}
              ${pr.bestE1RM  ? `<span class="pg-pr-badge">💯 ${fmtN(pr.bestE1RM)} kg e1RM</span>` : ''}
              ${pr.bestReps  ? `<span class="pg-pr-badge">🔁 ${pr.bestReps} reps best</span>` : ''}
              ${ctx.line     ? `<span class="pg-pr-badge" style="background:rgba(0,212,255,.07);color:var(--teal);border-color:rgba(0,212,255,.2);">📍 ${ctx.line}</span>` : ''}
              ${ctx.delta    ? `<span class="pg-pr-badge" style="background:rgba(57,255,20,.07);color:var(--green);border-color:rgba(57,255,20,.2);">📈 ${ctx.delta}</span>` : ''}
            </div>` : ''}
          ${plateauTag ? `<div style="margin-top:10px;">${plateauTag}</div>` : ''}
        </div>

        ${charts}

        ${bestSets.length ? `
          <div class="pg-chart-card">
            <div class="pg-chart-head"><span class="pg-chart-title">Best Sets — All Time</span></div>
            <table class="pg-best-table">
              <thead>${bestHead}</thead>
              <tbody>${bestRows}</tbody>
            </table>
          </div>` : ''}

        ${sessWithEx.length ? `
          <div class="pg-chart-card">
            <div class="pg-chart-head"><span class="pg-chart-title">Sessions With This Exercise</span></div>
            <div style="display:flex;flex-direction:column;gap:5px;">
              ${sessWithEx.slice(0,8).map(sess => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,.02);border:1px solid var(--line);cursor:pointer;transition:.15s;"
                     onmouseover="this.style.background='rgba(255,255,255,.045)'"
                     onmouseout="this.style.background='rgba(255,255,255,.02)'"
                     onclick="pgSt_openSessFromEx('${sess.id}')">
                  <span style="font-size:13px;font-weight:600;">${fmtDate(sess.startedAt,true)}</span>
                  <span style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px;">${sess.totals?.totalSets||'?'} sets ${Icons.chevronRight(12)}</span>
                </div>`).join('')}
            </div>
          </div>` : ''}
      </div>`;
  }

  /* ══════════════════════════════════════════════════════════
     RECORDS (PRs)
     ══════════════════════════════════════════════════════════ */
  function renderRecords(filtered) {
    const cut = getRangeStart(pgSt.range);
    const weightPRs = [], bwPRs = [], timePRs = [], distPRs = [], otherPRs = [];
    for (const pr of pgSt.prs) {
      const ex = getExById(pr.id);
      if (!ex) continue;
      const tt    = normTT(ex.trackingType || '');
      const entry = { pr, ex, tt };
      if (tt === 'weight_reps')                              weightPRs.push(entry);
      else if (tt === 'bodyweight_reps' || tt === 'assisted_weight_reps') bwPRs.push(entry);
      else if (tt === 'time')                                timePRs.push(entry);
      else if (tt === 'distance_time')                       distPRs.push(entry);
      else                                                   otherPRs.push(entry);
    }

    // Sort by most recent
    const sortByDate = arr => arr.sort((a,b) => new Date(b.pr.lastUpdated||0) - new Date(a.pr.lastUpdated||0));
    [weightPRs, bwPRs, timePRs, distPRs, otherPRs].forEach(sortByDate);

    function prCard({ pr, ex, tt }) {
      const ctx = buildPrContext(pr.id, tt);
      let val = '—';
      if (tt === 'weight_reps')      val = pr.bestE1RM ? `${fmtN(pr.bestE1RM)} kg e1RM` : pr.bestWeight ? fmtWt(pr.bestWeight) : '—';
      else if (tt === 'bodyweight_reps' || tt === 'assisted_weight_reps') val = pr.bestReps ? `${pr.bestReps} reps best` : '—';
      else if (tt === 'time')         val = pr.bestTime ? fmtDur(pr.bestTime) : '—';
      else if (tt === 'distance_time') val = pr.bestDistance ? `${pr.bestDistance} km` : '—';
      else                             val = pr.bestWeight ? fmtWt(pr.bestWeight) : '—';

      const isNew = pr.lastUpdated && new Date(pr.lastUpdated) >= cut;

      return `
        <div class="pg-pr-card" onclick="pgSt_openExAndHighlightPR('${ex.id}')">
          <div class="pg-pr-icon">🏆</div>
          <div class="pg-pr-body">
            <div class="pg-pr-name">${esc(ex.name)}${isNew?` <span style="font-size:9px;padding:1px 5px;border-radius:4px;background:rgba(57,255,20,.15);color:var(--green);font-weight:900;">NEW</span>`:''}${ex.isCustom?` <span style="font-size:9px;color:var(--teal);">custom</span>`:''}
            </div>
            <div class="pg-pr-val">${val}</div>
            ${ctx.line  ? `<div class="pg-pr-context">${ctx.line}</div>` : ''}
            ${ctx.delta ? `<div class="pg-pr-delta pos">📈 ${ctx.delta}</div>` : ''}
            <div class="pg-pr-date">Updated ${fmtDate(pr.lastUpdated,true)}</div>
          </div>
        </div>`;
    }

    function prSection(title, icon, list) {
      if (!list.length) return '';
      return `
        <div class="pg-pr-section">
          <p class="pg-pr-section-title">${icon} ${title}</p>
          <div class="pg-pr-grid">${list.map(prCard).join('')}</div>
        </div>`;
    }

    const allEmpty = !weightPRs.length && !bwPRs.length && !timePRs.length && !distPRs.length && !otherPRs.length;
    return `
      <div style="animation:fadeUp .28s ease;">
        <div class="pg-section-head" style="margin-bottom:22px;">
          <div>
            <h2 class="pg-section-title">Personal Records</h2>
            <p class="pg-section-sub">${pgSt.prs.length} PR${pgSt.prs.length!==1?'s':''} tracked · auto-updated when you log sets</p>
          </div>
        </div>
        ${allEmpty ? `
          <div class="pg-empty">
            <div class="pg-empty-icon">🏆</div>
            <div class="pg-empty-title">No PRs yet</div>
            <div class="pg-empty-sub">Personal records are automatically tracked when you log sets. Start lifting!</div>
          </div>` : ''}
        ${prSection('Weight + Reps', '🏋️', weightPRs)}
        ${prSection('Bodyweight / Assisted', '🤸', bwPRs)}
        ${prSection('Timed Exercises', '⏱️', timePRs)}
        ${prSection('Distance / Cardio', '🏃', distPRs)}
        ${prSection('Other', '⭐', otherPRs)}
      </div>`;
  }

  /* ══════════════════════════════════════════════════════════
     SESSIONS
     ══════════════════════════════════════════════════════════ */
  function renderSessions(filtered) {
    const q   = pgSt.sessSearch.toLowerCase();
    const vis = q ? filtered.filter(s => {
      const ex = (s.exercises||[]).map(e=>(e.name||'').toLowerCase()).join(' ');
      return (s.name||'').toLowerCase().includes(q) || ex.includes(q);
    }) : filtered;

    const viewBtns = `
      <div style="display:flex;gap:6px;">
        <button class="pg-btn${pgSt.sessView==='list'?' teal':' ghost'}" onclick="pgSetSessView('list')" style="padding:6px 12px;font-size:11px;">☰ List</button>
        <button class="pg-btn${pgSt.sessView==='calendar'?' teal':' ghost'}" onclick="pgSetSessView('calendar')" style="padding:6px 12px;font-size:11px;">${Icons.calendar(12)} Cal</button>
      </div>`;

    let leftHtml = '';
    if (pgSt.sessView === 'list') {
      leftHtml = `
        <div class="pg-search-wrap">
          ${Icons.search(14, 1.5, 'position:absolute;left:11px;top:50%;transform:translateY(-50%);opacity:.45;pointer-events:none;')}
          <input id="pgSessSearch" class="pg-search-input" placeholder="Search sessions…">
        </div>
        <div id="pgSessList" style="display:flex;flex-direction:column;gap:5px;">
          ${vis.length ? vis.map(sessCard).join('') : emptyList('No sessions found')}
        </div>`;
    } else {
      leftHtml = calendarView(filtered);
    }

    const rightHtml = pgSt.selSessId
      ? `<div id="pgSessDetailWrap"><p class="muted" style="padding:30px;text-align:center;">Loading…</p></div>`
      : `<div class="pg-empty"><div class="pg-empty-icon">📋</div><div class="pg-empty-title">Select a session</div><div class="pg-empty-sub">Pick a session to view details, edit or delete sets.</div></div>`;

    return `
      <div style="animation:fadeUp .28s ease;">
        <div class="pg-section-head" style="margin-bottom:14px;">
          <div>
            <h2 class="pg-section-title">Sessions</h2>
            <p class="pg-section-sub">${filtered.length} session${filtered.length!==1?'s':''} in range</p>
          </div>
          ${viewBtns}
        </div>
        ${filtered.length === 0 ? `
          <div class="pg-empty">
            <div class="pg-empty-icon">📋</div>
            <div class="pg-empty-title">No sessions yet</div>
            <div class="pg-empty-sub">Your completed workouts will appear here.</div>
          </div>` : `
          <div class="pg-split">
            <div class="pg-list-pane">${leftHtml}</div>
            <div class="pg-detail-pane" id="pgDetailPane">${rightHtml}</div>
          </div>`}
      </div>`;
  }

  function sessCard(sess) {
    const active = pgSt.selSessId === sess.id;
    const exN  = (sess.exercises||[]).length;
    const dur  = sess.totals?.durationSec;
    const vol  = sess.totals?.totalVolume;
    const sets = sess.totals?.totalSets;
    return `
      <div class="pg-sess-item${active?' active':''}" data-sess-id="${sess.id}" onclick="pgSelectSess('${sess.id}')">
        <div class="pg-sess-date">${fmtDate(sess.startedAt)}</div>
        <div class="pg-sess-name">${esc(sess.name || 'Workout')}</div>
        <div class="pg-sess-pills">
          ${dur  ? `<span class="pg-sess-pill">⏱ ${fmtDur(dur)}</span>` : ''}
          ${exN  ? `<span class="pg-sess-pill">💪 ${exN} ex</span>` : ''}
          ${sets ? `<span class="pg-sess-pill">📊 ${sets} sets</span>` : ''}
          ${vol  ? `<span class="pg-sess-pill">🏋 ${fmtVol(vol)}</span>` : ''}
        </div>
      </div>`;
  }

  function updateSessList() {
    const el = document.getElementById('pgSessList');
    if (!el) return;
    const filtered = getFiltered();
    const q = pgSt.sessSearch.toLowerCase();
    const vis = q ? filtered.filter(s => {
      const ex = (s.exercises||[]).map(e=>(e.name||'').toLowerCase()).join(' ');
      return (s.name||'').toLowerCase().includes(q) || ex.includes(q);
    }) : filtered;
    el.innerHTML = vis.length ? vis.map(sessCard).join('') : emptyList('No sessions found');
  }

  async function renderSessDetailAsync(sessId) {
    const sess = pgSt.sessions.find(s => s.id === sessId);
    if (!sess) return;
    const sets = await apexDB.getByIndex('workoutSets', 'sessionId', sessId) || [];
    const el   = document.getElementById('pgSessDetailWrap') || document.getElementById('pgDetailPane');
    if (el) el.innerHTML = buildSessDetailHtml(sess, sets);
  }

  function buildSessDetailHtml(sess, sets, bannerMsg) {
    const dur     = sess.totals?.durationSec;
    const vol     = sess.totals?.totalVolume;
    const exCount = (sess.exercises||[]).length;

    const exMap = new Map();
    for (const s of sets) {
      const key = s.sessionExerciseId || s.exerciseId || s.exerciseName || 'unk';
      if (!exMap.has(key)) {
        const libEx = getExById(s.exerciseId);
        exMap.set(key, {
          name: s.exerciseName || libEx?.name || 'Exercise',
          exerciseId: s.exerciseId,
          trackingType: s.trackingType || libEx?.trackingType || 'Weight + Reps',
          sets: []
        });
      }
      exMap.get(key).sets.push(s);
    }

    let exBlocks = '';
    if (exMap.size > 0) {
      exBlocks = [...exMap.values()].map(ex => {
        const tt     = normTT(ex.trackingType);
        const sorted = [...ex.sets].sort((a, b) => (a.setIndex||0) - (b.setIndex||0));
        let head = '', rows = '';

        if (tt === 'weight_reps') {
          head = `<tr><th>#</th><th>Type</th><th>Weight</th><th>Reps</th><th>e1RM</th><th></th></tr>`;
          rows = sorted.map((s, i) => `
            <tr>
              <td style="color:var(--muted)">${i+1}</td>
              <td><span class="pg-set-type-badge ${s.type||'working'}">${s.type||'working'}</span></td>
              <td>${fmtWt(s.weight)}</td>
              <td>${s.reps||'—'}</td>
              <td style="color:var(--teal)">${s.weight&&s.reps ? fmtN(e1RM(s.weight,s.reps)) : '—'}</td>
              <td>${setActions(s.id, sess.id)}</td>
            </tr>`).join('');
        } else if (tt === 'bodyweight_reps' || tt === 'assisted_weight_reps') {
          head = `<tr><th>#</th><th>Type</th>${tt==='assisted_weight_reps'?'<th>Assist</th>':''}<th>Reps</th><th></th></tr>`;
          rows = sorted.map((s, i) => `
            <tr>
              <td style="color:var(--muted)">${i+1}</td>
              <td><span class="pg-set-type-badge ${s.type||'working'}">${s.type||'working'}</span></td>
              ${tt==='assisted_weight_reps'?`<td>${s.addedWeight?'-'+s.addedWeight+' kg':'—'}</td>`:''}
              <td>${s.reps||'—'}</td>
              <td>${setActions(s.id, sess.id)}</td>
            </tr>`).join('');
        } else if (tt === 'time') {
          head = `<tr><th>#</th><th>Duration</th><th></th></tr>`;
          rows = sorted.map((s, i) => `
            <tr>
              <td style="color:var(--muted)">${i+1}</td>
              <td>${fmtDur(s.durationSec)}</td>
              <td>${setActions(s.id, sess.id)}</td>
            </tr>`).join('');
        } else if (tt === 'distance_time') {
          head = `<tr><th>#</th><th>Distance</th><th>Time</th><th></th></tr>`;
          rows = sorted.map((s, i) => `
            <tr>
              <td style="color:var(--muted)">${i+1}</td>
              <td>${s.distance ? s.distance+' '+(s.distanceUnit||'km') : '—'}</td>
              <td>${fmtDur(s.durationSec)}</td>
              <td>${setActions(s.id, sess.id)}</td>
            </tr>`).join('');
        } else {
          head = `<tr><th>#</th><th>Weight</th><th>Reps</th><th></th></tr>`;
          rows = sorted.map((s, i) => `
            <tr>
              <td style="color:var(--muted)">${i+1}</td>
              <td>${fmtWt(s.weight)}</td>
              <td>${s.reps||'—'}</td>
              <td>${setActions(s.id, sess.id)}</td>
            </tr>`).join('');
        }

        // Clickable exercise name → drill into Exercises tab
        const exNameLink = ex.exerciseId
          ? `<div class="pg-ex-block-name" onclick="pgSt_openExAndHighlightPR('${ex.exerciseId}')" title="View exercise progress">${esc(ex.name)}</div>`
          : `<div class="pg-ex-block-name">${esc(ex.name)}</div>`;

        return `
          <div class="pg-ex-block">
            <div class="pg-ex-block-head">
              <div>${exNameLink}<div class="pg-ex-block-type">${ex.trackingType}</div></div>
              <span style="font-size:12px;color:var(--muted);">${ex.sets.length} set${ex.sets.length!==1?'s':''}</span>
            </div>
            <table class="pg-sets-table">
              <thead>${head}</thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
      }).join('');
    } else if (exCount > 0) {
      exBlocks = (sess.exercises||[]).map(ex => `
        <div class="pg-ex-block">
          <div class="pg-ex-block-head">
            <div class="pg-ex-block-name">${esc(ex.name||'Exercise')}</div>
          </div>
          <p style="padding:12px 16px;color:var(--muted);font-size:13px;">Set details not available for this session.</p>
        </div>`).join('');
    }

    return `
      <div style="animation:fadeUp .22s ease;display:flex;flex-direction:column;gap:14px;" id="pgSessDetailWrap">

        ${bannerMsg ? `<div class="pg-update-banner">${Icons.check(14)} ${bannerMsg}</div>` : ''}

        <!-- Session Header -->
        <div class="pg-sess-detail-header">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div>
              <p style="font-size:10px;color:var(--teal);font-weight:900;letter-spacing:.16em;text-transform:uppercase;margin:0 0 5px;">${fmtDate(sess.startedAt)}</p>
              <h2 class="pg-detail-title" style="margin:0;">${esc(sess.name||'Workout')}</h2>
            </div>
            <div class="pg-action-row">
              <button class="pg-btn orange sm" onclick="pgRepeatSession('${sess.id}')">🔁 Repeat</button>
              <button class="pg-btn danger sm" onclick="pgDeleteSession('${sess.id}')">${Icons.trash(12)} Delete</button>
            </div>
          </div>
          <div class="pg-sess-totals">
            ${dur       ? `<div class="pg-sess-total-item"><div class="pg-sess-total-val">${fmtDur(dur)}</div><div class="pg-sess-total-lbl">Duration</div></div>` : ''}
            ${sets.length ? `<div class="pg-sess-total-item"><div class="pg-sess-total-val">${sets.length}</div><div class="pg-sess-total-lbl">Sets</div></div>` : ''}
            ${exCount   ? `<div class="pg-sess-total-item"><div class="pg-sess-total-val">${exCount}</div><div class="pg-sess-total-lbl">Exercises</div></div>` : ''}
            ${vol       ? `<div class="pg-sess-total-item"><div class="pg-sess-total-val">${fmtVol(vol)}</div><div class="pg-sess-total-lbl">Volume</div></div>` : ''}
          </div>
        </div>

        ${exBlocks || `<div class="pg-empty"><div class="pg-empty-icon">📭</div><div class="pg-empty-title">No set details</div></div>`}
      </div>`;
  }

  function setActions(setId, sessId) {
    return `<div style="display:flex;gap:3px;">
      <button class="pg-btn ghost icon-only sm" onclick="pgEditSetModal('${setId}')" title="Edit">${Icons.edit(12)}</button>
      <button class="pg-btn danger icon-only sm" onclick="pgDeleteSet('${setId}','${sessId}')" title="Delete">${Icons.trash(12)}</button>
    </div>`;
  }

  /* ── Calendar View ─────────────────────────────────────── */
  function calendarView(filtered) {
    const now   = new Date();
    const year  = now.getFullYear(), month = now.getMonth(), today = now.getDate();
    const first = new Date(year, month, 1).getDay();
    const days  = new Date(year, month+1, 0).getDate();
    const sessMap = {};
    for (const s of filtered) {
      const d = new Date(s.startedAt);
      if (d.getFullYear()===year && d.getMonth()===month) {
        const day = d.getDate();
        if (!sessMap[day]) sessMap[day] = [];
        sessMap[day].push(s);
      }
    }
    const mName = now.toLocaleDateString('en-US',{month:'long',year:'numeric'});
    const dls   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    let cells   = dls.map(d=>`<div class="pg-cal-day-lbl">${d}</div>`).join('');
    for (let i=0; i<first; i++) cells += `<div></div>`;
    for (let d=1; d<=days; d++) {
      const hasSess = !!(sessMap[d]?.length);
      const isToday = d === today;
      const onclick = hasSess ? `onclick="pgSelectSess('${sessMap[d][0].id}')"` : '';
      cells += `
        <div class="pg-cal-day${hasSess?' has-sess':''}${isToday?' today':''}" ${onclick}>
          ${d}${hasSess?'<div class="pg-cal-dot"></div>':''}
        </div>`;
    }
    return `
      <div>
        <p style="font-size:13px;font-weight:700;color:var(--soft);margin:0 0 12px;text-align:center;">${mName}</p>
        <div class="pg-cal-grid">${cells}</div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════════════
     PHASE 4 — SESSION ACTIONS (undo, confirm, repeat)
     ══════════════════════════════════════════════════════════ */

  /* Custom confirm dialog */
  function pgConfirm(msg, sub, label, onConfirm) {
    document.getElementById('pgConfirmDlg')?.remove();
    const dlg = document.createElement('div');
    dlg.id = 'pgConfirmDlg';
    dlg.className = 'pg-confirm-overlay';
    dlg.innerHTML = `
      <div class="pg-confirm-box">
        <div class="pg-confirm-icon">🗑️</div>
        <div class="pg-confirm-msg">${esc(msg)}</div>
        ${sub ? `<div class="pg-confirm-sub">${esc(sub)}</div>` : ''}
        <div class="pg-confirm-btns">
          <button class="pg-btn ghost" onclick="document.getElementById('pgConfirmDlg').remove()">Cancel</button>
          <button class="pg-btn danger" id="pgConfirmOk">${label || 'Delete'}</button>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    document.getElementById('pgConfirmOk').onclick = () => { dlg.remove(); onConfirm(); };
  }

  /* Undo toast */
  function pgShowUndo(msg, undoFn) {
    document.getElementById('pgUndoToast')?.remove();
    clearTimeout(pgSt._undoTimer);
    const el = document.createElement('div');
    el.id = 'pgUndoToast';
    el.className = 'pg-undo-toast';
    el.innerHTML = `<span>${esc(msg)}</span><button class="pg-undo-btn" id="pgUndoBtn">Undo</button>`;
    document.body.appendChild(el);
    document.getElementById('pgUndoBtn').onclick = () => {
      clearTimeout(pgSt._undoTimer);
      el.remove();
      undoFn();
    };
    pgSt._undoTimer = setTimeout(() => el.remove(), 5000);
  }

  /* Edit set modal */
  window.pgEditSetModal = async function (setId) {
    const s  = pgSt.allSets.find(x => x.id === setId);
    if (!s) return;
    const tt = normTT(s.trackingType || '');
    const ex = getExById(s.exerciseId);

    let fields = '';
    if (tt === 'weight_reps' || tt === 'assisted_weight_reps') {
      fields = `
        <div class="pg-modal-field"><label>Weight (kg)</label>
          <input class="pg-modal-input" id="pgEd_weight" type="number" step="0.5" min="0" value="${s.weight||''}"></div>
        <div class="pg-modal-field"><label>Reps</label>
          <input class="pg-modal-input" id="pgEd_reps" type="number" min="0" value="${s.reps||''}"></div>`;
    } else if (tt === 'bodyweight_reps') {
      fields = `
        <div class="pg-modal-field"><label>Reps</label>
          <input class="pg-modal-input" id="pgEd_reps" type="number" min="0" value="${s.reps||''}"></div>`;
    } else if (tt === 'time') {
      fields = `
        <div class="pg-modal-field"><label>Duration (seconds)</label>
          <input class="pg-modal-input" id="pgEd_dur" type="number" min="0" value="${s.durationSec||''}"></div>`;
    } else if (tt === 'distance_time') {
      fields = `
        <div class="pg-modal-field"><label>Distance (${s.distanceUnit||'km'})</label>
          <input class="pg-modal-input" id="pgEd_dist" type="number" step="0.01" min="0" value="${s.distance||''}"></div>
        <div class="pg-modal-field"><label>Duration (seconds)</label>
          <input class="pg-modal-input" id="pgEd_dur" type="number" min="0" value="${s.durationSec||''}"></div>`;
    } else {
      fields = `
        <div class="pg-modal-field"><label>Weight (kg)</label>
          <input class="pg-modal-input" id="pgEd_weight" type="number" step="0.5" min="0" value="${s.weight||''}"></div>
        <div class="pg-modal-field"><label>Reps</label>
          <input class="pg-modal-input" id="pgEd_reps" type="number" min="0" value="${s.reps||''}"></div>`;
    }

    const overlay = document.createElement('div');
    overlay.className = 'pg-modal-overlay';
    overlay.id = 'pgSetModal';
    overlay.innerHTML = `
      <div class="pg-modal">
        <div class="pg-modal-title">
          Edit Set${ex ? ' — ' + esc(ex.name) : ''}
          <button class="pg-btn ghost icon-only" onclick="document.getElementById('pgSetModal').remove()" style="border:none;">${Icons.close(16)}</button>
        </div>
        ${fields}
        <div class="pg-modal-actions">
          <button class="pg-btn ghost" onclick="document.getElementById('pgSetModal').remove()">Cancel</button>
          <button class="pg-btn teal" onclick="pgSaveSet('${setId}','${s.sessionId}')">${Icons.save(14)} Save</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    overlay.querySelector('.pg-modal-input')?.focus();
  };

  const gv = (id, fallback) => document.getElementById(id)?.value ?? fallback;

  window.pgSaveSet = async function (setId, sessionId) {
    const s   = pgSt.allSets.find(x => x.id === setId);
    if (!s) return;
    const tt  = normTT(s.trackingType || '');
    const upd = { ...s };
    const prev = { ...s }; // for undo

    if (tt === 'distance_time') {
      upd.distance    = parseFloat(gv('pgEd_dist', s.distance))    || s.distance;
      upd.durationSec = parseFloat(gv('pgEd_dur',  s.durationSec)) || s.durationSec;
    } else if (tt === 'time') {
      upd.durationSec = parseFloat(gv('pgEd_dur', s.durationSec)) || s.durationSec;
    } else if (tt === 'bodyweight_reps') {
      upd.reps = parseInt(gv('pgEd_reps', s.reps)) || s.reps;
    } else {
      upd.weight = parseFloat(gv('pgEd_weight', s.weight)) || s.weight;
      upd.reps   = parseInt(gv('pgEd_reps', s.reps))       || s.reps;
    }

    await apexDB.put('workoutSets', upd);
    const idx = pgSt.allSets.findIndex(x => x.id === setId);
    if (idx >= 0) pgSt.allSets[idx] = upd;

    await recomputeSessionTotals(sessionId);
    if (s.exerciseId) await recomputePRForEx(s.exerciseId);
    pgSt.prs = await apexDB.getAll('personalRecords');

    document.getElementById('pgSetModal')?.remove();

    const sess = pgSt.sessions.find(x => x.id === sessionId);
    const sets = await apexDB.getByIndex('workoutSets', 'sessionId', sessionId);
    pgSt.allSets = pgSt.allSets.filter(x => x.sessionId !== sessionId);
    pgSt.allSets.push(...sets);
    const pane = document.getElementById('pgSessDetailWrap') || document.getElementById('pgDetailPane');
    if (pane && sess) pane.innerHTML = buildSessDetailHtml(sess, sets, 'Totals and PRs updated');

    document.dispatchEvent(new Event('workoutUpdated'));
  };

  window.pgDeleteSet = async function (setId, sessionId) {
    const s = pgSt.allSets.find(x => x.id === setId);
    if (!s) return;

    pgConfirm('Delete this set?', 'This can be undone for 5 seconds.', 'Delete Set', async () => {
      await apexDB.delete('workoutSets', setId);
      pgSt.allSets = pgSt.allSets.filter(x => x.id !== setId);
      await recomputeSessionTotals(sessionId);
      if (s?.exerciseId) await recomputePRForEx(s.exerciseId);
      pgSt.prs = await apexDB.getAll('personalRecords');

      const sess = pgSt.sessions.find(x => x.id === sessionId);
      const sets = await apexDB.getByIndex('workoutSets', 'sessionId', sessionId);
      pgSt.allSets = pgSt.allSets.filter(x => x.sessionId !== sessionId);
      pgSt.allSets.push(...sets);
      const pane = document.getElementById('pgSessDetailWrap') || document.getElementById('pgDetailPane');
      if (pane && sess) pane.innerHTML = buildSessDetailHtml(sess, sets, 'Totals and PRs updated');

      document.dispatchEvent(new Event('workoutUpdated'));

      // Undo: restore set
      pgShowUndo('Set deleted', async () => {
        await apexDB.put('workoutSets', s);
        pgSt.allSets.push(s);
        await recomputeSessionTotals(sessionId);
        if (s.exerciseId) await recomputePRForEx(s.exerciseId);
        pgSt.prs = await apexDB.getAll('personalRecords');
        const refreshedSets = await apexDB.getByIndex('workoutSets', 'sessionId', sessionId);
        pgSt.allSets = pgSt.allSets.filter(x => x.sessionId !== sessionId);
        pgSt.allSets.push(...refreshedSets);
        if (pane && sess) pane.innerHTML = buildSessDetailHtml(sess, refreshedSets, 'Set restored');
        document.dispatchEvent(new Event('workoutUpdated'));
      });
    });
  };

  window.pgDeleteSession = async function (sessId) {
    const sess = pgSt.sessions.find(s => s.id === sessId);
    const sessName = sess ? (sess.name || 'Workout') : 'Session';
    const savedSets = pgSt.allSets.filter(s => s.sessionId === sessId);

    pgConfirm(
      `Delete "${sessName}"?`,
      'All sets in this session will be removed. Can be undone for 5 seconds.',
      'Delete Session',
      async () => {
        const sets = await apexDB.getByIndex('workoutSets', 'sessionId', sessId);
        for (const s of sets) await apexDB.delete('workoutSets', s.id);
        await apexDB.delete('workoutSessions', sessId);
        pgSt.sessions = pgSt.sessions.filter(s => s.id !== sessId);
        pgSt.allSets  = pgSt.allSets.filter(s => s.sessionId !== sessId);
        pgSt.selSessId = null;
        if (window.loadWorkoutState) await window.loadWorkoutState();
        renderPg();
        document.dispatchEvent(new Event('workoutUpdated'));

        // Undo: restore session + sets
        pgShowUndo(`"${sessName}" deleted`, async () => {
          if (sess) await apexDB.put('workoutSessions', sess);
          for (const s of savedSets) await apexDB.put('workoutSets', s);
          if (sess) pgSt.sessions.unshift(sess);
          pgSt.allSets.push(...savedSets);
          if (window.loadWorkoutState) await window.loadWorkoutState();
          renderPg();
          document.dispatchEvent(new Event('workoutUpdated'));
          toast('Session restored');
        });
      }
    );
  };

  window.pgRepeatSession = function (sessId) {
    const sess = pgSt.sessions.find(s => s.id === sessId);
    if (!sess) return;
    const exercises = (sess.exercises || []).map(e => ({ id: e.exerciseId || e.id, name: e.name }));
    localStorage.setItem('omniRepeatPlan', JSON.stringify({ name: sess.name, exercises }));
    // Switch to Today tab
    window.wkState.currentTab = 'today';
    document.querySelectorAll('#workoutInternalNav .nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === 'today');
    });
    window.drawWorkoutPanel();
    setTimeout(() => toast(`Repeat: ${exercises.map(e=>e.name).slice(0,3).join(', ')}${exercises.length>3?'…':''} — tap Start`), 350);
  };

  /* ── Recompute helpers ─────────────────────────────────── */
  async function recomputeSessionTotals(sessId) {
    const sess = await apexDB.get('workoutSessions', sessId);
    if (!sess) return;
    const sets        = await apexDB.getByIndex('workoutSets', 'sessionId', sessId);
    const totalVolume = sets.reduce((a, s) => a + (Number(s.weight)||0)*(Number(s.reps)||0), 0);
    sess.totals = { ...(sess.totals||{}), totalVolume, totalSets: sets.length };
    await apexDB.put('workoutSessions', sess);
    const idx = pgSt.sessions.findIndex(s => s.id === sessId);
    if (idx >= 0) pgSt.sessions[idx] = sess;
  }

  async function recomputePRForEx(exId) {
    if (!exId) return;
    const sets = await apexDB.getByIndex('workoutSets', 'exerciseId', exId);
    if (!sets.length) return;
    let bW = 0, bE = 0, bR = 0;
    for (const s of sets) {
      const w = Number(s.weight)||0, r = Number(s.reps)||0, e = e1RM(w, r);
      if (w > bW) bW = w;
      if (e > bE) bE = e;
      if (r > bR) bR = r;
    }
    const rec = (await apexDB.get('personalRecords', exId)) || { id: exId, exerciseId: exId };
    rec.bestWeight  = bW || rec.bestWeight;
    rec.bestE1RM    = bE || rec.bestE1RM;
    rec.bestReps    = bR || rec.bestReps;
    rec.lastUpdated = new Date().toISOString();
    await apexDB.put('personalRecords', rec);
    const idx = pgSt.prs.findIndex(p => p.id === exId);
    if (idx >= 0) pgSt.prs[idx] = rec; else pgSt.prs.push(rec);
  }

  /* ══════════════════════════════════════════════════════════
     CHART UTILITIES
     ══════════════════════════════════════════════════════════ */

  /* Micro sparkline */
  function sparkline(vals, w=64, h=16, color='#00d4ff') {
    if (!vals || vals.length < 2) return '';
    const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length-1)) * (w-2) + 1;
      const y = h - ((v-mn)/rng) * (h-2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
    </svg>`;
  }

  /* Full line chart with interactive SVG tooltips */
  function lineChart(data, color='#00d4ff', unit='') {
    if (!data || data.length < 2) return `<div class="pg-chart-empty">Not enough data</div>`;
    const vW=380, vH=120, pad={t:14,r:14,b:28,l:42};
    const iW = vW-pad.l-pad.r, iH = vH-pad.t-pad.b;
    const vals = data.map(d=>d.y);
    const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx-mn||1;
    const pts = data.map((d, i) => ({
      x: pad.l + (i/(data.length-1))*iW,
      y: pad.t + iH - ((d.y-mn)/rng)*iH,
      d,
    }));
    let pathD = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i=1; i<pts.length; i++) {
      const p0=pts[i-1], p1=pts[i];
      const cx = (p1.x-p0.x)/2.8;
      pathD += ` C${(p0.x+cx).toFixed(1)} ${p0.y.toFixed(1)},${(p1.x-cx).toFixed(1)} ${p1.y.toFixed(1)},${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    const fillD = `${pathD} L${pts.at(-1).x.toFixed(1)} ${(pad.t+iH).toFixed(1)} L${pts[0].x.toFixed(1)} ${(pad.t+iH).toFixed(1)} Z`;
    const grid  = [0,.5,1].map(f => {
      const gy = pad.t + iH - f*iH, v = mn + f*rng;
      return `<line x1="${pad.l}" y1="${gy.toFixed(1)}" x2="${pad.l+iW}" y2="${gy.toFixed(1)}" stroke="rgba(255,255,255,.05)" stroke-width="1"/>
              <text x="${(pad.l-4).toFixed(1)}" y="${(gy+3.5).toFixed(1)}" text-anchor="end" fill="rgba(255,255,255,.3)" font-size="8" font-family="Inter,sans-serif">${v>=1000?(v/1000).toFixed(1)+'k':Math.round(v)}</text>`;
    }).join('');
    const step  = Math.max(1, Math.floor(pts.length/4));
    const xLbls = pts.filter((_,i)=>i===0||i===pts.length-1||i%step===0).map(p =>
      `<text x="${p.x.toFixed(1)}" y="${(pad.t+iH+18).toFixed(1)}" text-anchor="middle" fill="rgba(255,255,255,.3)" font-size="8" font-family="Inter,sans-serif">${fmtDate(p.d.x,true)}</text>`
    ).join('');
    const dots  = pts.map(p => {
      const tipLabel = `${fmtDate(p.d.x,true)} · ${unit==='sec'?fmtDur(p.d.y):unit==='kg'||unit==='kg e1RM'?fmtN(p.d.y)+' '+unit:unit==='reps'?Math.round(p.d.y)+' reps':fmtN(p.d.y,2)+' '+unit}`;
      return `
        <circle class="pg-dot-hit" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="transparent" stroke="transparent"
          onmouseenter="pgShowTip(event,'${tipLabel.replace(/'/g,"&#39;")}')"
          onmouseleave="pgHideTip()"/>
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="${color}" opacity=".9" pointer-events="none"/>`;
    }).join('');
    const gid = 'g'+Math.random().toString(36).slice(2,6);
    return `<svg class="pg-chart-svg" viewBox="0 0 ${vW} ${vH}">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".22"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      <path d="${fillD}" fill="url(#${gid})"/>
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}${xLbls}
    </svg>`;
  }

  /* Bar chart with tooltips */
  function barChart(data, color='#8b5cf6', unit='') {
    if (!data || data.length < 2) return `<div class="pg-chart-empty">Not enough data</div>`;
    const vW=380, vH=100, pad={t:8,r:14,b:24,l:42};
    const iW = vW-pad.l-pad.r, iH = vH-pad.t-pad.b;
    const mx  = Math.max(...data.map(d=>d.y)) || 1;
    const slotW = iW/data.length;
    const barW  = Math.max(4, slotW*0.6);
    const bars  = data.map((d, i) => {
      const bh  = Math.max(2, (d.y/mx)*iH);
      const x   = pad.l + i*slotW + (slotW-barW)/2;
      const y   = pad.t + iH - bh;
      const tipVal = unit==='kg'?fmtVol(d.y):unit==='sec'?fmtDur(d.y):unit==='reps'?Math.round(d.y)+' reps':fmtN(d.y,1)+' '+unit;
      const tipLabel = `${fmtDate(d.x,true)} · ${tipVal}`;
      return `
        <rect class="pg-dot-hit" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${color}" opacity="${(.38+.62*d.y/mx).toFixed(2)}"
          onmouseenter="pgShowTip(event,'${tipLabel.replace(/'/g,"&#39;")}')"
          onmouseleave="pgHideTip()"/>`;
    }).join('');
    const yLbl = mx>=1000 ? (mx/1000).toFixed(1)+'k' : Math.round(mx);
    const xLbls = [0, data.length-1].map(i => {
      const x = pad.l + i*slotW + slotW/2;
      return `<text x="${x.toFixed(1)}" y="${(pad.t+iH+16).toFixed(1)}" text-anchor="middle" fill="rgba(255,255,255,.3)" font-size="8" font-family="Inter,sans-serif">${fmtDate(data[i].x,true)}</text>`;
    }).join('');
    return `<svg class="pg-chart-svg" viewBox="0 0 ${vW} ${vH}">
      <line x1="${pad.l}" y1="${pad.t+iH}" x2="${pad.l+iW}" y2="${pad.t+iH}" stroke="rgba(255,255,255,.07)" stroke-width="1"/>
      <text x="${(pad.l-4).toFixed(1)}" y="${(pad.t+8).toFixed(1)}" text-anchor="end" fill="rgba(255,255,255,.3)" font-size="8" font-family="Inter,sans-serif">${yLbl}</text>
      ${bars}${xLbls}
    </svg>`;
  }

  /* Bar sparkline (HTML, for Overview weekly charts) */
  function barSparkline(data, color) {
    if (!data || data.length<2) return `<div class="pg-chart-empty">Not enough data</div>`;
    const mx = Math.max(...data.map(d=>d.v)) || 1;
    const bars = data.map(d => {
      const pct = d.v/mx;
      const h   = Math.max(2, pct*56);
      return `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;" title="${d.l}: ${d.v}">
          <div style="flex:1;display:flex;align-items:flex-end;width:100%;padding:0 1px;">
            <div style="width:100%;height:${h}px;background:${color};border-radius:3px 3px 0 0;opacity:${(.35+.65*pct).toFixed(2)};"></div>
          </div>
          <span style="font-size:8px;color:rgba(255,255,255,.25);white-space:nowrap;text-align:center;overflow:hidden;max-width:100%;">${d.l.split(' ')[0]}</span>
        </div>`;
    }).join('');
    return `<div style="display:flex;align-items:flex-end;gap:2px;height:74px;padding:0 2px;">${bars}</div>`;
  }

  /* Consistency heatmap */
  function drawHeatmap(sessions) {
    const WEEKS = 16;
    const now   = new Date();
    const sessSet = new Set();
    for (const s of sessions) {
      const d = new Date(s.startedAt);
      sessSet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay() - (WEEKS-1)*7);
    start.setHours(0,0,0,0);

    const dls = ['S','M','T','W','T','F','S'];
    let cells = '';
    const cur = new Date(start);
    for (let i=0; i<WEEKS*7; i++) {
      const key    = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
      const on     = sessSet.has(key);
      const isFut  = cur > now;
      const isToday = cur.toDateString() === now.toDateString();
      const title   = cur.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + (on?' · Session':'');
      cells += `<div class="pg-heatmap-cell${on?' on':''}" title="${title}"
        style="${isFut?'opacity:.2;':''}${isToday?'box-shadow:0 0 0 1.5px rgba(0,212,255,.6);':''}"
      ></div>`;
      cur.setDate(cur.getDate()+1);
    }
    let mLabels = '';
    const cm = new Date(start);
    let lastMo = -1;
    for (let w=0; w<WEEKS; w++) {
      const mo = cm.getMonth();
      if (mo !== lastMo) {
        mLabels += `<span style="position:absolute;left:${w*15}px;font-size:9px;color:rgba(255,255,255,.28);white-space:nowrap;">${cm.toLocaleDateString('en-US',{month:'short'})}</span>`;
        lastMo = mo;
      }
      cm.setDate(cm.getDate()+7);
    }
    return `
      <div>
        <div style="position:relative;height:14px;margin-bottom:4px;margin-left:20px;">${mLabels}</div>
        <div style="display:flex;gap:5px;">
          <div style="display:flex;flex-direction:column;gap:3px;padding-top:1px;">
            ${dls.map(d=>`<div style="width:14px;height:12px;font-size:9px;color:rgba(255,255,255,.22);line-height:12px;">${d}</div>`).join('')}
          </div>
          <div class="pg-heatmap-wrap"><div class="pg-heatmap">${cells}</div></div>
        </div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:10px;justify-content:flex-end;">
          <span style="font-size:9px;color:rgba(255,255,255,.25);">Less</span>
          ${[.06,.2,.4,.65,.9].map(o=>`<div style="width:10px;height:10px;border-radius:2px;background:rgba(57,255,20,${o});"></div>`).join('')}
          <span style="font-size:9px;color:rgba(255,255,255,.25);">More</span>
        </div>
      </div>`;
  }

  /* ── Bucketing ─────────────────────────────────────────── */
  function weekBuckets(sessions, n) {
    const now = new Date(); const out = [];
    for (let i=n-1; i>=0; i--) {
      const end   = new Date(now); end.setDate(end.getDate()-i*7); end.setHours(23,59,59,999);
      const start = new Date(end); start.setDate(start.getDate()-6); start.setHours(0,0,0,0);
      const v = sessions.filter(s=>{const d=new Date(s.startedAt);return d>=start&&d<=end;}).length;
      out.push({l:start.toLocaleDateString('en-US',{month:'short',day:'numeric'}),v});
    }
    return out;
  }
  function weekVolBuckets(sessions, n) {
    const now = new Date(); const out = [];
    for (let i=n-1; i>=0; i--) {
      const end   = new Date(now); end.setDate(end.getDate()-i*7); end.setHours(23,59,59,999);
      const start = new Date(end); start.setDate(start.getDate()-6); start.setHours(0,0,0,0);
      const v = sessions.filter(s=>{const d=new Date(s.startedAt);return d>=start&&d<=end;})
        .reduce((a,s)=>a+(s.totals?.totalVolume||0),0);
      out.push({l:start.toLocaleDateString('en-US',{month:'short',day:'numeric'}),v});
    }
    return out;
  }
  function weekSetBuckets(sessions, allSets, n) {
    const now = new Date(); const out = [];
    for (let i=n-1; i>=0; i--) {
      const end   = new Date(now); end.setDate(end.getDate()-i*7); end.setHours(23,59,59,999);
      const start = new Date(end); start.setDate(start.getDate()-6); start.setHours(0,0,0,0);
      const sessIds = new Set(sessions.filter(s=>{const d=new Date(s.startedAt);return d>=start&&d<=end;}).map(s=>s.id));
      const v = allSets.filter(s=>sessIds.has(s.sessionId)).length;
      out.push({l:start.toLocaleDateString('en-US',{month:'short',day:'numeric'}),v});
    }
    return out;
  }
  function weekTimeBuckets(sessions, n) {
    const now = new Date(); const out = [];
    for (let i=n-1; i>=0; i--) {
      const end   = new Date(now); end.setDate(end.getDate()-i*7); end.setHours(23,59,59,999);
      const start = new Date(end); start.setDate(start.getDate()-6); start.setHours(0,0,0,0);
      const v = sessions.filter(s=>{const d=new Date(s.startedAt);return d>=start&&d<=end;})
        .reduce((a,s)=>a+(s.totals?.durationSec||0),0);
      out.push({l:start.toLocaleDateString('en-US',{month:'short',day:'numeric'}),v});
    }
    return out;
  }

  /* ── Reusable UI ───────────────────────────────────────── */
  function chartCard(title, peak, svgOrHtml) {
    return `
      <div class="pg-chart-card">
        <div class="pg-chart-head">
          <span class="pg-chart-title">${title}</span>
          <span class="pg-chart-peak">${peak}</span>
        </div>
        ${svgOrHtml}
      </div>`;
  }
  function emptyList(msg) {
    return `<div class="pg-empty" style="padding:30px 10px;"><div class="pg-empty-title">${msg}</div></div>`;
  }

  /* ── Expose & reactivity ───────────────────────────────── */
  window.pgSt = pgSt;

  document.addEventListener('workoutUpdated', async () => {
    if (window.wkState && (window.wkState.currentTab === 'progress' || window.wkState.currentTab === 'history')) {
      await loadData();
      renderPg();
    }
  });

})();
