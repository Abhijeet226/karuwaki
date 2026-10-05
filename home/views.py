from django.shortcuts import render, HttpResponse, redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from home.models import Contact, Athereal, Profile
from django.conf import settings
from home.forms import PasswordChangingForm
from django.contrib import messages 
from django.contrib.auth.forms import PasswordChangeForm
from django.contrib.auth.views import PasswordChangeView
from django.contrib.auth.models import User 
from django.contrib.auth  import authenticate,  login, logout
from blog.models import Post, Category
from django.urls import reverse_lazy
from django.db.models import Q
from django.core.cache import cache
import datetime
from datetime import date
import json
import requests


class PasswordsChangeView(PasswordChangeView):
    form_class = PasswordChangingForm
    template_name = 'home/change_password.html'
    success_url = reverse_lazy('user_profile')

    def form_valid(self, form):
        messages.success(self.request, "Your password has been cryptographically updated.")
        return super().form_valid(form)


def home(request): 
    category_menu = Category.objects.all()
    return render(request, "home/home.html",{'category_menu':category_menu})

def poetry_in_motion(request):
    return render(request, "home/poetry_in_motion.html")



def contact(request):
    if getattr(request, 'htmx', False) and request.method == "GET" and request.GET.get('new') == '1':
        return render(request, "home/partials/_contact_form.html")

    if request.method == "POST":
        name = request.POST.get('name', '').strip()
        email = request.POST.get('email', '').strip()
        phone = request.POST.get('phone', '').strip()
        content = request.POST.get('content', '').strip()

        error_msg = None
        if len(name) < 2:
            error_msg = "Please enter a valid name (at least 2 characters)."
        elif len(email) < 5 or '@' not in email:
            error_msg = "Please enter a valid email address."
        elif phone and len(phone) < 7:
            error_msg = "Please enter a valid phone number or leave it blank."
        elif len(content) < 4:
            error_msg = "Please provide more detail in your inquiry."

        if not error_msg:
            recaptcha_response = request.POST.get('g-recaptcha-response')
            if recaptcha_response and getattr(settings, 'GOOGLE_RECAPTCHA_SECRET_KEY', None):
                try:
                    r = requests.post('https://www.google.com/recaptcha/api/siteverify', data={
                        'secret': settings.GOOGLE_RECAPTCHA_SECRET_KEY,
                        'response': recaptcha_response
                    }, timeout=5)
                    result = r.json()
                    if not result.get('success'):
                        error_msg = 'reCAPTCHA verification failed. Please try again.'
                except Exception:
                    pass

        if error_msg:
            if getattr(request, 'htmx', False):
                return render(request, "home/partials/_contact_form.html", {'error': error_msg, 'values': request.POST})
            messages.error(request, error_msg)
        else:
            contact_obj = Contact(name=name, email=email, phone=phone, content=content)
            contact_obj.save()
            if getattr(request, 'htmx', False):
                response = render(request, "home/partials/_contact_success.html", {'name': name})
                response['HX-Trigger'] = json.dumps({"transmissionToast": {"message": "Inquiry transmitted to Editorial Desk.", "type": "success"}})
                return response
            messages.success(request, "Your message has been successfully sent")

    return render(request, "home/contact.html")

def search(request):
    query = request.GET.get('query', '').strip()
    if not query:
        allPosts = Post.objects.none()
    elif len(query) > 78:
        allPosts = Post.objects.none()
        messages.warning(request, "Search query exceeds maximum allowed length.")
    else:
        allPostsTitle = Post.objects.filter(Q(title__icontains=query) & Q(published=True))
        allPostsAuthor = Post.objects.filter(Q(author__icontains=query) & Q(published=True))
        allPostsContent = Post.objects.filter(Q(content__icontains=query) & Q(published=True))
        allPosts = allPostsTitle.union(allPostsContent, allPostsAuthor)
        if allPosts.count() == 0:
            messages.warning(request, "No search results found. Please refine your query.")
    params = {'allPosts': allPosts, 'query': query}
    return render(request, 'home/search.html', params)

