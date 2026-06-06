import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Solo server: evita import accidentale nel bundle client. */
if (typeof window !== "undefined") {
  throw new Error("lib/supabaseAdmin.ts non può essere importato lato client.");
}

/**
 * Controllo temporaneo lato server — non espone il valore della chiave.
 * Legge esattamente process.env.SUPABASE_SERVICE_ROLE_KEY
 */
export function isSupabaseServiceRoleKeyConfigured(): boolean {
  return Boolean(readSupabaseServiceRoleKey());
}

function readSupabaseServiceRoleKey(): string | undefined {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (raw == null) return undefined;

  const trimmed = String(raw).trim();
  if (!trimmed) return undefined;

  // Rimuove eventuali virgolette nel .env.local
  const unquoted = trimmed.replace(/^["']|["']$/g, "").trim();
  return unquoted || undefined;
}

function readSupabaseUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (raw == null) return undefined;
  const trimmed = String(raw).trim().replace(/^["']|["']$/g, "").trim();
  return trimmed || undefined;
}

/** Accetta chiavi Supabase nuove (sb_secret_) e legacy JWT (eyJ…). */
function isAcceptedSecretKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  if (key.startsWith("eyJ")) return true;
  return key.length >= 20;
}

/** Client con privilegi elevati — solo route/server API. */
export function createSupabaseAdmin(): SupabaseClient {
  const url = readSupabaseUrl();
  const key = readSupabaseServiceRoleKey();

  if (!key) {
    throw new Error("Configurazione Supabase admin mancante (SUPABASE_SERVICE_ROLE_KEY).");
  }

  if (!url) {
    throw new Error("Configurazione Supabase admin mancante (NEXT_PUBLIC_SUPABASE_URL).");
  }

  if (!isAcceptedSecretKey(key)) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY non valida o incompleta.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
