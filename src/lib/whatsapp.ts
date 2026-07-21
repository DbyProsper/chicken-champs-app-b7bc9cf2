export function waLink(phone: string | null | undefined, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function orderStatusMessage(orderNumber: string, status: string, customer: string) {
  const s: Record<string, string> = {
    pending: `Hi ${customer}, we've received your Champs order ${orderNumber}. We'll start preparing it shortly! 🍗`,
    preparing: `Hi ${customer}, your Champs order ${orderNumber} is being prepared right now.`,
    ready: `Hi ${customer}, your Champs order ${orderNumber} is ready and waiting for handoff.`,
    handed_to_driver: `Hi ${customer}, your Champs order ${orderNumber} has been handed to the driver.`,
    picked_up: `Hi ${customer}, your Champs order ${orderNumber} has been picked up by the driver.`,
    on_the_way: `Hi ${customer}, your Champs order ${orderNumber} is on the way.`,
    out_for_delivery: `Hi ${customer}, your Champs order ${orderNumber} is out for delivery. See you soon!`,
    completed: `Thanks ${customer}! Your Champs order ${orderNumber} is complete. Enjoy — we love to please! ❤️`,
    cancelled: `Hi ${customer}, unfortunately your Champs order ${orderNumber} was cancelled. Please contact us for details.`,
  };
  return s[status] ?? `Update on your Champs order ${orderNumber}: ${status}`;
}
