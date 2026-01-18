from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from .models import Product, CartItem
from .serializers import ProductSerializer, CartItemSerializer

# Представление для товаров
class ProductViewSet(viewsets.ModelViewSet):
    """
    Автоматически предоставляет действия 'list' (список) и 'retrieve' (один товар).
    """
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    # Разрешаем просматривать товары всем, даже неавторизованным
    permission_classes = [permissions.AllowAny]

# Представление для корзины
class CartViewSet(viewsets.ModelViewSet):
    """
    Обрабатывает логику корзины для текущего пользователя.
    """
    serializer_class = CartItemSerializer
    # Только авторизованные пользователи могут управлять корзиной
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Пользователь видит только свои товары в корзине
        return CartItem.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # При добавлении товара в корзину автоматически привязываем его к текущему юзеру
        # Если товар уже есть, можно было бы увеличить количество, но для простоты просто добавляем запись
        serializer.save(user=self.request.user)

# Create your views here.
