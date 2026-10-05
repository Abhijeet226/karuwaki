"""
Karuwaki Speaks · Enterprise Multi-Engine Audio Dispatch Generator
Supports dual synthesis providers:
1. Microsoft Edge-TTS (Free, unlimited, broadcast quality for Indian English & Hindi)
2. Google Gemini AI Voice (Native Odia script & multimodal Indic synthesis)

Includes automatic Unicode language routing and explicit admin engine override.
"""

import os
import io
import re
import json
import base64
import logging
import asyncio
import tempfile
import subprocess
import requests
from django.conf import settings
from django.utils import timezone
from django.core.files.base import ContentFile
from blog.services.odia_lexicon import prepare_dispatch_speech_text, clean_prose_for_tts
from blog.services.language_detector import detect_content_language, get_recommended_tts_provider

logger = logging.getLogger(__name__)

DEFAULT_EDGE_EN_VOICE = "en-IN-NeerjaExpressiveNeural"
DEFAULT_VOICE = DEFAULT_EDGE_EN_VOICE
DEFAULT_EDGE_HI_VOICE = "hi-IN-SwaraNeural"
DEFAULT_GEMINI_VOICE = "Puck"
GEMINI_MODEL = "gemini-3.1-flash-tts-preview"


def estimate_mp3_duration_seconds(file_size_bytes: int, bitrate_kbps: int = 48) -> int:
    """
    Estimates duration of MP3 (default ~48-64kbps mono).
    48 kbps = 6,000 bytes per second.
    """
    if not file_size_bytes:
        return 0
    bytes_per_sec = (bitrate_kbps * 1000) / 8
    return max(1, round(file_size_bytes / bytes_per_sec))


def odia_to_phonetic_devanagari(text: str) -> str:
    """
    Phonetically maps Odia Unicode script (U+0B00 to U+0B7F) to Brahmi-equivalent Devanagari (U+0900 to U+097F).
    This allows Microsoft Edge neural voices (hi-IN-SwaraNeural / Madhur) to synthesize native Odia text
    with full phonetic fidelity, zero recurring API cost, and zero rate limits.
    """
    out = []
    for ch in text:
        cp = ord(ch)
        if 0x0B00 <= cp <= 0x0B7F:
            if cp == 0x0B5F:  # Odia YA (ୟ) -> Devanagari YA (य: 0x092F)
                out.append(chr(0x092F))
            elif cp in (0x0B56, 0x0B57):  # AI / AU length marks
                continue
            elif cp == 0x0B71:  # Odia WA (ୱ) -> Devanagari VA (व: 0x0935)
                out.append(chr(0x0935))
            else:
                dev_cp = cp - 0x0200
                out.append(chr(dev_cp))
        else:
            out.append(ch)
    return ''.join(out)


async def _synthesize_edge_tts_async(text: str, voice: str) -> bytes:
    """Synthesizes speech using Microsoft Edge-TTS neural engine."""
    import edge_tts

    # If text contains Odia characters, map to phonetic Devanagari so Edge Indic voice reads it seamlessly
    if any(0x0B00 <= ord(c) <= 0x0B7F for c in text):
        text = odia_to_phonetic_devanagari(text)
        if not voice or "en-" in voice:
            voice = DEFAULT_EDGE_HI_VOICE

    communicate = edge_tts.Communicate(
        text=text,
        voice=voice,
        rate="-4%",
        pitch="+0Hz"
    )

    buffer = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buffer.write(chunk["data"])

    return buffer.getvalue()


def _convert_audio_to_mp3(raw_bytes: bytes, mime_type: str = "audio/l16") -> bytes:
    """Converts raw audio bytes (PCM L16 or WAV) to high-quality MP3 using ffmpeg."""
    try:
        suffix = ".raw" if "l16" in mime_type.lower() else ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as in_f:
            in_f.write(raw_bytes)
            in_path = in_f.name

        out_path = in_path.replace(suffix, ".mp3")

        if "l16" in mime_type.lower():
            cmd = [
                "ffmpeg", "-y",
                "-f", "s16le",
                "-ar", "24000",
                "-ac", "1",
                "-i", in_path,
                "-codec:a", "libmp3lame",
                "-b:a", "64k",
                out_path
            ]
        else:
            cmd = [
                "ffmpeg", "-y",
                "-i", in_path,
                "-codec:a", "libmp3lame",
                "-b:a", "64k",
                "-ar", "24000",
                out_path
            ]

        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

        with open(out_path, "rb") as out_f:
            mp3_bytes = out_f.read()

        try:
            os.remove(in_path)
            os.remove(out_path)
        except OSError:
            pass

        return mp3_bytes
    except Exception as e:
        logger.warning(f"ffmpeg conversion failed: {e}. Returning raw audio bytes.")
        return raw_bytes


