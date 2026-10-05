import os
from io import BytesIO
from django.db import models
from django.contrib.auth.models import User
from django.utils.timezone import now
from django.core.files.base import ContentFile
from PIL import Image

class Category(models.Model):
    name=models.CharField(max_length=255)

    
    def __str__(self):
        return self.name

# your_choices = Category.objects.all().values_list('name','name')
# choices=[]
# for item in your_choices:
#     choices.append(item)


class Author(models.Model):
    name = models.CharField(max_length=100, help_text="Full Name of the author")
    slug = models.SlugField(max_length=120, unique=True, help_text="Unique slug for author archive URL")
    avatar = models.ImageField(upload_to="authors/", blank=True, null=True, help_text="Author avatar/portrait")
    designation = models.CharField(max_length=120, blank=True, default='', help_text="E.g., Senior Investigative Journalist, Archival Researcher")
    bio = models.TextField(blank=True, default='', help_text="Short bio and background details")
    x_handle = models.CharField(max_length=100, blank=True, default='', help_text="Twitter / X profile URL or @handle")
    linkedin = models.URLField(blank=True, default='', help_text="LinkedIn profile URL")
    website = models.URLField(blank=True, default='', help_text="Personal website or portfolio URL")
    featured = models.BooleanField(default=False, help_text="Highlight as featured contributor")
    created_at = models.DateTimeField(default=now)

    class Meta:
        ordering = ['name']
        verbose_name = "Author"
        verbose_name_plural = "Authors"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug and self.name:
            from django.utils.text import slugify
            import uuid
            candidate = slugify(self.name, allow_unicode=True)[:110]
            if not candidate:
                candidate = f"author-{uuid.uuid4().hex[:8]}"
            slug = candidate
            counter = 1
            while Author.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{candidate[:100]}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        from django.urls import reverse
        return reverse('author_posts', kwargs={'slug': self.slug})


from django.utils.html import strip_tags

