/**
 * KSPEAK$ WEB3.0 - PWA & OFFLINE VAULT CONTROLLER (2026)
 * Handles Service Worker registration, native app install prompts,
 * online/offline network detection, and IndexedDB local article storage.
 */

(function() {
    'use strict';

    // ── 1. REGISTER SERVICE WORKER ──
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then(reg => {
                    console.log('[KSPEAK$ PWA] ServiceWorker registered with scope:', reg.scope);
                })
                .catch(err => {
                    console.warn('[KSPEAK$ PWA] ServiceWorker registration failed:', err);
                });
        });
    }

    // ── 2. NATIVE PWA INSTALL PROMPT ──
    let deferredPrompt = null;
    const installBtns = document.querySelectorAll('.btn-pwa-install');

    window.addEventListener('beforeinstallprompt', e => {
        // Prevent default browser mini-infobar
        e.preventDefault();
        deferredPrompt = e;

        // Reveal install buttons in navbar and profile
        installBtns.forEach(btn => {
            btn.style.display = 'inline-flex';
            btn.addEventListener('click', async () => {
                if (!deferredPrompt) return;
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log('[KSPEAK$ PWA] Install outcome:', outcome);
                deferredPrompt = null;
                installBtns.forEach(b => b.style.display = 'none');
            });
        });
    });

    window.addEventListener('appinstalled', () => {
        console.log('[KSPEAK$ PWA] Application installed successfully!');
        installBtns.forEach(btn => btn.style.display = 'none');
    });

    // ── 3. ONLINE / OFFLINE CONNECTIVITY PILL ──
    function createConnectivityToast() {
        if (document.getElementById('network-status-toast')) return;

        const toast = document.createElement('div');
        toast.id = 'network-status-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 24px;
            padding: 10px 18px;
            border-radius: 50px;
            font-family: var(--font-sans);
            font-weight: 700;
            font-size: 12px;
            letter-spacing: 0.8px;
            z-index: 9999;
            box-shadow: 0 10px 30px rgba(0,0,0,0.8);
            display: none;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(toast);
    }

    function showConnectivity(isOnline) {
        createConnectivityToast();
        const toast = document.getElementById('network-status-toast');
        if (!toast) return;

        if (isOnline) {
            toast.style.background = 'rgba(193, 255, 114, 0.15)';
            toast.style.border = '1px solid var(--accent-green, #C1FF72)';
            toast.style.color = '#fff';
            toast.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#C1FF72;box-shadow:0 0 8px #C1FF72;"></span> ONLINE · CONNECTED TO ARCHIVE';
            toast.style.display = 'inline-flex';
            setTimeout(() => { toast.style.display = 'none'; }, 3500);
        } else {
            toast.style.background = 'rgba(255, 166, 77, 0.2)';
            toast.style.border = '1px solid #ffa64d';
            toast.style.color = '#ffa64d';
            toast.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#ffa64d;box-shadow:0 0 8px #ffa64d;"></span> OFFLINE · LOCAL VAULT ACTIVE';
            toast.style.display = 'inline-flex';
        }
    }

    window.addEventListener('online', () => showConnectivity(true));
    window.addEventListener('offline', () => showConnectivity(false));

    // ── 4. INDEXEDDB OFFLINE VAULT ENGINE ──
    const DB_NAME = 'KaruwakiPWA';
    const DB_VERSION = 1;
    const STORE_NAME = 'dispatches';

    function openVaultDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'slug' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    // Auto-cache current article into IndexedDB if on an article page
    async function cacheCurrentArticle() {
        const articleHeader = document.querySelector('.post-header-wrap');
        if (!articleHeader) return;

        const titleEl = document.querySelector('.post-title');
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts[0] !== 'blog' || pathParts.length < 2) return;

        const slug = decodeURIComponent(pathParts[1]);
        const title = titleEl ? titleEl.textContent.trim() : slug;
        const metaCategory = document.querySelector('.post-breadcrumbs a:last-child');
        const category = metaCategory ? metaCategory.textContent.trim() : 'DISPATCH';

        const articleData = {
            slug: slug,
            title: title,
            category: category,
            url: window.location.pathname,
            cachedAt: new Date().toISOString()
        };

        try {
            const db = await openVaultDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(articleData);
            console.log('[KSPEAK$ PWA] Cached article into Offline Vault:', slug);
        } catch (err) {
            console.warn('[KSPEAK$ PWA] Failed to cache article into IndexedDB:', err);
        }
    }

    // Populate offline vault list if on /offline/
    async function renderOfflineVault() {
        const vaultContainer = document.getElementById('offline-vault-list');
        const emptyNotice = document.getElementById('empty-vault-notice');
        if (!vaultContainer) return;

        try {
            const db = await openVaultDB();
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).getAll();

            req.onsuccess = () => {
                const articles = req.result || [];
                if (articles.length === 0) {
                    if (emptyNotice) emptyNotice.style.display = 'block';
                    vaultContainer.innerHTML = '';
                    return;
                }

                if (emptyNotice) emptyNotice.style.display = 'none';
                let html = '';
                articles.forEach(art => {
                    html += `
                        <div class="vault-card">
                            <span class="vault-card-cat">${art.category.toUpperCase()}</span>
                            <h4 class="vault-card-title">${art.title}</h4>
                            <a href="${art.url}" class="vault-read-btn">
                                READ OFFLINE DISPATCH →
                            </a>
                        </div>
                    `;
                });
                vaultContainer.innerHTML = html;
            };
        } catch (err) {
            console.warn('[KSPEAK$ PWA] Error loading offline vault articles:', err);
        }
    }

    // Run on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        cacheCurrentArticle();
        renderOfflineVault();
    });
})();
