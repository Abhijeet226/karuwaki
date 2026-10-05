from karuwakiblog.settings import MEDIA_ROOT
from django.http.response import JsonResponse,Http404
from django.shortcuts import render, HttpResponse, redirect, get_object_or_404
from blog.models import Post, BlogComment, Category, Author
from django.contrib import messages
from django.contrib.auth.models import User
from blog.templatetags import extras
from django.db.models import Q, Sum, Count
from PIL import Image
from datetime import date

# Syndication Feed
from django.utils.feedgenerator import Rss201rev2Feed
from django.contrib.syndication.views import Feed
from django.urls import reverse
from django.utils.html import strip_tags
from django.template.defaultfilters import truncatewords

from django.utils import timezone
from django.core.paginator import Paginator

import re
import os
import json

from django.core.cache import cache

# Create your views here.
def get_cached_categories():
    categories = cache.get('global_categories_menu')
    if categories is None:
        categories = list(Category.objects.all())
        cache.set('global_categories_menu', categories, 600)
    return categories

def blogHome(request):
    now = timezone.now()
    posts_qs = Post.objects.filter(published=True, timeStamp__lte=now).select_related('category', 'author_profile').order_by('-timeStamp')

    # Real-time search query
    query = (request.GET.get('query') or request.GET.get('q') or '').strip()
    if query:
        posts_qs = posts_qs.filter(
            Q(title__icontains=query) |
            Q(content__icontains=query) |
            Q(author__icontains=query) |
            Q(category__name__icontains=query)
        )

    # Category filter
    selected_cat = request.GET.get('cat', '').strip()
    if selected_cat and selected_cat.lower() != 'all':
        posts_qs = posts_qs.filter(category__name__iexact=selected_cat)

    category_menu = get_cached_categories()
    trending_posts = Post.objects.filter(published=True, timeStamp__lte=now).select_related('category').order_by('-views')[:4]

    saved_ids = set()
    if request.user.is_authenticated and hasattr(request.user, 'profile'):
        saved_ids = set(request.user.profile.saved_posts.values_list('sno', flat=True))

    paginator = Paginator(posts_qs, 6)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    context = {
        'allPosts': posts_qs,
        'category_menu': category_menu,
        'trending_posts': trending_posts,
        'saved_ids': saved_ids,
        'page_obj': page_obj,
        'query': query,
        'selected_cat': selected_cat,
    }

    if getattr(request, 'htmx', False):
        return render(request, "blog/partials/_dispatch_grid.html", context)

    return render(request, "blog/blogHome.html", context)

def blogPost(request, slug, cats=None): 
    if request.user.is_staff:
        post = Post.objects.filter(slug=slug).select_related('author_profile', 'category').first()
    else:
        post = Post.objects.filter(slug=slug, published=True).select_related('author_profile', 'category').first()

    if not post:
        raise Http404("Dispatch not found or unpublished.")

    category_menu = get_cached_categories()

    # Increment view count
    post.views = post.views + 1
    post.save(update_fields=['views'])
    
    comments = BlogComment.objects.filter(post=post, parent=None).select_related('user')
    replies = BlogComment.objects.filter(post=post).exclude(parent=None).select_related('user')
    replyDict = {}
    for reply in replies:
        if reply.parent.sno not in replyDict.keys():
            replyDict[reply.parent.sno] = [reply]
        else:
            replyDict[reply.parent.sno].append(reply)

    related_posts = Post.objects.filter(category=post.category, published=True).exclude(sno=post.sno).order_by('-timeStamp')[:3]
    
    user_reaction = None
    is_saved = False
    if request.user.is_authenticated and hasattr(request.user, 'profile'):
        user_reaction = (request.user.profile.post_reactions or {}).get(str(post.sno))
        is_saved = request.user.profile.saved_posts.filter(sno=post.sno).exists()
    if not user_reaction:
        user_reaction = request.session.get('post_reactions', {}).get(str(post.sno))

    liked_comments = set(request.session.get('liked_comments', []))
    if request.user.is_authenticated and hasattr(request.user, 'profile'):
        liked_comments.update(request.user.profile.liked_comments or [])

    context = {
        'post': post,
        'comments': comments,
        'user': request.user,
        'replyDict': replyDict,
        'category_menu': category_menu,
        'related_posts': related_posts,
        'user_reaction': user_reaction,
        'is_saved': is_saved,
        'liked_comments': liked_comments,
    }
    return render(request, "blog/blogPost.html", context)

