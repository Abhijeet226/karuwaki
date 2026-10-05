"""
WSGI config for karuwakiblog project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/3.1/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'karuwakiblog.settings')

application = get_wsgi_application()

# Auto-apply migrations and ensure superuser exists on startup if credentials are provided
if os.getenv('DJANGO_SUPERUSER_PASSWORD'):
    try:
        from django.core.management import call_command
        call_command('migrate', interactive=False)
        call_command('create_admin')
    except Exception as e:
        import logging
        logging.getLogger('django').warning(f"Startup superuser/migration notice: {e}")
