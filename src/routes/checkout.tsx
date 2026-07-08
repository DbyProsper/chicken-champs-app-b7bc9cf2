import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Header } from "@/components/Header";
import { useCart } from "@/lib/cart";
import { useBranch } from "@/lib/branch";
import { formatZAR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Champs Chicken" },
      { name: "description", content: "Complete your Champs Chicken order for pickup or delivery." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

// SA mobile numbers: accept 0XXXXXXXXX (10 digits starting 0) or +27XXXXXXXXX / 27XXXXXXXXX (11 digits, second digit 6/7/8 for mobile ranges but also allow 1-8 to include landlines).
// Normalise by stripping spaces, dashes, parentheses first.
const saPhoneRegex = /^(?:\+?27|0)[1-8]\d{8}$/;

const schema = z.object({
  customer_name: z.string().trim().min(1, "Please enter your name").max(100),
  customer_phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s\-()]/g, ""))
    .refine((v) => saPhoneRegex.test(v), {
      message: "Enter a valid SA number, e.g. 082 123 4567 or +27 82 123 4567",
    }),
  fulfillment: z.enum(["pickup", "delivery"]),
  delivery_notes: z.string().max(500).optional(),
});

function Checkout() {
  const nav = useNavigate();
  const { items, subtotalCents, clear } = useCart();
  const { active: branch } = useBranch();
  const [userId, setUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    fulfillment: "pickup" as "pickup" | "delivery",
    delivery_notes: "",
  });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        setUserId(u.user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", u.user.id)
          .maybeSingle();
        if (profile) {
          setForm((f) => ({
            ...f,
            customer_name: f.customer_name || profile.full_name || "",
            customer_phone: f.customer_phone || profile.phone || "",
          }));
        } else if (u.user.email) {
          setForm((f) => ({ ...f, customer_name: f.customer_name || (u.user!.user_metadata as any)?.full_name || "" }));
        }
      }
    })();
  }, []);

  if (items.length === 0 && !submitting) {
    return (
      <div className="min-h-screen">
        <Header subtitle="Checkout" />
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">Your cart is empty.</p>
          <Link to="/menu" className="mt-6 inline-flex rounded-full bg-brand px-6 py-3 text-sm font-bold text-brand-foreground">Browse menu</Link>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!branch) {
      toast.error("Please choose a branch first");
      return;
    }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const { data: orderRow, error: oErr } = await supabase
        .from("orders")
        .insert({
          customer_name: parsed.data.customer_name,
          customer_phone: parsed.data.customer_phone,
          fulfillment: parsed.data.fulfillment,
          delivery_notes: parsed.data.delivery_notes || null,
          subtotal_cents: subtotalCents,
          branch_id: branch.id,
          user_id: userId,
        } as never)
        .select("id, order_number")
        .single();
      if (oErr) throw oErr;

      const { error: iErr } = await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: orderRow.id,
          menu_item_id: i.id,
          item_name: i.variant ? `${i.name} — ${i.variant}` : i.name,
          unit_price_cents: i.unit_price_cents,
          quantity: i.quantity,
        })),
      );
      if (iErr) throw iErr;

      try {
        const list = JSON.parse(localStorage.getItem("champs-orders") || "[]");
        list.unshift(orderRow.order_number);
        localStorage.setItem("champs-orders", JSON.stringify(list.slice(0, 10)));
      } catch {}

      clear();
      nav({ to: "/order/$number", params: { number: orderRow.order_number } });
    } catch (err: any) {
      toast.error(err.message ?? "Could not place order");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen pb-10">
      <Header subtitle="Checkout" />
      <form onSubmit={submit} className="mx-auto max-w-lg px-4 py-4 space-y-5">
        {branch && (
          <div className="rounded-xl bg-brand/5 border border-brand/20 px-4 py-3 text-xs flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand" />
            <span>Ordering from <span className="font-bold">{branch.name}</span> · {branch.address}, {branch.city}</span>
          </div>
        )}
        <section>
          <h2 className="font-display text-xl mb-2">Your details</h2>
          <div className="space-y-3">
            <input
              className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="Full name"
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              required
            />
            <input
              className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="Phone number"
              type="tel"
              inputMode="tel"
              value={form.customer_phone}
              onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
              required
            />
            {!userId && (
              <p className="text-[11px] text-muted-foreground">
                <Link to="/auth" className="underline text-brand font-semibold">Sign in</Link> to save this order to your history and unlock reordering.
              </p>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl mb-2">Order type</h2>
          <div className="grid grid-cols-2 gap-2">
            {(["pickup", "delivery"] as const).map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => setForm({ ...form, fulfillment: v })}
                className={
                  "rounded-xl border-2 px-4 py-4 text-sm font-bold uppercase tracking-wider transition-colors " +
                  (form.fulfillment === v ? "border-brand bg-brand text-brand-foreground" : "border-border bg-card text-muted-foreground")
                }
              >
                {v}
              </button>
            ))}
          </div>
          {form.fulfillment === "delivery" && (
            <textarea
              className="mt-3 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="Delivery address & notes (e.g. UFH Gate 3, Room 214)"
              rows={3}
              value={form.delivery_notes}
              onChange={(e) => setForm({ ...form, delivery_notes: e.target.value })}
            />
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm space-y-1.5">
            {items.map((i) => (
              <div key={i.id} className="flex justify-between gap-3">
                <span className="truncate"><span className="font-bold text-brand">{i.quantity}×</span> {i.name}{i.variant ? ` — ${i.variant}` : ""}</span>
                <span className="shrink-0 tabular-nums">{formatZAR(i.unit_price_cents * i.quantity)}</span>
              </div>
            ))}
            <div className="mt-3 flex justify-between border-t border-border pt-3">
              <span className="font-bold">Total</span>
              <span className="font-display text-xl text-brand">{formatZAR(subtotalCents)}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Payment on collection or delivery. No card required.
          </p>
        </section>

        <button
          type="submit"
          disabled={submitting || !branch}
          className="w-full rounded-full bg-brand py-4 text-sm font-bold text-brand-foreground hover:bg-brand-dark disabled:opacity-60"
        >
          {submitting ? "Placing order…" : `Place order · ${formatZAR(subtotalCents)}`}
        </button>
      </form>
    </div>
  );
}
