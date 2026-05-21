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

  const provider = user ? formatProvider(user) : null;
  const createdAt = user ? formatCreatedAt(user) : null;

  const setField = (key, value) => {
    setProfile(p => ({ ...p, [key]: value }));
  };

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
                  Gestisci profilo, dati società e sessione di accesso.
                </p>

                {message ? (
                  <div
                    className={
                      messageType === "error"
                        ? "account-message account-message-error"
                        : "account-message account-message-success"
                    }
                    role="status"
                  >
                    {message}
                  </div>
                ) : null}

                <div className="account-section">
                  <h2 className="account-section-title">Accesso</h2>
                  <div className="account-fields">
                    <div className="account-field account-field-readonly">
                      <span className="account-field-label">Email</span>
                      <span className="account-field-value">{user.email || "—"}</span>
                    </div>
                    <div className="account-field account-field-readonly">
                      <span className="account-field-label">Stato</span>
                      <span className="account-status">Account attivo</span>
                    </div>
                    {provider ? (
                      <div className="account-field account-field-readonly">
                        <span className="account-field-label">Metodo di accesso</span>
                        <span className="account-field-value">{provider}</span>
                      </div>
                    ) : null}
                    {createdAt ? (
                      <div className="account-field account-field-readonly">
                        <span className="account-field-label">Account creato il</span>
                        <span className="account-field-value">{createdAt}</span>
                      </div>
                    ) : null}
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

                <div className="account-section">
                  <h2 className="account-section-title">Società e sede</h2>
                  <div className="account-form-grid">
                    <div className="account-form-group">
                      <label htmlFor="account-societa">Società</label>
                      <input
                        id="account-societa"
                        type="text"
                        value={profile.societa}
                        onChange={e => setField("societa", e.target.value)}
                        autoComplete="organization"
                      />
                    </div>
                    <div className="account-form-group">
                      <label htmlFor="account-sede-via">Indirizzo sede — Via</label>
                      <input
                        id="account-sede-via"
                        type="text"
                        value={profile.sede_via}
                        onChange={e => setField("sede_via", e.target.value)}
                        autoComplete="street-address"
                      />
                    </div>
                    <div className="account-form-grid account-form-grid-2">
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
                </div>

                <div className="account-actions account-actions-primary">
                  <button
                    type="button"
                    className="account-btn account-btn-primary"
                    onClick={handleSave}
                    disabled={saveLoading || logoutLoading}
                  >
                    {saveLoading ? "Salvataggio…" : "Salva modifiche"}
                  </button>
                </div>

                <div className="account-actions account-actions-secondary">
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
              </>
            ) : (
              <>
                <h1 className="account-title">Non hai effettuato l&apos;accesso</h1>
                <p className="account-lead">
                  Accedi con le tue credenziali per visualizzare e modificare il
                  profilo.
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
          margin: 0 0 20px;
          font-size: 14px;
          line-height: 1.6;
          color: #64748b;
          max-width: 52ch;
        }

        .account-message {
          margin-bottom: 20px;
          padding: 12px 14px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.5;
        }

        .account-message-error {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #b91c1c;
        }

        .account-message-success {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #15803d;
        }

        .account-section {
          margin-bottom: 24px;
        }

        .account-section-title {
          margin: 0 0 12px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #475569;
        }

        .account-fields {
          display: flex;
          flex-direction: column;
          gap: 10px;
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

        .account-field-readonly {
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

        .account-form-grid {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .account-form-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0 12px;
        }

        .account-form-group {
          margin-bottom: 12px;
        }

        .account-form-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 13px;
          font-weight: 800;
          color: #334155;
        }

        .account-form-group input {
          width: 100%;
          height: 46px;
          box-sizing: border-box;
          border: 1px solid #dbe3ef;
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
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
        }

        .account-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 16px;
        }

        .account-actions-primary {
          margin-top: 4px;
          margin-bottom: 12px;
        }

        .account-actions-secondary {
          padding-top: 16px;
          border-top: 1px solid #f1f5f9;
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

        .account-btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .account-btn-neutral {
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #334155;
        }

        .account-btn-neutral:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
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

          .account-form-grid-2 {
            grid-template-columns: 1fr;
            gap: 0;
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
