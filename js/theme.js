// Theme toggle. The button label is rendered for light mode at build time, so
// fix it up on load before wiring the click handler.
(function () {
    var labels = document.documentElement.lang === 'ja'
        ? { dark: 'ライトモード ☀️', light: 'ダークモード 🌙' }
        : { dark: 'Light Mode ☀️', light: 'Dark Mode 🌙' };

    function label(isDark) { return isDark ? labels.dark : labels.light; }

    document.addEventListener('DOMContentLoaded', function () {
        var button = document.querySelector('.theme-toggle');
        if (!button) return;
        button.textContent = label(document.documentElement.classList.contains('dark'));
        button.addEventListener('click', function () {
            var isDark = document.documentElement.classList.toggle('dark');
            try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch (_) {}
            button.textContent = label(isDark);
        });
    });
})();
