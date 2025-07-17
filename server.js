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
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const session = require('express-session');
const execPromise = util.promisify(exec);
const app = express();

const HTTPS_PORT = 8443;
const HTTP_PORT = 9000;
const USERS_FILE = path.join(__dirname, 'users.json');

// Environment variables for OAuth
const GOOGLE_CLIENT_ID = 'your-google-client-id';
const GOOGLE_CLIENT_SECRET = 'your-google-client-secret';
const FACEBOOK_APP_ID = 'your-facebook-app-id';
const FACEBOOK_APP_SECRET = 'your-facebook-app-secret';
const CALLBACK_URL = 'https://ourlife.work.gd:8443';

app.use(express.json({ limit: '50mb' }));
app.use(cors({
  origin: 'https://ourlife.work.gd',
  credentials: true
}));
app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

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
        eventColor TEXT,
        isAdmin INTEGER DEFAULT 0,
        oauthProvider TEXT,
        oauthId TEXT
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

// Passport configuration
passport.serializeUser((user, done) => {
  done(null, user.username);
});

passport.deserializeUser((username, done) => {
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return done(err);
    done(null, row || null);
  });
});

passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: `${CALLBACK_URL}/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
  const username = profile.emails[0].value.split('@')[0];
  const email = profile.emails[0].value;
  const profilePicUrl = profile.photos[0]?.value || 'https://placehold.co/50x50/808080/FFFFFF?text=U';
  db.get('SELECT * FROM users WHERE oauthId = ? AND oauthProvider = ?', [profile.id, 'google'], (err, row) => {
    if (err) return done(err);
    if (row) {
      return done(null, row);
    }
    db.run(
      `INSERT OR REPLACE INTO users (username, profilePicUrl, email, phone, address, eventColor, oauthProvider, oauthId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, profilePicUrl, email, '', '', '#3b82f6', 'google', profile.id],
      (err) => {
        if (err) return done(err);
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, newUser) => {
          done(err, newUser);
        });
      }
    );
  });
}));

passport.use(new FacebookStrategy({
  clientID: FACEBOOK_APP_ID,
  clientSecret: FACEBOOK_APP_SECRET,
  callbackURL: `${CALLBACK_URL}/auth/facebook/callback`,
  profileFields: ['id', 'emails', 'name', 'picture']
}, async (accessToken, refreshToken, profile, done) => {
  const username = profile.emails?.[0]?.value?.split('@')[0] || `fb_${profile.id}`;
  const email = profile.emails?.[0]?.value || '';
  const profilePicUrl = profile.photos?.[0]?.value || 'https://placehold.co/50x50/808080/FFFFFF?text=U';
  db.get('SELECT * FROM users WHERE oauthId = ? AND oauthProvider = ?', [profile.id, 'facebook'], (err, row) => {
    if (err) return done(err);
    if (row) {
      return done(null, row);
    }
    db.run(
      `INSERT OR REPLACE INTO users (username, profilePicUrl, email, phone, address, eventColor, oauthProvider, oauthId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, profilePicUrl, email, '', '', '#3b82f6', 'facebook', profile.id],
      (err) => {
        if (err) return done(err);
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, newUser) => {
          done(err, newUser);
        });
      }
    );
  });
}));

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

// Authentication endpoints
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
            return res.json({ success: true, ...row });
          }
          const defaultUserData = {
            username,
            profilePicUrl: 'https://placehold.co/50x50/808080/FFFFFF?text=U',
            email: '',
            phone: '',
            address: '',
            eventColor: '#3b82f6',
            isAdmin: 0
          };
          db.run(
            `INSERT OR REPLACE INTO users (username, profilePicUrl, email, phone, address, eventColor, isAdmin) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [defaultUserData.username, defaultUserData.profilePicUrl, defaultUserData.email, defaultUserData.phone, defaultUserData.address, defaultUserData.eventColor, defaultUserData.isAdmin],
            (insertErr) => {
              if (insertErr) {
                console.error('Database error inserting new user into SQLite:', insertErr.message);
                return res.json({ success: false, message: 'Database error creating new user profile.' });
              }
              res.json({ success: true, ...defaultUserData });
            }
          );
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

app.post('/api/admin-login', async (req, res) => {
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
        db.get('SELECT * FROM users WHERE username = ? AND isAdmin = 1', [username], (dbErr, row) => {
          if (dbErr) {
            console.error('Database error during admin login:', dbErr.message);
            return res.json({ success: false, message: 'Database error during admin login.' });
          }
          if (row) {
            res.json({ success: true, ...row });
          } else {
            res.json({ success: false, message: 'User is not an admin.' });
          }
        });
      } else {
        res.json({ success: false, message: 'Authentication f
ailed: Incorrect password.' });
      }
    } else {
      res.json({ success: false, message: 'Authentication failed: User does not exist.' });
    }
  } catch (error) {
    console.error('Admin authentication error:', error);
    res.json({ success: false, message: 'An internal server error occurred during admin authentication.' });
  }
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/api/login' }),
  (req, res) => {
    db.get('SELECT * FROM users WHERE username = ?', [req.user.username], (err, row) => {
      if (err) {
        console.error('Database error fetching user after Google auth:', err.message);
        return res.redirect('https://ourlife.work.gd?error=auth_failed');
      }
      res.redirect(`https://ourlife.work.gd?user=${encodeURIComponent(JSON.stringify(row))}`);
    });
  }
);

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));

app.get('/auth/facebook/callback', 
  passport.authenticate('facebook', { failureRedirect: '/api/login' }),
  (req, res) => {
    db.get('SELECT * FROM users WHERE username = ?', [req.user.username], (err, row) => {
      if (err) {
        console.error('Database error fetching user after Facebook auth:', err.message);
        return res.redirect('https://ourlife.work.gd?error=auth_failed');
      }
      res.redirect(`https://ourlife.work.gd?user=${encodeURIComponent(JSON.stringify(row))}`);
    });
  }
);

app.get('/api/guest', (req, res) => {
  const guestUser = {
    username: 'guest',
    profilePicUrl: 'https://placehold.co/50x50/808080/FFFFFF?text=G',
    email: '',
    phone: '',
    address: '',
    eventColor: '#3b82f6',
    isAdmin: 0
  };
  res.json({ success: true, ...guestUser });
});

// Other endpoints (profile-pictures, financial, calendar, etc.) remain the same
app.get('/api/profile-pictures', (req, res) => {
  const { username } = req.query;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error('Database error fetching profile pictures:', err.message);
      res.json({ profilePicUrl: null, email: '', phone: '', address: '', eventColor: '#3b82f6', isAdmin: 0 });
    } else {
      res.json(row || { profilePicUrl: null, email: '', phone: '', address: '', eventColor: '#3b82f6', isAdmin: 0 });
    }
  });
});