def _chunk_text_for_tts(text: str, max_chars: int = 2200) -> list:
    """Splits prose text into natural speech chunks under max_chars at sentence or paragraph boundaries."""
    paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
    chunks = []
    curr = ''
    for p in paragraphs:
        if len(curr) + len(p) + 1 <= max_chars:
            curr = (curr + ' ' + p).strip()
        else:
            if curr:
                chunks.append(curr)
            if len(p) > max_chars:
                sentences = re.split(r'(?<=[.!?।\n])\s+', p)
                sub_curr = ''
                for s in sentences:
                    if len(sub_curr) + len(s) + 1 <= max_chars:
                        sub_curr = (sub_curr + ' ' + s).strip()
                    else:
                        if sub_curr:
                            chunks.append(sub_curr)
                        sub_curr = s
                curr = sub_curr
            else:
                curr = p
    if curr:
        chunks.append(curr)
    return chunks or [text]


def _get_gemini_api_keys() -> list:
    """Returns list of Gemini API keys: primary key first, followed by fallback key if configured."""
    keys = []
    primary = os.getenv("GEMINI_API_KEY") or getattr(settings, "GEMINI_API_KEY", "")
    fallback = os.getenv("GEMINI_FALLBACK_API_KEY") or getattr(settings, "GEMINI_FALLBACK_API_KEY", "")
    if primary and primary.strip():
        keys.append(primary.strip())
    if fallback and fallback.strip() and fallback.strip() not in keys:
        keys.append(fallback.strip())
    return keys


def _synthesize_gemini_audio(text: str, voice_name: str = DEFAULT_GEMINI_VOICE, language: str = "or") -> bytes:
    """
    Synthesizes speech using Google Gemini 3.1 Flash TTS preview.
    Supports authentic Odia, Hindi, and regional Indic speech.
    Supports primary API key with seamless fallback to secondary API key on rate limits (429),
    and automatic retries for transient network/SSL handshake drops.
    """
    import time
    api_keys = _get_gemini_api_keys()
    if not api_keys:
        raise ValueError("GEMINI_API_KEY is not configured in environment or settings.")

    chunks = _chunk_text_for_tts(text, max_chars=1200)
    all_raw_bytes = []
    last_mime = "audio/l16"
    active_key_idx = 0

    for idx, chunk in enumerate(chunks):
        if idx > 0:
            time.sleep(2.0)  # Pace requests to respect free-tier per-minute limit
        if language == "or":
            prompt = f"Read the following Odia text aloud clearly and reverently with natural Odia pronunciation:\n\n{chunk}"
        else:
            prompt = f"Read the following text aloud with natural, expressive narration:\n\n{chunk}"

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {
                            "voiceName": voice_name or DEFAULT_GEMINI_VOICE
                        }
                    }
                }
            }
        }

        chunk_success = False
        last_err = None

        while active_key_idx < len(api_keys):
            curr_key = api_keys[active_key_idx]
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={curr_key}"

            response = None
            for attempt in range(2):
                try:
                    response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=120)
                    break
                except requests.exceptions.Timeout:
                    last_err = RuntimeError(f"Gemini API read timeout on chunk {idx+1}/{len(chunks)}.")
                    break
                except (requests.exceptions.SSLError, requests.exceptions.ConnectionError) as net_err:
                    last_err = net_err
                    time.sleep(1.0)

            if response is None:
                if active_key_idx + 1 < len(api_keys):
                    logger.warning(f"Connection issue with Gemini key #{active_key_idx+1}, switching to fallback key: {last_err}")
                    active_key_idx += 1
                    continue
                raise last_err or RuntimeError(f"Gemini connection failed on chunk {idx+1}/{len(chunks)}.")

            if response.status_code == 429:
                if active_key_idx + 1 < len(api_keys):
                    logger.warning(f"Gemini key #{active_key_idx+1} hit rate limit (429). Switching to fallback key...")
                    active_key_idx += 1
                    time.sleep(1.0)
                    continue
                raise RuntimeError("Gemini API rate limit reached on all configured keys. Please try Edge-TTS or wait a moment.")

            if response.status_code != 200:
                if active_key_idx + 1 < len(api_keys) and response.status_code in (401, 403):
                    logger.warning(f"Gemini key #{active_key_idx+1} returned {response.status_code}. Switching to fallback key...")
                    active_key_idx += 1
                    continue
                raise RuntimeError(f"Gemini API returned status {response.status_code}: {response.text[:300]}")

            data = response.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise RuntimeError(f"No candidates returned by Gemini: {data}")

            parts = candidates[0].get("content", {}).get("parts", [])
            found = False
            for part in parts:
                if "inlineData" in part:
                    last_mime = part["inlineData"].get("mimeType", last_mime)
                    raw_b64 = part["inlineData"].get("data", "")
                    all_raw_bytes.append(base64.b64decode(raw_b64))
                    found = True
                    chunk_success = True
                    break

            if not found:
                raise RuntimeError(f"No audio inlineData found in Gemini response for chunk {idx+1}/{len(chunks)}.")
            break

        if not chunk_success:
            raise RuntimeError(f"Failed to synthesize chunk {idx+1}/{len(chunks)} across all configured Gemini API keys.")

    if not all_raw_bytes:
        raise RuntimeError("Synthesizer produced empty audio stream.")

    combined_bytes = b"".join(all_raw_bytes)
    return _convert_audio_to_mp3(combined_bytes, mime_type=last_mime)


