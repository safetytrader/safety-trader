import type { UserPlan, UserRole, UserStatus } from "@/lib/userProfile";

export type AdminUserUpdatesPayload = {
  status?: UserStatus;
  plan?: UserPlan;
  role?: UserRole;
  api_credit_eur?: number;
};

const ALLOWED_UPDATE_KEYS = new Set(["status", "plan", "role", "api_credit_eur"]);

export function roundCreditEur(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, value) * 1_000_000) / 1_000_000;
}

export function parseAdminUserUpdates(raw: unknown): {
  ok: true;
  updates: AdminUserUpdatesPayload;
} | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "updates non valido." };
  }

  const updates: AdminUserUpdatesPayload = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED_UPDATE_KEYS.has(key)) {
      return { ok: false, error: `Campo non consentito: ${key}` };
    }

    if (key === "status") {
      if (!["pending", "approved", "blocked"].includes(String(value))) {
        return { ok: false, error: "status non valido." };
      }
      updates.status = value as UserStatus;
      continue;
    }

    if (key === "plan") {
      if (!["free", "trial", "paid"].includes(String(value))) {
        return { ok: false, error: "plan non valido." };
      }
      updates.plan = value as UserPlan;
      continue;
    }

    if (key === "role") {
      if (!["user", "admin"].includes(String(value))) {
        return { ok: false, error: "role non valido." };
      }
      updates.role = value as UserRole;
      continue;
    }

    if (key === "api_credit_eur") {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, error: "api_credit_eur deve essere un numero >= 0." };
      }
      updates.api_credit_eur = roundCreditEur(n);
    }
  }

  if (!Object.keys(updates).length) {
    return { ok: false, error: "Nessuna modifica richiesta." };
  }

  return { ok: true, updates };
}

export function assertAdminSelfModificationAllowed(
  callerId: string,
  targetUserId: string,
  updates: AdminUserUpdatesPayload
): string | null {
  if (callerId !== targetUserId) return null;

  if (updates.role === "user") {
    return "Non puoi rimuovere i privilegi admin dal tuo account.";
  }

  if (updates.status && updates.status !== "approved") {
    return "Non puoi rimuovere i privilegi admin dal tuo account.";
  }

  return null;
}
