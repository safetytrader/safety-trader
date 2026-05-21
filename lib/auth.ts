import { supabase } from "@/lib/supabaseClient";

export type ProfileData = {
  nome?: string;
  cognome?: string;
  societa?: string;
  sede_via?: string;
  sede_cap?: string;
  sede_citta?: string;
};

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
  return result;
}

export async function updateUserProfile(profileData: ProfileData) {
  const data = normalizeProfileData(profileData);
  const { data: result, error } = await supabase.auth.updateUser({ data });
  if (error) throw error;
  return result;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
