export default function EventDetailLoading() {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 h-10 w-40 animate-pulse rounded-radius-full bg-surface-container" />
        <div className="mb-6 h-10 w-3/4 animate-pulse rounded-radius-full bg-surface-container" />
        <div className="mb-6 h-24 animate-pulse rounded-radius-md bg-surface-container" />
        <div className="h-32 animate-pulse rounded-radius-lg bg-surface-container-high" />
      </div>
    </main>
  );
}