class Post(models.Model):
    sno = models.AutoField(primary_key=True)
    title = models.CharField(max_length=255)
    author = models.CharField(max_length=40, help_text="Legacy/Guest author name")
    author_profile = models.ForeignKey(
        Author,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='posts',
        help_text="Linked curated author profile (overrides plain author text if set)"
    )
    slug = models.CharField(unique=True, max_length=130)
    excerpt = models.TextField(blank=True, default='')
    image = models.ImageField(upload_to="images/")
    category = models.ForeignKey(Category, on_delete=models.CASCADE)
    views = models.IntegerField(default=0)
    reading_time = models.PositiveIntegerField(default=3, help_text="Estimated reading time in minutes")
    featured = models.BooleanField(default=False, help_text="Pin to featured hero section")
    tags = models.CharField(max_length=255, blank=True, default='', help_text="Comma-separated tags")
    timeStamp = models.DateTimeField(blank=True)
    content = models.TextField()
    published = models.BooleanField(default=True)

    AI_MOOD_CHOICES = [
        ('creative', 'Creative & Arts'),
        ('nostalgic', 'Nostalgic & Heritage'),
        ('learning', 'Deep Learning & Science'),
        ('fun', 'Fun & Lifestyle'),
        ('cosmic', 'Cosmic Wisdom'),
    ]
    ai_curated = models.BooleanField(default=False, help_text="Feature in AI Magazine showcase")
    ai_mood = models.CharField(max_length=50, choices=AI_MOOD_CHOICES, default='creative', blank=True)
    reactions = models.JSONField(default=dict, blank=True, help_text="Reaction counts: mindblown, insightful, etc.")

    # Enterprise Audio Management Fields
    AUDIO_PROVIDER_CHOICES = [
        ('auto', 'Auto-Detect (Edge for EN/HI, Gemini for Odia)'),
        ('edge', 'Force Microsoft Edge-TTS (Free)'),
        ('gemini', 'Force Google Gemini AI Voice'),
    ]
    preferred_audio_provider = models.CharField(
        max_length=20,
        choices=AUDIO_PROVIDER_CHOICES,
        default='auto',
        help_text="Manual override for audio synthesis engine"
    )
    audio_file = models.FileField(upload_to='dispatches/audio/%Y/%m/', blank=True, null=True)
    audio_duration = models.PositiveIntegerField(default=0, help_text="Duration in seconds")
    audio_file_size = models.PositiveIntegerField(default=0, help_text="Size in bytes")
    audio_voice = models.CharField(max_length=64, default='en-IN-NeerjaExpressiveNeural')
    audio_content_hash = models.CharField(max_length=64, blank=True, null=True, help_text="SHA-256 of text when synthesized")
    AUDIO_STATUS_CHOICES = [
        ('none', 'No Audio'),
        ('generating', 'Generating...'),
        ('ready', 'Ready'),
        ('stale', 'Content Updated (Stale)'),
        ('error', 'Generation Error'),
    ]
    audio_status = models.CharField(max_length=20, default='none', choices=AUDIO_STATUS_CHOICES)
    audio_updated_at = models.DateTimeField(null=True, blank=True)

    @property
    def primary_audio_track(self):
        track = self.audio_tracks.filter(is_primary=True, status='ready').first()
        if not track:
            track = self.audio_tracks.filter(status='ready').first()
        return track

    @property
    def has_ready_audio(self):
        """Returns True if this post has a ready audio track or ready direct audio file."""
        if self.audio_file and self.audio_status == 'ready':
            return True
        track = self.primary_audio_track
        return bool(track and track.status == 'ready' and track.audio_file)

    @property
    def effective_audio_duration(self):
        track = self.primary_audio_track
        if track and track.duration:
            return track.duration
        return self.audio_duration or 0

    @property
    def effective_audio_voice(self):
        track = self.primary_audio_track
        if track and track.voice_name:
            return track.voice_name
        return self.audio_voice or 'en-IN-NeerjaExpressiveNeural'

    @property
    def effective_audio_provider(self):
        track = self.primary_audio_track
        if track and track.provider:
            return track.provider
        return self.preferred_audio_provider or 'edge'

    @property
    def effective_audio_language(self):
        track = self.primary_audio_track
        if track and track.language:
            return track.language
        from blog.services.language_detector import detect_content_language
        return detect_content_language(self.title, self.content)

    def compute_content_hash(self):
        import hashlib
        raw = f"{self.title or ''}::{self.content or ''}"
        return hashlib.sha256(raw.encode('utf-8')).hexdigest()

    def is_audio_stale(self):
        if not self.audio_file or self.audio_status == 'none':
            return False
        return self.audio_content_hash != self.compute_content_hash()

    def get_absolute_url(self):
        return f"/blog/{self.slug}/"

    def optimize_image(self):
        if self.image and hasattr(self.image, 'file'):
            try:
                base_name, ext = os.path.splitext(self.image.name)
                if ext.lower() != '.webp':
                    img = Image.open(self.image)
                    if img.mode not in ('RGB', 'RGBA'):
                        img = img.convert('RGBA' if 'transparency' in img.info else 'RGB')

                    if img.width > 1600:
                        ratio = 1600 / img.width
                        img = img.resize((1600, int(img.height * ratio)), Image.Resampling.LANCZOS)

                    output = BytesIO()
                    img.save(output, format='WEBP', quality=85, method=6)
                    output.seek(0)
                    webp_filename = f"{base_name.split('/')[-1]}.webp"
                    self.image.save(webp_filename, ContentFile(output.read()), save=False)
            except Exception:
                pass

    def save(self, *args, **kwargs):
        if not self.slug and self.title:
            from django.utils.text import slugify
            import uuid
            candidate = slugify(self.title, allow_unicode=True)[:110]
            if not candidate:
                candidate = f"dispatch-{uuid.uuid4().hex[:8]}"
            slug = candidate
            counter = 1
            while Post.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{candidate[:100]}-{counter}"
                counter += 1
            self.slug = slug

        if not self.excerpt and self.content:
            clean_text = strip_tags(self.content)
            self.excerpt = (clean_text[:180] + '...') if len(clean_text) > 180 else clean_text

        if self.content:
            words = len(strip_tags(self.content).split())
            self.reading_time = max(1, round(words / 200))

        if self.image and hasattr(self.image, 'file'):
            self.optimize_image()

        # Check audio staleness on content update
        if self.pk and self.audio_file and self.audio_status == 'ready':
            if self.is_audio_stale():
                self.audio_status = 'stale'

        super().save(*args, **kwargs)

    @property
    def display_author_name(self):
        if self.author_profile:
            return self.author_profile.name
        return self.author or "Karuwaki Editorial"

    @property
    def display_author_designation(self):
        if self.author_profile and self.author_profile.designation:
            return self.author_profile.designation
        return "Contributing Writer"

    def __str__(self):
        return f"{self.title} by {self.display_author_name}"

