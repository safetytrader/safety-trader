import { isAdminBackendConfigured, requireAdminFromRequest } from "@/lib/adminAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

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
