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
const multer = require('multer');
const execPromise = util.promisify(exec);
const app = express();

const HTTPS_PORT = 8443;
const HTTP_PORT = 9000;
const USERS_FILE = path.join(__dirname, 'users.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure upload directory exists
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(err => {
    console.error('Error creating upload directory:', err);
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${req.body.username}-${Date.now()}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG and PNG images are allowed.'));
        }
    }
});

app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./ourlife.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        process.exit(1);
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
            )`, (err) => {
                if (err) {
                    console.error('Error creating users table:', err.message);
                    process.exit(1);
                }
            });
            db.run(`CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user TEXT,
                description TEXT,
                amount REAL,
                type TEXT,
                date TEXT,
                color TEXT
            )`, (err) => {
                if (err) {
                    console.error('Error creating transactions table:', err.message);
                    process.exit(1);
                }
            });
            db.run(`CREATE TABLE IF NOT EXISTS calendar_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user TEXT,
                title TEXT,
                date TEXT,
                isTransaction INTEGER,
                type TEXT,
                amount REAL,
                eventColor TEXT
            )`, (err) => {
                if (err) {
                    console.error('Error creating calendar_events table:', err.message);
                    process.exit(1);
                }
            });
            db.run(`CREATE TABLE IF NOT EXISTS user_access (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                viewer TEXT,
                target TEXT,
                UNIQUE(viewer, target)
            )`, (err) => {
                if (err) {
                    console.error('Error creating user_access table:', err.message);
                    process.exit(1);
                }
            });

            // Add color column to transactions if missing
            db.all(`PRAGMA table_info(transactions)`, (err, columns) => {
                if (err) {
                    console.error('Error checking transactions schema:', err.message);
                    process.exit(1);
                }
                const hasColorColumn = columns.some(col => col.name === 'color');
                if (!hasColorColumn) {
                    db.run(`ALTER TABLE transactions ADD COLUMN color TEXT`, (alterErr) => {
                        if (alterErr) {
                            console.error('Error adding color column to transactions:', alterErr.message);
                            process.exit(1);
                        } else {
                            console.log('Added color column to transactions table.');
                            db.run(`UPDATE transactions SET color = CASE WHEN type = 'income' THEN '#00FF00' ELSE '#FF0000' END WHERE color IS NULL`, (updateErr) => {
                                if (updateErr) {
                                    console.error('Error updating existing transactions with color:', updateErr.message);
                                    process.exit(1);
                                } else {
                                    console.log('Updated existing transactions with color values.');
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
const requireAdmin = async (req, res, next) => {
    const { username } = req.body.username ? req.body : req.query;
    if (!username) {
        return res.json({ success: false, message: 'Username is required.' });
    }
    try {
        const users = await readUsers();
        if (!users[username] || !users[username].isAdmin) {
            return res.json({ success: false, message: 'Unauthorized: Admin access required.' });
        }
        next();
    } catch (error) {
        console.error('Error checking admin access:', error);
        res.json({ success: false, message: 'Server error checking admin access.' });
    }
};

// Admin page route
app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Profile picture upload endpoint
app.post('/api/upload-profile-pic', upload.single('profilePic'), async (req, res) => {
    const { username } = req.body;
    if (!username || !req.file) {
        return res.json({ success: false, message: 'Username and profile picture are required.' });
    }
    try {
        const users = await readUsers();
        if (!users[username]) {
            return res.json({ success: false, message: 'User not found.' });
        }
        // Construct URL for the uploaded file
        const profilePicUrl = `/uploads/${req.file.filename}`;
        res.json({ success: true, profilePicUrl });
    } catch (error) {
        console.error('Error uploading profile picture:', error.message);
        res.json({ success: false, message: error.message || 'Failed to upload profile picture.' });
    }
});

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
                            profilePicUrl: '/uploads/default-profile.png', // Use a default image
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
            res.json(row || { profilePicUrl: '/uploads/default-profile.png', email: '', phone: '', address: '', eventColor: '#3b82f6' });
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

app.get('/api/transactions', async (req, res) => {
    const { user: viewer } = req.query;
    try {
        const accessibleUsers = await getAccessibleUsers(viewer);
        db.all(
            `SELECT * FROM transactions WHERE user IN (${accessibleUsers.map(() => '?').join(',')})`,
            accessibleUsers,
            (err, rows) => {
                if (err) {
                    console.error('Database error fetching transactions:', err.message);
                    res.json([]);
                } else {
                    res.json(rows);
                }
            }
        );
    } catch (error) {
        console.error('Error fetching accessible users for transactions:', error);
        res.json([]);
    }
});

app.post('/api/transactions', (req, res) => {
    const { user, description, amount, type, date, eventTitle } = req.body;
    const color = type.toLowerCase() === 'income' ? '#00FF00' : '#FF0000';
    db.run(
        `INSERT INTO transactions (user, description, amount, type, date, color) VALUES (?, ?, ?, ?, ?, ?)`,
        [user, description, amount, type, date, color],
        function (err) {
            if (err) {
                console.error('Database error adding transaction:', err.message);
                res.json({ success: false });
            } else {
                const transactionId = this.lastID;
                if (eventTitle) {
                    db.get('SELECT eventColor FROM users WHERE username = ?', [user], (err, row) => {
                        if (err) {
                            console.error('Database error fetching user eventColor:', err.message);
                            db.run('DELETE FROM transactions WHERE id = ?', transactionId, (rollbackErr) => {
                                if (rollbackErr) {
                                    console.error('Error rolling back transaction:', rollbackErr.message);
                                }
                            });
                            return res.json({ success: false, message: 'Failed to fetch user event color.' });
                        }
                        const eventColor = row?.eventColor || '#3b82f6';
                        db.run(
                            `INSERT INTO calendar_events (user, title, date, isTransaction, type, amount, eventColor) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [user, eventTitle, date, 1, type, amount, eventColor],
                            function (err) {
                                if (err) {
                                    console.error('Database error adding calendar event:', err.message);
                                    db.run('DELETE FROM transactions WHERE id = ?', transactionId, (rollbackErr) => {
                                        if (rollbackErr) {
                                            console.error('Error rolling back transaction:', rollbackErr.message);
                                        }
                                    });
                                    return res.json({ success: false, message: 'Failed to add calendar event.' });
                                }
                                res.json({ id: transactionId, user, description, amount, type, date, color, eventId: this.lastID });
                            }
                        );
                    });
                }-else {
                    res.json({ id: transactionId, user, description, amount, type, date, color });
                }
            }
        }
    );
});

