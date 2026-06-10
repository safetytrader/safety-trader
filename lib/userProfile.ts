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

/** Importi EUR con 4 decimali (UI credito AI). */
export function formatEur4(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0.0000";
  return n.toFixed(4);
}

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
  profile: Pick<UserProfile, "status" | "plan" | "api_credit_eur"> | null | undefined
): string {
  if (!profile || profile.status !== "approved") return "";
  const label = formatPlanLabel(profile.plan);
  if (profile.plan === "free") return `${label} · AI disabilitata`;
  return `${label} · €${formatEur4(profile.api_credit_eur)}`;
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

const PROFILE_PERSONAL_FIELD_KEYS = [
  "nome",
  "cognome",
  "societa",
  "sede_via",
  "sede_cap",
  "sede_citta",
] as const;

export async function syncProfilePersonalFields(
  _userId: string,
  fields: {
    nome?: string;
    cognome?: string;
    societa?: string;
    sede_via?: string;
    sede_cap?: string;
    sede_citta?: string;
  }
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sessione non valida.");

  const payload: Record<string, string> = {};
  for (const key of PROFILE_PERSONAL_FIELD_KEYS) {
    payload[key] = String(fields[key] ?? "").trim();
  }

  const res = await fetch("/api/profile/personal", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) {
    if (res.status === 401) throw new Error("Sessione scaduta.");
    throw new Error(data.error || "Errore salvataggio profilo.");
  }
}
