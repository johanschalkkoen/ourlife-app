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
const rateLimit = require('express-rate-limit');
const execPromise = util.promisify(exec);
const app = express();

const HTTPS_PORT = 8443; // Standard HTTPS port
const HTTP_PORT = 9000; // Standard HTTP port for redirect
const USERS_FILE = path.join(__dirname, 'users.json');

// Increase the body parser limit
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Rate limiting for admin endpoints
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many admin requests from this IP, please try again later.',
});

// Initialize SQLite database
const db = new sqlite3.Database('./ourlife.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
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
            db.run(`CREATE TABLE IF NOT EXISTS admin_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user TEXT,
                action TEXT,
                target TEXT,
                timestamp TEXT
            )`);

            db.all(`PRAGMA table_info(financial_items)`, (err, columns) => {
                if (err) {
                    console.error('Error checking financial_items schema:', err.message);
                    return;
                }
                const hasColorColumn = columns.some(col => col.name === 'color');
                if (!hasColorColumn) {
                    db.run(`ALTER TABLE financial_items ADD COLUMN color TEXT`, (alterErr) => {
                        if (alterErr) {
                            console.error('Error adding color column to financial_items:', alterErr.message);
                        } else {
                            console.log('Added color column to financial_items table.');
                            db.run(`UPDATE financial_items SET color = CASE WHEN type = 'income' THEN '#00FF00' ELSE '#FF0000' END WHERE color IS NULL`, (updateErr) => {
                                if (updateErr) {
                                    console.error('Error updating existing financial items with color:', updateErr.message);
                                } else {
                                    console.log('Updated existing financial items with color values.');
                                }
                            });
                        }
                    });
                }
            });

            console.log('Database tables checked/created.');
        });
    }
});

// Helper functions
async function readUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {};
        }
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

