import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { AutoRunBeacon } from "@/components/autorun/AutoRunBeacon";

// Integration-managed pattern: SSR off, session read on the client, redirect
// to /auth when no user. Do not add second-line auth gates on child routes —
// server functions using requireSupabaseAuth re-validate the bearer.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: () => (
    <>
      <Outlet />
      <AutoRunBeacon />
    </>
  ),
});
