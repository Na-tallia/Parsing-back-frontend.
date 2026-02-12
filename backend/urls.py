from django.urls import path, include
from rest_framework.routers import DefaultRouter
from api.views import ProductViewSet, CartViewSet, update_products
from api import views as api_views
from django.contrib import admin

# Создаем роутер и регистрируем наши ViewSets
router = DefaultRouter()
router.register(r'products', ProductViewSet)
router.register(r'cart', CartViewSet, basename='cart')

# URL-адреса приложения привязываются к роутеру автоматически
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/update-products/', update_products, name='update-products'),
    path('api/auth/csrf/', api_views.csrf, name='auth-csrf'),
    path('api/auth/me/', api_views.me, name='auth-me'),
    path('api/auth/register/', api_views.register, name='auth-register'),
    path('api/auth/login/', api_views.login, name='auth-login'),
    path('api/auth/logout/', api_views.logout, name='auth-logout'),
    path('api/orders/create/', api_views.create_order, name='create-order'),
]

