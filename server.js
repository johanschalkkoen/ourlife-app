const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const https = require('https');
const http = require('http');
const execPromise = util.promisify(exec);
const app = express();

const HTTPS_PORT = 8443;
const HTTP_PORT = 9000;
const CERT_PATH = '/etc/letsencrypt/live/ourlife.work.gd/fullchain.pem';
const KEY_PATH = '/etc/letsencrypt/live/ourlife.work.gd/privkey.pem';

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Initialize SQLite database
const db = new sqlite3.Database('./ourlife.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        process.exit(1);
    }
    console.log('Connected to the SQLite database.');
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            passwordHash TEXT,
            profilePicUrl TEXT,
            email TEXT,
            phone TEXT,
            address TEXT,
            eventColor TEXT,
            isAdmin INTEGER DEFAULT 0
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
                console.error('Error checking financial_items schema:', err);
                return;
            }
            const hasColorColumn = columns.some(col => col.name === 'color');
            if (!hasColorColumn) {
                db.run(`ALTER TABLE financial_items ADD COLUMN color TEXT`, (alterErr) => {
                    if (alterErr) {
                        console.error('Error adding color column to financial_items:', alterErr);
                    } else {
                        console.log('Added color column to financial_items table.');
                        db.all(`SELECT id, type FROM financial_items WHERE type IS NOT NULL`, [], (selectErr, rows) => {
                            if (selectErr) {
                                console.error('Error checking financial_items type values:', selectErr);
                                return;
                            }
                            const validTypes = ['income', 'expense'];
                            const invalidRows = rows.filter(row => !validTypes.includes(row.type));
                            if (invalidRows.length > 0) {
                                console.error('Invalid type values found in financial_items:', invalidRows);
                                db.run(`UPDATE financial_items SET type = 'expense' WHERE type NOT IN (?, ?)`, validTypes, (cleanErr) => {
                                    if (cleanErr) {
                                        console.error('Error cleaning invalid type values:', cleanErr);
                                    } else {
                                        console.log('Cleaned invalid type values in financial_items.');
                                    }
                                });
                            }
                            db.run(
                                `UPDATE financial_items SET color = CASE WHEN type = 'income' THEN '#00FF00' ELSE '#FF0000' END WHERE color IS NULL`,
                                (updateErr) => {
                                    if (updateErr) {
                                        console.error('Error updating existing financial items with color:', updateErr);
                                    } else {
                                        console.log('Updated existing financial items with color values.');
                                    }
                                }
                            );
                        });
                    }
                });
            }
        });

        db.all(`PRAGMA table_info(users)`, (err, columns) => {
            if (err) {
                console.error('Error checking users schema:', err);
                return;
            }
            const hasIsAdminColumn = columns.some(col => col.name === 'isAdmin');
            if (!hasIsAdminColumn) {
                db.run(`ALTER TABLE users ADD COLUMN isAdmin INTEGER DEFAULT 0`, (alterErr) => {
                    if (alterErr) {
                        console.error('Error adding isAdmin column to users:', alterErr);
                    } else {
                        console.log('Added isAdmin column to users table.');
                    }
                });
            }
            const hasPasswordHashColumn = columns.some(col => col.name === 'passwordHash');
            if (!hasPasswordHashColumn) {
                db.run(`ALTER TABLE users ADD COLUMN passwordHash TEXT`, (alterErr) => {
                    if (alterErr) {
                        console.error('Error adding passwordHash column to users:', alterErr);
                    } else {
                        console.log('Added passwordHash column to users table.');
                    }
                });
            }
            const hasProfilePicUrlColumn = columns.some(col => col.name === 'profilePicUrl');
            if (!hasProfilePicUrlColumn) {
                db.run(`ALTER TABLE users ADD COLUMN profilePicUrl TEXT`, (alterErr) => {
                    if (alterErr) {
                        console.error('Error adding profilePicUrl column to users:', alterErr);
                    } else {
                        console.log('Added profilePicUrl column to users table.');
                    }
                });
            }
            const hasEmailColumn = columns.some(col => col.name === 'email');
            if (!hasEmailColumn) {
                db.run(`ALTER TABLE users ADD COLUMN email TEXT`, (alterErr) => {
                    if (alterErr) {
                        console.error('Error adding email column to users:', alterErr);
                    } else {
                        console.log('Added email column to users table.');
                    }
                });
            }
            const hasPhoneColumn = columns.some(col => col.name === 'phone');
            if (!hasPhoneColumn) {
                db.run(`ALTER TABLE users ADD COLUMN phone TEXT`, (alterErr) => {
                    if (alterErr) {
                        console.error('Error adding phone column to users:', alterErr);
                    } else {
                        console.log('Added phone column to users table.');
                    }
                });
            }
            const hasAddressColumn = columns.some(col => col.name === 'address');
            if (!hasAddressColumn) {
                db.run(`ALTER TABLE users ADD COLUMN address TEXT`, (alterErr) => {
                    if (alterErr) {
                        console.error('Error adding address column to users:', alterErr);
                    } else {
                        console.log('Added address column to users table.');
                    }
                });
            }
            const hasEventColorColumn = columns.some(col => col.name === 'eventColor');
            if (!hasEventColorColumn) {
                db.run(`ALTER TABLE users ADD COLUMN eventColor TEXT`, (alterErr) => {
                    if (alterErr) {
                        console.error('Error adding eventColor column to users:', alterErr);
                    } else {
                        console.log('Added eventColor column to users table.');
                    }
                });
            }
        });

        console.log('Database tables checked/created.');
    });
});

