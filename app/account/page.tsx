// @ts-nocheck
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut, updateUserProfile } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

const emptyProfile = () => ({
  nome: "",
  cognome: "",
  societa: "",
  sede_via: "",
  sede_cap: "",
  sede_citta: "",
});

function profileFromMetadata(meta) {
  const m = meta || {};
  return {
    nome: m.nome ?? "",
    cognome: m.cognome ?? "",
    societa: m.societa ?? "",
    sede_via: m.sede_via ?? "",
    sede_cap: m.sede_cap ?? "",
    sede_citta: m.sede_citta ?? "",
  };
}

function validateProfile(profile) {
  if (!profile.nome.trim()) return "Inserisci il nome.";
  if (!profile.cognome.trim()) return "Inserisci il cognome.";
  if (!profile.societa.trim()) return "Inserisci la società.";
  if (!profile.sede_via.trim()) return "Inserisci l'indirizzo della sede (via).";
  if (!profile.sede_cap.trim()) return "Inserisci il CAP.";
  if (!profile.sede_citta.trim()) return "Inserisci la città.";
  return null;
}

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(emptyProfile());
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const u = data.session?.user ?? null;
        if (!cancelled) {
          setUser(u);
          setProfile(profileFromMetadata(u?.user_metadata));
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setProfile(emptyProfile());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        const u = session?.user ?? null;
        setUser(u);
        setProfile(profileFromMetadata(u?.user_metadata));
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  function showMsg(text, type) {
    setMessage(text);
    setMessageType(type);
  }

  async function handleSave() {
    const validationError = validateProfile(profile);
    if (validationError) {
      showMsg(validationError, "error");
      return;
    }

    try {
      setSaveLoading(true);
      setMessage("");
      setMessageType(null);
      await updateUserProfile(profile);
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
        setProfile(profileFromMetadata(data.user.user_metadata));
      }
      showMsg("Profilo aggiornato correttamente.", "success");
    } catch (err) {
      const text =
        err instanceof Error ? err.message : "Salvataggio profilo non riuscito.";
      showMsg(text, "error");
    } finally {
      setSaveLoading(false);
    }
  }

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

  const setField = (key, value) => {
    setProfile(p => ({ ...p, [key]: value }));
  };

  return (
    <>
      <main className="account-page">
        <div className="account-shell">
          {loading ? (
            <p className="account-loading">Caricamento account…</p>
          ) : user ? (
            <>
              <header className="account-hero">
                <span className="account-badge">Profilo utente</span>
                <h1 className="account-title">Impostazioni account</h1>
                <p className="account-lead">
                  Gestisci i dati del profilo utilizzati nell&apos;app e nei report.
                </p>
              </header>

              {message ? (
                <div
                  className={
                    messageType === "error"
                      ? "account-alert account-alert-error"
                      : "account-alert account-alert-success"
                  }
                  role="status"
                >
                  {message}
                </div>
              ) : null}

              <div className="account-card">
                <div className="account-section">
                  <h2 className="account-section-title">Account</h2>
                  <div className="account-readonly-grid">
                    <div className="account-readonly-item">
                      <span className="account-readonly-label">Email utente</span>
                      <span className="account-readonly-value">{user.email || "—"}</span>
                    </div>
                    <div className="account-readonly-item">
                      <span className="account-readonly-label">Stato account</span>
                      <span className="account-status">Account attivo</span>
                    </div>
                  </div>
                </div>

                <div className="account-section">
                  <h2 className="account-section-title">Dati personali</h2>
                  <div className="account-form-grid account-form-grid-2">
                    <div className="account-form-group">
                      <label htmlFor="account-nome">Nome</label>
                      <input
                        id="account-nome"
                        type="text"
                        value={profile.nome}
                        onChange={e => setField("nome", e.target.value)}
                        autoComplete="given-name"
                      />
                    </div>
                    <div className="account-form-group">
                      <label htmlFor="account-cognome">Cognome</label>
                      <input
                        id="account-cognome"
                        type="text"
                        value={profile.cognome}
                        onChange={e => setField("cognome", e.target.value)}
                        autoComplete="family-name"
                      />
                    </div>
                  </div>
                </div>

                <div className="account-section account-section-last">
                  <h2 className="account-section-title">Società e sede</h2>
                  <div className="account-form-grid account-form-grid-2">
                    <div className="account-form-group account-form-group-full">
                      <label htmlFor="account-societa">Società</label>
                      <input
                        id="account-societa"
                        type="text"
                        value={profile.societa}
                        onChange={e => setField("societa", e.target.value)}
                        autoComplete="organization"
                      />
                    </div>
                    <div className="account-form-group account-form-group-full">
                      <label htmlFor="account-sede-via">Via</label>
                      <input
                        id="account-sede-via"
                        type="text"
                        value={profile.sede_via}
                        onChange={e => setField("sede_via", e.target.value)}
                        autoComplete="street-address"
                      />
                    </div>
                    <div className="account-form-group">
                      <label htmlFor="account-sede-cap">CAP</label>
                      <input
                        id="account-sede-cap"
                        type="text"
                        value={profile.sede_cap}
                        onChange={e => setField("sede_cap", e.target.value)}
                        autoComplete="postal-code"
                      />
                    </div>
                    <div className="account-form-group">
                      <label htmlFor="account-sede-citta">Città</label>
                      <input
                        id="account-sede-citta"
                        type="text"
                        value={profile.sede_citta}
                        onChange={e => setField("sede_citta", e.target.value)}
                        autoComplete="address-level2"
                      />
                    </div>
                  </div>
                </div>

                <div className="account-actions">
                  <button
                    type="button"
                    className="account-btn account-btn-primary"
                    onClick={handleSave}
                    disabled={saveLoading || logoutLoading}
                  >
                    {saveLoading ? "Salvataggio…" : "Salva modifiche"}
                  </button>
                  <Link href="/" className="account-btn account-btn-neutral">
                    Torna alla dashboard
                  </Link>
                  <button
                    type="button"
                    className="account-btn account-btn-danger"
                    onClick={handleLogout}
                    disabled={logoutLoading || saveLoading}
                  >
                    {logoutLoading ? "Uscita in corso…" : "Logout"}
                  </button>
                </div>

                <div className="account-links">
                  <Link href="/privacy" className="account-link">
                    Privacy e note legali
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <div className="account-card">
              <h1 className="account-title">Non hai effettuato l&apos;accesso</h1>
              <p className="account-lead">
                Accedi con le tue credenziali per visualizzare e modificare il profilo.
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
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .account-page {
          min-height: 100svh;
          background: #f8fafc;
          padding: 28px 24px 48px;
          box-sizing: border-box;
          font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        }

        .account-shell {
          max-width: 1000px;
          margin: 0 auto;
        }

        .account-loading {
          margin: 0;
          padding: 24px;
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
        }

        .account-hero {
          margin-bottom: 20px;
        }

        .account-badge {
          display: inline-flex;
          align-items: center;
          margin-bottom: 12px;
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .account-title {
          margin: 0;
          font-size: clamp(26px, 3vw, 34px);
          font-weight: 900;
          letter-spacing: -0.04em;
          color: #020617;
          line-height: 1.08;
        }

        .account-lead {
          margin: 10px 0 0;
          font-size: 14px;
          line-height: 1.6;
          color: #64748b;
          max-width: 56ch;
        }

        .account-alert {
          margin-bottom: 18px;
          padding: 14px 16px;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.5;
        }

        .account-alert-error {
          border: 1px solid #fecaca;
          background: linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%);
          color: #b91c1c;
          box-shadow: 0 8px 24px rgba(220, 38, 38, 0.08);
        }

        .account-alert-success {
          border: 1px solid #bbf7d0;
          background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
          color: #15803d;
          box-shadow: 0 8px 24px rgba(22, 163, 74, 0.08);
        }

        .account-card {
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          background: #ffffff;
          padding: 28px 28px 24px;
          box-shadow: 0 12px 40px rgba(15, 23, 42, 0.06);
        }

        .account-section {
          margin-bottom: 28px;
          padding-bottom: 28px;
          border-bottom: 1px solid #f1f5f9;
        }

        .account-section-last {
          margin-bottom: 24px;
          padding-bottom: 0;
          border-bottom: 0;
        }

        .account-section-title {
          margin: 0 0 16px;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
        }

        .account-readonly-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .account-readonly-item {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .account-readonly-label {
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
        }

        .account-readonly-value {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          word-break: break-word;
        }

        .account-status {
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .account-form-grid {
          display: grid;
          gap: 16px;
        }

        .account-form-grid-2 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .account-form-group {
          min-width: 0;
        }

        .account-form-group-full {
          grid-column: 1 / -1;
        }

        .account-form-group label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #334155;
        }

        .account-form-group input {
          width: 100%;
          height: 48px;
          box-sizing: border-box;
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          background: #ffffff;
          padding: 0 14px;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .account-form-group input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
        }

        .account-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          padding-top: 8px;
        }

        .account-actions-single {
          flex-direction: column;
          align-items: stretch;
        }

        .account-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 46px;
          padding: 0 18px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          white-space: nowrap;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease,
            box-shadow 0.15s ease,
            opacity 0.15s ease;
        }

        .account-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .account-btn-primary {
          border: 1px solid #1d4ed8;
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.22);
        }

        .account-btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
          border-color: #1e40af;
        }

        .account-btn-neutral {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #475569;
        }

        .account-btn-neutral:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }

        .account-btn-danger {
          border: 1px solid #fca5a5;
          background: #ffffff;
          color: #dc2626;
        }

        .account-btn-danger:hover:not(:disabled) {
          background: #fef2f2;
          border-color: #f87171;
          color: #b91c1c;
        }

        .account-links {
          margin-top: 20px;
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

        @media (max-width: 720px) {
          .account-page {
            padding: 22px 16px 40px;
          }

          .account-card {
            padding: 22px 20px 20px;
          }

          .account-readonly-grid,
          .account-form-grid-2 {
            grid-template-columns: 1fr;
          }

          .account-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .account-btn {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
