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

const HTTPS_PORT = 8443; // Standard HTTPS port
const HTTP_PORT = 9000; // Standard HTTP port for redirect
const USERS_FILE = path.join(__dirname, 'users.json');

// Increase the body parser limit
app.use(express.json({ limit: '50mb' }));
app.use(cors());

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
                        res.json({ success: true, ...row });
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
                                res.json({ success: true, ...defaultUserData });
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

app.post('/api/admin-update-password', async (req, res) => {
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

app.get('/api/profile-pictures', (req, res) => {
    const { username } = req.query;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            console.error('Database error fetching profile pictures:', err.message);
            res.json({ profilePicUrl: null, email: '', phone: '', address: '', eventColor: '#3b82f6' });
        } else {
            res.json(row || { profilePicUrl: null, email: '', phone: '', address: '', eventColor: '#3b82f6' });
        }
    });
});

app.post('/api/profile-pictures', (req, res) => {
    const { username, profilePicUrl, email, phone, address, eventColor } = req.body;
    db.run(
        `INSERT OR REPLACE INTO users (username, profilePicUrl, email, phone, address, eventColor) VALUES (?, ?, ?, ?, ?, ?)`,
        [username, profilePicUrl, email, phone, address, eventColor],
        (err) => {
            if (err) {
                console.error('Database error saving profile pictures:', err.message);
                res.json({ success: false });
            } else {
                res.json({ success: true });
            }
        }
    );
});

app.get('/api/financial', async (req, res) => {
    const { user: viewer } = req.query;
    try {
        const accessibleUsers = await getAccessibleUsers(viewer);
        db.all(
            `SELECT * FROM financial_items WHERE user IN (${accessibleUsers.map(() => '?').join(',')})`,
            accessibleUsers,
            (err, rows) => {
                if (err) {
                    console.error('Database error fetching financial items:', err.message);
                    res.json([]);
                } else {
                    res.json(rows);
                }
            }
        );
    } catch (error) {
        console.error('Error fetching accessible users for financial data:', error);
        res.json([]);
    }
});

app.post('/api/financial', (req, res) => {
    const { user, description, amount, type, date } = req.body;
    const color = type.toLowerCase() === 'income' ? '#00FF00' : '#FF0000';
    db.run(
        `INSERT INTO financial_items (user, description, amount, type, date, color) VALUES (?, ?, ?, ?, ?, ?)`,
        [user, description, amount, type, date, color],
        function (err) {
            if (err) {
                console.error('Database error adding financial item:', err.message);
                res.json({ success: false });
            } else {
                res.json({ id: this.lastID, user, description, amount, type, date, color });
            }
        }
    );
});

app.delete('/api/financial/:id', (req, res) => {
    const id = parseInt(req.params.id);
    db.run('DELETE FROM financial_items WHERE id = ?', id, (err) => {
        if (err) {
            console.error('Database error deleting financial item:', err.message);
            res.json({ success: false });
        } else {
            res.json({ success: true });
        }
    });
});

app.get('/api/calendar', async (req, res) => {
    const { user: viewer } = req.query;
    try {
        const accessibleUsers = await getAccessibleUsers(viewer);
        db.all(
            `SELECT * FROM calendar_events WHERE user IN (${accessibleUsers.map(() => '?').join(',')})`,
            accessibleUsers,
            (err, rows) => {
                if (err) {
                    console.error('Database error fetching calendar events:', err.message);
                    res.json([]);
                } else {
                    res.json(rows);
                }
            }
        );
    } catch (error) {
        console.error('Error fetching accessible users for calendar events:', error);
        res.json([]);
    }
});

