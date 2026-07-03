import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Clock, ChevronRight, Flame } from "lucide-react";
import logo from "@/assets/champs-logo.jpeg.asset.json";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Champs Chicken — Fried Chicken in Dikeni Since 1995" },
      { name: "description", content: "Order Champs Chicken online for pickup or delivery. Chicken, chips, burgers, fish, combos & shakes at 166 Garden St, Dikeni." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen pb-20">
      <Header subtitle="Dikeni · Since 1995" />

      {/* Hero */}
      <section className="bg-chalk relative overflow-hidden text-white">
        <div className="mx-auto max-w-lg px-5 py-10">
          <div className="flex items-center gap-2 text-brand text-xs font-bold uppercase tracking-widest">
            <Flame className="h-4 w-4" /> Now taking online orders
          </div>
          <h1 className="mt-3 font-display text-5xl leading-none">
            Crispy. Bold.<br />
            <span className="text-brand">Champs Chicken.</span>
          </h1>
          <p className="mt-4 text-sm text-white/70 max-w-xs">
            Freshly fried chicken, loaded chips and legendary combos. Order for pickup or delivery in Dikeni.
          </p>
          <div className="mt-6 flex gap-3">
            <Link to="/menu" className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-brand-foreground hover:bg-brand-dark transition-colors">
              Order now <ChevronRight className="h-4 w-4" />
            </Link>
            <Link to="/track" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
              Track order
            </Link>
          </div>
          <img
            src={logo.url}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -right-8 -bottom-8 h-56 w-56 opacity-10"
          />
        </div>
      </section>

      {/* Quick categories */}
      <section className="mx-auto max-w-lg px-5 py-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-2xl">Browse the menu</h2>
          <Link to="/menu" className="text-sm font-semibold text-brand">See all</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { title: "Chicken", desc: "1pc → 21pc bucket", emoji: "🍗", slug: "chicken" },
            { title: "Combos", desc: "Chicken + chips", emoji: "🍱", slug: "combos" },
            { title: "Burgers", desc: "Mississippi, Dekka", emoji: "🍔", slug: "burgers" },
            { title: "Chips", desc: "Small · Reg · Large", emoji: "🍟", slug: "chips" },
          ].map((c) => (
            <Link
              key={c.slug}
              to="/menu"
              hash={c.slug}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 hover:border-brand transition-colors"
            >
              <div className="text-3xl">{c.emoji}</div>
              <div className="mt-2 font-display text-lg">{c.title}</div>
              <div className="text-xs text-muted-foreground">{c.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Store info */}
      <section className="mx-auto max-w-lg px-5 pb-6">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-brand mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold">166 Garden Street</div>
              <div className="text-muted-foreground">Dikeni, 5700</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-brand mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold">Open every day</div>
              <div className="text-muted-foreground">From 8:00 AM</div>
            </div>
          </div>
        </div>
      </section>

      <BottomNav />
    </div>
  );
}
