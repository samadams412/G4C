import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export interface SessionUser {
  user_id: number;
  role: string;
  first_name: string;
}

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is required");
  }
  return new TextEncoder().encode(secret);
}

// Verifies the token's signature and expiry against the same secret the API
// signs with. An invalid or expired token is treated as logged-out.
export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.user_id !== "number" ||
      typeof payload.role !== "string" ||
      typeof payload.first_name !== "string"
    ) {
      return null;
    }
    return { user_id: payload.user_id, role: payload.role, first_name: payload.first_name };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get("session")?.value;
  if (!token) return null;
  return verifySession(token);
}
