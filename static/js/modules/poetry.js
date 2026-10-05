/**
 * Karuwaki Poetry in Motion Audio Sanctuary Interactions
 * Clipboard link copying and interactive floating feedback toast.
 */

function copyEpisodeLink() {
    const url = window.location.href;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(() => {
            showPoetryToast('Link copied to clipboard!');
        }).catch(() => {
            fallbackCopyTextToClipboard(url);
        });
    } else {
        fallbackCopyTextToClipboard(url);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showPoetryToast('Link copied to clipboard!');
        } else {
            showPoetryToast('Unable to copy automatically');
        }
    } catch (err) {
        showPoetryToast('Unable to copy automatically');
    }
    document.body.removeChild(textArea);
}

function showPoetryToast(message) {
    const toast = document.getElementById('copyToast');
    if (toast) {
        const span = toast.querySelector('span');
        if (span) span.textContent = message;
        toast.classList.add('active');
        setTimeout(() => {
            toast.classList.remove('active');
        }, 3000);
    }
}
