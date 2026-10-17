// sinのテイラー展開可視化用JS
export function setupTaylorSim(nSlider, nValue, xRangeSlider, xRangeValue, plotDiv) {
    function taylorSin(x, n) {
        let sum = 0;
        for (let k = 0; 2*k+1 <= n; k++) {
            sum += Math.pow(-1, k) * Math.pow(x, 2*k+1) / factorial(2*k+1);
        }
        return sum;
    }
    function factorial(m) {
        if (m === 0) return 1;
        let res = 1;
        for (let i = 1; i <= m; i++) res *= i;
        return res;
    }
    function updatePlot(n, xRangeIdx) {
        const xRanges = [Math.PI, 2*Math.PI, 3*Math.PI, 4*Math.PI];
        const xLabels = ['π', '2π', '3π', '4π'];
        const xmax = xRanges[xRangeIdx-1];
        const xmin = -xmax;
        const xLabel = xLabels[xRangeIdx-1];
        const xValues = [];
        const sinValues = [];
        const taylorValues = [];
        const steps = 200;
        const dx = (xmax - xmin) / steps;
        for (let i = 0; i <= steps; i++) {
            const x = xmin + i * dx;
            xValues.push(x);
            sinValues.push(Math.sin(x));
            taylorValues.push(taylorSin(x, n));
        }
        const trace1 = { x: xValues, y: sinValues, mode: 'lines', name: 'sin(x)', line: { width: 2, color: '#0077bb' } };
        const trace2 = { x: xValues, y: taylorValues, mode: 'lines', name: `T_${n}(x)`, line: { width: 2, dash: 'dash', color: '#ff4400' } };
        Plotly.newPlot(plotDiv, [trace1, trace2], {
            title: `n = ${n} のテイラー多項式とsin(x)（x軸: ±${xLabel}）` ,
            xaxis: { title: 'x', range: [xmin, xmax] },
            yaxis: { title: '関数値', range: [-1.5, 2] },
            legend: { orientation: 'h', x: 0.5, y: -0.2, xanchor: 'center', yanchor: 'top', font: {size: 16}, itemwidth: 100 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: 'var(--text-color)' }
        }, {responsive: true});
    }
    updatePlot(parseInt(nSlider.value), parseInt(xRangeSlider.value));
    setTimeout(() => { Plotly.Plots.resize(plotDiv); }, 0);
    nSlider.addEventListener('input', () => {
        const n = parseInt(nSlider.value);
        const xRangeIdx = parseInt(xRangeSlider.value);
        nValue.textContent = n;
        updatePlot(n, xRangeIdx);
    });
    xRangeSlider.addEventListener('input', () => {
        const n = parseInt(nSlider.value);
        const xRangeIdx = parseInt(xRangeSlider.value);
        xRangeValue.textContent = xRangeIdx + 'π';
        updatePlot(n, xRangeIdx);
    });
    window.addEventListener('resize', () => {
        const n = parseInt(nSlider.value);
        const xRangeIdx = parseInt(xRangeSlider.value);
        updatePlot(n, xRangeIdx);
    });
} 