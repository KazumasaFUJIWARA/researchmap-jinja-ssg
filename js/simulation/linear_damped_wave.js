// 線型消散型波動方程式の解作用素可視化用JS
export function setupLinearDampedWaveSim(plotDiv) {
    const tSlider = document.getElementById('t-slider');
    const tValue = document.getElementById('t-value');
    const kSlider = document.getElementById('k-slider');
    const kValue = document.getElementById('k-value');

    // Modified Bessel function approximation (order 0 and 1)
    function besselI0(x, k) {
        let sum = 1, y = x / 2, term = 1;
        for (let i = 1; i <= k; i++) {
            term *= (y * y) / (i * i);
            sum += term;
        }
        return sum;
    }

    function besselI1(x, k) {
        let sum = x / 2, y = x / 2, term = x / 2;
        for (let i = 1; i <= k; i++) {
            term *= (y * y) / (i * (i + 1));
            sum += term;
        }
        return sum;
    }

    function updatePlot(t, k) {
        const yValues = [];
        const fValues = [], gValues = [], hValues = [], h2Values = [];

        const ymin = -t + 0.01;
        const ymax = t - 0.01;
        const steps = 200;
        const dy = (ymax - ymin) / steps;

        for (let i = 0; i <= steps; i++) {
            const y = ymin + i * dy;
            const tau2 = t * t - y * y;
            const sqrtTau = Math.sqrt(Math.max(0, tau2)) / 2;

            const f = Math.exp(-t / 2) * besselI0(sqrtTau, k);
            const g = 1 / Math.sqrt(Math.PI * t) * Math.exp(-y * y / (4 * t));

            let h = 0, h2 = 0;
            if (tau2 > 0) {
                h = Math.exp(-t / 2) * (t * besselI1(sqrtTau, k) / Math.sqrt(tau2) - besselI0(sqrtTau, k)) / 2;
                h2 = Math.exp(-t / 2) * (t * besselI1(sqrtTau, k) / Math.sqrt(tau2) + besselI0(sqrtTau, k)) / 2;
            }

            yValues.push(y);
            fValues.push(f);
            gValues.push(g);
            hValues.push(h);
            h2Values.push(h2);
        }

        const trace1 = { x: yValues, y: fValues, mode: 'lines', name: 'K_0(t,x)', line: { width: 2 } };
        const trace2 = { x: yValues, y: gValues, mode: 'lines', name: '熱核', line: { dash: 'dash' } };
        const trace3 = { x: yValues, y: hValues, mode: 'lines', name: 'K_1(t,x)', line: { dash: 'dot' } };
        const trace4 = { x: yValues, y: h2Values, mode: 'lines', name: 'K_0(t,x)+K_1(t,x)', line: { dash: 'dashdot' } };

        const plotYmax = 1.2 * Math.max(...fValues, ...gValues, ...h2Values);

        Plotly.newPlot(plotDiv, [trace1, trace2, trace3, trace4], {
            title: `t = ${t}, k = ${k}`,
            xaxis: { title: 'x' },
            yaxis: { title: '関数値', range: [-plotYmax, plotYmax] },
            legend: { orientation: 'v', x: 1.05, y: 1, xanchor: 'left', yanchor: 'top', font: {size: 16} },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: {
                color: 'var(--text-color)'
            }
        }, {responsive: true});
    }

    // Initial plot
    updatePlot(parseInt(tSlider.value), parseInt(kSlider.value));

    // Update on slider input
    tSlider.addEventListener('input', () => {
        const t = parseInt(tSlider.value);
        const k = parseInt(kSlider.value);
        tValue.textContent = t;
        updatePlot(t, k);
    });

    kSlider.addEventListener('input', () => {
        const t = parseInt(tSlider.value);
        const k = parseInt(kSlider.value);
        kValue.textContent = k;
        updatePlot(t, k);
    });

    // ウィンドウリサイズ時にグラフを再描画
    window.addEventListener('resize', () => {
        const t = parseInt(tSlider.value);
        const k = parseInt(kSlider.value);
        updatePlot(t, k);
    });
} 