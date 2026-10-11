export default function EventsLoading() {
  return (
    <main className="min-h-screen bg-cream px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 h-10 w-64 animate-pulse rounded-full bg-violet/20" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-3xl border-[3px] border-violet/10 bg-white" />
          ))}
        </div>
      </div>
    </main>
  );
}
