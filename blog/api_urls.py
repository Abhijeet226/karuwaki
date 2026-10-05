from django.urls import path
from blog import api_views

urlpatterns = [
    path('posts/', api_views.api_posts, name='api_posts'),
    path('posts/<str:slug>/', api_views.api_post_detail, name='api_post_detail'),
    path('categories/', api_views.api_categories, name='api_categories'),
    path('trending/', api_views.api_trending, name='api_trending'),
    path('ai-magazine/suggest/', api_views.api_ai_suggest, name='api_ai_suggest'),
    path('ai-magazine/curated/', api_views.api_ai_curated, name='api_ai_curated'),
]
