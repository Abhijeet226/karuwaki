/**
 * Karuwaki AI Aided Magazine Interactions
 * Handles mood vector sliders, live badges, and neural resonance async API search.
 */

document.addEventListener('DOMContentLoaded', function() {
    // Sliders Live Badges
    const sliders = [
        { input: document.getElementById('creative'), label: document.getElementById('val-creative') },
        { input: document.getElementById('nostalgic'), label: document.getElementById('val-nostalgic') },
        { input: document.getElementById('learning'), label: document.getElementById('val-learning') },
        { input: document.getElementById('just_for_fun'), label: document.getElementById('val-fun') },
    ];

    sliders.forEach(s => {
        if (s.input && s.label) {
            s.input.addEventListener('input', function() {
                s.label.textContent = this.value;
            });
        }
    });

    // Neural Match Trigger
    const suggestBtn = document.getElementById('suggest-button');
    const btnText = document.getElementById('btn-scan-text');
    const idleViewport = document.getElementById('viewport-idle');
    const resultViewport = document.getElementById('viewport-result');

    const resBadge = document.getElementById('result-badge');
    const resCat = document.getElementById('result-category');
    const resTitle = document.getElementById('result-title');
    const resExcerpt = document.getElementById('result-excerpt');
    const resThumb = document.getElementById('result-thumb');
    const resThumbWrap = document.getElementById('result-thumb-wrap');
    const resLink = document.getElementById('result-link');

    if (suggestBtn) {
        suggestBtn.addEventListener('click', function() {
            const creativeVal = document.getElementById('creative')?.value || 0;
            const nostalgicVal = document.getElementById('nostalgic')?.value || 0;
            const learningVal = document.getElementById('learning')?.value || 0;
            const funVal = document.getElementById('just_for_fun')?.value || 0;

            if (btnText) btnText.textContent = 'SCANNING ARCHIVES...';
            suggestBtn.style.opacity = '0.75';

            const url = `/api/ai-magazine/suggest/?creative=${creativeVal}&nostalgic=${nostalgicVal}&learning=${learningVal}&just_for_fun=${funVal}`;

            fetch(url)
                .then(res => res.json())
                .then(data => {
                    if (btnText) btnText.textContent = 'RE-SCAN VECTORS';
                    suggestBtn.style.opacity = '1';

                    if (data.article) {
                        if (resBadge) resBadge.textContent = `${data.match_percentage}% NEURAL RESONANCE`;
                        if (resCat) resCat.textContent = data.mood_label.toUpperCase();
                        if (resTitle) resTitle.textContent = data.article.title;
                        if (resExcerpt) resExcerpt.textContent = data.article.excerpt;

                        if (resThumb) {
                            if (data.article.image_url) {
                                resThumb.src = data.article.image_url;
                                resThumbWrap.style.display = 'block';
                            } else {
                                resThumbWrap.style.display = 'none';
                            }
                        }

                        if (resLink) {
                            resLink.href = data.article.url;
                            resLink.textContent = `READ DISPATCH (${data.article.reading_time} MIN) →`;
                        }

                        // Symmetrically swap idle state with result in the exact same viewport
                        if (idleViewport) idleViewport.style.display = 'none';
                        if (resultViewport) resultViewport.classList.add('show');
                    }
                })
                .catch(err => {
                    if (btnText) btnText.textContent = 'INITIALIZE NEURAL SCAN';
                    suggestBtn.style.opacity = '1';
                    console.error(err);
                });
        });
    }
});
