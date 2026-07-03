import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { useCart } from "@/lib/cart";
import { formatZAR } from "@/lib/format";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart — Champs Chicken" },
      { name: "description", content: "Review your Champs Chicken order before checkout." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, setQty, remove, subtotalCents, count } = useCart();

  return (
    <div className="min-h-screen pb-40">
      <Header subtitle="Your Cart" />
      <div className="mx-auto max-w-lg px-4 py-4">
        {items.length === 0 ? (
          <div className="mt-20 text-center">
            <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
            <div className="mt-4 font-display text-2xl">Your cart is empty</div>
            <p className="mt-1 text-sm text-muted-foreground">Add some crispy chicken to get started.</p>
            <Link to="/menu" className="mt-6 inline-flex items-center rounded-full bg-brand px-6 py-3 text-sm font-bold text-brand-foreground hover:bg-brand-dark">
              Browse menu
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {i.name}{i.variant ? ` — ${i.variant}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatZAR(i.unit_price_cents)} each</div>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
                  <button onClick={() => setQty(i.id, i.quantity - 1)} className="grid h-7 w-7 place-items-center rounded-full bg-background">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-4 text-center text-sm font-bold">{i.quantity}</span>
                  <button onClick={() => setQty(i.id, i.quantity + 1)} className="grid h-7 w-7 place-items-center rounded-full bg-brand text-brand-foreground">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button onClick={() => remove(i.id)} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-brand" aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-lg px-4 py-3">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Subtotal ({count} items)</span>
              <span className="font-display text-2xl text-brand">{formatZAR(subtotalCents)}</span>
            </div>
            <Link to="/checkout" className="block w-full rounded-full bg-brand py-3 text-center text-sm font-bold text-brand-foreground hover:bg-brand-dark">
              Checkout
            </Link>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
