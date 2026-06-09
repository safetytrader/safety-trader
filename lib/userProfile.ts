import { supabase } from "@/lib/supabaseClient";

export type UserRole = "user" | "admin";
export type UserStatus = "pending" | "approved" | "blocked";
export type UserPlan = "free" | "trial" | "paid";

export type UserProfile = {
  id: string;
  email: string | null;
  nome: string;
  cognome: string;
  societa: string;
  sede_via: string;
  sede_cap: string;
  sede_citta: string;
  role: UserRole;
  status: UserStatus;
  plan: UserPlan;
  api_credit_eur: number;
  api_spent_eur: number;
  created_at?: string;
  updated_at?: string;
};

export const USER_PLANS: UserPlan[] = ["free", "trial", "paid"];
export const USER_STATUSES: UserStatus[] = ["pending", "approved", "blocked"];

export function isApprovedProfile(profile: Pick<UserProfile, "status"> | null | undefined) {
  return profile?.status === "approved";
}

export function isAdminProfile(profile: Pick<UserProfile, "role"> | null | undefined) {
  return profile?.role === "admin";
}

export function formatPlanLabel(plan: UserPlan) {
  switch (plan) {
    case "trial":
      return "Trial";
    case "paid":
      return "Paid";
    default:
      return "Free";
  }
}

/** Sottotitolo header utente da public.profiles (solo approved). */
export function formatHeaderPlanSub(
  profile: Pick<UserProfile, "status" | "plan"> | null | undefined
): string {
  if (!profile || profile.status !== "approved") return "";
  const label = formatPlanLabel(profile.plan);
  if (profile.plan === "free") return `${label} · AI disabilitata`;
  return label;
}

export function formatStatusLabel(status: UserStatus) {
  switch (status) {
    case "approved":
      return "Approvato";
    case "blocked":
      return "Bloccato";
    default:
      return "In attesa";
  }
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as UserProfile | null;
}

export async function fetchCurrentUserProfile(): Promise<UserProfile | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) return null;
  return fetchUserProfile(data.user.id);
}

export async function syncProfilePersonalFields(
  userId: string,
  fields: {
    nome?: string;
    cognome?: string;
    societa?: string;
    sede_via?: string;
    sede_cap?: string;
    sede_citta?: string;
  }
) {
  const payload = {
    nome: String(fields.nome ?? "").trim(),
    cognome: String(fields.cognome ?? "").trim(),
    societa: String(fields.societa ?? "").trim(),
    sede_via: String(fields.sede_via ?? "").trim(),
    sede_cap: String(fields.sede_cap ?? "").trim(),
    sede_citta: String(fields.sede_citta ?? "").trim(),
  };
  const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
  if (error) throw error;
}