app.post('/api/profile-pictures', (req, res) => {
  const { username, profilePicUrl, email, phone, address, eventColor } = req.body;
  db.run(
    `INSERT OR REPLACE INTO users (username, profilePicUrl, email, phone, address, eventColor, isAdmin) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [username, profilePicUrl, email, phone, address, eventColor, req.body.isAdmin || 0],
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
  if (viewer === 'guest') {
    return res.json([]); // Guests have no access to financial data
  }
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
  if (user === 'guest') {
    return res.json({ success: false, message: 'Guests cannot add financial items.' });
  }
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
  if (viewer === 'guest') {
    return res.json([]); // Guests have no access to calendar data
  }
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
  if (user === 'guest') {
    return res.json({ success: false, message: 'Guests cannot add calendar events.' });
  }
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
    db.all('SELECT username, isAdmin FROM users', [], (err, rows) => {
      if (err) {
        console.error('Database error fetching users:', err.message);
        return res.json({ success: false, message: 'Failed to fetch users.' });
      }
      const enrichedUsers = rows.map(row => ({
        username: row.username,
        isAdmin: row.isAdmin
      }));
      res.json(enrichedUsers);
    });
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
    db.run(
      `INSERT OR REPLACE INTO users (username, profilePicUrl, email, phone, address, eventColor, isAdmin) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, 'https://placehold.co/50x50/808080/FFFFFF?text=U', '', '', '', '#3b82f6', 0],
      (err) => {
        if (err) {
          console.error('Database error inserting new user:', err.message);
          return res.json({ success: false, message: 'Failed to add user to database.' });
        }
        res.json({ success: true, message: 'User added successfully!' });
      }
    );
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

app.post('/api/grant-admin', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.json({ success: false, message: 'Username is required.' });
  }
  db.run(
    `UPDATE users SET isAdmin = 1 WHERE username = ?`,
    [username],
    (err) => {
      if (err) {
        console.error('Database error granting admin access:', err.message);
        res.json({ success: false, message: 'Failed to grant admin access.' });
      } else {
        res.json({ success: true, message: `Admin access granted to ${username}!` });
      }
    }
  );
});

app.post('/api/revoke-admin', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.json({ success: false, message: 'Username is required.' });
  }
  db.run(
    `UPDATE users SET isAdmin = 0 WHERE username = ?`,
    [username],
    (err) => {
      if (err) {
        console.error('Database error revoking admin access:', err.message);
        res.json({ success: false, message: 'Failed to revoke admin access.' });
      } else {
        res.json({ success: true, message: `Admin access revoked for ${username}!` });
      }
    }
  );
});

// Start server
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
