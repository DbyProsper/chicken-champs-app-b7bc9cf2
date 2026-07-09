export type MenuImageDescriptor = {
  src: string;
  alt: string;
};

const IMAGE_BASE = "/images/menu images";
const DEFAULT_IMAGE = "/images/champs/chef.jpg";

const IMAGE_MAP: Array<{ pattern: RegExp; src: string; alt: string }> = [
  // Specific piece/meal entries (must come first)
  { pattern: /\b1 piece chicken\b/, src: `${IMAGE_BASE}/1 piece chicken.png`, alt: "1 piece chicken" },
  { pattern: /\b2 piece chicken\b/, src: `${IMAGE_BASE}/2 piece chicken.png`, alt: "2 piece chicken" },
  { pattern: /\b3 piece chicken\b/, src: `${IMAGE_BASE}/3 piece chicken.png`, alt: "3 piece chicken" },
  { pattern: /\b4 piece chicken\b/, src: `${IMAGE_BASE}/4 piece chicken.png`, alt: "4 piece chicken" },
  { pattern: /\b5 piece chicken\b/, src: `${IMAGE_BASE}/5 piece chicken.png`, alt: "5 piece chicken" },
  { pattern: /\b9 piece chicken\b/, src: `${IMAGE_BASE}/9 piece chicken.png`, alt: "9 piece chicken" },
  { pattern: /\b21 piece chicken\b/, src: `${IMAGE_BASE}/21 piece chicken.png`, alt: "21 piece chicken" },
  { pattern: /\bfried chicken\b/, src: `${IMAGE_BASE}/1 piece chicken.png`, alt: "Fried chicken" },

  // Salads / fish / combos
  { pattern: /chicken salad/, src: `${IMAGE_BASE}/Chicken salad.png`, alt: "Chicken salad" },
  { pattern: /fish\s*(?:&|and)\s*chips/, src: `${IMAGE_BASE}/Fish & Chips.png`, alt: "Fish and chips" },
  { pattern: /\b1 piece fish\b/, src: `${IMAGE_BASE}/1 piece fish .png`, alt: "1 piece fish" },
  { pattern: /fish burger/, src: `${IMAGE_BASE}/Fish Burger.png`, alt: "Fish burger" },
  { pattern: /fish salad/, src: `${IMAGE_BASE}/Fish Salad.png`, alt: "Fish salad" },
  

  // Burgers (specific first)
  { pattern: /double dekka burger|\bdouble dekka\b/, src: `${IMAGE_BASE}/Double Dekka Burger.png`, alt: "Double Dekka Burger" },
  { pattern: /mississippi burger/, src: `${IMAGE_BASE}/Mississippi Burger.png`, alt: "Mississippi Burger" },
  { pattern: /double stack cheese burger|\bdouble stack cheese\b/, src: `${IMAGE_BASE}/Double Stack Cheese Burger.png`, alt: "Double Stack Cheese Burger" },
  { pattern: /\bchicken burger\b|crispy chicken burger|spicy chicken burger/, src: `${IMAGE_BASE}/Double Dekka Burger.png`, alt: "Chicken burger" },

  // Combos
  { pattern: /combo 1/, src: `${IMAGE_BASE}/Combo 1.png`, alt: "Combo 1" },
  { pattern: /combo 2/, src: `${IMAGE_BASE}/Combo 2.png`, alt: "Combo 2" },
  { pattern: /combo 3/, src: `${IMAGE_BASE}/Combo 3.png`, alt: "Combo 3" },
  { pattern: /combo 4/, src: `${IMAGE_BASE}/Combo 4.png`, alt: "Combo 4" },
  { pattern: /combo 5/, src: `${IMAGE_BASE}/Combo 5.png`, alt: "Combo 5" },
  { pattern: /combo 6/, src: `${IMAGE_BASE}/Combo 6.png`, alt: "Combo 6" },

  // Chips
  { pattern: /chips - large/, src: `${IMAGE_BASE}/Chips - Large.png`, alt: "Large chips" },
  { pattern: /chips - regular/, src: `${IMAGE_BASE}/Chips - Regular.png`, alt: "Regular chips" },
  { pattern: /chips - small/, src: `${IMAGE_BASE}/Chips - Small.png`, alt: "Small chips" },

  // Shakes, desserts, soft-serve
  { pattern: /frostee shake - choc/, src: `${IMAGE_BASE}/Frostee Shake - Choc.png`, alt: "Chocolate Frostee Shake" },
  { pattern: /frostee shake - lime/, src: `${IMAGE_BASE}/Frostee Shake - Lime.png`, alt: "Lime Frostee Shake" },
  { pattern: /frostee shake - strawberry/, src: `${IMAGE_BASE}/Frostee Shake - Strawberry.png`, alt: "Strawberry Frostee Shake" },
  { pattern: /soft serve cone/, src: `${IMAGE_BASE}/Soft serve cone.png`, alt: "Soft serve cone" },
  { pattern: /soft serve cup/, src: `${IMAGE_BASE}/Soft serve cup.png`, alt: "Soft serve cup" },
  { pattern: /sundae - caramel/, src: `${IMAGE_BASE}/Sundae - Caramel.png`, alt: "Caramel sundae" },
  { pattern: /sundae - choc/, src: `${IMAGE_BASE}/Sundae - Choc.png`, alt: "Chocolate sundae" },
  { pattern: /sundae - strawberry/, src: `${IMAGE_BASE}/Sundae - Strawberry.png`, alt: "Strawberry sundae" },
  { pattern: /buns?/, src: `${IMAGE_BASE}/Buns.png`, alt: "Buns" },
  { pattern: /pepsi\s*can|pespsi\s*can/, src: `${IMAGE_BASE}/Pespsi Can.png`, alt: "Pepsi can" },
  { pattern: /pepsi\s*2l/, src: `${IMAGE_BASE}/Pepsi 2L.png`, alt: "Pepsi 2L" },
  { pattern: /mountain\s*dew\s*can/, src: `${IMAGE_BASE}/Mountain Dew Can.png`, alt: "Mountain Dew can" },
  { pattern: /coke\s*2l/, src: `${IMAGE_BASE}/Coke 2L.png`, alt: "Coke 2L" },
  { pattern: /powerade\s*500ml/, src: `${IMAGE_BASE}/Powerade 500ml.png`, alt: "Powerade 500ml" },
  { pattern: /spar\s*letta\s*2l/, src: `${IMAGE_BASE}/Spar Letta 2L.png`, alt: "Spar Letta 2L" },

  // Sauces
  { pattern: /hot chilli sauce/, src: `${IMAGE_BASE}/Hot chilli sauce.png`, alt: "Hot chilli sauce" },
  { pattern: /mustard sauce/, src: `${IMAGE_BASE}/Mustard Sauce.png`, alt: "Mustard sauce" },
  { pattern: /sweet chilli sauce/, src: `${IMAGE_BASE}/Sweet Chilli Sauce.png`, alt: "Sweet chilli sauce" },
  { pattern: /tomato sauce/, src: `${IMAGE_BASE}/Tomato Sauce.png`, alt: "Tomato sauce" },
];

