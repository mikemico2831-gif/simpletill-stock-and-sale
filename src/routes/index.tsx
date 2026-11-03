import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole } from "@/lib/auth";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Tindahan POS — Point of Sale" },
      { name: "description", content: "Simple point of sale with admin and cashier dashboards." },
      { property: "og:title", content: "Tindahan POS — Point of Sale" },
      { property: "og:description", content: "Simple point of sale with admin and cashier dashboards." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const role = await getMyRole();
    throw redirect({ to: role === "admin" ? "/admin" : "/pos" });
  },
  component: () => null,
});
