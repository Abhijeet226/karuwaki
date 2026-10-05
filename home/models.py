from django.db import models
from datetime import date
from django.utils.timezone import now

class Contact(models.Model):
     sno= models.AutoField(primary_key=True)
     name= models.CharField(max_length=255)
     phone= models.CharField(max_length=13)
     email= models.CharField(max_length=100)
     content= models.TextField()
     timeStamp=models.DateTimeField(auto_now_add=True, blank=True)

     def __str__(self):
          return "Message from " + self.name + ' - ' + self.email




class Athereal(models.Model):
     date = models.DateField(default=now, unique=True, help_text="Date of cosmic alignment")
     tithi_title = models.CharField(max_length=200, default="AAJ KI TITHI", help_text="Title or Tithi Name (e.g., AAJ KI TITHI, Shukla Paksha Pratipada)")
     location = models.CharField(max_length=150, default="India")
     sunrise = models.CharField(max_length=50, default="5:23 a.m.")
     sunset = models.CharField(max_length=50, default="5:48 p.m.")
     moonrise = models.CharField(max_length=100, default="9:57 p.m.")
     moonset = models.CharField(max_length=100, default="12:06 p.m.")
     amrit_kaal = models.CharField(max_length=100, default="10:12 p.m. – 11:43 p.m.")
     rahu_kaal = models.CharField(max_length=100, default="1:09 p.m. – 2:42 p.m.")
     abhijit = models.CharField(max_length=100, default="11:11 a.m. – noon")
     nakshatra = models.CharField(max_length=100, blank=True, default="", help_text="e.g. Rohini, Ashwini, etc.")
     cosmic_insight = models.TextField(blank=True, default="", help_text="Daily AI Astrology guidance or ancient cosmic wisdom")
     created_at = models.DateTimeField(auto_now_add=True)
     updated_at = models.DateTimeField(auto_now=True)

     class Meta:
          verbose_name = "Athereal Astro Entry"
          verbose_name_plural = "Athereal Astro Entries"
          ordering = ['-date']

     def __str__(self):
          return f"{self.date} - {self.tithi_title} ({self.location})"


from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    bio = models.TextField(blank=True, max_length=500, default='')
    favorite_topic = models.CharField(max_length=100, blank=True, default='')
    saved_posts = models.ManyToManyField('blog.Post', blank=True, related_name='saved_by_profiles')
    post_reactions = models.JSONField(default=dict, blank=True)
    liked_comments = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"

    def __str__(self):
        return f"Profile of {self.user.username}"

@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)
    else:
        Profile.objects.get_or_create(user=instance)