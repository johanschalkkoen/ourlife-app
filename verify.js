const bcrypt = require('bcrypt');
const hash = '$2b$10$VJXYevjYjr/SuVzBnHySV.rGc5UpLadDSw3rvhvv8cHTy/j7g8ugS';
bcrypt.compare('.Sh@d0w.Sh13ld.', hash, (err, result) => {
  console.log(result ? 'Password matches' : 'Password does not match');
});
