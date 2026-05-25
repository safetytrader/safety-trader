import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export const AI_TEMP_BUCKET = "ai-temp";

export const TEMP_AUTH_REQUIRED_MSG =
  "Utente non autenticato. Effettua nuovamente il login.";

export function formatTempUploadError(supabaseMessage?: string) {
  const detail = String(supabaseMessage || "").trim();
  if (!detail) {
    return "Impossibile caricare temporaneamente il documento.";
  }
  return `Impossibile caricare temporaneamente il documento: ${detail}`;
}

export function formatTempDownloadError(supabaseMessage?: string) {
  const detail = String(supabaseMessage || "").trim();
  if (!detail) {
    return "Impossibile leggere il documento temporaneo.";
  }
  return `Impossibile leggere il documento temporaneo: ${detail}`;
}

export function buildAiTempStoragePath(
  userId: string,
  impresaId: string,
  fileName: string
) {
  const safeName = String(fileName || "documento.pdf")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);
  return `${userId}/${impresaId}/${Date.now()}_${safeName}`;
}

/** Verifica che il path appartenga all'utente autenticato (prefisso userId/). */
export function assertUserOwnsTempPath(storagePath: string, userId: string) {
  const normalized = String(storagePath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();

  if (!normalized || normalized.includes("..")) {
    throw new Error("Percorso documento temporaneo non valido.");
  }

  const prefix = `${userId}/`;
  if (!normalized.startsWith(prefix)) {
    throw new Error("Percorso documento temporaneo non valido.");
  }

  return normalized;
}

async function resolveAuthenticatedUserId() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("[AI] temp upload session error", sessionError.message);
    throw new Error(TEMP_AUTH_REQUIRED_MSG);
  }

  const userId = session?.user?.id;
  if (!userId) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user?.id) {
      console.error("[AI] temp upload auth missing", userError?.message);
      throw new Error(TEMP_AUTH_REQUIRED_MSG);
    }
    return userData.user.id;
  }

  return userId;
}

export async function uploadFileToAiTemp(
  file: File,
  _userId: string,
  impresaId: string
): Promise<string> {
  if (!file) {
    throw new Error(formatTempUploadError("file mancante"));
  }

  const impresaKey = String(impresaId || "").trim();
  if (!impresaKey) {
    throw new Error(formatTempUploadError("impresaId mancante"));
  }

  const userId = await resolveAuthenticatedUserId();
  const path = buildAiTempStoragePath(userId, impresaKey, file.name || "documento.pdf");

  console.log("[AI] temp upload start", {
    bucket: AI_TEMP_BUCKET,
    path,
    fileSize: file.size,
    fileType: file.type || "application/pdf",
  });

  const { error } = await supabase.storage.from(AI_TEMP_BUCKET).upload(path, file, {
    cacheControl: "0",
    upsert: false,
    contentType: file.type || "application/pdf",
  });

  if (error) {
    console.error("[AI] temp upload failed", {
      bucket: AI_TEMP_BUCKET,
      path,
      message: error.message,
      name: error.name,
    });
    throw new Error(formatTempUploadError(error.message));
  }

  console.log("[AI] temp upload ok", path);
  return path;
}

export async function removeAiTempFile(
  client: SupabaseClient,
  storagePath: string
) {
  const { error } = await client.storage.from(AI_TEMP_BUCKET).remove([storagePath]);
  if (error) {
    console.error("[AI] temp delete failed", storagePath, error.message);
  }
}

export async function downloadAiTempFile(
  client: SupabaseClient,
  storagePath: string
): Promise<Buffer> {
  const { data, error } = await client.storage.from(AI_TEMP_BUCKET).download(storagePath);

  if (error || !data) {
    console.warn("[POS refs] temp download failed", storagePath, error?.message);
    throw new Error(formatTempDownloadError(error?.message));
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(new Uint8Array(arrayBuffer));

  console.log("[POS refs] downloaded file bytes", buffer.length);

  if (!buffer.length) {
    throw new Error(formatTempDownloadError("file vuoto"));
  }

  return buffer;
}
