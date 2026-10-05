"""
Karu-Wisdom AI Explorer Engine
Lightweight, shared-hosting-safe integration with Google Gemini API free tier.
Zero background daemons, zero external SDK dependencies (pure HTTPS requests).
"""

import os
import hashlib
import json
import logging
import requests

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

GEMINI_MODELS = [
    ("gemini-3.6-flash", {}),
    ("gemini-3.5-flash", {"thinkingBudget": 0}),
    ("gemini-flash-latest", {})
]

SYSTEM_INSTRUCTION = (
    "You are Karu-Wisdom, the enlightened AI philosophical, historical, and cultural guide of Karuwaki Speaks (karuwakispeaks.com). "
    "You have profound mastery over: "
    "1. Queen Karuwaki, Emperor Ashoka, the Kalinga legacy, and ancient Indian history. "
    "2. Vedic astronomy, planetary harmonics, Jyotisha principles, and cosmic rhythm. "
    "3. Philosophical inquiry, conscious living, environmental stewardship, and legal-ethical thought. "
    "Speak with regal clarity, intellectual depth, warmth, and conciseness. "
    "Format your answers with clean markdown (bullet points, bold highlights). Keep answers under 250 words unless asked for an essay. "
    "When applicable, guide the seeker to reflect on connected principles found within the Karuwaki Speaks editorial archives."
)

CURATED_KNOWLEDGE = {
    "karuwaki": (
        "**Queen Karuwaki** was the revered second queen consort of Maurya Emperor Ashoka the Great "
        "and the mother of Prince Tivala. Immortalized in the famous **Queen's Edict** at Allahabad, "
        "she is celebrated in history as a fierce warrior-princess of Kalinga, a fisherwoman's daughter in popular lore, "
        "and the spiritual catalyst who inspired Ashoka's monumental transformation from conquest (*Digvijaya*) "
        "to righteousness and peace (*Dhammavijaya*)."
    ),
    "athereal": (
        "**Athereal** is Karuwaki Speaks' real-time cosmic transit observatory. "
        "It synthesizes high-precision astronomical ephemeris algorithms with classical Vedic planetary harmonics "
        "to map the dynamic interconnections between the 9 Grahas (celestial forces) and the 12 zodiacal houses (*Bhavas*), "
        "illuminating the subtle vibrational weather of our everyday consciousness."
    ),
    "vedic astronomy": (
        "Classical **Vedic Astronomy** (*Jyotisha Vedanga*) is a sidereal (*Nirayana*) observation system "
        "rooted in the 27 lunar mansions (*Nakshatras*) and the precession of the equinoxes (*Ayanamsa*). "
        "Unlike tropical astrology which is tied to the solstices, Vedic calculations measure true physical celestial "
        "alignments against the fixed cosmic backdrop of the galactic center."
    ),
    "kundali": (
        "A **Kundali** (Natal Horoscope / Janam Patri) is a sacred mathematical snapshot of the cosmos "
        "at the exact moment and terrestrial coordinates of an individual's birth. "
        "The Ascendant (*Lagna*) marks the eastern horizon, establishing the 1st House from which all 12 life domains "
        "— purpose (*Dharma*), prosperity (*Artha*), desires (*Kama*), and liberation (*Moksha*) — unfold."
    )
}


def find_related_dispatches(query: str, limit: int = 3):
    """
    Intelligently search the Karuwaki Speaks blog database for published dispatches
    matching the user's inquiry, creating seamless deep-links between AI wisdom and blog editorial.
    """
    try:
        import re
        from django.db.models import Q
        from blog.models import Post

        stop_words = {
            'the', 'a', 'an', 'is', 'in', 'what', 'who', 'where', 'how', 'why',
            'tell', 'me', 'about', 'and', 'or', 'to', 'of', 'for', 'with', 'on',
            'at', 'by', 'from', 'this', 'that', 'it', 'was', 'were', 'explain',
            'synthesize', 'themes', 'key', 'dispatch', 'article'
        }
        words = [w.strip() for w in re.findall(r'[a-zA-Z0-9]+', query.lower()) if len(w) > 2 and w not in stop_words]
        
        if not words:
            posts = Post.objects.filter(published=True).select_related('category').order_by('-views', '-timeStamp')[:limit]
        else:
            q_primary = Q()
            for w in words[:6]:
                q_primary |= Q(title__icontains=w) | Q(tags__icontains=w) | Q(category__name__icontains=w)
            posts = Post.objects.filter(published=True).select_related('category').filter(q_primary).distinct().order_by('-views')[:limit]

            if not posts.exists():
                q_secondary = Q()
                for w in words[:4]:
                    q_secondary |= Q(content__icontains=w)
                posts = Post.objects.filter(published=True).select_related('category').filter(q_secondary).distinct().order_by('-views')[:limit]

            if not posts.exists():
                posts = Post.objects.filter(published=True).select_related('category').order_by('-views', '-timeStamp')[:limit]

        import html
        from django.utils.html import strip_tags

        results = []
        for p in posts:
            author_name = p.display_author_name if hasattr(p, 'display_author_name') else p.author
            raw_excerpt = p.excerpt if p.excerpt else (p.content or "")
            clean = strip_tags(raw_excerpt)
            clean = html.unescape(clean)
            clean = re.sub(r'[\r\n\t]+', ' ', clean)
            clean = re.sub(r'\s+', ' ', clean).strip()
            excerpt_text = (clean[:115] + '...') if len(clean) > 115 else clean

            results.append({
                "title": p.title,
                "url": p.get_absolute_url(),
                "slug": p.slug,
                "category": p.category.name if p.category else "Dispatch",
                "reading_time": p.reading_time,
                "author": author_name,
                "excerpt": excerpt_text
            })
        return results
    except Exception as e:
        logger.error(f"Error fetching related dispatches: {e}")
        return []


