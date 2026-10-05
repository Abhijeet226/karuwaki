/**
 * Karuwaki Web3 Navigation & Shell Interactions
 * Handles navbar scroll effects, reading progress bar, floating back-to-top,
 * desktop dropdown hover, and real-time search autocomplete.
 */

(function() {
    // 1. Navbar scroll effect, Reading progress, and Back to Top
    window.addEventListener('scroll', function() {
        const nav = document.getElementById('mainNav');
        if (nav) {
            if (window.scrollY > 40) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
        }

        // Global Reading Progress Indicator
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = totalHeight > 0 ? (window.scrollY / totalHeight) * 100 : 0;
        const progressBar = document.getElementById('globalReadingProgress');
        if (progressBar) {
            progressBar.style.width = Math.min(Math.max(progress, 0), 100) + '%';
        }

        // Floating Back-to-Top Button Visibility
        const topBtn = document.getElementById('backToTopBtn');
        if (topBtn) {
            if (window.scrollY > 300) {
                topBtn.classList.add('visible');
            } else {
                topBtn.classList.remove('visible');
            }
        }
    }, { passive: true });

    document.addEventListener('DOMContentLoaded', function() {
        // 2. Back-to-Top smooth click
        const topBtn = document.getElementById('backToTopBtn');
        if (topBtn) {
            topBtn.addEventListener('click', function() {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        // 3. Dropdown hover (desktop) + click (mobile)
        document.querySelectorAll('.dropdown-menu').forEach(function(element) {
            element.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        });

        if (window.innerWidth >= 992) {
            const dropdowns = document.querySelectorAll('.dropdown');
            dropdowns.forEach(dropdown => {
                dropdown.addEventListener('mouseenter', function() {
                    const menu = this.querySelector('.dropdown-menu');
                    if (menu) menu.style.display = 'block';
                });
                dropdown.addEventListener('mouseleave', function() {
                    const menu = this.querySelector('.dropdown-menu');
                    if (menu) menu.style.display = 'none';
                });
            });
        }

        // 4. Real-Time Navbar Search Autocomplete
        const searchInput = document.getElementById('query');
        const searchDropdown = document.getElementById('live-search-dropdown');
        let searchTimeout = null;

        if (searchInput && searchDropdown) {
            searchInput.addEventListener('input', function() {
                const q = this.value.trim();
                clearTimeout(searchTimeout);

                if (q.length < 2) {
                    searchDropdown.style.display = 'none';
                    searchDropdown.innerHTML = '';
                    return;
                }

                searchTimeout = setTimeout(function() {
                    fetch('/api/posts/?q=' + encodeURIComponent(q) + '&limit=5')
                        .then(res => res.json())
                        .then(data => {
                            if (data.posts && data.posts.length > 0) {
                                let html = '';
                                data.posts.forEach(p => {
                                    const thumb = p.image_url ? `<img src="${p.image_url}" class="search-thumb" alt="${p.title}" loading="lazy">` : `<div class="search-thumb" style="background:#112; display:flex; align-items:center; justify-content:center;"><i class="bi bi-journal-text"></i></div>`;
                                    html += `
                                        <a href="/blog/${encodeURIComponent(p.slug)}/" class="search-result-item">
                                            ${thumb}
                                            <div class="search-item-info">
                                                <div class="search-item-title">${p.title}</div>
                                                <div class="search-item-meta">
                                                    <span>${p.category.toUpperCase()}</span>
                                                    <span>•</span>
                                                    <span>${p.reading_time} MIN READ</span>
                                                </div>
                                            </div>
                                        </a>
                                    `;
                                });
                                html += `<div style="padding:8px; text-align:center; font-size:11px; font-family:'Big Shoulders Stencil Text', sans-serif; letter-spacing:1px;"><a href="/home/search?query=${encodeURIComponent(q)}" style="color:var(--accent-green);">VIEW ALL RESULTS →</a></div>`;
                                searchDropdown.innerHTML = html;
                                searchDropdown.style.display = 'block';
                            } else {
                                searchDropdown.innerHTML = '<div style="padding:16px; text-align:center; color:rgba(255,255,255,0.6); font-size:12px;">No matching dispatches found.</div>';
                                searchDropdown.style.display = 'block';
                            }
                        })
                        .catch(() => {
                            searchDropdown.style.display = 'none';
                        });
                }, 250);
            });

            document.addEventListener('click', function(e) {
                if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
                    searchDropdown.style.display = 'none';
                }
            });

            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    searchDropdown.style.display = 'none';
                }
            });
        }
    });

    // 4. Global Transmission Toast System
    window.showTransmissionToast = function(message, type = 'info', isHtml = false) {
        let container = document.getElementById('transmission-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'transmission-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `transmission-toast toast-${type}`;

        let icon = '<i class="bi bi-info-circle-fill" style="color:#38bdf8;"></i>';
        if (type === 'success') icon = '<i class="bi bi-check-circle-fill" style="color:var(--accent-green);"></i>';
        if (type === 'error') icon = '<i class="bi bi-exclamation-octagon-fill" style="color:#ff5c5c;"></i>';
        if (type === 'warning') icon = '<i class="bi bi-exclamation-triangle-fill" style="color:#ffb703;"></i>';

        function escapeHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        const allowHtml = isHtml || (typeof message === 'string' && /<button|<a|<span|<b|<strong/i.test(message) && !message.includes('<script'));
        const content = allowHtml ? message : escapeHtml(message);

        toast.innerHTML = `
            <span>${icon}</span>
            <div style="flex:1; line-height:1.4;">${content}</div>
            <button type="button" style="background:none; border:none; color:inherit; opacity:0.6; cursor:pointer; padding:0 4px; font-size:14px;" onclick="this.parentElement.remove()">✕</button>
        `;

        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));

        const duration = allowHtml ? 6500 : 4000;
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    };

    // Listen to HTMX HX-Trigger events
    document.addEventListener('transmissionToast', function(evt) {
        const detail = evt.detail || {};
        const msg = typeof detail === 'string' ? detail : (detail.message || JSON.stringify(detail));
        const type = detail.type || 'info';
        window.showTransmissionToast(msg, type);
    });
})();