def author_posts(request, slug):
    author = get_object_or_404(Author, slug=slug)
    now = timezone.now()
    
    # Filter posts linked to author_profile OR matching legacy text author name
    posts_qs = Post.objects.filter(
        Q(author_profile=author) | Q(author__iexact=author.name),
        published=True,
        timeStamp__lte=now
    ).select_related('category', 'author_profile').order_by('-timeStamp')
    
    total_posts = posts_qs.count()
    total_views = posts_qs.aggregate(Sum('views'))['views__sum'] or 0
    category_menu = get_cached_categories()

    saved_ids = set()
    if request.user.is_authenticated and hasattr(request.user, 'profile'):
        saved_ids = set(request.user.profile.saved_posts.values_list('sno', flat=True))

    paginator = Paginator(posts_qs, 6)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    context = {
        'author': author,
        'page_obj': page_obj,
        'total_posts': total_posts,
        'total_views': total_views,
        'saved_ids': saved_ids,
        'category_menu': category_menu,
    }
    return render(request, "blog/author_posts.html", context)

def authors_list(request):
    authors = Author.objects.annotate(
        num_posts=Count('posts', filter=Q(posts__published=True))
    ).order_by('-featured', '-num_posts', 'name')
    
    category_menu = get_cached_categories()
    context = {
        'authors': authors,
        'category_menu': category_menu,
    }
    return render(request, "blog/authors_list.html", context)

def postComment(request):
    if request.method == "POST":
        comment = request.POST.get('comment', '').strip()
        if not comment:
            if getattr(request, 'htmx', False):
                return HttpResponse("Comment cannot be empty.", status=400)
            if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.POST.get('ajax') == '1':
                return JsonResponse({'status': 'error', 'message': 'Comment text cannot be empty'}, status=400)
            return redirect('bloghome')

        if request.user.is_authenticated:
            user = request.user
        else:
            user, _ = User.objects.get_or_create(username='AnonymousUser', defaults={'email': 'anonymous@example.com'})
        
        postSno = request.POST.get('postSno')
        post = get_object_or_404(Post, sno=postSno)
        parentSno = request.POST.get('parentSno', '').strip()

        if not parentSno:
            new_comment = BlogComment(comment=comment, user=user, post=post)
            new_comment.save()
            messages.success(request, "Your comment has been posted successfully")
        else:
            parent = get_object_or_404(BlogComment, sno=parentSno)
            new_comment = BlogComment(comment=comment, user=user, post=post, parent=parent)
            new_comment.save()
            messages.success(request, "Your reply has been posted successfully")

        if getattr(request, 'htmx', False):
            total_comments = BlogComment.objects.filter(post=post, is_deleted=False).count()
            if parentSno:
                response = render(request, "blog/partials/_reply_item.html", {
                    'reply': new_comment,
                    'post': post,
                    'request': request,
                    'total_comments': total_comments,
                    'oob_badge': True,
                })
                response['HX-Trigger'] = json.dumps({"transmissionToast": {"message": "Reply transmitted successfully.", "type": "success"}})
                return response
            else:
                response = render(request, "blog/partials/_comment_item.html", {
                    'comment': new_comment,
                    'post': post,
                    'request': request,
                    'replyDict': {},
                    'total_comments': total_comments,
                    'oob_badge': True,
                })
                response['HX-Trigger'] = json.dumps({"transmissionToast": {"message": "Comment transmitted successfully.", "type": "success"}})
                return response

        if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.POST.get('ajax') == '1':
            is_author = (user.username.lower() == post.author.lower() or user.is_staff)
            return JsonResponse({
                'status': 'success',
                'sno': new_comment.sno,
                'comment': new_comment.comment,
                'username': user.username,
                'avatar': user.username[:1].upper(),
                'timestamp': 'Just now',
                'is_parent': not bool(parentSno),
                'parent_sno': parentSno,
                'is_author': is_author,
                'can_edit': True,
                'likes': 0
            })
        
        return redirect(f"/blog/{post.slug}")
    return redirect('bloghome')


