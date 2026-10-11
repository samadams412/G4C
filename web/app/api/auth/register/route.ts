import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { first_name, last_name, email, password } = body ?? {};
  if (
    typeof first_name !== "string" ||
    typeof last_name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return NextResponse.json({ error: "all fields are required" }, { status: 400 });
  }

  const apiRes = await fetch(`${process.env.API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ first_name, last_name, email, password }),
  });
  const data = await apiRes.json().catch(() => ({}));

  if (!apiRes.ok) {
    return NextResponse.json({ error: data.error ?? "registration failed" }, { status: apiRes.status });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("session", data.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  return response;
}
