import os
import sqlite3
import time
import secrets
import json
import smtplib
import ssl
from collections import defaultdict
from email.message import EmailMessage
from functools import wraps
from typing import Optional

from flask import Flask, jsonify, request, g, session
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

try:
    from flask_cors import CORS
except ImportError:
    CORS = None

load_dotenv()

try:
    from flask_socketio import SocketIO, emit, join_room
except Exception:
    SocketIO = None

try:
    import stripe
except ImportError:
    stripe = None

app = Flask(__name__, static_folder='.', static_url_path='')

# Enable CORS for GitHub Pages frontend and local development
if CORS is not None:
    CORS(app, resources={r"/api/*": {"origins": ["*"], "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type", "X-CSRF-Token"]}}, supports_credentials=True)

app.config['DATABASE'] = os.environ.get('DATABASE_PATH', os.path.join(os.path.dirname(__file__), 'shop.db'))
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
app.config['STRICT_ADMIN_AUTH'] = os.environ.get('STRICT_ADMIN_AUTH', 'false').lower() == 'true'
app.config['FLASK_ENV'] = os.environ.get('FLASK_ENV', 'development')
app.config['DEBUG'] = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
app.config['PREFERRED_URL_SCHEME'] = 'https'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = os.environ.get('SESSION_COOKIE_SECURE', 'true' if app.config['FLASK_ENV'] == 'production' else 'false').lower() == 'true'
app.config['SESSION_REFRESH_EACH_REQUEST'] = True
app.config['STRIPE_PUBLISHABLE_KEY'] = os.environ.get('STRIPE_PUBLISHABLE_KEY', '')
app.config['STRIPE_SECRET_KEY'] = os.environ.get('STRIPE_SECRET_KEY', '')
app.config['STRIPE_WEBHOOK_SECRET'] = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
app.config['SMTP_HOST'] = os.environ.get('SMTP_HOST', '')
app.config['SMTP_PORT'] = int(os.environ.get('SMTP_PORT', '587'))
app.config['SMTP_USER'] = os.environ.get('SMTP_USER', '')
app.config['SMTP_PASSWORD'] = os.environ.get('SMTP_PASSWORD', '')
app.config['EMAIL_FROM'] = os.environ.get('EMAIL_FROM', 'no-reply@jacollections.com')

if stripe is not None and app.config['STRIPE_SECRET_KEY']:
    stripe.api_key = app.config['STRIPE_SECRET_KEY']

# Optional SocketIO instance (graceful when dependency not installed)
redis_url = os.environ.get('REDIS_URL')
if SocketIO is not None:
    socketio = SocketIO(app, cors_allowed_origins='*', message_queue=redis_url) if redis_url else SocketIO(app, cors_allowed_origins='*')
else:
    socketio = None

if socketio is not None:
    @socketio.on('connect')
    def handle_connect():
        if session.get('user_role') == 'admin':
            join_room('admins')
        emit('socket_connected', {'status': 'connected'})

    @socketio.on('disconnect')
    def handle_disconnect():
        pass


def get_db():
    if 'db' not in g:
        conn = sqlite3.connect(app.config['DATABASE'])
        conn.row_factory = sqlite3.Row
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop('db', None)
    if db is not None:
        db.close()

# In-memory rate limit store: per IP route timestamps
_rate_limits = defaultdict(list)

def _clean_rate_limit(key, period):
    now = time.time()
    _rate_limits[key] = [ts for ts in _rate_limits[key] if now - ts < period]

def rate_limit(limit=30, period=60):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            key = f"{request.remote_addr}:{request.path}"
            _clean_rate_limit(key, period)
            if len(_rate_limits[key]) >= limit:
                return jsonify({'success': False, 'message': 'Rate limit exceeded'}), 429
            _rate_limits[key].append(time.time())
            return f(*args, **kwargs)
        return wrapper
    return decorator


def generate_csrf_token():
    token = secrets.token_urlsafe(32)
    session['csrf_token'] = token
    return token


def ensure_csrf():
    token = session.get('csrf_token')
    if not token:
        return False
    header = request.headers.get('X-CSRF-Token', '')
    return header == token


