import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, RefreshCw, Bike, Package, CheckCircle2, ChefHat, Clock, XCircle, Utensils } from "lucide-react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { formatZAR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Champs Chicken" }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  fulfillment: "pickup" | "delivery";
  delivery_notes: string | null;
  subtotal_cents: number;
  status: "pending" | "preparing" | "out_for_delivery" | "completed" | "cancelled";
  created_at: string;
};
type ItemRow = { order_id: string; item_name: string; quantity: number; unit_price_cents: number };

const STATUS_FLOW: Order["status"][] = ["pending", "preparing", "out_for_delivery", "completed"];
const STATUS_META = {
  pending: { label: "New", icon: Clock, color: "bg-amber-500" },
  preparing: { label: "Preparing", icon: ChefHat, color: "bg-blue-500" },
  out_for_delivery: { label: "Out for delivery", icon: Bike, color: "bg-purple-500" },
  completed: { label: "Completed", icon: CheckCircle2, color: "bg-green-600" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-neutral-500" },
} as const;

function Admin() {
  const nav = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, ItemRow[]>>({});
  const [filter, setFilter] = useState<Order["status"] | "active" | "all">("active");
  const [role, setRole] = useState<"admin" | "staff" | null>(null);
  const [checking, setChecking] = useState(true);

  async function load() {
    const { data: os } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setOrders((os as Order[]) ?? []);
    if (os && os.length) {
      const ids = os.map((o) => o.id);
      const { data: its } = await supabase.from("order_items").select("*").in("order_id", ids);
      const map: Record<string, ItemRow[]> = {};
      (its as ItemRow[] | null)?.forEach((r) => {
        (map[r.order_id] ??= []).push(r);
      });
      setItemsByOrder(map);
    }
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      const found = (roles ?? []).map((r) => r.role);
      const r = found.includes("admin") ? "admin" : found.includes("staff") ? "staff" : null;
      setRole(r as any);
      setChecking(false);
      if (r) await load();
    })();
  }, []);

  useEffect(() => {
    if (!role) return;
    const ch = supabase
      .channel("orders-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [role]);

  async function updateStatus(id: string, status: Order["status"]) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success(`Marked ${STATUS_META[status].label}`);
  }

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  if (checking) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  if (!role) {
    return (
      <div className="min-h-screen">
        <Header subtitle="Admin" />
        <div className="mx-auto max-w-md px-4 py-12 text-center">
          <h1 className="font-display text-2xl">No access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account isn't assigned as staff or admin yet. Ask an admin to grant you access, then reload.
          </p>
          <button onClick={signOut} className="mt-6 rounded-full border px-4 py-2 text-sm">Sign out</button>
        </div>
      </div>
    );
  }

  const filtered = orders.filter((o) => {
    if (filter === "all") return true;
    if (filter === "active") return o.status !== "completed" && o.status !== "cancelled";
    return o.status === filter;
  });

  const stats = {
    new: orders.filter((o) => o.status === "pending").length,
    prep: orders.filter((o) => o.status === "preparing").length,
    out: orders.filter((o) => o.status === "out_for_delivery").length,
    today: orders.filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString()).length,
    revenue: orders
      .filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString() && o.status !== "cancelled")
      .reduce((s, o) => s + o.subtotal_cents, 0),
  };

  return (
    <div className="min-h-screen pb-10 bg-muted/40">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="font-display text-2xl text-brand">Champs Admin</div>
          <div className="flex items-center gap-2">
            <Link to="/_authenticated/admin/menu" className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-accent">
              <Utensils className="h-3.5 w-3.5" /> Menu
            </Link>
            <button onClick={load} className="grid h-8 w-8 place-items-center rounded-full border hover:bg-accent"><RefreshCw className="h-4 w-4" /></button>
            <button onClick={signOut} className="grid h-8 w-8 place-items-center rounded-full border hover:bg-accent"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="New" value={stats.new} tone="bg-amber-500" />
          <Stat label="Preparing" value={stats.prep} tone="bg-blue-500" />
          <Stat label="Out for delivery" value={stats.out} tone="bg-purple-500" />
          <Stat label="Today revenue" value={formatZAR(stats.revenue)} tone="bg-brand" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["active", "pending", "preparing", "out_for_delivery", "completed", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider " +
                (filter === f ? "bg-brand text-brand-foreground" : "bg-background border text-muted-foreground")
              }
            >
              {f.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {filtered.length === 0 && <div className="text-sm text-muted-foreground py-6">No orders in this view.</div>}
          {filtered.map((o) => {
            const meta = STATUS_META[o.status];
            const StatusIcon = meta.icon;
            const items = itemsByOrder[o.id] ?? [];
            const currentIdx = STATUS_FLOW.indexOf(o.status);
            const next = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;
            return (
              <div key={o.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-2xl text-brand">{o.order_number}</div>
                    <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleTimeString()}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white ${meta.color}`}>
                    <StatusIcon className="h-3 w-3" /> {meta.label}
                  </span>
                </div>
                <div className="mt-3 text-sm">
                  <div className="font-semibold">{o.customer_name} · <span className="text-muted-foreground font-normal">{o.customer_phone}</span></div>
                  <div className="mt-1 inline-flex items-center gap-1 text-xs">
                    {o.fulfillment === "delivery" ? <Bike className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                    <span className="capitalize font-semibold">{o.fulfillment}</span>
                  </div>
                  {o.delivery_notes && <div className="mt-1 rounded-md bg-muted p-2 text-xs italic">{o.delivery_notes}</div>}
                </div>
                <ul className="mt-3 text-sm space-y-0.5 border-t pt-3">
                  {items.map((i, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span><span className="font-bold text-brand">{i.quantity}×</span> {i.item_name}</span>
                      <span className="tabular-nums text-muted-foreground">{formatZAR(i.unit_price_cents * i.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <div className="font-display text-xl text-brand">{formatZAR(o.subtotal_cents)}</div>
                  <div className="flex gap-2">
                    {o.status !== "cancelled" && o.status !== "completed" && (
                      <button onClick={() => updateStatus(o.id, "cancelled")} className="rounded-full border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-brand">
                        Cancel
                      </button>
                    )}
                    {next && (
                      <button onClick={() => updateStatus(o.id, next)} className="rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-brand-foreground hover:bg-brand-dark">
                        → {STATUS_META[next].label}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className={"inline-block h-2 w-6 rounded-full " + tone} />
      <div className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-display text-2xl">{value}</div>
    </div>
  );
}
