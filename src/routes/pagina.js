const express = require("express");
const pool    = require("../config/db");
const path    = require("path");
const fs      = require("fs");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

// Carpeta donde se guardan los archivos del hero
const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Config pública ────────────────────────────────────────
router.get("/config", async (req, res) => {
  try {
    const result = await pool.query(`SELECT clave, valor FROM page_config`);
    const config = {};
    result.rows.forEach(r => { config[r.clave] = r.valor; });
    res.json({ ok: true, config });
  } catch {
    res.json({ ok: true, config: {} });
  }
});

// ── Guardar config de texto (títulos, etc) ────────────────
router.put("/config", authRequired, requireRole("admin"), async (req, res) => {
  const { clave, valor } = req.body;
  if (!clave) return res.status(400).json({ ok: false, error: "Clave requerida." });
  try {
    await pool.query(
      `INSERT INTO page_config (clave, valor) VALUES ($1, $2)
       ON CONFLICT (clave) DO UPDATE SET valor = $2, updated_at = NOW()`,
      [clave, valor]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Subir archivo del hero (video o imagen) ───────────────
router.post("/hero-media", authRequired, requireRole("admin"), async (req, res) => {
  const { nombre, tipo, datos } = req.body;
  // datos = base64 dataURL

  if (!datos || !nombre) {
    return res.status(400).json({ ok: false, error: "Archivo requerido." });
  }

  try {
    // Decodificar base64 y guardar en disco
    const base64Data = datos.replace(/^data:[^;]+;base64,/, "");
    const ext        = path.extname(nombre).toLowerCase() || (tipo === "video" ? ".mp4" : ".jpg");
    const filename   = `hero_${Date.now()}${ext}`;
    const filepath   = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filepath, Buffer.from(base64Data, "base64"));

    // Borrar archivo anterior del hero si existe
    try {
      const old = await pool.query(`SELECT valor FROM page_config WHERE clave = 'hero_media_src'`);
      if (old.rows[0]) {
        const oldPath = old.rows[0].valor;
        if (oldPath.startsWith("/uploads/")) {
          const fullOld = path.join(__dirname, "../../", oldPath);
          if (fs.existsSync(fullOld)) fs.unlinkSync(fullOld);
        }
      }
    } catch {}

    const urlPath = `/uploads/${filename}`;
    const tipoMedia = tipo === "imagen" ? "imagen" : "video";

    // Guardar en config
    await pool.query(
      `INSERT INTO page_config (clave, valor) VALUES ('hero_media_src', $1)
       ON CONFLICT (clave) DO UPDATE SET valor = $1, updated_at = NOW()`,
      [urlPath]
    );
    await pool.query(
      `INSERT INTO page_config (clave, valor) VALUES ('hero_media_tipo', $1)
       ON CONFLICT (clave) DO UPDATE SET valor = $1, updated_at = NOW()`,
      [tipoMedia]
    );

    res.json({ ok: true, url: urlPath, tipo: tipoMedia });
  } catch (err) {
    console.error("Hero upload:", err.message);
    res.status(500).json({ ok: false, error: "No se pudo guardar el archivo." });
  }
});

// ── Maestros públicos ─────────────────────────────────────
router.get("/maestros", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM maestros WHERE activo = TRUE ORDER BY orden ASC`);
    res.json({ ok: true, maestros: result.rows });
  } catch { res.json({ ok: true, maestros: [] }); }
});

router.get("/maestros/todos", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM maestros ORDER BY orden ASC`);
    res.json({ ok: true, maestros: result.rows });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.post("/maestros", authRequired, requireRole("admin"), async (req, res) => {
  const { nombre, rol, origen, foto, activo, orden } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ ok: false, error: "Nombre requerido." });
  try {
    const result = await pool.query(
      `INSERT INTO maestros (nombre, rol, origen, foto, activo, orden) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [nombre.trim(), rol||"", origen||"", foto||null, activo !== false, orden||0]
    );
    res.status(201).json({ ok: true, maestro: result.rows[0] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.put("/maestros/:id", authRequired, requireRole("admin"), async (req, res) => {
  const { nombre, rol, origen, foto, activo, orden } = req.body;
  try {
    const result = await pool.query(
      `UPDATE maestros SET nombre=$1, rol=$2, origen=$3, foto=$4, activo=$5, orden=$6 WHERE id=$7 RETURNING *`,
      [nombre, rol, origen, foto||null, activo, orden||0, req.params.id]
    );
    res.json({ ok: true, maestro: result.rows[0] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.delete("/maestros/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    await pool.query(`DELETE FROM maestros WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;
