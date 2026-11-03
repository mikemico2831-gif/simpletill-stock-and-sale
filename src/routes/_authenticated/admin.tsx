import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { getMyRole, peso } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Product = Tables<"products">;

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Tindahan POS" },
      { name: "description", content: "Manage products and view sales." },
      { property: "og:title", content: "Admin — Tindahan POS" },
      { property: "og:description", content: "Manage products and view sales." },
    ],
  }),
  beforeLoad: async () => {
    if ((await getMyRole()) !== "admin") throw redirect({ to: "/pos" });
  },
  component: Admin,
});

const empty = { name: "", sku: "", category: "", price: "", stock: "" };

function Admin() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const today = new Date().toDateString();
  const todaySales = sales.filter((s) => new Date(s.created_at).toDateString() === today);
  const todayTotal = todaySales.reduce((a, s) => a + Number(s.total), 0);
  const lowStock = products.filter((p) => p.stock <= 5).length;

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, sku: p.sku ?? "", category: p.category ?? "", price: String(p.price), stock: String(p.stock) });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(form.price), stock = Number(form.stock);
    if (!form.name.trim() || price < 0 || stock < 0 || !Number.isInteger(stock)) return toast.error("Check the product details");
    const row = { name: form.name.trim(), sku: form.sku || null, category: form.category || null, price, stock, updated_at: new Date().toISOString() };
    const { error } = editing
      ? await supabase.from("products").update(row).eq("id", editing.id)
      : await supabase.from("products").insert(row);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Product updated" : "Product added");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const remove = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("products").delete().eq("id", toDelete.id);
    if (error) toast.error(error.message); else toast.success("Product deleted");
    setToDelete(null);
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  return (
    <div className="min-h-screen">
      <AppHeader role="admin" title="Admin dashboard" />
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Today's sales" value={peso(todayTotal)} />
          <Stat label="Transactions today" value={String(todaySales.length)} />
          <Stat label="Low stock items (≤5)" value={String(lowStock)} />
        </div>
        <Tabs defaultValue="products">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
          </TabsList>
          <TabsContent value="products" className="mt-4">
            <div className="rounded-2xl border bg-card">
              <div className="flex items-center justify-between border-b p-4">
                <h2 className="text-lg font-bold">Products ({products.length})</h2>
                <Button onClick={openNew}><Plus className="h-4 w-4" /> Add product</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr><th className="p-3">Name</th><th className="p-3">SKU</th><th className="p-3">Category</th><th className="p-3 text-right">Price</th><th className="p-3 text-right">Stock</th><th className="p-3" /></tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="p-3 font-medium">{p.name}</td>
                        <td className="p-3 text-muted-foreground">{p.sku || "—"}</td>
                        <td className="p-3">{p.category || "—"}</td>
                        <td className="p-3 text-right">{peso(Number(p.price))}</td>
                        <td className={`p-3 text-right ${p.stock <= 5 ? "font-semibold text-destructive" : ""}`}>{p.stock}</td>
                        <td className="p-3 text-right">
                          <Button size="icon" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" aria-label={`Delete ${p.name}`} onClick={() => setToDelete(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </td>
                      </tr>
                    ))}
                    {products.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No products yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="sales" className="mt-4">
            <div className="rounded-2xl border bg-card">
              <h2 className="border-b p-4 text-lg font-bold">Recent sales</h2>
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="p-3">Date</th><th className="p-3">Items</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Paid</th></tr>
                </thead>
                <tbody>
                  {sales.map((s) => {
                    const items = (s.items as { name: string; qty: number }[]) ?? [];
                    return (
                      <tr key={s.id} className="border-t">
                        <td className="p-3 whitespace-nowrap">{new Date(s.created_at).toLocaleString()}</td>
                        <td className="p-3 text-muted-foreground">{items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</td>
                        <td className="p-3 text-right font-medium">{peso(Number(s.total))}</td>
                        <td className="p-3 text-right">{peso(Number(s.paid))}</td>
                      </tr>
                    );
                  })}
                  {sales.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No sales yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="SKU" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
              <Field label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
              <Field label="Price (₱)" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} required />
              <Field label="Stock" type="number" value={form.stock} onChange={(v) => setForm({ ...form, stock: v })} required />
            </div>
            <DialogFooter><Button type="submit">{editing ? "Save changes" : "Add product"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the product permanently. Past sales are kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} step={type === "number" ? "any" : undefined} min={type === "number" ? 0 : undefined} value={value} required={required} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
