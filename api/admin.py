from django.contrib import admin
from .models import Product, CartItem, UserProfile, Order

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('title', 'price', 'external_id')
    search_fields = ('title',)

@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ('user', 'product', 'quantity', 'added_at')

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('email', 'user', 'created_at')
    search_fields = ('email',)
    readonly_fields = ('created_at',)

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'full_name', 'phone', 'city', 'total_price', 'delivery_date', 'delivery_time', 'created_at')
    list_filter = ('city', 'delivery_date', 'created_at')
    search_fields = ('full_name', 'phone', 'delivery_address')
    readonly_fields = ('created_at',)