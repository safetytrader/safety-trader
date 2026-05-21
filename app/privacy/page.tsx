// @ts-nocheck
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function gestoreLabel(user) {
  if (!user) return "Dati del professionista / società (da completare in Account)";
  const m = user.user_metadata || {};
  const nome = String(m.nome ?? "").trim();
  const cognome = String(m.cognome ?? "").trim();
  const societa = String(m.societa ?? "").trim();
  const via = String(m.sede_via ?? "").trim();
  const cap = String(m.sede_cap ?? "").trim();
  const citta = String(m.sede_citta ?? "").trim();
  const fullName = [nome, cognome].filter(Boolean).join(" ");
  const sede = [via, cap, citta].filter(Boolean).join(", ");
  const parts = [];
  if (fullName) parts.push(fullName);
  if (societa) parts.push(societa);
  if (sede) parts.push(sede);
  return parts.length ? parts.join(" · ") : "Dati del professionista / società (da completare in Account)";
}

function contactEmail(user) {
  const email = String(user?.email ?? "").trim();
  return email || "Email di contatto da completare";
}

export default function PrivacyPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
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

    loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const email = contactEmail(user);
  const gestore = gestoreLabel(user);
  const emailIsLink = Boolean(user?.email);

  return (
    <>
      <main className="privacy-page">
        <div className="privacy-shell">
          <header className="privacy-hero">
            <span className="privacy-badge">Privacy e note legali</span>
            <h1 className="privacy-title">Informativa e condizioni d&apos;uso</h1>
            <p className="privacy-lead">
              Informazioni sul trattamento dei dati, sull&apos;utilizzo della piattaforma e
              sulle responsabilità operative.
            </p>
          </header>

          <div className="privacy-actions-top">
            <Link href="/" className="privacy-btn privacy-btn-primary">
              Torna alla dashboard
            </Link>
            {user ? (
              <Link href="/account" className="privacy-btn privacy-btn-neutral">
                Account
              </Link>
            ) : (
              <Link href="/login" className="privacy-btn privacy-btn-neutral">
                Accedi
              </Link>
            )}
          </div>

          <article className="privacy-card">
            {loading ? (
              <p className="privacy-loading">Caricamento informazioni…</p>
            ) : (
              <div className="privacy-sections">
                <section className="privacy-section">
                  <h2 className="privacy-section-title">Titolare / Gestore della piattaforma</h2>
                  <div className="privacy-body">
                    <p>
                      <strong>Safety Trader</strong> — piattaforma di supporto alla gestione
                      documentale della sicurezza nei cantieri (D.Lgs. 81/2008).
                    </p>
                    <p>
                      <strong>Gestore:</strong> {gestore}
                    </p>
                    <p>
                      <strong>Email di contatto:</strong>{" "}
                      {emailIsLink ? (
                        <a href={`mailto:${email}`} className="privacy-link">
                          {email}
                        </a>
                      ) : (
                        <span>{email}</span>
                      )}
                    </p>
                  </div>
                </section>

                <section className="privacy-section">
                  <h2 className="privacy-section-title">Finalità della piattaforma</h2>
                  <p className="privacy-body">
                    Safety Trader è uno strumento digitale di supporto alla gestione documentale
                    della sicurezza nei cantieri. La piattaforma consente di organizzare cantieri,
                    imprese, checklist documentali, allegati, maestranze, scadenze e report.
                  </p>
                </section>

                <section className="privacy-section">
                  <h2 className="privacy-section-title">Dati trattati</h2>
                  <ul className="privacy-list">
                    <li>Dati account: email, nome, cognome, società, sede.</li>
                    <li>Dati di cantiere.</li>
                    <li>Dati di imprese.</li>
                    <li>Dati documentali.</li>
                    <li>Dati relativi a maestranze.</li>
                    <li>File caricati dall&apos;utente.</li>
                  </ul>
                </section>

                <section className="privacy-section">
                  <h2 className="privacy-section-title">Finalità del trattamento</h2>
                  <ul className="privacy-list">
                    <li>Autenticazione utenti.</li>
                    <li>Gestione documentale.</li>
                    <li>Archiviazione file.</li>
                    <li>Generazione report.</li>
                    <li>Controllo operativo delle scadenze.</li>
                    <li>Miglioramento dell&apos;organizzazione documentale.</li>
                  </ul>
                </section>

                <section className="privacy-section">
                  <h2 className="privacy-section-title">Conservazione dei dati</h2>
                  <p className="privacy-body">
                    I dati e i documenti rimangono disponibili nella piattaforma fino alla loro
                    eliminazione da parte dell&apos;utente o fino alla cessazione dell&apos;utilizzo
                    del servizio, salvo obblighi di conservazione applicabili.
                  </p>
                </section>

                <section className="privacy-section">
                  <h2 className="privacy-section-title">Responsabilità dell&apos;utente</h2>
                  <p className="privacy-body">
                    L&apos;utente è responsabile della correttezza, completezza e aggiornamento dei
                    dati e dei documenti caricati nella piattaforma.
                  </p>
                </section>

                <section className="privacy-section">
                  <h2 className="privacy-section-title">Limiti dello strumento</h2>
                  <p className="privacy-body privacy-body-emphasis">
                    Safety Trader costituisce uno strumento di supporto operativo e documentale. Non
                    sostituisce le valutazioni professionali, le verifiche normative, gli obblighi
                    del Datore di Lavoro, del Committente, del Responsabile dei Lavori, del CSP, del
                    CSE, dell&apos;RSPP o degli altri soggetti previsti dalla normativa applicabile.
                  </p>
                </section>

                <section className="privacy-section">
                  <h2 className="privacy-section-title">Documenti e file caricati</h2>
                  <p className="privacy-body">
                    I documenti caricati sono gestiti dall&apos;utente e associati ai
                    cantieri/imprese di riferimento. L&apos;utente deve evitare il caricamento di
                    dati non pertinenti, eccedenti o non necessari rispetto alle finalità di gestione
                    documentale.
                  </p>
                </section>

                <section className="privacy-section">
                  <h2 className="privacy-section-title">Sicurezza</h2>
                  <p className="privacy-body">
                    L&apos;accesso alla piattaforma avviene tramite autenticazione. I dati sono
                    associati all&apos;account dell&apos;utente e protetti mediante le regole di
                    accesso configurate sulla piattaforma.
                  </p>
                </section>

                <section className="privacy-section">
                  <h2 className="privacy-section-title">Contatti</h2>
                  <p className="privacy-body">
                    Per richieste relative alla privacy, alla gestione dell&apos;account o ai dati
                    caricati, contattare il gestore della piattaforma
                    {emailIsLink ? (
                      <>
                        {" "}
                        all&apos;indirizzo{" "}
                        <a href={`mailto:${email}`} className="privacy-link">
                          {email}
                        </a>
                      </>
                    ) : (
                      " (email da completare nel profilo Account)"
                    )}
                    .
                  </p>
                </section>

                <section className="privacy-section privacy-section-final">
                  <p className="privacy-note">
                    Questa pagina costituisce una base informativa operativa e dovrà essere
                    verificata e personalizzata prima dell&apos;utilizzo commerciale o della messa
                    a disposizione della piattaforma a soggetti terzi.
                  </p>
                </section>
              </div>
            )}
          </article>

          <div className="privacy-actions-bottom">
            <Link href="/" className="privacy-btn privacy-btn-primary">
              Torna alla dashboard
            </Link>
            {user ? (
              <Link href="/account" className="privacy-btn privacy-btn-neutral">
                Account
              </Link>
            ) : null}
          </div>
        </div>
      </main>

      <style jsx>{`
        .privacy-page {
          min-height: 100vh;
          background: #f8fafc;
          padding: 32px 20px 48px;
          font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
          color: #0f172a;
        }

        .privacy-shell {
          max-width: 1000px;
          margin: 0 auto;
        }

        .privacy-hero {
          margin-bottom: 20px;
        }

        .privacy-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: #1d4ed8;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
        }

        .privacy-title {
          margin: 14px 0 0;
          font-size: clamp(26px, 4vw, 34px);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.15;
          color: #0f172a;
        }

        .privacy-lead {
          margin: 10px 0 0;
          max-width: 720px;
          font-size: 15px;
          line-height: 1.55;
          color: #475569;
        }

        .privacy-actions-top,
        .privacy-actions-bottom {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        }

        .privacy-actions-bottom {
          margin-bottom: 0;
          margin-top: 20px;
        }

        .privacy-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 44px;
          padding: 0 18px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }

        .privacy-btn-primary {
          background: #2563eb;
          color: #ffffff;
          border: 1px solid #2563eb;
        }

        .privacy-btn-primary:hover {
          background: #1d4ed8;
          border-color: #1d4ed8;
        }

        .privacy-btn-neutral {
          background: #ffffff;
          color: #334155;
          border: 1px solid #cbd5e1;
        }

        .privacy-btn-neutral:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }

        .privacy-card {
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          background: #ffffff;
          padding: 28px 28px 24px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
        }

        .privacy-loading {
          margin: 0;
          font-size: 14px;
          color: #64748b;
        }

        .privacy-sections {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .privacy-section {
          padding-bottom: 22px;
          border-bottom: 1px solid #f1f5f9;
        }

        .privacy-section:last-child {
          padding-bottom: 0;
          border-bottom: 0;
        }

        .privacy-section-title {
          margin: 0 0 10px;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
        }

        .privacy-body {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: #334155;
        }

        .privacy-body + .privacy-body {
          margin-top: 10px;
        }

        .privacy-body-emphasis {
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #1e293b;
        }

        .privacy-list {
          margin: 0;
          padding-left: 20px;
          font-size: 14px;
          line-height: 1.65;
          color: #334155;
        }

        .privacy-list li + li {
          margin-top: 6px;
        }

        .privacy-link {
          color: #2563eb;
          font-weight: 600;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .privacy-link:hover {
          color: #1d4ed8;
        }

        .privacy-section-final {
          margin-top: 4px;
        }

        .privacy-note {
          margin: 0;
          padding: 14px 16px;
          border-radius: 16px;
          border: 1px solid #fde68a;
          background: #fffbeb;
          font-size: 13px;
          line-height: 1.55;
          color: #78350f;
        }

        @media (max-width: 640px) {
          .privacy-page {
            padding: 24px 16px 40px;
          }

          .privacy-card {
            padding: 22px 18px 20px;
            border-radius: 20px;
          }

          .privacy-actions-top,
          .privacy-actions-bottom {
            flex-direction: column;
            align-items: stretch;
          }

          .privacy-btn {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
