const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./prd-ourlife.db', (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database: prd-ourlife.db');
});

// Initialize database tables
async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
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
      `, (err) => { if (err) reject(err); });

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
      `, (err) => { if (err) reject(err); });

      db.run(`
        CREATE TABLE IF NOT EXISTS calendar (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user TEXT,
          title TEXT,
          date TEXT,
          financial BOOLEAN,
          type TEXT,
          amount REAL,
          eventColor TEXT,
          FOREIGN KEY (user) REFERENCES users(username)
        )
      `, (err) => { if (err) reject(err); });

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
      `, (err) => { if (err) reject(err); });

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
      `, (err) => { if (err) reject(err); });

      db.run(`
        CREATE TABLE IF NOT EXISTS access_control (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          viewer TEXT,
          target TEXT,
          FOREIGN KEY (viewer) REFERENCES users(username),
          FOREIGN KEY (target) REFERENCES users(username)
        )
      `, (err) => { if (err) reject(err); else resolve(); });
    });
  });
}

// Utility to validate input
const validateInput = (fields, res) => {
  for (const [key, value] of Object.entries(fields)) {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      res.status(400).json({ success: false, message: `${key} is required` });
      return false;
    }
  }
  return true;
};

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!validateInput({ username, password }, res)) return;

  try {
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        console.error('Database error during login:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }
      if (!(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ success: false, message: 'Invalid password' });
      }
      console.log(`User ${username} logged in successfully`);
      res.json({
        success: true,
        user: {
          username: user.username,
          profilePicUrl: user.profilePicUrl || '',
          eventColor: user.eventColor || '#2dd4bf',
          email: user.email || '',
          phone: user.phone || '',
          address: user.address || '',
          isAdmin: !!user.isAdmin,
          gender: user.gender || ''
        }
      });
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Profile settings endpoint
app.get('/api/user-profile-settings', (req, res) => {
  const { username } = req.query;
  if (!validateInput({ username }, res)) return;

  db.get('SELECT profilePicUrl FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error('Error fetching profile:', err.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, profilePicUrl: user.profilePicUrl || '' });
  });
});

