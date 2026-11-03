import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "cashier";

export async function getMyRole(): Promise<Role | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
  const roles = (data ?? []).map((r) => r.role as Role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("cashier")) return "cashier";
  return null;
}

export const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);
