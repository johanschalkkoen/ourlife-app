const bcrypt = require('bcrypt');

const password = 'newSecurePassword123'; // Replace with the desired password
bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
        console.error('Error generating hash:', err.message);
        process.exit(1);
    }
    console.log('Generated hash:', hash);
    process.exit(0);
});
