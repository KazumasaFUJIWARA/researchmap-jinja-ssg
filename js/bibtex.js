// BibTeX modal. The entry text is generated at build time into data-bibtex;
// the legacy page serialized the whole paper object into an onclick attribute
// and rebuilt the entry in the browser.
document.addEventListener('DOMContentLoaded', function () {
    var popup = document.getElementById('bibtex-popup');
    var overlay = document.getElementById('overlay');
    var content = document.getElementById('bibtex-content');
    if (!popup || !overlay || !content) return;

    function close() {
        popup.style.display = 'none';
        overlay.style.display = 'none';
    }

    document.querySelectorAll('.bibtex-button').forEach(function (button) {
        button.addEventListener('click', function () {
            content.textContent = button.dataset.bibtex || '';
            popup.style.display = 'block';
            overlay.style.display = 'block';
        });
    });

    document.querySelectorAll('.bibtex-popup-close').forEach(function (b) {
        b.addEventListener('click', close);
    });
    overlay.addEventListener('click', close);

    document.querySelectorAll('.copy-button').forEach(function (button) {
        button.addEventListener('click', function () {
            navigator.clipboard.writeText(content.textContent).then(function () {
                var original = button.textContent;
                button.textContent = 'コピーしました！';
                setTimeout(function () { button.textContent = original; }, 2000);
            });
        });
    });
});
