/**
 * 1次元連成振動（両端固定・均等配置）
 * - 質点数 N = 1..10
 * - ばね定数 k・質量 m は全質点・全ばねで共通
 * - 停止中に質点をドラッグして初期変位を設定
 */
export function setupCoupledOscillatorSim() {
    const canvas = document.getElementById('coupled-oscillator-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const nSlider = document.getElementById('co-n-slider');
    const nValue = document.getElementById('co-n-value');
    const kSlider = document.getElementById('co-k-slider');
    const kValue = document.getElementById('co-k-value');
    const mSlider = document.getElementById('co-m-slider');
    const mValue = document.getElementById('co-m-value');
    const playBtn = document.getElementById('co-play-btn');
    const resetBtn = document.getElementById('co-reset-btn');

    const state = {
        n: 3,
        k: 20,
        m: 1,
        u: [],
        v: [],
        running: false,
        dragIndex: null,
        raf: null,
        lastTs: null,
    };

    const WALL_PAD = 48;
    const MASS_R = 14;
    const DISP_SCALE = 1; // 画素 ≈ 変位単位

    function readControls() {
        state.n = clamp(parseInt(nSlider.value, 10) || 3, 1, 10);
        state.k = Math.max(0.1, parseFloat(kSlider.value) || 20);
        state.m = Math.max(0.05, parseFloat(mSlider.value) || 1);
        nValue.textContent = String(state.n);
        kValue.textContent = String(state.k);
        mValue.textContent = String(state.m);
    }

    function clamp(x, a, b) {
        return Math.min(b, Math.max(a, x));
    }

    function resizeArrays(keep = true) {
        const oldU = state.u;
        const oldV = state.v;
        const n = state.n;
        state.u = new Array(n).fill(0);
        state.v = new Array(n).fill(0);
        if (keep) {
            for (let i = 0; i < Math.min(n, oldU.length); i++) {
                state.u[i] = oldU[i];
                state.v[i] = oldV[i] || 0;
            }
        }
    }

    function equilibriumXs() {
        const w = canvas.clientWidth;
        const left = WALL_PAD;
        const right = w - WALL_PAD;
        const span = right - left;
        const xs = [];
        for (let i = 0; i < state.n; i++) {
            xs.push(left + ((i + 1) / (state.n + 1)) * span);
        }
        return { left, right, xs };
    }

    function accelerations(u) {
        const n = u.length;
        const a = new Array(n);
        const km = state.k / state.m;
        for (let i = 0; i < n; i++) {
            const left = i === 0 ? 0 : u[i - 1];
            const right = i === n - 1 ? 0 : u[i + 1];
            a[i] = km * (left - 2 * u[i] + right);
        }
        return a;
    }

    function step(dt) {
        // velocity Verlet
        const a0 = accelerations(state.u);
        for (let i = 0; i < state.n; i++) {
            state.u[i] += state.v[i] * dt + 0.5 * a0[i] * dt * dt;
        }
        const a1 = accelerations(state.u);
        for (let i = 0; i < state.n; i++) {
            state.v[i] += 0.5 * (a0[i] + a1[i]) * dt;
        }
        // soft clamp extreme displacements for stability
        const maxDisp = canvas.clientWidth * 0.35;
        for (let i = 0; i < state.n; i++) {
            state.u[i] = clamp(state.u[i], -maxDisp, maxDisp);
            state.v[i] = clamp(state.v[i], -2000, 2000);
        }
    }

    function syncCanvasSize() {
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.clientWidth || 640;
        const cssH = canvas.clientHeight || 220;
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function isDark() {
        return document.documentElement.classList.contains('dark');
    }

    function draw() {
        syncCanvasSize();
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const midY = h * 0.5;
        const { left, right, xs } = equilibriumXs();

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = isDark() ? '#1b2226' : '#f6f8fa';
        ctx.fillRect(0, 0, w, h);

        // guide line
        ctx.strokeStyle = isDark() ? '#3d464d' : '#d0d7de';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(left, midY);
        ctx.lineTo(right, midY);
        ctx.stroke();

        // walls
        ctx.fillStyle = isDark() ? '#8b949e' : '#57606a';
        ctx.fillRect(left - 8, midY - 40, 8, 80);
        ctx.fillRect(right, midY - 40, 8, 80);

        const positions = xs.map((x, i) => x + state.u[i] * DISP_SCALE);

        // springs (wall — masses — wall)
        const springPts = [left, ...positions, right];
        ctx.strokeStyle = isDark() ? '#58a6ff' : '#0969da';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(springPts[0], midY);
        for (let i = 1; i < springPts.length; i++) {
            ctx.lineTo(springPts[i], midY);
        }
        ctx.stroke();

        // masses
        for (let i = 0; i < state.n; i++) {
            const x = positions[i];
            ctx.beginPath();
            ctx.arc(x, midY, MASS_R, 0, Math.PI * 2);
            ctx.fillStyle = state.dragIndex === i
                ? '#007711'
                : (isDark() ? '#3fb950' : '#1a7f37');
            ctx.fill();
            ctx.strokeStyle = isDark() ? '#e6edf3' : '#24292f';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = isDark() ? '#e6edf3' : '#fff';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(i + 1), x, midY);
        }

        if (!state.running) {
            ctx.fillStyle = isDark() ? '#8b949e' : '#57606a';
            ctx.font = '13px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('停止中: 質点をドラッグして初期位置を変更', 12, 10);
        }
    }

    function hitTest(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const midY = canvas.clientHeight * 0.5;
        const { xs } = equilibriumXs();
        for (let i = 0; i < state.n; i++) {
            const mx = xs[i] + state.u[i] * DISP_SCALE;
            const dx = x - mx;
            const dy = y - midY;
            if (dx * dx + dy * dy <= (MASS_R + 6) * (MASS_R + 6)) return i;
        }
        return null;
    }

    function loop(ts) {
        if (!state.running) {
            state.raf = null;
            state.lastTs = null;
            return;
        }
        if (state.lastTs == null) state.lastTs = ts;
        let dt = (ts - state.lastTs) / 1000;
        state.lastTs = ts;
        dt = Math.min(dt, 1 / 30);
        // substeps for stability
        const sub = 4;
        const h = dt / sub;
        for (let s = 0; s < sub; s++) step(h);
        draw();
        state.raf = requestAnimationFrame(loop);
    }

    function setRunning(on) {
        state.running = on;
        playBtn.textContent = on ? '一時停止' : '再生';
        if (on) {
            state.dragIndex = null;
            if (!state.raf) {
                state.lastTs = null;
                state.raf = requestAnimationFrame(loop);
            }
        } else if (state.raf) {
            cancelAnimationFrame(state.raf);
            state.raf = null;
            state.lastTs = null;
            draw();
        }
    }

    function resetMotion() {
        setRunning(false);
        for (let i = 0; i < state.n; i++) {
            state.v[i] = 0;
            state.u[i] = 0;
        }
        // 見やすい初期変位: 中央付近を少しずらす
        if (state.n >= 1) {
            const mid = Math.floor((state.n - 1) / 2);
            state.u[mid] = 40;
        }
        draw();
    }

    nSlider.addEventListener('input', () => {
        const wasRunning = state.running;
        setRunning(false);
        readControls();
        resizeArrays(true);
        for (let i = 0; i < state.n; i++) state.v[i] = 0;
        draw();
        if (wasRunning) setRunning(true);
    });

    kSlider.addEventListener('input', () => {
        readControls();
        if (!state.running) draw();
    });

    mSlider.addEventListener('input', () => {
        readControls();
        if (!state.running) draw();
    });

    playBtn.addEventListener('click', () => setRunning(!state.running));
    resetBtn.addEventListener('click', resetMotion);

    canvas.addEventListener('pointerdown', (e) => {
        if (state.running) return;
        const idx = hitTest(e.clientX, e.clientY);
        if (idx == null) return;
        state.dragIndex = idx;
        canvas.setPointerCapture(e.pointerId);
        draw();
    });

    canvas.addEventListener('pointermove', (e) => {
        if (state.dragIndex == null || state.running) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const { xs } = equilibriumXs();
        const i = state.dragIndex;
        const maxDisp = canvas.clientWidth * 0.35;
        state.u[i] = clamp((x - xs[i]) / DISP_SCALE, -maxDisp, maxDisp);
        state.v[i] = 0;
        draw();
    });

    function endDrag(e) {
        if (state.dragIndex == null) return;
        state.dragIndex = null;
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        draw();
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    window.addEventListener('resize', () => {
        draw();
    });

    // init
    readControls();
    resizeArrays(false);
    resetMotion();
}
