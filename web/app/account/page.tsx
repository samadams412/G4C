import { getSessionUser } from "@/lib/session";

export default async function AccountPage() {
  const user = await getSessionUser();

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 font-heading text-headline-large text-on-background">
          Hi, {user?.first_name ?? "there"}
        </h1>
        <p className="rounded-radius-md bg-surface-container-low p-6 text-body-medium text-on-surface-variant">
          Your bookings will show up here once the booking flow ships.
        </p>
      </div>
    </main>
  );
}
