const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database('./ourlife.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
        process.exit(1);
    }
    console.log('Connected to the SQLite database.');
});

db.serialize(() => {
    db.all('SELECT username, password, passwordHash FROM users WHERE passwordHash IS NULL AND password != ""', [], async (err, rows) => {
        if (err) {
            console.error('Error fetching users:', err.message);
            process.exit(1);
        }
        if (rows.length === 0) {
            console.log('No users found with NULL passwordHash and non-empty password.');
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                }
                console.log('Database connection closed.');
                process.exit(0);
            });
            return;
        }
        for (const row of rows) {
            try {
                console.log(`Processing user: ${row.username}, password: "${row.password}"`);
                // Ensure password is a valid string
                if (typeof row.password !== 'string' || row.password.includes('"')) {
                    console.error(`Invalid password for ${row.username}: contains invalid characters or is not a string. Skipping.`);
                    continue;
                }
                const passwordHash = await bcrypt.hash(row.password, 10);
                console.log(`Generated hash for ${row.username}: ${passwordHash}`);
                db.run(
                    'UPDATE users SET passwordHash = ? WHERE username = ?',
                    [passwordHash, row.username],
                    (updateErr) => {
                        if (updateErr) {
                            console.error(`Error updating passwordHash for ${row.username}: ${updateErr.message}`);
                        } else {
                            console.log(`Updated passwordHash for ${row.username}`);
                        }
                    }
                );
            } catch (error) {
                console.error(`Error hashing password for ${row.username}: ${error.message}`);
            }
        }
        // Wait briefly to ensure all updates are processed before closing
        setTimeout(() => {
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                }
                console.log('Database connection closed.');
                process.exit(0);
            });
        }, 1000);
    });
});