// Helper functions
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

const requireAdmin = async (req, res, next) => {
    const username = (req.body && req.body.username) || (req.query && req.query.username);
    if (!username) {
        console.error('No username provided in req.body or req.query');
        return res.json({ success: false, message: 'Username is required.' });
    }
    try {
        db.get('SELECT isAdmin FROM users WHERE username = ?', [username], (err, row) => {
            if (err) {
                console.error('Database error checking admin access:', err.message);
                return res.json({ success: false, message: 'Database error checking admin access.' });
            }
            if (!row || !row.isAdmin) {
                console.error('Unauthorized access attempt by:', username);
                return res.json({ success: false, message: 'Unauthorized: Admin access required.' });
            }
            next();
        });
    } catch (error) {
        console.error('Error checking admin access:', error.stack);
        res.json({ success: false, message: 'Server error checking admin access.' });
    }
};

// API Endpoints
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: 'Username and password are required.' });
    }
    try {
        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                console.error('Database error during login user fetch:', err.message);
                return res.json({ success: false, message: 'Database error during login.' });
            }
            if (!row) {
                return res.json({ success: false, message: 'Authentication failed: User does not exist.' });
            }
            if (!row.passwordHash) {
                return res.json({ success: false, message: 'Authentication failed: User has no password set. Contact an admin to set a password.' });
            }
            const passwordMatch = await bcrypt.compare(password, row.passwordHash);
            if (passwordMatch) {
                console.log(`Authenticated user: ${username}`);
                res.json({
                    success: true,
                    username: row.username,
                    profilePicUrl: row.profilePicUrl || 'https://placehold.co/50x50/808080/FFFFFF?text=U',
                    email: row.email || '',
                    phone: row.phone || '',
                    address: row.address || '',
                    eventColor: row.eventColor || '#2dd4bf',
                    isAdmin: row.isAdmin === 1
                });
            } else {
                res.json({ success: false, message: 'Authentication failed: Incorrect password.' });
            }
        });
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
        db.get('SELECT passwordHash, isAdmin FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                console.error('Database error fetching user for password update:', err.message);
                return res.json({ success: false, message: 'Database error fetching user.' });
            }
            if (!row) {
                return res.json({ success: false, message: 'User not found.' });
            }
            if (!row.passwordHash) {
                return res.json({ success: false, message: 'No password set for user. Contact an admin to set a password.' });
            }
            const passwordMatch = await bcrypt.compare(currentPassword, row.passwordHash);
            if (!passwordMatch) {
                return res.json({ success: false, message: 'Incorrect current password.' });
            }
            const newPasswordHash = await bcrypt.hash(newPassword, 10);
            db.run('UPDATE users SET passwordHash = ? WHERE username = ?', [newPasswordHash, username], (updateErr) => {
                if (updateErr) {
                    console.error('Database error updating password:', updateErr.message);
                    return res.json({ success: false, message: 'Database error updating password.' });
                }
                res.json({ success: true, message: 'Password updated successfully!' });
            });
        });
    } catch (error) {
        console.error('Password update error:', error);
        res.json({ success: false, message: 'An internal server error occurred during password update.' });
    }
});

