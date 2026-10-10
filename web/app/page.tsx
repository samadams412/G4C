async function getHealth() {
  try {
    const res = await fetch(`${process.env.API_URL}/health`, { cache: "no-store" });
    return await res.json();
  } catch (err) {
    return { status: "error", db: "unreachable" };
  }
}

export default async function Home() {
  const health = await getHealth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
      <h1 className="text-2xl font-semibold">Eventify</h1>
      <pre className="rounded bg-slate-900 p-4 text-sm">
        {JSON.stringify(health, null, 2)}
      </pre>
    </main>
  );
}
