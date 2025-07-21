// reset_users.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'ourlife.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to ourlife.db');
});

const setupAdmin = async () => {
  const hashedPassword = await bcrypt.hash('qwe', 10);
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT NOT NULL, isAdmin INTEGER DEFAULT 0)`);
    db.run(`INSERT OR REPLACE INTO users (username, password, isAdmin) VALUES (?, ?, 1)`, ['schalk', hashedPassword], (err) =>P0+r\P0+r\ {
      if (err) {
        console.error('Error setting admin:', err.message);
        process.exit(1);
      }
      console.log('Admin user "schalk" created or
