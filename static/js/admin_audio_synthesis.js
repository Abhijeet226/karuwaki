/**
 * Karuwaki Speaks · Admin Audio Synthesis Modal & Controller
 * Provides real-time interactive progress, animated equalizer visualizer,
 * inline audio preview, and one-click Edge/Gemini fallback.
 */

(function() {
    'use strict';

    // Inject styles for equalizer animation
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes karuWaveAnim {
            0% { transform: scaleY(0.25); opacity: 0.4; }
            50% { transform: scaleY(1); opacity: 1; }
            100% { transform: scaleY(0.25); opacity: 0.4; }
        }
        .karu-wave-bar {
            width: 5px; background: #00ff9d; border-radius: 4px; display: inline-block;
        }
    `;
    document.head.appendChild(style);

    window.triggerAudioSynthesis = function(sno, selectId) {
        const sel = document.getElementById(selectId);
        const provider = sel ? sel.value : 'auto';
        const provLabels = {
            'auto': '🌐 Auto-Detecting Language...',
            'edge': '⚡ Microsoft Edge-TTS Neural Engine',
            'gemini': '✨ Google Gemini 3.1 Flash AI Voice'
        };
        const provName = provLabels[provider] || provider;

        let overlay = document.getElementById('karu_audio_modal_overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'karu_audio_modal_overlay';
            overlay.style.cssText = 'position:fixed; inset:0; z-index:999999; background:rgba(2, 6, 23, 0.88); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; font-family:inherit;';
            document.body.appendChild(overlay);
        }

        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div style="background:#0f172a; border:1px solid rgba(0, 255, 157, 0.35); border-radius:18px; padding:32px 36px; max-width:480px; width:92%; box-shadow:0 25px 60px rgba(0,0,0,0.8), 0 0 35px rgba(0,255,157,0.12); color:#f8fafc; text-align:center;">
                <div style="display:flex; justify-content:center; gap:5px; height:34px; margin-bottom:16px;">
                    <span class="karu-wave-bar" style="height:32px; animation:karuWaveAnim 0.9s infinite ease-in-out;"></span>
                    <span class="karu-wave-bar" style="height:32px; animation:karuWaveAnim 0.9s infinite ease-in-out 0.15s;"></span>
                    <span class="karu-wave-bar" style="height:32px; animation:karuWaveAnim 0.9s infinite ease-in-out 0.3s;"></span>
                    <span class="karu-wave-bar" style="height:32px; animation:karuWaveAnim 0.9s infinite ease-in-out 0.45s;"></span>
                    <span class="karu-wave-bar" style="height:32px; animation:karuWaveAnim 0.9s infinite ease-in-out 0.6s;"></span>
                </div>
                <h3 style="margin:0 0 6px 0; font-size:18px; font-weight:700; color:#ffffff; letter-spacing:-0.02em;">Synthesizing Audio Dispatch</h3>
                <p style="margin:0 0 14px 0; font-size:13px; color:#94a3b8;"><span style="color:#00ff9d; font-weight:600;">${provName}</span></p>

                <div style="background:rgba(255,255,255,0.08); border-radius:999px; height:7px; overflow:hidden; margin:16px 0 10px 0;">
                    <div id="karu_modal_pbar" style="height:100%; width:15%; background:linear-gradient(90deg, #00ff9d, #38bdf8); border-radius:999px; transition:width 0.4s ease;"></div>
                </div>

                <p id="karu_modal_status" style="margin:0 0 16px 0; font-size:12.5px; color:#cbd5e1; min-height:36px;">
                    Analyzing text & applying 1,597 Odia cultural phonetic mappings...
                </p>

                <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:10px 14px; font-size:11.5px; color:#94a3b8; text-align:left; margin-bottom:18px; line-height:1.5;">
                    ⏱️ <b>Notice:</b> Please keep this page open. Synthesis takes ~10–25 seconds for full articles.
                </div>

                <div id="karu_modal_actions">
                    <button type="button" disabled style="padding:7px 18px; font-size:12px; font-weight:600; background:rgba(255,255,255,0.1); color:#94a3b8; border:none; border-radius:8px; cursor:not-allowed;">
                        ⏳ Processing in progress...
                    </button>
                </div>
            </div>
        `;

        const pbar = document.getElementById('karu_modal_pbar');
        const statusTxt = document.getElementById('karu_modal_status');
        const actionsDiv = document.getElementById('karu_modal_actions');

        let progress = 15;
        const progressTimer = setInterval(() => {
            if (progress < 88) {
                progress += Math.floor(Math.random() * 6) + 3;
                if (pbar) pbar.style.width = Math.min(progress, 88) + '%';
            }
        }, 1200);

        const stepTimer1 = setTimeout(() => {
            if (statusTxt) statusTxt.textContent = "Streaming neural voice synthesis from " + provName + "...";
        }, 3000);
        const stepTimer2 = setTimeout(() => {
            if (statusTxt) statusTxt.textContent = "Processing audio chunks & encoding 64kbps MP3...";
        }, 12000);
        const stepTimer3 = setTimeout(() => {
            if (statusTxt) statusTxt.textContent = "Finalizing disk cache & saving DispatchAudioTrack...";
        }, 22000);

        fetch('/admin/blog/post/' + sno + '/generate-audio/?provider=' + encodeURIComponent(provider) + '&format=json', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
            .then(res => res.json())
            .then(data => {
                clearInterval(progressTimer);
                clearTimeout(stepTimer1);
                clearTimeout(stepTimer2);
                clearTimeout(stepTimer3);

                if (data.success) {
                    if (pbar) {
                        pbar.style.width = '100%';
                        pbar.style.background = '#00ff9d';
                    }
                    if (statusTxt) {
                        statusTxt.innerHTML = `<span style="color:#00ff9d; font-weight:700;">✅ Audio synthesized successfully!</span><br/>Duration: <b>${data.duration_str}</b> | Size: <b>${data.file_size_kb} KB</b> | Voice: <b>${data.voice}</b>`;
                    }
                    if (actionsDiv) {
                        actionsDiv.innerHTML = `
                            <div style="margin-bottom:14px;">
                                <audio controls autoplay style="width:100%; height:36px; border-radius:8px;">
                                    <source src="${data.audio_url}" type="audio/mpeg">
                                </audio>
                            </div>
                            <button type="button" onclick="window.location.reload();" style="cursor:pointer; padding:9px 22px; background:#00ff9d; color:#010a24; font-weight:700; font-size:13px; border:none; border-radius:8px; box-shadow:0 3px 8px rgba(0,0,0,0.2);">
                                Done & Refresh Article
                            </button>
                        `;
                    }
                } else {
                    throw new Error(data.error || 'Failed to synthesize audio dispatch.');
                }
            })
            .catch(err => {
                clearInterval(progressTimer);
                clearTimeout(stepTimer1);
                clearTimeout(stepTimer2);
                clearTimeout(stepTimer3);
                if (pbar) {
                    pbar.style.width = '100%';
                    pbar.style.background = '#ef4444';
                }
                if (statusTxt) {
                    statusTxt.innerHTML = `<span style="color:#ef4444; font-weight:700;">❌ Synthesis Error:</span><br/><span style="font-size:12px; color:#fca5a5;">${err.message}</span>`;
                }
                if (actionsDiv) {
                    actionsDiv.innerHTML = `
                        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                            <button type="button" onclick="document.getElementById('${selectId}').value='edge'; window.triggerAudioSynthesis('${sno}', '${selectId}');" style="cursor:pointer; padding:8px 16px; background:#38bdf8; color:#010a24; font-weight:700; font-size:12px; border:none; border-radius:8px;">
                                ⚡ Retry with Edge-TTS (Free & Instant)
                            </button>
                            <button type="button" onclick="document.getElementById('karu_audio_modal_overlay').style.display='none';" style="cursor:pointer; padding:8px 16px; background:rgba(255,255,255,0.1); color:#ffffff; font-weight:600; font-size:12px; border:1px solid rgba(255,255,255,0.2); border-radius:8px;">
                                Dismiss
                            </button>
                        </div>
                    `;
                }
            });
    };
})();
