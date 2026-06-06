"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import {
  formatPlanLabel,
  formatStatusLabel,
  isAdminProfile,
  type UserPlan,
  type UserProfile,
  type UserStatus,
  USER_PLANS,
} from "@/lib/userProfile";

async function adminFetch(path: string, init?: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sessione non valida.");

  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  const data = await res.json();
  if (!res.ok || !data.ok) {
    const base = data.error || "Operazione non riuscita.";
    if (data.adminConfigured === false) {
      throw new Error(
        `${base} Verifica .env.local e riavvia \`npm run dev\`.`
      );
    }
    throw new Error(base);
  }
  return data;
}

function statusClass(status: UserStatus) {
  if (status === "approved") return "status-approved";
  if (status === "blocked") return "status-blocked";
  return "status-pending";
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});

  const loadUsers = useCallback(async () => {
    const data = await adminFetch("/api/admin/users");
    setUsers(Array.isArray(data.users) ? data.users : []);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) {
          router.replace("/login");
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) throw error;
        if (!isAdminProfile(profile) || profile?.status !== "approved") {
          router.replace("/");
          return;
        }

        await loadUsers();
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setMessage(err instanceof Error ? err.message : "Errore caricamento.");
          setMessageType("error");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadUsers, router]);

  function showMsg(text: string, type: "error" | "success") {
    setMessage(text);
    setMessageType(type);
  }

  async function patchUser(
    userId: string,
    patch: { status?: UserStatus; plan?: UserPlan; addCreditEur?: number }
  ) {
    setBusyId(userId);
    setMessage("");
    setMessageType(null);
    try {
      const data = await adminFetch("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ userId, ...patch }),
      });
      setUsers(prev => prev.map(u => (u.id === userId ? (data.user as UserProfile) : u)));
      showMsg("Utente aggiornato.", "success");
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "Errore aggiornamento.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="admin-page">
        <p className="loading">Caricamento utenti…</p>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Amministrazione</p>
          <h1>Gestione utenti</h1>
          <p className="subtitle">Approva registrazioni, blocca account, piani e credito API.</p>
        </div>
        <div className="header-actions">
          <Link href="/" className="link-btn">
            Torna all&apos;app
          </Link>
          <button type="button" className="ghost-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {message && (
        <div className={messageType === "error" ? "alert alert-error" : "alert alert-success"}>
          {message}
        </div>
      )}

      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Utente</th>
              <th>Email</th>
              <th>Stato</th>
              <th>Piano</th>
              <th>Credito €</th>
              <th>Speso €</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>
                  <strong>
                    {[user.nome, user.cognome].filter(Boolean).join(" ") || "—"}
                  </strong>
                  {user.role === "admin" ? <span className="badge-admin">admin</span> : null}
                  {user.societa ? <div className="muted">{user.societa}</div> : null}
                </td>
                <td>{user.email || "—"}</td>
                <td>
                  <span className={`status-pill ${statusClass(user.status)}`}>
                    {formatStatusLabel(user.status)}
                  </span>
                </td>
                <td>
                  <select
                    value={user.plan}
                    disabled={busyId === user.id || user.role === "admin"}
                    onChange={e => patchUser(user.id, { plan: e.target.value as UserPlan })}
                  >
                    {USER_PLANS.map(plan => (
                      <option key={plan} value={plan}>
                        {formatPlanLabel(plan)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{Number(user.api_credit_eur || 0).toFixed(2)}</td>
                <td>{Number(user.api_spent_eur || 0).toFixed(2)}</td>
                <td className="actions-cell">
                  {user.status !== "approved" ? (
                    <button
                      type="button"
                      className="action-btn approve"
                      disabled={busyId === user.id}
                      onClick={() => patchUser(user.id, { status: "approved" })}
                    >
                      Approva
                    </button>
                  ) : null}
                  {user.status !== "blocked" && user.role !== "admin" ? (
                    <button
                      type="button"
                      className="action-btn block"
                      disabled={busyId === user.id}
                      onClick={() => patchUser(user.id, { status: "blocked" })}
                    >
                      Blocca
                    </button>
                  ) : null}
                  {user.status === "blocked" ? (
                    <button
                      type="button"
                      className="action-btn approve"
                      disabled={busyId === user.id}
                      onClick={() => patchUser(user.id, { status: "approved" })}
                    >
                      Riattiva
                    </button>
                  ) : null}
                  <div className="credit-row">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="€"
                      value={creditInputs[user.id] ?? ""}
                      onChange={e =>
                        setCreditInputs(prev => ({ ...prev, [user.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="action-btn credit"
                      disabled={busyId === user.id}
                      onClick={() => {
                        const amount = Number(creditInputs[user.id]);
                        if (!Number.isFinite(amount) || amount <= 0) {
                          showMsg("Inserisci un importo credito valido.", "error");
                          return;
                        }
                        patchUser(user.id, { addCreditEur: amount }).then(() => {
                          setCreditInputs(prev => ({ ...prev, [user.id]: "" }));
                        });
                      }}
                    >
                      + Credito
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length ? <p className="empty">Nessun utente registrato.</p> : null}
      </section>

      <style jsx>{`
        .admin-page {
          min-height: 100svh;
          background: #f8fafc;
          padding: 32px 24px 48px;
          color: #0f172a;
        }

        .loading,
        .empty {
          color: #64748b;
          font-size: 14px;
        }

        .admin-header {
          max-width: 1200px;
          margin: 0 auto 24px;
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }

        .eyebrow {
          margin: 0 0 6px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #2563eb;
        }

        h1 {
          margin: 0;
          font-size: 32px;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .subtitle {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .link-btn,
        .ghost-btn,
        .action-btn {
          border-radius: 12px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .link-btn {
          display: inline-flex;
          align-items: center;
          padding: 10px 14px;
          background: #0f172a;
          color: #fff;
          text-decoration: none;
        }

        .ghost-btn {
          padding: 10px 14px;
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #334155;
        }

        .alert {
          max-width: 1200px;
          margin: 0 auto 16px;
          padding: 12px 14px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 600;
        }

        .alert-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .alert-success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #15803d;
        }

        .table-wrap {
          max-width: 1200px;
          margin: 0 auto;
          overflow: auto;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 980px;
        }

        th,
        td {
          padding: 14px 16px;
          text-align: left;
          border-bottom: 1px solid #eef2f7;
          vertical-align: top;
          font-size: 13px;
        }

        th {
          background: #f8fafc;
          color: #475569;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .muted {
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
        }

        .badge-admin {
          display: inline-block;
          margin-left: 8px;
          padding: 2px 8px;
          border-radius: 999px;
          background: #dbeafe;
          color: #1d4ed8;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .status-pill {
          display: inline-flex;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }

        .status-approved {
          background: #dcfce7;
          color: #15803d;
        }

        .status-pending {
          background: #fef3c7;
          color: #b45309;
        }

        .status-blocked {
          background: #fee2e2;
          color: #b91c1c;
        }

        select,
        .credit-row input {
          height: 36px;
          border: 1px solid #dbe3ef;
          border-radius: 10px;
          padding: 0 10px;
          font-size: 13px;
          background: #fff;
        }

        .actions-cell {
          min-width: 220px;
        }

        .action-btn {
          border: 0;
          padding: 8px 12px;
          margin: 0 6px 6px 0;
        }

        .action-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .approve {
          background: #2563eb;
          color: #fff;
        }

        .block {
          background: #fee2e2;
          color: #b91c1c;
        }

        .credit {
          background: #0f172a;
          color: #fff;
        }

        .credit-row {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .credit-row input {
          width: 88px;
        }
      `}</style>
    </main>
  );
}
