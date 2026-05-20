const express = require("express");
const pool = require("../config/db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(authRequired, requireRole("admin"));

router.get("/alumnos", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, email, role, created_at FROM users WHERE role = 'alumno' ORDER BY created_at DESC`
    );
    res.json({ ok: true, alumnos: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Error al cargar alumnos." });
  }
});

router.get("/contactos", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM contactos ORDER BY created_at DESC LIMIT 100`);
    res.json({ ok: true, contactos: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Error al cargar contactos." });
  }
});

router.patch("/contactos/:id/leido", async (req, res) => {
  try {
    await pool.query(`UPDATE contactos SET leido = TRUE WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Error al actualizar." });
  }
});

router.get("/reservas", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.estado, r.created_at,
        u.nombre AS alumno, u.email,
        c.titulo, c.fecha, c.maestro
       FROM reservas r
       JOIN users u ON u.id = r.user_id
       JOIN clases c ON c.id = r.clase_id
       WHERE r.estado != 'cancelada'
       ORDER BY c.fecha ASC`
    );
    res.json({ ok: true, reservas: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Error al cargar reservas." });
  }
});

module.exports = router;
