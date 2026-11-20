# =====================================================
# MTC SMART MANAGER - OPTIONAL PYTHON RUNNER
# Standalone HTTP Server & REST API using Python Standard Library
# (Zero pip install required)
# =====================================================

import http.server
import socketserver
import json
import sqlite3
import os
import mimetypes
from urllib.parse import urlparse
from datetime import datetime

PORT = 3000
DB_FILE = os.path.join(os.path.dirname(__file__), 'mtc_smart_manager.db')
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), 'public')

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

class RequestHandler(http.server.BaseHTTPRequestHandler):
    def send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        conn = get_db()
        cur = conn.cursor()

        try:
            if path == '/api/users':
                cur.execute('SELECT user_id, full_name, phone_number, sim_number, email, balance, data_balance_gb, minutes_balance, account_status FROM users ORDER BY user_id ASC')
                users = [dict(r) for r in cur.fetchall()]
                return self.send_json(200, {'success': True, 'users': users})

            if path.startswith('/api/user/') and not path.endswith('/settings'):
                user_id = int(path.split('/')[3])
                cur.execute('SELECT user_id, full_name, phone_number, sim_number, email, balance, data_balance_gb, minutes_balance, account_status, is_two_factor_enabled, daily_transfer_limit, require_transfer_pin, auto_lock_timer FROM users WHERE user_id = ?', (user_id,))
                row = cur.fetchone()
                if row:
                    return self.send_json(200, {'success': True, 'user': dict(row)})
                return self.send_json(404, {'error': True, 'message': 'User not found'})

            if path == '/api/packages':
                cur.execute('SELECT * FROM packages WHERE is_active = 1 ORDER BY price ASC')
                pkgs = [dict(r) for r in cur.fetchall()]
                return self.send_json(200, {'success': True, 'packages': pkgs})

            if path.startswith('/api/transactions/'):
                user_id = int(path.split('/')[3])
                cur.execute('SELECT * FROM transactions WHERE user_id = ? ORDER BY transaction_id DESC', (user_id,))
                txs = [dict(r) for r in cur.fetchall()]
                return self.send_json(200, {'success': True, 'transactions': txs})

            if path.startswith('/api/alerts/'):
                user_id = int(path.split('/')[3])
                cur.execute('SELECT * FROM security_alerts WHERE user_id = ? ORDER BY alert_id DESC', (user_id,))
                alerts = [dict(r) for r in cur.fetchall()]
                return self.send_json(200, {'success': True, 'alerts': alerts})

            if path.startswith('/api/security/'):
                user_id = int(path.split('/')[3])
                cur.execute('SELECT key_algorithm, is_active FROM encryption_keys WHERE user_id = ? AND is_active = 1', (user_id,))
                key = cur.fetchone()
                cur.execute('SELECT * FROM security_logs WHERE user_id = ? ORDER BY log_id DESC LIMIT 20', (user_id,))
                logs = [dict(r) for r in cur.fetchall()]
                return self.send_json(200, {
                    'success': True,
                    'info': {'encryption': dict(key) if key else {'key_algorithm': 'AES-256'}},
                    'logs': logs
                })

            self.serve_static(path)
        finally:
            conn.close()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}

        conn = get_db()
        cur = conn.cursor()

        try:
            if path == '/api/login':
                user_id = int(body.get('userId', 1))
                cur.execute('SELECT * FROM users WHERE user_id = ?', (user_id,))
                row = cur.fetchone()
                if row:
                    cur.execute("UPDATE users SET failed_login_attempts = 0, last_login = datetime('now') WHERE user_id = ?", (user_id,))
                    conn.commit()
                    return self.send_json(200, {'success': True, 'user': dict(row)})
                return self.send_json(401, {'error': True, 'message': 'Invalid user'})

            if path == '/api/recharge':
                user_id = int(body.get('userId', 1))
                amount = float(body.get('amount', 0))
                cur.execute('SELECT balance, phone_number, full_name FROM users WHERE user_id = ?', (user_id,))
                row = cur.fetchone()
                if not row:
                    return self.send_json(404, {'error': True, 'message': 'User not found'})
                old_bal = row['balance']
                new_bal = old_bal + amount
                receipt_id = f"TXN05{int(datetime.now().timestamp())}"

                cur.execute('UPDATE users SET balance = balance + ? WHERE user_id = ?', (amount, user_id))
                cur.execute('''
                    INSERT INTO transactions (receipt_id, user_id, transaction_type, amount, balance_before, balance_after, details, sender_phone, sender_name, transaction_status)
                    VALUES (?, ?, 'recharge', ?, ?, ?, 'Quick Recharge via SMS', ?, ?, 'completed')
                ''', (receipt_id, user_id, amount, old_bal, new_bal, row['phone_number'], row['full_name']))
                conn.commit()

                cur.execute('SELECT * FROM users WHERE user_id = ?', (user_id,))
                updated_user = dict(cur.fetchone())

                return self.send_json(200, {
                    'success': True,
                    'receipt': {
                        'receiptId': receipt_id,
                        'type': 'Recharge',
                        'amount': amount,
                        'from': f"{row['full_name']} ({row['phone_number']})",
                        'to': f"{row['full_name']} ({row['phone_number']})",
                        'date': datetime.now().strftime('%b %d, %Y, %I:%M %p'),
                        'status': 'Success'
                    },
                    'user': updated_user
                })

            if path == '/api/transfer':
                sender_id = int(body.get('senderId', 1))
                rec_phone = str(body.get('recipientPhone', '')).strip()
                amount = float(body.get('amount', 0))

                cur.execute('SELECT * FROM users WHERE user_id = ?', (sender_id,))
                sender = cur.fetchone()
                cur.execute('SELECT * FROM users WHERE phone_number = ?', (rec_phone,))
                rec = cur.fetchone()

                if not sender or not rec:
                    return self.send_json(400, {'error': True, 'message': 'User or recipient not found'})
                if sender['balance'] < amount:
                    return self.send_json(400, {'error': True, 'message': 'Insufficient balance'})

                receipt_id = f"TXN05{int(datetime.now().timestamp())}"
                s_old = sender['balance']
                s_new = s_old - amount
                r_old = rec['balance']
                r_new = r_old + amount

                cur.execute('UPDATE users SET balance = balance - ? WHERE user_id = ?', (amount, sender_id))
                cur.execute('UPDATE users SET balance = balance + ? WHERE user_id = ?', (amount, rec['user_id']))

                cur.execute('''
                    INSERT INTO transactions (receipt_id, user_id, recipient_id, transaction_type, amount, balance_before, balance_after, details, recipient_phone, recipient_name, sender_phone, sender_name, transaction_status)
                    VALUES (?, ?, ?, 'transfer', ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
                ''', (receipt_id, sender_id, rec['user_id'], amount, s_old, s_new, f"Transfer to {rec['full_name']}", rec['phone_number'], rec['full_name'], sender['phone_number'], sender['full_name']))
                conn.commit()

                cur.execute('SELECT * FROM users WHERE user_id = ?', (sender_id,))
                updated_sender = dict(cur.fetchone())

                return self.send_json(200, {
                    'success': True,
                    'receipt': {
                        'receiptId': receipt_id,
                        'type': 'Transfer',
                        'amount': amount,
                        'from': f"{sender['full_name']} ({sender['phone_number']})",
                        'to': f"{rec['full_name']} ({rec['phone_number']})",
                        'date': datetime.now().strftime('%b %d, %Y, %I:%M %p'),
                        'status': 'Success'
                    },
                    'user': updated_sender
                })

            if path == '/api/convert':
                user_id = int(body.get('userId', 1))
                amount = float(body.get('amount', 9))
                cur.execute('SELECT * FROM users WHERE user_id = ?', (user_id,))
                user = cur.fetchone()
                if not user or user['balance'] < amount:
                    return self.send_json(400, {'error': True, 'message': 'Insufficient balance'})

                mb = amount * 100
                gb = mb / 1000.0
                receipt_id = f"TXN05{int(datetime.now().timestamp())}"
                old_bal = user['balance']
                new_bal = old_bal - amount

                cur.execute('UPDATE users SET balance = balance - ?, data_balance_gb = data_balance_gb + ? WHERE user_id = ?', (amount, gb, user_id))
                cur.execute('''
                    INSERT INTO transactions (receipt_id, user_id, transaction_type, amount, balance_before, balance_after, details, sender_phone, sender_name, transaction_status)
                    VALUES (?, ?, 'dollar_to_data', ?, ?, ?, ?, ?, ?, 'completed')
                ''', (receipt_id, user_id, amount, old_bal, new_bal, f"Converted ${amount} to {mb} MB", user['phone_number'], user['full_name']))
                conn.commit()

                cur.execute('SELECT * FROM users WHERE user_id = ?', (user_id,))
                updated_user = dict(cur.fetchone())

                return self.send_json(200, {
                    'success': True,
                    'receipt': {
                        'receiptId': receipt_id,
                        'type': 'Dollar → Data Conversion',
                        'amount': amount,
                        'from': f"{user['full_name']} ({user['phone_number']})",
                        'to': f"Data Bundle ({mb} MB)",
                        'date': datetime.now().strftime('%b %d, %Y, %I:%M %p'),
                        'status': 'Success'
                    },
                    'user': updated_user
                })

            if path == '/api/packages/subscribe':
                user_id = int(body.get('userId', 1))
                pkg_id = int(body.get('packageId', 1))
                cur.execute('SELECT * FROM users WHERE user_id = ?', (user_id,))
                user = cur.fetchone()
                cur.execute('SELECT * FROM packages WHERE package_id = ?', (pkg_id,))
                pkg = cur.fetchone()

                if not user or not pkg:
                    return self.send_json(400, {'error': True, 'message': 'Invalid user or package'})
                if user['balance'] < pkg['price']:
                    return self.send_json(400, {'error': True, 'message': 'Insufficient balance'})

                receipt_id = f"TXN05{int(datetime.now().timestamp())}"
                old_bal = user['balance']
                new_bal = old_bal - pkg['price']

                cur.execute('UPDATE users SET balance = balance - ?, data_balance_gb = data_balance_gb + ? WHERE user_id = ?', (pkg['price'], pkg['data_gb'], user_id))
                cur.execute('''
                    INSERT INTO transactions (receipt_id, user_id, transaction_type, amount, balance_before, balance_after, details, sender_phone, sender_name, transaction_status)
                    VALUES (?, ?, 'package_purchase', ?, ?, ?, ?, ?, ?, 'completed')
                ''', (receipt_id, user_id, pkg['price'], old_bal, new_bal, f"Subscribed: {pkg['package_name']}", user['phone_number'], user['full_name']))
                conn.commit()

                cur.execute('SELECT * FROM users WHERE user_id = ?', (user_id,))
                updated_user = dict(cur.fetchone())

                return self.send_json(200, {
                    'success': True,
                    'receipt': {
                        'receiptId': receipt_id,
                        'type': 'Package Subscription',
                        'amount': pkg['price'],
                        'from': f"{user['full_name']} ({user['phone_number']})",
                        'to': f"{pkg['package_name']} ({pkg['data_gb']} GB)",
                        'date': datetime.now().strftime('%b %d, %Y, %I:%M %p'),
                        'status': 'Success'
                    },
                    'user': updated_user
                })
        finally:
            conn.close()

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}

        if path.startswith('/api/user/') and path.endswith('/settings'):
            user_id = int(path.split('/')[3])
            conn = get_db()
            cur = conn.cursor()
            try:
                if 'isTwoFactor' in body:
                    cur.execute('UPDATE users SET is_two_factor_enabled = ? WHERE user_id = ?', (1 if body['isTwoFactor'] else 0, user_id))
                if 'autoLockTimer' in body:
                    cur.execute('UPDATE users SET auto_lock_timer = ? WHERE user_id = ?', (int(body['autoLockTimer']), user_id))
                if 'dailyLimit' in body:
                    cur.execute('UPDATE users SET daily_transfer_limit = ? WHERE user_id = ?', (float(body['dailyLimit']), user_id))
                if 'requirePin' in body:
                    cur.execute('UPDATE users SET require_transfer_pin = ? WHERE user_id = ?', (1 if body['requirePin'] else 0, user_id))
                conn.commit()

                cur.execute('SELECT * FROM users WHERE user_id = ?', (user_id,))
                user = dict(cur.fetchone())
                return self.send_json(200, {'success': True, 'user': user})
            finally:
                conn.close()

    def serve_static(self, path):
        if path == '/':
            path = '/index.html'
        file_path = os.path.join(PUBLIC_DIR, path.lstrip('/'))
        if not os.path.isfile(file_path):
            file_path = os.path.join(PUBLIC_DIR, 'index.html')

        ctype, _ = mimetypes.guess_type(file_path)
        if not ctype:
            ctype = 'text/plain'

        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception:
            self.send_response(500)
            self.end_headers()

if __name__ == '__main__':
    print(f"====================================================")
    print(f"🚀 MTC Smart Manager (Python Server) running at: http://localhost:{PORT}")
    print(f"====================================================")
    with socketserver.TCPServer(("", PORT), RequestHandler) as httpd:
        httpd.serve_forever()
