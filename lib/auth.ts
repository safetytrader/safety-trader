import { supabase } from "@/lib/supabaseClient";
import { fetchUserProfile, syncProfilePersonalFields } from "@/lib/userProfile";

export type ProfileData = {
  nome?: string;
  cognome?: string;
  societa?: string;
  sede_via?: string;
  sede_cap?: string;
  sede_citta?: string;
};

export class AuthAccessError extends Error {
  code: "PENDING_APPROVAL" | "ACCOUNT_BLOCKED" | "NOT_AUTHORIZED";

  constructor(code: AuthAccessError["code"], message: string) {
    super(message);
    this.name = "AuthAccessError";
    this.code = code;
  }
}

function normalizeProfileData(profileData?: ProfileData) {
  if (!profileData) return {};
  return {
    nome: String(profileData.nome ?? "").trim(),
    cognome: String(profileData.cognome ?? "").trim(),
    societa: String(profileData.societa ?? "").trim(),
    sede_via: String(profileData.sede_via ?? "").trim(),
    sede_cap: String(profileData.sede_cap ?? "").trim(),
    sede_citta: String(profileData.sede_citta ?? "").trim(),
  };
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const profile = data.user ? await fetchUserProfile(data.user.id) : null;
  if (!profile || profile.status !== "approved") {
    await supabase.auth.signOut();
    if (profile?.status === "pending") {
      throw new AuthAccessError(
        "PENDING_APPROVAL",
        "Registrazione in attesa di approvazione amministratore."
      );
    }
    if (profile?.status === "blocked") {
      throw new AuthAccessError(
        "ACCOUNT_BLOCKED",
        "Account bloccato. Contatta l'amministratore."
      );
    }
    throw new AuthAccessError(
      "NOT_AUTHORIZED",
      "Account non autorizzato o credenziali non valide."
    );
  }

  return data;
}

export async function signUp(
  email: string,
  password: string,
  profileData?: ProfileData
) {
  const data = normalizeProfileData(profileData);
  const { data: result, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data,
    },
  });
  if (error) throw error;

  if (result.user?.id) {
    try {
      await syncProfilePersonalFields(result.user.id, data);
    } catch {
      /* profilo creato dal trigger DB; sync best-effort */
    }
  }

  return result;
}

export async function updateUserProfile(profileData: ProfileData) {
  const data = normalizeProfileData(profileData);
  const { data: result, error } = await supabase.auth.updateUser({ data });
  if (error) throw error;

  const userId = result.user?.id;
  if (userId) {
    try {
      await syncProfilePersonalFields(userId, data);
    } catch {
      /* best-effort sync tabella profiles */
    }
  }

  return result;
}

/** Verifica che l'utente corrente sia approvato; altrimenti esegue logout. */
export async function ensureApprovedSession() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) return null;

  const profile = await fetchUserProfile(user.id);
  if (!profile || profile.status !== "approved") {
    await supabase.auth.signOut();
    if (profile?.status === "pending") {
      throw new AuthAccessError(
        "PENDING_APPROVAL",
        "Registrazione in attesa di approvazione amministratore."
      );
    }
    if (profile?.status === "blocked") {
      throw new AuthAccessError(
        "ACCOUNT_BLOCKED",
        "Account bloccato. Contatta l'amministratore."
      );
    }
    throw new AuthAccessError(
      "NOT_AUTHORIZED",
      "Account non autorizzato."
    );
  }

  return { user, profile };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string) {
  if (typeof window === "undefined") {
    throw new Error("resetPassword è disponibile solo lato client.");
  }
  const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
  return data;
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
  return data;
}