app.post('/api/admin-update-password', requireAdmin, async (req, res) => {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
        return res.json({ success: false, message: 'Username and new password are required.' });
    }
    try {
        db.get('SELECT username FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                console.error('Database error fetching user for admin password update:', err.message);
                return res.json({ success: false, message: 'Database error fetching user.' });
            }
            if (!row) {
                return res.json({ success: false, message: 'User not found.' });
            }
            const newPasswordHash = await bcrypt.hash(newPassword, 10);
            db.run('UPDATE users SET passwordHash = ? WHERE username = ?', [newPasswordHash, username], (updateErr) => {
                if (updateErr) {
                    console.error('Database error updating user password:', updateErr.message);
                    return res.json({ success: false, message: 'Database error updating password.' });
                }
                res.json({ success: true, message: `Password for ${username} updated successfully!` });
            });
        });
    } catch (error) {
        console.error('Admin password update error:', error);
        res.json({ success: false, message: 'An internal server error occurred during password update.' });
    }
});

app.get('/api/profile-pictures', (req, res) => {
    const { username } = req.query;
    if (!username) {
        return res.json({ success: false, message: 'Username is required.' });
    }
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            console.error('Database error fetching profile pictures:', err.message);
            return res.json({ success: false, message: 'Database error fetching profile.', profilePicUrl: null, email: '', phone: '', address: '', eventColor: '#2dd4bf', isAdmin: 0 });
        }
        res.json(row || { success: true, profilePicUrl: 'https://placehold.co/50x50/808080/FFFFFF?text=U', email: '', phone: '', address: '', eventColor: '#2dd4bf', isAdmin: 0 });
    });
});

app.post('/api/profile-pictures', (req, res) => {
    const { username, profilePicUrl, email, phone, address, eventColor } = req.body;
    if (!username) {
        return res.json({ success: false, message: 'Username is required.' });
    }
    if (profilePicUrl && profilePicUrl !== 'https://placehold.co/50x50/808080/FFFFFF?text=U' && !profilePicUrl.match(/^data:image\/(png|jpeg|jpg|gif);base64,/)) {
        return res.json({ success: false, message: 'Invalid image format. Must be a valid base64-encoded image (png, jpeg, jpg, or gif).' });
    }
    const finalProfilePicUrl = profilePicUrl || 'https://placehold.co/50x50/808080/FFFFFF?text=U';
    db.get('SELECT isAdmin FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            console.error('Database error checking user:', err.message);
            return res.json({ success: false, message: 'Database error checking user.' });
        }
        const isAdmin = row ? row.isAdmin : 0;
        db.run(
            `INSERT OR REPLACE INTO users (username, password, passwordHash, profilePicUrl, email, phone, address, eventColor, isAdmin) VALUES (?, (SELECT password FROM users WHERE username = ?), (SELECT passwordHash FROM users WHERE username = ?), ?, ?, ?, ?, ?, ?)`,
            [username, username, username, finalProfilePicUrl, email || '', phone || '', address || '', eventColor || '#2dd4bf', isAdmin],
            (err) => {
                if (err) {
                    console.error('Database error saving profile:', err.message);
                    return res.json({ success: false, message: 'Database error saving profile.' });
                }
                res.json({ success: true, profilePicUrl: finalProfilePicUrl, email, phone, address, eventColor, isAdmin });
            }
        );
    });
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
    const { user, description, amount, type, date, color } = req.body;
    const finalColor = color || (type.toLowerCase() === 'income' ? '#00FF00' : '#FF0000');
    db.run(
        `INSERT INTO financial_items (user, description, amount, type, date, color) VALUES (?, ?, ?, ?, ?, ?)`,
        [user, description, amount, type, date, finalColor],
        function (err) {
            if (err) {
                console.error('Database error adding financial item:', err.message);
                res.json({ success: false, message: 'Database error adding financial item.' });
            } else {
                res.json({ success: true, id: this.lastID, user, description, amount, type, date, color: finalColor });
            }
        }
    );
});

