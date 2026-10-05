import csv
from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from django.db.models import Q
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import display, action
from blog.models import Post, BlogComment, Category, Author, DispatchAudioTrack


class DispatchAudioTrackInline(TabularInline):
    model = DispatchAudioTrack
    extra = 1
    fields = ('provider', 'language', 'voice_name', 'audio_file', 'audio_player', 'duration_str', 'is_primary', 'is_stale_status')
    readonly_fields = ('audio_player', 'duration_str', 'is_stale_status')
    can_delete = True

    @display(description="Audio Player")
    def audio_player(self, obj):
        if obj and obj.audio_file:
            return mark_safe(f'<audio controls preload="none" style="height:32px; width:220px;"><source src="{obj.audio_file.url}" type="audio/mpeg"></audio>')
        return "-"

    @display(description="Duration")
    def duration_str(self, obj):
        return f"{obj.duration // 60}m {obj.duration % 60}s" if obj and obj.duration else "-"

    @display(description="Status")
    def is_stale_status(self, obj):
        if not obj or not obj.id:
            return "-"
        if obj.is_stale():
            return mark_safe('<span style="color:#eab308; font-weight:700;">⚠️ Stale</span>')
        return mark_safe('<span style="color:#10b981; font-weight:700;">✓ Ready</span>')

@admin.register(Author)
class AuthorAdmin(ModelAdmin):
    list_display = ('avatar_preview', 'name', 'designation', 'slug', 'post_count', 'is_featured', 'view_dossier', 'created_at')
    list_filter = ('featured', 'created_at')
    search_fields = ('name', 'designation', 'bio', 'slug')
    prepopulated_fields = {'slug': ('name',)}
    list_per_page = 20
    actions = ['auto_link_dispatches', 'make_featured', 'remove_featured']

    @display(description="Avatar")
    def avatar_preview(self, obj):
        if obj.avatar:
            return format_html('<img src="{}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;" />', obj.avatar.url)
        return "-"

    @display(description="Featured", boolean=True)
    def is_featured(self, obj):
        return obj.featured

    @display(description="Total Articles")
    def post_count(self, obj):
        return obj.posts.count()

    @display(description="Public Dossier")
    def view_dossier(self, obj):
        return format_html(
            '<a href="/blog/author/{}/" target="_blank" style="display:inline-flex; align-items:center; gap:4px; font-weight:700; color:#00ff9d; text-decoration:none;">View ↗</a>',
            obj.slug
        )

    @action(description="Auto-link matching legacy dispatches to selected author(s)")
    def auto_link_dispatches(self, request, queryset):
        total_linked = 0
        for author in queryset:
            names = [author.name.strip()]
            parts = author.name.replace('Adv.', '').replace('Dr.', '').replace('Prof.', '').strip().split()
            if len(parts) >= 1:
                names.append(parts[0])
                names.append(parts[-1])
            q_filter = Q()
            for n in set(names):
                if len(n) > 2:
                    q_filter |= Q(author__icontains=n)
            linked = Post.objects.filter(q_filter, author_profile__isnull=True).update(author_profile=author)
            total_linked += linked
        self.message_user(request, f"Successfully linked {total_linked} dispatches to selected author(s).")

    @action(description="Mark selected authors as Featured")
    def make_featured(self, request, queryset):
        updated = queryset.update(featured=True)
        self.message_user(request, f"{updated} author(s) marked as Featured.")

    @action(description="Remove Featured badge from selected authors")
    def remove_featured(self, request, queryset):
        updated = queryset.update(featured=False)
        self.message_user(request, f"{updated} author(s) removed from Featured.")

@admin.register(Category)
class CategoryAdmin(ModelAdmin):
    list_display = ('id', 'name', 'post_count')
    search_fields = ('name',)

    @display(description="Total Articles")
    def post_count(self, obj):
        return Post.objects.filter(category=obj).count()

@admin.register(BlogComment)
class BlogCommentAdmin(ModelAdmin):
    list_display = ('sno', 'user', 'post', 'short_comment', 'timestamp')
    list_filter = ('timestamp',)
    search_fields = ('comment', 'user__username', 'post__title')
    list_per_page = 25

    @display(description="Comment Excerpt")
    def short_comment(self, obj):
        return obj.comment[:60] + "..." if len(obj.comment) > 60 else obj.comment

