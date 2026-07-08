import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MapPin, Clock, ChevronRight, Flame, Sparkles, Phone } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { useBranch } from "@/lib/branch";
import { activePromotionsQuery } from "@/lib/user-queries";
import girlsBg from "@/assets/girls-lunch.jpg.asset.json";
import chickenHero from "@/assets/chicken-hero.jpg.asset.json";
import chickenChips from "@/assets/chicken-chips.jpg.asset.json";
import chef from "@/assets/chef.jpg.asset.json";
import couple from "@/assets/couple.jpg.asset.json";
import { formatZAR } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Champs Chicken — Fried Chicken Since 1995 | Dikeni & Fort Beaufort" },
      { name: "description", content: "Order Champs Chicken online for pickup or delivery. Chicken, chips, burgers, fish, combos & shakes. Now serving Dikeni and Fort Beaufort." },
      { property: "og:image", content: chickenHero.url },
      { name: "twitter:image", content: chickenHero.url },
    ],
  }),
  component: Home,
});

function Home() {
  const { active } = useBranch();
  const { data: promos = [] } = useQuery(activePromotionsQuery);

  return (
    <div className="min-h-screen pb-24">
      <Header subtitle={active ? active.city + " · Since 1995" : "Since 1995"} />

      {/* Hero with girls-lunch photo blended into brand dark */}
      <section className="relative overflow-hidden text-white">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${girlsBg.url})` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0708]/95 via-[#2b0a0c]/85 to-brand/70 mix-blend-multiply" aria-hidden />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,transparent_20%,rgba(0,0,0,0.85)_80%)]" aria-hidden />

        <div className="relative mx-auto max-w-lg px-5 py-14">
          <div className="flex items-center gap-2 text-white/90 text-[11px] font-bold uppercase tracking-widest">
            <Flame className="h-3.5 w-3.5 text-brand" /> Now taking online orders
          </div>
          <h1 className="mt-3 font-display text-6xl leading-[0.9] drop-shadow-lg">
            Crispy. Bold.<br />
            <span className="text-brand">Champs Chicken.</span>
          </h1>
          <p className="mt-4 text-sm text-white/85 max-w-xs">
            Freshly fried chicken, loaded chips and legendary combos. Order for pickup or delivery in {active?.city ?? "your town"}.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link to="/menu" className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-brand-foreground hover:bg-brand-dark transition-colors shadow-lg shadow-brand/40">
              Order now <ChevronRight className="h-4 w-4" />
            </Link>
            <Link to="/track" className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-black/20 backdrop-blur px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
              Track order
            </Link>
          </div>
        </div>
      </section>

      {/* Promotions strip */}
      {promos.length > 0 && (
        <section className="mx-auto max-w-lg px-5 pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-brand" />
            <h2 className="font-display text-2xl">Today's specials</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
            {promos.map((p) => (
              <div key={p.id} className="shrink-0 w-64 rounded-2xl border border-border bg-card p-4 relative overflow-hidden">
                {p.badge && (
                  <div className="absolute top-3 right-3 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-foreground uppercase tracking-wider">
                    {p.badge}
                  </div>
                )}
                <div className="font-display text-xl">{p.title}</div>
                {p.description && <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{p.description}</div>}
                {p.price_cents != null && (
                  <div className="mt-2 font-display text-2xl text-brand">{formatZAR(p.price_cents)}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick categories */}
      <section className="mx-auto max-w-lg px-5 pt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-2xl">Browse the menu</h2>
          <Link to="/menu" className="text-sm font-semibold text-brand">See all</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { title: "Chicken", desc: "1pc → 21pc bucket", img: chickenHero.url, slug: "chicken" },
            { title: "Combos", desc: "Chicken + chips", img: chickenChips.url, slug: "combos" },
            { title: "Burgers", desc: "Mississippi, Dekka", img: chef.url, slug: "burgers" },
            { title: "Shakes", desc: "Cold & creamy", img: couple.url, slug: "shakes" },
          ].map((c) => (
            <Link
              key={c.slug}
              to="/menu"
              hash={c.slug}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card aspect-[4/3] transition-colors"
            >
              <img src={c.img} alt="" className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="absolute bottom-0 inset-x-0 p-3 text-white">
                <div className="font-display text-xl">{c.title}</div>
                <div className="text-[11px] opacity-80">{c.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Brand strip */}
      <section className="mx-auto max-w-lg px-5 pt-6">
        <div className="grid grid-cols-2 gap-3">
          <img src={couple.url} alt="Customers enjoying Champs" className="rounded-2xl aspect-square object-cover" />
          <img src={chef.url} alt="Champs chef" className="rounded-2xl aspect-square object-cover" />
        </div>
        <p className="mt-3 text-center font-display text-2xl text-brand">We love to please.</p>
      </section>

      {/* Store info per active branch */}
      <section className="mx-auto max-w-lg px-5 pt-6">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Your branch</div>
            <span className="text-xs font-bold text-brand">{active?.name}</span>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-brand mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold">{active?.address ?? "—"}</div>
              <div className="text-muted-foreground">{active?.city}, {active?.postal_code}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-brand mt-0.5 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold">Open every day</div>
              <div className="text-muted-foreground">
                {active?.opens_at?.slice(0, 5)} – {active?.closes_at?.slice(0, 5)}
              </div>
            </div>
          </div>
          {active?.phone && (
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-brand mt-0.5 shrink-0" />
              <a href={`tel:${active.phone}`} className="text-sm font-semibold">{active.phone}</a>
            </div>
          )}
        </div>
      </section>

      <BottomNav />
    </div>
  );
}

