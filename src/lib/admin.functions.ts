import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const grantRoleByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({
    email: z.string().email().transform((value) => value.trim().toLowerCase()),
    role: z.enum(["admin", "staff", "user", "driver"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: roleData, error: roleError } = await context.supabase.rpc("get_my_access_role");
    if (roleError || roleData !== "admin") {
      throw new Response("Only admins can grant access", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let targetUser: { id: string; email?: string } | null = null;

    for (let page = 1; page <= 20; page += 1) {
      const { data: usersPage, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      targetUser = usersPage.users.find((user) => user.email?.toLowerCase() === data.email) ?? null;
      if (targetUser || usersPage.users.length < 1000) break;
    }

    if (!targetUser) {
      throw new Error("No account exists for that email yet. Ask them to sign up first, then grant access.");
    }

    const { error: upsertError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: targetUser.id, role: data.role }, { onConflict: "user_id,role" });

    if (upsertError) throw upsertError;
    return { ok: true, user_id: targetUser.id, userId: targetUser.id, email: targetUser.email ?? data.email, role: data.role };
  });