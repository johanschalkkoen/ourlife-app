const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
const db = new sqlite3.Database('./prd-ourlife.db', (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database: prd-ourlife.db');
});

app.use(cors());
app.use(express.json());

// Database schema setup
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    profilePicUrl TEXT,
    eventColor TEXT DEFAULT '#2dd4bf',
    email TEXT,
    phone TEXT,
    address TEXT,
    isAdmin INTEGER DEFAULT 0,
    gender TEXT DEFAULT ''
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS financial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    description TEXT,
    amount REAL,
    type TEXT,
    date TEXT,
    FOREIGN KEY(user) REFERENCES users(username)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS budget (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    category TEXT,
    amount REAL,
    month TEXT,
    year TEXT,
    FOREIGN KEY(user) REFERENCES users(username)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS period (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    start_date TEXT,
    end_date TEXT,
    cycle_length INTEGER,
    symptoms TEXT,
    FOREIGN KEY(user) REFERENCES users(username)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS calendar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    title TEXT,
    date TEXT,
    financial INTEGER,
    type TEXT,
    amount REAL,
    eventColor TEXT,
    FOREIGN KEY(user) REFERENCES users(username)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    viewer TEXT,
    target TEXT,
    FOREIGN KEY(viewer) REFERENCES users(username),
    FOREIGN KEY(target) REFERENCES users(username)
  )`);
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required.' });
  }
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    res.json({
      success: true,
      user: {
        username: user.username,
        profilePicUrl: user.profilePicUrl,
        eventColor: user.eventColor,
        email: user.email,
        phone: user.phone,
        address: user.address,
        isAdmin: !!user.isAdmin,
        gender: user.gender || ''
      }
    });
  });
});

// Add user endpoint (admin only)
app.post('/api/add-user', async (req, res) => {
  const { username, password, adminUsername } = req.body;
  if (!username || !password || !adminUsername) {
    return res.status(400).json({ success: false, message: 'Username, password, and admin username required.' });
  }
  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], async (err, admin) => {
    if (err || !admin?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
        if (err) {
          console.error('Error adding user:', err.message);
          return res.status(400).json({ success: false, message: 'Username already exists.' });
        }
        res.json({ success: true, message: 'User added.' });
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error.' });
    }
  });
});

// Delete user endpoint (admin only)
app.delete('/api/delete-user/:username', (req, res) => {
  const { username } = req.params;
  const { adminUsername } = req.body;
  if (!adminUsername) {
    return res.status(400).json({ success: false, message: 'Admin username required.' });
  }
  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], (err, admin) => {
    if (err || !admin?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }
    db.run('DELETE FROM users WHERE username = ?', [username], (err) => {
      if (err) {
        console.error('Error deleting user:', err.message);
        return res.status(500).json({ success: false, message: 'Server error.' });
      }
      res.json({ success: true, message: 'User deleted.' });
    });
  });
});

// Update password (admin)
app.post('/api/admin-update-password', async (req, res) => {
  const { username, newPassword, adminUsername } = req.body;
  if (!username || !newPassword || !adminUsername) {
    return res.status(400).json({ success: false, message: 'Username, new password, and admin username required.' });
  }
  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], async (err, admin) => {
    if (err || !admin?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username], (err) => {
        if (err) {
          console.error('Error updating password:', err.message);
          return res.status(500).json({ success: false, message: 'Server error.' });
        }
        res.json({ success: true, message: 'Password updated.' });
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error.' });
    }
  });
});

// Update user password (self)
app.post('/api/update-password', async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'All fields required.' });
  }
  db.get('SELECT password FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username], (err) => {
        if (err) {
          console.error('Error updating password:', err.message);
          return res.status(500).json({ success: false, message: 'Server error.' });
        }
        res.json({ success: true, message: 'Password updated.' });
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error.' });
    }
  });
});

// Update profile settings
app.post('/api/user-profile-settings', (req, res) => {
  const { username, profilePicUrl, eventColor, email, phone, address, gender } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username required.' });
  }
  db.run(
    'UPDATE users SET profilePicUrl = ?, eventColor = ?, email = ?, phone = ?, address = ?, gender = ? WHERE username = ?',
    [profilePicUrl || null, eventColor || '#2dd4bf', email || null, phone || null, address || null, gender || '', username],
    (err) => {
      if (err) {
        console.error('Error updating profile:', err.message);
        return res.status(500).json({ success: false, message: 'Server error.' });
      }
      res.json({ success: true, message: 'Profile updated.' });
    }
  );
});

// Get user profile settings
app.get('/api/user-profile-settings', (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ success: false, message: 'Username required.' });
  }
  db.get('SELECT profilePicUrl, eventColor, email, phone, address, gender FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, profilePicUrl: user.profilePicUrl, eventColor: user.eventColor, email: user.email, phone: user.phone, address: user.address, gender: user.gender });
  });
});

// Get all users (admin only)
app.get('/api/users', (req, res) => {
  const { adminUsername } = req.query;
  if (!adminUsername) {
    return res.status(400).json({ success: false, message: 'Admin username required.' });
  }
  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], (err, admin) => {
    if (err || !admin?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }
    db.all('SELECT username, isAdmin FROM users', [], (err, users) => {
      if (err) {
        console.error('Error fetching users:', err.message);
        return res.status(500).json({ success: false, message: 'Server error.' });
      }
      res.json({ success: true, data: users });
    });
  });
});

// Grant admin (admin only)
app.post('/api/grant-admin', (req, res) => {
  const { username, adminUsername } = req.body;
  if (!username || !adminUsername) {
    return res.status(400).json({ success: false, message: 'Username and admin username required.' });
  }
  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], (err, admin) => {
    if (err || !admin?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }
    db.run('UPDATE users SET isAdmin = 1 WHERE username = ?', [username], (err) => {
      if (err) {
        console.error('Error granting admin:', err.message);
        return res.status(500).json({ success: false, message: 'Server error.' });
      }
      res.json({ success: true, message: 'Admin granted.' });
    });
  });
});

// Revoke admin (admin only)
app.post('/api/revoke-admin', (req, res) => {
  const { username, adminUsername } = req.body;
  if (!username || !adminUsername) {
    return res.status(400).json({ success: false, message: 'Username and admin username required.' });
  }
  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], (err, admin) => {
    if (err || !admin?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }
    db.run('UPDATE users SET isAdmin = 0 WHERE username = ?', [username], (err) => {
      if (err) {
        console.error('Error revoking admin:', err.message);
        return res.status(500).json({ success: false, message: 'Server error.' });
      }
      res.json({ success: true, message: 'Admin revoked.' });
    });
  });
});

// Grant access (admin only)
app.post('/api/grant-access', (req, res) => {
  const { viewer, target, adminUsername } = req.body;
  if (!viewer || !target || !adminUsername) {
    return res.status(400).json({ success: false, message: 'Viewer, target, and admin username required.' });
  }
  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], (err, admin) => {
    if (err || !admin?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }
    db.run('INSERT INTO access (viewer, target) VALUES (?, ?)', [viewer, target], (err) => {
      if (err) {
        console.error('Error granting access:', err.message);
        return res.status(400).json({ success: false, message: 'Access already exists or invalid.' });
      }
      res.json({ success: true, message: 'Access granted.' });
    });
  });
});

// Revoke access (admin only)
app.post('/api/revoke-access', (req, res) => {
  const { viewer, target, adminUsername } = req.body;
  if (!viewer || !target || !adminUsername) {
    return res.status(400).json({ success: false, message: 'Viewer, target, and admin username required.' });
  }
  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], (err, admin) => {
    if (err || !admin?.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }
    db.run('DELETE FROM access WHERE viewer = ? AND target = ?', [viewer, target], (err) => {
      if (err) {
        console.error('Error revoking access:', err.message);
        return res.status(500).json({ success: false, message: 'Server error.' });
      }
      res.json({ success: true, message: 'Access revoked.' });
    });
  });
});

// Get access list (admin or viewer)
app.get('/api/get-access', (req, res) => {
  const { viewer, adminUsername } = req.query;
  if (!viewer && !adminUsername) {
    return res.status(400).json({ success: false, message: 'Viewer or admin username required.' });
  }
  if (adminUsername) {
    db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], (err, admin) => {
      if (err || !admin?.isAdmin) {
        return res.status(403).json({ success: false, message: 'Unauthorized.' });
      }
      db.all('SELECT viewer, target FROM access', [], (err, accessList) => {
        if (err) {
          console.error('Error fetching access list:', err.message);
          return res.status(500).json({ success: false, message: 'Server error.' });
        }
        res.json({ success: true, accessList });
      });
    });
  } else {
    db.all('SELECT viewer, target FROM access WHERE viewer = ?', [viewer], (err, accessList) => {
      if (err) {
        console.error('Error fetching access list:', err.message);
        return res.status(500).json({ success: false, message: 'Server error.' });
      }
      res.json({ success: true, accessList });
    });
  }
});

// Financial endpoints
app.get('/api/financial', (req, res) => {
  const { user } = req.query;
  if (!user) {
    return res.status(400).json({ success: false, message: 'User required.' });
  }
  db.all('SELECT * FROM financial WHERE user = ?', [user], (err, items) => {
    if (err) {
      console.error('Error fetching financial items:', err.message);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
    res.json(items);
  });
});

app.post('/api/financial', (req, res) => {
  const { user, description, amount, type, date } = req.body;
  if (!user || !description || !amount || !type || !date) {
    return res.status(400).json({ success: false, message: 'All fields required.' });
  }
  db.run('INSERT INTO financial (user, description, amount, type, date) VALUES (?, ?, ?, ?, ?)', [user, description, amount, type, date], (err) => {
    if (err) {
      console.error('Error adding financial item:', err.message);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
    res.json({ success: true, message: 'Item added.' });
  });
});

app.delete('/api/financial/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM financial WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error deleting financial item:', err.message);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
    res.json({ success: true, message: 'Item deleted.' });
  });
});

// Budget endpoints
app.get('/api/budget', (req, res) => {
  const { user, month, year } = req.query;
  if (!user || !month || !year) {
    return res.status(400).json({ success: false, message: 'User, month, and year required.' });
  }
  db.all('SELECT * FROM budget WHERE user = ? AND month = ? AND year = ?', [user, month, year], (err, items) => {
    if (err) {
      console.error('Error fetching budget items:', err.message);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
    res.json(items);
  });
});

app.post('/api/budget', (req, res) => {
  const { user, category, amount, month, year } = req.body;
  if (!user || !category || !amount || !month || !year) {
    return res.status(400).json({ success: false, message: 'All fields required.' });
  }
  db.run('INSERT INTO budget (user, category, amount, month, year) VALUES (?, ?, ?, ?, ?)', [user, category, amount, month, year], (err) => {
    if (err) {
      console.error('Error adding budget item:', err.message);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
    res.json({ success: true, message: 'Budget item added.' });
  });
});

// Period endpoints
app.get('/api/period', (req, res) => {
  const { user } = req.query;
  if (!user) {
    return res.status(400).json({ success: false, message: 'User required.' });
  }
  db.all('SELECT * FROM period WHERE user = ?', [user], (err, cycles) => {
    if (err) {
      console.error('Error fetching period data:', err.message);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
    res.json(cycles);
  });
});

app.post('/api/period', (req, res) => {
  const { user, start_date, end_date, cycle_length, symptoms } = req.body;
  if (!user || !start_date || !cycle_length) {
    return res.status(400).json({ success: false, message: 'User, start date, and cycle length required.' });
  }
  db.run('INSERT INTO period (user, start_date, end_date, cycle_length, symptoms) VALUES (?, ?, ?, ?, ?)', [user, start_date, end_date || null, cycle_length, symptoms || null], (err) => {
    if (err) {
      console.error('Error adding period data:', err.message);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
    res.json({ success: true, message: 'Cycle added.' });
  });
});

// Calendar endpoints
app.get('/api/calendar', (req, res) => {
  const { user } = req.query;
  if (!user) {
    return res.status(400).json({ success: false, message: 'User required.' });
  }
  db.all('SELECT * FROM calendar WHERE user = ?', [user], (err, events) => {
    if (err) {
      console.error('Error fetching calendar events:', err.message);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
    res.json(events);
  });
});

app.post('/api/calendar', (req, res) => {
  const { user, title, date, financial, type, amount, eventColor } = req.body;
  if (!user || !title || !date) {
    return res.status(400).json({ success: false, message: 'User, title, and date required.' });
  }
  db.run('INSERT INTO calendar (user, title, date, financial, type, amount, eventColor) VALUES (?, ?, ?, ?, ?, ?, ?)', 
    [user, title, date, financial ? 1 : 0, type || null, amount || null, eventColor || '#2dd4bf'], (err) => {
      if (err) {
        console.error('Error adding calendar event:', err.message);
        return res.status(500).json({ success: false, message: 'Server error.' });
      }
      res.json({ success: true, message: 'Event added.' });
    });
});

app.delete('/api/calendar/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM calendar WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error deleting calendar event:', err.message);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
    res.json({ success: true, message: 'Event deleted.' });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server...');
  db.close((err) => {
    if (err) console.error('Error closing database:', err.message);
    console.log('Database closed.');
    process.exit(0);
  });
});