app.delete('/api/transactions/:id', (req, res) => {
    const id = parseInt(req.params.id);
    db.get('SELECT user, type, amount, date FROM transactions WHERE id = ?', id, (err, transaction) => {
        if (err) {
            console.error('Database error fetching transaction for deletion:', err.message);
            return res.json({ success: false });
        }
        if (transaction) {
            db.run('DELETE FROM calendar_events WHERE user = ? AND type = ? AND amount = ? AND date = ? AND isTransaction = 1', [transaction.user, transaction.type, transaction.amount, transaction.date], (eventErr) => {
                if (eventErr) {
                    console.error('Database error deleting linked calendar event:', eventErr.message);
                }
            });
        }
        db.run('DELETE FROM transactions WHERE id = ?', id, (err) => {
            if (err) {
                console.error('Database error deleting transaction:', err.message);
                res.json({ success: false });
            } else {
                res.json({ success: true });
            }
        });
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
    const { user, title, date, transaction, type, amount, eventColor, description } = req.body;
    db.run(
        `INSERT INTO calendar_events (user, title, date, isTransaction, type, amount, eventColor) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [user, title, date, transaction ? 1 : 0, type, amount, eventColor],
        function (err) {
            if (err) {
                console.error('Database error adding calendar event:', err.message);
                return res.json({ success: false, message: 'Failed to add calendar event.' });
            }
            const eventId = this.lastID;
            if (transaction && description && amount && type) {
                const color = type.toLowerCase() === 'income' ? '#00FF00' : '#FF0000';
                db.run(
                    `INSERT INTO transactions (user, description, amount, type, date, color) VALUES (?, ?, ?, ?, ?, ?)`,
                    [user, description, amount, type, date, color],
                    function (err) {
                        if (err) {
                            console.error('Database error adding transaction:', err.message);
                            db.run('DELETE FROM calendar_events WHERE id = ?', eventId, (rollbackErr) => {
                                if (rollbackErr) {
                                    console.error('Error rolling back calendar event:', rollbackErr.message);
                                }
                            });
                            return res.json({ success: false, message: 'Failed to add transaction.' });
                        }
                        res.json({ id: eventId, user, title, date, isTransaction: transaction, type, amount, eventColor, transactionId: this.lastID });
                    }
                );
            } else {
                res.json({ id: eventId, user, title, date, isTransaction: transaction, type, amount, eventColor });
            }
        }
    );
});

app.delete('/api/calendar/:id', (req, res) => {
    const id = parseInt(req.params.id);
    db.get('SELECT isTransaction, type, amount, date, user FROM calendar_events WHERE id = ?', id, (err, event) => {
        if (err) {
            console.error('Database error fetching calendar event for deletion:', err.message);
            return res.json({ success: false, message: 'Failed to fetch calendar event.' });
        }
        if (event && event.isTransaction) {
            db.run('DELETE FROM transactions WHERE user = ? AND type = ? AND amount = ? AND date = ?', [event.user, event.type, event.amount, event.date], (transErr) => {
                if (transErr) {
                    console.error('Database error deleting linked transaction:', transErr.message);
                }
            });
        }
        db.run('DELETE FROM calendar_events WHERE id = ?', id, (err) => {
            if (err) {
                console.error('Database error deleting calendar event:', err.message);
                res.json({ success: false, message: 'Failed to delete calendar event.' });
            } else {
                res.json({ success: true });
            }
        });
    });
});

app.get('/api/users', requireAdmin, async (req, res) => {
    try {
        const users = await readUsers();
        const userList = Object.keys(users).map(username => ({ username }));
        res.json(userList);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.json([]);
    }
});

app.get('/api/get-access', (req, res) => {
    const { viewer } = req.query;
    db.all('SELECT * FROM user_access WHERE viewer = ?', [viewer], (err, rows) => {
        if (err) {
            console.error('Database error fetching access list:', err.message);
            res.json({ success: false, accessList: [] });
        } else {
            res.json({ success: true, accessList: rows });
        }
    });
});

app.post('/api/grant-access', async (req, res) => {
    const { viewer, target } = req.body;
    if (!viewer || !target) {
        return res.json({ success: false, message: 'Viewer and target are required.' });
    }
    try {
        const users = await readUsers();
        if (!users[viewer] || !users[target]) {
            return res.json({ success: false, message: 'Invalid viewer or target user.' });
        }
        db.run('INSERT INTO user_access (viewer, target) VALUES (?, ?)', [viewer, target], (err) => {
            if (err) {
                console.error('Database error granting access:', err.message);
                res.json({ success: false, message: 'Failed to grant access.' });
            } else {
                res.json({ success: true });
            }
        });
    } catch (error) {
        console.error('Error granting access:', error);
        res.json({ success: false, message: 'Server error granting access.' });
    }
});

app.post('/api/revoke-access', (req, res) => {
    const { viewer, target } = req.body;
    db.run('DELETE FROM user_access WHERE viewer = ? AND target = ?', [viewer, target], (err) => {
        if (err) {
            console.error('Database error revoking access:', err.message);
            res.json({ success: false, message: 'Failed to revoke access.' });
        } else {
            res.json({ success: true });
        }
    });
});

// Server setup
const httpServer = http.createServer(app);
httpServer.listen(HTTP_PORT, () => {
    console.log(`HTTP Server running on port ${HTTP_PORT}`);
});

// HTTPS Server setup using Let's Encrypt certificates
try {
    const httpsOptions = {
        key: fs.readFileSync('/etc/letsencrypt/live/ourlife.work.gd/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/ourlife.work.gd/fullchain.pem')
    };
    const httpsServer = https.createServer(httpsOptions, app);
    httpsServer.listen(HTTPS_PORT, () => {
        console.log(`HTTPS Server running on port ${HTTPS_PORT}`);
    });
} catch (error) {
    console.error(`Failed to start HTTPS server: ${error.message}`);
    console.log('Falling back to HTTP only. Verify that /etc/letsencrypt/live/ourlife.work.gd/privkey.pem and /etc/letsencrypt/live/ourlife.work.gd/fullchain.pem exist and are accessible.');
}
