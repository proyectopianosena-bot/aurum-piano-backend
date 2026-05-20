const express = require("express");
const pool = require("../config/db");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/mias", authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.estado, r.created_at,
        c.id AS clase_id, c.titulo, c.maestro, c.programa, c.fecha, c.duracion_min
       FROM reservas r
       JOIN clases c ON c.id = r.clase_id
       WHERE r.user_id = $1 AND r.estado != 'cancelada'
       ORDER BY c.fecha ASC`,
      [req.user.id]
    );
    res.json({ ok: true, reservas: result.rows });
  } catch (err) {
    console.error("Mis reservas:", err.message);
    res.status(500).json({ ok: false, error: "No se pudieron cargar tus reservas." });
  }
});

router.post("/", authRequired, requireRole("alumno", "admin"), async (req, res) => {
  const { clase_id } = req.body;
  if (!clase_id) {
    return res.status(400).json({ ok: false, error: "clase_id requerido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const clase = await client.query(
      `SELECT c.*,
        (c.cupos - COALESCE(COUNT(r.id), 0))::int AS cupos_disponibles
       FROM clases c
       LEFT JOIN reservas r ON r.clase_id = c.id AND r.estado != 'cancelada'
       WHERE c.id = $1
       GROUP BY c.id`,
      [clase_id]
    );

    if (!clase.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ ok: false, error: "Clase no encontrada." });
    }
    if (clase.rows[0].cupos_disponibles < 1) {
      await client.query("ROLLBACK");
      return res.status(409).json({ ok: false, error: "No hay cupos disponibles." });
    }

    const result = await client.query(
      `INSERT INTO reservas (user_id, clase_id, estado)
       VALUES ($1, $2, 'confirmada')
       RETURNING *`,
      [req.user.id, clase_id]
    );

    await client.query("COMMIT");
    res.status(201).json({ ok: true, reserva: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return res.status(409).json({ ok: false, error: "Ya tienes reserva en esta clase." });
    }
    console.error("Reservar:", err.message);
    res.status(500).json({ ok: false, error: "No se pudo reservar." });
  } finally {
    client.release();
  }
});

router.delete("/:id", authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE reservas SET estado = 'cancelada'
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ ok: false, error: "Reserva no encontrada." });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Cancelar reserva:", err.message);
    res.status(500).json({ ok: false, error: "No se pudo cancelar." });
  }
});

module.exports = router;
