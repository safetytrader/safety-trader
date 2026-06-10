import { isAdminBackendConfigured, requireAdminFromRequest } from "@/lib/adminAuth";
import {
  assertAdminSelfModificationAllowed,
  parseAdminUserUpdates,
} from "@/lib/adminUsersUpdate";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status });
}

async function handleUpdate(request: Request) {
  if (!isAdminBackendConfigured()) {
    return jsonError(
      "Configurazione Supabase admin mancante (SUPABASE_SERVICE_ROLE_KEY).",
      503
    );
  }

  const auth = await requireAdminFromRequest(request);
  if (!auth.ok) {
    if (auth.status === 401) {
      return jsonError("Sessione scaduta.", 401);
    }
    if (auth.status === 403) {
      return jsonError("Non autorizzato.", 403);
    }
    return jsonError(auth.message, auth.status);
  }

  const body = (await request.json()) as {
    userId?: string;
    updates?: unknown;
  };

  const userId = String(body.userId || "").trim();
  if (!userId) {
    return jsonError("userId mancante.", 400);
  }

  const parsed = parseAdminUserUpdates(body.updates);
  if (!parsed.ok) {
    return jsonError(parsed.error, 400);
  }

  const selfBlock = assertAdminSelfModificationAllowed(
    auth.user.id,
    userId,
    parsed.updates
  );
  if (selfBlock) {
    return jsonError(selfBlock, 400);
  }

  const admin = createSupabaseAdmin();
  const { data: existing, error: readError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (readError) {
    return jsonError("Errore salvataggio utente.", 500);
  }
  if (!existing) {
    return jsonError("Utente non trovato.", 404);
  }

  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update(parsed.updates)
    .eq("id", userId)
    .select("*")
    .single();

  if (updateError) {
    return jsonError("Errore salvataggio utente.", 500);
  }

  return Response.json({ ok: true, user: updated });
}

export async function POST(request: Request) {
  try {
    return await handleUpdate(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore server.";
    return jsonError(message, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    return await handleUpdate(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore server.";
    return jsonError(message, 500);
  }
}
