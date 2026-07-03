import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Minus } from "lucide-react";
import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { menuQuery, type MenuItem } from "@/lib/menu-queries";
import { useCart } from "@/lib/cart";
import { formatZAR } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu — Champs Chicken" },
      { name: "description", content: "Full Champs Chicken menu: fried chicken, chips, sauces, burgers, fish, combos, desserts and shakes." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(menuQuery),
  errorComponent: ({ error }) => <div className="p-6 text-sm">Failed to load menu: {error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">No menu items yet.</div>,
  component: MenuPage,
});

function MenuPage() {
  const { data } = useSuspenseQuery(menuQuery);
  const { categories, items } = data;
  const [active, setActive] = useState(categories[0]?.slug ?? "");

  const grouped = useMemo(() => {
    const map: Record<string, MenuItem[]> = {};
    for (const c of categories) map[c.slug] = [];
    for (const it of items) {
      const cat = categories.find((c) => c.id === it.category_id);
      if (cat) map[cat.slug].push(it);
    }
    return map;
  }, [categories, items]);

  return (
    <div className="min-h-screen pb-24">
      <Header subtitle="Menu" />

      {/* Category tabs */}
      <div className="sticky top-[68px] z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-lg overflow-x-auto no-scrollbar">
          <div className="flex gap-2 px-4 py-2 min-w-max">
            {categories.map((c) => (
              <a
                key={c.id}
                href={`#${c.slug}`}
                onClick={() => setActive(c.slug)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
                  active === c.slug
                    ? "bg-brand text-brand-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {c.name}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-4 space-y-8">
        {categories.map((c) => (
          <section key={c.id} id={c.slug} className="scroll-mt-32">
            <h2 className="font-display text-3xl text-brand mb-3">{c.name}</h2>
            <div className="space-y-2">
              {grouped[c.slug]?.map((it) => <Row key={it.id} item={it} />)}
            </div>
          </section>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}

function Row({ item }: { item: MenuItem }) {
  const { items, add, setQty } = useCart();
  const inCart = items.find((i) => i.id === item.id);
  const qty = inCart?.quantity ?? 0;

  const label = item.variant_label ? `${item.name} — ${item.variant_label}` : item.name;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-semibold text-sm truncate">{label}</div>
          <div className="font-display text-lg text-brand shrink-0">{formatZAR(item.price_cents)}</div>
        </div>
        {item.description && <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.description}</div>}
      </div>
      {qty === 0 ? (
        <button
          onClick={() => {
            add({ id: item.id, name: item.name, variant: item.variant_label, unit_price_cents: item.price_cents });
            toast.success(`Added ${label}`);
          }}
          className="shrink-0 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-brand-foreground hover:bg-brand-dark"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      ) : (
        <div className="shrink-0 inline-flex items-center gap-2 rounded-full bg-muted px-1 py-1">
          <button onClick={() => setQty(item.id, qty - 1)} className="grid h-7 w-7 place-items-center rounded-full bg-background text-brand hover:bg-brand hover:text-brand-foreground">
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-4 text-center text-sm font-bold">{qty}</span>
          <button onClick={() => setQty(item.id, qty + 1)} className="grid h-7 w-7 place-items-center rounded-full bg-brand text-brand-foreground hover:bg-brand-dark">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
