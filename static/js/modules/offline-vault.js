/**
 * Karuwaki PWA Offline Vault Interactions
 * Network detection, reconnect retry button, and auto-reload on reconnection.
 */

let retryTimeout = null;

function checkNetworkAndReload() {
    const btn = document.getElementById('btn-retry-network');
    const statusPill = document.getElementById('network-status-pill');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" style="width:12px; height:12px; border-width:2px;"></span> SCANNING FREQUENCY...';
    }

    setTimeout(() => {
        if (navigator.onLine) {
            window.location.reload();
        } else {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> ATTEMPT RECONNECTION';
            }
            if (statusPill) {
                statusPill.classList.remove('d-none');
                if (retryTimeout) clearTimeout(retryTimeout);
                retryTimeout = setTimeout(() => {
                    statusPill.classList.add('d-none');
                }, 4000);
            }
        }
    }, 600);
}

// Auto-reload when network reconnects
window.addEventListener('online', function() {
    window.location.reload();
});
