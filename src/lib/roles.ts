import { supabase } from "@/integrations/supabase/client";

export type AccessRole = "admin" | "staff" | null;

function normalizeRole(value: unknown): AccessRole {
  if (typeof value !== "string") return null;
  const role = value.toLowerCase();
  if (role === "admin") return "admin";
  if (role === "staff") return "staff";
  return null;
}

function getAdminEmails(): string[] {
  const envValue = (import.meta.env?.VITE_ADMIN_EMAILS as string | undefined) ?? "";
  return envValue
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveUserContext(userId?: string | null) {
  const fallbackUserId = userId ?? null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUserId = sessionData.session?.user?.id ?? null;
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const activeUserId = userData?.user?.id ?? sessionUserId ?? fallbackUserId;

    if (userData?.user || activeUserId) {
      return {
        activeUserId,
        user: userData?.user ?? null,
        userError,
      };
    }

    if (attempt < 3) {
      await wait(250);
    }
  }

  return {
    activeUserId: fallbackUserId,
    user: null,
    userError: null,
  };
}

export async function getAccessRole(userId?: string | null): Promise<AccessRole> {
  if (!userId) {
    const resolved = await resolveUserContext();
    if (!resolved.activeUserId) return null;
    userId = resolved.activeUserId;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { activeUserId, user, userError } = await resolveUserContext(userId);
    const email = user?.email?.toLowerCase() ?? "";
    const adminEmails = getAdminEmails();

    const [{ data: roles, error: rolesError }, { data: isAdminData, error: adminError }, { data: isStaffData, error: staffError }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", activeUserId),
      supabase.rpc("has_role", { _user_id: activeUserId, _role: "admin" }),
      supabase.rpc("is_staff", { _user_id: activeUserId }),
    ]);

    if (rolesError) console.warn("[roles] failed to read roles", rolesError.message);
    if (adminError) console.warn("[roles] failed to check admin role", adminError.message);
    if (staffError) console.warn("[roles] failed to check staff role", staffError.message);

    const found = (roles ?? []).map((role) => normalizeRole(role.role)).filter(Boolean) as AccessRole[];
    const metadataRole = normalizeRole(user?.app_metadata?.role ?? user?.user_metadata?.role);
    const metadataRoles = (user?.app_metadata?.roles ?? user?.user_metadata?.roles ?? []) as unknown[];
    const metadataRoleFromArray = metadataRoles.map((role) => normalizeRole(role)).find(Boolean);
    const metadataFlags = [
      user?.app_metadata?.is_admin,
      user?.user_metadata?.is_admin,
    ];
    const isAdminByMetadata = metadataFlags.some((value) => value === true || value === "true" || value === "admin");
    const isAdminByEmail = adminEmails.length > 0 && email.length > 0 && adminEmails.includes(email);

    if (found.includes("admin") || isAdminData === true || metadataRole === "admin" || metadataRoleFromArray === "admin" || isAdminByMetadata || isAdminByEmail) return "admin";
    if (found.includes("staff") || isStaffData === true || metadataRole === "staff" || metadataRoleFromArray === "staff") return "staff";

    if (userError || attempt < 3) {
      await wait(250);
      continue;
    }

    break;
  }

  return null;
}

export async function isStaffOrAdmin(userId?: string | null): Promise<boolean> {
  const role = await getAccessRole(userId);
  return role === "admin" || role === "staff";
}