async function getAccessibleUsers(viewer) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT target FROM user_access WHERE viewer = ?`,
            [viewer],
            (err, rows) => {
                if (err) {
                    console.error('Error fetching accessible users:', err.message);
                    reject(err);
                } else {
                    const accessibleUsers = rows.map(row => row.target);
                    if (!accessibleUsers.includes(viewer)) {
                        accessibleUsers.push(viewer);
                    }
                    resolve(accessibleUsers);
                }
            }
        );
    });
}

// Authentication middleware
const requireAuth = async (req, res, next) => {
    const { username } = req.body.username ? req.body : req.query;
    if (!username) {
        return res.json({ success: false, message: 'Username is required.' });
    }
    try {
        const users = await readUsers();
        if (!users[username]) {
            return res.json({ success: false, message: 'User does not exist.' });
        }
        next();
    } catch (error) {
        console.error('Error checking user authentication:', error);
        res.json({ success: false, message: 'Server error checking user authentication.' });
    }
};

// Authentication and other endpoints
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: 'Username and password are required.' });
    }
    try {
        const users = await readUsers();
        const storedUser = users[username];
        if (storedUser) {
            const passwordMatch = await bcrypt.compare(password, storedUser.passwordHash);
            if (passwordMatch) {
                console.log(`Authenticated user: ${username}`);
                db.get('SELECT * FROM users WHERE username = ?', [username], (dbErr, row) => {
                    if (dbErr) {
                        console.error('Database error during login user fetch:', dbErr.message);
                        return res.json({ success: false, message: 'Database error during login.' });
                    }
                    if (row) {
                        res.json({ success: true, isAdmin: storedUser.isAdmin || false, ...row });
                    } else {
                        const defaultUserData = {
                            username,
                            profilePicUrl: 'https://placehold.co/50x50/808080/FFFFFF?text=U',
                            email: '',
                            phone: '',
                            address: '',
                            eventColor: '#3b82f6'
                        };
                        db.run(
                            `INSERT OR REPLACE INTO users (username, profilePicUrl, email, phone, address, eventColor) VALUES (?, ?, ?, ?, ?, ?)`,
                            [defaultUserData.username, defaultUserData.profilePicUrl, defaultUserData.email, defaultUserData.phone, defaultUserData.address, defaultUserData.eventColor],
                            (insertErr) => {
                                if (insertErr) {
                                    console.error('Database error inserting new user into SQLite:', insertErr.message);
                                    return res.json({ success: false, message: 'Database error creating new user profile.' });
                                }
                                res.json({ success: true, isAdmin: storedUser.isAdmin || false, ...defaultUserData });
                            }
                        );
                    }
                });
            } else {
                res.json({ success: false, message: 'Authentication failed: Incorrect password.' });
            }
        } else {
            res.json({ success: false, message: 'Authentication failed: User does not exist.' });
        }
    } catch (error) {
        console.error('Authentication error:', error);
        res.json({ success: false, message: 'An internal server error occurred during authentication.' });
    }
});

app.post('/api/update-password', async (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    if (!username || !currentPassword || !newPassword) {
        return res.json({ success: false, message: 'Username, current password, and new password are required.' });
    }
    try {
        const users = await readUsers();
        const storedUser = users[username];
        if (!storedUser) {
            return res.json({ success: false, message: 'User not found.' });
        }
        const passwordMatch = await bcrypt.compare(currentPassword, storedUser.passwordHash);
        if (!passwordMatch) {
            return res.json({ success: false, message: 'Incorrect current password.' });
        }
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        users[username].passwordHash = newPasswordHash;
        await writeUsers(users);
        res.json({ success: true, message: 'Password updated successfully!' });
    } catch (error) {
        console.error('Password update error:', error);
        res.json({ success: false, message: 'An internal server error occurred during password update.' });
    }
});

app.post('/api/admin-update-password', requireAuth, adminLimiter, async (req, res) => {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
        return res.json({ success: false, message: 'Username and new password are required.' });
    }
    try {
        const users = await readUsers();
        if (!users[username]) {
            return res.json({ success: false, message: 'User not found.' });
        }
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        users[username].passwordHash = newPasswordHash;
        await writeUsers(users);
        res.json({ success: true, message: `Password for ${username} updated successfully!` });
    } catch (error) {
        console.error('Admin password update error:', error);
        res.json({ success: false, message: 'An internal server error occurred during password update.' });
    }
});

app.post('/api/add-user', requireAuth, adminLimiter, async (req, res) => {
    const { username, password, isAdmin = false } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: 'Username and password are required.' });
    }
    try {
        const users = await readUsers();
        if (users[username]) {
            return res.json({ success: false, message: 'User already exists.' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        users[username] = { passwordHash, isAdmin };
        await writeUsers(users);
        res.json({ success: true, message: 'User added successfully!' });
    } catch (error) {
        console.error('Error adding user:', error);
        res.json({ success: false, message: 'Failed to add user.' });
    }
});

app.delete('/api/delete-user/:username', requireAuth, adminLimiter, async (req, res) => {
    const { username } = req.params;
    try {
        const users = await readUsers();
        if (!users[username]) {
            return res.json({ success: false, message: 'User not found.' });
        }
        delete users[username];
        await writeUsers(users);
        db.run('DELETE FROM users WHERE username = ?', [username], (err) => {
            if (err) {
                console.error('Database error deleting user from SQLite:', err.message);
            }
            db.run('DELETE FROM user_access WHERE viewer = ? OR target = ?', [username, username], (err) => {
                if (err) {
                    console.error('Database error deleting user access:', err.message);
                }
                res.json({ success: true, message: 'User deleted successfully!' });
            });
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.json({ success: false, message: 'Failed to delete user.' });
    }
});

app.post('/api/profile-pictures', async (req, res) => {
    const { username, profilePicUrl, email, phone, address, eventColor } = req.body;
    try {
        db.run(
            `INSERT OR REPLACE INTO users (username, profilePicUrl, email, phone, address, eventColor) VALUES (?, ?, ?, ?, ?, ?)`,
            [username, profilePicUrl, email, phone, address, eventColor],
            (err) => {
                if (err) {
                    console.error('Database error saving profile:', err.message);
                    res.json({ success: false, message: 'Failed to save profile.' });
                } else {
                    res.json({ success: true, message: 'Profile saved successfully!' });
                }
            }
        );
    } catch (error) {
        console.error('Error saving profile:', error);
        res.json({ success: false, message: 'An internal server error occurred.' });
    }
});

app.get('/api/profile-pictures', async (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.json({ success: false, message: 'Username is required.' });
    }
    try {
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
            if (err) {
                console.error('Database error fetching profile:', err.message);
                res.json({ success: false, message: 'Failed to fetch profile.' });
            } else if (row) {
                res.json({ success: true, ...row });
            } else {
                res.json({ success: false, message: 'Profile not found.' });
            }
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.json({ success: false, message: 'An internal server error occurred.' });
    }
});

app.post('/api/financial', async (req, res) => {
    const { user, description, amount, type, date } = req.body;
    if (!user || !description || !amount || !type || !date) {
        return res.json({ success: false, message: 'All fields are required.' });
    }
    try {
        const color = type === 'income' ? '#00FF00' : '#FF0000';
        db.run(
            `INSERT INTO financial_items (user, description, amount, type, date, color) VALUES (?, ?, ?, ?, ?, ?)`,
            [user, description, amount, type, date, color],
            function(err) {
                if (err) {
                    console.error('Database error adding financial item:', err.message);
                    res.json({ success: false, message: 'Failed to add financial item.' });
                } else {
                    res.json({ success: true, id: this.lastID });
                }
            }
        );
    } catch (error) {
        console.error('Error adding financial item:', error);
        res.json({ success: false, message: 'An internal server error occurred.' });
    }
});

app.get('/api/financial', requireAuth, async (req, res) => {
    const { user } = req.query;
    try {
        const accessibleUsers = await getAccessibleUsers(user);
        db.all(
            `SELECT * FROM financial_items WHERE user IN (${accessibleUsers.map(() => '?').join(',')})`,
            accessibleUsers,
            (err, rows) => {
                if (err) {
                    console.error('Database error fetching financial items:', err.message);
                    res.json({ success: false, message: 'Failed to fetch financial items.' });
                } else {
                    res.json(rows);
                }
            }
        );
    } catch (error) {
        console.error('Error fetching financial items:', error);
        res.json({ success: false, message: 'An internal server error occurred.' });
    }
});

app.delete('/api/financial/:id', async (req, res) => {
    const { id } = req.params;
    try {
        db.run(`DELETE FROM financial_items WHERE id = ?`, [id], (err) => {
            if (err) {
                console.error('Database error deleting financial item:', err.message);
                res.json({ success: false, message: 'Failed to delete financial item.' });
            } else {
                db.run(`DELETE FROM calendar_events WHERE financial = 1 AND id = ?`, [id], (err) => {
                    if (err) {
                        console.error('Database error deleting related calendar event:', err.message);
                    }
                    res.json({ success: true, message: 'Financial item deleted successfully!' });
                });
            }
        });
    } catch (error) {
        console.error('Error deleting financial item:', error);
        res.json({ success: false, message: 'An internal server error occurred.' });
    }
});

app.post('/api/calendar', async (req, res) => {
    const { user, title, date, financial, type, amount, eventColor } = req.body;
    if (!user || !title || !date) {
        return res.json({ success: false, message: 'User, title, and date are required.' });
    }
    try {
        db.run(
            `INSERT INTO calendar_events (user, title, date, financial, type, amount, eventColor) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [user, title, date, financial ? 1 : 0, type || null, amount || null, eventColor || '#3b82f6'],
            function(err) {
                if (err) {
                    console.error('Database error adding calendar event:', err.message);
                    res.json({ success: false, message: 'Failed to add calendar event.' });
                } else {
                    res.json({ success: true, id: this.lastID });
                }
            }
        );
    } catch (error) {
        console.error('Error adding calendar event:', error);
        res.json({ success: false, message: 'An internal server error occurred.' });
    }
});

