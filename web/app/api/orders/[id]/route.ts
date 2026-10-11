import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const token = cookies().get("session")?.value;
  if (!token) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const apiRes = await fetch(`${process.env.API_URL}/orders/${params.id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const data = await apiRes.json().catch(() => ({}));

  return NextResponse.json(data, { status: apiRes.status });
}
