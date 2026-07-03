import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { formatZAR } from "@/lib/format";

const orderQuery = (number: string) =>
  queryOptions({
    queryKey: ["order", number],
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, customer_phone, fulfillment, delivery_notes, subtotal_cents, status, created_at")
        .eq("order_number", number)
        .maybeSingle();
      if (error) throw error;
      if (!order) return null;
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("item_name, unit_price_cents, quantity")
        .eq("order_id", order.id);
      return { order, items: itemsData ?? [] };
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

function OrderPage() {
  const { number } = Route.useParams();
  const { data, refetch } = useSuspenseQuery(orderQuery(number));

  // Realtime subscription for this order
  useEffect(() => {
    if (!data?.order.id) return;
    const ch = supabase
      .channel(`order-${data.order.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${data.order.id}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [data?.order.id, refetch]);

  if (!data) return <div className="p-6 text-sm">Order not found.</div>;
  const { order, items } = data;

  const waText = encodeURIComponent(
    `Hi Champs Chicken! I just placed order ${order.order_number} for ${order.customer_name} (${order.customer_phone}) — ${order.fulfillment}. Total ${formatZAR(order.subtotal_cents)}.`,
  );

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
        </div>

        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 text-sm font-bold text-white hover:opacity-90"
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

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Pay on collection at 166 Garden St, Dikeni.
        </p>
        <Link to="/menu" className="mt-4 block text-center text-sm font-bold text-brand">
          ← Back to menu
        </Link>
      </div>
    </div>
  );
}
