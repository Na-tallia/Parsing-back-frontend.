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


# Данные каждого зарегистрированного пользователя (сохраняются один раз при регистрации)
class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    email = models.EmailField(verbose_name="Электронная почта")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата регистрации")

    class Meta:
        verbose_name = "Профиль пользователя"
        verbose_name_plural = "Профили пользователей"

    def __str__(self):
        return self.email


# Модель заказа
class Order(models.Model):
    CITY_CHOICES = [
        ('Минск', 'Минск'),
        ('Брест', 'Брест'),
        ('Витебск', 'Витебск'),
        ('Гомель', 'Гомель'),
        ('Гродно', 'Гродно'),
        ('Могилев', 'Могилев'),
    ]
    
    TIME_SLOTS = [
        ('9:00-11:00', '9:00-11:00'),
        ('11:00-13:00', '11:00-13:00'),
        ('13:00-15:00', '13:00-15:00'),
        ('15:00-17:00', '15:00-17:00'),
        ('17:00-19:00', '17:00-19:00'),
        ('19:00-21:00', '19:00-21:00'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders', null=True, blank=True)
    full_name = models.CharField(max_length=200, verbose_name="ФИО")
    phone = models.CharField(max_length=20, verbose_name="Телефон")
    city = models.CharField(max_length=50, choices=CITY_CHOICES, verbose_name="Город")
    delivery_address = models.TextField(verbose_name="Адрес доставки")
    delivery_date = models.DateField(verbose_name="Дата доставки")
    delivery_time = models.CharField(max_length=20, choices=TIME_SLOTS, verbose_name="Время доставки")
    total_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Общая сумма")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Дата создания заказа")
    
    class Meta:
        verbose_name = "Заказ"
        verbose_name_plural = "Заказы"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Заказ #{self.id} от {self.full_name} ({self.created_at.strftime('%d.%m.%Y %H:%M')})"
