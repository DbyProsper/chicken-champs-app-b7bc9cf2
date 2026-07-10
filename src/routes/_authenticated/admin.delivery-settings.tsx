import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DEFAULT_DELIVERY_SETTINGS, type DeliverySettings } from "@/lib/delivery";

export const Route = createFileRoute("/_authenticated/admin/delivery-settings")({
  head: () => ({ meta: [{ title: "Delivery Settings — Champs Admin" }, { name: "robots", content: "noindex" }] }),
  component: DeliverySettingsPage,
});

function DeliverySettingsPage() {
  const [s, setS] = useState<DeliverySettings>(DEFAULT_DELIVERY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("delivery_settings").select("*").eq("id", "default").maybeSingle();
      if (data) {
        setS({
          max_radius_km: Number(data.max_radius_km),
          tier1_max_km: Number(data.tier1_max_km),
          tier1_fee_cents: Number(data.tier1_fee_cents),
          tier2_max_km: Number(data.tier2_max_km),
          tier2_fee_cents: Number(data.tier2_fee_cents),
          tier3_max_km: Number(data.tier3_max_km),
          tier3_fee_cents: Number(data.tier3_fee_cents),
        });
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("delivery_settings").update(s as never).eq("id", "default");
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Delivery settings saved");
  }

  const field = (label: string, key: keyof DeliverySettings, step = 0.1) => (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input
        type="number"
        step={step}
        value={s[key]}
        onChange={(e) => setS({ ...s, [key]: Number(e.target.value) })}
        className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm"
      />
    </label>
  );

  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>;

  return (
    <div className="min-h-screen bg-muted/40 pb-20">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/admin" className="inline-flex items-center gap-1 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Admin</Link>
          <div className="font-display text-xl text-brand">Delivery Settings</div>
          <div className="w-16" />
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="font-display text-lg text-brand mb-3">Radius</h2>
          {field("Max delivery radius (km)", "max_radius_km")}
        </section>
        <section className="rounded-2xl border bg-card p-4 space-y-3">
          <h2 className="font-display text-lg text-brand">Fee tiers</h2>
          <div className="grid grid-cols-2 gap-3">
            {field("Tier 1 max km", "tier1_max_km")}
            {field("Tier 1 fee (cents)", "tier1_fee_cents", 100)}
            {field("Tier 2 max km", "tier2_max_km")}
            {field("Tier 2 fee (cents)", "tier2_fee_cents", 100)}
            {field("Tier 3 max km", "tier3_max_km")}
            {field("Tier 3 fee (cents)", "tier3_fee_cents", 100)}
          </div>
          <p className="text-xs text-muted-foreground">Fees are in cents (2500 = R25.00). Distance is measured in a straight line from the branch to the customer.</p>
        </section>
        <button onClick={save} disabled={saving} className="w-full rounded-full bg-brand py-3 text-sm font-bold text-brand-foreground inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
        </button>
      </div>
    </div>
  );
}
