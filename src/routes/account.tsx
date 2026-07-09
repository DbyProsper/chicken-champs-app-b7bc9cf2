import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Package, Repeat, Sparkles, ShieldCheck, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { myOrdersQuery, activePromotionsQuery } from "@/lib/user-queries";
import { menuQuery } from "@/lib/menu-queries";
import { useCart } from "@/lib/cart";
import { getAccessRole } from "@/lib/roles";
import { formatZAR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [{ title: "My Account — Champs Chicken" }, { name: "robots", content: "noindex" }],
  }),
  component: Account,
});

function Account() {
  const nav = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; phone: string | null } | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        nav({ to: "/auth" });
        return;
      }
      setUserId(u.user.id);
      const [{ data: p }, role] = await Promise.all([
        supabase.from("profiles").select("full_name, phone").eq("id", u.user.id).maybeSingle(),
        getAccessRole(u.user.id),
      ]);
      setProfile(p);
      setIsStaff(role === "admin" || role === "staff");
      setChecking(false);
    })();
  }, [nav]);

  const { data: orders = [] } = useQuery(myOrdersQuery(userId));
  const { data: menu } = useQuery(menuQuery);
  const { data: promos = [] } = useQuery(activePromotionsQuery);
  const { add } = useCart();

  // "For You" heuristic: most-ordered items by this customer, then popular fallbacks
  const forYou = useMemo(() => {
    if (!menu) return [];
    const counts = new Map<string, number>();
    orders.forEach((o) =>
      o.items.forEach((i) => {
        if (i.menu_item_id) counts.set(i.menu_item_id, (counts.get(i.menu_item_id) ?? 0) + i.quantity);
      }),
    );
    const suggestedIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id);
    const suggested = menu.items.filter((i) => suggestedIds.includes(i.id) && i.is_available);
    if (suggested.length >= 4) return suggested.slice(0, 6);
    // Fill with popular combos + fan favourites
    const combosCat = menu.categories.find((c) => c.slug === "combos");
    const fallback = menu.items.filter(
      (i) => i.is_available && !suggestedIds.includes(i.id) && (combosCat ? i.category_id === combosCat.id : true),
    );
    return [...suggested, ...fallback].slice(0, 6);
  }, [orders, menu]);

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/" });
  }

  async function reorder(orderId: string) {
    const o = orders.find((x) => x.id === orderId);
    if (!o) return;
    let added = 0;
    o.items.forEach((it) => {
      if (it.menu_item_id) {
        const mi = menu?.items.find((m) => m.id === it.menu_item_id);
        if (mi && mi.is_available) {
          add({ id: mi.id, name: mi.name, variant: mi.variant_label, unit_price_cents: mi.price_cents }, it.quantity);
          added++;
        }
      }
    });
    if (added === 0) toast.error("Those items aren't available right now");
    else {
      toast.success(`Added ${added} items to cart`);
      nav({ to: "/cart" });
    }
  }

  if (checking) return <div className="p-8 text-sm text-muted-foreground">…</div>;

  return (
    <div className="min-h-screen pb-24">
      <Header subtitle="My Account" />

      <div className="mx-auto max-w-lg px-4 py-4 space-y-6">
        {/* Profile */}
        <div className="rounded-2xl bg-brand text-brand-foreground p-5">
          <div className="text-xs uppercase tracking-widest opacity-80">Welcome</div>
          <div className="font-display text-3xl mt-0.5">{profile?.full_name || "Champs fan"}</div>
          {profile?.phone && <div className="text-sm opacity-90 mt-1">{profile.phone}</div>}
          <div className="mt-4 flex gap-2">
            {isStaff && (
              <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur px-3 py-1.5 text-xs font-bold hover:bg-white/30">
                <ShieldCheck className="h-3.5 w-3.5" /> Admin
              </Link>
            )}
            <button onClick={signOut} className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur px-3 py-1.5 text-xs font-bold hover:bg-white/30">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>

        {/* Weekly specials */}
        {promos.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-brand" />
              <h2 className="font-display text-2xl">Specials for you</h2>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {promos.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                  <div className="min-w-0">
                    {p.badge && <div className="text-[10px] font-bold uppercase tracking-wider text-brand">{p.badge}</div>}
                    <div className="font-semibold text-sm">{p.title}</div>
                    {p.description && <div className="text-xs text-muted-foreground line-clamp-1">{p.description}</div>}
                  </div>
                  {p.price_cents != null && <div className="font-display text-xl text-brand shrink-0 pl-3">{formatZAR(p.price_cents)}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* For you */}
        {forYou.length > 0 && (
          <section>
            <h2 className="font-display text-2xl mb-2">For you</h2>
            <div className="grid grid-cols-2 gap-2">
              {forYou.map((it) => (
                <button
                  key={it.id}
                  onClick={() => {
                    add({ id: it.id, name: it.name, variant: it.variant_label, unit_price_cents: it.price_cents });
                    toast.success(`Added ${it.name}`);
                  }}
                  className="text-left rounded-xl border border-border bg-card p-3 hover:border-brand"
                >
                  <div className="font-semibold text-sm truncate">{it.name}</div>
                  {it.variant_label && <div className="text-[11px] text-muted-foreground">{it.variant_label}</div>}
                  <div className="mt-1 font-display text-lg text-brand">{formatZAR(it.price_cents)}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Order history */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-brand" />
            <h2 className="font-display text-2xl">Order history</h2>
          </div>
          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No orders yet.{" "}
              <Link to="/menu" className="text-brand font-bold underline">Order now</Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {orders.map((o) => (
                <li key={o.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link to="/order/$number" params={{ number: o.order_number }} className="min-w-0 flex-1">
                      <div className="font-display text-lg text-brand">{o.order_number}</div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString()} · {o.status.replace(/_/g, " ")} · {o.fulfillment}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground truncate">
                        {o.items.map((i) => `${i.quantity}× ${i.item_name}`).join(", ")}
                      </div>
                    </Link>
                    <div className="text-right shrink-0">
                      <div className="font-display text-lg">{formatZAR(o.subtotal_cents)}</div>
                      <button
                        onClick={() => reorder(o.id)}
                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-[11px] font-bold text-brand-foreground hover:bg-brand-dark"
                      >
                        <Repeat className="h-3 w-3" /> Reorder
                      </button>
                    </div>
                  </div>
                  <Link to="/order/$number" params={{ number: o.order_number }} className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand">
                    View <ChevronRight className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <BottomNav />
    </div>
  );
}
