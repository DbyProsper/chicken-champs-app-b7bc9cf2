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

    const { data: grantData, error: grantError } = await context.supabase.rpc("grant_access_role", {
      _email: data.email,
      _role: data.role,
    });

    if (grantError) {
      throw grantError;
    }

    const result = Array.isArray(grantData) ? grantData[0] : grantData;
    return {
      ok: true,
      user_id: result?.user_id ?? null,
      userId: result?.user_id ?? null,
      email: result?.email ?? data.email,
      role: result?.role ?? data.role,
    };
  });