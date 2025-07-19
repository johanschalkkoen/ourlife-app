const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const https = require('https');
const http = require('http');
const execPromise = util.promisify(exec);
const app = express();

const HTTPS_PORT = 8443;
const HTTP_PORT = 9000;
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./ourlife.db', (err) => {
    if (err) { console.error('Error connecting to database:', err.message); }
    else {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                profilePicUrl TEXT,
                email TEXT,
                phone TEXT,
                address TEXT,
                eventColor TEXT
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS financial_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user TEXT,
                description TEXT,
                amount REAL,
                type TEXT,
                date TEXT,
                color TEXT
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS calendar_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user TEXT,
                title TEXT,
                date TEXT,
                financial INTEGER,
                type TEXT,
                amount REAL,
                eventColor TEXT
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS user_access (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                viewer TEXT,
                target TEXT,
                UNIQUE(viewer, target)
            )`);
        });
    }
});

// Helper functions
async function readUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return {};
        console.error('Error reading users file:', error);
        return {};
    }
}

async function writeUsers(users) {
    try {
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing users file:', error);
    }
}

const requireAdmin = async (req, res, next) => {
    const username = req.body.username || req.query.username;
    if (!username) return res.json({ success: false, message: 'Username required.' });
    const users = await readUsers();
    if (!users[username] || !users[username].isAdmin) {
        return res.json({ success: false, message: 'Unauthorized: Admin access required.' });
    }
    next();
};

// --- ADMIN API ENDPOINTS ---

// GET: Fetch all users (details)
app.get('/api/users', requireAdmin, async (req, res) => {
    try {
        const users = await readUsers();
        db.all(`SELECT * FROM users`, [], (err, rows) => {
            if (err) return res.json({ success: false, message: 'DB error.' });
            const list = Object.keys(users).map(username => ({
                username,
                isAdmin: !!users[username].isAdmin,
                ...rows.find(r => r.username === username)
            }));
            res.json({ success: true, users: list });
        });
    } catch (error) {
        res.json({ success: false, message: 'Failed to fetch users.' });
    }
});

// POST: Add user
app.post('/api/add-user', requireAdmin, async (req, res) => {
    const { username, password, isAdmin = false, email = '', phone = '', address = '', eventColor = '#3b82f6' } = req.body;
    if (!username || !password) return res.json({ success: false, message: 'Username and password required.' });
    try {
        const users = await readUsers();
        if (users[username]) return res.json({ success: false, message: 'User exists.' });
        const passwordHash = await bcrypt.hash(password, 10);
        users[username] = { passwordHash, isAdmin };
        await writeUsers(users);
        db.run(
            `INSERT OR REPLACE INTO users (username, profilePicUrl, email, phone, address, eventColor) VALUES (?, ?, ?, ?, ?, ?)`,
            [username, '', email, phone, address, eventColor]
        );
        res.json({ success: true, message: 'User added.' });
    } catch (error) {
        res.json({ success: false, message: 'Failed to add user.' });
    }
});

// PUT: Update user details and admin flag
app.put('/api/update-user', requireAdmin, async (req, res) => {
    const { username, email, phone, address, eventColor, isAdmin } = req.body;
    if (!username) return res.json({ success: false, message: 'Username required.' });
    try {
        const users = await readUsers();
        if (!users[username]) return res.json({ success: false, message: 'User not found.' });
        users[username].isAdmin = isAdmin;
        await writeUsers(users);
        db.run(
            `UPDATE users SET email=?, phone=?, address=?, eventColor=? WHERE username=?`,
            [email, phone, address, eventColor, username],
            (err) => {
                if (err) res.json({ success: false, message: 'DB error.' });
                else res.json({ success: true, message: 'User updated.' });
            }
        );
    } catch (error) {
        res.json({ success: false, message: 'Failed to update user.' });
    }
});

// DELETE: Remove user
app.delete('/api/delete-user/:username', requireAdmin, async (req, res) => {
    const { username } = req.params;
    try {
        const users = await readUsers();
        if (!users[username]) return res.json({ success: false, message: 'User not found.' });
        delete users[username];
        await writeUsers(users);
        db.run('DELETE FROM users WHERE username = ?', [username]);
        db.run('DELETE FROM user_access WHERE viewer = ? OR target = ?', [username, username]);
        res.json({ success: true, message: 'User deleted.' });
    } catch (error) {
        res.json({ success: false, message: 'Failed to delete user.' });
    }
});

// POST: Admin resets any user's password
app.post('/api/admin-update-password', requireAdmin, async (req, res) => {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) return res.json({ success: false, message: 'Username and new password required.' });
    try {
        const users = await readUsers();
        if (!users[username]) return res.json({ success: false, message: 'User not found.' });
        const newHash = await bcrypt.hash(newPassword, 10);
        users[username].passwordHash = newHash;
        await writeUsers(users);
        res.json({ success: true, message: 'Password updated.' });
    } catch (error) {
        res.json({ success: false, message: 'Failed to update password.' });
    }
});

// GET: List all user access rules
app.get('/api/user-access', requireAdmin, (req, res) => {
    db.all(`SELECT * FROM user_access`, [], (err, rows) => {
        if (err) return res.json({ success: false, message: 'DB error.' });
        res.json({ success: true, accessList: rows });
    });
});

// POST: Grant access
app.post('/api/user-access', requireAdmin, (req, res) => {
    const { viewer, target } = req.body;
    if (!viewer || !target || viewer === target)
        return res.json({ success: false, message: 'Invalid viewer/target.' });
    db.run(
        `INSERT OR IGNORE INTO user_access (viewer, target) VALUES (?, ?)`,
        [viewer, target],
        (err) => {
            if (err) res.json({ success: false, message: 'DB error.' });
            else res.json({ success: true, message: 'Access granted.' });
        }
    );
});

// DELETE: Revoke access
app.delete('/api/user-access', requireAdmin, (req, res) => {
    const { viewer, target } = req.body;
    if (!viewer || !target) return res.json({ success: false, message: 'Invalid viewer/target.' });
    db.run(
        `DELETE FROM user_access WHERE viewer = ? AND target = ?`,
        [viewer, target],
        (err) => {
            if (err) res.json({ success: false, message: 'DB error.' });
            else res.json({ success: true, message: 'Access revoked.' });
        }
    );
});

// --- Existing endpoints (login, profile, financial, etc.) unchanged ---
// ... rest of server.js as before ...

// Start server with SSL
async function startServer() {
    try {
        const sslOptions = {
            key: await fs.readFile('/etc/letsencrypt/live/ourlife.work.gd/privkey.pem', 'utf8'),
            cert: await fs.readFile('/etc/letsencrypt/live/ourlife.work.gd/fullchain.pem', 'utf8')
        };
        https.createServer(sslOptions, app).listen(HTTPS_PORT, () => {
            console.log(`HTTPS Server running on https://ourlife.work.gd:${HTTPS_PORT}`);
        });
        http.createServer((req, res) => {
            res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
            res.end();
        }).listen(HTTP_PORT, () => {
            console.log(`HTTP Server running on port ${HTTP_PORT}, redirecting to HTTPS`);
        });
    } catch (error) {
        console.error('Error starting server with SSL:', error);
        process.exit(1);
    }
}

startServer();
