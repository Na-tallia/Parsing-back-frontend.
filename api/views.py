from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
import threading
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
    
    def list(self, request, *args, **kwargs):
        """
        Переопределяем метод list для отладки
        """
        queryset = self.get_queryset()
        count = queryset.count()
        print(f"[DEBUG] Запрос на получение продуктов. Найдено: {count}")
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

# Представление для корзины
class CartViewSet(viewsets.ModelViewSet):
    """
    Обрабатывает логику корзины для текущего пользователя (авторизованного или анонимного через сессии).
    """
    serializer_class = CartItemSerializer
    # Разрешаем всем добавлять в корзину
    permission_classes = [permissions.AllowAny]

    def get_or_create_anonymous_user(self):
        """
        Получает или создает анонимного пользователя для сессии.
        """
        from django.contrib.auth.models import User
        
        # Используем session_key для идентификации анонимного пользователя
        session_key = self.request.session.session_key
        if not session_key:
            self.request.session.create()
            session_key = self.request.session.session_key
        
        # Создаем или получаем анонимного пользователя
        username = f'anonymous_{session_key}'
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': '',
                'is_active': True,
            }
        )
        return user

    def get_queryset(self):
        # Получаем пользователя (авторизованного или анонимного)
        if self.request.user.is_authenticated:
            user = self.request.user
        else:
            user = self.get_or_create_anonymous_user()
        
        # Пользователь видит только свои товары в корзине
        return CartItem.objects.filter(user=user)

    def create(self, request, *args, **kwargs):
        # Получаем пользователя (авторизованного или анонимного)
        if request.user.is_authenticated:
            user = request.user
        else:
            user = self.get_or_create_anonymous_user()
        
        # Проверяем, есть ли уже такой товар в корзине
        product_id = request.data.get('product_id')
        if product_id:
            existing_item = CartItem.objects.filter(user=user, product_id=product_id).first()
            if existing_item:
                # Увеличиваем количество, если товар уже есть
                existing_item.quantity += 1
                existing_item.save()
                serializer = self.get_serializer(existing_item)
                return Response(serializer.data, status=status.HTTP_200_OK)
        
        # Если товара нет, создаем новый
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# Функция для запуска парсинга в фоновом режиме
def run_parser_background():
    """
    Запускает парсер в отдельном потоке
    """
    import os
    import django
    import sys
    
    # Настройка Django окружения для парсера
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, project_root)
    
    # Устанавливаем настройки Django, если они еще не установлены
    if not os.environ.get('DJANGO_SETTINGS_MODULE'):
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    
    # Инициализируем Django, если еще не инициализирован
    try:
        django.setup()
    except:
        pass  # Django уже настроен
    
    try:
        # Импортируем функцию парсера
        from backend.scraper import run_parser
        run_parser()
    except Exception as e:
        import traceback
        print(f"Ошибка при запуске парсера: {e}")
        traceback.print_exc()


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def update_products(request):
    """
    API endpoint для запуска парсинга продуктов.
    Запускает парсер в фоновом режиме и возвращает статус.
    """
    try:
        # Запускаем парсер в отдельном потоке, чтобы не блокировать ответ
        thread = threading.Thread(target=run_parser_background)
        thread.daemon = True
        thread.start()
        
        return Response({
            'status': 'success',
            'message': 'Парсинг запущен. Продукты будут обновлены через несколько секунд.'
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            'status': 'error',
            'message': f'Ошибка при запуске парсера: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

