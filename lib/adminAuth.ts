import { createSupabaseServer, getBearerToken } from "@/lib/supabaseServer";
import { isSupabaseServiceRoleKeyConfigured } from "@/lib/supabaseAdmin";
import type { UserProfile } from "@/lib/userProfile";

type AdminAuthResult =
  | { ok: true; user: { id: string; email?: string | null }; profile: UserProfile }
  | { ok: false; status: number; message: string };

/** Controllo temporaneo server — la chiave non viene mai esposta al client. */
export function isAdminBackendConfigured(): boolean {
  return isSupabaseServiceRoleKeyConfigured();
}

export async function requireAdminFromRequest(request: Request): Promise<AdminAuthResult> {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return { ok: false, status: 401, message: "Sessione non valida." };
  }

  const supabase = createSupabaseServer(accessToken);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, message: "Sessione non valida." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false, status: 500, message: "Errore lettura profilo." };
  }

  if (!profile || profile.role !== "admin" || profile.status !== "approved") {
    return { ok: false, status: 403, message: "Accesso riservato agli amministratori." };
  }

  return { ok: true, user, profile: profile as UserProfile };
}