app.get('/api/calendar', requireAuth, async (req, res) => {
    const { user } = req.query;
    try {
        const accessibleUsers = await getAccessibleUsers(user);
        db.all(
            `SELECT * FROM calendar_events WHERE user IN (${accessibleUsers.map(() => '?').join(',')})`,
            accessibleUsers,
            (err, rows) => {
                if (err) {
                    console.error('Database error fetching calendar events:', err.message);
                    res.json({ success: false, message: 'Failed to fetch calendar events.' });
                } else {
                    res.json(rows);
                }
            }
        );
    } catch (error) {
        console.error('Error fetching calendar events:', error);
        res.json({ success: false, message: 'An internal server error occurred.' });
    }
});

app.delete('/api/calendar/:id', async (req, res) => {
    const { id } = req.params;
    try {
        db.run(`DELETE FROM calendar_events WHERE id = ?`, [id], (err) => {
            if (err) {
                console.error('Database error deleting calendar event:', err.message);
                res.json({ success: false, message: 'Failed to delete calendar event.' });
            } else {
                res.json({ success: true, message: 'Calendar event deleted successfully!' });
            }
        });
    } catch (error) {
        console.error('Error deleting calendar event:', error);
        res.json({ success: false, message: 'An internal server error occurred.' });
    }
});

