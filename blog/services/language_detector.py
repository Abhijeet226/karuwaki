"""
Karuwaki Speaks · Unicode Script & Language Detector
Detects article language (English, Hindi, Odia) in <1ms without database categories,
and recommends optimal speech synthesis provider.
"""

import re
from typing import Tuple


def detect_content_language(title: str = "", content: str = "") -> str:
    """
    Analyzes character script frequencies across title and prose:
    - Odia Unicode Block: U+0B00 to U+0B7F (ଓଡ଼ିଆ)
    - Devanagari Unicode Block: U+0900 to U+097F (हिन्दी)
    - Latin Alphabet: a-zA-Z (English)

    Returns: 'or' (Odia), 'hi' (Hindi), or 'en' (English).
    """
    sample = f"{title or ''} {content or ''}".strip()
    if not sample:
        return 'en'

    odia_count = len(re.findall(r'[\u0B00-\u0B7F]', sample))
    devanagari_count = len(re.findall(r'[\u0900-\u097F]', sample))
    latin_count = len(re.findall(r'[a-zA-Z]', sample))

    total = odia_count + devanagari_count + latin_count
    if total == 0:
        return 'en'

    # If more than 15% of script characters are Odia -> Native Odia article
    if (odia_count / total) >= 0.15:
        return 'or'
    # If more than 15% of script characters are Devanagari -> Hindi article
    elif (devanagari_count / total) >= 0.15:
        return 'hi'

    return 'en'


def get_recommended_tts_provider(language: str) -> Tuple[str, str]:
    """
    Returns (recommended_provider, default_voice) based on language:
    - 'or' (Odia): Edge-TTS has no Odia voice -> routes to Google Gemini AI Voice
    - 'hi' (Hindi): routes to Edge-TTS hi-IN-SwaraNeural (Free)
    - 'en' (English): routes to Edge-TTS en-IN-NeerjaExpressiveNeural (Free)
    """
    if language == 'or':
        return 'gemini', 'Puck'
    elif language == 'hi':
        return 'edge', 'hi-IN-SwaraNeural'
    return 'edge', 'en-IN-NeerjaExpressiveNeural'
