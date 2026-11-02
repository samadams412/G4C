export default function EventsLoading() {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 h-10 w-64 animate-pulse rounded-radius-full bg-surface-container" />
        <div className="grid grid-cols-1 gap-space-16 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-radius-md bg-surface-container" />
          ))}
        </div>
      </div>
    </main>
  );
}
