const STROKE = 1.75;

function Svg({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg
      role="img"
      aria-label={label}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3 h-3"
    >
      {children}
    </svg>
  );
}

export function getCategoryIcon(nameOrSlug: string) {
  const s = (nameOrSlug || "").toLowerCase();

  if (s.includes("chicken")) {
    return (
      <Svg label="Chicken">
        <path d="M4 21c4-4 9-4 12 0" />
        <circle cx="17" cy="6" r="3" />
      </Svg>
    );
  }

  if (s.includes("combo") || s.includes("combos") || s.includes("meal")) {
    return (
      <Svg label="Combos">
        <rect x="2" y="7" width="20" height="10" rx="2" />
        <path d="M7 7v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
      </Svg>
    );
  }

  if (s.includes("burger")) {
    return (
      <Svg label="Burgers">
        <path d="M3 12c1-3 2-4 6-4s5 1 6 4" />
        <path d="M21 12v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      </Svg>
    );
  }

  if (s.includes("fish")) {
    return (
      <Svg label="Fish">
        <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" />
        <circle cx="9" cy="12" r="1" />
      </Svg>
    );
  }

  if (s.includes("chips") || s.includes("fries")) {
    return (
      <Svg label="Chips">
        <path d="M6 3l2 18" />
        <path d="M10 3l2 18" />
        <path d="M14 3l2 18" />
      </Svg>
    );
  }

  if (s.includes("sauce") || s.includes("sauces") || s.includes("dip")) {
    return (
      <Svg label="Sauces">
        <path d="M12 2c2 2 4 3 4 6 0 3-2 6-4 6s-4-3-4-6c0-3 2-4 4-6z" />
        <path d="M8 20h8v2H8z" />
      </Svg>
    );
  }

  if (s.includes("drink") || s.includes("pepsi") || s.includes("coke") || s.includes("powerade") || s.includes("spar")) {
    return (
      <Svg label="Drinks">
        <path d="M8 4h8l-1 12a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1L8 4z" />
        <path d="M10 9h4" />
      </Svg>
    );
  }

  if (s.includes("dessert") || s.includes("sundae")) {
    return (
      <Svg label="Desserts">
        <path d="M12 2s4 3 4 6a4 4 0 0 1-8 0c0-3 4-6 4-6z" />
        <path d="M8 20h8" />
      </Svg>
    );
  }

  if (s.includes("shake") || s.includes("frostee") || s.includes("milkshake") || s.includes("sundae")) {
    return (
      <Svg label="Shakes">
        <path d="M8 2h8l-2 8a4 4 0 0 1-4 0L8 2z" />
        <path d="M9 14c1 2 3 2 5 0" />
      </Svg>
    );
  }

  // default
  return (
    <Svg label="Category">
      <path d="M12 2l1.5 4L18 8l-4.5 1.5L12 14l-1.5-4L6 8l4.5-2L12 2z" />
    </Svg>
  );
}

export function getMenuIconForItem(name: string, variant?: string) {
  // Smaller inline icon used in item descriptions — same visual language but no container
  const s = `${name ?? ""} ${variant ?? ""}`.toLowerCase();

  if (/shake|frostee|milkshake|smoothie|sundae/.test(s)) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" className="inline-block w-3 h-3 mr-0">
        <path d="M12 2s4 3 4 6a4 4 0 0 1-8 0c0-3 4-6 4-6z" />
        <path d="M8 20h8" />
      </svg>
    );
  }
  if (/(drink|pepsi|coke|mountain dew|powerade|spar letta|spar)/.test(s)) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" className="inline-block w-3 h-3 mr-0">
        <path d="M8 4h8l-1 12a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1L8 4z" />
        <path d="M10 9h4" />
      </svg>
    );
  }
  if (/chicken|drumstick|fried chicken|wing|thigh|breast/.test(s)) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" className="inline-block w-3 h-3 mr-0">
        <path d="M4 21c4-4 9-4 12 0" />
        <circle cx="17" cy="6" r="3" />
      </svg>
    );
  }
  if (/(?:\bfish\b|cod|hake|prawn|prawns|shrimp|seafood)/.test(s)) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" className="inline-block w-3 h-3 mr-0">
        <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" />
        <circle cx="9" cy="12" r="1" />
      </svg>
    );
  }
  if (/chips|fries/.test(s)) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" className="inline-block w-3 h-3 mr-0">
        <path d="M6 3l2 18" />
        <path d="M10 3l2 18" />
        <path d="M14 3l2 18" />
      </svg>
    );
  }
  // fallback
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" className="inline-block w-3 h-3 mr-0">
      <path d="M12 2l1.5 4L18 8l-4.5 1.5L12 14l-1.5-4L6 8l4.5-2L12 2z" />
    </svg>
  );
}

export default getMenuIconForItem;
