import { supabase } from "@/integrations/supabase/client";

export type DeliverySettings = {
  max_radius_km: number;
  tier1_max_km: number;
  tier1_fee_cents: number;
  tier2_max_km: number;
  tier2_fee_cents: number;
  tier3_max_km: number;
  tier3_fee_cents: number;
  base_prep_min: number;
  avg_stop_min: number;
  peak_threshold: number;
  max_wait_min: number;
  normal_capacity_min: number;
  normal_capacity_max: number;
  peak_capacity_min: number;
  peak_capacity_max: number;
};

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  max_radius_km: 6,
  tier1_max_km: 2,
  tier1_fee_cents: 2500,
  tier2_max_km: 4,
  tier2_fee_cents: 4000,
  tier3_max_km: 6,
  tier3_fee_cents: 5500,
  base_prep_min: 25,
  avg_stop_min: 8,
  peak_threshold: 8,
  max_wait_min: 10,
  normal_capacity_min: 3,
  normal_capacity_max: 5,
  peak_capacity_min: 2,
  peak_capacity_max: 4,
};

export async function fetchDeliverySettings(): Promise<DeliverySettings> {
  const { data } = await supabase
    .from("delivery_settings")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (!data) return DEFAULT_DELIVERY_SETTINGS;
  const d = data as Record<string, unknown>;
  const num = (k: string, fallback: number) => (d[k] == null ? fallback : Number(d[k]));
  return {
    max_radius_km: num("max_radius_km", DEFAULT_DELIVERY_SETTINGS.max_radius_km),
    tier1_max_km: num("tier1_max_km", DEFAULT_DELIVERY_SETTINGS.tier1_max_km),
    tier1_fee_cents: num("tier1_fee_cents", DEFAULT_DELIVERY_SETTINGS.tier1_fee_cents),
    tier2_max_km: num("tier2_max_km", DEFAULT_DELIVERY_SETTINGS.tier2_max_km),
    tier2_fee_cents: num("tier2_fee_cents", DEFAULT_DELIVERY_SETTINGS.tier2_fee_cents),
    tier3_max_km: num("tier3_max_km", DEFAULT_DELIVERY_SETTINGS.tier3_max_km),
    tier3_fee_cents: num("tier3_fee_cents", DEFAULT_DELIVERY_SETTINGS.tier3_fee_cents),
    base_prep_min: num("base_prep_min", DEFAULT_DELIVERY_SETTINGS.base_prep_min),
    avg_stop_min: num("avg_stop_min", DEFAULT_DELIVERY_SETTINGS.avg_stop_min),
    peak_threshold: num("peak_threshold", DEFAULT_DELIVERY_SETTINGS.peak_threshold),
    max_wait_min: num("max_wait_min", DEFAULT_DELIVERY_SETTINGS.max_wait_min),
    normal_capacity_min: num("normal_capacity_min", DEFAULT_DELIVERY_SETTINGS.normal_capacity_min),
    normal_capacity_max: num("normal_capacity_max", DEFAULT_DELIVERY_SETTINGS.normal_capacity_max),
    peak_capacity_min: num("peak_capacity_min", DEFAULT_DELIVERY_SETTINGS.peak_capacity_min),
    peak_capacity_max: num("peak_capacity_max", DEFAULT_DELIVERY_SETTINGS.peak_capacity_max),
  };
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type DeliveryQuote =
  | { ok: true; distance_km: number; fee_cents: number }
  | { ok: false; distance_km: number; reason: string };

export function quoteDelivery(distance: number, s: DeliverySettings): DeliveryQuote {
  const km = Math.round(distance * 100) / 100;
  if (km > s.max_radius_km) {
    return { ok: false, distance_km: km, reason: "Delivery not available in your area" };
  }
  let fee = s.tier3_fee_cents;
  if (km <= s.tier1_max_km) fee = s.tier1_fee_cents;
  else if (km <= s.tier2_max_km) fee = s.tier2_fee_cents;
  else if (km <= s.tier3_max_km) fee = s.tier3_fee_cents;
  return { ok: true, distance_km: km, fee_cents: fee };
}

export function getBrowserLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

export const DELIVERY_STATUS_FLOW = ["pending", "accepted", "picked_up", "on_the_way", "delivered"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUS_FLOW)[number];

export const DELIVERY_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  picked_up: "Picked up",
  on_the_way: "On the way",
  delivered: "Delivered",
};

export type DeliveryMode = "normal" | "peak";

export function computeMode(activeCount: number, s: DeliverySettings): DeliveryMode {
  return activeCount >= s.peak_threshold ? "peak" : "normal";
}

export function capacityForMode(mode: DeliveryMode, s: DeliverySettings): { min: number; max: number } {
  return mode === "peak"
    ? { min: s.peak_capacity_min, max: s.peak_capacity_max }
    : { min: s.normal_capacity_min, max: s.normal_capacity_max };
}

/**
 * ETA range in minutes for a customer whose delivery sits at `position` in the driver's queue (1-based).
 * Formula: base + position * avg_stop (with a +/- window around it).
 */
export function computeEtaRange(
  position: number,
  s: DeliverySettings,
  mode: DeliveryMode = "normal",
): { min: number; max: number } {
  const pos = Math.max(1, position);
  const center = s.base_prep_min + pos * s.avg_stop_min;
  const spread = mode === "peak" ? 10 : 7;
  return { min: Math.max(15, center - spread), max: center + spread };
}

export async function fetchActiveDeliveryCount(): Promise<number> {
  const { count } = await supabase
    .from("deliveries")
    .select("id", { count: "exact", head: true })
    .neq("status", "delivered");
  return count ?? 0;
}

export async function fetchOnlineDriverCount(): Promise<number> {
  const { data, error } = await supabase.rpc("online_drivers_count");
  if (error) return 0;
  return Number(data ?? 0);
}

export async function triggerAutoAssign(): Promise<number> {
  const { data, error } = await supabase.rpc("auto_assign_pending_deliveries");
  if (error) return 0;
  return Number(data ?? 0);
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  not_paid: "Not paid",
  pending: "Awaiting driver confirmation",
  paid: "Paid",
};


