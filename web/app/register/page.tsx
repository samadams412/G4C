"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(
        data.error === "an account with this email already exists"
          ? "That email is already registered."
          : data.error === "password must be at least 8 characters"
          ? "Password needs to be at least 8 characters."
          : "Something went wrong. Try again."
      );
      return;
    }

    router.push("/events");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 font-heading text-headline-large text-on-background">Create an account</h1>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-radius-md bg-surface-container p-6"
        >
          {error && <p className="rounded-radius-sm bg-error-container px-3 py-2 text-body-medium text-on-error-container">{error}</p>}
          <div className="flex gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-label-large text-on-surface">
              First name
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="rounded-radius-sm border-2 border-outline bg-surface-container-lowest px-3 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-label-large text-on-surface">
              Last name
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="rounded-radius-sm border-2 border-outline bg-surface-container-lowest px-3 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </div>
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
              minLength={8}
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
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-body-medium text-on-surface-variant">
          Already have an account?{" "}
          <Link href="/login" className="text-label-large text-primary">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
