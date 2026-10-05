from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from unfold.decorators import display
from .models import Contact, Athereal, Profile

@admin.register(Profile)
class ProfileAdmin(ModelAdmin):
    list_display = ('user', 'avatar_preview', 'bio_short', 'saved_count', 'created_at')
    search_fields = ('user__username', 'user__email', 'bio')
    list_per_page = 25

    @display(description="Avatar")
    def avatar_preview(self, obj):
        if obj.avatar:
            return format_html('<img src="{}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 50%;" />', obj.avatar.url)
        return "No Avatar"

    @display(description="Bio")
    def bio_short(self, obj):
        return obj.bio[:50] + "..." if len(obj.bio) > 50 else (obj.bio or "-")

    @display(description="Saved Dispatches")
    def saved_count(self, obj):
        return obj.saved_posts.count()

@admin.register(Athereal)
class AtherealAdmin(ModelAdmin):
    list_display = ('date', 'tithi_title', 'location', 'sunrise', 'sunset', 'amrit_kaal', 'rahu_kaal')
    list_filter = ('location', 'date')
    search_fields = ('tithi_title', 'cosmic_insight', 'location', 'nakshatra')
    date_hierarchy = 'date'
    ordering = ('-date',)
    list_per_page = 25

    fieldsets = (
        ("Astronomical Coordinates", {
            'fields': ('date', 'tithi_title', 'location', 'nakshatra')
        }),
        ("Solar & Lunar Timing", {
            'fields': ('sunrise', 'sunset', 'moonrise', 'moonset')
        }),
        ("Auspicious & Inauspicious Kaal", {
            'fields': ('amrit_kaal', 'rahu_kaal', 'abhijit')
        }),
        ("AI Guidance & Ancient Insights", {
            'fields': ('cosmic_insight',)
        }),
    )

@admin.register(Contact)
class ContactAdmin(ModelAdmin):
    list_display = ('name', 'email', 'phone', 'short_content', 'timeStamp')
    search_fields = ('name', 'email', 'phone', 'content')
    list_filter = ('timeStamp',)
    list_per_page = 25

    @display(description="Message")
    def short_content(self, obj):
        return obj.content[:50] + "..." if len(obj.content) > 50 else obj.content





