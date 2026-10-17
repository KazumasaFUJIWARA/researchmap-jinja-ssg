// Tab switching, ported from the inline setupTabs() variants in the legacy
// pages. Those differed only in which data-* attribute named the target and
// which class marked a section, so both are resolved generically here.
document.addEventListener('DOMContentLoaded', function () {
    var SECTIONS = '.tab-section, .article-section, .conference-section';
    var tabs = document.querySelectorAll('.conference-tab');

    function targetOf(tab) {
        var d = tab.dataset;
        return d.tabType || d.articleType || d.lectureType;
    }

    tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            tabs.forEach(function (t) { t.classList.remove('active'); });
            document.querySelectorAll(SECTIONS).forEach(function (s) { s.classList.remove('active'); });
            tab.classList.add('active');
            var section = document.getElementById(targetOf(tab) + '-section');
            if (section) section.classList.add('active');
        });
    });
});