def handleSignUp(request):
    if request.method=="POST":
        # Get the post parameters
        username=request.POST['username']
        email=request.POST['email']
        fname=request.POST['fname']
        lname=request.POST['lname']
        pass1=request.POST['pass1']
        pass2=request.POST['pass2']

        # check for errorneous input
        if len(username)>10:
            messages.error(request, " Your user name must be under 10 characters")
            return redirect('home')

        if not username.isalnum():
            messages.error(request, " User name should only contain letters and numbers")
            return redirect('home')
        if (pass1!= pass2):
             messages.error(request, " Passwords do not match")
             return redirect('home')
        elif User.objects.filter(email=email).exists():
            messages.error(request, " Email already registered")
            return redirect('home')
        elif User.objects.filter(username=username).exists():
            messages.error(request, " Username not available")
            return redirect('home')
        
        # Create the user
        myuser = User.objects.create_user(username, email, pass1)
        myuser.first_name= fname
        myuser.last_name= lname
        myuser.save()
        messages.success(request, " Your account has been successfully created")
        return redirect('home')

    else:
        return HttpResponse("404 - Not found")


def handleLogin(request):
    if request.method == "POST":
        loginusername = request.POST.get('loginusername', '')
        loginpassword = request.POST.get('loginpassword', '')

        user = authenticate(username=loginusername, password=loginpassword)
        target_url = request.META.get('HTTP_REFERER') or '/'
        if user is not None:
            login(request, user)
            messages.success(request, "Successfully Logged In")
            return redirect(target_url)
        else:
            messages.error(request, "Invalid credentials! Please try again")
            return redirect(target_url)

    return redirect('/')

# Backwards compatibility alias
handeLogin = handleLogin


def handleLogout(request):
    logout(request)
    messages.success(request, "Successfully logged out")
    target_url = request.META.get('HTTP_REFERER') or '/'
    return redirect(target_url)

# Backwards compatibility alias
handelLogout = handleLogout


def about(request): 
    return render(request, "home/about.html")
    
def privacy_policy(request):
    return render(request, "home/privacy_policy.html")

def athereal(request):
    from home.astro_math import compute_panchang
    search_date_str = request.GET.get('date', '').strip()
    selected_entry = None
    target_date = date.today()

    if search_date_str:
        try:
            target_date = datetime.datetime.strptime(search_date_str, "%Y-%m-%d").date()
            selected_entry = Athereal.objects.filter(date=target_date).first()
        except ValueError:
            target_date = date.today()

    if not selected_entry:
        selected_entry = Athereal.objects.filter(date=target_date).first()

    # Always compute baseline astronomical ephemeris for the requested date
    panchang = compute_panchang(target_date)
    if selected_entry:
        for attr in ['tithi_title', 'location', 'nakshatra', 'sunrise', 'sunset', 'moonrise', 'moonset', 'rahu_kaal', 'amrit_kaal', 'abhijit', 'cosmic_insight']:
            val = getattr(selected_entry, attr, None)
            if val:
                panchang[attr] = val
        panchang['is_admin_override'] = True
        panchang['source'] = "Admin Database Override"
    selected_entry = panchang

    recent_entries = Athereal.objects.order_by('-date')[:7]

    context = {
        'athereal': selected_entry,
        'search_date': target_date.strftime("%Y-%m-%d"),
        'not_found': False,
        'recent_entries': recent_entries,
    }
    return render(request, "home/athereal.html", context)

