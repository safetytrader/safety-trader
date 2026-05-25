import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

export const AI_TEMP_BUCKET = "ai-temp";

export const TEMP_UPLOAD_FAILED_MSG =
  "Impossibile caricare temporaneamente il documento.";
export const TEMP_DOWNLOAD_FAILED_MSG =
  "Impossibile leggere il documento temporaneo.";

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

export async function uploadFileToAiTemp(
  file: File,
  userId: string,
  impresaId: string
): Promise<string> {
  const path = buildAiTempStoragePath(userId, impresaId, file.name || "documento.pdf");
  const { error } = await supabase.storage.from(AI_TEMP_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (error) {
    console.warn("[AI] temp upload failed", error.message);
    throw new Error(TEMP_UPLOAD_FAILED_MSG);
  }

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
    console.warn("[AI] temp download failed", error?.message);
    throw new Error(TEMP_DOWNLOAD_FAILED_MSG);
  }

  const bytes = await data.arrayBuffer();
  const buffer = Buffer.from(bytes);
  if (!buffer.length) {
    throw new Error(TEMP_DOWNLOAD_FAILED_MSG);
  }

  return buffer;
}
