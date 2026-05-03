// History tab redirects to Progress > Sessions
window.renderTabHistory = function(container) {
    if (window.pgSt) window.pgSt.seg = 'sessions';
    if (window.renderTabProgress) window.renderTabProgress(container);
};
