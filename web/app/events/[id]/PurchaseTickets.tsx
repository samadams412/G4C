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
    colorPrimary: "#9D3D00", // primary
    colorBackground: "#FFF4F0", // background
    colorText: "#4A2507", // on-surface
    colorDanger: "#B02500", // error
    fontFamily: '"Public Sans", system-ui, -apple-system, sans-serif',
    borderRadius: "8px", // radius-sm
  },
};

// Stripe's iframe can't see this page's CSS variables or next/font files, so
// the family is named literally and loaded here.
const STRIPE_FONTS = [
  { cssSrc: "https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600&display=swap" },
];

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
      <div className="mt-4 rounded-radius-sm border-2 border-primary bg-surface-container-highest px-4 py-3 text-title-small text-on-surface">
        {step.quantity} ticket{step.quantity === 1 ? "" : "s"} confirmed for ${step.total.toFixed(2)}.
      </div>
    );
  }

  if (step.name === "failed") {
    return (
      <div className="mt-4 flex flex-col gap-2">
        <p className="rounded-radius-sm bg-error-container px-3 py-2 text-body-medium text-on-error-container">
          That payment didn&apos;t go through, so we released your spot. No charge was made. Try again when
          you&apos;re ready.
        </p>
        <button
          onClick={() => setStep({ name: "select" })}
          className="self-start rounded-radius-sm bg-primary px-4 py-2 text-label-large text-on-primary"
        >
          Try again
        </button>
      </div>
    );
  }

  if (step.name === "pending") {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-radius-sm bg-tertiary-container px-4 py-3 text-title-small text-on-tertiary-container">
        <span className="h-4 w-4 flex-none animate-spin rounded-radius-full border-2 border-on-tertiary-container border-t-transparent" />
        Confirming your payment now.
      </div>
    );
  }

  if (step.name === "pay") {
    return (
      <Elements
        stripe={getStripe()}
        options={{ clientSecret: step.clientSecret, appearance: STRIPE_APPEARANCE, fonts: STRIPE_FONTS }}
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
    return <div className="mt-4 rounded-radius-sm bg-error-container px-4 py-3 text-title-small text-on-error-container">Sold out</div>;
  }

  if (pricePerTicket === null) {
    return <p className="mt-4 text-body-medium text-on-surface-variant">Ticket sales haven&apos;t opened for this event yet.</p>;
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
      {error && <p className="rounded-radius-sm bg-error-container px-3 py-2 text-body-medium text-on-error-container">{error}</p>}
      <div className="flex items-center gap-3">
        <label htmlFor="quantity" className="text-label-large text-on-surface">
          Tickets
        </label>
        <select
          id="quantity"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="rounded-radius-sm border-2 border-outline bg-surface-container-lowest px-3 py-2 text-on-surface focus:border-primary focus:outline-none"
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
        className="rounded-radius-sm bg-primary px-4 py-2 text-label-large text-on-primary disabled:opacity-50"
      >
        {reserving
          ? "Reserving…"
          : `Reserve ${quantity} ticket${quantity === 1 ? "" : "s"} for $${(pricePerTicket * quantity).toFixed(2)}`}
      </button>
    </div>
  );
}
