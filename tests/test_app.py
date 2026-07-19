import os
import tempfile
import unittest

from server import app, init_db


class AppTests(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        app.config.update(TESTING=True, DATABASE=os.path.join(self.tmp_dir, 'test.db'))
        with app.app_context():
            init_db()
        self.client = app.test_client()

    def test_register_and_login(self):
        response = self.client.post('/api/auth/register', json={
            'name': 'Test User',
            'email': 'user@example.com',
            'password': 'secret123'
        })
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload['success'])

        login = self.client.post('/api/auth/login', json={
            'email': 'user@example.com',
            'password': 'secret123'
        })
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.get_json()['success'])

    def test_health_endpoint(self):
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['success'])

    def test_auth_me_and_order_history(self):
        login = self.client.post('/api/auth/login', json={
            'email': 'admin@jacollections.com',
            'password': 'admin123'
        })
        self.assertEqual(login.status_code, 200)

        me = self.client.get('/api/auth/me')
        self.assertEqual(me.status_code, 200)
        self.assertTrue(me.get_json()['success'])

        orders = self.client.get('/api/orders')
        self.assertEqual(orders.status_code, 200)
        self.assertIn('orders', orders.get_json())

    def test_order_creation_requires_csrf(self):
        login = self.client.post('/api/auth/login', json={
            'email': 'admin@jacollections.com',
            'password': 'admin123'
        })
        self.assertEqual(login.status_code, 200)
        csrf_token = login.get_json().get('csrf_token')

        response = self.client.post('/api/orders', json={
            'items': [{'id': 1, 'name': 'Golden Thread Saree', 'price': 2899, 'quantity': 1}],
            'total': 2899,
            'customer_name': 'Ja User',
            'address': 'Mumbai, India',
            'payment': 'COD'
        })
        self.assertEqual(response.status_code, 403)

        response = self.client.post('/api/orders', json={
            'items': [{'id': 1, 'name': 'Golden Thread Saree', 'price': 2899, 'quantity': 1}],
            'total': 2899,
            'customer_name': 'Ja User',
            'address': 'Mumbai, India',
            'payment': 'COD'
        }, headers={'X-CSRF-Token': csrf_token})
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload['success'])
        self.assertIn('order_id', payload)

        orders = self.client.get('/api/orders')
        self.assertEqual(orders.status_code, 200)
        payload = orders.get_json()
        self.assertTrue(any(order['id'] == payload['orders'][0]['id'] for order in payload['orders']))

    def test_stripe_config_returns_expected_payload(self):
        response = self.client.get('/api/stripe/config')
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload['success'])
        self.assertIn('publishableKey', payload)
        self.assertFalse(payload['enabled'])

    def test_admin_can_add_product(self):
        admin = self.client.post('/api/auth/login', json={
            'email': 'admin@jacollections.com',
            'password': 'admin123'
        })
        self.assertEqual(admin.status_code, 200)
        admin_data = admin.get_json()
        csrf_token = admin_data.get('csrf_token')

        response = self.client.post('/api/products', json={
            'name': 'Bridal Velvet Saree',
            'category': 'Sarees',
            'vendor': 'JA Studio',
            'price': 3499,
            'original_price': 4599,
            'stock': 12,
            'rating': 4.9,
            'reviews': 84,
            'badge': 'Admin Added',
            'description': 'Handcrafted bridal saree',
            'image': 'https://example.com/saree.jpg'
        }, headers={'X-CSRF-Token': csrf_token})
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload['success'])

        products = self.client.get('/api/products')
        self.assertEqual(products.status_code, 200)
        data = products.get_json()
        self.assertTrue(any(item['name'] == 'Bridal Velvet Saree' for item in data['products']))


if __name__ == '__main__':
    unittest.main()
