from django.urls import path

from . import views

urlpatterns = [
    path("auth/config/", views.config),
    path("auth/register/", views.register),
    path("auth/login/", views.login),
    path("auth/google/", views.google_login),
    path("auth/forgot/", views.forgot_password),
    path("auth/reset/", views.reset_password),
    path("auth/logout/", views.logout),
    path("auth/me/", views.me),
    path("auth/password/", views.change_password),
]
