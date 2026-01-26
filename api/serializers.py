from rest_framework import serializers
from .models import Product, CartItem

# Сериализатор для товаров
class ProductSerializer(serializers.ModelSerializer):
    # Явно указываем формат цены для правильной сериализации DecimalField
    price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    
    class Meta:
        model = Product
        # Указываем, какие поля мы хотим отправлять на фронтенд
        fields = ['id', 'title', 'price', 'image_url', 'external_id']

# Сериализатор для элементов корзины
class CartItemSerializer(serializers.ModelSerializer):
    # Включаем полную информацию о продукте, а не только его ID
    product = ProductSerializer(read_only=True)
    # Поле для записи (когда отправляем только ID продукта при добавлении)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        source='product',
        write_only=True
    )

    class Meta:
        model = CartItem
        fields = ['id', 'product', 'product_id', 'quantity', 'added_at']