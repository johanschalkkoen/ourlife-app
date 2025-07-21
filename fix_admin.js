// fix_admin.js
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
  try {
    // Create table with correct schema if it doesn't exist
    await new Promise((resolve, reject) => {
      db.run(
        `CREATE TABLE IF NOT EXISTS users (
          username TEXT PRIMARY KEY,
          password TEXT NOT NULL,
          isAdmin INTEGER DEFAULT 0
        )`,
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Hash password and insert admin user
    const hashedPassword = await bcrypt.hash('$2b$10$ZY/flghxEXU.usO6J87A6evAtOirTnBuj2rY.VVnU7yyUJDwVS13W', 10);
    db.run(
      `INSERT OR REPLACE INTO users (username, password, isAdmin) VALUES (?, ?, 1)`,
      ['schalk', hashedPassword],
      (err) => {
        if (err) {
          console.error('Error setting admin:', err.message);
          db.close();
          process.exit(1);
        }
        console.log('Admin user "schalk" created or updated.');
        db.close((err) => {
          if (err) console.error('Error closing database:', err.message);
          process.exit(0);
        });
      }
    );
  } catch (err) {
    console.error('Error in setupAdmin:', err.message);
    db.close();
    process.exit(1);
  }
};

setupAdmin();
