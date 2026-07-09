import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LogOut, RefreshCw, Bike, Package, CheckCircle2, ChefHat, Clock, XCircle, Utensils, Sparkles, ShieldCheck, MessageCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { formatZAR } from "@/lib/format";
import { toast } from "sonner";
import { waLink, orderStatusMessage } from "@/lib/whatsapp";
import { fireNotification } from "@/lib/notifications";
import { useBranch } from "@/lib/branch";
import { getAccessRole } from "@/lib/roles";

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
  branch_id: string;
  pickup_pin: string;
  verified_at: string | null;
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
  const { branches, active: activeBranch, setActive } = useBranch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, ItemRow[]>>({});
  const [filter, setFilter] = useState<Order["status"] | "active" | "all">("active");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [role, setRole] = useState<"admin" | "staff" | null>(null);
  const [checking, setChecking] = useState(true);
  const prevIdsRef = useRef<Set<string>>(new Set());

  async function load() {
    const { data: os } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (os as Order[]) ?? [];
    // Detect new pending orders for browser notifications + toast
    const newOnes = list.filter((o) => o.status === "pending" && !prevIdsRef.current.has(o.id));
    if (prevIdsRef.current.size > 0 && newOnes.length > 0) {
      newOnes.forEach((o) => {
        toast.success(`New order ${o.order_number} · ${o.customer_name}`);
        fireNotification("New Champs order", `${o.order_number} · ${formatZAR(o.subtotal_cents)}`, o.id);
      });
    }
    prevIdsRef.current = new Set(list.map((o) => o.id));
    setOrders(list);
    if (list.length) {
      const ids = list.map((o) => o.id);
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
      const r = await getAccessRole(u.user.id);
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

  async function verifyOrder(order: Order, pinAttempt: string) {
    if (pinAttempt.trim() !== order.pickup_pin) {
      toast.error("Wrong PIN");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("orders")
      .update({ verified_at: new Date().toISOString(), verified_by: u.user?.id, status: "completed" })
      .eq("id", order.id);
    if (error) toast.error(error.message);
    else toast.success(`Order ${order.order_number} verified & completed`);
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
          <h1 className="font-display text-2xl">No staff access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account isn't assigned as staff or admin yet. Ask an admin to grant you access, then reload.
          </p>
          <button onClick={signOut} className="mt-6 rounded-full border px-4 py-2 text-sm">Sign out</button>
        </div>
      </div>
    );
  }

  const filtered = orders.filter((o) => {
    if (branchFilter !== "all" && o.branch_id !== branchFilter) return false;
    if (filter === "all") return true;
    if (filter === "active") return o.status !== "completed" && o.status !== "cancelled";
    return o.status === filter;
  });

  const stats = {
    new: filtered.filter((o) => o.status === "pending").length,
    prep: filtered.filter((o) => o.status === "preparing").length,
    out: filtered.filter((o) => o.status === "out_for_delivery").length,
    revenue: orders
      .filter((o) => (branchFilter === "all" || o.branch_id === branchFilter) && new Date(o.created_at).toDateString() === new Date().toDateString() && o.status !== "cancelled")
      .reduce((s, o) => s + o.subtotal_cents, 0),
  };

  return (
    <div className="min-h-screen pb-10 bg-muted/40">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 gap-2">
          <div className="font-display text-2xl text-brand flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Champs Admin
          </div>
          <div className="flex items-center gap-2">
            <Link to="/_authenticated/admin/promotions" className="hidden sm:inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-accent">
              <Sparkles className="h-3.5 w-3.5" /> Promos
            </Link>
            <Link to="/_authenticated/admin/menu" className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-accent">
              <Utensils className="h-3.5 w-3.5" /> Menu
            </Link>
            <button onClick={load} className="grid h-8 w-8 place-items-center rounded-full border hover:bg-accent"><RefreshCw className="h-4 w-4" /></button>
            <button onClick={signOut} className="grid h-8 w-8 place-items-center rounded-full border hover:bg-accent"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-4">
        {/* Branch filter */}
        <div className="mb-3 flex flex-wrap gap-2 items-center">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Branch</span>
          <button
            onClick={() => setBranchFilter("all")}
            className={"rounded-full px-3 py-1 text-xs font-bold " + (branchFilter === "all" ? "bg-brand text-brand-foreground" : "bg-background border")}
          >
            All
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => { setBranchFilter(b.id); setActive(b); }}
              className={"rounded-full px-3 py-1 text-xs font-bold " + (branchFilter === b.id ? "bg-brand text-brand-foreground" : "bg-background border")}
            >
              {b.city}
            </button>
          ))}
        </div>

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
            const branch = branches.find((b) => b.id === o.branch_id);
            return (
              <OrderCard
                key={o.id}
                order={o}
                items={itemsByOrder[o.id] ?? []}
                branchName={branch?.city ?? "—"}
                branchPhone={branch?.phone ?? null}
                onUpdateStatus={updateStatus}
                onVerify={verifyOrder}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OrderCard({
  order: o, items, branchName, branchPhone, onUpdateStatus, onVerify,
}: {
  order: Order; items: ItemRow[]; branchName: string; branchPhone: string | null;
  onUpdateStatus: (id: string, s: Order["status"]) => void;
  onVerify: (o: Order, pin: string) => void;
}) {
  const meta = STATUS_META[o.status];
  const StatusIcon = meta.icon;
  const currentIdx = STATUS_FLOW.indexOf(o.status);
  const next = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;
  const [pinInput, setPinInput] = useState("");
  const [showVerify, setShowVerify] = useState(false);

  const waHref = waLink(o.customer_phone, orderStatusMessage(o.order_number, o.status, o.customer_name));

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-2xl text-brand">{o.order_number}</div>
          <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleTimeString()} · {branchName}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white ${meta.color}`}>
            <StatusIcon className="h-3 w-3" /> {meta.label}
          </span>
          {o.verified_at && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
              <CheckCircle2 className="h-2.5 w-2.5" /> Verified
            </span>
          )}
        </div>
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

      {/* PIN verify */}
      {!o.verified_at && (o.status === "out_for_delivery" || o.status === "preparing") && (
        <div className="mt-3 rounded-xl bg-brand/5 border border-brand/20 p-3">
          {!showVerify ? (
            <button onClick={() => setShowVerify(true)} className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold text-brand">
              <ShieldCheck className="h-3.5 w-3.5" /> Verify customer PIN on handover
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="4-digit PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="flex-1 rounded-md border px-3 py-2 text-sm tracking-widest text-center font-display"
              />
              <button
                onClick={() => { onVerify(o, pinInput); setPinInput(""); setShowVerify(false); }}
                className="rounded-full bg-brand px-3 py-2 text-xs font-bold text-brand-foreground"
              >
                Verify
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t pt-3 gap-2">
        <div className="font-display text-xl text-brand">{formatZAR(o.subtotal_cents)}</div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-[#25D366] px-2.5 py-1.5 text-[11px] font-bold text-white hover:opacity-90">
            <MessageCircle className="h-3 w-3" /> WA
          </a>
          {o.status !== "cancelled" && o.status !== "completed" && (
            <button onClick={() => onUpdateStatus(o.id, "cancelled")} className="rounded-full border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-brand">
              Cancel
            </button>
          )}
          {next && (
            <button onClick={() => onUpdateStatus(o.id, next)} className="rounded-full bg-brand px-3 py-1.5 text-[11px] font-bold text-brand-foreground hover:bg-brand-dark">
              → {STATUS_META[next].label}
            </button>
          )}
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
