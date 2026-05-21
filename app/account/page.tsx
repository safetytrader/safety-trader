// @ts-nocheck
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

function formatProvider(user) {
  const identity = user?.identities?.[0];
  const provider = identity?.provider || user?.app_metadata?.provider;
  if (!provider) return null;
  if (provider === "email") return "Email e password";
  return String(provider).charAt(0).toUpperCase() + String(provider).slice(1);
}

function formatCreatedAt(user) {
  const raw = user?.created_at;
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!cancelled) setUser(data.session?.user ?? null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    try {
      setLogoutLoading(true);
      await signOut();
      router.push("/login");
    } catch (err) {
      console.error("Errore logout:", err?.message || err);
      router.push("/login");
    } finally {
      setLogoutLoading(false);
    }
  }

  const provider = user ? formatProvider(user) : null;
  const createdAt = user ? formatCreatedAt(user) : null;

  return (
    <>
      <main className="account-page">
        <div className="account-shell">
          <div className="account-card">
            <div className="account-brand">
              <div className="account-mark">ST</div>
              <div>
                <div className="account-brand-title">Safety Trader</div>
                <div className="account-brand-sub">D.Lgs. 81/2008</div>
              </div>
            </div>

            {loading ? (
              <p className="account-loading">Caricamento account…</p>
            ) : user ? (
              <>
                <h1 className="account-title">Impostazioni account</h1>
                <p className="account-lead">
                  Gestisci le informazioni di accesso e la sessione corrente.
                </p>

                <div className="account-fields">
                  <div className="account-field">
                    <span className="account-field-label">Email</span>
                    <span className="account-field-value">{user.email || "—"}</span>
                  </div>
                  <div className="account-field">
                    <span className="account-field-label">Stato</span>
                    <span className="account-status">Account attivo</span>
                  </div>
                  {provider ? (
                    <div className="account-field">
                      <span className="account-field-label">Metodo di accesso</span>
                      <span className="account-field-value">{provider}</span>
                    </div>
                  ) : null}
                  {createdAt ? (
                    <div className="account-field">
                      <span className="account-field-label">Account creato il</span>
                      <span className="account-field-value">{createdAt}</span>
                    </div>
                  ) : null}
                </div>

                <div className="account-actions">
                  <Link href="/" className="account-btn account-btn-primary">
                    Torna alla dashboard
                  </Link>
                  <button
                    type="button"
                    className="account-btn account-btn-danger"
                    onClick={handleLogout}
                    disabled={logoutLoading}
                  >
                    {logoutLoading ? "Uscita in corso…" : "Logout"}
                  </button>
                </div>

                <div className="account-links">
                  <Link href="/privacy" className="account-link">
                    Privacy e note legali
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h1 className="account-title">Non hai effettuato l&apos;accesso</h1>
                <p className="account-lead">
                  Accedi con le tue credenziali per visualizzare le impostazioni
                  dell&apos;account.
                </p>
                <div className="account-actions account-actions-single">
                  <Link href="/login" className="account-btn account-btn-primary">
                    Vai al login
                  </Link>
                </div>
                <div className="account-links">
                  <Link href="/privacy" className="account-link">
                    Privacy e note legali
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <style jsx>{`
        .account-page {
          min-height: 100svh;
          background: #f8fafc;
          padding: 32px 20px 48px;
          box-sizing: border-box;
        }

        .account-shell {
          max-width: 900px;
          margin: 0 auto;
        }

        .account-card {
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          background: #ffffff;
          padding: 32px 28px 28px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 12px 36px rgba(15, 23, 42, 0.06);
        }

        .account-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .account-mark {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(145deg, #1e3a8a, #2563eb);
          color: #ffffff;
          font-size: 14px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          letter-spacing: 0.04em;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.28);
        }

        .account-brand-title {
          font-size: 16px;
          font-weight: 800;
          color: #020617;
          letter-spacing: -0.02em;
        }

        .account-brand-sub {
          margin-top: 2px;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
        }

        .account-loading {
          margin: 0;
          font-size: 14px;
          color: #64748b;
        }

        .account-title {
          margin: 0 0 8px;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #020617;
        }

        .account-lead {
          margin: 0 0 24px;
          font-size: 14px;
          line-height: 1.6;
          color: #64748b;
          max-width: 52ch;
        }

        .account-fields {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 28px;
        }

        .account-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 14px 16px;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .account-field-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #94a3b8;
        }

        .account-field-value {
          font-size: 15px;
          font-weight: 600;
          color: #0f172a;
          word-break: break-word;
        }

        .account-status {
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .account-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
        }

        .account-actions-single {
          flex-direction: column;
        }

        .account-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          padding: 11px 18px;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease,
            box-shadow 0.18s ease, opacity 0.18s ease;
        }

        .account-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .account-btn-primary {
          border: 0;
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 10px 22px rgba(37, 99, 235, 0.22);
        }

        .account-btn-primary:hover {
          background: #1d4ed8;
        }

        .account-btn-danger {
          border: 1px solid #fecaca;
          background: #ffffff;
          color: #dc2626;
        }

        .account-btn-danger:hover:not(:disabled) {
          background: #fef2f2;
          border-color: #fca5a5;
        }

        .account-links {
          padding-top: 16px;
          border-top: 1px solid #f1f5f9;
        }

        .account-link {
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .account-link:hover {
          color: #2563eb;
        }

        @media (max-width: 640px) {
          .account-card {
            padding: 24px 20px 22px;
          }

          .account-title {
            font-size: 24px;
          }

          .account-actions {
            flex-direction: column;
          }

          .account-btn {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
