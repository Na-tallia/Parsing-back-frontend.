from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, CartViewSet

# Создаем роутер и регистрируем наши ViewSets
router = DefaultRouter()
router.register(r'products', ProductViewSet)
router.register(r'cart', CartViewSet, basename='cart')

# URL-адреса приложения привязываются к роутеру автоматически
urlpatterns = [
    path('', include(router.urls)),
]