/**
 * Karuwaki User Profile Interactions
 * Profile tabs switching, direct URL hash anchor handling, and AJAX bookmark removal.
 */

document.addEventListener('DOMContentLoaded', function() {
    // Tab switching
    const tabBtns = document.querySelectorAll('.profile-tab-btn');
    const tabPanes = document.querySelectorAll('.profile-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const target = this.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            this.classList.add('active');
            const pane = document.getElementById(target);
            if (pane) pane.classList.add('active');
        });
    });

    // Handle direct anchor links e.g. #saved
    if (window.location.hash === '#saved') {
        const savedBtn = document.getElementById('saved-tab-btn');
        if (savedBtn) savedBtn.click();
    }

    // Ajax remove bookmark
    document.querySelectorAll('.remove-bookmark-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const slug = this.getAttribute('data-slug');
            const cardId = this.getAttribute('data-id');
            const card = document.getElementById('card-post-' + cardId);

            fetch('/post/save/' + encodeURIComponent(slug) + '/', {
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            })
            .then(res => res.json())
            .then(data => {
                if (card) {
                    card.style.transition = 'opacity 0.3s, transform 0.3s';
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.9)';
                    setTimeout(() => card.remove(), 300);
                }
            });
        });
    });
});
