"""Karuwaki URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/3.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.static import serve
from django.conf import settings

from django.shortcuts import render
from home import views

admin.site.site_header = "Karuwaki Admin"
admin.site.site_title = "Karuwaki Admin Panel"
admin.site.index_title = "Welcome to Karuwaki Admin Panel"

from django.contrib.sitemaps.views import sitemap
from django.http import HttpResponse
from blog.sitemaps import PostSitemap, CategorySitemap, StaticViewSitemap

sitemaps = {
    'posts': PostSitemap,
    'categories': CategorySitemap,
    'static': StaticViewSitemap,
}

def robots_txt(request):
    lines = [
        "User-agent: *",
        "Disallow: /admin/",
        f"Sitemap: {request.scheme}://{request.get_host()}/sitemap.xml",
    ]
    return HttpResponse("\n".join(lines), content_type="text/plain")

def service_worker(request):
    response = render(request, 'sw.js', content_type='application/javascript')
    response['Service-Worker-Allowed'] = '/'
    return response

def pwa_manifest(request):
    return render(request, 'manifest.webmanifest', content_type='application/manifest+json')

import os

def serve_static(request, path):
    roots = []
    if hasattr(settings, 'STATICFILES_DIRS') and settings.STATICFILES_DIRS:
        roots.extend([str(d) for d in settings.STATICFILES_DIRS])
    if hasattr(settings, 'STATIC_ROOT') and settings.STATIC_ROOT:
        roots.append(str(settings.STATIC_ROOT))

    for root in roots:
        full_path = os.path.join(root, path)
        if os.path.exists(full_path):
            return serve(request, path, document_root=root)
    fallback = roots[0] if roots else settings.STATIC_ROOT
    return serve(request, path, document_root=fallback)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='django.contrib.sitemaps.views.sitemap'),
    path('robots.txt', robots_txt, name='robots_txt'),
    path('sw.js', service_worker, name='service_worker'),
    path('manifest.webmanifest', pwa_manifest, name='pwa_manifest'),
    path('offline/', views.offline_vault, name='offline_vault'),
    path('api/', include('blog.api_urls')),
    path('blog/', include('blog.urls')),
    path('home/', include('home.urls')),
    path('', include('home.urls')),

    # Serve static and media files reliably across development and production
    re_path(r'^Karuwaki/static/(?P<path>.*)$', serve_static),
    re_path(r'^static/(?P<path>.*)$', serve_static),
    re_path(r'^Karuwaki/media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]