def editComment(request):
    if request.method == "GET":
        comment_sno = request.GET.get('comment_sno')
        try:
            comment_obj = BlogComment.objects.get(sno=comment_sno)
        except BlogComment.DoesNotExist:
            return HttpResponse("Comment not found", status=404)

        post = comment_obj.post
        if request.GET.get('cancel') == '1':
            if comment_obj.parent:
                return render(request, "blog/partials/_reply_item.html", {'reply': comment_obj, 'post': post, 'request': request})
            replyDict = {comment_obj.sno: list(BlogComment.objects.filter(parent=comment_obj).select_related('user'))}
            return render(request, "blog/partials/_comment_item.html", {'comment': comment_obj, 'post': post, 'request': request, 'replyDict': replyDict})

        return render(request, "blog/partials/_comment_edit_form.html", {'comment': comment_obj, 'post': post, 'request': request})

    if request.method == "POST":
        if not request.user.is_authenticated:
            if getattr(request, 'htmx', False):
                return HttpResponse("Authentication required to edit comments", status=403)
            return JsonResponse({'status': 'error', 'message': 'Authentication required to edit comments'}, status=403)

        comment_sno = request.POST.get('comment_sno')
        new_text = request.POST.get('comment', '').strip()

        if not new_text:
            if getattr(request, 'htmx', False):
                return HttpResponse("Comment text cannot be empty", status=400)
            return JsonResponse({'status': 'error', 'message': 'Comment text cannot be empty'}, status=400)

        try:
            comment_obj = BlogComment.objects.get(sno=comment_sno)
        except BlogComment.DoesNotExist:
            if getattr(request, 'htmx', False):
                return HttpResponse("Comment not found", status=404)
            return JsonResponse({'status': 'error', 'message': 'Comment not found'}, status=404)

        if comment_obj.user != request.user and not request.user.is_staff:
            if getattr(request, 'htmx', False):
                return HttpResponse("Permission denied", status=403)
            return JsonResponse({'status': 'error', 'message': 'Permission denied: you can only edit your own comments'}, status=403)

        comment_obj.comment = new_text
        comment_obj.is_edited = True
        comment_obj.edited_at = timezone.now()
        comment_obj.save()

        if getattr(request, 'htmx', False):
            post = comment_obj.post
            if comment_obj.parent:
                response = render(request, "blog/partials/_reply_item.html", {'reply': comment_obj, 'post': post, 'request': request})
            else:
                replyDict = {comment_obj.sno: list(BlogComment.objects.filter(parent=comment_obj).select_related('user'))}
                response = render(request, "blog/partials/_comment_item.html", {'comment': comment_obj, 'post': post, 'request': request, 'replyDict': replyDict})
            response['HX-Trigger'] = json.dumps({"transmissionToast": {"message": "Perspective updated successfully.", "type": "success"}})
            return response

        return JsonResponse({
            'status': 'success',
            'comment': comment_obj.comment,
            'edited_at': 'just now'
        })
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)


