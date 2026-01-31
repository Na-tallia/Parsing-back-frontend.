import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShoppingCart, MapPin, RefreshCw, Phone, Trash2, LogIn, LogOut, Tv } from 'lucide-react';

// Относительный URL: запросы идут на тот же origin (localhost:3000), прокси перенаправляет на Django — сессия и куки работают
const API_URL = '/api/';
const LOCAL_CART_KEY = 'dns_by_cart_v1';

// Настройка axios для работы с сессиями Django
axios.defaults.withCredentials = true;

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState('catalog'); // 'catalog' или 'cart'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseMessage, setParseMessage] = useState(null);

  const saveCartToStorage = (nextCart) => {
    try {
      localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(nextCart));
    } catch (e) {
      // ignore storage errors (private mode, quota, etc.)
    }
  };

  const loadCartFromStorage = () => {
    try {
      const raw = localStorage.getItem(LOCAL_CART_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  };

  const upsertLocalCartItem = (product, deltaQty = 1) => {
    setCart(prev => {
      const safeDelta = Number.isFinite(deltaQty) ? deltaQty : 1;
      const next = [...prev];
      const idx = next.findIndex(i => i.id === product.id);
      if (idx >= 0) {
        const prevQty = Number.isFinite(next[idx].quantity) ? next[idx].quantity : 1;
        next[idx] = { ...next[idx], quantity: prevQty + safeDelta };
      } else {
        next.push({
          ...product,
          // cartId будет только у серверных позиций; локальные удаляем по product.id
          cartId: null,
          quantity: safeDelta
        });
      }
      saveCartToStorage(next);
      return next;
    });
  };

  const removeLocalCartItem = (productId) => {
    setCart(prev => {
      const next = prev.filter(i => i.id !== productId);
      saveCartToStorage(next);
      return next;
    });
  };

  // Функция для загрузки товаров из API
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Запрос к API:', `${API_URL}products/`);
      const response = await axios.get(`${API_URL}products/`);
      console.log('Ответ от API:', response);
      console.log('Данные ответа:', response.data);
      
      // Django REST Framework может возвращать данные в формате {results: [...]} 
      // или просто массив, обрабатываем оба случая
      let productsData = response.data;
      
      // Если это объект с results (пагинация)
      if (productsData && typeof productsData === 'object' && !Array.isArray(productsData) && productsData.results) {
        productsData = productsData.results;
      }
      
      // Проверяем, что это массив
      if (Array.isArray(productsData)) {
        console.log('Найдено продуктов:', productsData.length);
        setProducts(productsData);
      } else {
        console.warn('Неожиданный формат данных:', productsData);
        setProducts([]);
        // Не устанавливаем ошибку, если просто нет данных
        if (productsData !== null && productsData !== undefined) {
          setError("Неожиданный формат данных от сервера");
        }
      }
    } catch (err) {
      console.error("Ошибка загрузки товаров:", err);
      console.error("Детали ошибки:", err.response?.data || err.message);
      const errorMessage = err.response 
        ? `Ошибка ${err.response.status}: ${err.response.statusText}` 
        : err.message || "Не удалось загрузить товары. Проверьте, запущен ли сервер Django.";
      setError(errorMessage);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Функция для загрузки корзины из API
  const fetchCart = async () => {
    try {
      const response = await axios.get(`${API_URL}cart/`);
      let cartData = response.data.results || response.data;
      
      if (Array.isArray(cartData)) {
        console.log('Загружено товаров в корзине:', cartData.length);
        // Преобразуем данные из API в формат для локального состояния
        const formattedCart = cartData.map(item => ({
          ...item.product,
          cartId: item.id,
          quantity: item.quantity
        }));
        setCart(formattedCart);
        saveCartToStorage(formattedCart);
      } else {
        setCart([]);
        saveCartToStorage([]);
      }
    } catch (err) {
      console.error("Ошибка загрузки корзины:", err);
      // Если API недоступно (Network Error/CORS/сервер не запущен), оставляем локальную корзину.
      const local = loadCartFromStorage();
      setCart(local);
    }
  };

  // Загрузка товаров и корзины из Django при старте
  useEffect(() => {
    // Быстрый старт: сначала показываем локальную корзину, затем пытаемся синхронизироваться с API
    setCart(loadCartFromStorage());
    fetchProducts();
    fetchCart();
  }, []);

  // Функция для запуска парсинга
  const handleUpdateProducts = async () => {
    try {
      setParsing(true);
      setParseMessage(null);
      setError(null);
      
      console.log('Запуск парсинга...');
      const response = await axios.post(`${API_URL}update-products/`);
      
      if (response.data.status === 'success') {
        setParseMessage(response.data.message);
        
        // Ждем несколько секунд, чтобы парсинг успел завершиться, затем обновляем список
        setTimeout(async () => {
          console.log('Обновление списка продуктов после парсинга...');
          await fetchProducts();
          setParseMessage('Продукты успешно обновлены!');
          setTimeout(() => setParseMessage(null), 3000);
        }, 8000); // Ждем 8 секунд для завершения парсинга
      } else {
        setError(response.data.message || 'Ошибка при запуске парсинга');
      }
    } catch (err) {
      console.error("Ошибка при запуске парсинга:", err);
      const errorMessage = err.response?.data?.message || err.message || "Не удалось запустить парсинг.";
      setError(errorMessage);
    } finally {
      setParsing(false);
    }
  };

  // Добавление в корзину через API
  const addToCart = async (product) => {
    try {
      const response = await axios.post(`${API_URL}cart/`, {
        product_id: product.id,
        quantity: 1
      });
      
      console.log('Товар добавлен в корзину:', response.data);
      
      // Обновляем корзину после добавления
      await fetchCart();
    } catch (err) {
      console.error("Ошибка при добавлении в корзину:", err);
      // Фолбэк: добавляем локально, чтобы функциональность работала без API
      upsertLocalCartItem(product, 1);
      alert("Сервер корзины недоступен — товар добавлен локально в корзину.");
    }
  };

  // Удаление из корзины через API
  const removeFromCart = async (cartItemId) => {
    try {
      if (!cartItemId) {
        // локальная позиция (нет cartId)
        return;
      }
      await axios.delete(`${API_URL}cart/${cartItemId}/`);
      console.log('Товар удален из корзины');
      
      // Обновляем корзину после удаления
      await fetchCart();
    } catch (err) {
      console.error("Ошибка при удалении из корзины:", err);
      alert("Не удалось удалить товар через сервер. Если это локальный товар — удалим локально.");
    }
  };

  const totalPrice = cart.reduce((sum, item) => {
    const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
    const quantity = item.quantity || 1;
    return sum + (isNaN(price) ? 0 : price * quantity);
  }, 0);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans">

      {/* ШАПКА САЙТА */}
      <header className="bg-blue-700 text-white p-4 shadow-lg">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-2xl font-bold uppercase tracking-tighter flex items-center gap-2 justify-center md:justify-start">
              <Tv /> DNS-BY TV
            </h1>
            <p className="text-sm font-light">Добро пожаловать за покупками. У нас самые выгодные цены!</p>
          </div>

          <div className="hidden lg:block text-xs opacity-80">
            <div className="flex items-center gap-2"><MapPin size={14}/> г.Минск, ул. Саперов, 3</div>
            <div className="flex items-center gap-2"><Phone size={14}/> +375254560098</div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsLoggedIn(!isLoggedIn)}
              className="flex items-center gap-2 bg-blue-800 px-4 py-2 rounded hover:bg-blue-900 transition"
            >
              {isLoggedIn ? <><LogOut size={18}/> Выйти</> : <><LogIn size={18}/> Войти</>}
            </button>

            <button
              onClick={() => setView('cart')}
              className="relative bg-orange-500 p-2 rounded-full hover:bg-orange-600 transition shadow-md"
            >
              <ShoppingCart size={24} />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* КОНТЕНТ */}
      <main className="flex-grow container mx-auto px-4 py-8">
        {view === 'catalog' ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold border-b-2 border-blue-700 inline-block pb-2">Каталог телевизоров</h2>
              <button
                onClick={handleUpdateProducts}
                disabled={parsing}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                  parsing 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                <RefreshCw size={18} className={parsing ? 'animate-spin' : ''} />
                {parsing ? 'Обновление...' : 'Обновить продукты'}
              </button>
            </div>
            {parseMessage && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                <p>{parseMessage}</p>
              </div>
            )}
            {loading ? (
              <div className="text-center py-12">
                <p className="text-lg text-gray-600">Загрузка товаров...</p>
              </div>
            ) : error ? (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                <p className="font-bold">Ошибка:</p>
                <p>{error}</p>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-gray-600">Товары не найдены</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {products.map(product => (
                <div key={product.id} className="bg-white border rounded-xl p-4 flex flex-col shadow-sm hover:shadow-xl transition-all duration-300 group">
                  <div className="h-48 overflow-hidden mb-4 rounded-lg bg-gray-100 flex items-center justify-center">
                    <img
                      src={product.image_url}
                      alt={product.title}
                      className="max-h-full object-contain group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <h3 className="text-sm font-semibold mb-4 flex-grow line-clamp-3 hover:text-blue-700 cursor-pointer">
                    {product.title}
                  </h3>
                  <div className="mt-auto">
                    <div className="text-2xl font-black text-blue-800 mb-4 tracking-tight">
                      {typeof product.price === 'number' ? product.price.toFixed(2) : product.price} <span className="text-sm font-normal">BYN</span>
                    </div>
                    <button
                      onClick={() => addToCart(product)}
                      className="w-full bg-orange-500 text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      <ShoppingCart size={18}/> КУПИТЬ
                    </button>
                  </div>
                </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="max-w-4xl mx-auto">
             <div className="flex justify-between items-end mb-6">
                <h2 className="text-3xl font-bold">Корзина</h2>
                <button onClick={() => setView('catalog')} className="text-blue-700 font-bold hover:underline">← Вернуться к покупкам</button>
             </div>

             {cart.length === 0 ? (
               <div className="bg-white p-12 rounded-2xl border text-center shadow-inner">
                  <ShoppingCart size={64} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-xl text-gray-500 font-medium">Ваша корзина пока пуста</p>
               </div>
             ) : (
               <div className="bg-white rounded-2xl shadow-xl border overflow-hidden">
                 <div className="p-6 space-y-4">
                    {cart.map(item => (
                      <div key={item.cartId} className="flex items-center gap-4 border-b pb-4 last:border-0">
                        <img src={item.image_url} alt="" className="w-20 h-20 object-contain" />
                        <div className="flex-grow">
                          <p className="font-bold text-sm leading-tight">{item.title}</p>
                          <p className="text-blue-700 font-bold mt-1">
                            {typeof item.price === 'number' ? item.price.toFixed(2) : item.price} BYN
                            {item.quantity > 1 && <span className="text-gray-500 text-xs ml-2">x{item.quantity}</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (item.cartId) return removeFromCart(item.cartId);
                            return removeLocalCartItem(item.id);
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors p-2"
                        >
                          <Trash2 size={24} />
                        </button>
                      </div>
                    ))}
                 </div>
                 <div className="bg-gray-50 p-6 flex justify-between items-center">
                    <div>
                      <p className="text-gray-500 text-sm">Итого к оплате:</p>
                      <p className="text-3xl font-black text-blue-800">{totalPrice.toFixed(2)} BYN</p>
                    </div>
                    <button className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition shadow-lg">
                      ОФОРМИТЬ ЗАКАЗ
                    </button>
                 </div>
               </div>
             )}
          </div>
        )}
      </main>

      {/* ФУТЕР */}
      <footer className="bg-gray-900 text-gray-400 py-10 mt-12 border-t-4 border-blue-700">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="text-white font-bold text-lg mb-2">Наш магазин</h4>
            <p className="text-sm max-w-md">Мы предлагаем лучшие телевизоры, собранные специально для вас с сайта DNS. Только актуальные цены и наличие.</p>
          </div>
          <div className="md:text-right">
            <h4 className="text-white font-bold text-lg mb-2">Контакты</h4>
            <p className="text-sm">Адрес: г.Минск, ул. Саперов, 3</p>
            <p className="text-sm">Телефон: +375254560098</p>
            <p className="text-xs mt-4">© 2024 DNS-BY. Все права защищены.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;