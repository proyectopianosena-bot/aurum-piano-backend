require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("../src/config/db");

async function init() {
  const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  try {
    await pool.query(sql);
    console.log("✓ Tablas creadas en aurum_piano_db");
  } catch (err) {
    console.error("Error al inicializar la base de datos:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

init();
