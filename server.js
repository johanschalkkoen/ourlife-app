const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cors = require('cors');
const https = require('https');
const http = require('http');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('/root/ourlife-app/ourlife.db', (err) => {
    if (err) {
        console.error('Error connecting to the SQLite database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            isAdmin INTEGER DEFAULT 0,
            profilePicUrl TEXT,
            email TEXT,
            phone TEXT,
            address TEXT,
            eventColor TEXT
        )`, (err) => {
            if (err) {
                console.error('Error creating users table:', err.message);
            } else {
                console.log('Users table checked/created.');
            }
        });
        db.run(`CREATE TABLE IF NOT EXISTS access (
            viewer TEXT,
            target TEXT,
            PRIMARY KEY (viewer, target),
            FOREIGN KEY (viewer) REFERENCES users(username),
            FOREIGN KEY (target) REFERENCES users(username)
        )`, (err) => {
            if (err) {
                console.error('Error creating access table:', err.message);
            } else {
                console.log('Access table checked/created.');
            }
        });
        db.run(`CREATE TABLE IF NOT EXISTS financial (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT,
            description TEXT,
            amount REAL,
            type TEXT,
            date TEXT
        )`, (err) => {
            if (err) {
                console.error('Error creating financial table:', err.message);
            } else {
                console.log('Financial table checked/created.');
            }
        });
        db.run(`CREATE TABLE IF NOT EXISTS calendar (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT,
            title TEXT,
            date TEXT,
            financial INTEGER,
            type TEXT,
            amount REAL,
            eventColor TEXT
        )`, (err) => {
            if (err) {
                console.error('Error creating calendar table:', err.message);
            } else {
                console.log('Calendar table checked/created.');
            }
        });
    }
});

const requireAdmin = async (req, res, next) => {
    const adminUsername = (req.query && req.query.adminUsername) || (req.body && req.body.adminUsername);
    if (!adminUsername) {
        console.error('No adminUsername provided in req.body or req.query');
        return res.json({ success: false, message: 'Admin username is required.' });
    }
    try {
        db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], (err, row) => {
            if (err) {
                console.error('Database error checking admin access:', err.message);
                return res.json({ success: false, message: 'Database error checking admin access.' });
            }
            if (!row || !row.isAdmin) {
                console.error('Unauthorized access attempt by:', adminUsername);
                return res.json({ success: false, message: 'Unauthorized: Admin access required.' });
            }
            req.adminUsername = adminUsername;
            next();
        });
    } catch (error) {
        console.error('Error checking admin access:', error.stack);
        res.json({ success: false, message: 'Server error checking admin access.' });
    }
};

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: 'Username and password are required.' });
    }
    try {
        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                console.error('Database error during login:', err.message);
                return res.json({ success: false, message: 'Database error during login.' });
            }
            if (!row) {
                return res.json({ success: false, message: 'User not found.' });
            }
            const match = await bcrypt.compare(password, row.password);
            if (match) {
                console.log('Authenticated user:', username);
                res.json({
                    success: true,
                    username: row.username,
                    profilePicUrl: row.profilePicUrl || 'https://placehold.co/50x50/808080/FFFFFF?text=U',
                    email: row.email || '',
                    phone: row.phone || '',
                    address: row.address || '',
                    eventColor: row.eventColor || '#2dd4bf',
                    isAdmin: !!row.isAdmin
                });
            } else {
                console.error('Authentication failed for user:', username);
                res.json({ success: false, message: 'Authentication failed: Incorrect password.' });
            }
        });
    } catch (error) {
        console.error('Error during login:', error.stack);
        res.json({ success: false, message: 'Server error during login.' });
    }
});

app.get('/api/users', requireAdmin, (req, res) => {
    db.all('SELECT username, isAdmin FROM users', [], (err, rows) => {
        if (err) {
            console.error('Database error fetching users:', err.message);
            return res.json({ success: false, message: 'Database error fetching users.' });
        }
        res.json({ success: true, data: rows });
    });
});

app.post('/api/add-user', requireAdmin, async (req, res) => {
    const { username, password } = req.body;
    const adminUsername = req.adminUsername;
    if (!username || !password) {
        return res.json({ success: false, message: 'Username and password are required.' });
    }
    try {
        db.get('SELECT username FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                console.error('Database error checking username:', err.message);
                return res.json({ success: false, message: 'Database error checking username.' });
            }
            if (row) {
                return res.json({ success: false, message: 'User already exists.' });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            db.run(
                'INSERT INTO users (username, password, isAdmin) VALUES (?, ?, ?)',
                [username, hashedPassword, 0],
                (err) => {
                    if (err) {
                        console.error('Database error adding user:', err.message);
                        return res.json({ success: false, message: 'Database error adding user.' });
                    }
                    console.log(`User ${username} added by ${adminUsername}`);
                    res.json({ success: true, message: 'User added successfully!' });
                }
            );
        });
    } catch (error) {
        console.error('Error adding user:', error.stack);
        res.json({ success: false, message: 'Server error adding user.' });
    }
});

app.get('/api/get-access', requireAdmin, (req, res) => {
    const adminUsername = req.adminUsername;
    try {
        db.all('SELECT viewer, target FROM access', [], (err, rows) => {
            if (err) {
                console.error('Database error fetching access list:', err.message);
                return res.json({ success: false, message: 'Database error fetching access list.' });
            }
            console.log(`Access list fetched by ${adminUsername}:`, rows);
            res.json({ success: true, accessList: rows });
        });
    } catch (error) {
        console.error('Error fetching access list:', error.stack);
        res.json({ success: false, message: 'Server error fetching access list.' });
    }
});

app.post('/api/grant-access', requireAdmin, async (req, res) => {
    const { viewer, target } = req.body;
    const adminUsername = req.adminUsername;
    if (!viewer || !target) {
        return res.json({ success: false, message: 'Viewer and target usernames are required.' });
    }
    try {
        db.get('SELECT username FROM users WHERE username = ?', [viewer], (err, viewerRow) => {
            if (err) {
                console.error('Database error checking viewer:', err.message);
                return res.json({ success: false, message: 'Database error checking viewer.' });
            }
            if (!viewerRow) {
                return res.json({ success: false, message: 'Viewer not found.' });
            }
            db.get('SELECT username FROM users WHERE username = ?', [target], (err, targetRow) => {
                if (err) {
                    console.error('Database error checking target:', err.message);
                    return res.json({ success: false, message: 'Database error checking target.' });
                }
                if (!targetRow) {
                    return res.json({ success: false, message: 'Target not found.' });
                }
                db.get('SELECT viewer, target FROM access WHERE viewer = ? AND target = ?', [viewer, target], (err, row) => {
                    if (err) {
                        console.error('Database error checking access:', err.message);
                        return res.json({ success: false, message: 'Database error checking access.' });
                    }
                    if (row) {
                        return res.json({ success: false, message: 'Access already granted.' });
                    }
                    db.run('INSERT INTO access (viewer, target) VALUES (?, ?)', [viewer, target], (err) => {
                        if (err) {
                            console.error('Database error granting access:', err.message);
                            return res.json({ success: false, message: 'Database error granting access.' });
                        }
                        console.log(`Access granted: ${viewer} can view ${target} by ${adminUsername}`);
                        res.json({ success: true, message: `Access granted for ${viewer} to view ${target}'s data.` });
                    });
                });
            });
        });
    } catch (error) {
        console.error('Error granting access:', error.stack);
        res.json({ success: false, message: 'Server error granting access.' });
    }
});

