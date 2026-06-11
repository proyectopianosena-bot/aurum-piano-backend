require("dotenv").config();
const { Pool } = require("pg");

// Guardamos la URL de producción de Render
const connectionString = process.env.DATABASE_URL;

let pool;

if (connectionString) {
  // SI ESTÁ EN RENDER: Se conecta obligatoriamente a la nueva base de datos usando SSL
  pool = new Pool({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false, // Requerido por Render para conexiones seguras
    },
  });
  console.log("🔌 Conexión de base de datos inicializada: Usando base de datos interna de Render.");
} else {
  // SI ESTÁ EN TU COMPUTADORA (LOCAL): Usa las variables del archivo .env
  pool = new Pool({
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "aurum_piano_db",
    password: process.env.DB_PASSWORD || "1234",
    port: Number(process.env.DB_PORT) || 5432,
  });
  console.log("💻 Conexión de base de datos inicializada: Modo Local (localhost).");
}

// Manejo de errores globales de la conexión por si se cae el servidor
pool.on("error", (err) => {
  console.error("❌ Error inesperado en el pool de conexiones de PostgreSQL:", err.message);
});

module.exports = pool;