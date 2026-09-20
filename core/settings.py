"""
Django settings for CodeSense AI - AI Code Reviewer.

Configurable via environment variables for local development and Vercel deployment.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file for local development
load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY
SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'django-insecure-dev-key-change-in-production-!@#$%'
)

DEBUG = os.environ.get('DJANGO_DEBUG', 'true').lower() == 'true'

ALLOWED_HOSTS = os.environ.get(
    'DJANGO_ALLOWED_HOSTS',
    '*'
).split(',')

# Automatically allow Vercel deployment hosts if running on Vercel
if 'VERCEL' in os.environ:
    vercel_url = os.environ.get('VERCEL_URL')
    if vercel_url and vercel_url not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(vercel_url)
    if '.vercel.app' not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append('.vercel.app')

# Application definition
INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.staticfiles',
    'api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# Minimal database — use /tmp on Vercel (writable), local file otherwise
if 'VERCEL' in os.environ or os.environ.get('VERCEL_ENV'):
    DB_PATH = Path('/tmp/db.sqlite3')
else:
    DB_PATH = BASE_DIR / 'db.sqlite3'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': DB_PATH,
    }
}

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'

# WhiteNoise — serve compressed static files in production
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- Application Configuration ---

# AI Provider settings (xKiro / NVIDIA)
XKIRO_API_KEY = os.environ.get('XKIRO_API_KEY', '')
XKIRO_BASE_URL = os.environ.get('XKIRO_BASE_URL', 'https://api.xkiro.com/v1')
XKIRO_MODEL = os.environ.get('XKIRO_MODEL', 'qwen/qwen3.8-omni-flash:free')

# Ollama / Legacy settings
OLLAMA_BASE_URL = os.environ.get('OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.environ.get('OLLAMA_MODEL', 'qwen2.5-coder')

# RAG settings
ENABLE_RAG = os.environ.get('ENABLE_RAG', 'true').lower() == 'true'

# Input limits
MAX_CODE_CHARS = int(os.environ.get('MAX_CODE_CHARS', '20000'))

# AI request tuning
REQUEST_TIMEOUT_SECONDS = int(os.environ.get('REQUEST_TIMEOUT_SECONDS', '60'))
CHAT_REQUEST_TIMEOUT_SECONDS = int(os.environ.get('CHAT_REQUEST_TIMEOUT_SECONDS', '45'))
REVIEW_MAX_TOKENS = int(os.environ.get('REVIEW_MAX_TOKENS', '1800'))
CHAT_MAX_TOKENS = int(os.environ.get('CHAT_MAX_TOKENS', '700'))
MAX_CHAT_CONTEXT_CHARS = int(os.environ.get('MAX_CHAT_CONTEXT_CHARS', '6000'))

# JWT auth settings
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', SECRET_KEY)
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_ACCESS_TOKEN_LIFETIME_MINUTES = int(
    os.environ.get('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', '60')
)

# Supported languages
SUPPORTED_LANGUAGES = [
    'python', 'javascript', 'typescript', 'java', 'c', 'cpp',
    'csharp', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin',
    'html', 'css', 'sql', 'bash', 'powershell', 'other'
]

# Supported review modes
SUPPORTED_REVIEW_MODES = [
    'general', 'bugs', 'security', 'performance', 'style', 'explain'
]