def api_athereal(request):
    from home.astro_math import compute_panchang, calculate_navagraha_positions, LAT, LON
    date_str = request.GET.get('date', '').strip()
    lat_param = request.GET.get('lat', '').strip()
    lon_param = request.GET.get('lon', '').strip()
    location_name = request.GET.get('location', '').strip() or "Bhubaneswar, Odisha"

    target_date = date.today()
    if date_str:
        try:
            target_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            target_date = date.today()

    try:
        lat = float(lat_param) if lat_param else LAT
        lon = float(lon_param) if lon_param else LON
    except ValueError:
        lat, lon = LAT, LON

    panchang = compute_panchang(target_date, lat=lat, lon=lon, location_name=location_name)

    db_entry = Athereal.objects.filter(date=target_date).first()
    if db_entry:
        for attr in ['tithi_title', 'location', 'nakshatra', 'sunrise', 'sunset', 'moonrise', 'moonset', 'rahu_kaal', 'amrit_kaal', 'abhijit', 'cosmic_insight']:
            val = getattr(db_entry, attr, None)
            if val:
                panchang[attr] = val
        panchang['is_admin_override'] = True
        panchang['source'] = "Admin Database Override"

    data = {
        'date': panchang['date'].strftime("%Y-%m-%d") if isinstance(panchang['date'], (datetime.date, datetime.datetime)) else str(panchang['date']),
        'date_formatted': panchang['date_formatted'],
        'location': panchang['location'],
        'coordinates': panchang['coordinates'],
        'tithi_title': panchang['tithi_title'],
        'nakshatra': panchang['nakshatra'],
        'moon_rashi': panchang.get('moon_rashi', ''),
        'moon_rashi_en': panchang.get('moon_rashi_en', ''),
        'sunrise': panchang['sunrise'],
        'sunset': panchang['sunset'],
        'moonrise': panchang['moonrise'],
        'moonset': panchang['moonset'],
        'rahu_kaal': panchang['rahu_kaal'],
        'amrit_kaal': panchang['amrit_kaal'],
        'abhijit': panchang['abhijit'],
        'cosmic_insight': panchang['cosmic_insight'],
        'planets': panchang['planets'],
        'gochar_transits': panchang.get('gochar_transits', {}),
        'source': panchang['source'],
        'is_admin_override': panchang.get('is_admin_override', False),
    }

    return JsonResponse({
        'status': 'success',
        'data': data
    })