app.post('/api/revoke-access', requireAdmin, async (req, res) => {
    const { viewer, target } = req.body;
    const adminUsername = req.adminUsername;
    if (!viewer || !target) {
        return res.json({ success: false, message: 'Viewer and target usernames are required.' });
    }
    try {
        db.get('SELECT viewer, target FROM access WHERE viewer = ? AND target = ?', [viewer, target], (err, row) => {
            if (err) {
                console.error('Database error checking access:', err.message);
                return res.json({ success: false, message: 'Database error checking access.' });
            }
            if (!row) {
                return res.json({ success: false, message: 'Access not found.' });
            }
            db.run('DELETE FROM access WHERE viewer = ? AND target = ?', [viewer, target], (err) => {
                if (err) {
                    console.error('Database error revoking access:', err.message);
                    return res.json({ success: false, message: 'Database error revoking access.' });
                }
                console.log(`Access revoked: ${viewer} can no longer view ${target} by ${adminUsername}`);
                res.json({ success: true, message: `Access revoked for ${viewer} to view ${target}'s data.` });
            });
        });
    } catch (error) {
        console.error('Error revoking access:', error.stack);
        res.json({ success: false, message: 'Server error revoking access.' });
    }
});

app.post('/api/profile-pictures', (req, res) => {
    const { username, profilePicUrl, email, phone, address, eventColor } = req.body;
    if (!username) {
        return res.json({ success: false, message: 'Username is required.' });
    }
    db.run(
        'UPDATE users SET profilePicUrl = ?, email = ?, phone = ?, address = ?, eventColor = ? WHERE username = ?',
        [profilePicUrl, email, phone, address, eventColor, username],
        (err) => {
            if (err) {
                console.error('Database error updating profile:', err.message);
                return res.json({ success: false, message: 'Database error updating profile.' });
            }
            res.json({ success: true, profilePicUrl, email, phone, address, eventColor });
        }
    );
});

