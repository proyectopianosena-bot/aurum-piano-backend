const bcrypt = require("bcrypt");
const pool = require("../config/db");

const CODE_TTL_MINUTES = 15;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function saveCode(email, purpose, code, payload = null) {
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await pool.query(
    `DELETE FROM auth_codes WHERE email = $1 AND purpose = $2`,
    [email, purpose]
  );

  await pool.query(
    `INSERT INTO auth_codes (email, code_hash, purpose, payload, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [email, codeHash, purpose, payload ? JSON.stringify(payload) : null, expiresAt]
  );

  return { expiresAt };
}

async function verifyCode(email, purpose, code) {
  const result = await pool.query(
    `SELECT * FROM auth_codes
     WHERE email = $1 AND purpose = $2 AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [email, purpose]
  );

  const row = result.rows[0];
  if (!row) return { ok: false, error: "Código expirado o inválido. Solicita uno nuevo." };

  const match = await bcrypt.compare(code, row.code_hash);
  if (!match) return { ok: false, error: "Código incorrecto." };

  await pool.query(`DELETE FROM auth_codes WHERE id = $1`, [row.id]);
  let payload = row.payload;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      payload = null;
    }
  }
  return { ok: true, payload };
}

module.exports = { generateCode, saveCode, verifyCode, CODE_TTL_MINUTES };
