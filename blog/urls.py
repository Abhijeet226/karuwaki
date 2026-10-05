from django.contrib import admin
from django.urls import path, include
from . import views

urlpatterns = [
    # Comment and interaction actions
    path('postComment', views.postComment, name="postComment"),
    path('postComment/', views.postComment, name="postComment_slash"),
    path('editComment/', views.editComment, name="editComment"),
    path('deleteComment/', views.deleteComment, name="deleteComment"),
    path('likeComment/', views.likeComment, name="likeComment"),
    path('reactPost/', views.reactPost, name="reactPost"),
    path('image_upload/', views.imgUpload, name="imageUpload"),

    # Blog index
    path('', views.blogHome, name="bloghome"),

    # Editorial Board & Authors
    path('authors/', views.authors_list, name="authors_list"),
    path('author/<str:slug>/', views.author_posts, name="author_posts"),

    # Categories & Syndication Feeds (must precede generic <str:slug>/)
    path('category/<str:cats>/', views.articleCategory, name="category"),
    path('feed/rss', views.LatestEntriesFeed(), name="rss_feed"),
    path('feed/rss/', views.LatestEntriesFeed(), name="rss_feed_slash"),

    # Audio Dispatch Streaming & Metadata (HTTP 206 Partial Content)
    path('audio/<int:sno>/stream/', views.stream_dispatch_audio, name="stream_dispatch_audio"),
    path('audio/<int:sno>/info/', views.get_dispatch_audio_info, name="get_dispatch_audio_info"),

    # Individual Article Dispatch (catch-all single-segment slug at the end)
    path('<str:slug>/', views.blogPost, name="blogPost"),
]
