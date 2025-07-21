// generate_password.js
const bcrypt = require('bcrypt');
bcrypt.hash('qwe', 10, (err, hash) => {
  if (err) console.error('Error hashing password:', err);
  console.log('Hashed password:', hash);
});
