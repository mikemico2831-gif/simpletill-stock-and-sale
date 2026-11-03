import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole, peso } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({
    meta: [
      { title: "Cashier — Tindahan POS" },
      { name: "description", content: "Cashier register for ringing up sales." },
      { property: "og:title", content: "Cashier — Tindahan POS" },
      { property: "og:description", content: "Cashier register for ringing up sales." },
    ],
  }),
  loader: async () => ({ role: (await getMyRole()) ?? "cashier" }),
  component: Pos,
});

type Line = { id: string; name: string; price: number; qty: number; stock: number };

function Pos() {
  const { role } = Route.useLoaderData();
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [paid, setPaid] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = products.filter((p) =>
    `${p.name} ${p.sku ?? ""} ${p.category ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const total = useMemo(() => cart.reduce((s, l) => s + l.price * l.qty, 0), [cart]);
  const change = Number(paid || 0) - total;

  const add = (p: (typeof products)[number]) => {
    setCart((c) => {
      const ex = c.find((l) => l.id === p.id);
      if (ex) {
        if (ex.qty >= p.stock) { toast.error("No more stock"); return c; }
        return c.map((l) => (l.id === p.id ? { ...l, qty: l.qty + 1 } : l));
      }
      if (p.stock <= 0) { toast.error("Out of stock"); return c; }
      return [...c, { id: p.id, name: p.name, price: Number(p.price), qty: 1, stock: p.stock }];
    });
  };
  const setQty = (id: string, qty: number) =>
    setCart((c) => c.flatMap((l) => (l.id !== id ? [l] : qty <= 0 ? [] : [{ ...l, qty: Math.min(qty, l.stock) }])));

  const checkout = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("checkout", {
      _items: cart.map((l) => ({ product_id: l.id, qty: l.qty })),
      _paid: Number(paid || 0),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Sale complete. Change: ${peso(change)}`);
    setCart([]); setPaid("");
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["sales"] });
  };

  return (
    <div className="min-h-screen">
      <AppHeader role={role} title="Cashier register" />
      <main className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[1fr_380px]">
        <section>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => add(p)} disabled={p.stock <= 0}
                className="rounded-xl border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md disabled:opacity-40">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.category || "—"}</p>
                <p className="mt-1 font-semibold">{p.name}</p>
                <div className="mt-3 flex items-end justify-between">
                  <span className="font-display text-lg font-bold">{peso(Number(p.price))}</span>
                  <span className="text-xs text-muted-foreground">{p.stock} left</span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <p className="col-span-full py-10 text-center text-muted-foreground">No products found.</p>}
          </div>
        </section>
        <aside className="h-fit rounded-2xl border bg-card p-5 lg:sticky lg:top-6">
          <h2 className="text-xl font-bold">Current sale</h2>
          <div className="mt-4 max-h-[45vh] space-y-3 overflow-auto">
            {cart.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Tap a product to add it.</p>}
            {cart.map((l) => (
              <div key={l.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{peso(l.price)} × {l.qty}</p>
                </div>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(l.id, l.qty - 1)}><Minus className="h-3 w-3" /></Button>
                <span className="w-6 text-center text-sm">{l.qty}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(l.id, l.qty + 1)}><Plus className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setQty(l.id, 0)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3 border-t pt-4">
            <div className="flex justify-between font-display text-2xl font-bold"><span>Total</span><span>{peso(total)}</span></div>
            <Input type="number" min="0" step="0.01" placeholder="Cash received" value={paid} onChange={(e) => setPaid(e.target.value)} />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Change</span>
              <span className={change < 0 ? "text-destructive" : "text-success"}>{peso(Math.max(change, 0))}</span>
            </div>
            <Button size="lg" className="w-full" disabled={busy || cart.length === 0 || change < 0} onClick={checkout}>
              {busy ? "Processing…" : "Complete sale"}
            </Button>
          </div>
        </aside>
      </main>
    </div>
  );
}
