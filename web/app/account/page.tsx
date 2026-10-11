import { getSessionUser } from "@/lib/session";

export default async function AccountPage() {
  const user = await getSessionUser();

  return (
    <main className="min-h-screen bg-cream px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 font-heading text-3xl font-bold text-ink">
          Hi, {user?.first_name ?? "there"}
        </h1>
        <p className="rounded-3xl border-[3px] border-teal/30 bg-white p-6 text-sm text-slate-600">
          Your bookings will show up here once the booking flow ships.
        </p>
      </div>
    </main>
  );
}