def deleteComment(request):
    if request.method == "POST":
        if not request.user.is_authenticated:
            if getattr(request, 'htmx', False):
                return HttpResponse("Authentication required to delete comments", status=403)
            return JsonResponse({'status': 'error', 'message': 'Authentication required to delete comments'}, status=403)

        comment_sno = request.POST.get('comment_sno')
        try:
            comment_obj = BlogComment.objects.get(sno=comment_sno)
        except BlogComment.DoesNotExist:
            if getattr(request, 'htmx', False):
                return HttpResponse("Comment not found", status=404)
            return JsonResponse({'status': 'error', 'message': 'Comment not found'}, status=404)

        if comment_obj.user != request.user and not request.user.is_staff:
            if getattr(request, 'htmx', False):
                return HttpResponse("Permission denied", status=403)
            return JsonResponse({'status': 'error', 'message': 'Permission denied: you can only delete your own comments'}, status=403)

        post = comment_obj.post
        has_replies = BlogComment.objects.filter(parent=comment_obj).exists()

        if getattr(request, 'htmx', False):
            if has_replies:
                comment_obj.is_deleted = True
                comment_obj.comment = "[This perspective was removed by the author]"
                comment_obj.save()
                total_comments = BlogComment.objects.filter(post=post, is_deleted=False).count()
                if comment_obj.parent:
                    response = render(request, "blog/partials/_reply_item.html", {'reply': comment_obj, 'post': post, 'request': request, 'total_comments': total_comments, 'oob_badge': True})
                else:
                    replyDict = {comment_obj.sno: list(BlogComment.objects.filter(parent=comment_obj).select_related('user'))}
                    response = render(request, "blog/partials/_comment_item.html", {'comment': comment_obj, 'post': post, 'request': request, 'replyDict': replyDict, 'total_comments': total_comments, 'oob_badge': True})
                response['HX-Trigger'] = json.dumps({"transmissionToast": {"message": "Perspective removed (replies preserved).", "type": "info"}})
                return response
            else:
                comment_obj.delete()
                total_comments = BlogComment.objects.filter(post=post, is_deleted=False).count()
                oob_badge = f'<span id="comments-count-badge" hx-swap-oob="true" style="font-size:13px; font-family:var(--font-sans); font-weight:700; color:var(--accent-green); background:rgba(193,255,114,0.1); padding:2px 10px; border-radius:50px; margin-left:6px;">{total_comments}</span>'
                response = HttpResponse(oob_badge)
                response['HX-Trigger'] = json.dumps({"transmissionToast": {"message": "Perspective removed from dispatch.", "type": "info"}})
                return response

        # Non-HTMX fallback
        if has_replies:
            comment_obj.is_deleted = True
            comment_obj.comment = "[This perspective was removed by the author]"
            comment_obj.save()
            return JsonResponse({
                'status': 'soft_deleted',
                'message': '[This perspective was removed by the author]'
            })
        else:
            comment_obj.delete()
            return JsonResponse({'status': 'deleted'})

    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)


def likeComment(request):
    if request.method == "POST":
        comment_sno = request.POST.get('comment_sno')
        if not comment_sno:
            if getattr(request, 'htmx', False):
                return HttpResponse("Comment identifier missing", status=400)
            return JsonResponse({'status': 'error', 'message': 'Comment identifier missing'}, status=400)

        try:
            comment_obj = BlogComment.objects.select_related('user').get(sno=comment_sno)
        except (BlogComment.DoesNotExist, ValueError):
            if getattr(request, 'htmx', False):
                return HttpResponse("Comment not found", status=404)
            return JsonResponse({'status': 'error', 'message': 'Comment not found'}, status=404)

        # 1. Block self-resonance (author cannot resonate with their own comment)
        if request.user.is_authenticated and comment_obj.user == request.user:
            if getattr(request, 'htmx', False):
                response = render(request, "blog/partials/_resonate_button.html", {
                    'comment': comment_obj,
                    'is_resonated': False,
                    'request': request
                })
                response['HX-Trigger'] = json.dumps({
                    "transmissionToast": {
                        "message": "You cannot resonate with your own perspective.",
                        "type": "warning"
                    }
                })
                return response
            return JsonResponse({
                'status': 'error',
                'message': 'You cannot resonate with your own perspective.'
            }, status=400)

        # 2. Retrieve existing liked comments for session & user profile
        session_likes = set(request.session.get('liked_comments', []))
        user_profile = None
        if request.user.is_authenticated and hasattr(request.user, 'profile'):
            user_profile = request.user.profile
            profile_likes = set(user_profile.liked_comments or [])
            all_likes = session_likes | profile_likes
        else:
            all_likes = session_likes

        c_sno = int(comment_obj.sno)
        c_sno_str = str(c_sno)
        already_resonated = (c_sno in all_likes) or (c_sno_str in all_likes)

        if already_resonated:
            # Toggle OFF: un-resonate
            comment_obj.likes = max(0, comment_obj.likes - 1)
            comment_obj.save(update_fields=['likes'])
            all_likes.discard(c_sno)
            all_likes.discard(c_sno_str)
            is_resonated = False
            toast_msg = "Resonance removed."
            toast_type = "info"
        else:
            # Toggle ON: resonate
            comment_obj.likes += 1
            comment_obj.save(update_fields=['likes'])
            all_likes.add(c_sno)
            is_resonated = True
            toast_msg = "Resonated with perspective ⚡"
            toast_type = "success"

        # Persist updated resonance set
        request.session['liked_comments'] = list(all_likes)
        request.session.modified = True

        if user_profile:
            user_profile.liked_comments = list(all_likes)
            user_profile.save(update_fields=['liked_comments'])

        if getattr(request, 'htmx', False):
            response = render(request, "blog/partials/_resonate_button.html", {
                'comment': comment_obj,
                'is_resonated': is_resonated,
                'liked_comments': all_likes,
                'request': request
            })
            response['HX-Trigger'] = json.dumps({
                "transmissionToast": {
                    "message": toast_msg,
                    "type": toast_type
                }
            })
            return response

        return JsonResponse({
            'status': 'success',
            'likes': comment_obj.likes,
            'is_resonated': is_resonated
        })

    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)


