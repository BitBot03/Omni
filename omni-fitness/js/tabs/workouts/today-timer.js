/* ─────────────────────────────────────────────────────────────
   TODAY · REST TIMER ENGINE
   Global single-instance rest countdown with floating widget.
   Public API:
     wkTimer.start(seconds, label)  → begin / restart timer
     wkTimer.add(delta)             → +/- seconds
     wkTimer.togglePause()          → pause / resume
     wkTimer.skip()                 → end immediately
     wkTimer.stop()                 → silent stop, hide widget
   ───────────────────────────────────────────────────────────── */
window.wkTimer = (() => {
    let total      = 0;
    let remaining  = 0;
    let label      = '';
    let paused     = false;
    let intervalId = null;
    let endsAt     = 0;

    function el() { return document.getElementById('wkRestTimer'); }

    function fmt(s) {
        s = Math.max(0, Math.round(s));
        const m = Math.floor(s / 60), sec = s % 60;
        return `${m}:${String(sec).padStart(2,'0')}`;
    }

    function settings() { return (window.wkSettings && window.wkSettings.get()) || {}; }

    function render() {
        let node = el();
        if (!node) {
            node = document.createElement('div');
            node.id  = 'wkRestTimer';
            node.className = 'wk-today-timer';
            document.body.appendChild(node);
        }
        const pct  = total > 0 ? (remaining / total) * 100 : 0;
        const warn = remaining <= 10 && remaining > 0;
        node.classList.toggle('warn', warn);
        node.innerHTML = `
            <p class="wk-today-timer-label">Rest Timer</p>
            <p class="wk-today-timer-name">${label || ''}</p>
            <div class="wk-today-timer-time">${fmt(remaining)}</div>
            <div class="wk-today-timer-bar"><div class="wk-today-timer-fill" style="width:${pct}%"></div></div>
            <div class="wk-today-timer-actions">
                <button onclick="wkTimer.add(-15)">−15s</button>
                <button onclick="wkTimer.add(15)">+15s</button>
                <button onclick="wkTimer.togglePause()">${paused ? '▶ Resume' : '⏸ Pause'}</button>
                <button class="skip" onclick="wkTimer.skip()">Skip</button>
            </div>`;
    }

    function tick() {
        if (paused) return;
        remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
        if (remaining <= 0) { finish(); return; }
        render();
    }

    function finish() {
        clearInterval(intervalId); intervalId = null;
        remaining = 0;
        const s = settings();
        try {
            if (s.timerVibrate && navigator.vibrate) navigator.vibrate([180, 80, 220]);
        } catch (e) {}
        try {
            if (s.timerSound) {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const o = ctx.createOscillator(); const g = ctx.createGain();
                o.connect(g); g.connect(ctx.destination);
                o.frequency.value = 880; g.gain.value = 0.08;
                o.start(); o.stop(ctx.currentTime + 0.18);
            }
        } catch(e){}
        const node = el();
        if (node) {
            node.style.transition = 'opacity .35s ease';
            node.style.opacity = '0';
            setTimeout(() => { node.remove(); }, 380);
        }
        if (typeof toast === 'function') toast('Rest complete — go!');
    }

    return {
        start(seconds, lbl = '') {
            seconds = Math.max(1, Number(seconds) || 0);
            total = seconds; remaining = seconds; label = lbl;
            paused = false;
            endsAt = Date.now() + seconds * 1000;
            if (intervalId) clearInterval(intervalId);
            intervalId = setInterval(tick, 250);
            render();
        },
        add(delta) {
            if (!intervalId && remaining <= 0) return;
            remaining = Math.max(1, remaining + delta);
            total     = Math.max(total, remaining);
            endsAt    = Date.now() + remaining * 1000;
            render();
        },
        togglePause() {
            if (!intervalId && remaining <= 0) return;
            paused = !paused;
            if (!paused) endsAt = Date.now() + remaining * 1000;
            render();
        },
        skip() { finish(); },
        stop() {
            clearInterval(intervalId); intervalId = null;
            remaining = 0;
            const node = el(); if (node) node.remove();
        },
        active() { return remaining > 0; }
    };
})();

/* ─────────────────────────────────────────────────────────────
   SETTINGS (lightweight, localStorage backed)
   ───────────────────────────────────────────────────────────── */
window.wkSettings = (() => {
    const KEY = 'omni_workout_settings_v1';
    const DEF = {
        units: 'kg',
        weightStep: 2.5,
        enableRPE: true,
        autoRestTimer: true,
        timerSound: false,
        timerVibrate: true,
        keepScreenAwake: false
    };
    let cache = null;
    function load() {
        if (cache) return cache;
        try { cache = { ...DEF, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
        catch { cache = { ...DEF }; }
        return cache;
    }
    return {
        get() { return load(); },
        set(patch) { cache = { ...load(), ...patch }; localStorage.setItem(KEY, JSON.stringify(cache)); return cache; }
    };
})();

/* ─────────────────────────────────────────────────────────────
   WAKE LOCK (best-effort, screen on during session)
   ───────────────────────────────────────────────────────────── */
window.wkWake = (() => {
    let sentinel = null;
    return {
        async acquire() {
            try {
                if (!('wakeLock' in navigator)) return;
                if (sentinel) return;
                sentinel = await navigator.wakeLock.request('screen');
                sentinel.addEventListener('release', () => { sentinel = null; });
            } catch (e) { /* ignore */ }
        },
        release() {
            try { sentinel && sentinel.release(); } catch(e){}
            sentinel = null;
        }
    };
})();

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible'
        && window.wkSettings.get().keepScreenAwake
        && window.wkState && window.wkState.activeSession) {
        window.wkWake.acquire();
    }
});
