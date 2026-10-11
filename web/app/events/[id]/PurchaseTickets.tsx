"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import CheckoutForm from "./CheckoutForm";

type Step =
  | { name: "select" }
  | { name: "pay"; orderId: number; clientSecret: string; total: number; quantity: number }
  | { name: "pending"; orderId: number; total: number; quantity: number }
  | { name: "done"; total: number; quantity: number }
  | { name: "failed" };

const STRIPE_APPEARANCE = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#7C3AED", // violet
    colorBackground: "#FFF7ED", // cream
    colorText: "#1C1917", // ink
    colorDanger: "#DC2626",
    fontFamily: "var(--font-body), sans-serif",
    borderRadius: "12px",
  },
};

// Polls GET /api/orders/:id rather than trusting the client-side Stripe
// confirmation, since the ticket isn't actually Purchased until
// POST /webhooks/stripe lands and flips it — that can trail the browser's
// confirmPayment call by a beat.
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30_000;

export default function PurchaseTickets({
  eventId,
  remaining,
  pricePerTicket,
  isLoggedIn,
}: {
  eventId: number;
  remaining: number;
  pricePerTicket: number | null;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const maxQty = Math.min(8, remaining);
  const [quantity, setQuantity] = useState(1);
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ name: "select" });
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  if (step.name === "done") {
    return (
      <div className="mt-4 rounded-xl border-2 border-teal bg-teal-50 px-4 py-3 text-sm font-medium text-ink">
        {step.quantity} ticket{step.quantity === 1 ? "" : "s"} confirmed for ${step.total.toFixed(2)}.
      </div>
    );
  }

  if (step.name === "failed") {
    return (
      <div className="mt-4 flex flex-col gap-2">
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
          That payment didn&apos;t go through, so we released your spot. No charge was made. Try again when
          you&apos;re ready.
        </p>
        <button
          onClick={() => setStep({ name: "select" })}
          className="self-start rounded-full bg-violet px-4 py-2 font-heading font-bold text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  if (step.name === "pending") {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-xl border-2 border-amber bg-amber-50 px-4 py-3 text-sm font-medium text-ink">
        <span className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-amber border-t-transparent" />
        Confirming your payment now.
      </div>
    );
  }

  if (step.name === "pay") {
    return (
      <Elements
        stripe={getStripe()}
        options={{ clientSecret: step.clientSecret, appearance: STRIPE_APPEARANCE }}
      >
        <CheckoutForm
          total={step.total}
          onCancel={() => setStep({ name: "select" })}
          onSettled={() => {
            setStep({ name: "pending", orderId: step.orderId, total: step.total, quantity: step.quantity });
            pollOrder(step.orderId, step.total, step.quantity);
          }}
        />
      </Elements>
    );
  }

  if (remaining <= 0) {
    return <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600">Sold out</div>;
  }

  if (pricePerTicket === null) {
    return <p className="mt-4 text-sm text-slate-600">Ticket sales haven&apos;t opened for this event yet.</p>;
  }

  function pollOrder(orderId: number, total: number, quantity: number) {
    const startedAt = Date.now();
    pollTimer.current = setInterval(async () => {
      const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status === "Completed") {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setStep({ name: "done", total, quantity });
        router.refresh();
        return;
      }
      if (res.ok && data.status === "Refunded") {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setStep({ name: "failed" });
        router.refresh();
        return;
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setError("This is taking longer than expected. Check back shortly; your order may still complete.");
        setStep({ name: "select" });
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleReserve() {
    if (!isLoggedIn) {
      router.push(`/login?next=${encodeURIComponent(`/events/${eventId}`)}`);
      return;
    }
    setReserving(true);
    setError(null);

    const res = await fetch("/api/tickets/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId, quantity }),
    });
    const data = await res.json().catch(() => ({}));
    setReserving(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Try again.");
      return;
    }

    setStep({
      name: "pay",
      orderId: data.order_id,
      clientSecret: data.client_secret,
      total: data.total_amount,
      quantity: data.quantity,
    });
    router.refresh();
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <label htmlFor="quantity" className="text-sm font-medium text-ink">
          Tickets
        </label>
        <select
          id="quantity"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="rounded-xl border-2 border-slate-200 px-3 py-2 focus:border-violet focus:outline-none"
        >
          {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={handleReserve}
        disabled={reserving}
        className="rounded-full bg-violet px-4 py-2 font-heading font-bold text-white disabled:opacity-50"
      >
        {reserving
          ? "Reserving…"
          : `Reserve ${quantity} ticket${quantity === 1 ? "" : "s"} for $${(pricePerTicket * quantity).toFixed(2)}`}
      </button>
    </div>
  );
}
