/**
 * Karuwaki Web3 Blog Archive Interactions (HTMX Enhanced)
 * Handles input enhancements and HTMX request events.
 */

document.addEventListener('DOMContentLoaded', function() {
    const filterInput = document.getElementById('archiveFilterInput');

    if (filterInput) {
        // Clear search on Escape key
        filterInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                this.value = '';
                htmx.trigger(this, 'search');
            }
        });
    }
});
