import { concettiInOrdine, idBreve } from "./mappa.js";
import { FORME } from "./generati.js";
import { perClasse } from "./compito.js";
import { contestoClasse, erroriCandidati } from "./classe.js";

// Chi studia, detto con la classe del profilo e senza genere (issue #27): «chi fa la 2ª media».
const chiStudia = (classe) => { const c = perClasse(classe); return (c.startsWith("scuola") ? "chi va alla " : "chi fa la ") + c; };
// La classe con il suo modo di scrivere e il programma (issue #28): argomento più vicino, strategie, errori tipici.
const perLaClasse = (classe, materia, testo) => contestoClasse({ classe, materia, testo: String(testo ?? "").slice(0, 4000) });

// Prompt al modello. La base è copiata parola per parola da prototipo/prova-verifiche.html,
// dove è stata tarata sul campo; le modifiche successive sono segnate con la loro data.
// Non riscriverli senza rifare la taratura.

// Trascrizione al primo caricamento (prototipo, leggiMateriale).
export const PROMPT_TRASCRIZIONE = [
  "Trascrivi fedelmente tutto il testo di queste pagine di quaderno o di libro, grafia a mano inclusa.",
  "Le foto sono scattate al volo da chi studia: possono essere storte, ruotate anche di 90 o 180 gradi, inclinate, sfocate, con ombre, riflessi, dita sul bordo, pagine curve o due pagine nello stesso scatto. Raddrizzale mentalmente e leggile lo stesso, pagina per pagina.",
  "Leggi anche quello che è scritto a margine, sottolineato, evidenziato o aggiunto a mano sopra il testo stampato: spesso è la parte che conta.",
  "Dove una parola è davvero illeggibile scrivi [?] e vai avanti: trascrivi tutto il resto. Non saltare una pagina perché è venuta male, e non inventare per riempire i buchi.",
  "Se una foto non contiene testo leggibile, scrivila come [pagina illeggibile] e passa alla successiva.",
  'Rispondi solo con JSON: {"trascrizione":""}',
].join("\n\n");

// Trascrizione delle foto aggiunte a un argomento esistente (prototipo, foto-piu).
export const PROMPT_TRASCRIZIONE_AGGIUNTA = [
  "Trascrivi fedelmente tutto il testo di queste pagine di quaderno o di libro, grafia a mano inclusa.",
  "Le foto possono essere storte, ruotate, inclinate, sfocate, con ombre o dita sul bordo: raddrizzale mentalmente e leggile lo stesso.",
  "Dove una parola è illeggibile scrivi [?] e vai avanti. Non inventare.",
  'Rispondi solo con JSON: {"trascrizione":""}',
].join("\n\n");

// Quanti concetti chiedere: circa quattro per pagina, fra 4 e 40.
// Il prototipo chiedeva sempre da 4 a 14, che va bene per una pagina e non per un capitolo.
export const CONCETTI_PER_PAGINA = 4, MIN_CONCETTI = 4, MAX_CONCETTI = 40;
export function quantiConcetti(pagine) {
  return Math.min(MAX_CONCETTI, Math.max(MIN_CONCETTI, CONCETTI_PER_PAGINA * (Math.round(Number(pagine)) || 1)));
}

// Aggiunte dopo la prova su foto vere (25 ottobre 2026): un concetto vero ma non
// scritto nel materiale era passato, e il conflitto fra quaderno e libro era stato
// risolto bene solo per caso.
const SOLO_IL_MATERIALE =
  "Titolo e descrizione devono dire solo quello che è scritto nel materiale. Un'informazione vera ma non scritta (un autore, una data, un'attribuzione, un collegamento che conosci tu) non va aggiunta; se un concetto si regge su un'informazione del genere, scartalo.";
const VINCE_IL_LIBRO =
  "Il materiale può mescolare appunti scritti a mano da chi studia e pagine del libro. Quando appunti e libro si contraddicono su un fatto, vale il libro: scrivi il concetto secondo il libro, prendi l'ancora dal libro e in errore_appunti scrivi in poche parole cosa riportano di sbagliato gli appunti (per esempio: «negli appunti: versi decasillabi invece di endecasillabi»). Se non c'è contraddizione, lascia errore_appunti vuoto.";

