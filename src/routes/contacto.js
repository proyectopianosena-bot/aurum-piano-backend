const express = require("express");
const pool = require("../config/db");

const router = express.Router();

router.post("/", async (req, res) => {
  const { nombre, email, programa, nivel, mensaje } = req.body;

  if (!nombre?.trim() || !email?.trim() || !programa?.trim()) {
    return res.status(400).json({
      ok: false,
      error: "Nombre, email y programa son obligatorios.",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ ok: false, error: "Email no válido." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO contactos (nombre, email, programa, nivel, mensaje)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [
        nombre.trim(),
        email.trim().toLowerCase(),
        programa.trim(),
        nivel?.trim() || null,
        mensaje?.trim() || null,
      ]
    );

    res.status(201).json({
      ok: true,
      id: result.rows[0].id,
      created_at: result.rows[0].created_at,
    });
  } catch (err) {
    console.error("Error al guardar contacto:", err.message);
    if (err.code === "42P01") {
      return res.status(503).json({
        ok: false,
        error: "Base de datos sin tablas. Ejecuta: npm run db:init",
      });
    }
    res.status(500).json({ ok: false, error: "No se pudo guardar el mensaje." });
  }
});

module.exports = router;
