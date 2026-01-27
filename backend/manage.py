#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    # Получаем путь к папке backend/
    current_path = os.path.abspath(os.path.dirname(__file__))
    # Получаем путь к корню проекта (на одну папку выше)
    project_root = os.path.dirname(current_path)

    # Добавляем обе папки в пути поиска модулей Python
    # Это позволит Django увидеть папку 'api', даже если она в корне
    sys.path.insert(0, current_path)
    sys.path.insert(0, project_root)

    # Указываем Django, где искать файл настроек.
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
    
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()