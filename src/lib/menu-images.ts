export type MenuImageDescriptor = {
  src: string;
  alt: string;
};

const DEFAULT_IMAGE = "/images/chicken-bucket.svg";

export function getMenuImageForItem(name: string, categoryName?: string | null): MenuImageDescriptor {
  const combined = `${name} ${categoryName ?? ""}`.toLowerCase();

  if (/(burger|dekka|mississippi|beef|stack|sandwich)/.test(combined)) {
    return { src: "/images/burger.svg", alt: "Burger" };
  }

  if (/(fish|fillet|haddock|tuna|seafood)/.test(combined)) {
    return { src: "/images/fish.svg", alt: "Fish" };
  }

  if (/(dessert|cake|cookie|cone|ice|brownie|sweet)/.test(combined)) {
    return { src: "/images/dessert.svg", alt: "Dessert" };
  }

  if (/(shake|smoothie|float|milkshake)/.test(combined)) {
    return { src: "/images/shake.svg", alt: "Shake" };
  }

  if (/(chip|fries|loaded|sides|side)/.test(combined)) {
    return { src: "/images/chips.svg", alt: "Chips" };
  }

  if (/(combo|bucket|meal|family|party)/.test(combined)) {
    return { src: "/images/chicken-bucket.svg", alt: "Combo" };
  }

  return { src: DEFAULT_IMAGE, alt: "Champs menu item" };
}