app.get('/api/get-access', requireAuth, async (req, res) => {
    const { viewer } = req.query;
    try {
        db.all(`SELECT * FROM user_access WHERE viewer = ?`, [viewer], (err, rows) => {
            if (err) {
                console.error('Database error fetching access list:', err.message);
                res.json({ success: false, message: 'Failed to fetch access list.' });
            } else {
                res.json({ success: true, accessList: rows });
            }
        });
    } catch (error) {
        console.error('Error fetching access list:', error);
        res.json({ success: false, message: 'An internal server error occurred.' });
    }
});

app.post('/api/grant-access', adminLimiter, async (req, res) => {
    const { viewer, target } = req.body;
    if (!viewer || !target) {
        return res.json({ success: false, message: 'Viewer and target usernames are required.' });
    }
    if (viewer === target) {
        return res.json({ success: false, message: 'Cannot grant access to self.' });
    }
    try {
        db.run(
            `INSERT OR IGNORE INTO user_access (viewer, target) VALUES (?, ?)`,
            [viewer, target],
            (err) => {
                if (err) {
                    console.error('Database error granting access:', err.message);
                    res.json({ success: false, message: 'Failed to grant access.' });
                } else {
                    db.run(
                        `INSERT INTO admin_logs (user, action, target, timestamp) VALUES (?, ?, ?, ?)`,
                        [viewer, 'grant_access', target, new Date().toISOString()],
                        (logErr) => {
                            if (logErr) {
                                console.error('Error logging admin action:', logErr.message);
                            }
                            res.json({ success: true, message: `Access granted: ${viewer} can view ${target}'s data.` });
                        }
                    );
                }
            }
        );
    } catch (error) {
        console.error('Error granting access:', error);
        res.json({ success: false, message: 'An internal server error occurred.' });
    }
});

app.delete('/api/revoke-access', adminLimiter, async (req, res) => {
    const { viewer, target } = req.body;
    if (!viewer || !target) {
        return res.json({ success: false, message: 'Viewer and target usernames are required.' });
    }
    try {
        db.run(
            `DELETE FROM user_access WHERE viewer = ? AND target = ?`,
            [viewer, target],
            (err) => {
                if (err) {
                    console.error('Database error revoking access:', err.message);
                    res.json({ success: false, message: 'Failed to revoke access.' });
                } else {
                    db.run(
                        `INSERT INTO admin_logs (user, action, target, timestamp) VALUES (?, ?, ?, ?)`,
                        [viewer, 'revoke_access', target, new Date().toISOString()],
                        (logErr) => {
                            if (logErr) {
                                console.error('Error logging admin action:', logErr.message);
                            }
                            res.json({ success: true, message: `Access revoked: ${viewer} can no longer view ${target}'s data.` });
                        }
                    );
                }
            }
        );
    } catch (error) {
        console.error('Error revoking access:', error);
        res.json({ success: false, message: 'An internal server error occurred.' });
    }
});

app.get('/api/get-all-access', adminLimiter, async (req, res) => {
    try {
        db.all(`SELECT * FROM user_access`, (err, rows) => {
            if (err) {
                console.error('Database error fetching all access:', err.message);
                res.json({ success: false, message: 'Failed to fetch access list.' });
            } else {
                res.json({ success: true, accessList: rows });
            }
        });
    } catch (error) {
        console.error('Error fetching all access:', error);
        res.json({ success: false, message: 'An internal server error occurred.' });
    }
});

// HTTPS server setup
const httpsOptions = {
    cert: fs.readFileSync(path.join(__dirname, 'ssl', 'server.crt')),
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'server.key')),
};
https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
    console.log(`HTTPS Server running on port ${HTTPS_PORT}`);
});

// HTTP server for redirecting to HTTPS
http.createServer((req, res) => {
    res.writeHead(301, { Location: `https://${req.headers.host.split(':')[0]}:${HTTPS_PORT}${req.url}` });
    res.end();
}).listen(HTTP_PORT, () => {
    console.log(`HTTP Server running on port ${HTTP_PORT} and redirecting to HTTPS`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing servers...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});