def get_client_ip(request):
    """Safely extracts client IP address accounting for proxies."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip or '127.0.0.1'


@csrf_exempt
def api_karu_wisdom(request):
    """
    Lightweight AI query endpoint powered by Google Gemini API free tier.
    Falls back gracefully to curated historical/philosophical wisdom.
    Includes abuse prevention, IP rate limiting (20 req / 60s), and input capping (400 chars).
    """
    client_ip = get_client_ip(request)
    rate_key = f"karu_rate_{client_ip}"
    req_count = cache.get(rate_key, 0)
    if req_count >= 20:
        return JsonResponse({
            'success': False,
            'source': 'rate-limiter',
            'error': 'Rate limit reached. Please wait a moment before sending another inquiry.',
            'answer': 'You have reached the temporary query rate limit (20 inquiries/min). Please pause for a moment before continuing your inquiry.'
        }, status=429)
    cache.set(rate_key, req_count + 1, timeout=60)

    from home.karu_wisdom import ask_karu_wisdom
    query = ""
    if request.method == "POST":
        try:
            body = json.loads(request.body)
            query = body.get('query', '')
        except Exception:
            query = request.POST.get('query', '')
    else:
        query = request.GET.get('query', '')

    query = (query or "")[:400].strip()
    if not query:
        return JsonResponse({
            'success': False,
            'source': 'validation',
            'answer': 'Please enter a question or select an inquiry topic to consult Karu-Wisdom.'
        }, status=400)

    result = ask_karu_wisdom(query)
    return JsonResponse(result)


def api_kundali(request):
    """
    Vedic Kundali birth chart endpoint calculating Lagna, 9 Grahas, and 12 Bhavas.
    Shared-hosting optimized in-memory calculation.
    """
    from home.kundali_engine import calculate_birth_chart
    try:
        now = datetime.datetime.now()
        year = int(request.GET.get('year', now.year))
        month = int(request.GET.get('month', now.month))
        day = int(request.GET.get('day', now.day))
        hour = int(request.GET.get('hour', 12))
        minute = int(request.GET.get('minute', 0))
        lat = float(request.GET.get('lat', 28.6139))
        lon = float(request.GET.get('lon', 77.2090))
        tz_offset = float(request.GET.get('tz', 5.5))
    except (ValueError, TypeError) as e:
        return JsonResponse({'success': False, 'error': f'Invalid parameters: {str(e)}'}, status=400)

    result = calculate_birth_chart(year, month, day, hour, minute, lat, lon, tz_offset)
    return JsonResponse(result)



def ai_magazine(request):
    curated_articles = Post.objects.filter(published=True, ai_curated=True).order_by('-timeStamp')[:6]
    if not curated_articles.exists():
        curated_articles = Post.objects.filter(published=True).order_by('-views')[:6]
    return render(request, "home/ai_magazine.html", {'curated_articles': curated_articles})

def privacy_compliance(request):
    return render(request, "home/privacy_compliance.html")


from django.contrib.auth.decorators import login_required
from blog.models import BlogComment

@login_required(login_url='/')
def user_profile(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)

    if request.method == "POST":
        first_name = request.POST.get('first_name', '').strip()
        last_name = request.POST.get('last_name', '').strip()
        email = request.POST.get('email', '').strip()
        bio = request.POST.get('bio', '').strip()
        favorite_topic = request.POST.get('favorite_topic', '').strip()

        request.user.first_name = first_name
        request.user.last_name = last_name
        if email:
            request.user.email = email
        request.user.save()

        profile.bio = bio
        profile.favorite_topic = favorite_topic
        if request.FILES.get('avatar'):
            profile.avatar = request.FILES['avatar']
        profile.save()

        messages.success(request, "Your profile credentials have been updated successfully.")
        return redirect('user_profile')

    saved_posts = profile.saved_posts.filter(published=True).order_by('-timeStamp')
    comments_count = BlogComment.objects.filter(user=request.user).count()

    context = {
        'profile': profile,
        'saved_posts': saved_posts,
        'saved_count': saved_posts.count(),
        'comments_count': comments_count,
    }
    return render(request, "home/profile.html", context)


@login_required(login_url='/')
def toggle_save_post(request, slug):
    try:
        post = Post.objects.get(slug=slug)
    except Post.DoesNotExist:
        if getattr(request, 'htmx', False):
            return HttpResponse("Article not found", status=404)
        return JsonResponse({'error': 'Article not found'}, status=404)

    profile, _ = Profile.objects.get_or_create(user=request.user)
    if profile.saved_posts.filter(sno=post.sno).exists():
        profile.saved_posts.remove(post)
        is_saved = False
        msg = "Article removed from saved dispatches."
    else:
        profile.saved_posts.add(post)
        is_saved = True
        msg = "Article saved to your profile."

    if getattr(request, 'htmx', False):
        variant = request.GET.get('variant') or request.POST.get('variant')
        template_name = "home/partials/_bookmark_button_sidebar.html" if variant == 'sidebar' else "home/partials/_bookmark_button.html"
        response = render(request, template_name, {
            'post': post,
            'is_saved': is_saved
        })
        response['HX-Trigger'] = json.dumps({
            "transmissionToast": {
                "message": msg,
                "type": "success" if is_saved else "info"
            }
        })
        return response

    if request.headers.get('x-requested-with') == 'XMLHttpRequest' or request.GET.get('format') == 'json':
        return JsonResponse({
            'status': 'ok',
            'saved': is_saved,
            'message': msg,
            'total_saved': profile.saved_posts.count()
        })

    messages.info(request, msg)
    referer = request.META.get('HTTP_REFERER')
    return redirect(referer if referer else f'/blog/{slug}/')

def offline_vault(request):
    category_menu = Category.objects.all()
    return render(request, "home/offline.html", {'category_menu': category_menu})

