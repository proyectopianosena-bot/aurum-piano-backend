require("dotenv").config();
const { Pool } = require("pg");

const isProduction = process.env.DATABASE_URL;

const pool = new Pool(
  isProduction
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {
        user: process.env.DB_USER || "postgres",
        host: process.env.DB_HOST || "localhost",
        database: process.env.DB_NAME || "aurum_piano_db",
        password: process.env.DB_PASSWORD || "1234",
        port: Number(process.env.DB_PORT) || 5432,
      }
);

module.exports = pool;