from django.db import models
from django.contrib.auth.models import User


# Модель для хранения информации о телевизорах
class Product(models.Model):
    # TextField подходит для длинных названий с характеристиками
    title = models.TextField(verbose_name="Название и описание")

    # DecimalField — идеальный тип для денег (точность до 2 знаков)
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Цена (BYN)")

    # Ссылка на изображение, которое мы спарсим
    image_url = models.URLField(max_length=500, verbose_name="Ссылка на изображение")

    # Уникальный идентификатор товара с сайта (например, часть URL или артикул)
    # Это нужно парсеру, чтобы не создавать дубликаты одного и того же товара
    external_id = models.CharField(max_length=255, unique=True, verbose_name="Внешний ID")

    def __str__(self):
        return self.title


# Модель для корзины
class CartItem(models.Model):
    # Привязываем товар к конкретному пользователю
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cart_items')

    # Привязываем к модели товара
    product = models.ForeignKey(Product, on_delete=models.CASCADE)

    # Количество (по умолчанию 1)
    quantity = models.PositiveIntegerField(default=1)

    # Дата добавления в корзину
    added_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.product.title}"

# Create your models here.
