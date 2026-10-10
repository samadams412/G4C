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
      "SELECT user_id, role, password_hash FROM user WHERE email = ?",
      [email]
    );
    const user = (rows as { user_id: number; role: string; password_hash: string | null }[])[0];
    if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const token = jwt.sign({ user_id: user.user_id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.status(200).json({ token });
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
