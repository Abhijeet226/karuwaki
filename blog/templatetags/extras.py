import html
from django import template
from django.utils.html import strip_tags

register = template.Library()

@register.filter(name='get_val')
def get_val(dict_obj, key):
    if isinstance(dict_obj, dict):
        return dict_obj.get(key)
    return None

@register.filter(name='clean_excerpt')
def clean_excerpt(value, words=24):
    """Strip HTML tags, unescape HTML entities (&ldquo;, &mdash;, etc.), and cleanly truncate."""
    if not value:
        return ""
    text = strip_tags(str(value))
    text = html.unescape(text)
    # Normalize multiple whitespace
    text = " ".join(text.split())
    try:
        limit = int(words)
    except (ValueError, TypeError):
        limit = 24
    word_list = text.split()
    if len(word_list) > limit:
        return " ".join(word_list[:limit]) + "…"
    return text

@register.filter(name='unescape_html')
def unescape_html(value):
    """Unescape HTML entities into UTF-8 characters."""
    if not value:
        return ""
    return html.unescape(str(value))