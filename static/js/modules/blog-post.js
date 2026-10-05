/**
 * Karuwaki Speaks Article & Dispatch Interactions Module
 * Features:
 * - Dynamic Reading Progress Indicator & Reading Time Estimator
 * - Audio Dispatch Narrator (Web Speech API with sentence chunking & Odia support)
 * - Auto-generated Floating Table of Contents (TOC) with IntersectionObserver
 * - Reading Position Memory (localStorage resume prompt)
 * - Native Web Share & Fallback Clipboard Copy
 * - Medium-style Highlight-to-Quote Toolbar (popover on text selection)
 * - Live Transmission Sync (tab switch & polling)
 * - Vibe Matrix Reactions (instant optimistic count + server sync)
 * - Resonate (like) Comment
 * - Non-obstructive Transmission Toast Notifications
 * - Inline Comment Edit & Inline Delete Confirmation
 * - AJAX Comment and Reply Submissions
 */

// Reading Progress Indicator
window.addEventListener('scroll', function() {
    const docElem = document.documentElement;
    const docBody = document.body;
    const scrollTop = docElem.scrollTop || docBody.scrollTop;
    const scrollBottom = (docElem.scrollHeight || docBody.scrollHeight) - window.innerHeight;
    const scrollPercent = scrollBottom > 0 ? (scrollTop / scrollBottom) * 100 : 0;
    const progressBar = document.getElementById('reading-progress-bar');
    if (progressBar) {
        progressBar.style.width = scrollPercent + '%';
    }
});

// Dynamic Reading Time Estimator
document.addEventListener('DOMContentLoaded', function() {
    const prose = document.querySelector('.article-prose');
    if (prose) {
        const text = prose.innerText || prose.textContent || '';
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        if (words > 0) {
            const calculatedMins = Math.max(1, Math.ceil(words / 200));
            const metaTime = document.querySelector('.post-meta-strip span:nth-child(3)');
            if (metaTime) {
                metaTime.innerHTML = `<i class="bi bi-clock"></i> ${calculatedMins} MIN READ`;
            }
        }
        // Graceful handling for broken legacy prose images
        prose.querySelectorAll('img').forEach(img => {
            img.addEventListener('error', function() {
                this.style.display = 'none';
            });
            if (img.complete && img.naturalWidth === 0) {
                img.style.display = 'none';
            }
        });
    }
});

// ── AUDIO DISPATCH NARRATOR (Web Speech API) ──
let speechSynth = window.speechSynthesis;
let speechUtterancesQueue = [];
let currentUtteranceIndex = 0;
let isSpeaking = false;
let isPaused = false;
let currentPlaybackRate = 1.0;
let activeVoice = null;

