import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const token = cookies().get("session")?.value;
  if (!token) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Number.isInteger(body.event_id) || !Number.isInteger(body.quantity)) {
    return NextResponse.json({ error: "event_id and quantity are required" }, { status: 400 });
  }

  const apiRes = await fetch(`${process.env.API_URL}/tickets/purchase`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ event_id: body.event_id, quantity: body.quantity }),
  });
  const data = await apiRes.json().catch(() => ({}));

  return NextResponse.json(data, { status: apiRes.status });
}
