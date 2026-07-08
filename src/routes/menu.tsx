import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Minus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// Combined sticky offset: main Header (~56px) + tab bar (~46px) + small buffer
const SCROLL_OFFSET = 112;

function MenuPage() {
  const { data } = useSuspenseQuery(menuQuery);
  const { categories, items } = data;
  const [active, setActive] = useState(categories[0]?.slug ?? "");
  const tabsRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<Record<string, HTMLElement | null>>({});
  const isClickScrollRef = useRef(false);

  const grouped = useMemo(() => {
    const map: Record<string, MenuItem[]> = {};
    for (const c of categories) map[c.slug] = [];
    for (const it of items) {
      const cat = categories.find((c) => c.id === it.category_id);
      if (cat) map[cat.slug].push(it);
    }
    return map;
  }, [categories, items]);

  // Scroll-spy: pick the section whose top is closest to (but not past) the sticky-header line.
  useEffect(() => {
    function onScroll() {
      if (isClickScrollRef.current) return;
      const threshold = SCROLL_OFFSET + 8;
      let current = categories[0]?.slug ?? "";
      for (const c of categories) {
        const el = sectionsRef.current[c.slug];
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top - threshold <= 0) current = c.slug;
        else break;
      }
      setActive((prev) => (prev === current ? prev : current));
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [categories]);

  // Auto-scroll active tab into view horizontally
  useEffect(() => {
    const bar = tabsRef.current;
    if (!bar) return;
    const el = bar.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  const scrollTo = useCallback((slug: string) => {
    const el = sectionsRef.current[slug];
    if (!el) return;
    setActive(slug);
    isClickScrollRef.current = true;
    const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
    window.scrollTo({ top, behavior: "smooth" });
    window.setTimeout(() => { isClickScrollRef.current = false; }, 900);
  }, []);

  // Deep link from home hash
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && grouped[hash]) {
      setTimeout(() => scrollTo(hash), 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen pb-24">
      <Header subtitle="Menu" />

      {/* Sticky category tabs — highlights active section on scroll */}
      <div className="sticky top-[54px] z-20 border-b border-border bg-background/95 backdrop-blur">
        <div ref={tabsRef} className="mx-auto max-w-lg overflow-x-auto no-scrollbar">
          <div className="flex gap-2 px-4 py-2 min-w-max">
            {categories.map((c) => (
              <button
                key={c.id}
                data-tab={c.slug}
                onClick={() => scrollTo(c.slug)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all",
                  active === c.slug
                    ? "bg-brand text-brand-foreground shadow-md scale-105"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-4 space-y-8">
        {categories.map((c) => (
          <section
            key={c.id}
            id={c.slug}
            data-slug={c.slug}
            ref={(el) => { sectionsRef.current[c.slug] = el; }}
            className="scroll-mt-32"
          >
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
  const available = item.is_available;

  return (
    <div className={cn("flex items-start gap-3 rounded-xl border border-border bg-card p-3", !available && "opacity-50")}>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-semibold text-sm truncate">{label}</div>
          <div className="font-display text-lg text-brand shrink-0">{formatZAR(item.price_cents)}</div>
        </div>
        {item.description && <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.description}</div>}
        {!available && <div className="mt-0.5 text-[10px] uppercase tracking-wider text-brand font-bold">Sold out</div>}
      </div>
      {!available ? null : qty === 0 ? (
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
