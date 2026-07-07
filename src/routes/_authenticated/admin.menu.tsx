import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatZAR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/menu")({
  head: () => ({ meta: [{ title: "Edit Menu — Champs Admin" }, { name: "robots", content: "noindex" }] }),
  component: MenuAdmin,
});

type Item = {
  id: string;
  name: string;
  variant_label: string | null;
  description: string | null;
  price_cents: number;
  is_available: boolean;
  category_id: string;
  sort_order: number;
};
type Cat = { id: string; name: string; slug: string; sort_order: number };

function MenuAdmin() {
  const [items, setItems] = useState<Item[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [dirty, setDirty] = useState<Record<string, Partial<Item>>>({});
  const [newItem, setNewItem] = useState<Record<string, { name: string; variant: string; price: string }>>({});
  const [newCat, setNewCat] = useState("");

  async function load() {
    const [i, c] = await Promise.all([
      supabase.from("menu_items").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("sort_order"),
    ]);
    setItems((i.data as Item[]) ?? []);
    setCats((c.data as Cat[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  function edit(id: string, patch: Partial<Item>) {
    setDirty((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  async function saveAll() {
    const entries = Object.entries(dirty);
    if (entries.length === 0) return;
    for (const [id, patch] of entries) {
      const { error } = await supabase.from("menu_items").update(patch).eq("id", id);
      if (error) { toast.error(`${id}: ${error.message}`); return; }
    }
    toast.success("Saved");
    setDirty({});
    load();
  }

  async function addItem(catId: string) {
    const n = newItem[catId];
    if (!n || !n.name.trim() || !n.price) { toast.error("Name & price required"); return; }
    const maxSort = Math.max(0, ...items.filter((i) => i.category_id === catId).map((i) => i.sort_order));
    const { error } = await supabase.from("menu_items").insert({
      category_id: catId,
      name: n.name.trim(),
      variant_label: n.variant.trim() || null,
      price_cents: Math.round(Number(n.price) * 100),
      sort_order: maxSort + 10,
    } as never);
    if (error) toast.error(error.message);
    else {
      toast.success("Item added");
      setNewItem({ ...newItem, [catId]: { name: "", variant: "", price: "" } });
      load();
    }
  }

  async function removeItem(id: string) {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); load(); }
  }

  async function addCategory() {
    if (!newCat.trim()) return;
    const slug = newCat.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const maxSort = Math.max(0, ...cats.map((c) => c.sort_order));
    const { error } = await supabase.from("categories").insert({ name: newCat.trim(), slug, sort_order: maxSort + 10 } as never);
    if (error) toast.error(error.message);
    else { toast.success("Category added"); setNewCat(""); load(); }
  }

  return (
    <div className="min-h-screen bg-muted/40 pb-20">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/_authenticated/admin" className="inline-flex items-center gap-1 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Orders</Link>
          <div className="font-display text-xl text-brand">Edit Menu</div>
          <button onClick={saveAll} disabled={Object.keys(dirty).length === 0} className="inline-flex items-center gap-1 rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-brand-foreground disabled:opacity-40">
            <Save className="h-3.5 w-3.5" /> Save {Object.keys(dirty).length || ""}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-4 space-y-6">
        {/* Add category */}
        <div className="rounded-xl border bg-card p-3 flex items-center gap-2">
          <input className="flex-1 rounded-md border px-3 py-2 text-sm" placeholder="New category name" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <button onClick={addCategory} className="rounded-full bg-brand px-4 py-2 text-xs font-bold text-brand-foreground">Add category</button>
        </div>

        {cats.map((c) => {
          const catItems = items.filter((i) => i.category_id === c.id);
          const ni = newItem[c.id] ?? { name: "", variant: "", price: "" };
          return (
            <section key={c.id}>
              <h2 className="font-display text-2xl text-brand mb-2">{c.name}</h2>
              <div className="rounded-2xl border bg-card divide-y">
                {catItems.map((it) => {
                  const patch = dirty[it.id] ?? {};
                  const cur = { ...it, ...patch };
                  return (
                    <div key={it.id} className="flex flex-wrap items-center gap-2 p-3">
                      <input
                        className="flex-1 min-w-40 rounded-md border px-2 py-1.5 text-sm"
                        value={cur.name}
                        onChange={(e) => edit(it.id, { name: e.target.value })}
                      />
                      <input
                        className="w-32 rounded-md border px-2 py-1.5 text-sm"
                        placeholder="variant"
                        value={cur.variant_label ?? ""}
                        onChange={(e) => edit(it.id, { variant_label: e.target.value || null })}
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">R</span>
                        <input
                          type="number" step="0.01" min="0"
                          className="w-24 rounded-md border px-2 py-1.5 text-sm tabular-nums"
                          value={((cur.price_cents ?? 0) / 100).toFixed(2)}
                          onChange={(e) => edit(it.id, { price_cents: Math.round(Number(e.target.value) * 100) })}
                        />
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={cur.is_available}
                          onChange={(e) => edit(it.id, { is_available: e.target.checked })}
                        />
                        Available
                      </label>
                      <span className="text-xs text-muted-foreground tabular-nums">{formatZAR(cur.price_cents ?? 0)}</span>
                      <button onClick={() => removeItem(it.id)} className="ml-auto grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-brand hover:bg-brand/10" aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
                {/* Add new item to category */}
                <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/40">
                  <input
                    className="flex-1 min-w-40 rounded-md border px-2 py-1.5 text-sm"
                    placeholder="New item name"
                    value={ni.name}
                    onChange={(e) => setNewItem({ ...newItem, [c.id]: { ...ni, name: e.target.value } })}
                  />
                  <input
                    className="w-32 rounded-md border px-2 py-1.5 text-sm"
                    placeholder="variant"
                    value={ni.variant}
                    onChange={(e) => setNewItem({ ...newItem, [c.id]: { ...ni, variant: e.target.value } })}
                  />
                  <input
                    type="number" step="0.01"
                    className="w-24 rounded-md border px-2 py-1.5 text-sm"
                    placeholder="R"
                    value={ni.price}
                    onChange={(e) => setNewItem({ ...newItem, [c.id]: { ...ni, price: e.target.value } })}
                  />
                  <button onClick={() => addItem(c.id)} className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-brand-foreground">
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
