import { createSupabaseServer, getBearerToken } from "@/lib/supabaseServer";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERSONAL_KEYS = [
  "nome",
  "cognome",
  "societa",
  "sede_via",
  "sede_cap",
  "sede_citta",
] as const;

function jsonError(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status });
}

export async function PATCH(request: Request) {
  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return jsonError("Sessione scaduta.", 401);
    }

    const supabase = createSupabaseServer(accessToken);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Sessione scaduta.", 401);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const payload: Record<string, string> = {};

    for (const key of PERSONAL_KEYS) {
      if (body[key] != null) {
        payload[key] = String(body[key] ?? "").trim();
      }
    }

    if (!Object.keys(payload).length) {
      return jsonError("Nessun campo anagrafico da aggiornare.", 400);
    }

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("profiles")
      .update(payload)
      .eq("id", user.id)
      .select("*")
      .single();

    if (error) {
      return jsonError("Errore salvataggio profilo.", 500);
    }

    return Response.json({ ok: true, profile: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore server.";
    return jsonError(message, 500);
  }
}