app.delete('/api/financial/:id', (req, res) => {
    const id = parseInt(req.params.id);
    db.run('DELETE FROM financial_items WHERE id = ?', id, (err) => {
        if (err) {
            console.error('Database error deleting financial item:', err.message);
            res.json({ success: false, message: 'Database error deleting financial item.' });
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
        [user, title, date, financial ? 1 : 0, type || null, amount || null, eventColor || '#2dd4bf'],
        function (err) {
            if (err) {
                console.error('Database error adding calendar event:', err.message);
                res.json({ success: false, message: 'Database error adding calendar event.' });
            } else {
                res.json({ success: true, id: this.lastID, user, title, date, financial, type, amount, eventColor });
            }
        }
    );
});

app.delete('/api/calendar/:id', (req, res) => {
    const id = parseInt(req.params.id);
    db.run('DELETE FROM calendar_events WHERE id = ?', id, (err) => {
        if (err) {
            console.error('Database error deleting calendar event:', err.message);
            res.json({ success: false, message: 'Database error deleting calendar event.' });
        } else {
            res.json({ success: true });
        }
    });
});

app.get('/api/users', requireAdmin, async (req, res) => {
    try {
        db.all('SELECT username, isAdmin FROM users', [], (err, rows) => {
            if (err) {
                console.error('Database error fetching users:', err, 'Query: SELECT username, isAdmin FROM users');
                return res.json({ success: false, message: 'Database error fetching users.' });
            }
            const userList = rows.map(row => ({
                username: row.username,
                isAdmin: row.isAdmin === 1
            }));
            res.json({ success: true, data: userList });
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.json({ success: false, message: 'Server error fetching users.' });
    }
});

app.post('/api/add-user', requireAdmin, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: 'Username and password are required.' });
    }
    try {
        db.get('SELECT username FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                console.error('Database error checking user existence:', err.message);
                return res.json({ success: false, message: 'Database error checking user.' });
            }
            if (row) {
                return res.json({ success: false, message: 'User already exists.' });
            }
            const passwordHash = await bcrypt.hash(password, 10);
            db.run(
                `INSERT INTO users (username, password, passwordHash, profilePicUrl, email, phone, address, eventColor, isAdmin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [username, '', passwordHash, 'https://placehold.co/50x50/808080/FFFFFF?text=U', '', '', '', '#2dd4bf', 0],
                (insertErr) => {
                    if (insertErr) {
                        console.error('Database error adding user:', insertErr.message);
                        return res.json({ success: false, message: 'Database error adding user.' });
                    }
                    res.json({ success: true, message: 'User added successfully!' });
                }
            );
        });
    } catch (error) {
        console.error('Error adding user:', error);
        res.json({ success: false, message: 'Server error adding user.' });
    }
});

app.delete('/api/delete-user/:username', requireAdmin, async (req, res) => {
    const { username } = req.params;
    try {
        db.get('SELECT username FROM users WHERE username = ?', [username], (err, row) => {
            if (err) {
                console.error('Database error checking user:', err.message);
                return res.json({ success: false, message: 'Database error checking user.' });
            }
            if (!row) {
                return res.json({ success: false, message: 'User not found.' });
            }
            db.run('DELETE FROM users WHERE username = ?', [username], (deleteErr) => {
                if (deleteErr) {
                    console.error('Database error deleting user:', deleteErr.message);
                    return res.json({ success: false, message: 'Database error deleting user.' });
                }
                db.run('DELETE FROM financial_items WHERE user = ?', [username], (err) => {
                    if (err) console.error('Error deleting user financial items:', err.message);
                });
                db.run('DELETE FROM calendar_events WHERE user = ?', [username], (err) => {
                    if (err) console.error('Error deleting user calendar events:', err.message);
                });
                db.run('DELETE FROM user_access WHERE viewer = ? OR target = ?', [username, username], (err) => {
                    if (err) console.error('Error deleting user access records:', err.message);
                });
                res.json({ success: true, message: 'User deleted successfully!' });
            });
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.json({ success: false, message: 'Server error deleting user.' });
    }
});

app.post('/api/grant-admin', requireAdmin, async (req, res) => {
    const { username } = req.body;
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
            db.run('UPDATE users SET isAdmin = 1 WHERE username = ?', [username], (updateErr) => {
                if (updateErr) {
                    console.error('Database error granting admin access:', updateErr.message);
                    return res.json({ success: false, message: 'Database error granting admin access.' });
                }
                res.json({ success: true, message: `Admin access granted for ${username}!` });
            });
        });
    } catch (error) {
        console.error('Error granting admin access:', error);
        res.json({ success: false, message: 'Server error granting admin access.' });
    }
});

app.post('/api/revoke-admin', requireAdmin, async (req, res) => {
    const { username } = req.body;
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
            db.run('UPDATE users SET isAdmin = 0 WHERE username = ?', [username], (updateErr) => {
                if (updateErr) {
                    console.error('Database error revoking admin access:', updateErr.message);
                    return res.json({ success: false, message: 'Database error revoking admin access.' });
                }
                res.json({ success: true, message: `Admin access revoked for ${username}!` });
            });
        });
    } catch (error) {
        console.error('Error revoking admin access:', error);
        res.json({ success: false, message: 'Server error revoking admin access.' });
    }
});

app.post('/api/grant-access', requireAdmin, async (req, res) => {
    const { viewer, target } = req.body;
    if (!viewer || !target) {
        return res.json({ success: false, message: 'Viewer and target usernames are required.' });
    }
    if (viewer === target) {
        return res.json({ success: false, message: 'Cannot grant access to self.' });
    }
    try {
        db.get('SELECT username FROM users WHERE username = ?', [viewer], (err, viewerRow) => {
            if (err) {
                console.error('Database error checking viewer:', err.message);
                return res.json({ success: false, message: 'Database error checking viewer.' });
            }
            if (!viewerRow) {
                return res.json({ success: false, message: 'Viewer user not found.' });
            }
            db.get('SELECT username FROM users WHERE username = ?', [target], (err, targetRow) => {
                if (err) {
                    console.error('Database error checking target:', err.message);
                    return res.json({ success: false, message: 'Database error checking target.' });
                }
                if (!targetRow) {
                    return res.json({ success: false, message: 'Target user not found.' });
                }
                db.run(
                    `INSERT OR IGNORE INTO user_access (viewer, target) VALUES (?, ?)`,
                    [viewer, target],
                    (insertErr) => {
                        if (insertErr) {
                            console.error('Database error granting access:', insertErr.message);
                            return res.json({ success: false, message: 'Database error granting access.' });
                        }
                        res.json({ success: true, message: `Access granted for ${viewer} to view ${target}'s data.` });
                    }
                );
            });
        });
    } catch (error) {
        console.error('Error granting access:', error);
        res.json({ success: false, message: 'Server error granting access.' });
    }
});

