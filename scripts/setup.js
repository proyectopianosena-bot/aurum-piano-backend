/**
 * AURUM PIANO ACADEMY — Setup inicial
 * Ejecutar UNA sola vez: node scripts/setup.js
 *
 * Hace todo automáticamente:
 *  1. Crea todas las tablas si no existen
 *  2. Registra el admin en la base de datos
 *  3. Verifica que el email funciona
 */

require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const pool = new Pool({
  user:     process.env.DB_USER     || "postgres",
  host:     process.env.DB_HOST     || "localhost",
  database: process.env.DB_NAME     || "aurum_piano_db",
  password: process.env.DB_PASSWORD || "1234",
  port:     parseInt(process.env.DB_PORT) || 5432,
});

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || "proyectopianosena@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "holamundoERROR404";
const ADMIN_NOMBRE   = process.env.ADMIN_NOMBRE   || "Aurum Admin";

async function run() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   AURUM PIANO ACADEMY — Setup inicial   ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const client = await pool.connect();

  try {
    // ── 1. Crear tablas ──────────────────────────────────
    console.log("📦  Creando tablas...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS contactos (
        id          SERIAL PRIMARY KEY,
        nombre      VARCHAR(255) NOT NULL,
        email       VARCHAR(255) NOT NULL,
        programa    VARCHAR(100),
        nivel       VARCHAR(80),
        mensaje     TEXT,
        leido       BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_contactos_created_at ON contactos (created_at DESC);
    `);
    console.log("   ✓ contactos");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        nombre        VARCHAR(255) NOT NULL,
        email         VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role          VARCHAR(20)  NOT NULL DEFAULT 'alumno'
                        CHECK (role IN ('alumno', 'admin')),
        email_verified BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
    `);
    console.log("   ✓ users");

    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_codes (
        id          SERIAL PRIMARY KEY,
        email       VARCHAR(255) NOT NULL,
        code_hash   VARCHAR(255) NOT NULL,
        purpose     VARCHAR(20)  NOT NULL CHECK (purpose IN ('register', 'reset')),
        payload     JSONB,
        expires_at  TIMESTAMPTZ  NOT NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_auth_codes_email_purpose ON auth_codes (email, purpose);
    `);
    console.log("   ✓ auth_codes");

    await client.query(`
      CREATE TABLE IF NOT EXISTS clases (
        id           SERIAL PRIMARY KEY,
        titulo       VARCHAR(255) NOT NULL,
        descripcion  TEXT,
        maestro      VARCHAR(255),
        programa     VARCHAR(100),
        fecha        TIMESTAMPTZ  NOT NULL,
        duracion_min INT          NOT NULL DEFAULT 60,
        cupos        INT          NOT NULL DEFAULT 1,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_clases_fecha ON clases (fecha ASC);
    `);
    console.log("   ✓ clases");

    await client.query(`
      CREATE TABLE IF NOT EXISTS reservas (
        id         SERIAL PRIMARY KEY,
        user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        clase_id   INT NOT NULL REFERENCES clases(id) ON DELETE CASCADE,
        estado     VARCHAR(20) NOT NULL DEFAULT 'confirmada'
                     CHECK (estado IN ('pendiente', 'confirmada', 'cancelada')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, clase_id)
      );
      CREATE INDEX IF NOT EXISTS idx_reservas_user ON reservas (user_id);
    `);
    console.log("   ✓ reservas");

    // ── 2. Crear admin ───────────────────────────────────
    console.log("\n👤  Configurando admin...");

    const exists = await client.query(
      `SELECT id, role FROM users WHERE email = $1`,
      [ADMIN_EMAIL]
    );

    if (exists.rows[0]) {
      // Ya existe — asegurar que sea admin
      await client.query(
        `UPDATE users SET role = 'admin', email_verified = TRUE WHERE email = $1`,
        [ADMIN_EMAIL]
      );
      console.log(`   ✓ Admin ya existía → rol confirmado: ${ADMIN_EMAIL}`);
    } else {
      // Crear admin nuevo
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await client.query(
        `INSERT INTO users (nombre, email, password_hash, role, email_verified)
         VALUES ($1, $2, $3, 'admin', TRUE)`,
        [ADMIN_NOMBRE, ADMIN_EMAIL, hash]
      );
      console.log(`   ✓ Admin creado: ${ADMIN_EMAIL}`);
    }

    // ── 3. Verificar SMTP ────────────────────────────────
    console.log("\n📧  Verificando configuración de email...");
    const smtpOk = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
    if (smtpOk) {
      console.log(`   ✓ SMTP configurado: ${process.env.SMTP_USER}`);

      // Test de conexión real
      try {
        const nodemailer = require("nodemailer");
        const t = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: Number(process.env.SMTP_PORT) || 587,
          secure: false,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        await t.verify();
        console.log("   ✓ Conexión SMTP verificada correctamente ✅");
      } catch (smtpErr) {
        console.log("   ⚠️  SMTP no responde:", smtpErr.message);
        console.log("      → Verifica que la contraseña de app de Gmail sea correcta.");
        console.log("      → La contraseña de app NO lleva espacios: zhojkyexnnealrpn");
      }
    } else {
      console.log("   ⚠️  Sin SMTP — modo desarrollo (códigos en terminal)");
    }

    // ── Resumen final ────────────────────────────────────
    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║          ✅  Setup completado            ║");
    console.log("╚══════════════════════════════════════════╝");
    console.log("\n📌  Datos del admin:");
    console.log(`    Email:    ${ADMIN_EMAIL}`);
    console.log(`    Password: ${ADMIN_PASSWORD}`);
    console.log("\n🚀  Inicia el servidor con: npm run dev\n");

  } catch (err) {
    console.error("\n❌  Error durante el setup:", err.message);
    if (err.code === "3D000") {
      console.error(`    → La base de datos '${process.env.DB_NAME}' no existe.`);
      console.error(`    → Créala en pgAdmin: CREATE DATABASE ${process.env.DB_NAME};`);
    }
    if (err.code === "ECONNREFUSED") {
      console.error("    → PostgreSQL no está corriendo.");
      console.error("    → Inícialo en pgAdmin o como servicio de Windows.");
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