class BlogComment(models.Model):
    sno= models.AutoField(primary_key=True)
    comment=models.TextField()
    user=models.ForeignKey(User, on_delete=models.CASCADE)
    post=models.ForeignKey(Post, on_delete=models.CASCADE)
    parent=models.ForeignKey('self',on_delete=models.CASCADE, null=True, blank=True)
    timestamp= models.DateTimeField(default=now)
    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    likes = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.comment[0:13] + "..." + "by" + " " + self.user.username


class DispatchAudioTrack(models.Model):
    """
    Dedicated audio dispatch track associated with an article.
    Supports multi-engine synthesis (Edge-TTS & Google Gemini),
    multiple languages, permanent disk caching, and change detection.
    """
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='audio_tracks')
    language = models.CharField(
        max_length=10,
        choices=[
            ('en', 'English'),
            ('hi', 'Hindi (हिन्दी)'),
            ('or', 'Odia (ଓଡ଼ିଆ)'),
        ],
        default='en'
    )
    provider = models.CharField(
        max_length=20,
        choices=[
            ('edge', 'Microsoft Edge Neural (Free)'),
            ('gemini', 'Google Gemini AI Voice'),
        ],
        default='edge'
    )
    voice_name = models.CharField(max_length=64, default='en-IN-NeerjaExpressiveNeural')
    audio_file = models.FileField(upload_to='dispatches/audio/%Y/%m/')
    duration = models.PositiveIntegerField(default=0, help_text="Duration in seconds")
    file_size = models.PositiveIntegerField(default=0, help_text="Size in bytes")
    content_hash = models.CharField(max_length=64, blank=True, null=True, help_text="SHA-256 of text when synthesized")
    status = models.CharField(
        max_length=20,
        default='none',
        choices=[
            ('none', 'No Audio'),
            ('generating', 'Generating...'),
            ('ready', 'Ready'),
            ('stale', 'Content Updated (Stale)'),
            ('failed', 'Generation Failed'),
        ]
    )
    is_primary = models.BooleanField(default=True, help_text="Active audio track for reader playback")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_primary', '-created_at']
        indexes = [
            models.Index(fields=['post', 'is_primary']),
            models.Index(fields=['language', 'provider']),
        ]

    def is_stale(self):
        if not self.audio_file or self.status == 'none':
            return False
        return self.content_hash != self.post.compute_content_hash()

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_primary and self.status == 'ready':
            # Ensure other tracks for this post are not primary
            DispatchAudioTrack.objects.filter(post=self.post).exclude(pk=self.pk).update(is_primary=False)
            # Sync to parent post
            if self.audio_file:
                self.post.audio_file = self.audio_file
            self.post.audio_duration = self.duration
            self.post.audio_file_size = self.file_size
            self.post.audio_voice = f"{self.provider}:{self.voice_name}" if ":" not in self.voice_name else self.voice_name
            self.post.audio_content_hash = self.content_hash
            self.post.audio_status = 'ready'
            self.post.preferred_audio_provider = self.provider
            self.post.save(update_fields=[
                'audio_file', 'audio_duration', 'audio_file_size',
                'audio_voice', 'audio_content_hash', 'audio_status', 'preferred_audio_provider'
            ])

    def __str__(self):
        return f"{self.post.title} [{self.get_language_display()} • {self.get_provider_display()}]"