function loadAvailableVoices() {
    if (!speechSynth) return;
    const voices = speechSynth.getVoices();
    if (voices && voices.length > 0) {
        activeVoice = voices.find(v => v.lang && v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Premium') || v.name.includes('English')))
            || voices.find(v => v.lang && v.lang.startsWith('en'))
            || voices[0];
    }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    loadAvailableVoices();
    window.speechSynthesis.onvoiceschanged = loadAvailableVoices;
}

function cleanTextForSpeech(text) {
    return text
        .replace(/https?:\/\/\S+/g, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/[#*_~`>]/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function splitTextIntoSentences(text) {
    // Break into natural speech sentences under 160 characters
    const rawSentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];
    const chunks = [];
    rawSentences.forEach(s => {
        const trimmed = s.trim();
        if (!trimmed) return;
        if (trimmed.length > 160) {
            const subChunks = trimmed.match(/[^,;:]+[,;:]+|[^,;:]+$/g) || [trimmed];
            subChunks.forEach(sub => {
                const subTrimmed = sub.trim();
                if (subTrimmed) chunks.push(subTrimmed);
            });
        } else {
            chunks.push(trimmed);
        }
    });
    return chunks;
}

function speakNextChunk() {
    if (!isSpeaking || isPaused) return;

    if (currentUtteranceIndex >= speechUtterancesQueue.length) {
        stopAudioNarrator();
        showTransmissionToast('Dispatch narration completed.', 'success');
        return;
    }

    const chunkText = speechUtterancesQueue[currentUtteranceIndex];
    const utterance = new SpeechSynthesisUtterance(chunkText);
    utterance.rate = currentPlaybackRate;
    utterance.pitch = 1.0;

    // Auto-detect Odia Unicode characters (\u0B00-\u0B7F)
    const isOdia = /[\u0B00-\u0B7F]/.test(chunkText);
    utterance.lang = isOdia ? 'or-IN' : (activeVoice && activeVoice.lang ? activeVoice.lang : 'en-US');
    if (isOdia && speechSynth) {
        const odiaVoice = speechSynth.getVoices().find(v => v.lang === 'or-IN' || v.lang.startsWith('or') || v.lang === 'ory-IN' || v.lang.startsWith('hi'));
        if (odiaVoice) utterance.voice = odiaVoice;
    } else if (activeVoice) {
        utterance.voice = activeVoice;
    }

    // Retain global reference so browser garbage collection doesn't stop speech prematurely
    window._currentAudioUtterance = utterance;

    utterance.onstart = function() {
        updateAudioUI('playing');
    };

    utterance.onend = function() {
        currentUtteranceIndex++;
        speakNextChunk();
    };

    utterance.onerror = function(e) {
        console.warn('Speech synthesis chunk warning/error:', e);
        if (e.error === 'interrupted' || e.error === 'canceled') {
            return;
        }
        currentUtteranceIndex++;
        speakNextChunk();
    };

    speechSynth.speak(utterance);

    // Linux & Chrome fix: resume if paused in background
    if (speechSynth.paused) {
        speechSynth.resume();
    }
}

// ── NATIVE SERVER AUDIO & HYBRID TTS CONTROLS ──
let nativeAudio = null;
let isScrubbing = false;

function formatAudioTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function initNativeAudio(streamUrl) {
    if (nativeAudio) return nativeAudio;
    nativeAudio = new Audio();
    nativeAudio.src = streamUrl;
    nativeAudio.preload = 'metadata';
    nativeAudio.playbackRate = currentPlaybackRate;

    const timelineWrap = document.getElementById('audioTimelineWrap');
    const timeDisplay = document.getElementById('audioTimeDisplay');
    const scrubber = document.getElementById('audioScrubber');
    if (timelineWrap) timelineWrap.classList.remove('d-none');
    if (timeDisplay) timeDisplay.classList.remove('d-none');

    nativeAudio.addEventListener('timeupdate', () => {
        if (!isScrubbing && scrubber && nativeAudio.duration) {
            const percent = (nativeAudio.currentTime / nativeAudio.duration) * 100;
            scrubber.value = percent;
            if (timeDisplay) {
                timeDisplay.textContent = `${formatAudioTime(nativeAudio.currentTime)} / ${formatAudioTime(nativeAudio.duration)}`;
            }
        }
    });

    nativeAudio.addEventListener('loadedmetadata', () => {
        if (timeDisplay && nativeAudio.duration) {
            timeDisplay.textContent = `0:00 / ${formatAudioTime(nativeAudio.duration)}`;
        }
    });

    nativeAudio.addEventListener('ended', () => {
        isSpeaking = false;
        isPaused = false;
        if (scrubber) scrubber.value = 0;
        updateAudioUI('stopped');
    });

    nativeAudio.addEventListener('error', (e) => {
        console.warn('Native server audio stream error, falling back to Web Speech API:', e);
        nativeAudio = null;
        if (timelineWrap) timelineWrap.classList.add('d-none');
        startWebSpeechNarration();
    });

    return nativeAudio;
}

window.onAudioScrubInput = function(val) {
    isScrubbing = true;
    if (nativeAudio && nativeAudio.duration) {
        const targetTime = (val / 100) * nativeAudio.duration;
        const timeDisplay = document.getElementById('audioTimeDisplay');
        if (timeDisplay) {
            timeDisplay.textContent = `${formatAudioTime(targetTime)} / ${formatAudioTime(nativeAudio.duration)}`;
        }
    }
};

window.onAudioScrubChange = function(val) {
    if (nativeAudio && nativeAudio.duration) {
        const targetTime = (val / 100) * nativeAudio.duration;
        nativeAudio.currentTime = targetTime;
    }
    isScrubbing = false;
};

function toggleAudioNarrator() {
    const cfg = window.KSPEAKS_POST_CONFIG || {};

    // 1. Native Server-Generated Neural Audio Stream (Neerja Indian English)
    if (cfg.hasServerAudio && cfg.audioStreamUrl) {
        const audio = initNativeAudio(cfg.audioStreamUrl);
        if (audio.paused) {
            audio.play().then(() => {
                isSpeaking = true;
                isPaused = false;
                updateAudioUI('playing');
            }).catch(err => {
                console.warn('Native playback blocked or failed, falling back to Web Speech API:', err);
                startWebSpeechNarration();
            });
        } else {
            audio.pause();
            isSpeaking = true;
            isPaused = true;
            updateAudioUI('paused');
        }
        return;
    }

    // 2. Client-side Web Speech API Fallback
    startWebSpeechNarration();
}

function startWebSpeechNarration() {
    if (!('speechSynthesis' in window)) {
        showTransmissionToast('Audio playback is not supported in this browser.', 'warning');
        return;
    }

    if (!activeVoice) {
        loadAvailableVoices();
    }

    if (!isSpeaking && !isPaused) {
        speechSynth.cancel();
        if (speechSynth.paused) speechSynth.resume();

        const prose = document.querySelector('.article-prose');
        if (!prose) return;
        const rawText = prose.innerText || prose.textContent || '';
        const cleanText = cleanTextForSpeech(rawText);
        if (!cleanText) {
            showTransmissionToast('No readable text found for audio dispatch.', 'warning');
            return;
        }

        const cfg = window.KSPEAKS_POST_CONFIG || {};
        const introText = `Dispatch: ${cfg.postTitle || ""}. By ${cfg.postAuthor || ""}.`;
        speechUtterancesQueue = [introText].concat(splitTextIntoSentences(cleanText));
        currentUtteranceIndex = 0;
        isSpeaking = true;
        isPaused = false;
        updateAudioUI('playing');

        speakNextChunk();
        showTransmissionToast('Playing audio dispatch.', 'info');
    } else if (isSpeaking && !isPaused) {
        speechSynth.pause();
        isPaused = true;
        updateAudioUI('paused');
    } else if (isPaused) {
        speechSynth.resume();
        isPaused = false;
        updateAudioUI('playing');
        setTimeout(() => {
            if (isSpeaking && !speechSynth.speaking) {
                speakNextChunk();
            }
        }, 200);
    }
}

function stopAudioNarrator() {
    if (nativeAudio) {
        nativeAudio.pause();
        nativeAudio.currentTime = 0;
    }
    if (speechSynth) {
        speechSynth.cancel();
    }
    isSpeaking = false;
    isPaused = false;
    currentUtteranceIndex = 0;
    speechUtterancesQueue = [];
    window._currentAudioUtterance = null;
    const scrubber = document.getElementById('audioScrubber');
    if (scrubber) scrubber.value = 0;
    updateAudioUI('stopped');
}

function cycleAudioSpeed() {
    const rates = [0.75, 1.0, 1.25, 1.5, 2.0];
    let nextIdx = (rates.indexOf(currentPlaybackRate) + 1) % rates.length;
    currentPlaybackRate = rates[nextIdx];
    
    const speedBtn = document.getElementById('audioSpeedBtn');
    if (speedBtn) speedBtn.textContent = currentPlaybackRate.toFixed(1) + 'x';

    if (nativeAudio) {
        nativeAudio.playbackRate = currentPlaybackRate;
    } else if (isSpeaking && !isPaused) {
        speechSynth.cancel();
        speakNextChunk();
    }
}

function updateAudioUI(state) {
    const playIcon = document.getElementById('audioPlayIcon');
    const stopBtn = document.getElementById('audioStopBtn');
    const wave = document.getElementById('soundWaveAnim');
    const statusText = document.getElementById('audioStatusText');
    const cfg = window.KSPEAKS_POST_CONFIG || {};

    if (state === 'playing') {
        if (playIcon) playIcon.className = 'bi bi-pause-fill';
        if (stopBtn) stopBtn.classList.remove('d-none');
        if (wave) wave.classList.remove('d-none');
        if (cfg.hasServerAudio) {
            if (statusText) statusText.textContent = 'Transmitting Indic Neural Dispatch...';
        } else {
            const total = speechUtterancesQueue.length;
            const current = Math.min(currentUtteranceIndex + 1, total);
            if (statusText) statusText.textContent = total > 0 ? `Transmitting narration (${current}/${total})...` : 'Transmitting narration...';
        }
    } else if (state === 'paused') {
        if (playIcon) playIcon.className = 'bi bi-play-fill';
        if (stopBtn) stopBtn.classList.remove('d-none');
        if (wave) wave.classList.add('d-none');
        if (statusText) statusText.textContent = 'Narration paused';
    } else {
        if (playIcon) playIcon.className = 'bi bi-play-fill';
        if (stopBtn) stopBtn.classList.add('d-none');
        if (wave) wave.classList.add('d-none');
        if (statusText) {
            if (cfg.hasServerAudio && cfg.audioDuration) {
                statusText.textContent = `Listen in Indian English (${Math.round(cfg.audioDuration)}s)`;
            } else {
                const readTime = cfg.readingTime || "3";
                statusText.textContent = `Listen to dispatch (~${readTime} min)`;
            }
        }
    }
}

// ── AUTO-GENERATED TABLE OF CONTENTS (TOC) ──
document.addEventListener('DOMContentLoaded', function() {
    const prose = document.querySelector('.article-prose');
    const tocCard = document.getElementById('sidebar-toc-card');
    const tocNav = document.getElementById('toc-nav-list');
    if (!prose || !tocCard || !tocNav) return;

    const headings = prose.querySelectorAll('h2, h3');
    if (headings.length < 2) return;

    headings.forEach((heading, idx) => {
        if (!heading.id) {
            heading.id = 'heading-' + idx + '-' + heading.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }

        const link = document.createElement('a');
        link.href = '#' + heading.id;
        link.className = 'toc-link ' + (heading.tagName.toLowerCase() === 'h3' ? 'toc-h3' : 'toc-h2');
        link.textContent = heading.textContent.trim();
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.getElementById(heading.id);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                history.replaceState(null, null, '#' + heading.id);
            }
        });
        tocNav.appendChild(link);
    });

    tocCard.classList.remove('d-none');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                document.querySelectorAll('.toc-link').forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === '#' + id);
                });
            }
        });
    }, { rootMargin: '0px 0px -75% 0px', threshold: 0.1 });

    headings.forEach(h => observer.observe(h));
});

