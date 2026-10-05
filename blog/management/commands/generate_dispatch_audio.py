"""
Karuwaki Speaks · Audio Dispatch Generation CLI Command
Batch synthesizes broadcast-quality audio files using edge-tts and Odia cultural phonetics.
"""

from django.core.management.base import BaseCommand
from blog.models import Post
from blog.services.audio_generator import generate_post_audio, DEFAULT_VOICE


class Command(BaseCommand):
    help = "Generates high-fidelity Indian English audio dispatches for blog posts using edge-tts."

    def add_arguments(self, parser):
        parser.add_argument(
            "--all",
            action="store_true",
            help="Generate audio for all published blog posts.",
        )
        parser.add_argument(
            "--slug",
            type=str,
            help="Generate audio for a single post identified by slug.",
        )
        parser.add_argument(
            "--sno",
            type=int,
            help="Generate audio for a single post identified by sno.",
        )
        parser.add_argument(
            "--missing",
            action="store_true",
            help="Generate audio only for posts that do not yet have an audio file.",
        )
        parser.add_argument(
            "--stale",
            action="store_true",
            help="Regenerate audio for posts whose content has changed since audio synthesis.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force regeneration even if audio file exists and is up to date.",
        )
        parser.add_argument(
            "--provider",
            type=str,
            default="auto",
            choices=["auto", "edge", "gemini"],
            help="Audio synthesis provider ('auto', 'edge', 'gemini'). Default is 'auto'.",
        )
        parser.add_argument(
            "--voice",
            type=str,
            default=None,
            help="Voice identifier override (e.g. en-IN-NeerjaExpressiveNeural, Puck).",
        )

    def handle(self, *args, **options):
        slug = options.get("slug")
        sno = options.get("sno")
        generate_all = options.get("all")
        missing_only = options.get("missing")
        stale_only = options.get("stale")
        force = options.get("force")
        provider = options.get("provider") or "auto"
        voice = options.get("voice")

        posts = []

        if slug:
            post = Post.objects.filter(slug=slug).first()
            if not post:
                self.stderr.write(self.style.ERROR(f"Post with slug '{slug}' not found."))
                return
            posts = [post]
        elif sno:
            post = Post.objects.filter(sno=sno).first()
            if not post:
                self.stderr.write(self.style.ERROR(f"Post with sno '{sno}' not found."))
                return
            posts = [post]
        elif missing_only:
            posts = list(Post.objects.filter(audio_file="").exclude(content=""))
            # Also include status not ready
            not_ready = list(Post.objects.exclude(audio_status="ready").exclude(content=""))
            posts = list({p.sno: p for p in posts + not_ready}.values())
        elif stale_only:
            all_posts = Post.objects.exclude(content="")
            posts = [p for p in all_posts if p.is_audio_stale()]
        elif generate_all:
            posts = list(Post.objects.exclude(content=""))
        else:
            self.stdout.write(
                self.style.WARNING("No target specified. Defaulting to generating missing audio dispatches (--missing)...")
            )
            posts = list(Post.objects.filter(audio_file="").exclude(content=""))

        if not posts:
            self.stdout.write(self.style.SUCCESS("No posts matched the given criteria. Nothing to do."))
            return

        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f"Starting audio dispatch generation for {len(posts)} post(s) using voice '{voice}'..."
            )
        )

        success_count = 0
        skipped_count = 0
        error_count = 0

        for idx, post in enumerate(posts, 1):
            title_preview = (post.title[:45] + "...") if len(post.title) > 45 else post.title
            self.stdout.write(f"[{idx}/{len(posts)}] Processing sno={post.sno}: '{title_preview}' ... ", ending="")
            self.stdout.flush()

            # Check if skipping is appropriate
            if not force and post.audio_file and post.audio_status == "ready" and not post.is_audio_stale():
                self.stdout.write(self.style.WARNING("SKIPPED (Already up-to-date)"))
                skipped_count += 1
                continue

            try:
                ok = generate_post_audio(post, provider=provider, voice=voice, force=force)
                if ok:
                    post.refresh_from_db()
                    dur_min = post.audio_duration // 60
                    dur_sec = post.audio_duration % 60
                    size_kb = post.audio_file_size / 1024
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"DONE ({dur_min}m {dur_sec}s, {size_kb:.1f} KB, status={post.audio_status})"
                        )
                    )
                    success_count += 1
                else:
                    self.stdout.write(self.style.ERROR(f"FAILED (status={post.audio_status})"))
                    error_count += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"ERROR: {e}"))
                error_count += 1

        self.stdout.write(self.style.MIGRATE_HEADING("\n--- Generation Summary ---"))
        self.stdout.write(f"Total evaluated: {len(posts)}")
        self.stdout.write(self.style.SUCCESS(f"Succeeded:       {success_count}"))
        self.stdout.write(self.style.WARNING(f"Skipped:         {skipped_count}"))
        if error_count > 0:
            self.stdout.write(self.style.ERROR(f"Errors:          {error_count}"))