app.post('/api/revoke-access', requireAdmin, async (req, res) => {
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
                    return res.json({ success: false, message: 'Database error revoking access.' });
                }
                res.json({ success: true, message: `Access revoked for ${viewer} to view ${target}'s data.` });
            }
        );
    } catch (error) {
        console.error('Error revoking access:', error);
        res.json({ success: false, message: 'Server error revoking access.' });
    }
});

app.get('/api/get-access', async (req, res) => {
    const { viewer } = req.query;
    db.all('SELECT viewer, target FROM user_access', [], (err, rows) => {
        if (err) {
            console.error('Database error fetching access list:', err.message);
            return res.json({ success: false, message: 'Database error fetching access list.' });
        }
        if (viewer) {
            const filteredRows = rows.filter(row => row.viewer === viewer);
            res.json({ success: true, accessList: filteredRows });
        } else {
            res.json({ success: true, accessList: rows });
        }
    });
});

app.get('/api/pam-users', async (req, res) => {
    try {
        const { stdout } = await execPromise('getent passwd | cut -d: -f1');
        const pamUsers = stdout.split('\n').filter(Boolean);
        db.all('SELECT username FROM users', [], (err, rows) => {
            if (err) {
                console.error('Database error fetching app users:', err.message);
                return res.json({ success: false, message: 'Database error fetching app users.' });
            }
            const appUsers = rows.map(row => row.username);
            const commonUsers = pamUsers.filter(user => appUsers.includes(user));
            const appOnlyUsers = appUsers.filter(user => !pamUsers.includes(user));
            const pamOnlyUsers = pamUsers.filter(user => !appUsers.includes(user));
            res.json({
                success: true,
                pamUsers,
                appUsers,
                commonUsers,
                appOnlyUsers,
                pamOnlyUsers
            });
        });
    } catch (error) {
        console.error('Error fetching PAM users:', error);
        res.json({ success: false, message: 'Error fetching PAM users.' });
    }
});

// Admin page endpoint
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// HTTPS server setup
try {
    const options = {
        cert: fs.readFileSync(CERT_PATH),
        key: fs.readFileSync(KEY_PATH)
    };

    https.createServer(options, app).listen(HTTPS_PORT, () => {
        console.log(`HTTPS Server running on port ${HTTPS_PORT}`);
    });

    // HTTP server to redirect to HTTPS
    http.createServer((req, res) => {
        res.writeHead(301, { Location: `https://${req.headers.host.split(':')[0]}:${HTTPS_PORT}${req.url}` });
        res.end();
    }).listen(HTTP_PORT, () => {
        console.log(`HTTP Server running on port ${HTTP_PORT} and redirecting to HTTPS`);
    });
} catch (error) {
    console.error('Error starting HTTPS server:', error.message);
    process.exit(1);
}
