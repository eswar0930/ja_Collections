# JA Collections

A premium fashion marketplace prototype with a Flask backend and a polished storefront experience.

## Features
- Product catalog with search, filters, and stock-aware cart behavior
- Admin product creation, edit, restock, and delete workflows
- SQLite-backed persistence for users, products, and orders
- Session-based authentication and order history
- Live marketplace health endpoint

## Run locally
```bash
cd c:\Users\SH20549149\ja_Collections
c:/Users/SH20549149/ja_Collections/.venv/Scripts/python.exe server.py
```

Then open http://127.0.0.1:5000

## Production
Set a strong `SECRET_KEY` and enable production mode before deployment.

### Environment
Create a `.env` file from `.env.example` and keep it out of version control.

### Run with Gunicorn
```powershell
$env:FLASK_ENV = 'production'
$env:SECRET_KEY = 'replace-with-a-strong-secret'
$env:SESSION_COOKIE_SECURE = 'true'
$env:STRICT_ADMIN_AUTH=false
c:/Users/SH20549149/ja_Collections/.venv/Scripts/gunicorn.exe -k eventlet -w 1 server:app
```

For Linux/macOS:

```bash
export FLASK_ENV=production
export SECRET_KEY='replace-with-a-strong-secret'
export SESSION_COOKIE_SECURE=true
export STRICT_ADMIN_AUTH=false
gunicorn -k eventlet -w 1 server:app
```

### Docker
Build and run a container:

```bash
docker build -t ja-collections .
docker run -e SECRET_KEY='replace-with-a-strong-secret' -e FLASK_ENV=production -e SESSION_COOKIE_SECURE=true -p 5000:5000 ja-collections
```

### Docker Compose
```bash
docker compose up --build
```

### Stripe setup
Set Stripe API keys before launch.
The app uses Stripe Checkout to securely process card payments and expects a webhook to confirm paid orders.

```bash
export STRIPE_PUBLISHABLE_KEY='pk_live_...'
export STRIPE_SECRET_KEY='sk_live_...'
export STRIPE_WEBHOOK_SECRET='whsec_...'
```

Configure a Stripe webhook endpoint to point at:

```bash
https://your-domain.com/webhook/stripe
```

### Email setup
Set SMTP configuration so the site can send order confirmations to customers and support notifications to the admin team:

```bash
export SMTP_HOST='smtp.example.com'
export SMTP_PORT=587
export SMTP_USER='username'
export SMTP_PASSWORD='password'
export EMAIL_FROM='no-reply@jacollections.com'
```

### Deploy
- Use HTTPS with a reverse proxy
- Keep the database file secure or switch to a managed SQL database
- Store secrets outside source control
- Use a process manager or platform service for uptime

## Test
```bash
c:/Users/SH20549149/ja_Collections/.venv/Scripts/python.exe -m unittest discover -s tests -v
```
