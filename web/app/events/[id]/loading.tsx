export default function EventDetailLoading() {
  return (
    <main className="min-h-screen bg-cream px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 h-10 w-40 animate-pulse rounded-full bg-violet/20" />
        <div className="mb-6 h-10 w-3/4 animate-pulse rounded-full bg-violet/20" />
        <div className="mb-6 h-24 animate-pulse rounded-3xl border-[3px] border-violet/10 bg-white" />
        <div className="h-32 animate-pulse rounded-3xl border-[3px] border-violet/10 bg-white" />
      </div>
    </main>
  );
}
