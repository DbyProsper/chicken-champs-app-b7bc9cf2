import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, MessageCircle, Bell, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { formatZAR } from "@/lib/format";
import { fireNotification, notificationPermission, requestNotificationPermission } from "@/lib/notifications";
import { waLink, orderStatusMessage } from "@/lib/whatsapp";
import { toast } from "sonner";

const orderQuery = (number: string) =>
  queryOptions({
    queryKey: ["order", number],
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, customer_phone, fulfillment, delivery_notes, subtotal_cents, status, created_at, pickup_pin, branch_id, verified_at")
        .eq("order_number", number)
        .maybeSingle();
      if (error) throw error;
      if (!order) return null;
      const [{ data: itemsData }, { data: branch }, { data: delivery }] = await Promise.all([
        supabase.from("order_items").select("item_name, unit_price_cents, quantity").eq("order_id", order.id),
        order.branch_id
          ? supabase.from("branches").select("name, address, city, phone").eq("id", order.branch_id).maybeSingle()
          : Promise.resolve({ data: null }),
        order.fulfillment === "delivery"
          ? supabase
              .from("deliveries")
              .select("queue_position, estimated_eta_min, estimated_eta_max, driver_id, status")
              .eq("order_id", order.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      let aheadCount = 0;
      if (delivery && (delivery as any).driver_id && (delivery as any).queue_position) {
        const pos = (delivery as any).queue_position as number;
        aheadCount = Math.max(0, pos - 1);
      }
      return { order, items: itemsData ?? [], branch, delivery, aheadCount };
    },
    staleTime: 5_000,
  });

export const Route = createFileRoute("/order/$number")({
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.number} — Champs Chicken` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(orderQuery(params.number)),
  errorComponent: ({ error }) => <div className="p-6 text-sm">Failed: {error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Order not found.</div>,
  component: OrderPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Received",
  preparing: "Preparing",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_STEPS = ["pending", "preparing", "out_for_delivery", "completed"] as const;

function OrderPage() {
  const { number } = Route.useParams();
  const { data, refetch } = useSuspenseQuery(orderQuery(number));
  const prevStatus = useRef<string | null>(null);
  const [permission, setPermission] = useState(notificationPermission());

  // Realtime subscription for this order → refetch + browser notification on status change
  useEffect(() => {
    if (!data?.order.id) return;
    prevStatus.current = data.order.status;
    const ch = supabase
      .channel(`order-${data.order.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${data.order.id}` },
        (payload) => {
          const newStatus = (payload.new as any).status as string;
          if (prevStatus.current && newStatus !== prevStatus.current) {
            const label = STATUS_LABEL[newStatus] ?? newStatus;
            toast.success(`Order update: ${label}`);
            fireNotification(
              `Champs Chicken — ${label}`,
              `Order ${data.order.order_number} · ${label}`,
              `order-${data.order.id}`,
            );
            prevStatus.current = newStatus;
          }
          refetch();
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [data?.order.id, data?.order.order_number, refetch]);

  async function enableNotifications() {
    const p = await requestNotificationPermission();
    setPermission(p);
    if (p === "granted") toast.success("Notifications enabled");
    else if (p === "denied") toast.error("Notifications blocked in browser settings");
  }

  if (!data) return <div className="p-6 text-sm">Order not found.</div>;
  const { order, items, branch, delivery, aheadCount } = data;
  const currentIdx = STATUS_STEPS.indexOf(order.status as (typeof STATUS_STEPS)[number]);

  const waText = orderStatusMessage(order.order_number, order.status, order.customer_name);
  const verifyPayload = `champs:${order.order_number}:${order.pickup_pin}`;
  const deliveryEta = delivery as { estimated_eta_min?: number | null; estimated_eta_max?: number | null; queue_position?: number | null; driver_id?: string | null } | null;

  return (
    <div className="min-h-screen pb-10">
      <Header subtitle="Order Confirmed" />
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="rounded-2xl bg-brand p-6 text-brand-foreground text-center">
          <CheckCircle2 className="mx-auto h-12 w-12" />
          <div className="mt-3 text-xs uppercase tracking-widest opacity-80">Order number</div>
          <div className="font-display text-4xl">{order.order_number}</div>
          <div className="mt-4 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            {STATUS_LABEL[order.status]}
          </div>
          {order.fulfillment === "delivery" && deliveryEta?.estimated_eta_min != null && deliveryEta?.estimated_eta_max != null && (
            <div className="mt-3 text-sm">
              <span className="opacity-80">Estimated delivery</span>{" "}
              <span className="font-bold">{deliveryEta.estimated_eta_min}–{deliveryEta.estimated_eta_max} min</span>
            </div>
          )}
          {order.fulfillment === "delivery" && deliveryEta?.driver_id && aheadCount > 0 && (
            <div className="mt-1 text-xs opacity-90">Driver has {aheadCount} {aheadCount === 1 ? "delivery" : "deliveries"} before yours</div>
          )}
        </div>

        {/* Progress bar */}
        {order.status !== "cancelled" && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              {STATUS_STEPS.map((s, i) => (
                <div key={s} className="flex-1 flex items-center">
                  <div className={`h-8 w-8 rounded-full grid place-items-center text-[10px] font-bold ${i <= currentIdx ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"}`}>
                    {i + 1}
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`flex-1 h-1 mx-1 rounded ${i < currentIdx ? "bg-brand" : "bg-muted"}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">
              <span>Received</span><span>Prep</span><span>{order.fulfillment === "delivery" ? "Delivery" : "Ready"}</span><span>Done</span>
            </div>
          </div>
        )}

        {/* PIN + QR verification card */}
        <div className="mt-4 rounded-2xl border-2 border-brand/40 bg-brand/5 p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand">
            <ShieldCheck className="h-4 w-4" /> Show this on {order.fulfillment === "delivery" ? "delivery" : "collection"}
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Pickup PIN</div>
              <div className="font-display text-5xl text-brand tracking-[0.3em]">{order.pickup_pin}</div>
              <p className="mt-2 text-xs text-muted-foreground">Give this 4-digit PIN to the driver or cashier to confirm your order.</p>
            </div>
            <div className="shrink-0 rounded-xl bg-white p-2 border border-border">
              <QRCodeSVG value={verifyPayload} size={96} />
            </div>
          </div>
          {order.verified_at && (
            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-green-600 px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
              <CheckCircle2 className="h-3 w-3" /> Verified
            </div>
          )}
        </div>

        {/* Notifications */}
        {permission === "default" && (
          <button
            onClick={enableNotifications}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-brand/40 bg-card py-3 text-sm font-semibold text-brand hover:bg-brand/5"
          >
            <Bell className="h-4 w-4" /> Enable notifications for order updates
          </button>
        )}

        <a
          href={waLink(branch?.phone, waText)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 text-sm font-bold text-white hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" /> Send confirmation on WhatsApp
        </a>

        <div className="mt-6 rounded-xl border border-border bg-card p-4 text-sm space-y-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Customer</div>
            <div className="font-semibold">{order.customer_name}</div>
            <div className="text-muted-foreground">{order.customer_phone}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Type</div>
            <div className="font-semibold capitalize">{order.fulfillment}</div>
            {order.delivery_notes && <div className="text-muted-foreground text-xs mt-1">{order.delivery_notes}</div>}
          </div>
          {branch && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Branch</div>
              <div className="font-semibold">{branch.name}</div>
              <div className="text-muted-foreground text-xs">{branch.address}, {branch.city}</div>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm space-y-1.5">
          {items.map((i, idx) => (
            <div key={idx} className="flex justify-between gap-3">
              <span className="truncate"><span className="font-bold text-brand">{i.quantity}×</span> {i.item_name}</span>
              <span className="tabular-nums shrink-0">{formatZAR(i.unit_price_cents * i.quantity)}</span>
            </div>
          ))}
          <div className="mt-3 flex justify-between border-t border-border pt-3">
            <span className="font-bold">Total</span>
            <span className="font-display text-xl text-brand">{formatZAR(order.subtotal_cents)}</span>
          </div>
        </div>

        <Link to="/menu" className="mt-6 block text-center text-sm font-bold text-brand">
          ← Back to menu
        </Link>
      </div>
    </div>
  );
}
