const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./ourlife.db', (err) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Connected to SQLite database');
});

async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create users table with gender column
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          profilePicUrl TEXT,
          email TEXT,
          phone TEXT,
          address TEXT,
          eventColor TEXT DEFAULT '#2dd4bf',
          isAdmin BOOLEAN DEFAULT 0,
          gender TEXT DEFAULT ''
        )
      `);

      // Create other tables
      db.run(`
        CREATE TABLE IF NOT EXISTS financial (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user TEXT,
          description TEXT,
          amount REAL,
          type TEXT CHECK(type IN ('income', 'expense')),
          date TEXT,
          FOREIGN KEY (user) REFERENCES users(username)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS calendar (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user TEXT,
          title TEXT,
          date TEXT,
          financial BOOLEAN DEFAULT 0,
          type TEXT CHECK(type IN ('income', 'expense')),
          amount REAL,
          eventColor TEXT,
          FOREIGN KEY (user) REFERENCES users(username)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS access_control (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          viewer TEXT,
          target TEXT,
          FOREIGN KEY (viewer) REFERENCES users(username),
          FOREIGN KEY (target) REFERENCES users(username)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS budget (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user TEXT,
          category TEXT,
          amount REAL,
          month TEXT,
          year TEXT,
          FOREIGN KEY (user) REFERENCES users(username)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS period (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user TEXT,
          start_date TEXT,
          end_date TEXT,
          cycle_length INTEGER,
          symptoms TEXT,
          FOREIGN KEY (user) REFERENCES users(username)
        )
      `);

      // Add gender column to users table if it doesn't exist
      db.get("PRAGMA table_info(users)", (err, rows) => {
        if (err) return reject(err);
        const hasGender = rows.some(row => row.name === 'gender');
        if (!hasGender) {
          db.run(`ALTER TABLE users ADD COLUMN gender TEXT DEFAULT ''`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        } else {
          resolve();
        }
      });
    });
  });
}

initializeDatabase().catch(err => console.error('Database initialization error:', err));

// Middleware to check admin access
async function isAdmin(req, res, next) {
  const { adminUsername } = req.body.adminUsername ? req.body : req.query;
  if (!adminUsername) return res.status(401).json({ success: false, message: 'Admin username required' });

  return new Promise((resolve, reject) => {
    db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], (err, row) => {
      if (err) return reject(err);
      if (!row || !row.isAdmin) {
        return res.status(403).json({ success: false, message: 'Admin access required' });
      }
      next();
    });
  });
}

// Login endpoint with gender in response
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      console.error('Login error:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid password' });

    res.json({
      success: true,
      user: {
        username: user.username,
        profilePicUrl: user.profilePicUrl || 'https://placehold.co/50x50/808080/FFFFFF?text=U',
        eventColor: user.eventColor || '#2dd4bf',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        isAdmin: user.isAdmin || false,
        gender: user.gender || ''
      }
    });
  });
});

// User profile settings endpoint (replaced profile-pictures)
app.get('/api/user-profile-settings', (req, res) => {
  const { username } = req.query;
  db.get(
    'SELECT profilePicUrl, eventColor, email, phone, address, isAdmin, gender FROM users WHERE username = ?',
    [username],
    (err, row) => {
      if (err) {
        console.error('Error fetching profile:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      if (!row) return res.status(404).json({ success: false, message: 'User not found' });

      res.json({
        success: true,
        profilePicUrl: row.profilePicUrl || 'https://placehold.co/50x50/808080/FFFFFF?text=U',
        eventColor: row.eventColor || '#2dd4bf',
        email: row.email || '',
        phone: row.phone || '',
        address: row.address || '',
        isAdmin: row.isAdmin || false,
        gender: row.gender || ''
      });
    }
  );
});

app.post('/api/user-profile-settings', (req, res) => {
  const { username, profilePicUrl, email, phone, address, eventColor, gender } = req.body;
  db.run(
    'UPDATE users SET profilePicUrl = ?, email = ?, phone = ?, address = ?, eventColor = ?, gender = ? WHERE username = ?',
    [profilePicUrl, email, phone, address, eventColor, gender, username],
    (err) => {
      if (err) {
        console.error('Error saving profile:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      res.json({ success: true });
    }
  );
});

// Update password endpoint
app.post('/api/update-password', async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  db.get('SELECT password FROM users WHERE username = ?', [username], async (err, row) => {
    if (err) {
      console.error('Error updating password:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (!row) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, row.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username], (err) => {
      if (err) {
        console.error('Error updating password:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      res.json({ success: true });
    });
  });
});

// Financial endpoints
app.get('/api/financial', (req, res) => {
  const { user } = req.query;
  db.all('SELECT * FROM financial WHERE user = ?', [user], (err, rows) => {
    if (err) {
      console.error('Error fetching financial data:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.json(rows);
  });
});

app.post('/api/financial', (req, res) => {
  const { user, description, amount, type, date } = req.body;
  db.run(
    'INSERT INTO financial (user, description, amount, type, date) VALUES (?, ?, ?, ?, ?)',
    [user, description, amount, type, date],
    (err) => {
      if (err) {
        console.error('Error adding financial data:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/financial/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM financial WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error deleting financial data:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.json({ success: true });
  });
});

// Calendar endpoints
app.get('/api/calendar', (req, res) => {
  const { user } = req.query;
  db.all('SELECT * FROM calendar WHERE user = ?', [user], (err, rows) => {
    if (err) {
      console.error('Error fetching calendar events:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.json(rows);
  });
});

app.post('/api/calendar', (req, res) => {
  const { user, title, date, financial, type, amount, eventColor } = req.body;
  db.run(
    'INSERT INTO calendar (user, title, date, financial, type, amount, eventColor) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [user, title, date, financial, type, amount, eventColor],
    (err) => {
      if (err) {
        console.error('Error adding calendar event:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/calendar/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM calendar WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error deleting calendar event:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.json({ success: true });
  });
});

// Budget endpoints
app.get('/api/budget', (req, res) => {
  const { user, month, year } = req.query;
  db.all(
    'SELECT * FROM budget WHERE user = ? AND month = ? AND year = ?',
    [user, month, year],
    (err, rows) => {
      if (err) {
        console.error('Error fetching budget data:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      res.json(rows);
    }
  );
});

app.post('/api/budget', (req, res) => {
  const { user, category, amount, month, year } = req.body;
  db.run(
    'INSERT INTO budget (user, category, amount, month, year) VALUES (?, ?, ?, ?, ?)',
    [user, category, amount, month, year],
    (err) => {
      if (err) {
        console.error('Error adding budget data:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      res.json({ success: true });
    }
  );
});

// Period tracker endpoints
app.get('/api/period', (req, res) => {
  const { user } = req.query;
  db.all('SELECT * FROM period WHERE user = ?', [user], (err, rows) => {
    if (err) {
      console.error('Error fetching period data:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.json(rows);
  });
});

app.post('/api/period', (req, res) => {
  const { user, start_date, end_date, cycle_length, symptoms } = req.body;
  db.run(
    'INSERT INTO period (user, start_date, end_date, cycle_length, symptoms) VALUES (?, ?, ?, ?, ?)',
    [user, start_date, end_date, cycle_length, symptoms],
    (err) => {
      if (err) {
        console.error('Error adding period data:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      res.json({ success: true });
    }
  );
});

// Admin endpoints
app.get('/api/users', isAdmin, (req, res) => {
  db.all('SELECT username, isAdmin FROM users', (err, rows) => {
    if (err) {
      console.error('Error fetching users:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.json({ success: true, data: rows });
  });
});

app.post('/api/add-user', isAdmin, async (req, res) => {
  const { username, password, adminUsername } = req.body;
  db.get('SELECT username FROM users WHERE username = ?', [username], async (err, row) => {
    if (err) {
      console.error('Error checking user existence:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (row) return res.status(400).json({ success: false, message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
      if (err) {
        console.error('Error adding user:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      res.json({ success: true });
    });
  });
});

app.delete('/api/delete-user/:username', isAdmin, (req, res) => {
  const { username } = req.params;
  const { adminUsername } = req.body;
  if (username === adminUsername) return res.status(400).json({ success: false, message: 'Cannot delete self' });
  db.run('DELETE FROM users WHERE username = ?', [username], (err) => {
    if (err) {
      console.error('Error deleting user:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.json({ success: true });
  });
});

app.post('/api/grant-admin', isAdmin, (req, res) => {
  const { username, adminUsername } = req.body;
  db.run('UPDATE users SET isAdmin = 1 WHERE username = ?', [username], (err) => {
    if (err) {
      console.error('Error granting admin access:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.json({ success: true });
  });
});

app.post('/api/revoke-admin', isAdmin, (req, res) => {
  const { username, adminUsername } = req.body;
  if (username === adminUsername) return res.status(400).json({ success: false, message: 'Cannot revoke own admin access' });
  db.run('UPDATE users SET isAdmin = 0 WHERE username = ?', [username], (err) => {
    if (err) {
      console.error('Error revoking admin access:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.json({ success: true });
  });
});

app.get('/api/get-access', isAdmin, (req, res) => {
  const { viewer } = req.query;
  const query = viewer ? 'SELECT * FROM access_control WHERE viewer = ?' : 'SELECT * FROM access_control';
  const params = viewer ? [viewer] : [];
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching access list:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.json({ success: true, accessList: rows });
  });
});

app.post('/api/grant-access', isAdmin, (req, res) => {
  const { viewer, target, adminUsername } = req.body;
  db.get('SELECT username FROM users WHERE username = ?', [viewer], (err, viewerRow) => {
    if (err || !viewerRow) {
      console.error('Error checking viewer:', err);
      return res.status(404).json({ success: false, message: 'Viewer user not found' });
    }
    db.get('SELECT username FROM users WHERE username = ?', [target], (err, targetRow) => {
      if (err || !targetRow) {
        console.error('Error checking target:', err);
        return res.status(404).json({ success: false, message: 'Target user not found' });
      }
      db.run('INSERT INTO access_control (viewer, target) VALUES (?, ?)', [viewer, target], (err) => {
        if (err) {
          console.error('Error granting access:', err);
          return res.status(500).json({ success: false, message: 'Server error' });
        }
        res.json({ success: true });
      });
    });
  });
});

app.delete('/api/revoke-access', isAdmin, (req, res) => {
  const { viewer, target, adminUsername } = req.body;
  db.run('DELETE FROM access_control WHERE viewer = ? AND target = ?', [viewer, target], (err) => {
    if (err) {
      console.error('Error revoking access:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.json({ success: true });
  });
});

app.listen(8443, () => console.log('Server running on port 8443'));