def csrf_protect(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if request.method in ('GET', 'OPTIONS', 'HEAD'):
            return f(*args, **kwargs)
        if not ensure_csrf():
            return jsonify({'success': False, 'message': 'Invalid or missing CSRF token'}), 403
        return f(*args, **kwargs)
    return wrapper


def send_email(subject: str, recipient: str, body: str):
    if not app.config['SMTP_HOST'] or not app.config['SMTP_USER'] or not app.config['SMTP_PASSWORD']:
        return False
    message = EmailMessage()
    message['Subject'] = subject
    message['From'] = app.config['EMAIL_FROM']
    message['To'] = recipient
    message.set_content(body)

    context = ssl.create_default_context()
    try:
        with smtplib.SMTP(app.config['SMTP_HOST'], app.config['SMTP_PORT']) as server:
            server.starttls(context=context)
            server.login(app.config['SMTP_USER'], app.config['SMTP_PASSWORD'])
            server.send_message(message)
        return True
    except Exception:
        return False


def create_stripe_payment_intent(amount: int, currency: str = 'inr', metadata: dict | None = None):
    if stripe is None:
        raise RuntimeError('Stripe SDK not installed')
    if not app.config['STRIPE_SECRET_KEY']:
        raise RuntimeError('Stripe secret key not configured')
    intent = stripe.PaymentIntent.create(
        amount=amount,
        currency=currency,
        payment_method_types=['card'],
        metadata=metadata or {}
    )
    return intent


def _normalize_order_items(raw_items):
    if raw_items is None:
        return []
    if isinstance(raw_items, str):
        try:
            return json.loads(raw_items)
        except Exception:
            return []
    if isinstance(raw_items, list):
        return raw_items
    return []


def _build_order_summary(order):
    items = _normalize_order_items(order.get('items'))
    lines = []
    for item in items:
        if not isinstance(item, dict):
            continue
        quantity = int(item.get('quantity', 1) or 1)
        price = float(item.get('price', 0) or 0)
        name = str(item.get('name', 'Item'))
        lines.append(f"{quantity} x {name} — ₹{price:.2f}")
    return '\n'.join(lines) if lines else 'No item details available.'


def _send_order_emails(order):
    support_email = _get_setting('support_email') or app.config['EMAIL_FROM']
    user_email = None
    try:
        db = get_db()
        user = db.execute('SELECT email FROM users WHERE id = ?', (order['user_id'],)).fetchone()
        if user and user['email']:
            user_email = user['email']
    except Exception:
        user_email = None

    order_summary = _build_order_summary(order)
    subject = f"JA Collections order #{order['id']} confirmation"
    body = (
        f"Hello {order.get('customer_name', 'Customer')},\n\n"
        f"Thank you for shopping with JA Collections.\n\n"
        f"Order #{order['id']} status: {order.get('status')}\n"
        f"Payment method: {order.get('payment_method')}\n"
        f"Delivery address: {order.get('address')}\n\n"
        f"Items:\n{order_summary}\n\n"
        f"Total: ₹{order.get('total')}\n\n"
        "We will contact you if we need additional information."
    )
    if user_email:
        send_email(subject, user_email, body)

    admin_body = (
        f"New order #{order['id']} received.\n\n"
        f"Customer: {order.get('customer_name', 'Customer')}\n"
        f"User ID: {order.get('user_id')}\n"
        f"Email: {user_email or 'N/A'}\n"
        f"Payment method: {order.get('payment_method')}\n"
        f"Status: {order.get('status')}\n"
        f"Address: {order.get('address')}\n\n"
        f"Items:\n{order_summary}\n\n"
        f"Total: ₹{order.get('total')}"
    )
    if support_email:
        send_email(f"JA Collections new order #{order['id']}", support_email, admin_body)


def set_security_headers(response):
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('X-Frame-Options', 'DENY')
    response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.setdefault('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
    response.headers.setdefault('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload' if app.config['SESSION_COOKIE_SECURE'] else 'max-age=0')
    response.headers.setdefault(
        'Content-Security-Policy',
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https://images.unsplash.com; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )
    return response


app.after_request(set_security_headers)


def init_db():

    db = get_db()
    db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            phone TEXT UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'customer'
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            vendor TEXT NOT NULL,
            price REAL NOT NULL,
            original_price REAL,
            stock INTEGER NOT NULL DEFAULT 0,
            rating REAL NOT NULL DEFAULT 0,
            reviews INTEGER NOT NULL DEFAULT 0,
            badge TEXT,
            description TEXT,
            image TEXT,
            featured INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            items TEXT NOT NULL,
            total REAL NOT NULL,
            customer_name TEXT NOT NULL,
            address TEXT NOT NULL,
            payment_method TEXT NOT NULL,
            payment_details TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS offers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            discount_percent REAL NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 0,
            starts_at TEXT,
            ends_at TEXT
        );
    ''')
    db.commit()

    user_columns = [row['name'] for row in db.execute('PRAGMA table_info(users)').fetchall()]
    if 'phone' not in user_columns:
        db.execute('ALTER TABLE users ADD COLUMN phone TEXT')
        db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)')
        db.commit()
    if 'disabled' not in user_columns:
        try:
            db.execute('ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0')
            db.commit()
        except Exception:
            pass

    order_columns = [row['name'] for row in db.execute('PRAGMA table_info(orders)').fetchall()]
    if 'customer_name' not in order_columns:
        db.execute('ALTER TABLE orders ADD COLUMN customer_name TEXT NOT NULL DEFAULT "Guest"')
    if 'address' not in order_columns:
        db.execute('ALTER TABLE orders ADD COLUMN address TEXT NOT NULL DEFAULT ""')
    if 'payment_method' not in order_columns:
        db.execute('ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT "COD"')
    if 'payment_details' not in order_columns:
        db.execute('ALTER TABLE orders ADD COLUMN payment_details TEXT')
    if 'created_at' not in order_columns:
        db.execute('ALTER TABLE orders ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP')
    db.commit()

    admin_exists = db.execute('SELECT id FROM users WHERE email = ?', ('admin@jacollections.com',)).fetchone()
    if not admin_exists:
        db.execute(
            'INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
            ('Admin', 'admin@jacollections.com', '9999999999', generate_password_hash('admin123'), 'admin')
        )
        db.commit()

    sample_products = [
        ('Golden Thread Saree', 'Sarees', 'JA Studio', 2899, 3499, 15, 4.8, 126, 'Best Seller', 'Elegant golden-thread designer saree', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80', 1),
        ('Pearl Drop Necklace', 'Jewelry', 'Aurum House', 1599, 1999, 8, 4.7, 92, 'New', 'Elegant pearl drop necklace', 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=600&q=80', 1),
        ('Silk Fusion Kurta', 'Fashion', 'Aarvi', 2299, 2799, 10, 4.6, 74, 'Trending', 'Luxurious fusion kurta', 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=600&q=80', 1),
    ]
    existing_count = db.execute('SELECT COUNT(*) FROM products').fetchone()[0]
    if existing_count < len(sample_products):
        db.executemany(
            'INSERT INTO products (name, category, vendor, price, original_price, stock, rating, reviews, badge, description, image, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            sample_products
        )
        db.commit()

    # Seed default support contact info if not present
    support_email = db.execute("SELECT value FROM settings WHERE key = 'support_email'").fetchone()
    support_phone = db.execute("SELECT value FROM settings WHERE key = 'support_phone'").fetchone()
    if not support_email:
        db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ('support_email', 'admin@jacollections.com'))
    if not support_phone:
        db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ('support_phone', '+919876543210'))
    db.commit()

    # Seed default categories
    existing_categories = db.execute('SELECT COUNT(*) FROM categories').fetchone()[0]
    if existing_categories == 0:
        default_cats = [('Sarees',), ('Jewelry',), ('Kurtas',), ('Fusion',)]
        db.executemany('INSERT OR IGNORE INTO categories (name) VALUES (?)', default_cats)
        db.commit()

    # seed a sample offer if none exists
    offer_count = db.execute('SELECT COUNT(*) FROM offers').fetchone()[0]
    if offer_count == 0:
        db.execute('INSERT INTO offers (title, description, discount_percent, active) VALUES (?, ?, ?, ?)',
                   ('Festival Launch', 'Sitewide launch discount', 10, 0))
        db.commit()


@app.before_request
def initialize():
    if not hasattr(app, 'initialized'):
        init_db()
        app.initialized = True


@app.route('/')
def home():
    return app.send_static_file('index.html')


@app.route('/api/auth/register', methods=['POST'])
@rate_limit(limit=6, period=60)
def register():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    contact = (data.get('contact') or data.get('email') or data.get('phone') or '').strip()
    password = data.get('password', '')

    email = ''
    phone = ''
    if '@' in contact:
        email = contact.lower()
    else:
        phone = contact

    if not name or not contact or not password:
        return jsonify({'success': False, 'message': 'Missing required fields'}), 400

    db = get_db()
    if email:
        existing = db.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
        if existing:
            return jsonify({'success': False, 'message': 'Email already registered'}), 409
    else:
        existing = db.execute('SELECT id FROM users WHERE phone = ?', (phone,)).fetchone()
        if existing:
            return jsonify({'success': False, 'message': 'Phone number already registered'}), 409

    db.execute(
        'INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
        (name, email or None, phone or None, generate_password_hash(password), 'customer')
    )
    db.commit()
    return jsonify({'success': True, 'message': 'Account created successfully'})


@app.route('/api/auth/login', methods=['POST'])
@rate_limit(limit=8, period=60)
def login():
    data = request.get_json(silent=True) or {}
    contact = (data.get('contact') or data.get('email') or data.get('phone') or '').strip()
    password = data.get('password', '')

    if not contact or not password:
        return jsonify({'success': False, 'message': 'Missing credentials'}), 400

    db = get_db()
    if '@' in contact:
        user = db.execute('SELECT * FROM users WHERE email = ?', (contact.lower(),)).fetchone()
    else:
        user = db.execute('SELECT * FROM users WHERE phone = ?', (contact,)).fetchone()

    if not user or not check_password_hash(user['password'], password):
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
    if 'disabled' in user.keys() and user['disabled']:
        return jsonify({'success': False, 'message': 'Account disabled'}), 403

    session.clear()
    session['user_id'] = user['id']
    session['user_role'] = user['role']
    csrf_token = generate_csrf_token()
    return jsonify({'success': True, 'message': 'Login successful', 'user': {'id': user['id'], 'name': user['name'], 'email': user['email'], 'phone': user['phone'], 'role': user['role']}, 'csrf_token': csrf_token})


@app.route('/api/auth/reset-password', methods=['POST'])
@rate_limit(limit=4, period=300)
def reset_password():
    data = request.get_json(silent=True) or {}
    contact = (data.get('contact') or data.get('email') or data.get('phone') or '').strip()
    new_password = data.get('password', '')

    if not contact or not new_password:
        return jsonify({'success': False, 'message': 'Missing required fields'}), 400

    db = get_db()
    if '@' in contact:
        user = db.execute('SELECT * FROM users WHERE email = ?', (contact.lower(),)).fetchone()
    else:
        user = db.execute('SELECT * FROM users WHERE phone = ?', (contact,)).fetchone()

    if not user:
        return jsonify({'success': False, 'message': 'No account found for that contact'}), 404

    db.execute('UPDATE users SET password = ? WHERE id = ?', (generate_password_hash(new_password), user['id']))
    db.commit()
    return jsonify({'success': True, 'message': 'Password updated successfully'})


@app.route('/api/auth/me', methods=['PUT'])
@csrf_protect
def update_profile():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': 'Not authenticated'}), 401

    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    contact = data.get('contact', '').strip()
    password = data.get('password', '')

    email = None
    phone = None
    if contact:
        if '@' in contact:
            email = contact.lower()
        else:
            phone = contact

    db = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    if email and email != user['email']:
        existing = db.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
        if existing:
            return jsonify({'success': False, 'message': 'Email already in use'}), 409
    if phone and phone != user['phone']:
        existing = db.execute('SELECT id FROM users WHERE phone = ?', (phone,)).fetchone()
        if existing:
            return jsonify({'success': False, 'message': 'Phone number already in use'}), 409

    updated_name = name or user['name']
    updated_email = email if email is not None else user['email']
    updated_phone = phone if phone is not None else user['phone']
    if password:
        db.execute('UPDATE users SET name = ?, email = ?, phone = ?, password = ? WHERE id = ?', (updated_name, updated_email, updated_phone, generate_password_hash(password), user_id))
    else:
        db.execute('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?', (updated_name, updated_email, updated_phone, user_id))
    db.commit()

    return jsonify({'success': True, 'message': 'Account updated successfully', 'user': {'id': user_id, 'name': updated_name, 'email': updated_email, 'phone': updated_phone, 'role': user['role']}})


@app.route('/api/auth/logout', methods=['POST'])
@rate_limit(limit=10, period=60)
@csrf_protect
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out'})


@app.route('/api/auth/me', methods=['GET'])
def me():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': 'Not authenticated'}), 401

    db = get_db()
    user = db.execute('SELECT id, name, email, phone, role FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user:
        session.clear()
        return jsonify({'success': False, 'message': 'User not found'}), 404

    csrf_token = session.get('csrf_token') or generate_csrf_token()
    return jsonify({'success': True, 'user': {'id': user['id'], 'name': user['name'], 'email': user['email'], 'phone': user['phone'], 'role': user['role']}, 'csrf_token': csrf_token})


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not app.config.get('STRICT_ADMIN_AUTH', False):
            if session.get('user_role') != 'admin':
                return jsonify({'success': False, 'message': 'Admin access required'}), 401
            return f(*args, **kwargs)

        data = request.get_json(silent=True) or {}
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        if not email or not password:
            return jsonify({'success': False, 'message': 'Admin credentials required'}), 401
        db = get_db()
        user = db.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        if not user or user['role'] != 'admin' or not check_password_hash(user['password'], password):
            return jsonify({'success': False, 'message': 'Unauthorized admin access'}), 401
        return f(*args, **kwargs)
    return decorated


@app.route('/api/admin/users', methods=['GET'])
@admin_required
def admin_list_users():
    db = get_db()
    users = db.execute('SELECT id, name, email, phone, role, disabled FROM users ORDER BY id DESC').fetchall()
    return jsonify({'success': True, 'users': [dict(u) for u in users]})


@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@csrf_protect
@admin_required
def admin_update_user(user_id):
    data = request.get_json(silent=True) or {}
    role = data.get('role')
    disabled = data.get('disabled')
    if role is None and disabled is None:
        return jsonify({'success': False, 'message': 'Nothing to update'}), 400
    if role is not None and role not in ('admin', 'customer'):
        return jsonify({'success': False, 'message': 'Invalid role'}), 400
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    updates = []
    params = []
    if role is not None:
        updates.append('role = ?')
        params.append(role)
    if disabled is not None:
        updates.append('disabled = ?')
        params.append(1 if disabled else 0)
    params.append(user_id)
    db.execute('UPDATE users SET ' + ', '.join(updates) + ' WHERE id = ?', params)
    db.commit()
    return jsonify({'success': True, 'message': 'User updated'})


@app.route('/api/admin/users/<int:user_id>/reset-password', methods=['POST'])
@csrf_protect
@admin_required
def admin_reset_user_password(user_id):
    data = request.get_json(silent=True) or {}
    password = data.get('password', '')
    if not password:
        return jsonify({'success': False, 'message': 'Password required'}), 400
    db = get_db()
    user = db.execute('SELECT id FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    db.execute('UPDATE users SET password = ? WHERE id = ?', (generate_password_hash(password), user_id))
    db.commit()
    return jsonify({'success': True, 'message': 'Password reset'})


@app.route('/api/health', methods=['GET'])
def health():
    db = get_db()
    product_count = db.execute('SELECT COUNT(*) FROM products').fetchone()[0]
    order_count = db.execute('SELECT COUNT(*) FROM orders').fetchone()[0]
    return jsonify({'success': True, 'status': 'live', 'products': product_count, 'orders': order_count})


@app.route('/api/products', methods=['GET'])
def list_products():
    db = get_db()
    products = db.execute('SELECT * FROM products ORDER BY id DESC').fetchall()
    return jsonify({'success': True, 'products': [dict(p) for p in products]})


@app.route('/api/offers', methods=['GET'])
def list_offers():
    db = get_db()
    offers = db.execute('SELECT * FROM offers ORDER BY id DESC').fetchall()
    return jsonify({'success': True, 'offers': [dict(o) for o in offers]})


@app.route('/api/offers', methods=['POST'])
@csrf_protect
@admin_required
def create_offer():
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    discount = float(data.get('discount_percent') or 0)
    active = 1 if data.get('active') else 0
    starts_at = data.get('starts_at')
    ends_at = data.get('ends_at')
    if not title or discount <= 0:
        return jsonify({'success': False, 'message': 'Title and positive discount required'}), 400
    db = get_db()
    cursor = db.execute('INSERT INTO offers (title, description, discount_percent, active, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?)', (title, description, discount, active, starts_at, ends_at))
    db.commit()
    try:
        if socketio is not None:
            offer = db.execute('SELECT * FROM offers WHERE id = ?', (cursor.lastrowid,)).fetchone()
            socketio.emit('offer_created', dict(offer), broadcast=True)
    except Exception:
        pass
    return jsonify({'success': True, 'message': 'Offer created', 'offer_id': cursor.lastrowid})


@app.route('/api/offers/<int:offer_id>', methods=['PUT'])
@csrf_protect
@admin_required
def update_offer(offer_id):
    data = request.get_json(silent=True) or {}
    title = data.get('title')
    description = data.get('description')
    discount = data.get('discount_percent')
    active = data.get('active')
    starts_at = data.get('starts_at')
    ends_at = data.get('ends_at')
    db = get_db()
    offer = db.execute('SELECT * FROM offers WHERE id = ?', (offer_id,)).fetchone()
    if not offer:
        return jsonify({'success': False, 'message': 'Offer not found'}), 404
    db.execute('UPDATE offers SET title = ?, description = ?, discount_percent = ?, active = ?, starts_at = ?, ends_at = ? WHERE id = ?', (
        title or offer['title'],
        description if description is not None else offer['description'],
        float(discount) if discount is not None else offer['discount_percent'],
        1 if active else 0,
        starts_at if starts_at is not None else offer['starts_at'],
        ends_at if ends_at is not None else offer['ends_at'],
        offer_id
    ))
    db.commit()
    try:
        if socketio is not None:
            updated = db.execute('SELECT * FROM offers WHERE id = ?', (offer_id,)).fetchone()
            socketio.emit('offer_updated', dict(updated), broadcast=True)
    except Exception:
        pass
    return jsonify({'success': True, 'message': 'Offer updated'})


@app.route('/api/offers/<int:offer_id>', methods=['DELETE'])
@csrf_protect
@admin_required
def delete_offer(offer_id):
    db = get_db()
    offer = db.execute('SELECT id FROM offers WHERE id = ?', (offer_id,)).fetchone()
    if not offer:
        return jsonify({'success': False, 'message': 'Offer not found'}), 404
    db.execute('DELETE FROM offers WHERE id = ?', (offer_id,))
    db.commit()
    try:
        if socketio is not None:
            socketio.emit('offer_deleted', {'id': offer_id}, broadcast=True)
    except Exception:
        pass
    return jsonify({'success': True, 'message': 'Offer deleted'})


@app.route('/api/categories', methods=['GET'])
def list_categories():
    db = get_db()
    cats = db.execute('SELECT id, name FROM categories ORDER BY name COLLATE NOCASE').fetchall()
    return jsonify({'success': True, 'categories': [dict(c) for c in cats]})


@app.route('/api/categories', methods=['POST'])
@csrf_protect
@admin_required
def create_category():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'success': False, 'message': 'Category name required'}), 400
    db = get_db()
    try:
        db.execute('INSERT INTO categories (name) VALUES (?)', (name,))
        db.commit()
    except Exception:
        return jsonify({'success': False, 'message': 'Category already exists or invalid'}), 409
    return jsonify({'success': True, 'message': 'Category created'})


@app.route('/api/categories/<int:cat_id>', methods=['PUT'])
@csrf_protect
@admin_required
def update_category(cat_id):
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'success': False, 'message': 'Category name required'}), 400
    db = get_db()
    existing = db.execute('SELECT id FROM categories WHERE id = ?', (cat_id,)).fetchone()
    if not existing:
        return jsonify({'success': False, 'message': 'Category not found'}), 404
    # ensure unique
    other = db.execute('SELECT id FROM categories WHERE name = ? AND id != ?', (name, cat_id)).fetchone()
    if other:
        return jsonify({'success': False, 'message': 'Category name already exists'}), 409
    db.execute('UPDATE categories SET name = ? WHERE id = ?', (name, cat_id))
    db.commit()
    return jsonify({'success': True, 'message': 'Category updated'})


@app.route('/api/categories/<int:cat_id>', methods=['DELETE'])
@csrf_protect
@admin_required
def delete_category(cat_id):
    db = get_db()
    cat = db.execute('SELECT name FROM categories WHERE id = ?', (cat_id,)).fetchone()
    if not cat:
        return jsonify({'success': False, 'message': 'Category not found'}), 404
    # Move products in this category to 'Uncategorized'
    db.execute("UPDATE products SET category = ? WHERE category = ?", ('Uncategorized', cat['name']))
    db.execute('DELETE FROM categories WHERE id = ?', (cat_id,))
    db.commit()
    return jsonify({'success': True, 'message': 'Category deleted'})


@app.route('/api/orders/<int:order_id>', methods=['PUT'])
@csrf_protect
@admin_required
def update_order(order_id):
    data = request.get_json(silent=True) or {}
    status = (data.get('status') or '').strip()
    if not status:
        return jsonify({'success': False, 'message': 'Status required'}), 400
    db = get_db()
    order = db.execute('SELECT * FROM orders WHERE id = ?', (order_id,)).fetchone()
    if not order:
        return jsonify({'success': False, 'message': 'Order not found'}), 404
    db.execute('UPDATE orders SET status = ? WHERE id = ?', (status, order_id))
    db.commit()
    # Emit update to connected clients (if socketio available)
    try:
        if socketio is not None:
            order = db.execute('SELECT * FROM orders WHERE id = ?', (order_id,)).fetchone()
            socketio.emit('order_updated', dict(order), broadcast=True)
    except Exception:
        pass
    return jsonify({'success': True, 'message': 'Order updated'})


@app.route('/api/orders/<int:order_id>', methods=['DELETE'])
@csrf_protect
@admin_required
def delete_order(order_id):
    db = get_db()
    order = db.execute('SELECT id FROM orders WHERE id = ?', (order_id,)).fetchone()
    if not order:
        return jsonify({'success': False, 'message': 'Order not found'}), 404
    db.execute('DELETE FROM orders WHERE id = ?', (order_id,))
    db.commit()
    return jsonify({'success': True, 'message': 'Order deleted'})


def _get_setting(key: str) -> Optional[str]:
    db = get_db()
    row = db.execute('SELECT value FROM settings WHERE key = ?', (key,)).fetchone()
    return row['value'] if row else None


def _set_setting(key: str, value: str):
    db = get_db()
    db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (key, value))
    db.commit()


@app.route('/api/support', methods=['GET'])
def get_support():
    email = _get_setting('support_email') or ''
    phone = _get_setting('support_phone') or ''
    return jsonify({'success': True, 'support': {'email': email, 'phone': phone}})


@app.route('/api/support', methods=['PUT'])
@csrf_protect
@admin_required
def update_support():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip()
    phone = (data.get('phone') or '').strip()
    if not email and not phone:
        return jsonify({'success': False, 'message': 'Provide email or phone to update'}), 400
    if email:
        _set_setting('support_email', email)
    if phone:
        _set_setting('support_phone', phone)
    return jsonify({'success': True, 'message': 'Support contact updated'})


@app.route('/api/stripe/config', methods=['GET'])
def stripe_config():
    return jsonify({
        'success': True,
        'publishableKey': app.config['STRIPE_PUBLISHABLE_KEY'] or '',
        'enabled': bool(app.config['STRIPE_PUBLISHABLE_KEY'] and app.config['STRIPE_SECRET_KEY'])
    })


@app.route('/api/stripe/create-checkout-session', methods=['POST'])
@csrf_protect
def create_checkout_session():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    if stripe is None:
        return jsonify({'success': False, 'message': 'Stripe payment support is unavailable'}), 503
    if not app.config['STRIPE_SECRET_KEY'] or not app.config['STRIPE_PUBLISHABLE_KEY']:
        return jsonify({'success': False, 'message': 'Stripe configuration missing'}), 503

    data = request.get_json(silent=True) or {}
    items = data.get('items')
    total = data.get('total')
    customer_name = (data.get('customer_name') or '').strip()
    address = (data.get('address') or '').strip()
    payment_method = (data.get('payment') or 'Card').strip()

    if not items or total is None or not customer_name or not address:
        return jsonify({'success': False, 'message': 'Invalid checkout payload'}), 400

    if not isinstance(items, list) or not items:
        return jsonify({'success': False, 'message': 'Cart items are required'}), 400

    allowed_methods = {'card': 'card', 'upi': 'upi'}
    method_key = allowed_methods.get(payment_method.lower())
    if not method_key:
        method_key = 'card'

    line_items = []
    for item in items:
        if not isinstance(item, dict):
            continue
        unit_amount = int(round(float(item.get('price', 0) or 0) * 100))
        quantity = int(item.get('quantity', 1) or 1)
        if unit_amount <= 0 or quantity <= 0:
            continue
        line_items.append({
            'price_data': {
                'currency': 'inr',
                'product_data': {'name': str(item.get('name', 'Item'))},
                'unit_amount': unit_amount,
            },
            'quantity': quantity,
        })

    if not line_items:
        return jsonify({'success': False, 'message': 'Valid cart items are required'}), 400

    success_url = request.host_url.rstrip('/') + '/?checkout=success&session_id={CHECKOUT_SESSION_ID}'
    cancel_url = request.host_url.rstrip('/') + '/?checkout=cancel'

    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=[method_key],
            line_items=line_items,
            mode='payment',
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                'user_id': str(session['user_id']),
                'customer_name': customer_name,
                'address': address,
                'payment_method': payment_method,
            }
        )
    except Exception as exc:
        return jsonify({'success': False, 'message': f'Stripe checkout session creation failed: {str(exc)}'}), 500

    db = get_db()
    db.execute(
        'INSERT INTO orders (user_id, items, total, customer_name, address, payment_method, payment_details, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        (session['user_id'], json.dumps(items), total, customer_name, address, payment_method, checkout_session.id, 'payment_pending')
    )
    db.commit()
    order_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]

    return jsonify({'success': True, 'checkout_url': checkout_session.url, 'order_id': order_id})


@app.route('/webhook/stripe', methods=['POST'])
def stripe_webhook():
    if stripe is None:
        return 'Stripe webhook unavailable', 503
    if not app.config['STRIPE_WEBHOOK_SECRET']:
        return 'Webhook secret not configured', 503

    payload = request.data
    sig_header = request.headers.get('Stripe-Signature', '')
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, app.config['STRIPE_WEBHOOK_SECRET'])
    except ValueError:
        return 'Invalid payload', 400
    except Exception:
        return 'Invalid signature', 400

    if event['type'] == 'checkout.session.completed':
        session_obj = event['data']['object']
        payment_id = session_obj.get('payment_intent') or session_obj.get('id')
        db = get_db()
        order = db.execute('SELECT * FROM orders WHERE payment_details = ?', (session_obj.get('id'),)).fetchone()
        if order and order['status'] == 'payment_pending':
            db.execute('UPDATE orders SET status = ?, payment_details = ? WHERE id = ?', ('confirmed', payment_id, order['id']))
            db.commit()
            order_data = dict(order)
            order_data['status'] = 'confirmed'
            order_data['payment_details'] = payment_id
            _send_order_emails(order_data)

    return '', 200


@app.route('/api/products', methods=['POST'])
@csrf_protect
@admin_required
def create_product():
    data = request.get_json(silent=True) or {}
    required = ['name', 'category', 'vendor', 'price', 'stock', 'description', 'image']
    if not all(field in data for field in required):
        return jsonify({'success': False, 'message': 'Missing required product fields'}), 400

    db = get_db()
    cursor = db.execute(
        '''
        INSERT INTO products (name, category, vendor, price, original_price, stock, rating, reviews, badge, description, image, featured)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''',
        (
            data['name'],
            data['category'],
            data['vendor'],
            data['price'],
            data.get('original_price') or data.get('originalPrice'),
            data['stock'],
            data.get('rating', 0),
            data.get('reviews', 0),
            data.get('badge', 'New'),
            data['description'],
            data['image'],
            1 if data.get('featured', False) else 0,
        ),
    )
    db.commit()
    product = db.execute('SELECT * FROM products WHERE id = ?', (cursor.lastrowid,)).fetchone()
    try:
        if socketio is not None:
            socketio.emit('product_created', dict(product), broadcast=True)
    except Exception:
        pass
    return jsonify({'success': True, 'message': 'Product added successfully', 'product_id': cursor.lastrowid})


@app.route('/api/products/import', methods=['POST'])
@csrf_protect
@admin_required
def import_products():
    payload = request.get_json(silent=True) or {}
    products_data = payload.get('products') if isinstance(payload, dict) else payload

    if not isinstance(products_data, list) or not products_data:
        return jsonify({'success': False, 'message': 'A JSON array of products is required'}), 400

    db = get_db()
    inserted_rows = 0
    products_to_insert = []

    for item in products_data:
        if not isinstance(item, dict):
            continue

        name = (item.get('name') or '').strip()
        category = (item.get('category') or 'Uncategorized').strip() or 'Uncategorized'
        vendor = (item.get('vendor') or 'Unknown Vendor').strip() or 'Unknown Vendor'
        description = (item.get('description') or '').strip() or 'Description unavailable.'
        image = (item.get('image') or '').strip() or 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80'

        try:
            price = float(item.get('price') or 0)
        except (TypeError, ValueError):
            price = 0
        try:
            stock = int(item.get('stock') or 0)
        except (TypeError, ValueError):
            stock = 0
        try:
            rating = float(item.get('rating') or 0)
        except (TypeError, ValueError):
            rating = 0
        try:
            reviews = int(item.get('reviews') or 0)
        except (TypeError, ValueError):
            reviews = 0

        original_price = item.get('original_price') or item.get('originalPrice')
        try:
            original_price = float(original_price) if original_price is not None else price + 200
        except (TypeError, ValueError):
            original_price = price + 200

        badge = (item.get('badge') or 'New').strip()

        if not name or price <= 0 or stock < 0:
            continue

        existing_category = db.execute('SELECT id FROM categories WHERE name = ?', (category,)).fetchone()
        if not existing_category:
            db.execute('INSERT OR IGNORE INTO categories (name) VALUES (?)', (category,))

        products_to_insert.append((
            name,
            category,
            vendor,
            price,
            original_price,
            stock,
            rating,
            reviews,
            badge,
            description,
            image,
            0
        ))

    if not products_to_insert:
        return jsonify({'success': False, 'message': 'No valid products found to import.'}), 400

    db.executemany(
        '''
        INSERT INTO products (name, category, vendor, price, original_price, stock, rating, reviews, badge, description, image, featured)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''',
        products_to_insert
    )
    db.commit()
    inserted_rows = len(products_to_insert)

    try:
        if socketio is not None:
            socketio.emit('product_created', {'bulk_import': True}, broadcast=True)
    except Exception:
        pass

    return jsonify({'success': True, 'message': f'Imported {inserted_rows} products', 'imported_count': inserted_rows})


@app.route('/api/products/<int:product_id>', methods=['PUT'])
@csrf_protect
@admin_required
def update_product(product_id):
    data = request.get_json(silent=True) or {}
    db = get_db()
    product = db.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()
    if not product:
        return jsonify({'success': False, 'message': 'Product not found'}), 404

    db.execute(
        '''
        UPDATE products
        SET name = ?, category = ?, vendor = ?, price = ?, original_price = ?, stock = ?, rating = ?, reviews = ?, badge = ?, description = ?, image = ?, featured = ?
        WHERE id = ?
        ''',
        (
            data.get('name', product['name']),
            data.get('category', product['category']),
            data.get('vendor', product['vendor']),
            data.get('price', product['price']),
            data.get('original_price') or data.get('originalPrice') or product['original_price'],
            data.get('stock', product['stock']),
            data.get('rating', product['rating']),
            data.get('reviews', product['reviews']),
            data.get('badge', product['badge']),
            data.get('description', product['description']),
            data.get('image', product['image']),
            1 if data.get('featured', bool(product['featured'])) else 0,
            product_id,
        ),
    )
    db.commit()
    try:
        if socketio is not None:
            socketio.emit('product_updated', dict(product), room='admins')
    except Exception:
        pass
    return jsonify({'success': True, 'message': 'Product updated successfully'})


@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@csrf_protect
@admin_required
def delete_product(product_id):
    db = get_db()
    db.execute('DELETE FROM products WHERE id = ?', (product_id,))
    db.commit()
    try:
        if socketio is not None:
            socketio.emit('product_deleted', {'id': product_id}, room='admins')
    except Exception:
        pass
    return jsonify({'success': True, 'message': 'Product deleted successfully'})


@app.route('/api/orders', methods=['POST'])
@csrf_protect
def place_order():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    data = request.get_json(silent=True) or {}
    items = data.get('items')
    total = data.get('total')
    customer_name = (data.get('customer_name') or '').strip()
    address = (data.get('address') or '').strip()
    payment_method = (data.get('payment') or 'COD').strip()
    payment_details = (data.get('payment_details') or '').strip()

    if not items or total is None or not customer_name or not address:
        return jsonify({'success': False, 'message': 'Invalid order payload'}), 400
    if payment_method != 'COD' and not payment_details:
        return jsonify({'success': False, 'message': 'Payment details are required for this method'}), 400

    db = get_db()
    db.execute(
        'INSERT INTO orders (user_id, items, total, customer_name, address, payment_method, payment_details, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        (session['user_id'], json.dumps(items), total, customer_name, address, payment_method, payment_details, 'pending')
    )
    db.commit()
    order_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    order = db.execute('SELECT * FROM orders WHERE id = ?', (order_id,)).fetchone()
    # Emit creation event for connected clients (if socketio available)
    try:
        if socketio is not None and order is not None:
            socketio.emit('order_created', {'id': order['id'], 'total': order['total'], 'status': order['status']}, room='admins')
    except Exception:
        pass
    if order is not None:
        _send_order_emails(dict(order))
    return jsonify({'success': True, 'message': 'Order placed successfully', 'order_id': order_id})


@app.route('/api/orders', methods=['GET'])
def list_orders():
    db = get_db()
    user_id = session.get('user_id')
    if user_id is None:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401

    if session.get('user_role') == 'admin':
        orders = db.execute('SELECT * FROM orders ORDER BY id DESC').fetchall()
    else:
        orders = db.execute('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', (user_id,)).fetchall()

    return jsonify({'success': True, 'orders': [dict(order) for order in orders]})


if __name__ == '__main__':
    if socketio is not None:
        socketio.run(app, debug=app.config['DEBUG'], host='0.0.0.0', port=5000)
    else:
        app.run(debug=app.config['DEBUG'], host='0.0.0.0', port=5000)