// Estrazione dei concetti da un argomento nuovo.
export function promptConcetti(materia, titolo, testo, pagine = 1, classe) {
  return [
    "Sei un insegnante di scuola media italiana. Questo è il materiale di studio di " + chiStudia(classe) + ".",
    perLaClasse(classe, materia, titolo + " " + testo),
    "Ricava i concetti distinti che deve sapere: circa " + quantiConcetti(pagine) + ", cioè circa quattro per ogni pagina del materiale, mai meno di " + MIN_CONCETTI + " e mai più di " + MAX_CONCETTI + ". Per ognuno: titolo breve, descrizione in una riga, l'ancora (la frase esatta del materiale da cui il concetto nasce, copiata parola per parola) e un peso da 1 a 3 secondo l'importanza.",
    "Non inventare concetti che nel materiale non ci sono, nemmeno se l'argomento di solito li prevede.",
    SOLO_IL_MATERIALE,
    VINCE_IL_LIBRO,
    materia.trim() ? "Materia dichiarata: " + materia.trim() : "",
    titolo.trim() ? "Argomento dichiarato: " + titolo.trim() : "",
    "Materiale:\n" + testo,
    'Rispondi solo con JSON: {"materia":"","titolo":"","concetti":[{"id":"c1","titolo":"","descrizione":"","ancora":"","peso":2,"errore_appunti":""}]}',
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Concetti nuovi da foto aggiunte a un argomento esistente.
export function promptConcettiNuovi(titoliEsistenti, testo, pagine = 1, opzioni = {}) {
  const { classe, materia } = opzioni;
  return [
    "Sei un insegnante di scuola media italiana. Questo materiale si aggiunge a un argomento già esistente.",
    perLaClasse(classe, materia, testo),
    "Concetti già presenti (non ripeterli):\n" + JSON.stringify(titoliEsistenti),
    "Ricava SOLO i concetti nuovi che compaiono nel materiale qui sotto, da 0 a " + quantiConcetti(pagine) + ". Per ognuno titolo, descrizione in una riga, ancora (frase esatta del materiale) e peso da 1 a 3.",
    SOLO_IL_MATERIALE,
    VINCE_IL_LIBRO,
    "Materiale nuovo:\n" + testo,
    'Rispondi solo con JSON: {"concetti":[{"titolo":"","descrizione":"","ancora":"","peso":2,"errore_appunti":""}]}',
  ].join("\n\n");
}

// Materiale mandato al modello per domande e mappa. Il prototipo si fermava a 16.000
// caratteri, cioè a 4-5 pagine: un capitolo intero (20-30 pagine) ne occupa circa 100.000
// e così viene letto tutto (issue #10). Il filtro di ancoraggio lavora comunque su tutto.
export const MAX_MATERIALE = 120_000;

// Verifica da stampare (ticket #3, 30 ottobre 2026): il numero di domande si sceglie.
// Le miste tengono la proporzione chiuse/aperte del livello, riscalata al numero scelto.
// Senza scelta resta il testo del prototipo.
export const DOMANDE_DA_STAMPARE = [10, 15, 20];
const IN_LETTERE = ["zero", "una", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci",
  "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove", "venti"];

// Miste del prototipo per livello: [chiuse, come sono le chiuse, aperte, come sono le aperte].
const MISTE = {
  semplice: [5, "chiuse a quattro opzioni", 2, "aperte brevissime"],
  medio: [4, "chiuse a quattro opzioni", 4, "aperte brevi"],
  difficile: [2, "chiuse difficili", 4, "aperte lunghe"],
};
// n = numero totale; senza n, i numeri del prototipo (testo identico).
function misteDelLivello(livello, n) {
  const [c, chiuse, a, aperte] = MISTE[livello];
  const quanteChiuse = n ? Math.round((n * c) / (c + a)) : c;
  const quanteAperte = n ? n - quanteChiuse : a;
  return IN_LETTERE[quanteChiuse] + " " + chiuse + " e " + IN_LETTERE[quanteAperte] + " " + aperte;
}

// Domande della prova (prototipo, preparaVerifica). Testo identico al prototipo.
// contesto: [{ id, argomento, materia, titolo, descrizione, ancora, andamento }]
// gia: testi delle ultime domande fatte; materiale: [{ titolo, trascrizione }]
// quante: solo per la verifica da stampare, uno di DOMANDE_DA_STAMPARE.
// Prova lampo su un solo concetto (issue #11): «Mettiti alla prova» dalla mappa.
export const DOMANDE_PER_CONCETTO = 3;
const REGOLE_CONCETTO = {
  miste: "tre domande sullo stesso concetto: due chiuse a quattro opzioni e una aperta breve",
  chiuse: "tre domande sullo stesso concetto, tutte a scelta multipla con quattro opzioni plausibili e una sola corretta",
  aperte: "tre domande aperte brevi sullo stesso concetto, da rispondere con parole proprie",
};

export function promptDomande({ livello, tipo, modalita, ripasso, contesto, gia, materiale, quante, soloConcetto, classe }) {
  const perLivello = { semplice: 7, medio: 8, difficile: 6 }[livello];
  const taglio = {
    semplice: "Resta sul riconoscimento: definizioni, date, termini, fatti espliciti nel materiale.",
    medio: "Chiedi di spiegare con parole proprie e di collegare due concetti fra loro.",
    difficile: "Chiedi cause e conseguenze, confronti e collegamenti che attraversano più concetti.",
  }[livello];
  const scelte = DOMANDE_DA_STAMPARE.includes(quante);
  const misto = misteDelLivello(livello, scelte ? quante : null);
  const regole = soloConcetto
    ? "Prova lampo su un concetto solo: " + REGOLE_CONCETTO[tipo] + ". Ogni domanda guarda il concetto da un lato diverso. " + taglio
    : (scelte ? quante : perLivello) + " domande: " + (
    tipo === "chiuse" ? "tutte a scelta multipla con quattro opzioni plausibili e una sola corretta"
    : tipo === "aperte" ? "tutte aperte, da rispondere con parole proprie"
    : misto) + ". " + taglio;
  const voce = modalita === "orale"
    ? "È la simulazione di un'interrogazione orale: scrivi le domande come la professoressa le direbbe a voce, rivolte direttamente a chi studia (in seconda persona, con forme neutre di genere) e con un tono diretto (Spiegami..., Raccontami..., Come mai..., Che differenza c'è fra...). Una domanda per volta, senza numerazione né riferimenti a pagine o esercizi. Le risposte saranno dette a voce, quindi valuta il contenuto e non la forma scritta."
    : "È la simulazione di una verifica scritta: domande formulate come su un foglio, autonome e precise, che si capiscono senza che nessuno le spieghi a voce.";
  const g = (gia || []).slice(0, 24);
  return [
    "Sei un insegnante di scuola media italiana. Prepari una prova di livello " + livello + " per " + chiStudia(classe) + ".",
    perLaClasse(classe, (materiale[0] || {}).materia, materiale.map((a) => a.titolo + " " + (a.trascrizione || "")).join(" ")),
    voce,
    ripasso ? "È un ripasso di fine quadrimestre: i concetti qui sotto vengono da argomenti diversi e sono quelli su cui chi studia è andat* peggio. Riparti da lì." : "",
    regole,
    "Regola assoluta: ogni domanda deve nascere da un concetto dell'elenco, riportare il suo id in concetto_id e riportare in ancora la frase esatta del materiale che contiene la risposta. Non fare domande su cose che nel materiale non ci sono.",
    "Per le chiuse: quattro opzioni plausibili, una sola corretta. Per le aperte: la risposta attesa e gli elementi che devono comparire.",
    "Concetti:\n" + JSON.stringify(contesto),
    g.length ? ("Queste domande le ha già fatte: non riproporle uguali. Cambia angolazione, taglio e formulazione, pur restando sugli stessi concetti.\n" + JSON.stringify(g)) : "",
    "Materiale trascritto:\n" + materiale.map((a) => "[" + a.titolo + "]\n" + (a.trascrizione || "")).join("\n\n").slice(0, MAX_MATERIALE),
    'Rispondi solo con JSON: {"domande":[{"id":"d1","concetto_id":"c1","tipo":"chiusa","testo":"","opzioni":["","","",""],"corretta":0,"ancora":""},{"id":"d2","concetto_id":"c2","tipo":"aperta","testo":"","risposta_attesa":"","elementi":[""],"ancora":""}]}',
  ].filter(Boolean).join("\n\n");
}

// Correzione delle aperte con la rubrica (prototipo, correggi). Testo identico al prototipo.
// pacchetto: [{ id, domanda, risposta_attesa, elementi, risposta_alunna }]
export function promptCorrezione(modalita, pacchetto, classe, materia = "") {
  return [
    "Correggi le risposte aperte di " + chiStudia(classe) + " con questa rubrica, su ogni risposta:",
    perLaClasse(classe, materia, pacchetto.map((x) => x.domanda).join(" ")) + "\nLa rubrica non cambia con la classe: cambia solo il modo di scrivere il commento.",
    "completezza da 0 a 4 (quanti elementi attesi ci sono), correttezza da 0 a 4 (errori di fatto), linguaggio da 0 a 2 (termini della materia o parafrasi vaghe).",
    "Il totale è la somma, da 0 a 10. Aggiungi un commento di una riga, concreto, rivolto a chi studia (tu, forme neutre di genere), che dica cosa manca. Non penalizzare l'ortografia.",
    modalita === "orale" ? "Le risposte sono state dettate a voce: ignora ripetizioni, esitazioni, frasi lasciate a metà e riprese, e valuta solo il contenuto." : "",
    JSON.stringify(pacchetto),
    'Rispondi solo con JSON: {"valutazioni":[{"id":"d2","completezza":3,"correttezza":4,"linguaggio":1,"totale":8,"commento":""}]}',
  ].filter(Boolean).join("\n\n");
}

// Mappa concettuale (ticket #2, 30 ottobre 2026). Nuovo, non viene dal prototipo:
// da tarare sulla prova vera. I concetti sono già i rami; il modello aggiunge solo
// sotto-punti, ognuno con la sua ancora, e il filtro di ancoraggio scarta quelli che non reggono.
// argomento: { titolo, materia, trascrizione, concetti: [{ titolo, descrizione, ancora, ordine }] }
export function promptMappa(argomento, sottoPunti, classe) {
  const concetti = concettiInOrdine(argomento.concetti).map((c, i) => ({
    id: idBreve(i), titolo: c.titolo, descrizione: c.descrizione || "", ancora: c.ancora,
  }));
  return [
    "Sei un insegnante di scuola media italiana. Prepari la mappa concettuale di un argomento per " + chiStudia(classe) + ", che deve ripassarlo dagli appunti.",
    perLaClasse(classe, argomento.materia, argomento.titolo + " " + (argomento.trascrizione || "")),
    "I rami principali sono già decisi: sono i concetti qui sotto, ognuno con il suo id. Rispondi con un elemento di nodi per ogni concetto. Per ogni concetto aggiungi da 0 a 4 sotto-punti, e sotto ciascun sotto-punto al massimo 3 dettagli. In tutto non più di " + sottoPunti + " fra sotto-punti e dettagli: meglio pochi e chiari che tanti.",
    "Ogni sotto-punto e ogni dettaglio ha un titolo brevissimo (al massimo sei parole) e un'ancora: la frase esatta del materiale da cui nasce, copiata parola per parola. Se non trovi la frase nel materiale, non scrivere il nodo.",
    "Non inventare niente che nel materiale non ci sia. Un'informazione vera ma non scritta (un autore, una data, un collegamento che conosci tu) non va aggiunta.",
    "Non ripetere il titolo del concetto nei suoi sotto-punti.",
    "Argomento: " + argomento.titolo + (argomento.materia ? " (" + argomento.materia + ")" : ""),
    "Concetti:\n" + JSON.stringify(concetti),
    "Materiale trascritto:\n" + String(argomento.trascrizione || "").slice(0, MAX_MATERIALE),
    'Rispondi solo con JSON: {"nodi":[{"concetto_id":"c1","figli":[{"titolo":"","ancora":"","figli":[{"titolo":"","ancora":""}]}]}]}',
  ].join("\n\n");
}

// «In breve» dei concetti (issue #13): chiamata a parte, dopo la mappa, così la mappa arriva subito.
export function promptSintesi(argomento, classe) {
  const concetti = concettiInOrdine(argomento.concetti).map((c, i) => ({ id: idBreve(i), titolo: c.titolo, ancora: c.ancora }));
  return [
    "Sei un insegnante di scuola media italiana. Per ogni concetto qui sotto scrivi «in breve»: una o due frasi corte che lo spiegano a " + chiStudia(classe) + ", con parole semplici.",
    perLaClasse(classe, argomento.materia, argomento.titolo + " " + (argomento.trascrizione || "")),
    "Solo quello che dice il materiale: niente numeri, date, nomi o fatti che nel materiale non ci sono. Usa le parole del materiale per le cose importanti: il server controlla che ci siano e toglie la sintesi se non le trova.",
    "Argomento: " + argomento.titolo + (argomento.materia ? " (" + argomento.materia + ")" : ""),
    "Concetti:\n" + JSON.stringify(concetti),
    "Materiale trascritto:\n" + String(argomento.trascrizione || "").slice(0, MAX_MATERIALE),
    'Rispondi solo con JSON: {"sintesi":[{"concetto_id":"c1","testo":""}]}',
  ].join("\n\n");
}

// ------------------------------------------------------------------ web come aiuto (issue #4)
// Nuovi, non dal prototipo: da tarare sulla prova vera. Due passi per ogni azione:
// prima una ricerca con lo strumento web_search (testo libero con citazioni),
// poi la composizione in JSON, dove il modello sceglie le fonti per numero.
// Il web non diventa mai una domanda di verifica.
const NIENTE_VERIFICA = "Non scrivere domande di verifica: questo serve solo a capire meglio, non a interrogare.";
const elencoFonti = (fonti) => fonti.length
  ? fonti.map((f, i) => (i + 1) + ". " + f.titolo + " — " + f.url).join("\n")
  : "(nessuna fonte trovata)";
function testoErrore(errore) {
  if (!errore) return "";
  return "Nella verifica, alla domanda «" + errore.domanda + "» ha risposto «" + (errore.risposta_alunna || "non lo so") +
    "»; la risposta attesa era «" + errore.risposta_attesa + "».";
}
const descriviConcetto = ({ materia, argomento, concetto }) =>
  "Materia: " + materia + ". Argomento: " + argomento + ".\nConcetto: " + concetto.titolo +
  (concetto.descrizione ? " — " + concetto.descrizione : "") + "\nNegli appunti c'è scritto: «" + concetto.ancora + "»";

// { materia, argomento, classe, concetto: { titolo, descrizione, ancora }, errore? }
export function promptRicercaSpiegazione(dati) {
  return [
    "Sei un insegnante di scuola media italiana. Chi studia (" + perClasse(dati.classe) + ") non ha capito bene un concetto.",
    perLaClasse(dati.classe, dati.materia, dati.argomento + " " + dati.concetto.titolo + " " + dati.concetto.ancora),
    descriviConcetto(dati),
    testoErrore(dati.errore),
    "Cerca sul web (al massimo tre ricerche) informazioni affidabili che aiutino a spiegarlo meglio: un esempio concreto e un modo semplice per dirlo. Riassumi in poche righe in italiano quello che hai trovato, citando le fonti.",
    NIENTE_VERIFICA,
  ].filter(Boolean).join("\n\n");
}

// { ...come sopra, ricerca: testo della ricerca, fonti: [{ titolo, url }] }
export function promptSpiegazione(dati) {
  return [
    "Sei un insegnante di scuola media italiana. Scrivi per " + chiStudia(dati.classe) + ", con parole adatte all'età, in seconda persona e con forme neutre di genere.",
    perLaClasse(dati.classe, dati.materia, dati.argomento + " " + dati.concetto.titolo + " " + dati.concetto.ancora),
    descriviConcetto(dati),
    testoErrore(dati.errore),
    "Parti da quello che c'è negli appunti, poi allarga con quello che è stato trovato sul web. Non sostituire la prof: se il web dice qualcosa di diverso dagli appunti, dillo con delicatezza e consiglia di chiedere alla prof.",
    dati.errore ? "Parti dall'errore: spiega perché la risposta non andava, senza giudicare." : "",
    "spiegazione: da 6 a 10 righe, frasi semplici, niente elenchi tecnici. esempio: un esempio concreto, 2 o 3 righe. analogia: un paragone con qualcosa della vita di tutti i giorni, 1 o 2 righe. fonti: i numeri delle fonti che hai usato, dall'elenco qui sotto; se non ne hai usata nessuna, lista vuota.",
    NIENTE_VERIFICA,
    "Quello che è stato trovato sul web:\n" + (dati.ricerca || "(niente)"),
    "Fonti:\n" + elencoFonti(dati.fonti),
  ].filter(Boolean).join("\n\n");
}

// { materia, argomento, classe, agganci: [{ breve, titolo }] }
export function promptRicercaArricchisci(dati) {
  return [
    "Sei un insegnante di scuola media italiana. Chi studia (" + perClasse(dati.classe) + ") ripassa con una mappa concettuale fatta dai suoi appunti.",
    perLaClasse(dati.classe, dati.materia, dati.argomento + " " + dati.agganci.map((a) => a.titolo).join(" ")),
    "Materia: " + dati.materia + ". Argomento: " + dati.argomento + ".\nNodi della mappa:\n" + dati.agganci.map((a) => a.breve + ": " + a.titolo).join("\n"),
    "Cerca sul web (al massimo tre ricerche) esempi, curiosità e collegamenti che aiutano a ricordare questi nodi e che negli appunti non ci sono. Riassumi in poche righe in italiano quello che hai trovato, citando le fonti.",
    NIENTE_VERIFICA,
  ].join("\n\n");
}

// { ...come sopra, ricerca, fonti }
export function promptArricchisci(dati) {
  return [
    "Sei un insegnante di scuola media italiana. Aggiungi alla mappa concettuale di " + chiStudia(dati.classe) + " fino a 6 nodi presi dal web.",
    perLaClasse(dati.classe, dati.materia, dati.argomento + " " + dati.agganci.map((a) => a.titolo).join(" ")),
    "Materia: " + dati.materia + ". Argomento: " + dati.argomento + ".\nNodi della mappa:\n" + dati.agganci.map((a) => a.breve + ": " + a.titolo).join("\n"),
    "Per ogni nodo nuovo: aggancio = l'id (n1, n2...) del nodo della mappa a cui si collega meglio; titolo brevissimo, al massimo sei parole; testo di 2 o 3 frasi brevi e semplici, una cosa per frase, con il soggetto sempre scritto (" + chiStudia(dati.classe) + " deve capirle alla prima lettura); fonte = il numero della fonte da cui viene. Solo cose che stanno nelle fonti.",
    "Ogni nodo deve aggiungere qualcosa che nei nodi della mappa non c'è: un esempio, un perché, una curiosità, un collegamento. Se un nodo direbbe con altre parole quello che un nodo della mappa dice già, non scriverlo: meglio meno nodi.",
    NIENTE_VERIFICA,
    "Quello che è stato trovato sul web:\n" + (dati.ricerca || "(niente)"),
    "Fonti:\n" + elencoFonti(dati.fonti),
  ].join("\n\n");
}

// ---------------------------------------------------------------- esercizi di matematica (issue #5)

// Trascrizione di pagine di esercizi (30 ottobre 2026): numeri e simboli contano più delle parole.
export const PROMPT_TRASCRIZIONE_ESERCIZI = [
  "Trascrivi fedelmente queste pagine di esercizi di matematica (libro o quaderno), grafia a mano inclusa.",
  "Le foto possono essere storte, ruotate, inclinate, sfocate, con ombre o dita sul bordo: raddrizzale mentalmente e leggile lo stesso.",
  "Copia ogni esercizio con il suo numero, esattamente come è scritto: numeri, virgole, segni, parentesi tonde, quadre e graffe, frazioni come a/b, potenze come a^n, radici come √(...), unità di misura. Non risolvere niente e non correggere niente.",
  "Se c'è una figura, descrivila in una riga fra parentesi quadre con le misure scritte sopra (per esempio: [figura: triangolo rettangolo, cateti 6 cm e 8 cm]).",
  "Dove un segno è davvero illeggibile scrivi [?] e vai avanti. Non inventare.",
  'Rispondi solo con JSON: {"trascrizione":""}',
].join("\n\n");

// Tipi di esercizio presenti nelle foto. esistenti: titoli già salvati sull'argomento.
export function promptEserciziTipi(materia, titolo, testo, esistenti = [], classe = null) {
  return [
    "Sei un insegnante di matematica di scuola media italiana. Queste sono pagine di esercizi del libro o del quaderno di " + chiStudia(classe) + ".",
    perLaClasse(classe, materia || "matematica", titolo + " " + testo),
    "Riconosci i tipi di esercizio presenti, per esempio: espressioni con le frazioni, potenze, proporzioni, percentuali, equazioni di primo grado, perimetro e area di poligoni, teorema di Pitagora, circonferenza e cerchio, volumi. Un tipo è una famiglia di esercizi che si risolvono nello stesso modo.",
    "Per ogni tipo: titolo breve; ancora = il testo di UN esercizio vero di queste pagine, copiato carattere per carattere (numeri e simboli compresi, senza il numero dell'esercizio); difficolta da 1 a 3 per " + chiStudia(classe) + "; figura = true se per risolverlo serve una figura geometrica.",
    "Solo tipi che nelle pagine ci sono davvero, con un esercizio da copiare. Anche i problemi a parole (per esempio con le frazioni di una somma di denaro) sono un tipo: l'ancora è il testo del problema. Niente geometria analitica.",
    esistenti.length ? "Tipi già salvati (non ripeterli):\n" + JSON.stringify(esistenti) : "",
    materia.trim() ? "Materia dichiarata: " + materia.trim() : "",
    titolo.trim() ? "Argomento dichiarato: " + titolo.trim() : "",
    "Pagine:\n" + testo,
    'Rispondi solo con JSON: {"tipi":[{"titolo":"","ancora":"","difficolta":2,"figura":false}]}',
  ].filter(Boolean).join("\n\n");
}

// Esercizi simili ai tipi confermati (issue #5, fetta #7).
// { materia, titolo, classe, quanti, tipi: [{ breve, titolo, ancora, difficolta, figura }] }
// Le forme e i nomi delle misure sono quelli che il client sa disegnare (generati.js).
export function promptEserciziGenera(dati) {
  const forme = Object.entries(FORME).map(([f, misure]) => "- " + f + ": " + misure.join(", ")).join("\n");
  return [
    "Sei un insegnante di matematica di scuola media italiana. Prepara " + dati.quanti + " esercizi per " + chiStudia(dati.classe) + ", simili a quelli del libro.",
    perLaClasse(dati.classe, dati.materia || "matematica", dati.tipi.map((t) => t.titolo + " " + t.ancora).join(" ") + " " + (dati.mirati ? dati.mirati.concetto + " " + dati.mirati.testo : "")) +
      "\nDifficoltà adatta all'anno: dentro gli argomenti di questa classe e dei suoi prerequisiti, mai argomenti degli anni dopo.",
    "Tipi di esercizio confermati, ognuno con un esercizio vero del libro come modello:\n" +
      JSON.stringify(dati.tipi.map((t) => ({ id: t.breve, titolo: t.titolo, esempio: t.ancora, difficolta: t.difficolta, figura: t.figura }))),
    dati.mirati ? "Sono esercizi mirati su «" + dati.mirati.concetto + "», che in un compito ha messo in difficoltà. Mettili in ordine dal più facile al più difficile: il primo quasi uguale a questo passo del compito, «" + dati.mirati.calcolo + "»; il secondo un po' più difficile; dal terzo in poi PROBLEMI A PAROLE (una piccola storia con i dati scritti nel testo, che chiede di usare «" + dati.mirati.concetto + "»), simili a questo compito: «" + dati.mirati.testo + "». Numeri e storie diversi da quelli del compito." : "",
    "Distribuisci gli esercizi fra i tipi in modo più uniforme possibile. Ogni esercizio deve somigliare al suo modello (stessa struttura, stessa difficoltà) ma con numeri diversi. Numeri adatti all'età: risultati interi, frazioni semplici o decimali con al massimo due cifre.",
    "Una sola domanda per esercizio, con un solo risultato finale. Niente geometria analitica. I problemi a parole sono ammessi se il modello lo è: tutti i numeri che servono stanno scritti nel testo.",
    "Per ogni esercizio:\n" +
      "- tipo: l'id del tipo (t1, t2...);\n" +
      "- testo: la consegna, come sul libro;\n" +
      "- dati: i dati in breve (per esempio «base 12 cm; altezza 5 cm»), vuoto per le espressioni;\n" +
      "- figura: se serve una figura geometrica, forma e misure da etichettare; altrimenti forma \"nessuna\" e misure vuote. Per la misura da trovare scrivi \"?\" come valore. Forme e nomi delle misure ammessi:\n" + forme + "\n" +
      "- passaggi: lo svolgimento passo per passo, ognuno con una frase breve e la formula in LaTeX (per esempio \\frac{3}{4}, 5^{2}, \\sqrt{36}, \\cdot);\n" +
      "- grandezza: che cosa è il risultato rispetto alla figura disegnata: area, perimetro (per il cerchio la circonferenza), volume, misura (la misura segnata con \"?\" nella figura) oppure altro (espressioni, problemi in cui il risultato non è una di queste). Il server ricalcola area, perimetro, volume e misura mancante dalle misure della figura con la formula giusta e scarta l'esercizio se non coincide: la figura deve avere tutte le misure che servono;\n" +
      "- risultato: valore (solo il numero, con la virgola, oppure una frazione come 7/12; niente unità dentro il valore) e unità di misura (vuota se non c'è);\n" +
      "- verifica: un'espressione che ricalcola il risultato partendo dai numeri dei dati, scritta con solo numeri (decimali col punto), + - * / ^, sqrt() e parentesi tonde. Niente lettere, niente %, niente π (usa 3.14 sia nella verifica sia nel risultato), niente risultati intermedi: niente eval, il server la ricalcola e scarta l'esercizio se non coincide con il risultato.",
    "Controlla tu stesso ogni conto prima di rispondere.",
    dati.materia ? "Materia: " + dati.materia : "",
    dati.titolo ? "Argomento: " + dati.titolo : "",
    'Rispondi solo con JSON: {"esercizi":[{"tipo":"t1","testo":"","dati":"","figura":{"forma":"nessuna","misure":[]},"passaggi":[{"testo":"","formula":""}],"grandezza":"altro","risultato":{"valore":"","unita":""},"verifica":""}]}',
  ].filter(Boolean).join("\n\n");
}

// Correzione dei passaggi degli esercizi (issue #5, fetta #8). Il giudizio sul risultato
// arriva già fatto (da un calcolo, _shared/correzione.js): il modello spiega soltanto.
// { classe, pacchetto: [{ id, testo, soluzione: [passi], risultato, risposta, esito, passaggi }] }
export function promptCorrezioneEsercizi(dati) {
  return [
    "Sei un insegnante di matematica di scuola media italiana e correggi gli esercizi di " + chiStudia(dati.classe) + ".",
    perLaClasse(dati.classe, "matematica", dati.pacchetto.map((x) => x.testo).join(" ")),
    "Per ogni esercizio hai la consegna, lo svolgimento corretto, il risultato corretto, la risposta data, i passaggi scritti e l'esito del risultato. L'esito l'ha stabilito un calcolo: non lo decidi tu e non cambiarlo.",
    "Leggi i passaggi scritti e trova il primo passaggio sbagliato: in primo_errore copialo carattere per carattere da quello che è stato scritto (copiato, non riscritto). In tipo_errore scrivi che cosa è successo: calcolo, formula, segno, unita (unità di misura), procedimento (ha sbagliato strada), altro; nessuno se i passaggi sono giusti, e allora primo_errore resta vuoto.",
    "In spiegazione spiega l'errore in 2-4 frasi semplici, con parole adatte a " + chiStudia(dati.classe) + ", parlando in seconda persona (tu) con forme neutre di genere e senza giudicare. In esempio mostra un esempio svolto simile, con numeri diversi, passo per passo. Se i passaggi sono giusti e l'esito è giusto, una frase di conferma e niente esempio.",
    "Errori tipici del programma (id: nome — come riconoscerlo). In errore_tipico scrivi l'id di quello che corrisponde al primo errore, se corrisponde davvero; altrimenti lascia vuoto. Se c'è, la spiegazione lo chiama per nome («è l'errore più comune con…») e dice perché non funziona:\n" +
      erroriCandidati({ classe: dati.classe, materia: "matematica", testo: dati.pacchetto.map((x) => x.testo + " " + (x.passaggi || "")).join(" ") }).map((e) => e.id + ": " + e.errore + " — " + e.come_riconoscerlo).join("\n"),
    "Esercizi:\n" + JSON.stringify(dati.pacchetto),
    'Rispondi solo con JSON: {"analisi":[{"id":"","primo_errore":"","tipo_errore":"calcolo","errore_tipico":"","spiegazione":"","esempio":""}]}',
  ].join("\n\n");
}

// ---------------------------------------------------------------- aiutami con un compito (issue #27)
// Nuovi: da tarare sulla prova vera (esercizio di Paolo, uno di geometria, uno di storia).
const VOCE_TUTOR = "Parli a chi ha fra i 10 e i 14 anni: frasi corte, verbi semplici, seconda persona (tu), forme neutre di genere (mai «sei sicura», «sei pronta», «bravo/brava»: gira la frase). Mai «sbagliato»: si dice «non ancora» o si spiega cosa cambiare. Esempi concreti (la torta in fette, i soldi, la pizza) che riusano i numeri dell'esercizio.";
const REGOLE_CALCOLO = "Ogni campo calcolo è una catena di uguali con soli numeri, per esempio «1/6 + 2/9 = 3/18 + 4/18 = 7/18» oppure «770 : 11 = 70»: numeri (decimali con la virgola, niente punti delle migliaia), + − × : / ^ √, parentesi, «=», al massimo il simbolo € o un'unità di misura dopo un numero, sempre la stessa in tutta la catena. Niente lettere (per moltiplicare usa ×, non x), niente incognite, niente «≈», niente % (scrivi 20/100 × 300), niente π (usa 3,14). Le equivalenze di misura si scrivono come conti: «1,5 × 100 = 150», non «1,5 m = 150 cm». Ogni uguale deve essere vero: il server ricalcola tutto e scarta la soluzione se un conto non torna.";

// { classe, immagini?: (allegate a parte), testo?, esercizio?, appunti? }
export function promptCompito(dati) {
  return [
    "Sei un tutor di scuola media italiana e aiuti " + chiStudia(dati.classe) + " a capire come si fa un esercizio dei compiti, senza farlo al posto suo all'inizio. " + VOCE_TUTOR,
    perLaClasse(dati.classe, dati.materia || "", dati.testo || dati.esercizio || "") + "\nSe l'esercizio corrisponde a un argomento del programma, la strategia ha il nome di una delle strategie del programma.",
    dati.testo ? "Il testo dell'esercizio, già letto e controllato:\n" + dati.testo
      : "L'esercizio è nella foto (pagina di libro o quaderno, anche storta o sfocata: raddrizzala mentalmente).",
    dati.esercizio ? "Nella pagina ci sono più esercizi: aiuta solo con quello che comincia così: «" + dati.esercizio + "». Lascia vuoto l'elenco esercizi."
      : "Se nella pagina ci sono più esercizi distinti, compila SOLO esercizi (id = il numero dell'esercizio o la lettera, inizio = le prime parole) e lascia vuoti gli altri campi: la scelta la fa chi studia. Se c'è un esercizio solo, esercizi resta vuoto.",
    "Campi:\n" +
      "- materia (per esempio matematica, geometria, italiano, storia, scienze) e matematica = true se servono conti (aritmetica, frazioni, geometria con misure, problemi);\n" +
      "- testo: il testo dell'esercizio trascritto fedelmente, numeri e simboli compresi (frazioni come 1/6), senza la soluzione del libro;\n" +
      "- dati: i dati importanti; per ognuno valore = copiato esattamente come è nel testo (per esempio «1/6», «2/9», «465 €», «305 €», così si può evidenziare) e significato = che cosa rappresenta, in poche parole (per esempio «la parte dello stipendio spesa per gli anelli», «l'anticipo al ristorante», «i soldi che gli restano»);\n" +
      "- cerca: cosa chiede l'esercizio, in poche parole (per esempio «lo stipendio di Paolo»);\n" +
      "- soluzione_libro: se nel testo c'è la soluzione del libro (di solito fra parentesi quadre, per esempio [1260 €]), copiala; altrimenti vuoto;\n" +
      "- indizi: da 3 a 5 indizi a gradini, dal più leggero al più forte; nessuno dice il risultato finale; ognuno è una domanda o un suggerimento che fa fare il passo successivo (per esempio «Somma le frazioni spese: che frazione dello stipendio è andata in anelli e vestito?»);\n" +
      "- strategia: PRIMA dei passi, la strategia con un nome che si ricorda (per esempio «andare a ritroso», «dalla parte all'intero», «stesso denominatore con il mcm», «trova cosa resta») e in perche una frase che dice perché funziona per questo problema (per esempio «Conosciamo la fine, i 20 panini: si parte da lì e si torna indietro»);\n" +
      "- passi: la soluzione passo per passo; ogni passo ha un titolo breve in parole semplici (per esempio «Frazioni spese», «Frazione che resta», «Cosa sono i due importi in euro», «Collego frazione ed euro», «Trovo 1/18», «Trovo l'intero», oppure «Punto di partenza», «Torno indietro nella seconda ora»), una spiegazione di 1-3 frasi che dice il PERCHÉ di quel passo e non solo il conto (per esempio «Questi 24 sono ciò che restava dopo aver tolto 1/4, quindi sono i 3/4») con un'immagine concreta quando aiuta (la torta in fette, il mucchio di panini, i soldi), se c'è un conto il calcolo, e concetto = l'abilità che serve in quel passo, in parole semplici (per esempio «Lo stesso denominatore», «Trovare cosa resta», «Trovare l'intero se conosci una parte», «Andare a ritroso»); ancora resta vuota (si usa solo con gli appunti);\n" +
      "- risultato: valore (solo il numero o la frazione, con la virgola per i decimali) e unità (per esempio €, cm², vuota se non c'è); per le materie senza conti valore è la risposta in breve e unità vuota;\n" +
      "- verifica: sempre. In spiegazione una frase; in controlli uno o più controlli, ognuno con un testo breve (verrà mostrato con una ✓) e il suo calcolo. Si può verificare in due modi: rimettendo insieme le parti fino al risultato (per esempio «Anelli, vestito, ristorante e avanzo fanno lo stipendio» con «210 + 280 + 465 + 305 = 1260») oppure andando avanti dal risultato con i dati del testo, un controllo per ogni fase, fino a un dato del testo (per esempio «Prima ora: vende 12 + 4 = 16, restano 32» con «48 - (48 : 4 + 4) = 32», poi «Seconda ora: restano 20» con «32 - (32 : 4 + 4) = 20»). I controlli usano i numeri del testo;\n" +
      "- trucco: il trucco da ricordare, una frase sola (per esempio: quando torni indietro fai le operazioni al contrario e in ordine inverso);\n" +
      "- prova_tu: una mini-domanda di controllo con gli stessi numeri o quasi (per esempio «Se 11 fette valgono 770 €, quanto vale 1 fetta?»), con il suo risultato (valore e unità) che risponde esattamente alla domanda (se chiede quante fette, il risultato è il numero di fette, non una frazione), il calcolo che ci arriva, passo = il numero del passo della soluzione a cui si collega, spiegazione = come si fa, in 1-2 frasi (si mostra se la risposta non è ancora giusta). Per le materie senza conti lascia tutto vuoto;\n" +
      "- domande_pronte: 3 domande che chi studia potrebbe farti su questo esercizio, brevi, in prima persona (per esempio «Come trovo lo stesso denominatore?», «Perché sommo 465 e 305?», «Me lo spieghi con un disegno?»).",
    "Matematica: " + REGOLE_CALCOLO + " L'ultimo passo con un calcolo finisce con il risultato. Controlla tu stesso ogni conto prima di rispondere.",
    "Materie senza conti (storia, scienze, italiano...): stessa struttura, calcolo sempre vuoto, la risposta spiegata nei passi.",
    dati.appunti ? "Appunti di chi studia su questa materia: usali come fonte principale. In ogni passo che si appoggia agli appunti, metti in ancora una frase copiata parola per parola dagli appunti (non riscritta): verrà evidenziata come frase del quaderno.\n" + dati.appunti : "",
    'Rispondi solo con JSON: {"esercizi":[],"materia":"","matematica":true,"testo":"","dati":[{"valore":"","significato":""}],"cerca":"","soluzione_libro":"","strategia":{"nome":"","perche":""},"indizi":[""],"passi":[{"titolo":"","spiegazione":"","calcolo":"","ancora":"","concetto":""}],"risultato":{"valore":"","unita":""},"verifica":{"spiegazione":"","controlli":[{"testo":"","calcolo":""}]},"trucco":"","domande_pronte":["","",""],"prova_tu":{"testo":"","risultato":{"valore":"","unita":""},"calcolo":"","passo":0,"spiegazione":""}}',
  ].filter(Boolean).join("\n\n");
}

// { classe, compito (il JSON della scheda), cronologia: [{ chi, testo }], domanda }
export function promptCompitoDomanda(dati) {
  const c = dati.compito || {};
  return [
    "Sei un tutor di scuola media italiana. Hai appena spiegato un esercizio a " + chiStudia(dati.classe) + " e ora rispondi a una sua domanda. " + VOCE_TUTOR,
    perLaClasse(dati.classe, c.materia || "matematica", c.testo),
    "Rispondi in breve (al massimo 5 frasi), resta su questo esercizio e riusa i suoi numeri. Se la domanda è su un passo («il punto 5»), parti da quel passo. Se la domanda non c'entra con l'esercizio, dillo con gentilezza e riporta il discorso sul compito.",
    "L'esercizio e la spiegazione già data:\n" + JSON.stringify({
      testo: c.testo, cerca: c.cerca, passi: (c.passi || []).map((p, i) => ({ numero: i + 1, titolo: p.titolo, spiegazione: p.spiegazione, calcolo: p.calcolo })),
      strategia: c.strategia, risultato: c.risultato, verifica: c.verifica, trucco: c.trucco,
    }),
    (dati.cronologia || []).length ? "Messaggi di prima (io = chi studia, app = tu):\n" + dati.cronologia.map((m) => m.chi + ": " + m.testo).join("\n") : "",
    dati.bloccata ? "La soluzione completa non è ancora sbloccata: chi studia non ha ancora provato a rispondere. Non scrivere il risultato finale (" + ((c.risultato || {}).valore || "") + ") in nessun campo, né un conto che ci arriva: aiuta con un indizio sul passo che serve." : "",
    "Domanda: " + dati.domanda,
    "In passo scrivi il numero del passo della soluzione su cui è la domanda (0 se non riguarda un passo preciso).",
    "Campi: risposta (il testo, con un esempio concreto); calcoli: i conti che mostri, ognuno come catena di uguali (" + REGOLE_CALCOLO + "), vuoto se non servono; figura: se aiuta un disegno delle frazioni, tipo «barra_frazioni» con parti (quante fette in tutto, al massimo 24), colorate (quante evidenziare) ed etichetta (per esempio «11/18»), altrimenti tipo «nessuna» con parti e colorate a 0; prova_tu: una mini-domanda di controllo con gli stessi numeri (per esempio «Se 11 fette valgono 770 €, quanto vale 1 fetta?»), con risultato (valore e unità) che risponde esattamente alla domanda (se chiede quante fette, il risultato è il numero di fette, non una frazione), il calcolo che ci arriva, passo = il numero del passo della soluzione a cui si collega, spiegazione = come si fa in 1-2 frasi; tutto vuoto se non serve.",
    'Rispondi solo con JSON: {"risposta":"","calcoli":[""],"figura":{"tipo":"nessuna","parti":0,"colorate":0,"etichetta":""},"prova_tu":{"testo":"","risultato":{"valore":"","unita":""},"calcolo":"","passo":0,"spiegazione":""},"passo":0}',
  ].filter(Boolean).join("\n\n");
}

// Problemi gemelli (aggiunta 2 di Roby): stessa strategia e stessi passi, contesto e numeri diversi.
// { classe, compito, tipi: ["vicino", "lontano", "variante"] }
export function promptGemelli(dati) {
  const c = dati.compito || {};
  const passi = (c.passi || []).filter((p) => p.calcolo).map((p, i) => (i + 1) + ". " + p.titolo + ": " + p.calcolo).join("\n");
  const cosa = { vicino: "gemello vicino: stessa struttura e un contesto simile (per esempio lo stipendio diventa la paghetta)",
    lontano: "gemello lontano: stessa struttura e un contesto diverso (una pizza in fette, i km di una gita, le pagine di un libro, i litri di una piscina)",
    variante: "gemello con una variante: un passo in più o un dato da ricavare, per controllare che la strategia sia capita e non copiata" };
  return [
    "Sei un tutor di scuola media italiana. Prepara problemi gemelli di un compito appena risolto da " + chiStudia(dati.classe) + ": stessa strategia e stessa sequenza di passi, ma storia e numeri diversi, così la strategia si fissa. " + VOCE_TUTOR,
    perLaClasse(dati.classe, c.materia || "matematica", c.testo),
    "Il compito:\n" + c.testo + (c.strategia && c.strategia.nome ? "\nStrategia: " + c.strategia.nome : "") + "\nPassi con i conti:\n" + passi,
    "Scrivi un gemello per ognuno di questi tipi, in quest'ordine:\n" + dati.tipi.map((t) => "- " + t + ": " + cosa[t]).join("\n"),
    "Regole: gli stessi titoli dei passi del compito (con i numeri nuovi) e lo stesso numero di passi con un conto (il gemello con la variante ne può avere uno in più o in meno); tutti i risultati intermedi interi (o frazioni semplici dove il compito usa le frazioni, o euro con i centesimi): mai numeri come 7,333; scegli i numeri partendo dal risultato e tornando indietro, così ogni divisione torna esatta. Contesti adatti a 10-14 anni e vari (non sempre soldi), con nomi propri di fantasia diversi fra loro e non tutti dello stesso genere. Il testo del problema non contiene la soluzione.",
    REGOLE_CALCOLO + " L'ultimo conto arriva al risultato. Controlla tu stesso ogni conto.",
    "Per ogni gemello anche la verifica, come nel compito: controlli con un testo breve e un calcolo, rimettendo insieme le parti fino al risultato oppure andando avanti dal risultato fino a un dato del testo; i controlli usano i numeri del testo del gemello.",
    'Rispondi solo con JSON: {"gemelli":[{"tipo":"vicino","testo":"","passi":[{"titolo":"","spiegazione":"","calcolo":""}],"risultato":{"valore":"","unita":""},"verifica":{"spiegazione":"","controlli":[{"testo":"","calcolo":""}]}}]}',
  ].join("\n\n");
}
