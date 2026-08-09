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
});