def generate_post_audio(
    post,
    provider: str = "auto",
    voice: str = None,
    force: bool = False
) -> bool:
    """
    Synthesizes and caches audio dispatch for a given Post.
    
    Parameters:
    - post: Post model instance
    - provider: 'auto' | 'edge' | 'gemini' (defaults to 'auto' or post.preferred_audio_provider)
    - voice: voice identifier override
    - force: if True, regenerates even if existing audio is fresh
    
    Returns True on success, False otherwise.
    """
    from blog.models import DispatchAudioTrack

    if not post or not post.content:
        logger.warning(f"Cannot generate audio: Post {getattr(post, 'sno', None)} has no content.")
        return False

    # 1. Detect language by Unicode script analysis
    detected_lang = detect_content_language(post.title, post.content)

    # 2. Determine provider (respecting manual override if set)
    effective_provider = provider
    if effective_provider == "auto":
        pref = getattr(post, "preferred_audio_provider", "auto")
        if pref in ("edge", "gemini"):
            effective_provider = pref
        else:
            rec_provider, _ = get_recommended_tts_provider(detected_lang)
            effective_provider = rec_provider

    # 3. Determine voice
    effective_voice = voice
    if not effective_voice:
        if effective_provider == "gemini":
            effective_voice = DEFAULT_GEMINI_VOICE
        elif detected_lang in ("hi", "or"):
            effective_voice = DEFAULT_EDGE_HI_VOICE
        else:
            effective_voice = DEFAULT_EDGE_EN_VOICE

    # 4. Check staleness and existing track
    content_hash = post.compute_content_hash()
    existing_track = DispatchAudioTrack.objects.filter(
        post=post,
        language=detected_lang,
        provider=effective_provider
    ).first()

    if existing_track and existing_track.status == "ready" and not force and not existing_track.is_stale():
        logger.info(f"Audio dispatch for Post {post.sno} is already up to date. Skipping.")
        return True

    logger.info(
        f"Generating audio for Post {post.sno}: lang='{detected_lang}', provider='{effective_provider}', voice='{effective_voice}'"
    )

    # Set status to generating
    post.audio_status = "generating"
    post.save(update_fields=["audio_status"])

    # 5. Prepare text
    if detected_lang == "en":
        speech_text = prepare_dispatch_speech_text(post.title, post.display_author_name, post.content)
    else:
        # Clean prose for Hindi/Odia
        clean_prose = clean_prose_for_tts(post.content)
        speech_text = f"{post.title}. {clean_prose}"

    # 6. Execute synthesis
    try:
        if effective_provider == "gemini":
            audio_bytes = _synthesize_gemini_audio(speech_text, voice_name=effective_voice, language=detected_lang)
        else:
            audio_bytes = asyncio.run(_synthesize_edge_tts_async(speech_text, voice=effective_voice))

        if not audio_bytes or len(audio_bytes) < 1000:
            raise ValueError("Synthesizer produced empty or corrupt audio bytes.")

    except Exception as e:
        logger.error(f"Failed to synthesize audio for Post {post.sno}: {e}")
        post.audio_status = "error"
        post.save(update_fields=["audio_status"])
        return False

    # 7. Save file and metadata
    file_size = len(audio_bytes)
    duration_sec = estimate_mp3_duration_seconds(file_size, bitrate_kbps=48 if effective_provider == "edge" else 64)

    now_dt = timezone.now()
    clean_slug = re.sub(r'[^a-zA-Z0-9_\-]', '', post.slug[:30]) or f"post_{post.sno}"
    filename = f"dispatch_{post.sno}_{clean_slug}_{detected_lang}_{effective_provider}.mp3"

    # Save to Post (backward compatibility)
    if post.audio_file:
        try:
            if os.path.exists(post.audio_file.path):
                os.remove(post.audio_file.path)
        except Exception:
            pass

    post.audio_file.save(filename, ContentFile(audio_bytes), save=False)
    post.audio_duration = duration_sec
    post.audio_file_size = file_size
    post.audio_voice = f"{effective_provider}:{effective_voice}"
    post.audio_content_hash = content_hash
    post.audio_status = "ready"
    post.audio_updated_at = now_dt
    post.save(update_fields=[
        "audio_file", "audio_duration", "audio_file_size",
        "audio_voice", "audio_content_hash", "audio_status", "audio_updated_at"
    ])

    # Save to DispatchAudioTrack
    DispatchAudioTrack.objects.filter(post=post).update(is_primary=False)
    track, _ = DispatchAudioTrack.objects.update_or_create(
        post=post,
        language=detected_lang,
        provider=effective_provider,
        defaults={
            "voice_name": effective_voice,
            "audio_file": post.audio_file,
            "duration": duration_sec,
            "file_size": file_size,
            "content_hash": content_hash,
            "status": "ready",
            "is_primary": True,
        }
    )

    logger.info(f"Successfully generated and cached audio dispatch for Post {post.sno} ({duration_sec}s, {file_size} bytes)")
    return True
