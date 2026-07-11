import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bike, Phone, MapPin, Loader2, LogOut, RefreshCw, Package, Navigation as NavIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatZAR } from "@/lib/format";
import { toast } from "sonner";
import { DELIVERY_STATUS_LABEL, type DeliveryStatus } from "@/lib/delivery";

export const Route = createFileRoute("/_authenticated/driver")({
  head: () => ({ meta: [{ title: "Driver — Champs Chicken" }, { name: "robots", content: "noindex" }] }),
  component: DriverPage,
});

type Delivery = {
  id: string;
  order_id: string;
  driver_id: string | null;
  status: string;
  distance_km: number | null;
  delivery_fee_cents: number;
  created_at: string;
};

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  subtotal_cents: number;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_notes: string | null;
  branch_id: string;
};

type Branch = { id: string; name: string; city: string; latitude: number | null; longitude: number | null };
type ItemRow = { order_id: string; item_name: string; quantity: number };

function DriverPage() {
  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<{ id: string; name: string; status: string } | null>(null);
  const [notDriver, setNotDriver] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [items, setItems] = useState<Record<string, ItemRow[]>>({});
  const [branches, setBranches] = useState<Record<string, Branch>>({});
  const [tab, setTab] = useState<"available" | "mine">("available");

  const load = useCallback(async () => {
    setLoading(true);
    setNotDriver(false);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }

    const { data: existingDriver } = await supabase.from("drivers").select("id, name, status").eq("user_id", uid).maybeSingle();
    const driverRecord = existingDriver as { id: string; name: string; status: string } | null;

    if (!driverRecord) {
      setNotDriver(true);
      setLoading(false);
      return;
    }

    setDriver(driverRecord);

    const { data: dels } = await supabase
      .from("deliveries")
      .select("id, order_id, driver_id, status, distance_km, delivery_fee_cents, created_at")
      .neq("status", "delivered")
      .order("created_at", { ascending: false });
    const list = (dels ?? []) as Delivery[];
    setDeliveries(list);

    const orderIds = list.map((d) => d.order_id);
    if (orderIds.length) {
      const [{ data: os }, { data: its }] = await Promise.all([
        supabase.from("orders").select("id, order_number, customer_name, customer_phone, subtotal_cents, delivery_address, delivery_lat, delivery_lng, delivery_notes, branch_id").in("id", orderIds),
        supabase.from("order_items").select("order_id, item_name, quantity").in("order_id", orderIds),
      ]);
      const om: Record<string, Order> = {};
      for (const o of (os ?? []) as Order[]) om[o.id] = o;
      setOrders(om);
      const im: Record<string, ItemRow[]> = {};
      for (const r of (its ?? []) as ItemRow[]) {
        (im[r.order_id] ??= []).push(r);
      }
      setItems(im);
      const branchIds = Array.from(new Set((os ?? []).map((o: any) => o.branch_id).filter(Boolean)));
      if (branchIds.length) {
        const { data: bs } = await supabase.from("branches").select("id, name, city, latitude, longitude").in("id", branchIds);
        const bm: Record<string, Branch> = {};
        for (const b of (bs ?? []) as Branch[]) bm[b.id] = b;
        setBranches(bm);
      }
    } else {
      setOrders({});
      setItems({});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("driver-deliveries")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const available = useMemo(() => deliveries.filter((d) => d.driver_id === null && d.status === "pending"), [deliveries]);
  const mine = useMemo(() => (driver ? deliveries.filter((d) => d.driver_id === driver.id) : []), [deliveries, driver]);

  async function updateDelivery(id: string, patch: Partial<Delivery>) {
    const { error } = await supabase.from("deliveries").update(patch as never).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  }

  async function accept(d: Delivery) {
    if (!driver) return;
    await updateDelivery(d.id, { driver_id: driver.id, status: "accepted" });
    toast.success("Order accepted");
  }
  async function nextStatus(d: Delivery) {
    const flow: DeliveryStatus[] = ["accepted", "picked_up", "on_the_way", "delivered"];
    const idx = flow.indexOf(d.status as DeliveryStatus);
    const next = idx === -1 ? "picked_up" : flow[Math.min(idx + 1, flow.length - 1)];
    await updateDelivery(d.id, { status: next });
    // sync order fulfillment status for customer view
    if (next === "on_the_way") {
      await supabase.from("orders").update({ status: "out_for_delivery" as any }).eq("id", d.order_id);
    } else if (next === "delivered") {
      await supabase.from("orders").update({ status: "completed" as any }).eq("id", d.order_id);
    }
  }

  async function toggleStatus() {
    if (!driver) return;
    const nextStatus = driver.status === "active" ? "offline" : "active";
    const { error } = await supabase.from("drivers").update({ status: nextStatus } as never).eq("id", driver.id);
    if (error) return toast.error(error.message);
    setDriver({ ...driver, status: nextStatus });
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (notDriver) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div className="max-w-sm space-y-3">
          <Bike className="h-10 w-10 mx-auto text-brand" />
          <h1 className="font-display text-2xl">Driver access only</h1>
          <p className="text-sm text-muted-foreground">Your account isn't registered as a Champs driver. Ask an admin to add you in the Drivers panel.</p>
          <Link to="/" className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground">Back to Champs</Link>
        </div>
      </div>
    );
  }

  const list = tab === "available" ? available : mine;

  return (
    <div className="min-h-screen bg-muted/40 pb-20">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="font-display text-xl text-brand inline-flex items-center gap-2"><Bike className="h-5 w-5" /> Driver</div>
          <div className="flex items-center gap-2">
            <button onClick={toggleStatus} className={"rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider " + (driver?.status === "active" ? "bg-emerald-600 text-white" : "border bg-background text-muted-foreground")}>
              {driver?.status === "active" ? "Online" : "Offline"}
            </button>
            <button onClick={load} className="grid h-8 w-8 place-items-center rounded-full border"><RefreshCw className="h-3.5 w-3.5" /></button>
            <button onClick={signOut} className="grid h-8 w-8 place-items-center rounded-full border"><LogOut className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="mx-auto flex max-w-2xl gap-2 px-4 pb-3">
          <button onClick={() => setTab("available")} className={"flex-1 rounded-full px-3 py-2 text-xs font-bold uppercase " + (tab === "available" ? "bg-brand text-brand-foreground" : "border bg-background")}>
            Available ({available.length})
          </button>
          <button onClick={() => setTab("mine")} className={"flex-1 rounded-full px-3 py-2 text-xs font-bold uppercase " + (tab === "mine" ? "bg-brand text-brand-foreground" : "border bg-background")}>
            My deliveries ({mine.length})
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-4 space-y-3">
        {list.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {tab === "available" ? "No orders waiting for a driver right now." : "You have no active deliveries."}
          </div>
        )}
        {list.map((d) => {
          const o = orders[d.order_id];
          const b = o ? branches[o.branch_id] : null;
          const its = items[d.order_id] ?? [];
          const mapsHref = o?.delivery_lat && o?.delivery_lng
            ? `https://www.google.com/maps/dir/?api=1&destination=${o.delivery_lat},${o.delivery_lng}${b?.latitude && b?.longitude ? `&origin=${b.latitude},${b.longitude}` : ""}`
            : o?.delivery_address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.delivery_address)}` : null;
          return (
            <div key={d.id} className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-lg text-brand truncate">{o?.customer_name ?? "Customer"}</div>
                  <div className="text-xs text-muted-foreground">#{o?.order_number} · {b?.name ?? "Branch"}</div>
                </div>
                <span className="rounded-full bg-brand/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-brand">{DELIVERY_STATUS_LABEL[d.status] ?? d.status}</span>
              </div>

              {o?.delivery_address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                  <div className="min-w-0">
                    <div>{o.delivery_address}</div>
                    {o.delivery_notes && <div className="text-xs text-muted-foreground">{o.delivery_notes}</div>}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {its.reduce((s, r) => s + r.quantity, 0)} items</span>
                {d.distance_km != null && <span>· {Number(d.distance_km).toFixed(1)} km</span>}
                <span>· Fee <span className="font-bold text-foreground">{formatZAR(d.delivery_fee_cents)}</span></span>
                <span>· Order <span className="font-bold text-foreground">{formatZAR(o?.subtotal_cents ?? 0)}</span></span>
              </div>

              {its.length > 0 && (
                <ul className="rounded-lg bg-muted/40 px-3 py-2 text-xs space-y-0.5">
                  {its.map((r, i) => <li key={i}>{r.quantity}× {r.item_name}</li>)}
                </ul>
              )}

              <div className="grid grid-cols-2 gap-2">
                {o?.customer_phone && (
                  <a href={`tel:${o.customer_phone}`} className="rounded-xl border px-3 py-3 text-sm font-bold inline-flex items-center justify-center gap-2">
                    <Phone className="h-4 w-4" /> Call
                  </a>
                )}
                {mapsHref && (
                  <a href={mapsHref} target="_blank" rel="noreferrer" className="rounded-xl border px-3 py-3 text-sm font-bold inline-flex items-center justify-center gap-2">
                    <NavIcon className="h-4 w-4" /> Maps
                  </a>
                )}
              </div>

              {tab === "available" ? (
                <button onClick={() => accept(d)} className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-brand-foreground">Accept order</button>
              ) : d.status !== "delivered" ? (
                <button onClick={() => nextStatus(d)} className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-brand-foreground">
                  {d.status === "accepted" ? "Mark picked up" : d.status === "picked_up" ? "Start delivery" : d.status === "on_the_way" ? "Mark delivered" : "Advance"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
