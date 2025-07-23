// Run in a temporary Node.js script (e.g., `create-user.js`)
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const db = new sqlite3.Database('./prd-ourlife.db');

const username = 'testuser';
const password = 'testpassword';
bcrypt.hash(password, 10, (err, hashedPassword) => {
  db.run('INSERT INTO users (username, password, isAdmin) VALUES (?, ?, ?)', [username, hashedPassword, 1], (err) => {
    if (err) console.error(err);
    else console.log('User created');
    db.close();
  });
});
