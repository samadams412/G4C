"use client";

import { useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

export default function CheckoutForm({
  total,
  onSettled,
  onCancel,
}: {
  total: number;
  // Called once Stripe has actually attempted the charge, win or lose, so the
  // parent can start polling our own backend for the webhook-confirmed
  // outcome. Crucially, this unmounts the Payment Element, so a declined
  // PaymentIntent can never be retried from this screen — our webhook treats
  // the first payment_intent.payment_failed as final and releases the spot,
  // so letting the same PaymentIntent be retried here could get a customer
  // charged on a spot we already gave back to someone else.
  onSettled: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      // A validation_error means Stripe never attempted the charge (e.g. the
      // card number field is incomplete) - no PaymentIntent attempt happened,
      // so it's safe to just show the message and let them fix the form.
      // Anything else is a real attempt that failed (declined, etc.), which
      // our webhook will act on, so we hand off to the parent instead of
      // letting this same form be resubmitted.
      if (confirmError.type === "validation_error") {
        setSubmitting(false);
        setError(confirmError.message ?? "Check the payment details and try again.");
        return;
      }
      onSettled();
      return;
    }

    onSettled();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
      <PaymentElement />
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!stripe || submitting}
          className="rounded-full bg-violet px-4 py-2 font-heading font-bold text-white disabled:opacity-50"
        >
          {submitting ? "Paying…" : `Pay $${total.toFixed(2)}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-full border-2 border-slate-200 px-4 py-2 font-heading font-bold text-slate-600 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
