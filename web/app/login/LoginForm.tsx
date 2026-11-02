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
      <h1 className="mb-6 font-heading text-headline-large text-on-background">Log in</h1>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-radius-md bg-surface-container p-6"
      >
        {error && <p className="rounded-radius-sm bg-error-container px-3 py-2 text-body-medium text-on-error-container">{error}</p>}
        <label className="flex flex-col gap-1 text-label-large text-on-surface">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-radius-sm border-2 border-outline bg-surface-container-lowest px-3 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-label-large text-on-surface">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-radius-sm border-2 border-outline bg-surface-container-lowest px-3 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-radius-sm bg-primary px-4 py-2 text-label-large text-on-primary disabled:opacity-50"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-body-medium text-on-surface-variant">
        Need an account?{" "}
        <Link href="/register" className="text-label-large text-primary">
          Register
        </Link>
      </p>
    </div>
  );
}
