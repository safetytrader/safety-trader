import Link from "next/link";

const sections = [
  {
    title: "Titolare del trattamento",
    body: (
      <>
        <p>
          Il titolare del trattamento dei dati personali relativi all&apos;utilizzo dell&apos;applicazione{" "}
          <strong>Safety Trader D.Lgs. 81/2008</strong> è:
        </p>
        <p className="mt-2">
          <strong>Alexandru Bogdan</strong>
          <br />
          Email:{" "}
          <a href="mailto:ialexandrubogdan@gmail.com" className="text-blue-600 hover:underline">
            ialexandrubogdan@gmail.com
          </a>
        </p>
      </>
    ),
  },
  {
    title: "Tipologia di dati trattati",
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>Dati di autenticazione (email, credenziali di accesso gestite tramite Supabase Auth).</li>
        <li>Dati anagrafici e professionali inseriti dall&apos;utente (es. nome, cognome, ruolo).</li>
        <li>Dati relativi a cantieri, imprese, maestranze, checklist e allegati documentali caricati o generati nell&apos;app.</li>
        <li>Metadati tecnici (log di accesso, timestamp, identificativi di sessione) necessari al funzionamento del servizio.</li>
      </ul>
    ),
  },
  {
    title: "Finalità del trattamento",
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>Gestione dell&apos;accesso e dell&apos;account utente.</li>
        <li>Organizzazione e verifica documentale in ambito cantieri, imprese e sicurezza sul lavoro (D.Lgs. 81/2008).</li>
        <li>Archiviazione e consultazione dei documenti caricati dall&apos;utente.</li>
        <li>Eventuale elaborazione tramite funzionalità AI, solo se e quando attivate dall&apos;utente o dal servizio.</li>
        <li>Assistenza, manutenzione e miglioramento del servizio.</li>
      </ul>
    ),
  },
  {
    title: "Base giuridica",
    body: (
      <p>
        Il trattamento si basa sull&apos;esecuzione del contratto o del rapporto con l&apos;utente (art. 6, par. 1, lett. b GDPR),
        sul legittimo interesse del titolare a garantire sicurezza e funzionamento della piattaforma (lett. f), e, ove applicabile,
        sull&apos;obbligo di legge in materia di sicurezza sul lavoro e documentazione (lett. c).
      </p>
    ),
  },
  {
    title: "Modalità di trattamento e conservazione",
    body: (
      <p>
        I dati sono trattati con strumenti informatici e telematici, nel rispetto delle misure di sicurezza adeguate.
        La conservazione avviene per il tempo necessario alle finalità indicate e, per i documenti caricati,
        per la durata dell&apos;utilizzo del servizio e secondo le esigenze operative dell&apos;utente.
        I documenti possono essere eliminati dall&apos;utente o su richiesta, nei limiti tecnici del servizio.
      </p>
    ),
  },
  {
    title: "Servizi terzi utilizzati",
    body: (
      <ul className="list-disc pl-5 space-y-1">
        <li>
          <strong>Supabase</strong> — autenticazione, database e storage documentale.
        </li>
        <li>
          <strong>Vercel</strong> — hosting e distribuzione dell&apos;applicazione web.
        </li>
        <li>
          <strong>OpenAI</strong> — utilizzato solo per eventuali funzionalità AI future o opzionali, se attivate.
        </li>
      </ul>
    ),
  },
  {
    title: "Diritti dell'utente",
    body: (
      <p>
        L&apos;utente può esercitare i diritti previsti dagli artt. 15–22 GDPR (accesso, rettifica, cancellazione, limitazione,
        portabilità, opposizione) scrivendo al titolare all&apos;indirizzo email indicato. Ha inoltre il diritto di proporre
        reclamo all&apos;Autorità Garante per la protezione dei dati personali.
      </p>
    ),
  },
  {
    title: "Sicurezza",
    body: (
      <p>
        Sono adottate misure tecniche e organizzative ragionevoli per proteggere i dati da accessi non autorizzati,
        perdita o alterazione, inclusi accesso tramite autenticazione, comunicazioni cifrate (HTTPS) e controlli
        sui servizi cloud utilizzati. L&apos;utente è responsabile della custodia delle proprie credenziali di accesso.
      </p>
    ),
  },
  {
    title: "Note legali e limitazioni d'uso",
    body: (
      <>
        <p className="mb-3">
          <strong>Safety Trader</strong> è uno strumento di supporto operativo e documentale per la gestione
          della documentazione in ambito cantieri e sicurezza sul lavoro. Non sostituisce e non esclude:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>valutazioni professionali qualificate;</li>
          <li>obblighi del datore di lavoro;</li>
          <li>obblighi del CSE, RSPP o altre figure previste dalla normativa;</li>
          <li>verifiche normative puntuali su singoli casi;</li>
          <li>responsabilità previste dal D.Lgs. 81/2008 e dalla normativa applicabile.</li>
        </ul>
        <p className="mt-3">
          L&apos;uso dell&apos;applicazione non costituisce parere legale, tecnico o di conformità. L&apos;utente resta
          responsabile dei dati inseriti, delle decisioni adottate e della verifica della documentazione.
        </p>
      </>
    ),
  },
  {
    title: "Contatti",
    body: (
      <p>
        Per informazioni su privacy, note legali o esercizio dei diritti:{" "}
        <a href="mailto:ialexandrubogdan@gmail.com" className="text-blue-600 hover:underline">
          ialexandrubogdan@gmail.com
        </a>
        <br />
        Titolare: Alexandru Bogdan
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link
            href="/login"
            className="text-sm text-slate-500 hover:text-slate-700 transition"
          >
            ← Torna al login
          </Link>
        </div>

        <article className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <img src="/logo.svg" alt="Safety Trader" width={40} height={40} className="rounded-lg flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Safety Trader</p>
              <p className="text-xs text-slate-500">D.Lgs. 81/2008</p>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Privacy e note legali</h1>
          <p className="text-sm text-slate-500 mb-8">
            Safety Trader D.Lgs. 81/2008 — informativa provvisoria. Ultimo aggiornamento: maggio 2026.
          </p>

          <div className="space-y-8 text-sm text-slate-700 leading-relaxed">
            {sections.map((s) => (
              <section key={s.title}>
                <h2 className="text-base font-semibold text-slate-800 mb-2">{s.title}</h2>
                {s.body}
              </section>
            ))}
          </div>
        </article>

        <p className="mt-6 text-center text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-600 transition">
            Vai alla dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