@admin.register(Post)
class PostAdmin(ModelAdmin):
    list_display = (
        'cover_preview',
        'title',
        'category',
        'author_profile',
        'author',
        'audio_badge',
        'views',
        'reading_time',
        'is_featured',
        'is_ai_curated',
        'is_published',
        'timeStamp',
    )
    list_filter = ('preferred_audio_provider', 'audio_status', 'author_profile', 'published', 'featured', 'ai_curated', 'ai_mood', 'category', 'timeStamp')
    search_fields = ('title', 'author', 'author_profile__name', 'content', 'tags')
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ('audio_preview_player', 'audio_content_hash', 'audio_duration', 'audio_file_size', 'audio_updated_at')
    inlines = [DispatchAudioTrackInline]
    list_per_page = 20

    fieldsets = (
        ("Article Content", {
            "fields": (
                "title",
                "slug",
                "category",
                ("author_profile", "author"),
                "content",
                "image",
            ),
        }),
        ("🎧 Audio Dispatch Narration & Engine Controls", {
            "fields": (
                "audio_preview_player",
                ("audio_status", "audio_voice"),
                ("audio_duration", "audio_file_size", "audio_updated_at"),
            ),
            "description": "Synthesize broadcast speech narration. Select Microsoft Edge-TTS (free & unlimited) or Google Gemini AI Voice (studio-grade AI modality).",
        }),
        ("Curation, Editorial & Metadata", {
            "fields": (
                ("published", "featured"),
                ("ai_curated", "ai_mood"),
                ("views", "reading_time"),
                "tags",
            ),
        }),
    )

    @display(description="Cover")
    def cover_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="width: 44px; height: 32px; object-fit: cover; border-radius: 6px;" />', obj.image.url)
        return "-"

    @display(description="Audio")
    def audio_badge(self, obj):
        if obj.is_audio_stale():
            return format_html('<span style="padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700; background:rgba(234,179,8,0.15); color:#eab308; border:1px solid #eab308;">⚠️ Stale</span>')
        elif obj.audio_status == 'ready':
            dur = f"{obj.audio_duration // 60}m {obj.audio_duration % 60}s" if obj.audio_duration else ""
            prov_tag = "Gemini" if "gemini" in (obj.audio_voice or "").lower() or obj.preferred_audio_provider == "gemini" else "Edge"
            return format_html('<span style="padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700; background:rgba(16,185,129,0.15); color:#10b981; border:1px solid #10b981;">🎧 {} ({})</span>', dur or "Ready", prov_tag)
        elif obj.audio_status == 'generating':
            return format_html('<span style="padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700; background:rgba(59,130,246,0.15); color:#3b82f6; border:1px solid #3b82f6;">⏳ Gen</span>')
        elif obj.audio_status == 'failed':
            return format_html('<span style="padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700; background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid #ef4444;">❌ Failed</span>')
        return format_html('<span style="padding:2px 8px; border-radius:12px; font-size:11px; color:#9ca3af;">—</span>')

    @display(description="Audio Dispatch Console & Engine Switcher")
    def audio_preview_player(self, obj):
        if not obj or not obj.sno:
            return mark_safe('<span style="color:#94a3b8;">Save the post first before generating audio.</span>')

        current_pref = getattr(obj, 'preferred_audio_provider', 'auto')
        options = [
            ('auto', '🌐 Auto-Detect Language (Edge for EN/HI, Gemini for OD)'),
            ('edge', '⚡ Microsoft Edge-TTS (Free & Fast • Neerja/Swara)'),
            ('gemini', '✨ Google Gemini AI Voice (Audio Modality • Puck)'),
        ]
        opts_html = "".join([
            f'<option value="{val}"{" selected" if val == current_pref else ""} style="background:#0f172a; color:#f8fafc;">{label}</option>'
            for val, label in options
        ])

        select_id = f"audio_provider_select_{obj.sno}"
        controls_html = f'''
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08);">
            <label style="font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em;">Engine:</label>
            <select id="{select_id}" style="padding:8px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.18); font-size:12.5px; background:#1e293b; color:#f8fafc; font-weight:600; outline:none;">
                {opts_html}
            </select>
            <button type="button" onclick="window.triggerAudioSynthesis('{obj.sno}', '{select_id}');" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px; padding:8px 18px; background:#00ff9d; color:#010a24; font-weight:700; font-size:12.5px; border-radius:8px; border:none; box-shadow:0 2px 8px rgba(0,255,157,0.25); transition:all 0.2s ease;">
                🎧 Synthesize Audio Now
            </button>
        </div>
        '''

        if obj.audio_file:
            stale_warning = mark_safe('<div style="color:#eab308; font-weight:700; font-size:12.5px; margin-bottom:6px;">⚠️ Content modified since last synthesis — regeneration recommended!</div>') if obj.is_audio_stale() else mark_safe('')
            prov_badge = "✨ Google Gemini AI Voice" if "gemini" in (obj.audio_voice or "").lower() or obj.preferred_audio_provider == "gemini" else "⚡ Microsoft Edge-TTS"
            size_kb = (obj.audio_file_size or 0) / 1024
            dur_val = obj.audio_duration or 0
            dur_str = f"{dur_val // 60}m {dur_val % 60}s" if dur_val else "0 sec"
            return mark_safe(f'''
                <div style="background:#0f172a; border:1px solid rgba(0, 255, 157, 0.25); border-radius:14px; padding:18px 20px; max-width:680px; box-shadow:0 4px 20px rgba(0,0,0,0.25);">
                    {stale_warning}
                    <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-bottom:8px;">
                        <audio controls preload="none" style="width:360px; height:36px;"><source src="{obj.audio_file.url}" type="audio/mpeg">Your browser does not support audio.</audio>
                        <span style="font-size:12px; color:#94a3b8;">
                            Engine: <b style="color:#00ff9d;">{prov_badge}</b> &nbsp;|&nbsp; 
                            Voice: <b style="color:#f8fafc;">{obj.audio_voice or 'default'}</b> &nbsp;|&nbsp; 
                            Size: <b style="color:#f8fafc;">{size_kb:.1f} KB</b> &nbsp;|&nbsp; 
                            Duration: <b style="color:#f8fafc;">{dur_str}</b>
                        </span>
                    </div>
                    {controls_html}
                </div>
            ''')

        return mark_safe(f'''
            <div style="background:#0f172a; border:1px solid rgba(255, 255, 255, 0.1); border-radius:14px; padding:18px 20px; max-width:680px;">
                <span style="color:#94a3b8; font-size:13px;">No audio dispatch generated yet for this article. Select your preferred engine below and click Synthesize.</span>
                {controls_html}
            </div>
        ''')

    def get_urls(self):
        from django.urls import path
        urls = super().get_urls()
        custom_urls = [
            path(
                '<int:sno>/generate-audio/',
                self.admin_site.admin_view(self.generate_single_audio_view),
                name='blog_post_generate_audio'
            ),
        ]
        return custom_urls + urls

    def generate_single_audio_view(self, request, sno):
        from blog.services.audio_generator import generate_post_audio
        from django.shortcuts import redirect
        from django.contrib import messages
        from django.http import JsonResponse
        post = Post.objects.filter(sno=sno).first()
        is_json = request.GET.get('format') == 'json' or request.headers.get('x-requested-with') == 'XMLHttpRequest'

        if not post:
            if is_json:
                return JsonResponse({'success': False, 'error': 'Post not found.'}, status=404)
            messages.error(request, "Post not found.")
            return redirect('admin:blog_post_changelist')

        provider = request.GET.get('provider', 'auto')
        if provider in ('auto', 'edge', 'gemini'):
            post.preferred_audio_provider = provider
            post.save(update_fields=['preferred_audio_provider'])

        ok = generate_post_audio(post, provider=provider, force=True)
        if ok:
            post.refresh_from_db()
            dur = f"{post.audio_duration // 60}m {post.audio_duration % 60}s"
            size_kb = (post.audio_file_size or 0) / 1024
            prov_name = "Google Gemini AI Voice" if "gemini" in (post.audio_voice or "").lower() else "Microsoft Edge-TTS"
            if is_json:
                return JsonResponse({
                    'success': True,
                    'provider': provider,
                    'prov_name': prov_name,
                    'voice': post.audio_voice,
                    'duration': post.audio_duration,
                    'duration_str': dur,
                    'file_size': post.audio_file_size,
                    'file_size_kb': round(size_kb, 1),
                    'audio_url': post.audio_file.url if post.audio_file else '',
                    'message': f"Audio dispatch synthesized successfully using {prov_name} ({dur}, {size_kb:.1f} KB)!"
                })
            messages.success(
                request,
                f"🎧 Audio dispatch synthesized successfully using {prov_name} ({dur}, {size_kb:.1f} KB, voice: {post.audio_voice})!"
            )
        else:
            if is_json:
                return JsonResponse({
                    'success': False,
                    'error': f"Failed to synthesize audio dispatch for '{post.title}'. If using Gemini, check quota or switch to Microsoft Edge-TTS."
                }, status=400)
            messages.error(request, f"❌ Failed to synthesize audio dispatch for '{post.title}'.")

        return redirect('admin:blog_post_change', sno)

    def save_model(self, request, obj, form, change):
        if change and obj.sno:
            primary_track = obj.audio_tracks.filter(is_primary=True, status='ready').first()
            if primary_track and primary_track.audio_file:
                obj.audio_status = 'ready'
                obj.audio_file = primary_track.audio_file
                obj.audio_duration = primary_track.duration
                obj.audio_file_size = primary_track.file_size
                obj.audio_voice = f"{primary_track.provider}:{primary_track.voice_name}" if ":" not in primary_track.voice_name else primary_track.voice_name
                obj.preferred_audio_provider = primary_track.provider
        super().save_model(request, obj, form, change)

    def save_formset(self, request, form, formset, change):
        super().save_formset(request, form, formset, change)
        post = form.instance
        if post and post.sno:
            primary_track = post.audio_tracks.filter(is_primary=True, status='ready').first()
            if primary_track and primary_track.audio_file:
                Post.objects.filter(sno=post.sno).update(
                    audio_status='ready',
                    audio_file=primary_track.audio_file,
                    audio_duration=primary_track.duration,
                    audio_file_size=primary_track.file_size,
                    audio_voice=f"{primary_track.provider}:{primary_track.voice_name}" if ":" not in primary_track.voice_name else primary_track.voice_name,
                    preferred_audio_provider=primary_track.provider
                )

    @display(
        description="Featured",
        boolean=True,
    )
    def is_featured(self, obj):
        return obj.featured

    @display(
        description="AI Curated",
        boolean=True,
    )
    def is_ai_curated(self, obj):
        return obj.ai_curated

    @display(
        description="Status",
        boolean=True,
    )
    def is_published(self, obj):
        return obj.published

    actions = [
        'generate_audio_selected',
        'generate_audio_edge_selected',
        'generate_audio_gemini_selected',
        'regenerate_stale_audio',
        'clear_audio_selected',
        'make_published',
        'make_draft',
        'make_featured',
        'remove_featured',
        'curate_for_ai_magazine',
        'remove_from_ai_magazine',
        'export_as_csv',
    ]

    @action(description="🎧 Synthesize Audio Dispatch (Auto-Detect Engine)")
    def generate_audio_selected(self, request, queryset):
        from blog.services.audio_generator import generate_post_audio
        count = 0
        for post in queryset:
            if generate_post_audio(post, provider='auto', force=True):
                count += 1
        self.message_user(request, f"Generated auto-routed audio dispatch for {count} of {queryset.count()} selected post(s).")

    @action(description="⚡ Force Synthesize with Edge-TTS (Free & Fast)")
    def generate_audio_edge_selected(self, request, queryset):
        from blog.services.audio_generator import generate_post_audio
        count = 0
        for post in queryset:
            if generate_post_audio(post, provider='edge', force=True):
                count += 1
        self.message_user(request, f"Generated Edge-TTS audio dispatch for {count} of {queryset.count()} selected post(s).")

    @action(description="✨ Force Synthesize with Gemini AI Voice")
    def generate_audio_gemini_selected(self, request, queryset):
        from blog.services.audio_generator import generate_post_audio
        count = 0
        for post in queryset:
            if generate_post_audio(post, provider='gemini', force=True):
                count += 1
        self.message_user(request, f"Generated Gemini AI audio dispatch for {count} of {queryset.count()} selected post(s).")

    @action(description="⚡ Regenerate Stale Audio for selected")
    def regenerate_stale_audio(self, request, queryset):
        from blog.services.audio_generator import generate_post_audio
        count = 0
        for post in queryset:
            if post.is_audio_stale() and generate_post_audio(post, force=True):
                count += 1
        self.message_user(request, f"Regenerated stale audio for {count} post(s).")

    @action(description="🗑️ Clear Audio Dispatch for selected")
    def clear_audio_selected(self, request, queryset):
        import os
        count = 0
        for post in queryset:
            if post.audio_file:
                try:
                    if os.path.exists(post.audio_file.path):
                        os.remove(post.audio_file.path)
                except Exception:
                    pass
                post.audio_file = ""
                post.audio_status = "none"
                post.audio_duration = 0
                post.audio_file_size = 0
                post.save(update_fields=['audio_file', 'audio_status', 'audio_duration', 'audio_file_size'])
                count += 1
        self.message_user(request, f"Cleared audio dispatch for {count} post(s).")

    @action(description="Curate selected for AI Magazine")
    def curate_for_ai_magazine(self, request, queryset):
        updated = queryset.update(ai_curated=True)
        self.message_user(request, f"{updated} dispatches added to AI Magazine showcase.")

    @action(description="Remove selected from AI Magazine")
    def remove_from_ai_magazine(self, request, queryset):
        updated = queryset.update(ai_curated=False)
        self.message_user(request, f"{updated} dispatches removed from AI Magazine showcase.")

    @action(description="Publish selected dispatches")
    def make_published(self, request, queryset):
        updated = queryset.update(published=True)
        self.message_user(request, f"{updated} dispatches successfully marked as Published.")

    @action(description="Revert selected dispatches to Draft")
    def make_draft(self, request, queryset):
        updated = queryset.update(published=False)
        self.message_user(request, f"{updated} dispatches reverted to Draft.")

    @action(description="Pin selected dispatches as Featured")
    def make_featured(self, request, queryset):
        updated = queryset.update(featured=True)
        self.message_user(request, f"{updated} dispatches pinned as Featured.")

    @action(description="Remove selected dispatches from Featured")
    def remove_featured(self, request, queryset):
        updated = queryset.update(featured=False)
        self.message_user(request, f"{updated} dispatches removed from Featured.")

    @action(description="Export selected dispatches to CSV")
    def export_as_csv(self, request, queryset):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="karuwaki_dispatches.csv"'
        writer = csv.writer(response)
        writer.writerow(['ID', 'Title', 'Author', 'Category', 'Views', 'Reading Time (min)', 'Featured', 'Published', 'Timestamp'])
        for p in queryset:
            writer.writerow([p.sno, p.title, p.author, p.category.name, p.views, p.reading_time, p.featured, p.published, p.timeStamp])
        return response

    class Media:
        js = (
            'tinymce/tinymce.min.js',
            'tinyInject.js',
            'js/admin_audio_synthesis.js',
        )


