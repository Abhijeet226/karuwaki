from django.contrib import admin
from django.urls import path, include
from home import views
from django.contrib.auth  import views as auth_views

urlpatterns = [
    path('', views.home, name="home"),
    path('athereal/', views.athereal, name="athereal"),
    path('athereal', views.athereal, name="athereal_slash"),
    path('api/athereal/', views.api_athereal, name="api_athereal"),
    path('api/athereal', views.api_athereal, name="api_athereal_slash"),
    path('api/karu-wisdom/', views.api_karu_wisdom, name="api_karu_wisdom"),
    path('api/karu-wisdom', views.api_karu_wisdom, name="api_karu_wisdom_slash"),
    path('api/kundali/', views.api_kundali, name="api_kundali"),
    path('api/kundali', views.api_kundali, name="api_kundali_slash"),
    path('ai-magazine/', views.ai_magazine, name="ai_magazine"),
    path('ai-magazine', views.ai_magazine, name="ai_magazine_slash"),
    path('privacy-compliance/', views.privacy_compliance, name="privacy-compliance"),
    path('privacy-compliance', views.privacy_compliance, name="privacy_compliance_slash"),

    path('contact/', views.contact, name="contact"),
    path('contact', views.contact, name="contact_noslash"),
    path('poetry-in-motion/', views.poetry_in_motion, name="poetry_in_motion_canonical"),
    path('poetry-in-motion', views.poetry_in_motion, name="poetry_in_motion_noslash"),
    path('poetry_in_motion/', views.poetry_in_motion, name="poetry_in_motion_slash"),
    path('poetry_in_motion', views.poetry_in_motion, name="poetry_in_motion"),
    path('privacy_policy/', views.privacy_policy, name="privacy_policy"),
    path('privacy_policy', views.privacy_policy, name="privacy_policy_noslash"),

    path('about/', views.about, name="about"),
    path('about', views.about, name="about_noslash"),
    path('search', views.search, name="search"),
    path('search/', views.search, name="search_slash"),
    path('signup/', views.handleSignUp, name="signup"),
    path('signup', views.handleSignUp, name="handleSignUp"),
    path('login/', views.handeLogin, name="login"),
    path('login', views.handeLogin, name="handleLogin"),
    path('logout/', views.handelLogout, name="kspeaks_logout"),
    path('logout', views.handelLogout, name="handleLogout"),
    path('change_password', views.PasswordsChangeView.as_view(template_name='home/change_password.html'), name='changePassword'),
    path('profile/', views.user_profile, name="user_profile"),
    path('post/save/<str:slug>/', views.toggle_save_post, name="toggle_save_post"),

    path('reset_password/', auth_views.PasswordResetView.as_view(template_name='home/reset_password.html'), name="reset_password"),
    path('reset_password_sent/', auth_views.PasswordResetDoneView.as_view(template_name='home/password_reset_sent.html'), name="password_reset_done"),
    path('reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(template_name='home/password_reset_form.html'), name="password_reset_confirm"),
    path('reset_password_complete/', auth_views.PasswordResetCompleteView.as_view(template_name='home/password_reset_complete.html'), name="password_reset_complete"),
]
