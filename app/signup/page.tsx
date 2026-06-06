"use client";

import Link from "next/link";
import { useState } from "react";
import { signUp } from "@/lib/auth";

type MessageType = "success" | "error" | null;

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [societa, setSocieta] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>(null);
  const [done, setDone] = useState(false);

  async function handleSignup() {
    try {
      setLoading(true);
      setMessage("");
      setMessageType(null);

      if (!email.trim() || !password.trim()) {
        setMessage("Inserisci email e password.");
        setMessageType("error");
        return;
      }

      await signUp(email.trim(), password, {
        nome,
        cognome,
        societa,
      });

      setDone(true);
      setMessage(
        "Registrazione completata. Il tuo account è in attesa di approvazione amministratore."
      );
      setMessageType("success");
    } catch (err) {
      const text =
        err instanceof Error ? err.message : "Registrazione non riuscita. Riprova.";
      setMessage(text);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="signup-page">
      <section className="signup-card">
        <div className="brand-mark">ST</div>
        <h1>Registrati</h1>
        <p className="lead">
          Crea un account Safety Trader. Dopo la registrazione un amministratore dovrà
          approvare l&apos;accesso.
        </p>

        {message && (
          <div
            className={
              messageType === "error" ? "message message-error" : "message message-success"
            }
          >
            {message}
          </div>
        )}

        {!done ? (
          <>
            <div className="form-group">
              <label htmlFor="nome">Nome</label>
              <input id="nome" value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="cognome">Cognome</label>
              <input id="cognome" value={cognome} onChange={e => setCognome(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="societa">Società</label>
              <input id="societa" value={societa} onChange={e => setSocieta(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <button
              type="button"
              className="primary-btn"
              disabled={loading}
              onClick={handleSignup}
            >
              {loading ? "Registrazione in corso…" : "Registrati"}
            </button>
          </>
        ) : (
          <Link href="/login" className="primary-btn link-as-btn">
            Vai al login
          </Link>
        )}

        <p className="footer-links">
          <Link href="/login">Hai già un account? Accedi</Link>
        </p>
      </section>

      <style jsx>{`
        .signup-page {
          min-height: 100svh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: linear-gradient(135deg, #020617 0%, #0f172a 48%, #111827 100%);
        }

        .signup-card {
          width: min(460px, 100%);
          padding: 32px;
          border-radius: 28px;
          background: #fff;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
        }

        .brand-mark {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
          color: #fff;
          font-weight: 900;
          margin-bottom: 18px;
        }

        h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .lead {
          margin: 10px 0 20px;
          color: #64748b;
          font-size: 13px;
          line-height: 1.5;
        }

        .form-group {
          margin-bottom: 12px;
        }

        label {
          display: block;
          margin-bottom: 6px;
          font-size: 13px;
          font-weight: 800;
          color: #334155;
        }

        input {
          width: 100%;
          height: 46px;
          box-sizing: border-box;
          border: 1px solid #dbe3ef;
          border-radius: 14px;
          padding: 0 14px;
          font-size: 14px;
        }

        .primary-btn,
        .link-as-btn {
          display: block;
          width: 100%;
          height: 48px;
          margin-top: 8px;
          border: 0;
          border-radius: 14px;
          background: #2563eb;
          color: #fff;
          font-size: 14px;
          font-weight: 900;
          text-align: center;
          line-height: 48px;
          text-decoration: none;
          cursor: pointer;
        }

        .primary-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .message {
          margin-bottom: 14px;
          padding: 11px 13px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 600;
        }

        .message-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .message-success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #15803d;
        }

        .footer-links {
          margin: 18px 0 0;
          text-align: center;
          font-size: 13px;
        }

        .footer-links :global(a) {
          color: #2563eb;
          font-weight: 700;
          text-decoration: underline;
        }
      `}</style>
    </main>
  );
}