// ── READING POSITION MEMORY ──
function initReadingPosition() {
    const postSno = (window.KSPEAKS_POST_CONFIG && window.KSPEAKS_POST_CONFIG.postSno) || "";
    if (!postSno) return;
    const storageKey = `post_${postSno}_scroll_pos`;
    
    try {
        const savedPos = parseInt(localStorage.getItem(storageKey), 10);
        if (savedPos && savedPos > 300) {
            const currentY = window.scrollY || document.documentElement.scrollTop || 0;
            if (currentY < savedPos - 200) {
                setTimeout(() => {
                    const latestY = window.scrollY || document.documentElement.scrollTop || 0;
                    if (latestY < savedPos - 200) {
                        showTransmissionToast(
                            `Resume reading where you left off? <button type="button" class="btn btn-sm btn-outline-success ms-2 py-0 px-2" style="font-size:11px; border-radius:50px; font-weight:600; border-color:var(--accent-green); color:var(--accent-green);" onclick="window.scrollTo({top:${savedPos},behavior:'smooth'}); this.closest('.transmission-toast').remove();">Jump ↗</button>`,
                            'info',
                            true
                        );
                    }
                }, 800);
            }
        }
    } catch(e) {}

    let scrollTimer = null;
    window.addEventListener('scroll', function() {
        if (scrollTimer) return;
        scrollTimer = setTimeout(() => {
            try {
                const scrollY = Math.round(window.scrollY || document.documentElement.scrollTop || 0);
                if (scrollY > 300) {
                    localStorage.setItem(storageKey, scrollY);
                }
            } catch(e) {}
            scrollTimer = null;
        }, 1000);
    }, { passive: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReadingPosition);
} else {
    initReadingPosition();
}

// Device Native Share
function shareArticleNative() {
    if (navigator.share) {
        navigator.share({
            title: (window.KSPEAKS_POST_CONFIG && window.KSPEAKS_POST_CONFIG.postTitle) || document.title,
            url: window.location.href
        }).catch(() => {});
    } else {
        copyArticleLink();
    }
}

// Copy link utility
function copyArticleLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        const copyText = document.getElementById('copyText');
        if (copyText) {
            const original = copyText.textContent;
            copyText.textContent = 'Link Copied!';
            setTimeout(() => { copyText.textContent = original; }, 2000);
        }
    });
}