def reactPost(request):
    if request.method == "GET":
        post_sno = request.GET.get('post_sno')
        try:
            post_obj = Post.objects.get(sno=post_sno)
        except (Post.DoesNotExist, ValueError):
            if getattr(request, 'htmx', False):
                return HttpResponse("Post not found", status=404)
            return JsonResponse({'status': 'error', 'message': 'Post not found'}, status=404)

        user_reaction = None
        if request.user.is_authenticated and hasattr(request.user, 'profile'):
            user_reaction = (request.user.profile.post_reactions or {}).get(str(post_obj.sno))
        if not user_reaction:
            user_reaction = request.session.get('post_reactions', {}).get(str(post_obj.sno))

        if getattr(request, 'htmx', False):
            return render(request, "blog/partials/_reaction_matrix.html", {
                'post': post_obj,
                'user_reaction': user_reaction
            })

        return JsonResponse({
            'status': 'success',
            'reactions': post_obj.reactions or {},
            'user_reaction': user_reaction
        })

    if request.method == "POST":
        post_sno = request.POST.get('post_sno')
        reaction_type = request.POST.get('reaction', '').strip().lower()
        valid_reactions = {'mindblown', 'insightful', 'timeless', 'inspiring', 'provocative'}

        if reaction_type not in valid_reactions:
            if getattr(request, 'htmx', False):
                return HttpResponse("Invalid reaction type", status=400)
            return JsonResponse({'status': 'error', 'message': 'Invalid reaction type'}, status=400)

        try:
            post_obj = Post.objects.get(sno=post_sno)
        except Post.DoesNotExist:
            if getattr(request, 'htmx', False):
                return HttpResponse("Post not found", status=404)
            return JsonResponse({'status': 'error', 'message': 'Post not found'}, status=404)

        current_reactions = post_obj.reactions or {}
        post_reactions_session = request.session.get('post_reactions', {})

        user_profile = None
        previous_reaction = None
        if request.user.is_authenticated and hasattr(request.user, 'profile'):
            user_profile = request.user.profile
            previous_reaction = (user_profile.post_reactions or {}).get(str(post_obj.sno))

        if not previous_reaction:
            previous_reaction = post_reactions_session.get(str(post_obj.sno))

        if previous_reaction == reaction_type:
            # Toggle off: reader tapped active reaction again
            current_reactions[reaction_type] = max(0, current_reactions.get(reaction_type, 1) - 1)
            if str(post_obj.sno) in post_reactions_session:
                del post_reactions_session[str(post_obj.sno)]
            if user_profile:
                if user_profile.post_reactions and str(post_obj.sno) in user_profile.post_reactions:
                    del user_profile.post_reactions[str(post_obj.sno)]
                    user_profile.save(update_fields=['post_reactions'])
            active_reaction = None
        else:
            # Switch from previous reaction if present
            if previous_reaction and previous_reaction in current_reactions:
                current_reactions[previous_reaction] = max(0, current_reactions.get(previous_reaction, 1) - 1)

            # Increment new reaction
            current_reactions[reaction_type] = current_reactions.get(reaction_type, 0) + 1
            post_reactions_session[str(post_obj.sno)] = reaction_type
            if user_profile:
                if user_profile.post_reactions is None:
                    user_profile.post_reactions = {}
                user_profile.post_reactions[str(post_obj.sno)] = reaction_type
                user_profile.save(update_fields=['post_reactions'])
            active_reaction = reaction_type

        request.session['post_reactions'] = post_reactions_session
        post_obj.reactions = current_reactions
        post_obj.save(update_fields=['reactions'])

        if getattr(request, 'htmx', False):
            toast_msg = f"Resonated: {active_reaction.upper()} ✨" if active_reaction else "Resonance frequency removed."
            response = render(request, "blog/partials/_reaction_matrix.html", {
                'post': post_obj,
                'user_reaction': active_reaction
            })
            response['HX-Trigger'] = json.dumps({"transmissionToast": {"message": toast_msg, "type": "success" if active_reaction else "info"}})
            return response

        return JsonResponse({
            'status': 'success',
            'reactions': post_obj.reactions,
            'user_reaction': active_reaction
        })

    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=405)


