import os
import django
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager

# --- НАСТРОЙКА DJANGO ---
# Эти строки позволяют скрипту работать с базой данных Django напрямую
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Product


def run_parser():
    print("Запуск парсера DNS...")

    # Настройки браузера
    chrome_options = Options()
    # chrome_options.add_argument("--headless") # Раскомментируйте, чтобы браузер работал в фоне

    # Автоматическая установка драйвера
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)

    url = "https://dns-shop.by/ru/category/17a8ae4916404e77/televizory/"

    try:
        driver.get(url)
        print(f"Загрузка страницы: {url}")
        time.sleep(100)  # Ожидание загрузки JavaScript

        # Поиск всех блоков товаров по вашему селектору
        # <li js--product-list__product ...>
        items = driver.find_elements(By.CSS_SELECTOR, "li[js--product-list__product]")
        print(f"Найдено элементов на странице: {len(items)}")

        for item in items:
            try:
                # 1. Ссылка и название
                # <a class="catalog-category-product__title">...</a>
                title_el = item.find_element(By.CLASS_NAME, "catalog-category-product__title")
                title = title_el.text
                link = title_el.get_attribute("href")

                # 2. Картинка
                # <div class="catalog-category-product__image product-image"> ... <img>
                img_el = item.find_element(By.CSS_SELECTOR, ".catalog-category-product__image img")
                img_src = img_el.get_attribute("src")

                # 3. Цена
                # <div class="catalog-product-purchase__current-price"> 244.00 BYN </div>
                price_el = item.find_element(By.CLASS_NAME, "catalog-product-purchase__current-price")
                # Очистка текста цены от лишних слов и пробелов
                price_text = price_el.text.replace('BYN', '').strip().replace(' ', '').replace(',', '.')
                price_float = float(price_text)

                # Сохранение в базу данных Django
                # update_or_create обновит цену, если товар уже есть, или создаст новый
                product_obj, created = Product.objects.update_or_create(
                    external_id=link,  # Используем URL как уникальный ID
                    defaults={
                        'title': title,
                        'price': price_float,
                        'image_url': img_src
                    }
                )

                if created:
                    print(f" [+] Добавлен: {title[:50]}...")
                else:
                    print(f" [~] Обновлен: {title[:50]}...")

            except Exception as e:
                # Пропускаем, если внутри блока не нашли нужных данных (например, реклама)
                continue

    except Exception as e:
        print(f"Критическая ошибка парсинга: {e}")
    finally:
        driver.quit()
        print("Работа парсера завершена.")


if __name__ == "__main__":
    run_parser()