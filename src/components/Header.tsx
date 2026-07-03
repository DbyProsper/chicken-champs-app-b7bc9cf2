import { Link } from "@tanstack/react-router";
import logo from "@/assets/champs-logo.jpeg.asset.json";

export function Header({ subtitle }: { subtitle?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo.url} alt="Champs Chicken" className="h-10 w-auto" />
          <div className="leading-tight">
            <div className="font-display text-lg text-brand">Champs Chicken</div>
            {subtitle && <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{subtitle}</div>}
          </div>
        </Link>
      </div>
    </header>
  );
}
