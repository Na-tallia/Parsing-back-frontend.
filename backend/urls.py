from django.urls import path, include
from rest_framework.routers import DefaultRouter
from api.views import ProductViewSet, CartViewSet, update_products
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
]

