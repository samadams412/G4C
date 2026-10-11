"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(
        data.error === "invalid credentials"
          ? "That email or password doesn't match an account."
          : "Something went wrong. Try again."
      );
      return;
    }

    router.push(searchParams.get("next") || "/events");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 font-heading text-3xl font-bold text-ink">Log in</h1>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-3xl border-[3px] border-violet/30 bg-white p-6"
      >
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border-2 border-slate-200 px-3 py-2 focus:border-violet focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border-2 border-slate-200 px-3 py-2 focus:border-violet focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-full bg-violet px-4 py-2 font-heading font-bold text-white disabled:opacity-50"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Need an account?{" "}
        <Link href="/register" className="font-bold text-violet">
          Register
        </Link>
      </p>
    </div>
  );
}