app.post('/api/user-profile-settings', async (req, res) => {
  const { username, profilePicUrl, email, phone, address, eventColor, gender } = req.body;
  if (!validateInput({ username }, res)) return;

  try {
    db.run(
      `UPDATE users SET profilePicUrl = ?, email = ?, phone = ?, address = ?, eventColor = ?, gender = ? WHERE username = ?`,
      [profilePicUrl || '', email || '', phone || '', address || '', eventColor || '#2dd4bf', gender || '', username],
      (err) => {
        if (err) {
          console.error('Error updating profile:', err.message);
          return res.status(500).json({ success: false, message: 'Server error' });
        }
        console.log(`Profile updated for ${username}`);
        res.json({ success: true });
      }
    );
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update password endpoint
app.post('/api/update-password', async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  if (!validateInput({ username, currentPassword, newPassword }, res)) return;
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
  }

  try {
    db.get('SELECT password FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        console.error('Database error during password update:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      if (!(await bcrypt.compare(currentPassword, user.password))) {
        return res.status(401).json({ success: false, message: 'Current password incorrect' });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username], (err) => {
        if (err) {
          console.error('Error updating password:', err.message);
          return res.status(500).json({ success: false, message: 'Server error' });
        }
        console.log(`Password updated for ${username}`);
        res.json({ success: true });
      });
    });
  } catch (err) {
    console.error('Password update error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Financial endpoints
app.get('/api/financial', (req, res) => {
  const { user } = req.query;
  if (!validateInput({ user }, res)) return;

  db.all('SELECT * FROM financial WHERE user = ?', [user], (err, rows) => {
    if (err) {
      console.error('Error fetching financial data:', err.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.json(rows);
  });
});

app.post('/api/financial', (req, res) => {
  const { user, description, amount, type, date } = req.body;
  if (!validateInput({ user, description, amount, type, date }, res)) return;
  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Invalid type' });
  }
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid amount' });
  }

  db.run(
    'INSERT INTO financial (user, description, amount, type, date) VALUES (?, ?, ?, ?, ?)',
    [user, description, amount, type, date],
    (err) => {
      if (err) {
        console.error('Error adding financial item:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      console.log(`Financial item added for ${user}`);
      res.json({ success: true });
    }
  );
});

app.delete('/api/financial/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM financial WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error deleting financial item:', err.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    console.log(`Financial item ${id} deleted`);
    res.json({ success: true });
  });
});

// Calendar endpoints
app.get('/api/calendar', (req, res) => {
  const { user } = req.query;
  if (!validateInput({ user }, res)) return;

  db.all('SELECT * FROM calendar WHERE user = ?', [user], (err, rows) => {
    if (err) {
      console.error('Error fetching calendar events:', err.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.json(rows);
  });
});

app.post('/api/calendar', (req, res) => {
  const { user, title, date, financial, type, amount, eventColor } = req.body;
  if (!validateInput({ user, title, date }, res)) return;
  if (financial && (!['income', 'expense'].includes(type) || isNaN(amount) || amount <= 0)) {
    return res.status(400).json({ success: false, message: 'Invalid financial event data' });
  }

  db.run(
    'INSERT INTO calendar (user, title, date, financial, type, amount, eventColor) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [user, title, date, financial || false, type || null, amount || null, eventColor || '#2dd4bf'],
    (err) => {
      if (err) {
        console.error('Error adding calendar event:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      console.log(`Calendar event added for ${user}`);
      res.json({ success: true });
    }
  );
});

app.delete('/api/calendar/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM calendar WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error deleting calendar event:', err.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    console.log(`Calendar event ${id} deleted`);
    res.json({ success: true });
  });
});

// Budget endpoints
app.get('/api/budget', (req, res) => {
  const { user, month, year } = req.query;
  if (!validateInput({ user, month, year }, res)) return;

  db.all('SELECT * FROM budget WHERE user = ? AND month = ? AND year = ?', [user, month, year], (err, rows) => {
    if (err) {
      console.error('Error fetching budget items:', err.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.json(rows);
  });
});

app.post('/api/budget', (req, res) => {
  const { user, category, amount, month, year } = req.body;
  if (!validateInput({ user, category, amount, month, year }, res)) return;
  if (isNaN(amount) || amount < 0) {
    return res.status(400).json({ success: false, message: 'Invalid amount' });
  }

  db.run(
    'INSERT INTO budget (user, category, amount, month, year) VALUES (?, ?, ?, ?, ?)',
    [user, category, amount, month, year],
    (err) => {
      if (err) {
        console.error('Error adding budget item:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      console.log(`Budget item added for ${user}`);
      res.json({ success: true });
    }
  );
});

// Period endpoints
app.get('/api/period', (req, res) => {
  const { user } = req.query;
  if (!validateInput({ user }, res)) return;

  db.all('SELECT * FROM period WHERE user = ?', [user], (err, rows) => {
    if (err) {
      console.error('Error fetching period data:', err.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    res.json(rows);
  });
});

app.post('/api/period', (req, res) => {
  const { user, start_date, end_date, cycle_length, symptoms } = req.body;
  if (!validateInput({ user, start_date, cycle_length }, res)) return;
  if (isNaN(cycle_length) || cycle_length <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid cycle length' });
  }

  db.run(
    'INSERT INTO period (user, start_date, end_date, cycle_length, symptoms) VALUES (?, ?, ?, ?, ?)',
    [user, start_date, end_date || null, cycle_length, symptoms || null],
    (err) => {
      if (err) {
        console.error('Error adding period data:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      console.log(`Period data added for ${user}`);
      res.json({ success: true });
    }
  );
});

// Admin endpoints
app.get('/api/users', (req, res) => {
  const { adminUsername } = req.query;
  if (!validateInput({ adminUsername }, res)) return;

  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], (err, user) => {
    if (err) {
      console.error('Error checking admin status:', err.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (!user || !user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    db.all('SELECT username, isAdmin FROM users', [], (err, rows) => {
      if (err) {
        console.error('Error fetching users:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      res.json({ success: true, data: rows });
    });
  });
});

app.post('/api/add-user', async (req, res) => {
  const { username, password, adminUsername } = req.body;
  if (!validateInput({ username, password, adminUsername }, res)) return;
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], async (err, user) => {
    if (err) {
      console.error('Error checking admin status:', err.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (!user || !user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
        if (err) {
          console.error('Error adding user:', err.message);
          return res.status(400).json({ success: false, message: 'Username already exists' });
        }
        console.log(`User ${username} added by ${adminUsername}`);
        res.json({ success: true });
      });
    } catch (err) {
      console.error('Add user error:', err.message);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
});

app.delete('/api/delete-user/:username', (req, res) => {
  const { username } = req.params;
  const { adminUsername } = req.body;
  if (!validateInput({ username, adminUsername }, res)) return;

  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], (err, user) => {
    if (err) {
      console.error('Error checking admin status:', err.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (!user || !user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (username === adminUsername) {
      return res.status(400).json({ success: false, message: 'Cannot delete self' });
    }
    db.run('DELETE FROM users WHERE username = ?', [username], (err) => {
      if (err) {
        console.error('Error deleting user:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      console.log(`User ${username} deleted by ${adminUsername}`);
      res.json({ success: true });
    });
  });
});

app.post('/api/grant-admin', (req, res) => {
  const { username, adminUsername } = req.body;
  if (!validateInput({ username, adminUsername }, res)) return;

  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], (err, user) => {
    if (err) {
      console.error('Error checking admin status:', err.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (!user || !user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    db.run('UPDATE users SET isAdmin = 1 WHERE username = ?', [username], (err) => {
      if (err) {
        console.error('Error granting admin:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      console.log(`Admin granted for ${username} by ${adminUsername}`);
      res.json({ success: true });
    });
  });
});

app.post('/api/revoke-admin', (req, res) => {
  const { username, adminUsername } = req.body;
  if (!validateInput({ username, adminUsername }, res)) return;

  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], (err, user) => {
    if (err) {
      console.error('Error checking admin status:', err.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (!user || !user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (username === adminUsername) {
      return res.status(400).json({ success: false, message: 'Cannot revoke own admin status' });
    }
    db.run('UPDATE users SET isAdmin = 0 WHERE username = ?', [username], (err) => {
      if (err) {
        console.error('Error revoking admin:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      console.log(`Admin revoked for ${username} by ${adminUsername}`);
      res.json({ success: true });
    });
  });
});

app.post('/api/admin-update-password', async (req, res) => {
  const { username, newPassword, adminUsername } = req.body;
  if (!validateInput({ username, newPassword, adminUsername }, res)) return;
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
  }

  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], async (err, user) => {
    if (err) {
      console.error('Error checking admin status:', err.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (!user || !user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.run('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username], (err) => {
        if (err) {
          console.error('Error updating password:', err.message);
          return res.status(500).json({ success: false, message: 'Server error' });
        }
        console.log(`Password updated for ${username} by ${adminUsername}`);
        res.json({ success: true });
      });
    } catch (err) {
      console.error('Admin password update error:', err.message);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
});

app.get('/api/get-access', (req, res) => {
  const { adminUsername, viewer } = req.query;
  if (!validateInput({ adminUsername }, res)) return;

  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], (err, user) => {
    if (err) {
      console.error('Error checking admin status:', err.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (!user || !user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const query = viewer ? 'SELECT viewer, target FROM access_control WHERE viewer = ?' : 'SELECT viewer, target FROM access_control';
    const params = viewer ? [viewer] : [];
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error fetching access list:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      res.json({ success: true, accessList: rows });
    });
  });
});

app.post('/api/grant-access', (req, res) => {
  const { viewer, target, adminUsername } = req.body;
  if (!validateInput({ viewer, target, adminUsername }, res)) return;
  if (viewer === target) {
    return res.status(400).json({ success: false, message: 'Viewer and target cannot be the same' });
  }

  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], (err, user) => {
    if (err) {
      console.error('Error checking admin status:', err.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (!user || !user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    db.run('INSERT INTO access_control (viewer, target) VALUES (?, ?)', [viewer, target], (err) => {
      if (err) {
        console.error('Error granting access:', err.message);
        return res.status(400).json({ success: false, message: 'Access already exists or invalid user' });
      }
      console.log(`Access granted: ${viewer} to ${target} by ${adminUsername}`);
      res.json({ success: true });
    });
  });
});

app.post('/api/revoke-access', (req, res) => {
  const { viewer, target, adminUsername } = req.body;
  if (!validateInput({ viewer, target, adminUsername }, res)) return;

  db.get('SELECT isAdmin FROM users WHERE username = ?', [adminUsername], (err, user) => {
    if (err) {
      console.error('Error checking admin status:', err.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (!user || !user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    db.run('DELETE FROM access_control WHERE viewer = ? AND target = ?', [viewer, target], (err) => {
      if (err) {
        console.error('Error revoking access:', err.message);
        return res.status(500).json({ success: false, message: 'Server error' });
      }
      console.log(`Access revoked: ${viewer} to ${target} by ${adminUsername}`);
      res.json({ success: true });
    });
  });
});

// Start server after database initialization
initializeDatabase()
  .then(() => {
    const PORT = 8443;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Database initialization error:', err.message);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing database and server...');
  db.close((err) => {
    if (err) console.error('Error closing database:', err.message);
    else console.log('Database connection closed');
    process.exit(0);
  });
});
