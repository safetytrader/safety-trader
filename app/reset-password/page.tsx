// @ts-nocheck
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { updatePassword } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function initSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!cancelled && data.session) setSessionReady(true);
      } catch {
        if (!cancelled) setSessionReady(false);
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    initSession();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setSessionReady(true);
        setCheckingSession(false);
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

  function validate() {
    if (!password.trim()) return "Inserisci la nuova password.";
    if (password.length < 8) return "La password deve avere almeno 8 caratteri.";
    if (!confirmPassword.trim()) return "Conferma la nuova password.";
    if (password !== confirmPassword) return "Le password non coincidono.";
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      showMsg(validationError, "error");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setMessageType(null);
      await updatePassword(password);
      setCompleted(true);
      showMsg("Password aggiornata correttamente. Ora puoi accedere.", "success");
    } catch (err) {
      const text =
        err instanceof Error ? err.message : "Aggiornamento password non riuscito.";
      showMsg(text, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <main className="recovery-page">
        <div className="recovery-shell">
          <div className="recovery-card">
            <div className="recovery-brand">
              <div className="recovery-mark">ST</div>
              <div>
                <div className="recovery-brand-title">Safety Trader</div>
                <div className="recovery-brand-sub">D.Lgs. 81/2008</div>
              </div>
            </div>

            <h1 className="recovery-title">Imposta nuova password</h1>

            {checkingSession ? (
              <p className="recovery-lead">Verifica del link in corso…</p>
            ) : !sessionReady ? (
              <>
                <p className="recovery-lead">
                  Il link di recupero non è valido o è scaduto. Richiedi un nuovo
                  link dalla pagina di recupero password.
                </p>
                <div className="recovery-links">
                  <Link href="/forgot-password" className="recovery-link">
                    Richiedi nuovo link
                  </Link>
                  <Link href="/login" className="recovery-link">
                    Vai al login
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="recovery-lead">
                  Scegli una nuova password per il tuo account Safety Trader.
                </p>

                {message ? (
                  <div
                    className={
                      messageType === "error"
                        ? "recovery-message recovery-message-error"
                        : "recovery-message recovery-message-success"
                    }
                    role="status"
                  >
                    {message}
                  </div>
                ) : null}

                {!completed ? (
                  <>
                    <div className="recovery-form-group">
                      <label htmlFor="new-password">Nuova password</label>
                      <input
                        id="new-password"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="recovery-form-group">
                      <label htmlFor="confirm-password">Conferma password</label>
                      <input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        onKeyDown={e => {
                          if (e.key === "Enter" && !loading) handleSubmit();
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      className="recovery-btn recovery-btn-primary"
                      onClick={handleSubmit}
                      disabled={loading}
                    >
                      {loading ? "Aggiornamento…" : "Aggiorna password"}
                    </button>
                  </>
                ) : null}

                <div className="recovery-links">
                  <Link href="/login" className="recovery-link">
                    Vai al login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <style jsx>{`
        .recovery-page {
          min-height: 100svh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 20px;
          box-sizing: border-box;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.12), transparent 28rem),
            radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.08), transparent 30rem),
            #f8fafc;
        }

        .recovery-shell {
          width: 100%;
          max-width: 480px;
        }

        .recovery-card {
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          background: #ffffff;
          padding: 32px 28px 28px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 16px 40px rgba(15, 23, 42, 0.08);
        }

        .recovery-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 22px;
        }

        .recovery-mark {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(145deg, #1e3a8a, #2563eb);
          color: #ffffff;
          font-size: 15px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          letter-spacing: 0.04em;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.28);
        }

        .recovery-brand-title {
          font-size: 17px;
          font-weight: 800;
          color: #020617;
          letter-spacing: -0.02em;
        }

        .recovery-brand-sub {
          margin-top: 2px;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
        }

        .recovery-title {
          margin: 0 0 8px;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #020617;
        }

        .recovery-lead {
          margin: 0 0 22px;
          font-size: 14px;
          line-height: 1.6;
          color: #64748b;
        }

        .recovery-message {
          margin-bottom: 18px;
          padding: 12px 14px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.5;
        }

        .recovery-message-error {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #b91c1c;
        }

        .recovery-message-success {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #15803d;
        }

        .recovery-form-group {
          margin-bottom: 14px;
        }

        .recovery-form-group label {
          display: block;
          margin-bottom: 6px;
          font-size: 13px;
          font-weight: 800;
          color: #334155;
        }

        .recovery-form-group input {
          width: 100%;
          height: 48px;
          box-sizing: border-box;
          border: 1px solid #dbe3ef;
          border-radius: 16px;
          background: #ffffff;
          padding: 0 15px;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .recovery-form-group input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.11);
        }

        .recovery-btn {
          width: 100%;
          height: 48px;
          border-radius: 16px;
          border: 0;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
        }

        .recovery-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .recovery-btn-primary {
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.24);
        }

        .recovery-btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .recovery-links {
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid #eef2f7;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .recovery-link {
          font-size: 13px;
          font-weight: 700;
          color: #64748b;
          text-decoration: none;
        }

        .recovery-link:hover {
          color: #2563eb;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
      `}</style>
    </>
  );
}
