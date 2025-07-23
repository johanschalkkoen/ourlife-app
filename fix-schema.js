const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./prd-ourlife.db', (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database: prd-ourlife.db');
});

db.serialize(() => {
  // Check if gender column exists
  db.get("PRAGMA table_info(users)", (err, rows) => {
    if (err) {
      console.error('Error checking table schema:', err.message);
      db.close();
      process.exit(1);
    }

    const hasGender = rows.some(row => row.name === 'gender');
    if (!hasGender) {
      console.log('Adding gender column to users table...');
      db.run(`ALTER TABLE users ADD COLUMN gender TEXT DEFAULT ''`, (err) => {
        if (err) {
          console.error('Error adding gender column:', err.message);
          db.close();
          process.exit(1);
        }
        console.log('Gender column added successfully');
        db.close();
      });
    } else {
      console.log('Gender column already exists');
      db.close();
    }
  });
});

process.on('SIGTERM', () => {
  console.log('Closing database...');
  db.close((err) => {
    if (err) console.error('Error closing database:', err.message);
    process.exit(0);
  });
});
