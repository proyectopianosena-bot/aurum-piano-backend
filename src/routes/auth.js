const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { authRequired } = require("../middleware/auth");
const { sendVerificationEmail, isConfigured } = require("../services/email");
const { generateCode, saveCode, verifyCode, CODE_TTL_MINUTES } = require("../services/authCodes");

const router = express.Router();
const JWT_SECRET = () => process.env.JWT_SECRET || "aurum_dev_secret";

const sendCooldown = new Map();
const COOLDOWN_MS = 60 * 1000;

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function canSend(email) {
  const last = sendCooldown.get(email);
  if (last && Date.now() - last < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
    return { ok: false, error: `Espera ${wait}s antes de solicitar otro código.` };
  }
  return { ok: true };
}

function markSent(email) {
  sendCooldown.set(email, Date.now());
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, nombre: user.nombre },
    JWT_SECRET(),
    { expiresIn: "7d" }
  );
}

router.post("/register/send-code", async (req, res) => {
  const { nombre, email, password } = req.body;
  const normalized = normalizeEmail(email || "");

  if (!nombre?.trim() || !normalized || !password) {
    return res.status(400).json({ ok: false, error: "Completa todos los campos." });
  }
  if (!isValidEmail(normalized)) {
    return res.status(400).json({ ok: false, error: "Email no válido." });
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: "La contraseña debe tener al menos 6 caracteres." });
  }

  const cooldown = canSend(`register:${normalized}`);
  if (!cooldown.ok) return res.status(429).json({ ok: false, error: cooldown.error });

  try {
    const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [normalized]);
    if (existing.rows[0]) {
      return res.status(409).json({ ok: false, error: "Este email ya está registrado." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const code = generateCode();
    await saveCode(normalized, "register", code, {
      nombre: nombre.trim(),
      password_hash: passwordHash,
    });

    const mail = await sendVerificationEmail(normalized, code, "register");
    markSent(`register:${normalized}`);

    res.json({
      ok: true,
      message: "Código enviado a tu correo.",
      expiresInMinutes: CODE_TTL_MINUTES,
      emailConfigured: isConfigured(),
      ...(mail.dev && { devNote: "Sin SMTP: revisa la terminal del backend para ver el código." }),
    });
  } catch (err) {
    console.error("send-code register:", err.message);
    if (err.code === "42P01") {
      return res.status(503).json({ ok: false, error: "Ejecuta sql/auth_upgrade.sql en PostgreSQL." });
    }
    res.status(500).json({ ok: false, error: "No se pudo enviar el código." });
  }
});

router.post("/register/verify", async (req, res) => {
  const { email, code } = req.body;
  const normalized = normalizeEmail(email || "");

  if (!normalized || !code) {
    return res.status(400).json({ ok: false, error: "Email y código requeridos." });
  }

  try {
    const verified = await verifyCode(normalized, "register", String(code).trim());
    if (!verified.ok) {
      return res.status(400).json({ ok: false, error: verified.error });
    }

    const { nombre, password_hash } = verified.payload;
    const result = await pool.query(
      `INSERT INTO users (nombre, email, password_hash, role, email_verified)
       VALUES ($1, $2, $3, 'alumno', TRUE)
       RETURNING id, nombre, email, role, created_at`,
      [nombre, normalized, password_hash]
    );
    const user = result.rows[0];
    const token = signToken(user);
    res.status(201).json({ ok: true, token, user });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ ok: false, error: "Este email ya está registrado." });
    }
    console.error("register verify:", err.message);
    res.status(500).json({ ok: false, error: "No se pudo completar el registro." });
  }
});

router.post("/forgot-password", async (req, res) => {
  const normalized = normalizeEmail(req.body.email || "");

  if (!normalized || !isValidEmail(normalized)) {
    return res.status(400).json({ ok: false, error: "Email no válido." });
  }

  const cooldown = canSend(`reset:${normalized}`);
  if (!cooldown.ok) return res.status(429).json({ ok: false, error: cooldown.error });

  try {
    const user = await pool.query(`SELECT id FROM users WHERE email = $1`, [normalized]);
    if (!user.rows[0]) {
      return res.json({
        ok: true,
        message: "Si el email existe, recibirás un código en breve.",
      });
    }

    const code = generateCode();
    await saveCode(normalized, "reset", code, null);
    const mail = await sendVerificationEmail(normalized, code, "reset");
    markSent(`reset:${normalized}`);

    res.json({
      ok: true,
      message: "Si el email existe, recibirás un código en breve.",
      expiresInMinutes: CODE_TTL_MINUTES,
      ...(mail.dev && { devNote: "Sin SMTP: revisa la terminal del backend." }),
    });
  } catch (err) {
    console.error("forgot-password:", err.message);
    res.status(500).json({ ok: false, error: "No se pudo procesar la solicitud." });
  }
});

router.post("/reset-password", async (req, res) => {
  const { email, code, password } = req.body;
  const normalized = normalizeEmail(email || "");

  if (!normalized || !code || !password) {
    return res.status(400).json({ ok: false, error: "Completa todos los campos." });
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: "La contraseña debe tener al menos 6 caracteres." });
  }

  try {
    const verified = await verifyCode(normalized, "reset", String(code).trim());
    if (!verified.ok) {
      return res.status(400).json({ ok: false, error: verified.error });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, nombre, email, role`,
      [hash, normalized]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ ok: false, error: "Usuario no encontrado." });
    }

    res.json({ ok: true, message: "Contraseña actualizada. Ya puedes iniciar sesión." });
  } catch (err) {
    console.error("reset-password:", err.message);
    res.status(500).json({ ok: false, error: "No se pudo actualizar la contraseña." });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const normalized = normalizeEmail(email || "");

  if (!normalized || !password) {
    return res.status(400).json({ ok: false, error: "Email y contraseña requeridos." });
  }

  try {
    const result = await pool.query(
      `SELECT id, nombre, email, password_hash, role FROM users WHERE email = $1`,
      [normalized]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ ok: false, error: "Credenciales incorrectas." });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ ok: false, error: "Credenciales incorrectas." });
    }

    const token = signToken(user);
    const { password_hash, ...safeUser } = user;
    res.json({ ok: true, token, user: safeUser });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ ok: false, error: "Error al iniciar sesión." });
  }
});

router.get("/me", authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, email, role, created_at FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ ok: false, error: "Usuario no encontrado." });
    }
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    console.error("Me error:", err.message);
    res.status(500).json({ ok: false, error: "Error al obtener perfil." });
  }
});

module.exports = router;

router.post("/avatar", authRequired, async (req, res) => {
  const { avatar } = req.body;
  if (!avatar || !avatar.startsWith("data:image/")) {
    return res.status(400).json({ ok: false, error: "Imagen no válida." });
  }
  if (avatar.length > 2 * 1024 * 1024 * 1.37) {
    return res.status(400).json({ ok: false, error: "La imagen es demasiado grande (máx 2MB)." });
  }
  try {
    await pool.query(`UPDATE users SET avatar = $1 WHERE id = $2`, [avatar, req.user.id]);
    res.json({ ok: true, avatar });
  } catch (err) {
    console.error("Avatar:", err.message);
    res.status(500).json({ ok: false, error: "No se pudo guardar la foto." });
  }
});