# def articleCategory(request, cats):
#     category_menu = Category.objects.all()
#     category_posts = Post.objects.filter(category__name__contains=cats.replace('-',' '))
#     return render(request, "blog/categories.html",{'cats':cats.title().replace('-',' '), 'category_posts':category_posts,'category_menu':category_menu})

def articleCategory(request, cats):
    now = timezone.now()
    category_menu = Category.objects.all()
    # category_posts = Post.objects.filter(category__name__contains=cats).order_by('-timeStamp')
    category_posts= Post.objects.filter(published=True,timeStamp__lte=now, category__name__contains=cats).order_by('-timeStamp')
    paginator= Paginator(category_posts,6)
    page_number = request.GET.get('page')
    
    page_obj = paginator.get_page(page_number)  # returns the desired page object
    


    return render(request, "blog/categories.html",{'cats':cats.title().replace('-',' '), 'category_posts':category_posts,'category_menu':category_menu, 'page_obj':page_obj})



def imgUpload(request):
    if request.method == "POST" and request.FILES.get('file'):
        today = date.today()
        img_file = request.FILES['file']
        
        # Absolute save directory inside MEDIA_ROOT
        upload_dir = os.path.join(MEDIA_ROOT, 'images', 'upload', str(today))
        os.makedirs(upload_dir, exist_ok=True)
        
        # Sanitize filename and enforce .webp extension
        base_name, _ = os.path.splitext(img_file.name.replace(' ', '_'))
        webp_filename = f"{base_name}.webp"
        save_path = os.path.join(upload_dir, webp_filename)
        
        # Open via Pillow, convert modes appropriately, and save as WebP
        img_obj = Image.open(img_file)
        if img_obj.mode not in ('RGB', 'RGBA'):
            img_obj = img_obj.convert('RGBA' if 'transparency' in img_obj.info else 'RGB')

        # Resize if width exceeds 1600px for optimal loading
        if img_obj.width > 1600:
            ratio = 1600 / img_obj.width
            new_height = int(img_obj.height * ratio)
            img_obj = img_obj.resize((1600, new_height), Image.Resampling.LANCZOS)

        img_obj.save(save_path, 'WEBP', quality=85, method=6)
        
        # Public URL served dynamically by Django media route
        location_url = f"/Karuwaki/media/images/upload/{today}/{webp_filename}"
        return JsonResponse({"location": location_url})
    else:
        raise Http404("Page Does Not Exist")

class ExtendedRSSFeed(Rss201rev2Feed):
    """
    Create a standard RSS feed that includes content:encoded elements.
    """
    def root_attributes(self):
        attrs = super(ExtendedRSSFeed, self).root_attributes()
        attrs['xmlns:content'] = 'http://purl.org/rss/1.0/modules/content/'
        return attrs

    def add_item_elements(self, handler, item):
        super(ExtendedRSSFeed, self).add_item_elements(handler, item)
        handler.startElement(u"content:encoded", {})
        content = '<![CDATA['
        content += item['content_encoded']
        content += ']]>'
        handler._write(content)
        handler.endElement(u"content:encoded")

