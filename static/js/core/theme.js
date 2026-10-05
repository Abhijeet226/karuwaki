/**
 * Karuwaki Web3 Theme Management System
 * Persists dark/light/system theme preferences in localStorage and dispatches
 * the 'kspeaksThemeChanged' custom event for real-time reactivity.
 */

(function() {
    const themeBtns = document.querySelectorAll('.theme-option-btn');
    const activeIcon = document.getElementById('themeActiveIcon');

    function updateThemeUI(currentSetting, appliedTheme) {
        document.querySelectorAll('.theme-check').forEach(el => {
            if (el.getAttribute('data-check-theme') === currentSetting) {
                el.classList.remove('d-none');
            } else {
                el.classList.add('d-none');
            }
        });

        document.querySelectorAll('.theme-option-btn').forEach(btn => {
            if (btn.getAttribute('data-theme-value') === currentSetting) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (activeIcon) {
            if (currentSetting === 'system') {
                activeIcon.className = 'bi bi-laptop theme-icon-active text-secondary';
            } else if (appliedTheme === 'light') {
                activeIcon.className = 'bi bi-sun-fill theme-icon-active text-warning';
            } else {
                activeIcon.className = 'bi bi-moon-stars-fill theme-icon-active text-info';
            }
        }
    }

    function setTheme(setting) {
        let applied = setting;
        if (setting === 'system') {
            applied = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }
        document.documentElement.setAttribute('data-theme', applied);
        document.documentElement.setAttribute('data-bs-theme', applied);
        localStorage.setItem('kspeaks-theme', setting);
        updateThemeUI(setting, applied);
        window.dispatchEvent(new CustomEvent('kspeaksThemeChanged', { detail: { theme: applied } }));
    }

    document.addEventListener('DOMContentLoaded', () => {
        const savedSetting = localStorage.getItem('kspeaks-theme') || 'dark';
        const currentApplied = document.documentElement.getAttribute('data-theme') || 'dark';
        updateThemeUI(savedSetting, currentApplied);

        document.querySelectorAll('.theme-option-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const chosen = this.getAttribute('data-theme-value');
                setTheme(chosen);
            });
        });

        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
            if (localStorage.getItem('kspeaks-theme') === 'system') {
                setTheme('system');
            }
        });
    });
})();