app.post('/api/calendar', (req, res) => {
    const { user, title, date, financial, type, amount, eventColor } = req.body;
    db.run(
        `INSERT INTO calendar_events (user, title, date, financial, type, amount, eventColor) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [user, title, date, financial ? 1 : 0, type, amount, eventColor],
        function (err) {
            if (err) {
                console.error('Database error adding calendar event:', err.message);
                res.json({ success: false });
            } else {
                res.json({ id: this.lastID, user, title, date, financial, type, amount, eventColor });
            }
        }
    );
});

app.delete('/api/calendar/:id', (req, res) => {
    const id = parseInt(req.params.id);
    db.run('DELETE FROM calendar_events WHERE id = ?', id, (err) => {
        if (err) {
            console.error('Database error deleting calendar event:', err.message);
            res.json({ success: false });
        } else {
            res.json({ success: true });
        }
    });
});

app.get('/api/users', async (req, res) => {
    try {
        const users = await readUsers();
        const userList = Object.keys(users).map(username => ({ username }));
        res.json(userList);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.json({ success: false, message: 'Failed to fetch users.' });
    }
});

app.post('/api/add-user', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: 'Username and password are required.' });
    }
    try {
        const users = await readUsers();
        if (users[username]) {
            return res.json({ success: false, message: 'User already exists.' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        users[username] = { passwordHash };
        await writeUsers(users);
        res.json({ success: true, message: 'User added successfully!' });
    } catch (error) {
        console.error('Error adding user:', error);
        res.json({ success: false, message: 'Failed to add user.' });
    }
});

app.delete('/api/delete-user/:username', async (req, res) => {
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

app.get('/api/pam-users', async (req, res) => {
    try {
        const { stdout } = await execPromise('getent passwd');
        const pamUsers = stdout
            .split('\n')
            .filter(line => line)
            .map(line => {
                const [username, , uid] = line.split(':');
                return { username, uid: parseInt(uid) };
            })
            .filter(user => user.uid >= 1000)
            .map(user => user.username);
        const users = await readUsers();
        const appUsers = Object.keys(users);
        const comparison = {
            pamUsers: pamUsers,
            appUsers: appUsers,
            commonUsers: appUsers.filter(user => pamUsers.includes(user)),
            appOnlyUsers: appUsers.filter(user => !pamUsers.includes(user)),
            pamOnlyUsers: pamUsers.filter(user => !appUsers.includes(user))
        };
        res.json({ success: true, ...comparison });
    } catch (error) {
        console.error('Error fetching PAM users:', error);
        res.json({ success: false, message: 'Failed to fetch PAM users.' });
    }
});

app.get('/api/get-access', (req, res) => {
    db.all(
        `SELECT viewer, target FROM user_access`,
        [],
        (err, rows) => {
            if (err) {
                console.error('Database error fetching user access:', err.message);
                res.json({ success: false, accessList: [] });
            } else {
                res.json({ success: true, accessList: rows });
            }
        }
    );
});

app.post('/api/grant-access', (req, res) => {
    const { viewer, target } = req.body;
    if (!viewer || !target) {
        return res.json({ success: false, message: 'Viewer and target usernames are required.' });
    }
    if (viewer === target) {
        return res.json({ success: false, message: 'Cannot grant access to self.' });
    }
    db.run(
        `INSERT OR IGNORE INTO user_access (viewer, target) VALUES (?, ?)`,
        [viewer, target],
        (err) => {
            if (err) {
                console.error('Database error granting access:', err.message);
                res.json({ success: false, message: 'Failed to grant access.' });
            } else {
                res.json({ success: true, message: `Access granted: ${viewer} can view ${target}'s data.` });
            }
        }
    );
});

app.post('/api/revoke-access', (req, res) => {
    const { viewer, target } = req.body;
    if (!viewer || !target) {
        return res.json({ success: false, message: 'Viewer and target usernames are required.' });
    }
    db.run(
        `DELETE FROM user_access WHERE viewer = ? AND target = ?`,
        [viewer, target],
        (err) => {
            if (err) {
                console.error('Database error revoking access:', err.message);
                res.json({ success: false, message: 'Failed to revoke access.' });
            } else {
                res.json({ success: true, message: `Access revoked: ${viewer} can no longer view ${target}'s data.` });
            }
        }
    );
});

// Load SSL certificates asynchronously
async function startServer() {
    try {
        const sslOptions = {
            key: await fs.readFile('/etc/letsencrypt/live/ourlife.work.gd/privkey.pem', 'utf8'),
            cert: await fs.readFile('/etc/letsencrypt/live/ourlife.work.gd/fullchain.pem', 'utf8')
        };

        // Create HTTPS server
        https.createServer(sslOptions, app).listen(HTTPS_PORT, () => {
            console.log(`HTTPS Server running on https://ourlife.work.gd:${HTTPS_PORT}`);
        });

        // Create HTTP server to redirect to HTTPS
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

// Start the server
startServer();
