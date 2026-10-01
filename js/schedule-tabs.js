// The schedule page names its panes "<key>-tab" rather than "<key>-section",
// so it keeps its own switcher instead of using tabs.js.
document.addEventListener('DOMContentLoaded', function () {
    var buttons = document.querySelectorAll('.conference-tab');
    var panes = document.querySelectorAll('.tab-section');
    buttons.forEach(function (button) {
        button.addEventListener('click', function () {
            buttons.forEach(function (b) { b.classList.remove('active'); });
            panes.forEach(function (p) { p.classList.remove('active'); });
            button.classList.add('active');
            var pane = document.getElementById(button.dataset.tab + '-tab');
            if (pane) pane.classList.add('active');
        });
    });

    document.querySelectorAll('.copy-button[data-copy]').forEach(function (button) {
        button.addEventListener('click', function () {
            navigator.clipboard.writeText(button.dataset.copy).then(function () {
                alert('コピーしました');
            });
        });
    });

    var DEFAULT_HEIGHT = 800;
    var STORAGE_KEY = 'schedule-calendar-height';
    var slider = document.getElementById('calendar-height');
    var valueLabel = document.getElementById('calendar-height-value');
    var resetButton = document.getElementById('calendar-height-reset');
    var iframe = document.querySelector('#calendar-iframe iframe');
    var frameBox = document.getElementById('calendar-iframe');

    function clampHeight(raw) {
        var n = parseInt(raw, 10);
        if (!isFinite(n)) return DEFAULT_HEIGHT;
        if (slider) {
            var min = parseInt(slider.min, 10) || 400;
            var max = parseInt(slider.max, 10) || 1400;
            return Math.min(max, Math.max(min, n));
        }
        return n;
    }

    function applyHeight(px) {
        var height = clampHeight(px);
        if (iframe) iframe.height = String(height);
        if (frameBox) frameBox.style.setProperty('--calendar-height', height + 'px');
        if (slider) slider.value = String(height);
        if (valueLabel) valueLabel.textContent = height + 'px';
        return height;
    }

    if (iframe && slider) {
        var stored = null;
        try { stored = localStorage.getItem(STORAGE_KEY); } catch (_) {}
        applyHeight(stored || DEFAULT_HEIGHT);

        slider.addEventListener('input', function () {
            var height = applyHeight(slider.value);
            try { localStorage.setItem(STORAGE_KEY, String(height)); } catch (_) {}
        });

        if (resetButton) {
            resetButton.addEventListener('click', function () {
                applyHeight(DEFAULT_HEIGHT);
                try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
            });
        }
    }
});
