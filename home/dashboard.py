from datetime import date
from django.db.models import Sum
from blog.models import Post, BlogComment, Category
from home.models import Athereal, Contact

def dashboard_callback(request, context):
    """
    Computes live KPI analytics metrics and quick shortcuts for the Unfold admin dashboard.
    """
    total_posts = Post.objects.filter(published=True).count()
    draft_posts = Post.objects.filter(published=False).count()
    total_views = Post.objects.aggregate(total=Sum('views'))['total'] or 0
    total_comments = BlogComment.objects.count()
    total_contacts = Contact.objects.count()

    today = date.today()
    today_athereal = Athereal.objects.filter(date=today).first()

    kpi_stats = [
        {
            'title': 'Published Dispatches',
            'metric': f'{total_posts:,}',
            'subtext': f'{draft_posts} in draft mode',
            'icon': 'article',
            'color': 'emerald',
            'badge': 'Live',
        },
        {
            'title': 'Global Readership',
            'metric': f'{total_views:,}',
            'subtext': 'Cumulative article views',
            'icon': 'visibility',
            'color': 'sky',
            'badge': 'Views',
        },
        {
            'title': "Today's Athereal Alignment",
            'metric': today_athereal.tithi_title if today_athereal else 'Not Logged Yet',
            'subtext': today_athereal.location if today_athereal else 'Click to add today',
            'icon': 'auto_awesome',
            'color': 'fuchsia' if today_athereal else 'amber',
            'badge': 'Active' if today_athereal else 'Action Needed',
            'badge_color': 'green' if today_athereal else 'yellow',
        },
        {
            'title': 'Community Discussions',
            'metric': f'{total_comments:,}',
            'subtext': f'{total_contacts} contact messages',
            'icon': 'forum',
            'color': 'indigo',
            'badge': 'Engagement',
        },
    ]

    recent_dispatches = Post.objects.order_by('-timeStamp')[:5]

    context.update({
        'kpi_stats': kpi_stats,
        'recent_dispatches': recent_dispatches,
        'today_athereal': today_athereal,
    })
    return context
