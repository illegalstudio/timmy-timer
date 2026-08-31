<p align="center">
  <img src="public/favicon.svg" alt="Marchio di Timmy Timer" width="112">
</p>

<h1 align="center">Timmy Timer</h1>

<p align="center"><em>Il tempo giusto, al posto giusto.</em></p>

<p align="center">
  <a href="https://github.com/nahime0/timmy-timer/stargazers"><img src="https://img.shields.io/github/stars/nahime0/timmy-timer?style=flat-square&logo=github&logoColor=white&label=stars&color=F06B52" alt="Stelle su GitHub"></a>
  <a href="https://github.com/nahime0/timmy-timer/commits/main"><img src="https://img.shields.io/github/last-commit/nahime0/timmy-timer?style=flat-square&logo=git&logoColor=white&label=ultimo%20commit&color=F06B52" alt="Ultimo commit"></a>
  <img src="https://img.shields.io/badge/Node-%E2%89%A522.13-F06B52?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 22.13 o successivo">
  <img src="https://img.shields.io/badge/React-19-F06B52?style=flat-square&logo=react&logoColor=white" alt="React 19">
</p>

<p align="center"><strong>Agenda settimanale &middot; Clienti e progetti &middot; Report CSV/PDF &middot; Cloudflare D1</strong></p>

<p align="center">
  Un time tracker personale che trasforma ore, clienti e progetti in una routine semplice da leggere.<br>
  Timmy accompagna ogni passaggio, dall'onboarding al report finale.
</p>

---

<p align="center">
  <img src="public/og-timmy-timer.png" alt="Timmy Timer — Il tempo giusto, al posto giusto" width="860">
</p>

## Il time tracking, felice

Timmy Timer raccoglie in un'unica interfaccia tutto ciò che serve per registrare il lavoro quotidiano: una settimana visuale, clienti e progetti ben riconoscibili, tariffe congelate nel momento giusto e report pronti da esportare.

L'app è pensata per restare veloce anche nei flussi più ripetitivi. Le attività si creano trascinando sull'agenda, si spostano e ridimensionano direttamente nel calendario e si gestiscono anche dal menu contestuale. Timmy resta sempre nei paraggi per dare contesto, feedback e un po' di personalità.

## Cosa sa fare Timmy

| Funzione                            | In pratica                                                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agenda visuale**                  | Crea attività trascinando, spostale tra giorni e orari e modifica la durata direttamente dalla settimana.                                             |
| **Clienti e progetti**              | Organizza il lavoro con colori, avatar riconoscibili e tariffe orarie dedicate.                                                                       |
| **Ricerca rapida**                  | Trova clienti e progetti nelle select filtrabili, navigabili da tastiera e sempre contenute nel viewport.                                             |
| **Modifica ed eliminazione sicura** | Modifica o elimina le attività dal menu contestuale; quando rimuovi clienti o progetti puoi riassegnare o cancellare le attività rimaste senza padre. |
| **Report utili**                    | Filtra per periodo, cliente e progetto, controlla ore e valori economici ed esporta in CSV o PDF.                                                     |
| **Tariffe storiche affidabili**     | Ogni registrazione conserva la tariffa applicata, così una modifica futura non altera i conteggi già registrati.                                      |
| **Responsive e installabile**       | Usa Timmy Timer anche su schermi piccoli e installalo come PWA grazie a manifest e service worker.                                                    |

## Avvio locale

Servono [Node.js](https://nodejs.org/) **22.13 o successivo** e npm.

```bash
git clone git@github.com:nahime0/timmy-timer.git
cd timmy-timer
npm install
npm run dev
```

L'app sarà disponibile su [http://localhost:3000](http://localhost:3000). In sviluppo viene usata un'istanza locale di Cloudflare D1: lo schema viene inizializzato dall'app e i dati locali restano nella directory `.wrangler/`, esclusa da Git.

## Flusso dei dati

```text
Cliente
└── Progetto
    └── Attività in agenda
        ├── durata e descrizione
        ├── tariffa applicata
        └── stato fatturabile / fatturato
```

Clienti, progetti e attività sono salvati su **Cloudflare D1** tramite **Drizzle ORM**. La cancellazione delle entità collegate viene gestita esplicitamente: prima di procedere, l'interfaccia permette di riassegnare le attività orfane oppure di eliminarle insieme all'entità.

## Stack

| Area                | Tecnologia                                   |
| ------------------- | -------------------------------------------- |
| Interfaccia         | React 19, Next App Router, TypeScript 5.9    |
| Build e runtime     | Vinext, Vite 8, Cloudflare Workers           |
| Persistenza         | Cloudflare D1 (SQLite), Drizzle ORM          |
| Stile               | CSS custom properties, Tailwind CSS pipeline |
| Esportazione report | CSV nel browser, PDF con jsPDF               |
| Installabilità      | Web app manifest e service worker            |

## Comandi disponibili

| Comando                | Cosa fa                                         |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Avvia l'ambiente di sviluppo                    |
| `npm run build`        | Genera la build di produzione                   |
| `npm run start`        | Avvia la build in modalità produzione           |
| `npm run lint`         | Controlla il codice con ESLint                  |
| `npm run format`       | Formatta il progetto con Prettier               |
| `npm run format:check` | Verifica la formattazione senza modificare file |
| `npm run db:generate`  | Genera le migrazioni Drizzle dallo schema       |

## Struttura del progetto

<details>
<summary>Mostra le directory principali</summary>

```text
timmy-timer/
├── app/
│   ├── api/data/          # API per clienti, progetti e attività
│   ├── components/        # Agenda, report, modali, select e Timmy
│   ├── lib/               # Tipi e utilità per il tempo
│   ├── globals.css        # Design system e stili globali
│   └── page.tsx           # Ingresso dell'applicazione
├── db/
│   ├── schema.ts          # Modello dati Drizzle
│   └── index.ts           # Connessione a Cloudflare D1
├── drizzle/               # Migrazioni SQL
├── public/
│   ├── timmy.png          # Mascotte
│   ├── favicon.svg        # Marchio
│   └── og-timmy-timer.png # Immagine social
└── vite.config.ts         # Vinext, Sites e runtime Cloudflare
```

</details>

---

<p align="center">
  <img src="public/timmy.png" alt="Timmy, la mascotte di Timmy Timer" width="170"><br>
  <strong>Fai spazio alle cose importanti. Al tempo ci pensa Timmy.</strong>
</p>
