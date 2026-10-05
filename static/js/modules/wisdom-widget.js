/**
 * Karuwaki Wisdom AI Floating Assistant Module
 * Handles modal open/close, quick chips, query submission, and Gemini API fetch.
 * Includes Ctrl+K shortcut, rich markdown rendering, one-click copy, and conversation reset.
 */

(function() {
    const launcher = document.getElementById('karuWisdomLauncher');
    const modal = document.getElementById('karuWisdomModal');
    const closeBtn = document.getElementById('karuModalCloseBtn');
    const resetBtn = document.getElementById('karuResetBtn');
    const copyBtn = document.getElementById('karuCopyBtn');
    const form = document.getElementById('karuQueryForm');
    const input = document.getElementById('karuQueryInput');
    const output = document.getElementById('karuOutputBox');
    const sendBtn = document.getElementById('karuSendBtn');
    const sourcePill = document.getElementById('karuSourcePill');
    const sourceText = document.getElementById('karuSourceText');
    const chips = document.querySelectorAll('.karu-chip-btn');

    if (!launcher || !modal) return;

    const DEFAULT_GREETING = output ? output.innerHTML : '';

    let activeAbortController = null;
    let requestTimeoutId = null;

    function openModal() {
        modal.classList.add('active');
        launcher.setAttribute('aria-expanded', 'true');
        setTimeout(() => input && input.focus(), 150);
    }

    function closeModal() {
        modal.classList.remove('active');
        launcher.setAttribute('aria-expanded', 'false');
        if (typeof launcher.focus === 'function') {
            launcher.focus();
        }
    }

    launcher.addEventListener('click', openModal);
    launcher.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal();
        }
    });

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Global keyboard shortcuts: Esc to close, Ctrl+K or Cmd+K to toggle
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (modal.classList.contains('active')) {
                closeModal();
            } else {
                openModal();
            }
        }
    });

    // Reset conversation action
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (output) {
                output.innerHTML = DEFAULT_GREETING;
                output.scrollTop = 0;
            }
            if (input) input.value = '';
            if (sourcePill) sourcePill.style.display = 'none';
            chips.forEach(c => c.classList.remove('active'));
            if (input) input.focus();
        });
    }

    // One-click copy answer to clipboard
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            if (!output) return;
            const clone = output.cloneNode(true);
            const dispatches = clone.querySelector('.karu-dispatches-card');
            if (dispatches) dispatches.remove();
            const textToCopy = clone.innerText.trim();

            if (!textToCopy) return;

            try {
                await navigator.clipboard.writeText(textToCopy);
                copyBtn.classList.add('copied');
                copyBtn.innerHTML = '<i class="bi bi-check2"></i> <span>Copied!</span>';
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> <span>Copy</span>';
                }, 2000);
            } catch (err) {
                console.warn('Clipboard write error:', err);
            }
        });
    }

    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const query = chip.getAttribute('data-query');
            if (input) input.value = query;
            executeWisdomQuery(query);
        });
    });

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = input.value.trim();
            if (query) {
                chips.forEach(c => c.classList.remove('active'));
                executeWisdomQuery(query);
            }
        });
    }

    // Enhanced Markdown formatter helper
    function renderMarkdownText(raw) {
        if (!raw) return '';
        let text = raw
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            // Code blocks
            .replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/g, '<pre class="karu-code-block"><code class="karu-code">$2</code></pre>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code class="karu-code">$1</code>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="karu-inline-link" target="_blank" rel="noopener">$1 <i class="bi bi-box-arrow-up-right small"></i></a>')
            // Headings
            .replace(/^### (.*$)/gim, '<h4 class="karu-md-heading">$1</h4>')
            .replace(/^## (.*$)/gim, '<h4 class="karu-md-heading">$1</h4>')
            // Bold & Italics
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Blockquotes
            .replace(/^&gt; (.*$)/gim, '<blockquote>$1</blockquote>')
            // List items
            .replace(/^\s*[-*]\s+(.*$)/gim, '<li class="karu-md-li">$1</li>')
            .replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="karu-md-li"><strong>$1.</strong> $2</li>')
            // Linebreaks
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');

        // Wrap list items in ul if present
        text = text.replace(/(<li class="karu-md-li">.*?<\/li>)+/g, '<ul class="karu-md-list">$&</ul>');
        return text;
    }

    function renderRelatedDispatches(posts) {
        if (!posts || !posts.length) return '';
        let html = `
            <div class="karu-dispatches-card mt-3">
                <div class="karu-dispatches-heading">
                    <i class="bi bi-journal-bookmark-fill text-success"></i>
                    <span>Related Editorial Dispatches</span>
                </div>
                <div class="karu-dispatches-list">
        `;
        posts.forEach(p => {
            html += `
                <a href="${p.url}" class="karu-dispatch-item" title="Read '${p.title}'">
                    <div class="karu-dispatch-header">
                        <span class="karu-dispatch-cat">${p.category}</span>
                        <span class="karu-dispatch-time"><i class="bi bi-clock"></i> ${p.reading_time} min</span>
                    </div>
                    <div class="karu-dispatch-title">${p.title}</div>
                    ${p.excerpt ? `<div class="karu-dispatch-excerpt">${p.excerpt}</div>` : ''}
                    <div class="karu-dispatch-cta">Read Dispatch <i class="bi bi-arrow-right-short"></i></div>
                </a>
            `;
        });
        html += `
                </div>
            </div>
        `;
        return html;
    }

    async function executeWisdomQuery(query) {
        if (!query) return;

        // Abort previous in-flight request if user triggered another query
        if (activeAbortController) {
            activeAbortController.abort();
            clearTimeout(requestTimeoutId);
        }

        activeAbortController = new AbortController();
        const signal = activeAbortController.signal;
        let didTimeout = false;

        requestTimeoutId = setTimeout(() => {
            didTimeout = true;
            if (activeAbortController) {
                activeAbortController.abort();
            }
        }, 15000);

        output.innerHTML = '<span class="text-muted"><i class="bi bi-arrow-repeat spin"></i> Consulting cosmic archives & Karu-Wisdom...</span>';
        output.scrollTop = 0;
        if (sourcePill) sourcePill.style.display = 'none';
        if (sendBtn) sendBtn.disabled = true;

        try {
            const res = await fetch('/api/karu-wisdom/?query=' + encodeURIComponent(query), { signal });
            clearTimeout(requestTimeoutId);
            const data = await res.json();

            if (res.status === 429) {
                output.innerHTML = `<span class="text-warning"><i class="bi bi-shield-exclamation me-1"></i> ${data.answer || 'Rate limit reached. Please wait a moment.'}</span>`;
                return;
            }

            if (data && data.answer) {
                let formatted = renderMarkdownText(data.answer);
                if (data.related_posts && data.related_posts.length > 0) {
                    formatted += renderRelatedDispatches(data.related_posts);
                }
                output.innerHTML = formatted;
                output.scrollTop = 0;
                if (sourcePill && sourceText) {
                    sourcePill.style.display = 'flex';
                    const src = data.source && data.source.includes('gemini-api') ? 'Google Gemini AI (Live Model)' : 'Vedic & Historical Archives';
                    sourceText.textContent = 'Source: ' + src;
                }
            } else {
                output.innerHTML = '<span class="text-danger">Unable to retrieve response. Please try another question.</span>';
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                if (didTimeout) {
                    output.innerHTML = '<span class="text-warning"><i class="bi bi-hourglass-split me-1"></i> Inquiry timed out (15s). The cosmic archives or AI model may be experiencing high demand. Please try again.</span>';
                }
                return;
            }
            output.innerHTML = '<span class="text-danger">Network error connecting to Karu-Wisdom service.</span>';
        } finally {
            clearTimeout(requestTimeoutId);
            if (sendBtn) sendBtn.disabled = false;
        }
    }

    // Global Deeplink Trigger: any button or link with [data-karu-ask]
    document.addEventListener('click', function(e) {
        const askTrigger = e.target.closest('[data-karu-ask]');
        if (askTrigger) {
            e.preventDefault();
            const q = askTrigger.getAttribute('data-karu-ask');
            if (q) {
                openModal();
                if (input) input.value = q;
                executeWisdomQuery(q);
            }
        }
    });

    // Auto-trigger if URL contains ?ask_wisdom=... or ?ask=...
    try {
        const params = new URLSearchParams(window.location.search);
        const autoQuery = params.get('ask_wisdom') || params.get('ask');
        if (autoQuery) {
            setTimeout(() => {
                openModal();
                if (input) input.value = autoQuery;
                executeWisdomQuery(autoQuery);
            }, 300);
        }
    } catch (e) {}

    // Public window helper
    window.openKaruWisdom = function(query) {
        openModal();
        if (query) {
            if (input) input.value = query;
            executeWisdomQuery(query);
        }
    };
})();
