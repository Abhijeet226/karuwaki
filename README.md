# Karuwaki (KSPEAK$)

A modern Django-powered publication platform featuring editorial hubs, astrology calculations, AI-assisted content features, rich media dispatches, and an Unfold admin dashboard.

## Features

- **Editorial Hub**: Curated dispatches, author showcases, categories, comments, and reactions.
- **Cosmic Systems**: Athereal astrological alignments and calculations.
- **Modern UI**: Tailored aesthetic layout, responsive templates, dynamic media previews, and interactive widgets.
- **Admin Dashboard**: Powered by Django Unfold for an elevated administrative experience.

## Quick Start

### 1. Clone & Set Up Virtual Environment

```bash
git clone https://github.com/Abhijeet226/karuwaki.git
cd karuwaki

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy the example environment configuration:

```bash
cp .env.example .env
```

Edit `.env` with your preferred configuration:
- `SECRET_KEY`: Set your secret key for Django.
- `DEBUG`: `True` for development, `False` for production.
- `USE_SQLITE=1`: To run with local SQLite database without MySQL.
- `GEMINI_API_KEY`: Optional Gemini AI API key for AI features.

### 3. Database Migration & Run

```bash
python manage.py migrate
python manage.py runserver
```

Open `http://127.0.0.1:8000/` in your browser.