app.get('/api/profile-pictures', (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.json({ success: false, message: 'Username is required.' });
    }
    db.get('SELECT profilePicUrl, email, phone, address, eventColor, isAdmin FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            console.error('Database error fetching profile:', err.message);
            return res.json({ success: false, message: 'Database error fetching profile.' });
        }
        if (!row) {
            return res.json({ success: false, message: 'User not found.' });
        }
        res.json({
            success: true,
            profilePicUrl: row.profilePicUrl || 'https://placehold.co/50x50/808080/FFFFFF?text=U',
            email: row.email || '',
            phone: row.phone || '',
            address: row.address || '',
            eventColor: row.eventColor || '#2dd4bf',
            isAdmin: !!row.isAdmin
        });
    });
});

app.post('/api/grant-admin', requireAdmin, async (req, res) => {
    const { username } = req.body;
    const adminUsername = req.adminUsername;
    if (!username) {
        return res.json({ success: false, message: 'Username is required.' });
    }
    try {
        db.get('SELECT isAdmin FROM users WHERE username = ?', [username], (err, row) => {
            if (err) {
                console.error('Database error checking user:', err.message);
                return res.json({ success: false, message: 'Database error checking user.' });
            }
            if (!row) {
                return res.json({ success: false, message: 'User not found.' });
            }
            if (row.isAdmin) {
                return res.json({ success: false, message: 'User is already an admin.' });
            }
            db.run('UPDATE users SET isAdmin = 1 WHERE username = ?', [username], (err) => {
                if (err) {
                    console.error('Database error granting admin access:', err.message);
                    return res.json({ success: false, message: 'Database error granting admin access.' });
                }
                console.log(`Admin access granted for ${username} by ${adminUsername}`);
                res.json({ success: true, message: `Admin access granted for ${username}!` });
            });
        });
    } catch (error) {
        console.error('Error granting admin access:', error.stack);
        res.json({ success: false, message: 'Server error granting admin access.' });
    }
});

app.post('/api/revoke-admin', requireAdmin, async (req, res) => {
    const { username } = req.body;
    const adminUsername = req.adminUsername;
    if (!username) {
        return res.json({ success: false, message: 'Username is required.' });
    }
    try {
        db.get('SELECT isAdmin FROM users WHERE username = ?', [username], (err, row) => {
            if (err) {
                console.error('Database error checking user:', err.message);
                return res.json({ success: false, message: 'Database error checking user.' });
            }
            if (!row) {
                return res.json({ success: false, message: 'User not found.' });
            }
            if (!row.isAdmin) {
                return res.json({ success: false, message: 'User is not an admin.' });
            }
            db.run('UPDATE users SET isAdmin = 0 WHERE username = ?', [username], (err) => {
                if (err) {
                    console.error('Database error revoking admin access:', err.message);
                    return res.json({ success: false, message: 'Database error revoking admin access.' });
                }
                console.log(`Admin access revoked for ${username} by ${adminUsername}`);
                res.json({ success: true, message: `Admin access revoked for ${username}!` });
            });
        });
    } catch (error) {
        console.error('Error revoking admin access:', error.stack);
        res.json({ success: false, message: 'Server error revoking admin access.' });
    }
});

app.post('/api/admin-update-password', requireAdmin, async (req, res) => {
    const { username, newPassword } = req.body;
    const adminUsername = req.adminUsername;
    if (!username || !newPassword) {
        return res.json({ success: false, message: 'Username and new password are required.' });
    }
    try {
        db.get('SELECT username FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                console.error('Database error checking user:', err.message);
                return res.json({ success: false, message: 'Database error checking user.' });
            }
            if (!row) {
                return res.json({ success: false, message: 'User not found.' });
            }
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            db.run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username], (err) => {
                if (err) {
                    console.error('Database error updating password:', err.message);
                    return res.json({ success: false, message: 'Database error updating password.' });
                }
                console.log(`Password updated for ${username} by ${adminUsername}`);
                res.json({ success: true, message: `Password updated for ${username}!` });
            });
        });
    } catch (error) {
        console.error('Error updating password:', error.stack);
        res.json({ success: false, message: 'Server error updating password.' });
    }
});

