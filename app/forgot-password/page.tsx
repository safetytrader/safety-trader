// @ts-nocheck
"use client";

import Link from "next/link";
import { useState } from "react";
import { resetPassword } from "@/lib/auth";

const SUCCESS_MSG =
  "Se l'email è registrata, riceverai un link per reimpostare la password.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  function showMsg(text, type) {
    setMessage(text);
    setMessageType(type);
  }

  async function handleSubmit() {
    if (!email.trim()) {
      showMsg("Inserisci la tua email.", "error");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setMessageType(null);
      await resetPassword(email);
      setSubmitted(true);
      showMsg(SUCCESS_MSG, "success");
    } catch (err) {
      const text =
        err instanceof Error ? err.message : "Invio link non riuscito. Riprova.";
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

            <h1 className="recovery-title">Recupera password</h1>
            <p className="recovery-lead">
              Inserisci la tua email. Ti invieremo un link per reimpostare la
              password.
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

            {!submitted ? (
              <>
                <div className="recovery-form-group">
                  <label htmlFor="recovery-email">Email</label>
                  <input
                    id="recovery-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nome@azienda.it"
                    autoComplete="email"
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
                  {loading ? "Invio in corso…" : "Invia link di recupero"}
                </button>
              </>
            ) : null}

            <div className="recovery-links">
              <Link href="/login" className="recovery-link">
                Torna al login
              </Link>
            </div>
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
          text-align: center;
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