@admin.register(DispatchAudioTrack)
class DispatchAudioTrackAdmin(ModelAdmin):
    list_display = ('post_title', 'language_badge', 'provider_badge', 'voice_name', 'audio_player', 'duration_str', 'file_size_kb', 'is_primary', 'created_at')
    list_filter = ('provider', 'language', 'is_primary', 'status', 'created_at')
    search_fields = ('post__title', 'voice_name')
    readonly_fields = ('audio_player', 'content_hash', 'duration', 'file_size', 'created_at', 'updated_at')
    list_per_page = 25

    @display(description="Post")
    def post_title(self, obj):
        return obj.post.title[:50]

    @display(description="Language")
    def language_badge(self, obj):
        return obj.get_language_display()

    @display(description="Provider")
    def provider_badge(self, obj):
        if obj.provider == 'gemini':
            return format_html('<span style="padding:2px 8px; border-radius:8px; font-size:11px; font-weight:700; background:#f3e8ff; color:#7e22ce; border:1px solid #d8b4fe;">✨ Gemini AI</span>')
        return format_html('<span style="padding:2px 8px; border-radius:8px; font-size:11px; font-weight:700; background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;">⚡ Edge Neural</span>')

    @display(description="Player")
    def audio_player(self, obj):
        if obj.audio_file:
            return format_html('<audio controls preload="none" style="height:32px; width:220px;"><source src="{}" type="audio/mpeg"></audio>', obj.audio_file.url)
        return "-"

    @display(description="Duration")
    def duration_str(self, obj):
        return f"{obj.duration // 60}m {obj.duration % 60}s" if obj.duration else "-"

    @display(description="Size")
    def file_size_kb(self, obj):
        return f"{(obj.file_size or 0) / 1024:.1f} KB"