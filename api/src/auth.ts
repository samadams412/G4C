import { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Pool } from "mysql2/promise";

const JWT_SECRET: string =
  process.env.JWT_SECRET ??
  (() => {
    throw new Error("JWT_SECRET is required");
  })();

export interface AuthPayload {
  user_id: number;
  role: string;
  first_name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function loginHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "email and password are required" });
    }

    const [rows] = await pool.query(
      "SELECT user_id, first_name, role, password_hash FROM user WHERE email = ?",
      [email]
    );
    const user = (rows as { user_id: number; first_name: string; role: string; password_hash: string | null }[])[0];
    if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const token = jwt.sign(
      { user_id: user.user_id, role: user.role, first_name: user.first_name },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.status(200).json({ token });
  };
}

export function registerHandler(pool: Pool) {
  return async (req: Request, res: Response) => {
    const { first_name, last_name, email, password } = req.body ?? {};

    if (typeof first_name !== "string" || !first_name.trim()) {
      return res.status(400).json({ error: "first_name is required" });
    }
    if (typeof last_name !== "string" || !last_name.trim()) {
      return res.status(400).json({ error: "last_name is required" });
    }
    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "email is required" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "password must be at least 8 characters" });
    }

    try {
      const password_hash = await bcrypt.hash(password, 10);
      const [result] = await pool.query(
        "INSERT INTO user (first_name, last_name, email, role, status, password_hash) VALUES (?, ?, ?, 'Attendee', 'Active', ?)",
        [first_name, last_name, email, password_hash]
      );
      const insertId = (result as { insertId: number }).insertId;

      const token = jwt.sign(
        { user_id: insertId, role: "Attendee", first_name },
        JWT_SECRET,
        { expiresIn: "1h" }
      );
      res.status(201).json({ token });
    } catch (err: any) {
      if (err?.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ error: "an account with this email already exists" });
      }
      console.error(err);
      res.status(500).json({ error: "internal error" });
    }
  };
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    return res.status(401).json({ error: "missing token" });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET) as unknown as AuthPayload;
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  authenticate(req, res, () => {
    if (req.user?.role !== "Admin") {
      return res.status(403).json({ error: "admin access required" });
    }
    next();
  });
}
