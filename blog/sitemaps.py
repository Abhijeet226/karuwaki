from django.contrib.sitemaps import Sitemap
from django.urls import reverse
from blog.models import Post, Category

class PostSitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.9

    def items(self):
        return Post.objects.filter(published=True).order_by('-timeStamp')

    def lastmod(self, obj):
        return obj.timeStamp


class CategorySitemap(Sitemap):
    changefreq = "monthly"
    priority = 0.7

    def items(self):
        return Category.objects.order_by('name')

    def location(self, obj):
        return reverse('category', args=[obj.name])


class StaticViewSitemap(Sitemap):
    priority = 0.8
    changefreq = 'daily'

    def items(self):
        return ['home', 'bloghome', 'athereal', 'ai_magazine', 'about', 'privacy_policy']

    def location(self, item):
        return reverse(item)
