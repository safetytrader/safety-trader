import type { UserProfile } from "@/lib/userProfile";

export type AiAccessResult =
  | { allowed: true }
  | { allowed: false; status: 401 | 402 | 403; error: string };

/** Regole accesso analisi AI (server e client). */
export function evaluateAiAccess(
  profile: Pick<UserProfile, "status" | "plan" | "api_credit_eur"> | null | undefined
): AiAccessResult {
  if (!profile || profile.status !== "approved") {
    return { allowed: false, status: 403, error: "Account non autorizzato." };
  }

  if (profile.plan === "free") {
    return {
      allowed: false,
      status: 403,
      error: "Il piano Free non include analisi AI.",
    };
  }

  const credit = Number(profile.api_credit_eur ?? 0);
  if (!Number.isFinite(credit) || credit <= 0) {
    return { allowed: false, status: 402, error: "Credito AI esaurito." };
  }

  return { allowed: true };
}

export function canUseAiAnalysis(
  profile: Pick<UserProfile, "status" | "plan" | "api_credit_eur"> | null | undefined
): boolean {
  return evaluateAiAccess(profile).allowed;
}

/** Messaggio UI upload quando l'analisi AI non è consentita. */
export function getAiUploadBlockMessage(
  profile: Pick<UserProfile, "status" | "plan" | "api_credit_eur"> | null | undefined
): string | null {
  if (!profile || profile.status !== "approved") return null;

  if (profile.plan === "free") {
    return "Il tuo piano Free non include analisi AI. Richiedi Trial o acquista credito.";
  }

  const credit = Number(profile.api_credit_eur ?? 0);
  if (!Number.isFinite(credit) || credit <= 0) {
    return "Credito AI esaurito.";
  }

  return null;
}
