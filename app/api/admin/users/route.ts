import { isAdminBackendConfigured, requireAdminFromRequest } from "@/lib/adminAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { UserPlan, UserStatus } from "@/lib/userProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(
  message: string,
  status: number,
  extra: Record<string, unknown> = {}
) {
  return Response.json({ ok: false, error: message, ...extra }, { status });
}

function assertAdminBackendConfigured() {
  const configured = isAdminBackendConfigured();
  // Controllo temporaneo server (non espone il valore della chiave)
  console.log("[admin/users] SUPABASE_SERVICE_ROLE_KEY configured:", configured);
  if (!configured) {
    return jsonError(
      "Configurazione Supabase admin mancante (SUPABASE_SERVICE_ROLE_KEY). Riavvia il server dopo aver aggiornato .env.local.",
      503,
      { adminConfigured: false }
    );
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const configError = assertAdminBackendConfigured();
    if (configError) return configError;

    const auth = await requireAdminFromRequest(request);
    if (!auth.ok) return jsonError(auth.message, auth.status, { adminConfigured: true });

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return jsonError(error.message, 500, { adminConfigured: true });

    return Response.json({ ok: true, adminConfigured: true, users: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore server.";
    return jsonError(message, 500, {
      adminConfigured: isAdminBackendConfigured(),
    });
  }
}

export async function PATCH(request: Request) {
  try {
    const configError = assertAdminBackendConfigured();
    if (configError) return configError;

    const auth = await requireAdminFromRequest(request);
    if (!auth.ok) return jsonError(auth.message, auth.status, { adminConfigured: true });

    const body = (await request.json()) as {
      userId?: string;
      status?: UserStatus;
      plan?: UserPlan;
      addCreditEur?: number;
    };

    const userId = String(body.userId || "").trim();
    if (!userId) return jsonError("userId mancante.", 400, { adminConfigured: true });

    const admin = createSupabaseAdmin();
    const { data: existing, error: readError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (readError) return jsonError(readError.message, 500, { adminConfigured: true });
    if (!existing) return jsonError("Utente non trovato.", 404, { adminConfigured: true });

    const patch: Record<string, unknown> = {};

    if (body.status && ["pending", "approved", "blocked"].includes(body.status)) {
      patch.status = body.status;
    }

    if (body.plan && ["free", "trial", "paid"].includes(body.plan)) {
      patch.plan = body.plan;
    }

    const addCredit = Number(body.addCreditEur);
    if (Number.isFinite(addCredit) && addCredit > 0) {
      patch.api_credit_eur = Number(existing.api_credit_eur || 0) + addCredit;
    }

    if (!Object.keys(patch).length) {
      return jsonError("Nessuna modifica richiesta.", 400, { adminConfigured: true });
    }

    const { data: updated, error: updateError } = await admin
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select("*")
      .single();

    if (updateError) return jsonError(updateError.message, 500, { adminConfigured: true });

    return Response.json({ ok: true, adminConfigured: true, user: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore server.";
    return jsonError(message, 500, {
      adminConfigured: isAdminBackendConfigured(),
    });
  }
}
