require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../src/config/db');

bcrypt.hash('holamundoERROR405', 10).then(hash => {
  pool.query(
    'UPDATE users SET password_hash = $1 WHERE email = $2',
    [hash, 'proyectopianosena@gmail.com']
  ).then(() => {
    console.log('✅ Contraseña actualizada');
    process.exit();
  }).catch(err => {
    console.error(err.message);
    process.exit(1);
  });
});