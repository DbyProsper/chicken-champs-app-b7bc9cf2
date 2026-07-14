import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const grantRoleByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
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

    const result = (Array.isArray(grantData) ? grantData[0] : grantData) as
      | { out_user_id?: string; out_email?: string; out_role?: string }
      | null;
    return {
      ok: true,
      user_id: result?.out_user_id ?? null,
      userId: result?.out_user_id ?? null,
      email: result?.out_email ?? data.email,
      role: result?.out_role ?? data.role,
    };
  });

export const adminUpsertDriverByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    email: z.string().email().transform((value) => value.trim().toLowerCase()),
    name: z.string().trim().min(1),
    phone: z.string().trim().min(1),
    branchId: z.string().uuid().nullable().optional(),
    bankName: z.string().trim().nullable().optional(),
    bankAccountNumber: z.string().trim().nullable().optional(),
    bankAccountHolder: z.string().trim().nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: roleData, error: roleError } = await context.supabase.rpc("get_my_access_role");
    if (roleError || roleData !== "admin") {
      throw new Response("Only admins can add drivers", { status: 403 });
    }

    const { data: upsertData, error } = await context.supabase.rpc("admin_upsert_driver_by_email", {
      _email: data.email,
      _name: data.name,
      _phone: data.phone,
      _branch_id: data.branchId ?? null,
      _bank_name: data.bankName || null,
      _bank_account_number: data.bankAccountNumber || null,
      _bank_account_holder: data.bankAccountHolder || null,
    });
    if (error) throw error;
    const result = Array.isArray(upsertData) ? upsertData[0] : upsertData;
    return { ok: true, ...result };
  });

export const requestDriverApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    name: z.string().trim().min(1),
    phone: z.string().trim().min(1),
    branchId: z.string().uuid().nullable().optional(),
    bankName: z.string().trim().nullable().optional(),
    bankAccountNumber: z.string().trim().nullable().optional(),
    bankAccountHolder: z.string().trim().nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: appData, error } = await context.supabase.rpc("request_driver_application", {
      _name: data.name,
      _phone: data.phone,
      _branch_id: data.branchId ?? null,
      _bank_name: data.bankName || null,
      _bank_account_number: data.bankAccountNumber || null,
      _bank_account_holder: data.bankAccountHolder || null,
    });
    if (error) throw error;
    const result = Array.isArray(appData) ? appData[0] : appData;
    return { ok: true, ...result };
  });

export const approveDriverApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ applicationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: roleData, error: roleError } = await context.supabase.rpc("get_my_access_role");
    if (roleError || roleData !== "admin") {
      throw new Response("Only admins can approve driver requests", { status: 403 });
    }
    const { data: resultData, error } = await context.supabase.rpc("approve_driver_application", { _application_id: data.applicationId });
    if (error) throw error;
    const result = Array.isArray(resultData) ? resultData[0] : resultData;
    return { ok: true, ...result };
  });

export const rejectDriverApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ applicationId: z.string().uuid(), notes: z.string().trim().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: roleData, error: roleError } = await context.supabase.rpc("get_my_access_role");
    if (roleError || roleData !== "admin") {
      throw new Response("Only admins can reject driver requests", { status: 403 });
    }
    const { data: resultData, error } = await context.supabase.rpc("reject_driver_application", { _application_id: data.applicationId, _admin_notes: data.notes ?? null });
    if (error) throw error;
    const result = Array.isArray(resultData) ? resultData[0] : resultData;
    return { ok: true, ...result };
  });

export const submitDeliveryPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ deliveryId: z.string().uuid(), reference: z.string().trim().min(1), proofPath: z.string().trim().nullable().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: resultData, error } = await context.supabase.rpc("submit_delivery_payment", {
      _delivery_id: data.deliveryId,
      _payment_reference: data.reference,
      _proof_path: data.proofPath ?? null,
    });
    if (error) throw error;
    const result = Array.isArray(resultData) ? resultData[0] : resultData;
    return { ok: true, ...result };
  });

export const confirmDeliveryPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ deliveryId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: resultData, error } = await context.supabase.rpc("confirm_delivery_payment", { _delivery_id: data.deliveryId });
    if (error) throw error;
    const result = Array.isArray(resultData) ? resultData[0] : resultData;
    return { ok: true, ...result };
  });