import { supabase } from "@/integrations/supabase/client";

export type DeliverySettings = {
  max_radius_km: number;
  tier1_max_km: number;
  tier1_fee_cents: number;
  tier2_max_km: number;
  tier2_fee_cents: number;
  tier3_max_km: number;
  tier3_fee_cents: number;
};

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  max_radius_km: 6,
  tier1_max_km: 2,
  tier1_fee_cents: 2500,
  tier2_max_km: 4,
  tier2_fee_cents: 4000,
  tier3_max_km: 6,
  tier3_fee_cents: 5500,
};

export async function fetchDeliverySettings(): Promise<DeliverySettings> {
  const { data } = await supabase
    .from("delivery_settings")
    .select("max_radius_km, tier1_max_km, tier1_fee_cents, tier2_max_km, tier2_fee_cents, tier3_max_km, tier3_fee_cents")
    .eq("id", "default")
    .maybeSingle();
  if (!data) return DEFAULT_DELIVERY_SETTINGS;
  return {
    max_radius_km: Number(data.max_radius_km),
    tier1_max_km: Number(data.tier1_max_km),
    tier1_fee_cents: Number(data.tier1_fee_cents),
    tier2_max_km: Number(data.tier2_max_km),
    tier2_fee_cents: Number(data.tier2_fee_cents),
    tier3_max_km: Number(data.tier3_max_km),
    tier3_fee_cents: Number(data.tier3_fee_cents),
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