export function getMenuImageForItem(name: string, categoryName?: string | null): MenuImageDescriptor {
  const variant = (categoryName ?? "").toLowerCase().trim();
  const combined = `${name} ${variant}`.toLowerCase();

  // Handle variant-driven cases first (exact piece counts, chip sizes, shake/sundae flavours)
  if (variant) {
    // Piece counts (e.g. "1 Piece", "2 Pieces")
    const pieceMatch = variant.match(/(\d+)\s*pieces?|^(\d+)\s*piece/i);
    if (pieceMatch) {
      const count = pieceMatch[1] ?? pieceMatch[2];
      if (/chicken/.test(name.toLowerCase())) return { src: `${IMAGE_BASE}/${count} piece chicken.png`, alt: `${count} piece chicken` };
      if (/fish/.test(name.toLowerCase())) return { src: `${IMAGE_BASE}/${count} piece fish .png`, alt: `${count} piece fish` };
    }

    // Chips size variants
    if (/chips/.test(name.toLowerCase())) {
      // Prefer Fish & Chips image when the item also mentions fish
      if (/fish/.test(name.toLowerCase())) {
        return { src: `${IMAGE_BASE}/Fish & Chips.png`, alt: "Fish and chips" };
      }
      if (variant.includes("large")) return { src: `${IMAGE_BASE}/Chips - Large.png`, alt: "Large chips" };
      if (variant.includes("regular") || variant.includes("reg")) return { src: `${IMAGE_BASE}/Chips - Regular.png`, alt: "Regular chips" };
      if (variant.includes("small")) return { src: `${IMAGE_BASE}/Chips - Small.png`, alt: "Small chips" };
    }

    // Frostee shake flavours
    if (/frostee/.test(name.toLowerCase())) {
      if (variant.includes("choc") || variant.includes("chocolate")) return { src: `${IMAGE_BASE}/Frostee Shake - Choc.png`, alt: "Chocolate Frostee Shake" };
      if (variant.includes("lime")) return { src: `${IMAGE_BASE}/Frostee Shake - Lime.png`, alt: "Lime Frostee Shake" };
      if (variant.includes("straw")) return { src: `${IMAGE_BASE}/Frostee Shake - Strawberry.png`, alt: "Strawberry Frostee Shake" };
    }

    // Sundae flavours
    if (/sundae/.test(name.toLowerCase())) {
      if (variant.includes("caramel")) return { src: `${IMAGE_BASE}/Sundae - Caramel.png`, alt: "Caramel sundae" };
      if (variant.includes("choc") || variant.includes("chocolate")) return { src: `${IMAGE_BASE}/Sundae - Choc.png`, alt: "Chocolate sundae" };
      if (variant.includes("straw")) return { src: `${IMAGE_BASE}/Sundae - Strawberry.png`, alt: "Strawberry sundae" };
    }
  }

  for (const entry of IMAGE_MAP) {
    if (entry.pattern.test(combined)) {
      return { src: entry.src, alt: entry.alt };
    }
  }

  if (/(chips|fries|loaded|sides|side)/.test(combined)) {
    return { src: `${IMAGE_BASE}/Chips - Regular.png`, alt: "Chips" };
  }

  if (/\bcombo\b/.test(combined) || /(bucket|meal|family|party|tub)/.test(combined)) {
    return { src: `${IMAGE_BASE}/Combo 1.png`, alt: "Combo" };
  }

  if (/(burger|dekka|mississippi|stack|sandwich)/.test(combined)) {
    return { src: `${IMAGE_BASE}/Double Dekka Burger.png`, alt: "Burger" };
  }

  if (/\bfish\b/.test(combined)) {
    return { src: `${IMAGE_BASE}/1 piece fish .png`, alt: "Fish" };
  }

  if (/(shake|smoothie|float|milkshake)/.test(combined)) {
    return { src: `${IMAGE_BASE}/Frostee Shake - Choc.png`, alt: "Shake" };
  }

  if (/(dessert|cake|cookie|cone|ice|brownie|sweet|sundae)/.test(combined)) {
    return { src: `${IMAGE_BASE}/Soft serve cone.png`, alt: "Dessert" };
  }

  return { src: DEFAULT_IMAGE, alt: "Champs menu item" };
}
