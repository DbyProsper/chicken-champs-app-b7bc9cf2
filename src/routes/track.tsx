import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track your order — Champs Chicken" },
      { name: "description", content: "Track a Champs Chicken order with your order number." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Track,
});

function Track() {
  const nav = useNavigate();
  const [num, setNum] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem("champs-orders") || "[]"));
    } catch {}
  }, []);

  return (
    <div className="min-h-screen pb-24">
      <Header subtitle="Track Order" />
      <div className="mx-auto max-w-lg px-4 py-6">
        <h1 className="font-display text-3xl">Where's my order?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your order number (e.g. CH-1001).</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const clean = num.trim().toUpperCase();
            if (clean) nav({ to: "/order/$number", params: { number: clean } });
          }}
          className="mt-4 flex gap-2"
        >
          <input
            className="flex-1 rounded-xl border border-input bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="CH-1001"
            value={num}
            onChange={(e) => setNum(e.target.value)}
          />
          <button className="rounded-xl bg-brand px-5 text-sm font-bold text-brand-foreground">Look up</button>
        </form>

        {recent.length > 0 && (
          <div className="mt-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Your recent orders</div>
            <div className="space-y-2">
              {recent.map((n) => (
                <Link
                  key={n}
                  to="/order/$number"
                  params={{ number: n }}
                  className="block rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:border-brand"
                >
                  {n}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
