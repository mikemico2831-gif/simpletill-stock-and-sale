import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth";

export function AppHeader({ role, title }: { role: Role; title: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  return (
    <header className="bg-ink text-ink-foreground">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-lg font-bold leading-none">Tindahan POS</p>
            <p className="text-xs opacity-70">{title}</p>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          {role === "admin" && (
            <>
              <Link to="/admin" className="rounded-md px-3 py-2 text-sm opacity-80 hover:opacity-100" activeProps={{ className: "bg-primary/20 opacity-100" }}>Admin</Link>
              <Link to="/pos" className="rounded-md px-3 py-2 text-sm opacity-80 hover:opacity-100" activeProps={{ className: "bg-primary/20 opacity-100" }}>Cashier</Link>
            </>
          )}
          <Button size="sm" variant="secondary" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </nav>
      </div>
    </header>
  );
}
