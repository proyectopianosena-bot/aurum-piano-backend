const express = require("express");
const pool = require("../config/db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET todas las clases (con cupos disponibles)
router.get("/", authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
        (c.cupos - COALESCE(COUNT(r.id), 0))::int AS cupos_disponibles
       FROM clases c
       LEFT JOIN reservas r ON r.clase_id = c.id AND r.estado != 'cancelada'
       WHERE c.fecha > NOW() - INTERVAL '1 day'
       GROUP BY c.id
       ORDER BY c.fecha ASC`
    );
    res.json({ ok: true, clases: result.rows });
  } catch (err) {
    console.error("List clases:", err.message);
    res.status(500).json({ ok: false, error: "No se pudieron cargar las clases." });
  }
});

// POST crear clase (con archivos adjuntos opcionales)
router.post("/", authRequired, requireRole("admin"), async (req, res) => {
  const { titulo, descripcion, maestro, programa, fecha, duracion_min, cupos, archivos } = req.body;
  if (!titulo?.trim() || !fecha) {
    return res.status(400).json({ ok: false, error: "Título y fecha son obligatorios." });
  }
  // archivos: array de { nombre, tipo, datos (base64) }
  const archivosJson = archivos && archivos.length > 0 ? JSON.stringify(archivos) : null;

  try {
    const result = await pool.query(
      `INSERT INTO clases (titulo, descripcion, maestro, programa, fecha, duracion_min, cupos, archivos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        titulo.trim(),
        descripcion?.trim() || null,
        maestro?.trim() || null,
        programa?.trim() || null,
        fecha,
        duracion_min || 60,
        cupos || 1,
        archivosJson,
      ]
    );
    res.status(201).json({ ok: true, clase: result.rows[0] });
  } catch (err) {
    console.error("Create clase:", err.message);
    res.status(500).json({ ok: false, error: "No se pudo crear la clase." });
  }
});

// DELETE eliminar clase
router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    await pool.query(`DELETE FROM clases WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete clase:", err.message);
    res.status(500).json({ ok: false, error: "No se pudo eliminar." });
  }
});

module.exports = router;
