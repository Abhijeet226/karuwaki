from django.http import JsonResponse, Http404
from django.core.paginator import Paginator
from django.core.cache import cache
from django.db.models import Q
from django.utils import timezone
from blog.models import Post, Category

def api_posts(request):
    """
    GET /api/posts/?page=1&limit=6&category=science&q=search_term&featured=true
    """
    now = timezone.now()
    posts_qs = Post.objects.filter(published=True, timeStamp__lte=now)

    # Filter by category
    category = request.GET.get('category')
    if category:
        posts_qs = posts_qs.filter(category__name__icontains=category)

    # Filter by featured
    featured = request.GET.get('featured')
    if featured in ('1', 'true', 'True'):
        posts_qs = posts_qs.filter(featured=True)

    # Search query
    q = request.GET.get('q')
    if q:
        posts_qs = posts_qs.filter(
            Q(title__icontains=q) | Q(author__icontains=q) | Q(content__icontains=q) | Q(tags__icontains=q)
        )

    posts_qs = posts_qs.order_by('-timeStamp')

    # Pagination
    limit = min(int(request.GET.get('limit', 6)), 50)
    page_number = request.GET.get('page', 1)
    paginator = Paginator(posts_qs, limit)
    page_obj = paginator.get_page(page_number)

    data = {
        'total_posts': paginator.count,
        'total_pages': paginator.num_pages,
        'current_page': page_obj.number,
        'has_next': page_obj.has_next(),
        'has_prev': page_obj.has_previous(),
        'posts': [
            {
                'id': p.sno,
                'title': p.title,
                'slug': p.slug,
                'author': p.author,
                'category': p.category.name,
                'reading_time': p.reading_time,
                'views': p.views,
                'featured': p.featured,
                'tags': p.tags,
                'excerpt': p.excerpt,
                'image_url': p.image.url if p.image else None,
                'timestamp': p.timeStamp.isoformat() if p.timeStamp else None,
                'has_audio': bool(p.audio_file),
                'audio_stream_url': f"/blog/audio/{p.sno}/stream/" if p.audio_file else None,
                'audio_duration': p.audio_duration,
                'audio_status': p.audio_status,
            }
            for p in page_obj
        ]
    }
    return JsonResponse(data)


def api_post_detail(request, slug):
    """
    GET /api/posts/<slug>/
    """
    try:
        p = Post.objects.get(slug=slug, published=True)
    except Post.DoesNotExist:
        return JsonResponse({'error': 'Post not found'}, status=404)

    data = {
        'id': p.sno,
        'title': p.title,
        'slug': p.slug,
        'author': p.author,
        'category': p.category.name,
        'reading_time': p.reading_time,
        'views': p.views,
        'featured': p.featured,
        'tags': p.tags,
        'excerpt': p.excerpt,
        'content': p.content,
        'image_url': p.image.url if p.image else None,
        'timestamp': p.timeStamp.isoformat() if p.timeStamp else None,
        'has_audio': bool(p.audio_file),
        'audio_stream_url': f"/blog/audio/{p.sno}/stream/" if p.audio_file else None,
        'audio_duration': p.audio_duration,
        'audio_status': p.audio_status,
        'audio_file_size': p.audio_file_size,
    }
    return JsonResponse(data)


def api_categories(request):
    """
    GET /api/categories/ (cached for 10 minutes)
    """
    cache_key = 'api_categories_list'
    categories_data = cache.get(cache_key)

    if categories_data is None:
        categories = Category.objects.all()
        categories_data = [
            {
                'id': c.id,
                'name': c.name,
                'count': Post.objects.filter(category=c, published=True).count(),
            }
            for c in categories
        ]
        cache.set(cache_key, categories_data, 600)

    return JsonResponse({'categories': categories_data})


def api_trending(request):
    """
    GET /api/trending/ (cached for 5 minutes)
    """
    cache_key = 'api_trending_posts'
    trending_data = cache.get(cache_key)

    if trending_data is None:
        now = timezone.now()
        trending_posts = Post.objects.filter(published=True, timeStamp__lte=now).order_by('-views')[:5]
        trending_data = [
            {
                'id': p.sno,
                'title': p.title,
                'slug': p.slug,
                'author': p.author,
                'category': p.category.name,
                'views': p.views,
                'reading_time': p.reading_time,
                'image_url': p.image.url if p.image else None,
            }
            for p in trending_posts
        ]
        cache.set(cache_key, trending_data, 300)

    return JsonResponse({'trending': trending_data})


def api_ai_suggest(request):
    """
    GET /api/ai-magazine/suggest/?creative=X&nostalgic=Y&learning=Z&fun=W
    Evaluates mood vectors and returns top matching dispatch with match confidence.
    """
    try:
        creative = float(request.GET.get('creative', 0))
        nostalgic = float(request.GET.get('nostalgic', 0))
        learning = float(request.GET.get('learning', 0))
        fun = float(request.GET.get('just_for_fun', request.GET.get('fun', 0)))
    except (ValueError, TypeError):
        creative, nostalgic, learning, fun = 5, 0, 0, 0

    mood_map = {
        'creative': (creative, 'Creative & Arts', ['Culture', 'Feature story']),
        'nostalgic': (nostalgic, 'Nostalgic & Heritage', ['Culture', 'Hello Life']),
        'learning': (learning, 'Deep Learning & Science', ['Environment', 'Legal', 'Health']),
        'fun': (fun, 'Fun & Lifestyle', ['Fashion Cafe', 'Hello Life']),
    }

    # Find highest score mood
    top_mood = max(mood_map.keys(), key=lambda k: mood_map[k][0])
    top_score = mood_map[top_mood][0]
    label = mood_map[top_mood][1]
    categories = mood_map[top_mood][2]

    # Calculate match percentage between 88% and 99%
    base_match = 85 + int(min(top_score, 10) * 1.3)
    match_pct = min(99, max(88, base_match))

    # Query matching post
    post = (
        Post.objects.filter(published=True, ai_mood=top_mood).order_by('?').first() or
        Post.objects.filter(published=True, category__name__in=categories).order_by('?').first() or
        Post.objects.filter(published=True).order_by('-views').first()
    )

    if not post:
        return JsonResponse({'error': 'No articles available'}, status=404)

    return JsonResponse({
        'mood': top_mood,
        'mood_label': label,
        'match_percentage': match_pct,
        'article': {
            'id': post.sno,
            'title': post.title,
            'slug': post.slug,
            'author': post.author,
            'category': post.category.name,
            'reading_time': post.reading_time,
            'excerpt': post.excerpt,
            'image_url': post.image.url if post.image else None,
            'url': f"/blog/{post.slug}/",
        }
    })


def api_ai_curated(request):
    """
    GET /api/ai-magazine/curated/
    """
    posts = Post.objects.filter(published=True, ai_curated=True).order_by('-timeStamp')[:8]
    data = [
        {
            'id': p.sno,
            'title': p.title,
            'slug': p.slug,
            'author': p.author,
            'category': p.category.name,
            'mood': p.ai_mood,
            'views': p.views,
            'reading_time': p.reading_time,
            'excerpt': p.excerpt,
            'image_url': p.image.url if p.image else None,
            'url': f"/blog/{p.slug}/",
        }
        for p in posts
    ]
    return JsonResponse({'curated_articles': data})

