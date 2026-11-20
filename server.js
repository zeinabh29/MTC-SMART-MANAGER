// =====================================================
// MTC SMART MANAGER - HTTP BACKEND & REST API SERVER
// Built with pure Node.js (0 external dependencies required)
// Compatible with any standard Node.js installation
// =====================================================

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const db = require('./database.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
    sendJson(res, statusCode, { error: true, message });
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (err) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

function serveStatic(req, res, pathname) {
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            filePath = path.join(PUBLIC_DIR, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(filePath, (readErr, content) => {
            if (readErr) {
                res.writeHead(500);
                return res.end('Internal Server Error');
            }
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache'
            });
            res.end(content);
        });
    });
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        return res.end();
    }

    const parsedUrl = url.parse(req.url, true);
    const { pathname } = parsedUrl;

    try {
        // 1. PIN Login / Verify
        if (pathname === '/api/login' && req.method === 'POST') {
            const body = await parseBody(req);
            const userId = parseInt(body.userId || 1, 10);
            const pin = String(body.pin || '');

            if (!pin || pin.length < 4) {
                return sendError(res, 400, '4-digit PIN is required');
            }

            const result = db.verifyPin(userId, pin);
            if (!result.success) {
                return sendError(res, 401, result.message);
            }

            const user = db.getUser(userId);
            return sendJson(res, 200, { success: true, user });
        }

        // 2. Get User Profile
        if (pathname.startsWith('/api/user/') && req.method === 'GET' && !pathname.endsWith('/settings')) {
            const parts = pathname.split('/');
            const userId = parseInt(parts[3], 10);
            const user = db.getUser(userId);
            if (!user) return sendError(res, 404, 'User not found');
            return sendJson(res, 200, { success: true, user });
        }

        // 3. Get All Team Members / Users
        if (pathname === '/api/users' && req.method === 'GET') {
            const users = db.getAllUsers();
            return sendJson(res, 200, { success: true, users });
        }

        // 4. Update User Settings
        if (pathname.startsWith('/api/user/') && pathname.endsWith('/settings') && req.method === 'PUT') {
            const parts = pathname.split('/');
            const userId = parseInt(parts[3], 10);
            const body = await parseBody(req);
            const updated = db.updateUserSettings(userId, body);
            return sendJson(res, 200, { success: true, user: updated });
        }

        // 5. Quick Recharge
        if (pathname === '/api/recharge' && req.method === 'POST') {
            const body = await parseBody(req);
            const userId = parseInt(body.userId, 10);
            const amount = parseFloat(body.amount);
            const paymentMethod = body.paymentMethod || 'SMS';

            if (!userId || isNaN(amount) || amount <= 0) {
                return sendError(res, 400, 'Invalid recharge parameters');
            }

            const receipt = db.processRecharge(userId, amount, paymentMethod);
            const updatedUser = db.getUser(userId);
            return sendJson(res, 200, { success: true, receipt, user: updatedUser });
        }

        // 6. Transfer Balance
        if (pathname === '/api/transfer' && req.method === 'POST') {
            const body = await parseBody(req);
            const senderId = parseInt(body.senderId, 10);
            const recipientPhone = String(body.recipientPhone || '').trim();
            const amount = parseFloat(body.amount);
            const pin = body.pin || null;

            if (!senderId || !recipientPhone || isNaN(amount) || amount <= 0) {
                return sendError(res, 400, 'Invalid transfer parameters. Fill all fields properly.');
            }

            const receipt = db.processTransfer(senderId, recipientPhone, amount, pin);
            const updatedUser = db.getUser(senderId);
            return sendJson(res, 200, { success: true, receipt, user: updatedUser });
        }

        // 7. Dollar to Data Conversion
        if (pathname === '/api/convert' && req.method === 'POST') {
            const body = await parseBody(req);
            const userId = parseInt(body.userId, 10);
            const amount = parseFloat(body.amount);

            if (!userId || isNaN(amount) || amount <= 0) {
                return sendError(res, 400, 'Invalid conversion amount');
            }

            const receipt = db.processDollarToData(userId, amount);
            const updatedUser = db.getUser(userId);
            return sendJson(res, 200, { success: true, receipt, user: updatedUser });
        }

        // 8. Available Packages
        if (pathname === '/api/packages' && req.method === 'GET') {
            const packages = db.getPackages();
            return sendJson(res, 200, { success: true, packages });
        }

        // 9. Subscribe to Package
        if (pathname === '/api/packages/subscribe' && req.method === 'POST') {
            const body = await parseBody(req);
            const userId = parseInt(body.userId, 10);
            const packageId = parseInt(body.packageId, 10);

            if (!userId || !packageId) {
                return sendError(res, 400, 'User and package ID required');
            }

            const receipt = db.subscribePackage(userId, packageId);
            const updatedUser = db.getUser(userId);
            return sendJson(res, 200, { success: true, receipt, user: updatedUser });
        }

        // 10. User Transactions History
        if (pathname.startsWith('/api/transactions/') && req.method === 'GET') {
            const parts = pathname.split('/');
            const userId = parseInt(parts[3], 10);
            const txns = db.getUserTransactions(userId);
            return sendJson(res, 200, { success: true, transactions: txns });
        }

        // 11. Security Alerts
        if (pathname.startsWith('/api/alerts/') && !pathname.endsWith('/read') && req.method === 'GET') {
            const parts = pathname.split('/');
            const userId = parseInt(parts[3], 10);
            const alerts = db.getAlerts(userId);
            return sendJson(res, 200, { success: true, alerts });
        }

        // 12. Mark Alert Read
        if (pathname.startsWith('/api/alerts/') && pathname.endsWith('/read') && req.method === 'POST') {
            const parts = pathname.split('/');
            const alertId = parseInt(parts[3], 10);
            db.markAlertRead(alertId);
            return sendJson(res, 200, { success: true });
        }

        // 13. Security Info & Audit Logs
        if (pathname.startsWith('/api/security/') && req.method === 'GET') {
            const parts = pathname.split('/');
            const userId = parseInt(parts[3], 10);
            const info = db.getSecurityInfo(userId);
            const logs = db.getSecurityLogs(userId);
            return sendJson(res, 200, { success: true, info, logs });
        }

        // Static Frontend Files
        return serveStatic(req, res, pathname);

    } catch (err) {
        console.error('API Error:', err.message);
        return sendError(res, 400, err.message || 'Operation failed');
    }
});

server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 MTC SMART MANAGER is running at: http://localhost:${PORT}`);
    console.log(`📡 REST API & Database Ready (Zero Dependencies)`);
    console.log(`====================================================`);
});

module.exports = server;