def ask_karu_wisdom(prompt: str) -> dict:
    """
    Query Karu-Wisdom. Prioritizes Gemini API; gracefully falls back to curated knowledge.
    Deep-links with related published blog dispatches.
    """
    cleaned_prompt = (prompt or "").strip()
    if not cleaned_prompt:
        return {
            "success": False,
            "error": "Query cannot be empty.",
            "answer": "Please enter a question or topic to consult Karu-Wisdom.",
            "related_posts": []
        }

    # Check cache first for rapid response & quota conservation
    cache_key = f"karu_wisdom_{hashlib.md5(cleaned_prompt.lower().encode('utf-8')).hexdigest()}"
    cached_result = cache.get(cache_key)
    if cached_result:
        return cached_result

    related_posts = find_related_dispatches(cleaned_prompt, limit=3)
    api_key = (os.getenv("GEMINI_API_KEY") or getattr(settings, "GEMINI_API_KEY", "") or "").strip()

    # Attempt Gemini API call if key is present
    if api_key:
        for model_name, thinking_opts in GEMINI_MODELS:
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            gen_config = {
                "temperature": 0.7,
                "maxOutputTokens": 600,
                "topP": 0.95
            }
            if thinking_opts:
                gen_config["thinkingConfig"] = thinking_opts

            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": f"System Context: {SYSTEM_INSTRUCTION}\n\nUser Question: {cleaned_prompt}"}
                        ]
                    }
                ],
                "generationConfig": gen_config
            }

            try:
                response = requests.post(
                    endpoint,
                    headers={"Content-Type": "application/json"},
                    data=json.dumps(payload),
                    timeout=10
                )
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        text = "".join(p.get("text", "") for p in parts)
                        if text:
                            result = {
                                "success": True,
                                "answer": text.strip(),
                                "source": f"gemini-api ({model_name})",
                                "related_posts": related_posts
                            }
                            cache.set(cache_key, result, 3600)
                            return result
                else:
                    logger.warning(f"Gemini API model {model_name} returned status {response.status_code}: {response.text[:200]}")
            except Exception as e:
                logger.error(f"Error querying Gemini API model {model_name}: {e}")

    # Fallback: Search curated knowledge base or provide contextual wisdom
    lower_query = cleaned_prompt.lower()
    for keyword, response_text in CURATED_KNOWLEDGE.items():
        if keyword in lower_query:
            result = {
                "success": True,
                "answer": response_text,
                "source": "curated-wisdom",
                "related_posts": related_posts
            }
            cache.set(cache_key, result, 3600)
            return result

    # Default informative wisdom with instructions for API key
    result = {
        "success": True,
        "answer": (
            f"**Reflections on \"{cleaned_prompt}\":**\n\n"
            "In the philosophy of Karuwaki Speaks, every inquiry is a bridge between timeless heritage "
            "and futuristic inquiry. True wisdom (*Jnana*) begins when we observe the harmony between inner consciousness "
            "and outer cosmic rhythm.\n\n"
            "> *Tip for Administrators:* To unlock full live AI generative answers powered by Google's Free Tier, "
            "obtain a free key from **Google AI Studio** and add `GEMINI_API_KEY=your_key` to your `.env` file."
        ),
        "source": "karu-offline-engine",
        "related_posts": related_posts
    }
    cache.set(cache_key, result, 1800)
    return result
