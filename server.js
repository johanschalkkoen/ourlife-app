const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const app = express();
const HTTPS_PORT = 8443;
const HTTP_PORT = 9000;
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./ourlife.db', (err) => {
  if (err) throw new Error(`Database connection failed: ${err.message}`);
  console.log('Connected to SQLite database.');
  db.run(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, profilePicUrl TEXT, email TEXT, phone TEXT, address TEXT, eventColor TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, description TEXT, amount REAL, type TEXT, date TEXT, color TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS calendar_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, title TEXT, date TEXT, isTransaction INTEGER, type TEXT, amount REAL, eventColor TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS user_access (id INTEGER PRIMARY KEY AUTOINCREMENT, viewer TEXT, target TEXT, UNIQUE(viewer, target))`);
  db.all(`PRAGMA table_info(transactions)`, (err, columns) => {
    if (!columns.some(col => col.name === 'color')) {
      db.run(`ALTER TABLE transactions ADD COLUMN color TEXT`, () => {
        db.run(`UPDATE transactions SET color = CASE WHEN type = 'income' THEN '#00FF00' ELSE '#FF0000' END WHERE color IS NULL`);
      });
    }
  });
});

const readUsers = async () => {
  try {
    const data = await fs.promises.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
};

const writeUsers = async (users) => {
  await fs.promises.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
};

const getAccessibleUsers = (viewer) => new Promise((resolve, reject) => {
  db.all(`SELECT target FROM user_access WHERE viewer = ?`, [viewer], (err, rows) => {
    if (err) reject(err);
    else resolve([viewer, ...rows.map(row => row.target)]);
  });
});

const requireAdmin = async (req, res, next) => {
  const { username } = req.body.username ? req.body : req.query;
  if (!username) return res.json({ success: false, message: 'Username required.' });
  const users = await readUsers();
  if (!users[username]?.isAdmin) return res.json({ success: false, message: 'Unauthorized: Admin access required.' });
  next();
};

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, message: 'Username and password required.' });
  const users = await readUsers();
  const storedUser = users[username];
  if (!storedUser || !(await bcrypt.compare(password, storedUser.passwordHash))) return res.json({ success: false, message: 'Authentication failed.' });
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (err) return res.json({ success: false, message: 'Database error.' });
    if (!row) {
      const defaultUser = { username, profilePicUrl: 'https://placehold.co/50x50/808080/FFFFFF?text=U', email: '', phone: '', address: '', eventColor: '#3b82f6' };
      db.run(`INSERT OR REPLACE INTO users VALUES (?, ?, ?, ?, ?, ?)`, Object.values(defaultUser), (err) => {
        if (err) return res.json({ success: false, message: 'Database error.' });
        res.json({ success: true, isAdmin: storedUser.isAdmin || false, ...defaultUser });
      });
    } else {
      res.json({ success: true, isAdmin: storedUser.isAdmin || false, ...row });
    }
  });
});

app.post('/api/update-password', async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  if (!username || !currentPassword || !newPassword) return res.json({ success: false, message: 'All fields required.' });
  const users = await readUsers();
  const storedUser = users[username];
  if (!storedUser || !(await bcrypt.compare(currentPassword, storedUser.passwordHash))) return res.json({ success: false, message: 'Incorrect current password.' });
  users[username].passwordHash = await bcrypt.hash(newPassword, 10);
  await writeUsers(users);
  res.json({ success: true, message: 'Password updated.' });
});

app.get('/api/profile-pictures', (req, res) => {
  const { username } = req.query;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    res.json(row || { profilePicUrl: null, email: '', phone: '', address: '', eventColor: '#3b82f6' });
  });
});

app.post('/api/profile-pictures', (req, res) => {
  const { username, profilePicUrl, email, phone, address, eventColor } = req.body;
  db.run(`INSERT OR REPLACE INTO users VALUES (?, ?, ?, ?, ?, ?)`, [username, profilePicUrl, email, phone, address, eventColor], (err) => {
    res.json({ success: !err });
  });
});

app.get('/api/transactions', async (req, res) => {
  const { user: viewer } = req.query;
  try {
    const accessibleUsers = await getAccessibleUsers(viewer);
    db.all(`SELECT * FROM transactions WHERE user IN (${accessibleUsers.map(() => '?').join(',')})`, accessibleUsers, (err, rows) => {
      res.json(rows || []);
    });
  } catch (error) {
    res.json([]);
  }
});

app.post('/api/transactions', (req, res) => {
  const { user, description, amount, type, date, eventTitle } = req.body;
  const color = type.toLowerCase() === 'income' ? '#00FF00' : '#FF0000';
  db.run(`INSERT INTO transactions (user, description, amount, type, date, color) VALUES (?, ?, ?, ?, ?, ?)`, [user, description, amount, type, date, color], function (err) {
    if (err) return res.json({ success: false });
    const transactionId = this.lastID;
    if (eventTitle) {
      db.get('SELECT eventColor FROM users WHERE username = ?', [user], (err, row) => {
        const eventColor = row?.eventColor || '#3b82f6';
        db.run(`INSERT INTO calendar_events (user, title, date, isTransaction, type, amount, eventColor) VALUES (?, ?, ?, ?, ?, ?, ?)`, [user, eventTitle, date, 1, type, amount, eventColor], function (err) {
          if (err) {
            db.run('DELETE FROM transactions WHERE id = ?', transactionId);
            return res.json({ success: false });
          }
          res.json({ id: transactionId, user, description, amount, type, date, color, eventId: this.lastID });
        });
      });
    } else {
      res.json({ id: transactionId, user, description, amount, type, date, color });
    }
  });
});

app.delete('/api/transactions/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.get('SELECT user, type, amount, date FROM transactions WHERE id = ?', id, (err, transaction) => {
    if (transaction) {
      db.run('DELETE FROM calendar_events WHERE user = ? AND type = ? AND amount = ? AND date = ? AND isTransaction = 1', [transaction.user, transaction.type, transaction.amount, transaction.date]);
    }
    db.run('DELETE FROM transactions WHERE id = ?', id, (err) => {
      res.json({ success: !err });
    });
  });
});

app.get('/api/calendar', async (req, res) => {
  const { user: viewer } = req.query;
  try {
    const accessibleUsers = await getAccessibleUsers(viewer);
    db.all(`SELECT * FROM calendar_events WHERE user IN (${accessibleUsers.map(() => '?').join(',')})`, accessibleUsers, (err, rows) => {
      res.json(rows || []);
    });
  } catch (error) {
    res.json([]);
  }
});

app.post('/api/calendar', (req, res) => {
  const { user, title, date, transaction, type, amount, eventColor, description } = req.body;
  db.run(`INSERT INTO calendar_events (user, title, date, isTransaction, type, amount, eventColor) VALUES (?, ?, ?, ?, ?, ?, ?)`, [user, title, date, transaction ? 1 : 0, type, amount, eventColor], function (err) {
    if (err) return res.json({ success: false });
    const eventId = this.lastID;
    if (transaction && description && amount && type) {
      const color = type.toLowerCase() === 'income' ? '#00FF00' : '#FF0000';
      db.run(`INSERT INTO transactions (user, description, amount, type, date, color) VALUES (?, ?, ?, ?, ?, ?)`, [user, description, amount, type, date, color], function (err) {
        if (err) {
          db.run('DELETE FROM calendar_events WHERE id = ?', eventId);
          return res.json({ success: false });
        }
        res.json({ id: eventId, user, title, date, isTransaction: transaction, type, amount, eventColor, transactionId: this.lastID });
      });
    } else {
      res.json({ id: eventId, user, title, date, isTransaction: transaction, type, amount, eventColor });
    }
  });
});

app.delete('/api/calendar/:id', (req, res) => {
  const id = parseInt(req.params.id);
  db.get('SELECT isTransaction, type, amount, date, user FROM calendar_events WHERE id = ?', id, (err, event) => {
    if (event && event.isTransaction) {
      db.run('DELETE FROM transactions WHERE user = ? AND type = ? AND amount = ? AND date = ?', [event.user, event.type, event.amount, event.date]);
    }
    db.run('DELETE FROM calendar_events WHERE id = ?', id, (err) => {
      res.json({ success: !err });
    });
  });
});

app.get('/api/users', requireAdmin, async (req, res) => {
  const users = await readUsers();
  res.json(Object.keys(users).map(username => ({ username })));
});

app.get('/api/get-access', (req, res) => {
  const { viewer } = req.query;
  db.all('SELECT * FROM user_access WHERE viewer = ?', [viewer], (err, rows) => {
    res.json({ success: !err, accessList: rows || [] });
  });
});

app.post('/api/grant-access', async (req, res) => {
  const { viewer, target } = req.body;
  if (!viewer || !target) return res.json({ success: false, message: 'Viewer and target required.' });
  const users = await readUsers();
  if (!users[viewer] || !users[target]) return res.json({ success: false, message: 'Invalid user.' });
  db.run('INSERT INTO user_access (viewer, target) VALUES (?, ?)', [viewer, target], (err) => {
    res.json({ success: !err });
  });
});

app.post('/api/revoke-access', (req, res) => {
  const { viewer, target } = req.body;
  db.run('DELETE FROM user_access WHERE viewer = ? AND target = ?', [viewer, target], (err) => {
    res.json({ success: !err });
  });
});

http.createServer(app).listen(HTTP_PORT, () => console.log(`HTTP Server on port ${HTTP_PORT}`));
try {
  https.createServer({
    key: fs.readFileSync('/etc/letsencrypt/live/ourlife.work.gd/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/ourlife.work.gd/fullchain.pem')
  }, app).listen(HTTPS_PORT, () => console.log(`HTTPS Server on port ${HTTPS_PORT}`));
} catch (error) {
  console.error('HTTPS server failed to start. Falling back to HTTP only.');
}