// ── CSRF TOKEN HELPER ──
function getCsrfToken() {
    const input = document.querySelector('[name=csrfmiddlewaretoken]');
    return input ? input.value : '';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

// ── HIGHLIGHT TO QUOTE TOOLBAR ──
let selectedQuoteText = '';
const quoteToolbar = document.getElementById('highlight-quote-toolbar');
const proseElem = document.querySelector('.article-prose');

if (proseElem && quoteToolbar) {
    document.addEventListener('selectionchange', function() {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text && text.length > 5 && proseElem.contains(selection.anchorNode)) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            selectedQuoteText = text;
            quoteToolbar.classList.remove('d-none');
            quoteToolbar.style.top = `${window.scrollY + rect.top}px`;
            quoteToolbar.style.left = `${window.scrollX + rect.left + (rect.width / 2)}px`;
        } else {
            setTimeout(() => {
                if (!window.getSelection().toString().trim()) {
                    quoteToolbar.classList.add('d-none');
                }
            }, 200);
        }
    });
}

function quoteSelectedText() {
    if (!selectedQuoteText) return;
    const commentInput = document.getElementById('mainCommentTextarea');
    if (commentInput) {
        const quoteFormatted = `> "${selectedQuoteText}"\n\n`;
        commentInput.value = quoteFormatted + commentInput.value;
        quoteToolbar.classList.add('d-none');
        window.getSelection().removeAllRanges();
        commentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        commentInput.focus();
    }
}


// ── NON-OBSTRUCTIVE TRANSMISSION TOAST NOTIFICATION ──
function showTransmissionToast(message, type = 'info', isHtml = false) {
    if (window.showTransmissionToast) {
        window.showTransmissionToast(message, type, isHtml);
        return;
    }

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

    const allowHtml = isHtml || (typeof message === 'string' && /<button|<a|<span|<b|<strong/i.test(message) && !message.includes('<script'));
    const content = allowHtml ? message : escapeHtml(message);

    toast.innerHTML = `
        <span>${icon}</span>
        <div style="flex:1; line-height:1.4;">${content}</div>
        <button type="button" style="background:none; border:none; color:inherit; opacity:0.6; cursor:pointer; padding:0 4px; font-size:14px;" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    const duration = allowHtml ? 6500 : 4000;
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