app.delete('/api/delete-user/:username', requireAdmin, async (req, res) => {
    const { username } = req.params;
    const adminUsername = req.adminUsername;
    if (!username) {
        return res.json({ success: false, message: 'Username is required.' });
    }
    try {
        db.get('SELECT username FROM users WHERE username = ?', [username], (err, row) => {
            if (err) {
                console.error('Database error checking user:', err.message);
                return res.json({ success: false, message: 'Database error checking user.' });
            }
            if (!row) {
                return res.json({ success: false, message: 'User not found.' });
            }
            db.run('DELETE FROM users WHERE username = ?', [username], (err) => {
                if (err) {
                    console.error('Database error deleting user:', err.message);
                    return res.json({ success: false, message: 'Database error deleting user.' });
                }
                console.log(`User ${username} deleted by ${adminUsername}`);
                res.json({ success: true, message: 'User deleted successfully!' });
            });
        });
    } catch (error) {
        console.error('Error deleting user:', error.stack);
        res.json({ success: false, message: 'Server error deleting user.' });
    }
});

app.get('/api/financial', (req, res) => {
    const { user } = req.query;
    if (!user) {
        return res.json({ success: false, message: 'User is required.' });
    }
    db.all('SELECT * FROM financial WHERE user = ?', [user], (err, rows) => {
        if (err) {
            console.error('Database error fetching financial items:', err.message);
            return res.json({ success: false, message: 'Database error fetching financial items.' });
        }
        res.json(rows);
    });
});

app.post('/api/financial', (req, res) => {
    const { user, description, amount, type, date } = req.body;
    if (!user || !description || !amount || !type || !date) {
        return res.json({ success: false, message: 'All fields are required.' });
    }
    db.run(
        'INSERT INTO financial (user, description, amount, type, date) VALUES (?, ?, ?, ?, ?)',
        [user, description, amount, type, date],
        (err) => {
            if (err) {
                console.error('Database error adding financial item:', err.message);
                return res.json({ success: false, message: 'Database error adding financial item.' });
            }
            res.json({ success: true, message: 'Financial item added successfully!' });
        }
    );
});

app.delete('/api/financial/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM financial WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Database error deleting financial item:', err.message);
            return res.json({ success: false, message: 'Database error deleting financial item.' });
        }
        res.json({ success: true, message: 'Financial item deleted successfully!' });
    });
});

app.get('/api/calendar', (req, res) => {
    const { user } = req.query;
    if (!user) {
        return res.json({ success: false, message: 'User is required.' });
    }
    db.all('SELECT * FROM calendar WHERE user = ?', [user], (err, rows) => {
        if (err) {
            console.error('Database error fetching calendar events:', err.message);
            return res.json({ success: false, message: 'Database error fetching calendar events.' });
        }
        res.json(rows);
    });
});

app.post('/api/calendar', (req, res) => {
    const { user, title, date, financial, type, amount, eventColor } = req.body;
    if (!user || !title || !date) {
        return res.json({ success: false, message: 'User, title, and date are required.' });
    }
    db.run(
        'INSERT INTO calendar (user, title, date, financial, type, amount, eventColor) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user, title, date, financial, type, amount, eventColor],
        (err) => {
            if (err) {
                console.error('Database error adding calendar event:', err.message);
                return res.json({ success: false, message: 'Database error adding calendar event.' });
            }
            res.json({ success: true, message: 'Calendar event added successfully!' });
        }
    );
});

app.delete('/api/calendar/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM calendar WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Database error deleting calendar event:', err.message);
            return res.json({ success: false, message: 'Database error deleting calendar event.' });
        }
        res.json({ success: true, message: 'Calendar event deleted successfully!' });
    });
});

const httpsOptions = {
    key: fs.readFileSync('/etc/letsencrypt/live/ourlife.work.gd/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/ourlife.work.gd/fullchain.pem')
};

const httpsServer = https.createServer(httpsOptions, app);
httpsServer.listen(8443, () => console.log('HTTPS Server running on port 8443'));

const httpServer = http.createServer((req, res) => {
    res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
    res.end();
});
httpServer.listen(9000, () => console.log('HTTP Server running on port 9000 and redirecting to HTTPS'));