class LatestEntriesFeed(Feed):
    feed_type = ExtendedRSSFeed

    def item_extra_kwargs(self, item):
        return {'content_encoded': self.item_content_encoded(item)}

    link = "/blog/"

    def items(self):
        return Post.objects.filter(published=True).order_by('-timeStamp')[:15]

    def item_title(self, item):
        return item.title

    def item_description(self, item):
        mystr = truncatewords(item.content, 30)
        return strip_tags(mystr)
    
    def item_author_name(self, item):
        return item.author
    
    def item_pubdate(self, item):
        return item.timeStamp

    def item_link(self, item):
        return reverse("blogPost", args=[item.slug])
    
    def item_content_encoded(self, item):
        return item.content or ""


def stream_dispatch_audio(request, sno):
    """
    Enterprise audio dispatch streaming view with full HTTP 206 Partial Content (Byte Range) support.
    Streams active DispatchAudioTrack (or post.audio_file) with low-latency seeking.
    """
    from django.http import StreamingHttpResponse, FileResponse
    post = get_object_or_404(Post, sno=sno)
    
    # Try primary track first, then fallback to post.audio_file
    track = post.primary_audio_track
    audio_field = track.audio_file if track and track.audio_file else post.audio_file

    if not audio_field or not os.path.exists(audio_field.path):
        raise Http404("Audio dispatch file not found.")

    file_path = audio_field.path
    file_size = os.path.getsize(file_path)
    content_type = "audio/mpeg"

    range_header = request.META.get('HTTP_RANGE', '').strip()
    range_match = re.match(r'bytes=(\d+)-(\d*)', range_header)

    if range_match:
        start = int(range_match.group(1))
        end = int(range_match.group(2)) if range_match.group(2) else file_size - 1
        if start >= file_size:
            response = HttpResponse(status=416)
            response['Content-Range'] = f'bytes */{file_size}'
            return response

        end = min(end, file_size - 1)
        length = end - start + 1

        def file_iterator(path, offset, length_to_read, chunk_size=32768):
            with open(path, 'rb') as f:
                f.seek(offset)
                remaining = length_to_read
                while remaining > 0:
                    read_len = min(remaining, chunk_size)
                    data = f.read(read_len)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        response = StreamingHttpResponse(
            file_iterator(file_path, start, length),
            status=206,
            content_type=content_type
        )
        response['Content-Length'] = str(length)
        response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
    else:
        response = FileResponse(open(file_path, 'rb'), content_type=content_type)
        response['Content-Length'] = str(file_size)

    response['Accept-Ranges'] = 'bytes'
    response['Cache-Control'] = 'no-cache, must-revalidate'
    response['Pragma'] = 'no-cache'
    provider = track.provider if track else getattr(post, 'preferred_audio_provider', 'edge')
    etag = f"{provider}-{(track.content_hash if track else post.audio_content_hash) or str(file_size)}"
    response['ETag'] = f'"{etag}"'
    return response


def get_dispatch_audio_info(request, sno):
    """
    Returns JSON metadata for a post's audio dispatch.
    """
    post = get_object_or_404(Post, sno=sno)
    track = post.primary_audio_track
    has_audio = bool((track and track.audio_file and os.path.exists(track.audio_file.path)) or (post.audio_file and os.path.exists(post.audio_file.path)))

    return JsonResponse({
        "sno": post.sno,
        "slug": post.slug,
        "status": track.status if track else post.audio_status,
        "has_audio": has_audio,
        "stream_url": reverse("stream_dispatch_audio", args=[post.sno]) if has_audio else None,
        "duration": track.duration if track else post.audio_duration,
        "file_size": track.file_size if track else post.audio_file_size,
        "provider": track.provider if track else "edge",
        "language": track.language if track else "en",
        "voice": track.voice_name if track else post.audio_voice,
        "is_stale": track.is_stale() if track else post.is_audio_stale(),
        "updated_at": (track.updated_at if track else post.audio_updated_at).isoformat() if (track or post.audio_updated_at) else None,
    })

