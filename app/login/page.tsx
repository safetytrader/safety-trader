"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn, signUp } from "@/lib/auth";

type MessageType = "success" | "error" | null;

export default function LoginPage() {
  const router = useRouter();

  const [registerMode, setRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [societa, setSocieta] = useState("");
  const [sedeVia, setSedeVia] = useState("");
  const [sedeCap, setSedeCap] = useState("");
  const [sedeCitta, setSedeCitta] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>(null);

  function showMsg(text: string, type: MessageType) {
    setMessage(text);
    setMessageType(type);
  }

  async function handleLogin() {
    try {
      setLoading(true);
      setMessage("");
      setMessageType(null);

      await signIn(email, password);

      showMsg("Accesso riuscito. Reindirizzamento in corso...", "success");
      router.push("/");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Accesso non riuscito.";
      showMsg(text, "error");
    } finally {
      setLoading(false);
    }
  }

  function validateRegister() {
    if (!email.trim()) return "Inserisci l'email.";
    if (!password.trim()) return "Inserisci la password.";
    if (!nome.trim()) return "Inserisci il nome.";
    if (!cognome.trim()) return "Inserisci il cognome.";
    if (!societa.trim()) return "Inserisci la società.";
    if (!sedeVia.trim()) return "Inserisci l'indirizzo della sede (via).";
    if (!sedeCap.trim()) return "Inserisci il CAP.";
    if (!sedeCitta.trim()) return "Inserisci la città.";
    return null;
  }

  async function handleRegister() {
    if (!registerMode) {
      setRegisterMode(true);
      showMsg("Compila i dati profilo per completare la registrazione.", "error");
      return;
    }

    const validationError = validateRegister();
    if (validationError) {
      showMsg(validationError, "error");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setMessageType(null);

      await signUp(email, password, {
        nome,
        cognome,
        societa,
        sede_via: sedeVia,
        sede_cap: sedeCap,
        sede_citta: sedeCitta,
      });

      showMsg(
        "Registrazione completata. Controlla la tua email per confermare l'account.",
        "success"
      );
    } catch (err) {
      const text =
        err instanceof Error ? err.message : "Registrazione non riuscita.";
      showMsg(text, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <main className="login-page">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />

        <section className="login-shell">
          <div className="product-panel">
            <div className="brand-row">
              <div className="brand-mark">ST</div>

              <div>
                <div className="brand-title">Safety Trader</div>
                <div className="brand-subtitle">D.Lgs. 81/2008</div>
              </div>
            </div>

            <div className="eyebrow">Controllo documentale Sicurezza sul Lavoro</div>

            <h1>
              Gestisci documenti, scadenze e imprese in un unico spazio.
            </h1>

            <p className="lead">
              Piattaforma per la gestione documentale della sicurezza nei
              cantieri: cantieri, imprese, checklist, allegati, maestranze e
              documenti sempre sotto controllo.
            </p>

            <div className="feature-list">
              <div className="feature-card">
                <span>01</span>
                <div>
                  <strong>Gestione cantieri e imprese</strong>
                  <p>Organizza commesse, soggetti coinvolti e ruoli operativi.</p>
                </div>
              </div>

              <div className="feature-card">
                <span>02</span>
                <div>
                  <strong>Check-list documentale e allegati</strong>
                  <p>Monitora documenti aziendali, scadenze e completezza.</p>
                </div>
              </div>

              <div className="feature-card">
                <span>03</span>
                <div>
                  <strong>Maestranze, scadenze e documenti</strong>
                  <p>Tieni sotto controllo idoneità, formazione e abilitazioni.</p>
                </div>
              </div>
            </div>

            <p className="legal-note">
              Safety Trader è uno strumento di supporto operativo e
              documentale. Non sostituisce valutazioni professionali, verifiche
              normative o responsabilità previste dal D.Lgs. 81/2008.
            </p>
          </div>

          <div className="auth-panel">
            <div className="auth-card">
              <div className="mobile-logo">ST</div>

              <h2>{registerMode ? "Crea il tuo account" : "Accedi al tuo account"}</h2>
              <p className="auth-subtitle">
                {registerMode
                  ? "Inserisci credenziali e dati profilo per registrarti su Safety Trader."
                  : "Inserisci le credenziali per continuare nella tua area documentale."}
              </p>

              {message && (
                <div
                  className={
                    messageType === "error"
                      ? "message message-error"
                      : "message message-success"
                  }
                >
                  {message}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nome@azienda.it"
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete={registerMode ? "new-password" : "current-password"}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !loading) {
                      if (registerMode) handleRegister();
                      else handleLogin();
                    }
                  }}
                />
              </div>

              {!registerMode ? (
                <p className="forgot-link-wrap">
                  <Link href="/forgot-password" className="forgot-link">
                    Password dimenticata?
                  </Link>
                </p>
              ) : null}

              {registerMode ? (
                <div className="profile-section">
                  <div className="profile-section-head">Dati profilo</div>

                  <div className="profile-grid profile-grid-2">
                    <div className="form-group">
                      <label htmlFor="nome">Nome</label>
                      <input
                        id="nome"
                        type="text"
                        value={nome}
                        onChange={e => setNome(e.target.value)}
                        placeholder="Mario"
                        autoComplete="given-name"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="cognome">Cognome</label>
                      <input
                        id="cognome"
                        type="text"
                        value={cognome}
                        onChange={e => setCognome(e.target.value)}
                        placeholder="Rossi"
                        autoComplete="family-name"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="societa">Società</label>
                    <input
                      id="societa"
                      type="text"
                      value={societa}
                      onChange={e => setSocieta(e.target.value)}
                      placeholder="Ragione sociale"
                      autoComplete="organization"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="sede_via">Indirizzo sede — Via</label>
                    <input
                      id="sede_via"
                      type="text"
                      value={sedeVia}
                      onChange={e => setSedeVia(e.target.value)}
                      placeholder="Via Esempio 12"
                      autoComplete="street-address"
                    />
                  </div>

                  <div className="profile-grid profile-grid-2">
                    <div className="form-group">
                      <label htmlFor="sede_cap">CAP</label>
                      <input
                        id="sede_cap"
                        type="text"
                        value={sedeCap}
                        onChange={e => setSedeCap(e.target.value)}
                        placeholder="00100"
                        autoComplete="postal-code"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="sede_citta">Città</label>
                      <input
                        id="sede_citta"
                        type="text"
                        value={sedeCitta}
                        onChange={e => setSedeCitta(e.target.value)}
                        placeholder="Roma"
                        autoComplete="address-level2"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              <p className="mode-toggle">
                {registerMode ? (
                  <button
                    type="button"
                    className="mode-toggle-btn"
                    onClick={() => {
                      setRegisterMode(false);
                      setMessage("");
                      setMessageType(null);
                    }}
                  >
                    Hai già un account? Accedi
                  </button>
                ) : (
                  <button
                    type="button"
                    className="mode-toggle-btn"
                    onClick={() => {
                      setRegisterMode(true);
                      setMessage("");
                      setMessageType(null);
                    }}
                  >
                    Crea un nuovo account
                  </button>
                )}
              </p>

              <div className="actions">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={handleLogin}
                  disabled={loading}
                >
                  {loading ? "Operazione in corso..." : "Accedi"}
                </button>

                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleRegister}
                  disabled={loading}
                >
                  Registrati
                </button>
              </div>

              <div className="auth-links">
                <Link href="/privacy">Privacy e note legali</Link>
                <Link href="/">Torna alla dashboard</Link>
              </div>
            </div>

            <p className="security-note">
              Accesso riservato agli utenti autorizzati. I dati sono protetti
              tramite autenticazione Supabase e policy RLS.
            </p>
          </div>
        </section>
      </main>

      <style jsx>{`
        .login-page {
          position: relative;
          min-height: 100svh;
          height: 100svh;
          overflow: hidden;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, 0.24), transparent 32rem),
            radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.16), transparent 34rem),
            linear-gradient(135deg, #020617 0%, #0f172a 48%, #111827 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 20px;
          color: #0f172a;
          box-sizing: border-box;
        }

        .ambient {
          position: absolute;
          border-radius: 999px;
          filter: blur(70px);
          opacity: 0.65;
          pointer-events: none;
        }

        .ambient-one {
          width: 360px;
          height: 360px;
          top: -120px;
          left: -80px;
          background: rgba(59, 130, 246, 0.45);
        }

        .ambient-two {
          width: 420px;
          height: 420px;
          right: -120px;
          bottom: -140px;
          background: rgba(34, 211, 238, 0.18);
        }

        .login-shell {
          position: relative;
          z-index: 1;
          width: min(1120px, 100%);
          height: min(760px, calc(100svh - 48px));
          max-height: calc(100svh - 48px);
          display: grid;
          grid-template-columns: 1.08fr 0.92fr;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 32px;
          background: #ffffff;
          box-shadow: 0 30px 90px rgba(2, 6, 23, 0.45);
        }

        .product-panel {
          position: relative;
          padding: 44px;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(circle at 15% 10%, rgba(96, 165, 250, 0.28), transparent 24rem),
            radial-gradient(circle at 90% 80%, rgba(34, 211, 238, 0.16), transparent 22rem),
            #0f172a;
          color: #ffffff;
        }

        .brand-row {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 32px;
          flex-shrink: 0;
        }

        .brand-mark,
        .mobile-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 18px;
          background: #ffffff;
          color: #0f172a;
          font-weight: 900;
          font-size: 18px;
          letter-spacing: -0.03em;
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.22);
        }

        .brand-title {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .brand-subtitle {
          margin-top: 3px;
          font-size: 13px;
          font-weight: 700;
          color: #bfdbfe;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          margin-bottom: 14px;
          padding: 7px 11px;
          flex-shrink: 0;
          border: 1px solid rgba(147, 197, 253, 0.22);
          border-radius: 999px;
          background: rgba(59, 130, 246, 0.12);
          color: #dbeafe;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        h1 {
          max-width: 680px;
          margin: 0;
          font-size: clamp(34px, 4.2vw, 50px);
          line-height: 1;
          letter-spacing: -0.06em;
          font-weight: 900;
          flex-shrink: 0;
        }

        .lead {
          max-width: 610px;
          margin: 16px 0 0;
          color: #cbd5e1;
          font-size: 15px;
          line-height: 1.6;
          flex-shrink: 0;
        }

        .feature-list {
          display: grid;
          gap: 10px;
          margin-top: 28px;
          flex: 1;
          min-height: 0;
        }

        .feature-card {
          display: flex;
          gap: 14px;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.075);
          backdrop-filter: blur(12px);
        }

        .feature-card span {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          width: 34px;
          height: 34px;
          border-radius: 12px;
          background: rgba(96, 165, 250, 0.18);
          color: #bfdbfe;
          font-size: 13px;
          font-weight: 900;
        }

        .feature-card strong {
          display: block;
          color: #ffffff;
          font-size: 14px;
          font-weight: 800;
        }

        .feature-card p {
          margin: 4px 0 0;
          color: #cbd5e1;
          font-size: 12px;
          line-height: 1.45;
        }

        .legal-note {
          max-width: 640px;
          margin: 18px 0 0;
          color: #94a3b8;
          font-size: 11px;
          line-height: 1.5;
          flex-shrink: 0;
        }

        .auth-panel {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 40px;
          min-height: 0;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(248, 250, 252, 1), rgba(241, 245, 249, 1));
        }

        .auth-card {
          width: 100%;
          max-width: 430px;
          margin: 0 auto;
          padding: 30px;
          border: 1px solid #e2e8f0;
          border-radius: 28px;
          background: #ffffff;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.13);
          max-height: calc(100svh - 80px);
          overflow-y: auto;
        }

        .profile-section {
          margin-top: 4px;
          padding-top: 14px;
          border-top: 1px solid #eef2f7;
        }

        .profile-section-head {
          margin-bottom: 4px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #64748b;
        }

        .profile-grid {
          display: grid;
          gap: 0;
        }

        .profile-grid-2 {
          grid-template-columns: 1fr 1fr;
          gap: 0 10px;
        }

        .mode-toggle {
          margin: 14px 0 0;
          text-align: center;
        }

        .mode-toggle-btn {
          border: 0;
          background: none;
          padding: 0;
          color: #2563eb;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .mode-toggle-btn:hover {
          color: #1d4ed8;
        }

        .mobile-logo {
          display: none;
          margin-bottom: 22px;
          background: #0f172a;
          color: #ffffff;
        }

        h2 {
          margin: 0;
          color: #020617;
          font-size: 28px;
          line-height: 1.08;
          font-weight: 900;
          letter-spacing: -0.045em;
        }

        .auth-subtitle {
          margin: 8px 0 20px;
          color: #64748b;
          font-size: 14px;
          line-height: 1.55;
        }

        .message {
          margin-bottom: 16px;
          padding: 11px 13px;
          border-radius: 16px;
          font-size: 13px;
          line-height: 1.5;
          font-weight: 600;
        }

        .message-error {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #b91c1c;
        }

        .message-success {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #15803d;
        }

        .forgot-link-wrap {
          margin: 4px 0 0;
          text-align: right;
        }

        .forgot-link {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          text-decoration: none;
          transition: color 0.18s ease;
        }

        .forgot-link:hover {
          color: #2563eb;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .form-group {
          margin-top: 12px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          color: #334155;
          font-size: 13px;
          font-weight: 800;
        }

        .form-group input {
          width: 100%;
          height: 48px;
          box-sizing: border-box;
          border: 1px solid #dbe3ef;
          border-radius: 16px;
          background: #ffffff;
          padding: 0 15px;
          color: #0f172a;
          font-size: 14px;
          outline: none;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .form-group input::placeholder {
          color: #94a3b8;
        }

        .form-group input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.11);
        }

        .actions {
          display: grid;
          gap: 10px;
          margin-top: 18px;
        }

        .primary-btn,
        .secondary-btn {
          height: 48px;
          border-radius: 16px;
          border: 0;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease,
            background 0.18s ease, border-color 0.18s ease;
        }

        .primary-btn {
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.24);
        }

        .primary-btn:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 18px 38px rgba(37, 99, 235, 0.28);
        }

        .secondary-btn {
          border: 1px solid #dbe3ef;
          background: #ffffff;
          color: #0f172a;
        }

        .secondary-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          transform: translateY(-1px);
        }

        .primary-btn:disabled,
        .secondary-btn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
          transform: none;
          box-shadow: none;
        }

        .auth-links {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid #eef2f7;
        }

        .auth-links a {
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          transition: color 0.18s ease;
        }

        .auth-links a:hover {
          color: #2563eb;
        }

        .security-note {
          max-width: 430px;
          margin: 16px auto 0;
          color: #64748b;
          text-align: center;
          font-size: 11px;
          line-height: 1.5;
          flex-shrink: 0;
        }

        @media (max-height: 820px) {
          .login-page {
            padding: 16px 18px;
          }

          .login-shell {
            height: min(700px, calc(100svh - 32px));
            max-height: calc(100svh - 32px);
          }

          .product-panel,
          .auth-panel {
            padding: 32px;
          }

          .brand-row {
            margin-bottom: 22px;
          }

          h1 {
            font-size: clamp(30px, 3.8vw, 44px);
          }

          .lead {
            margin-top: 12px;
            font-size: 14px;
          }

          .feature-list {
            margin-top: 20px;
            gap: 8px;
          }

          .feature-card {
            padding: 12px;
          }

          .legal-note {
            margin-top: 12px;
            font-size: 10px;
            line-height: 1.4;
          }

          .auth-card {
            padding: 26px;
          }

          h2 {
            font-size: 26px;
          }

          .auth-subtitle {
            margin-bottom: 16px;
          }
        }

        @media (max-height: 720px) {
          .legal-note {
            display: none;
          }

          .feature-card p {
            display: none;
          }

          .feature-card {
            padding: 10px 12px;
          }
        }

        @media (max-width: 980px) {
          .login-page {
            height: auto;
            min-height: 100svh;
            overflow: auto;
            padding: 28px 16px;
          }

          .login-shell {
            grid-template-columns: 1fr;
            border-radius: 28px;
            height: auto;
            max-height: none;
          }

          .product-panel {
            padding: 34px;
          }

          .brand-row {
            margin-bottom: 32px;
          }

          .feature-list {
            margin-top: 30px;
          }

          .auth-panel {
            padding: 34px;
          }

          .auth-card {
            max-width: 100%;
          }
        }

        @media (max-width: 560px) {
          .login-page {
            height: auto;
            min-height: 100svh;
            overflow: auto;
          }

          .product-panel {
            display: none;
          }

          .auth-panel {
            min-height: 100svh;
            padding: 26px 18px;
          }

          .login-shell {
            width: 100%;
            border-radius: 24px;
            height: auto;
            max-height: none;
          }

          .auth-card {
            padding: 26px;
            border-radius: 24px;
          }

          .mobile-logo {
            display: flex;
          }

          h2 {
            font-size: 26px;
          }

          .auth-links {
            flex-direction: column;
            align-items: center;
          }

          .profile-grid-2 {
            grid-template-columns: 1fr;
            gap: 0;
          }
        }
      `}</style>
    </>
  );
}
