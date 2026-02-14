import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShoppingCart, MapPin, RefreshCw, Phone, Trash2, LogIn, LogOut, Tv, MessageCircle } from 'lucide-react';

// Относительный URL: запросы идут на тот же origin (localhost:3000), прокси перенаправляет на Django — сессия и куки работают
const API_URL = '/api/';
const LOCAL_CART_KEY = 'dns_by_cart_v1';

// Настройка axios для работы с сессиями Django
axios.defaults.withCredentials = true;

function getCsrfToken() {
  const match = document.cookie.match(/\bcsrftoken=([^;]+)/);
  return match ? match[1] : null;
}

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);           // { id, username, email, ... } или null
  const [authLoading, setAuthLoading] = useState(true); // проверка сессии при загрузке
  const [view, setView] = useState('catalog');      // 'catalog' или 'cart'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseMessage, setParseMessage] = useState(null);
  // Модальное окно входа/регистрации
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState('login');  // 'login' | 'register'
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  // Модальное окно оформления заказа
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({
    full_name: '',
    phone: '',
    city: '',
    delivery_address: '',
    delivery_date: '',
    delivery_time: ''
  });
  const [orderError, setOrderError] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState('price_asc');

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

  // Проверка текущего пользователя при загрузке (CSRF + /api/auth/me/)
  const fetchMe = async () => {
    try {
      const r = await axios.get(`${API_URL}auth/me/`);
      if (r.data.is_authenticated && r.data.user) {
        setUser(r.data.user);
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const ensureCsrfThenFetchMe = async () => {
    try {
      await axios.get(`${API_URL}auth/csrf/`);
      const token = getCsrfToken();
      if (token) axios.defaults.headers.common['X-CSRFToken'] = token;
      await fetchMe();
    } catch (e) {
      setAuthLoading(false);
      setUser(null);
    }
  };

  // Вход через API
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      const token = getCsrfToken();
      if (token) axios.defaults.headers.common['X-CSRFToken'] = token;
      const r = await axios.post(`${API_URL}auth/login/`, {
        email: authForm.email.trim().toLowerCase(),
        password: authForm.password
      });
      if (r.data.is_authenticated && r.data.user) {
        setUser(r.data.user);
        setAuthModalOpen(false);
        setAuthForm({ email: '', password: '' });
        await fetchCart();
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Ошибка входа';
      setAuthError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Регистрация через API
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      const token = getCsrfToken();
      if (token) axios.defaults.headers.common['X-CSRFToken'] = token;
      const r = await axios.post(`${API_URL}auth/register/`, {
        email: authForm.email.trim().toLowerCase(),
        password: authForm.password
      });
      if (r.data.is_authenticated && r.data.user) {
        setUser(r.data.user);
        setAuthModalOpen(false);
        setAuthForm({ email: '', password: '' });
        await fetchCart();
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Ошибка регистрации';
      setAuthError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Выход
  const handleLogout = async () => {
    try {
      const token = getCsrfToken();
      if (token) axios.defaults.headers.common['X-CSRFToken'] = token;
      await axios.post(`${API_URL}auth/logout/`);
    } catch (e) { /* ignore */ }
    setUser(null);
    await fetchCart();
  };

  // Оформление заказа
  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setOrderError('');
    setOrderSubmitting(true);
    
    try {
      const token = getCsrfToken();
      if (token) axios.defaults.headers.common['X-CSRFToken'] = token;
      
      // Подготавливаем данные товаров из корзины
      const cartItems = cart.map(item => ({
        id: item.id,
        title: item.title,
        price: typeof item.price === 'number' ? item.price : parseFloat(item.price),
        quantity: item.quantity || 1
      }));
      
      const r = await axios.post(`${API_URL}orders/create/`, {
        full_name: orderForm.full_name.trim(),
        phone: orderForm.phone.trim(),
        city: orderForm.city,
        delivery_address: orderForm.delivery_address.trim(),
        delivery_date: orderForm.delivery_date,
        delivery_time: orderForm.delivery_time,
        cart_items: cartItems,
        total_price: totalPrice
      });
      
      if (r.data.status === 'success') {
        alert('Заказ успешно оформлен! Мы свяжемся с вами в ближайшее время.');
        setOrderModalOpen(false);
        setOrderForm({
          full_name: '',
          phone: '',
          city: '',
          delivery_address: '',
          delivery_date: '',
          delivery_time: ''
        });
        // Очищаем корзину после успешного заказа
        setCart([]);
        saveCartToStorage([]);
        await fetchCart();
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Ошибка при оформлении заказа';
      setOrderError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setOrderSubmitting(false);
    }
  };

  // Загрузка товаров, корзины и текущего пользователя при старте
  useEffect(() => {
    setCart(loadCartFromStorage());
    fetchProducts();
    fetchCart();
    ensureCsrfThenFetchMe();
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

  // Извлечение размера экрана из названия (число в дюймах)
  const getScreenInches = (title) => {
    const match = title && title.match(/(\d+)\s*["']?/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Извлечение названия производителя из заголовка: в базе бренд идёт сразу после слова «Телевизор»
  const getBrandFromTitle = (title) => {
    const raw = (title || '').trim();
    const lower = raw.toLowerCase();
    const marker = 'телевизор';
    const idx = lower.indexOf(marker);
    if (idx === -1) return null;
    const after = raw.slice(idx + marker.length).trim();
    const tokens = after.split(/\s+/);
    for (const t of tokens) {
      const cleaned = t.replace(/["']+$/, '').trim();
      if (!cleaned) continue;
      if (/^\d+$/.test(cleaned)) continue;
      if (!/[a-zA-Zа-яА-ЯёЁ]/.test(cleaned)) continue;
      return cleaned;
    }
    return null;
  };

  // Уникальные бренды и диагонали из массива товаров (без дубликатов, бренды — только текстовые названия)
  const { brands, diagonals } = React.useMemo(() => {
    const diagSet = new Set();
    const brandSet = new Set();
    products.forEach((p) => {
      const title = p.title || '';
      const inches = getScreenInches(title);
      if (inches > 0) diagSet.add(inches);
      const brand = getBrandFromTitle(title);
      if (brand) brandSet.add(brand);
    });
    return {
      diagonals: [...diagSet].sort((a, b) => a - b),
      brands: [...brandSet].sort((a, b) => a.localeCompare(b, 'ru')),
    };
  }, [products]);

  // Выпадающий список: Цена (2 пункта) → Размер экрана (динамически) → Бренд (динамически)
  const sortOptions = React.useMemo(() => {
    const opts = [
      { value: 'price_asc', label: 'Цена: сначала дешевые' },
      { value: 'price_desc', label: 'Цена: сначала дорогие' },
    ];
    diagonals.forEach((d) => {
      opts.push({ value: `diagonal_${d}`, label: `Размер экрана: ${d}"` });
    });
    brands.forEach((b) => {
      opts.push({ value: `brand_${b}`, label: `Бренд: ${b}` });
    });
    return opts;
  }, [diagonals, brands]);

  const sortedProducts = React.useMemo(() => {
    const price = (p) => (typeof p.price === 'string' ? parseFloat(p.price) : p.price) || 0;
    let list = [...products];

    if (sortBy === 'price_asc') {
      return list.sort((a, b) => price(a) - price(b));
    }
    if (sortBy === 'price_desc') {
      return list.sort((a, b) => price(b) - price(a));
    }
    if (sortBy.startsWith('diagonal_')) {
      const size = parseInt(sortBy.replace('diagonal_', ''), 10);
      if (!Number.isNaN(size)) {
        list = list.filter((p) => getScreenInches(p.title) === size);
      }
      return list.sort((a, b) => price(a) - price(b));
    }
    if (sortBy.startsWith('brand_')) {
      const brand = sortBy.replace('brand_', '');
      if (brand) {
        list = list.filter((p) => getBrandFromTitle(p.title) === brand);
      }
      return list.sort((a, b) => price(a) - price(b));
    }

    return list.sort((a, b) => price(a) - price(b));
  }, [products, sortBy]);

  // Сброс сортировки, если выбранный пункт исчез из списка (например, после обновления товаров)
  React.useEffect(() => {
    if (sortOptions.length > 0 && !sortOptions.some((o) => o.value === sortBy)) {
      setSortBy('price_asc');
    }
  }, [sortOptions, sortBy]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans">

      {/* ШАПКА САЙТА */}
      <header className="bg-[#3299BB] text-white py-6 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Левая часть: телефон и написать нам */}
          <div className="flex flex-col gap-0.5 text-sm order-2 md:order-1">
            <div className="flex items-center gap-2">
              <Phone size={14} />
              <span className="font-medium">Короткий номер 478</span>
            </div>
            <div className="flex items-center gap-2 opacity-90 hover:opacity-100 cursor-pointer">
              <MessageCircle size={14} />
              <span>Написать нам</span>
            </div>
          </div>

          {/* Центр: логотип и подпись */}
          <div className="text-center order-1 md:order-2 flex flex-col items-center">
            <h1 className="text-2xl font-bold uppercase tracking-tighter flex items-center justify-center gap-2">
              <Tv /> МОЙ-ТВ BY
            </h1>
            <p className="text-sm font-bold mt-0.5">ВЫБЕРИ СВОЙ ТЕЛЕВИЗОР!</p>
          </div>

          {/* Правая часть: авторизация и корзина */}
          <div className="flex items-center justify-end gap-2 order-3">
            {authLoading ? (
              <span className="text-sm opacity-80">Загрузка...</span>
            ) : user ? (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className="text-sm font-medium truncate max-w-[120px]" title={user.email}>{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 bg-[#BCBCBC] text-gray-800 px-2 py-1 rounded text-xs hover:opacity-90 transition shrink-0 min-w-0"
                >
                  <LogOut size={12}/> Выйти
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => { setAuthTab('login'); setAuthError(''); setAuthModalOpen(true); }}
                  className="flex items-center gap-2 bg-blue-800 px-4 py-1.5 rounded text-sm hover:bg-blue-900 transition"
                >
                  <LogIn size={16}/> Войти
                </button>
                <button
                  onClick={() => { setAuthTab('register'); setAuthError(''); setAuthModalOpen(true); }}
                  className="flex items-center gap-2 bg-green-700 px-4 py-1.5 rounded text-sm hover:bg-green-800 transition"
                >
                  Регистрация
                </button>
              </>
            )}

            <button
              onClick={() => setView('cart')}
              className="relative bg-[#FF9900] p-1.5 rounded-full hover:opacity-90 transition shadow-md shrink-0"
            >
              <ShoppingCart size={19} />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#FF9900] text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Модальное окно Вход / Регистрация */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAuthModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex border-b mb-4">
              <button
                type="button"
                onClick={() => { setAuthTab('login'); setAuthError(''); }}
                className={`flex-1 py-2 font-semibold ${authTab === 'login' ? 'border-b-2 border-blue-700 text-blue-700' : 'text-gray-500'}`}
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() => { setAuthTab('register'); setAuthError(''); }}
                className={`flex-1 py-2 font-semibold ${authTab === 'register' ? 'border-b-2 border-blue-700 text-blue-700' : 'text-gray-500'}`}
              >
                Регистрация
              </button>
            </div>
            {authTab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Введите e-mail</label>
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                    autoComplete="current-password"
                  />
                </div>
                {authError && <p className="text-red-600 text-sm">{authError}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={authSubmitting} className="flex-1 bg-blue-700 text-white py-2 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50">
                    {authSubmitting ? 'Вход...' : 'Войти'}
                  </button>
                  <button type="button" onClick={() => setAuthModalOpen(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Отмена</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Электронная почта <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Пароль <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    value={authForm.password}
                    onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                {authError && <p className="text-red-600 text-sm">{authError}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={authSubmitting} className="flex-1 bg-green-700 text-white py-2 rounded-lg font-semibold hover:bg-green-800 disabled:opacity-50">
                    {authSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}
                  </button>
                  <button type="button" onClick={() => setAuthModalOpen(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Отмена</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно оформления заказа */}
      {orderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setOrderModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 my-8" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-6">Оформление заказа</h2>
            <form onSubmit={handleSubmitOrder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Фамилия Имя Отчество <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={orderForm.full_name}
                  onChange={e => setOrderForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                  placeholder="Иванов Иван Иванович"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Номер телефона <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  value={orderForm.phone}
                  onChange={e => {
                    let val = e.target.value.replace(/\D/g, '');
                    if (val.length > 0 && !val.startsWith('375')) {
                      val = '375' + val;
                    }
                    if (val.length > 3) {
                      val = '+' + val.substring(0, 3) + val.substring(3, 12);
                    } else if (val.length > 0) {
                      val = '+' + val;
                    }
                    setOrderForm(f => ({ ...f, phone: val }));
                  }}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                  placeholder="+375XXXXXXXXX"
                  pattern="\+375\d{9}"
                  maxLength={13}
                />
                <p className="text-xs text-gray-500 mt-1">Формат: +375 и 9 цифр</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Город <span className="text-red-500">*</span></label>
                <select
                  value={orderForm.city}
                  onChange={e => setOrderForm(f => ({ ...f, city: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Выберите город</option>
                  <option value="Минск">Минск</option>
                  <option value="Брест">Брест</option>
                  <option value="Витебск">Витебск</option>
                  <option value="Гомель">Гомель</option>
                  <option value="Гродно">Гродно</option>
                  <option value="Могилев">Могилев</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Адрес доставки <span className="text-red-500">*</span></label>
                <textarea
                  value={orderForm.delivery_address}
                  onChange={e => setOrderForm(f => ({ ...f, delivery_address: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                  rows={3}
                  placeholder="Улица, номер дома, номер квартиры, номер этажа"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата доставки <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={orderForm.delivery_date}
                    onChange={e => setOrderForm(f => ({ ...f, delivery_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Время доставки <span className="text-red-500">*</span></label>
                  <select
                    value={orderForm.delivery_time}
                    onChange={e => setOrderForm(f => ({ ...f, delivery_time: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  >
                    <option value="">Выберите время</option>
                    <option value="9:00-11:00">9:00-11:00</option>
                    <option value="11:00-13:00">11:00-13:00</option>
                    <option value="13:00-15:00">13:00-15:00</option>
                    <option value="15:00-17:00">15:00-17:00</option>
                    <option value="17:00-19:00">17:00-19:00</option>
                    <option value="19:00-21:00">19:00-21:00</option>
                  </select>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Итого к оплате:</p>
                <p className="text-2xl font-bold text-blue-800">{totalPrice.toFixed(2)} BYN</p>
              </div>
              
              {orderError && <p className="text-red-600 text-sm">{orderError}</p>}
              
              <div className="flex gap-2 pt-4">
                <button 
                  type="submit" 
                  disabled={orderSubmitting || cart.length === 0} 
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {orderSubmitting ? 'Отправка...' : 'Отправить заявку'}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setOrderModalOpen(false);
                    setOrderError('');
                  }} 
                  className="px-6 py-3 border rounded-lg hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* КОНТЕНТ */}
      <main className="flex-grow container mx-auto px-4 py-8">
        {view === 'catalog' ? (
          <>
            {/* Панель управления: сортировка, акция, кнопка обновления — тот же контейнер, что и сетка товаров */}
            <div className="container mx-auto px-4 mt-0 mb-8">
              <div className="grid grid-cols-3 items-center w-full">
                <div className="flex items-center gap-2 justify-self-start">
                  <label htmlFor="sort-select" className="text-sm font-bold text-gray-700 whitespace-nowrap">Сортировать по:</label>
                  <select
                    id="sort-select"
                    value={sortOptions.some((o) => o.value === sortBy) ? sortBy : 'price_asc'}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-800 focus:ring-2 focus:ring-[#3299BB] focus:border-transparent"
                  >
                    {sortOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bg-pink-50 text-pink-700 px-7 py-2.5 rounded-full font-bold text-base whitespace-nowrap justify-self-center">
                  ❤️ Скидка 3-5% на все телевизоры 14-15 февраля!
                </div>
                <div className="justify-self-end">
                  <button
                    onClick={handleUpdateProducts}
                    disabled={parsing}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors shrink-0 ${
                      parsing 
                        ? 'bg-[#BCBCBC] cursor-not-allowed text-gray-600' 
                        : 'bg-[#BCBCBC] hover:opacity-90 text-gray-800'
                    }`}
                  >
                    <RefreshCw size={9} className={parsing ? 'animate-spin' : ''} />
                    {parsing ? 'Обновление...' : 'Обновить продукты'}
                  </button>
                </div>
              </div>
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
                {sortedProducts.map(product => (
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
                    <div className="text-2xl font-black text-[#3299BB] mb-4 tracking-tight">
                      {typeof product.price === 'number' ? product.price.toFixed(2) : product.price} <span className="text-sm font-normal">BYN</span>
                    </div>
                    <button
                      onClick={() => addToCart(product)}
                      className="w-full bg-[#FF9900] text-white py-3 rounded-lg font-bold hover:opacity-90 transition-colors shadow-sm flex items-center justify-center gap-2"
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
                    <button 
                      onClick={() => setOrderModalOpen(true)}
                      className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition shadow-lg"
                    >
                      ОФОРМИТЬ ЗАКАЗ
                    </button>
                 </div>
               </div>
             )}
          </div>
        )}
      </main>

      {/* ФУТЕР */}
      <footer className="bg-[#424242] text-gray-300 py-6 mt-12 border-t-4 border-[#424242]">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 justify-items-center">
          <div className="text-center md:text-left w-full md:max-w-xs">
            <h4 className="text-white font-bold text-lg mb-2">О компании</h4>
            <div className="text-sm text-justify space-y-1">
              <p>Юридический адрес:</p>
              <p>220003 г.Минск,</p>
              <p>ул. Солнечная д.4</p>
              <p>офис 5</p>
              <p className="mt-2">тел./факс 375172200980</p>
            </div>
            <div className="mt-4 space-y-1 text-sm text-justify">
              <p className="hover:text-white cursor-pointer transition-colors">Часто задаваемые вопросы</p>
              <p className="hover:text-white cursor-pointer transition-colors">Замена и возврат товара</p>
              <p className="hover:text-white cursor-pointer transition-colors">Рассрочка</p>
            </div>
          </div>
          <div className="w-full md:max-w-xs">
            <h4 className="text-white font-bold text-lg mb-2 text-left">Мы в социальных сетях</h4>
            <div className="space-y-1 text-sm text-left">
              <div className="flex items-center justify-start hover:text-white cursor-pointer transition-colors">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sky-500 text-white text-xs font-bold flex-shrink-0 mr-2">
                  TG
                </span>
                <span>Наш Telegram</span>
              </div>
              <div className="flex items-center justify-start hover:text-white cursor-pointer transition-colors">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 text-white text-xs font-bold flex-shrink-0 mr-2">
                  IG
                </span>
                <span>Наш Instagram</span>
              </div>
              <div className="flex items-center justify-start hover:text-white cursor-pointer transition-colors">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex-shrink-0 mr-2">
                  f
                </span>
                <span>Наш Facebook</span>
              </div>
              <div className="flex items-center justify-start hover:text-white cursor-pointer transition-colors">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sky-700 text-white text-[10px] font-bold flex-shrink-0 mr-2">
                  VK
                </span>
                <span>Мы ВКонтакте</span>
              </div>
              <p className="hover:text-white cursor-pointer transition-colors">Отзывы наших клиентов</p>
              <p className="hover:text-white cursor-pointer transition-colors">Подписаться на новости</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;