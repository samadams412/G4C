import express from "express";
import mysql from "mysql2/promise";

const PORT = Number(process.env.PORT ?? 4000);

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "db",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  connectionLimit: 5,
});

const app = express();

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "unreachable" });
  }
});

app.listen(PORT, () => {
  console.log(`eventify-api listening on port ${PORT}`);
});
