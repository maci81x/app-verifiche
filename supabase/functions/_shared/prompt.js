import { concettiInOrdine, idBreve } from "./mappa.js";
import { etaDaClasse } from "./web.js";

// Prompt al modello. La base è copiata parola per parola da prototipo/prova-verifiche.html,
// dove è stata tarata sul campo; le modifiche successive sono segnate con la loro data.
// Non riscriverli senza rifare la taratura.

// Trascrizione al primo caricamento (prototipo, leggiMateriale).
export const PROMPT_TRASCRIZIONE = [
  "Trascrivi fedelmente tutto il testo di queste pagine di quaderno o di libro, grafia a mano inclusa.",
  "Le foto sono scattate al volo da una ragazza: possono essere storte, ruotate anche di 90 o 180 gradi, inclinate, sfocate, con ombre, riflessi, dita sul bordo, pagine curve o due pagine nello stesso scatto. Raddrizzale mentalmente e leggile lo stesso, pagina per pagina.",
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
  "Il materiale può mescolare appunti scritti a mano dall'alunna e pagine del libro. Quando appunti e libro si contraddicono su un fatto, vale il libro: scrivi il concetto secondo il libro, prendi l'ancora dal libro e in errore_appunti scrivi in poche parole cosa riportano di sbagliato gli appunti (per esempio: «negli appunti: versi decasillabi invece di endecasillabi»). Se non c'è contraddizione, lascia errore_appunti vuoto.";

// Estrazione dei concetti da un argomento nuovo.
export function promptConcetti(materia, titolo, testo, pagine = 1) {
  return [
    "Sei un insegnante di scuola media italiana. Questo è il materiale di studio di un'alunna.",
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
export function promptConcettiNuovi(titoliEsistenti, testo, pagine = 1) {
  return [
    "Sei un insegnante di scuola media italiana. Questo materiale si aggiunge a un argomento già esistente.",
    "Concetti già presenti (non ripeterli):\n" + JSON.stringify(titoliEsistenti),
    "Ricava SOLO i concetti nuovi che compaiono nel materiale qui sotto, da 0 a " + quantiConcetti(pagine) + ". Per ognuno titolo, descrizione in una riga, ancora (frase esatta del materiale) e peso da 1 a 3.",
    SOLO_IL_MATERIALE,
    VINCE_IL_LIBRO,
    "Materiale nuovo:\n" + testo,
    'Rispondi solo con JSON: {"concetti":[{"titolo":"","descrizione":"","ancora":"","peso":2,"errore_appunti":""}]}',
  ].join("\n\n");
}

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
export function promptDomande({ livello, tipo, modalita, ripasso, contesto, gia, materiale, quante }) {
  const perLivello = { semplice: 7, medio: 8, difficile: 6 }[livello];
  const taglio = {
    semplice: "Resta sul riconoscimento: definizioni, date, termini, fatti espliciti nel materiale.",
    medio: "Chiedi di spiegare con parole proprie e di collegare due concetti fra loro.",
    difficile: "Chiedi cause e conseguenze, confronti e collegamenti che attraversano più concetti.",
  }[livello];
  const scelte = DOMANDE_DA_STAMPARE.includes(quante);
  const misto = misteDelLivello(livello, scelte ? quante : null);
  const regole = (scelte ? quante : perLivello) + " domande: " + (
    tipo === "chiuse" ? "tutte a scelta multipla con quattro opzioni plausibili e una sola corretta"
    : tipo === "aperte" ? "tutte aperte, da rispondere con parole proprie"
    : misto) + ". " + taglio;
  const voce = modalita === "orale"
    ? "È la simulazione di un'interrogazione orale: scrivi le domande come la professoressa le direbbe a voce, rivolte direttamente all'alunna e con un tono diretto (Spiegami..., Raccontami..., Come mai..., Che differenza c'è fra...). Una domanda per volta, senza numerazione né riferimenti a pagine o esercizi. Le risposte saranno dette a voce, quindi valuta il contenuto e non la forma scritta."
    : "È la simulazione di una verifica scritta: domande formulate come su un foglio, autonome e precise, che si capiscono senza che nessuno le spieghi a voce.";
  const g = (gia || []).slice(0, 24);
  return [
    "Sei un insegnante di scuola media italiana. Prepari una prova di livello " + livello + ".",
    voce,
    ripasso ? "È un ripasso di fine quadrimestre: i concetti qui sotto vengono da argomenti diversi e sono quelli su cui l'alunna è andata peggio. Riparti da lì." : "",
    regole,
    "Regola assoluta: ogni domanda deve nascere da un concetto dell'elenco, riportare il suo id in concetto_id e riportare in ancora la frase esatta del materiale che contiene la risposta. Non fare domande su cose che nel materiale non ci sono.",
    "Per le chiuse: quattro opzioni plausibili, una sola corretta. Per le aperte: la risposta attesa e gli elementi che devono comparire.",
    "Concetti:\n" + JSON.stringify(contesto),
    g.length ? ("Queste domande le ha già fatte: non riproporle uguali. Cambia angolazione, taglio e formulazione, pur restando sugli stessi concetti.\n" + JSON.stringify(g)) : "",
    // ponytail: 16000 caratteri come nel prototipo; con un capitolo intero taglia il materiale. Da alzare se le domande coprono solo l'inizio.
    "Materiale trascritto:\n" + materiale.map((a) => "[" + a.titolo + "]\n" + (a.trascrizione || "")).join("\n\n").slice(0, 16000),
    'Rispondi solo con JSON: {"domande":[{"id":"d1","concetto_id":"c1","tipo":"chiusa","testo":"","opzioni":["","","",""],"corretta":0,"ancora":""},{"id":"d2","concetto_id":"c2","tipo":"aperta","testo":"","risposta_attesa":"","elementi":[""],"ancora":""}]}',
  ].filter(Boolean).join("\n\n");
}

// Correzione delle aperte con la rubrica (prototipo, correggi). Testo identico al prototipo.
// pacchetto: [{ id, domanda, risposta_attesa, elementi, risposta_alunna }]
export function promptCorrezione(modalita, pacchetto) {
  return [
    "Correggi le risposte aperte di un'alunna di scuola media con questa rubrica, su ogni risposta:",
    "completezza da 0 a 4 (quanti elementi attesi ci sono), correttezza da 0 a 4 (errori di fatto), linguaggio da 0 a 2 (termini della materia o parafrasi vaghe).",
    "Il totale è la somma, da 0 a 10. Aggiungi un commento di una riga, concreto, rivolto all'alunna, che dica cosa manca. Non penalizzare l'ortografia.",
    modalita === "orale" ? "Le risposte sono state dettate a voce: ignora ripetizioni, esitazioni, frasi lasciate a metà e riprese, e valuta solo il contenuto." : "",
    JSON.stringify(pacchetto),
    'Rispondi solo con JSON: {"valutazioni":[{"id":"d2","completezza":3,"correttezza":4,"linguaggio":1,"totale":8,"commento":""}]}',
  ].filter(Boolean).join("\n\n");
}

// Mappa concettuale (ticket #2, 30 ottobre 2026). Nuovo, non viene dal prototipo:
// da tarare sulla prova vera. I concetti sono già i rami; il modello aggiunge solo
// sotto-punti, ognuno con la sua ancora, e il filtro al 60% scarta quelli che non reggono.
// argomento: { titolo, materia, trascrizione, concetti: [{ titolo, descrizione, ancora, ordine }] }
export const MAX_MATERIALE_MAPPA = 16000;
export function promptMappa(argomento, sottoPunti) {
  const concetti = concettiInOrdine(argomento.concetti).map((c, i) => ({
    id: idBreve(i), titolo: c.titolo, descrizione: c.descrizione || "", ancora: c.ancora,
  }));
  return [
    "Sei un insegnante di scuola media italiana. Prepari la mappa concettuale di un argomento per un'alunna che deve ripassarlo dagli appunti.",
    "I rami principali sono già decisi: sono i concetti qui sotto, ognuno con il suo id. Per ogni concetto aggiungi da 0 a 4 sotto-punti, e sotto ciascun sotto-punto al massimo 3 dettagli. In tutto non più di " + sottoPunti + " fra sotto-punti e dettagli: meglio pochi e chiari che tanti.",
    "Ogni sotto-punto e ogni dettaglio ha un titolo brevissimo (al massimo sei parole) e un'ancora: la frase esatta del materiale da cui nasce, copiata parola per parola. Se non trovi la frase nel materiale, non scrivere il nodo.",
    "Non inventare niente che nel materiale non ci sia. Un'informazione vera ma non scritta (un autore, una data, un collegamento che conosci tu) non va aggiunta.",
    "Non ripetere il titolo del concetto nei suoi sotto-punti.",
    "Argomento: " + argomento.titolo + (argomento.materia ? " (" + argomento.materia + ")" : ""),
    "Concetti:\n" + JSON.stringify(concetti),
    "Materiale trascritto:\n" + String(argomento.trascrizione || "").slice(0, MAX_MATERIALE_MAPPA),
    'Rispondi solo con JSON: {"nodi":[{"concetto_id":"c1","figli":[{"titolo":"","ancora":"","figli":[{"titolo":"","ancora":""}]}]}]}',
  ].join("\n\n");
}

// ------------------------------------------------------------------ web come aiuto (issue #4)
// Nuovi, non dal prototipo: da tarare sulla prova vera. Due passi per ogni azione:
// prima una ricerca con lo strumento web_search (testo libero con citazioni),
// poi la composizione in JSON, dove il modello sceglie le fonti per numero.
// Il web non diventa mai una domanda di verifica.
const NIENTE_VERIFICA = "Non scrivere domande di verifica: questo serve solo a capire meglio, non a interrogare.";
const perEta = (classe) => etaDaClasse(classe) + " anni (" + (etaDaClasse(classe) === 13 ? "terza" : "seconda") + " media)";
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
    "Sei un insegnante di scuola media italiana. Un'alunna di " + perEta(dati.classe) + " non ha capito bene un concetto.",
    descriviConcetto(dati),
    testoErrore(dati.errore),
    "Cerca sul web (al massimo tre ricerche) informazioni affidabili che aiutino a spiegarlo meglio: un esempio concreto e un modo semplice per dirlo. Riassumi in poche righe in italiano quello che hai trovato, citando le fonti.",
    NIENTE_VERIFICA,
  ].filter(Boolean).join("\n\n");
}

// { ...come sopra, ricerca: testo della ricerca, fonti: [{ titolo, url }] }
export function promptSpiegazione(dati) {
  return [
    "Sei un insegnante di scuola media italiana. Scrivi per un'alunna di " + perEta(dati.classe) + ", con parole adatte alla sua età.",
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
    "Sei un insegnante di scuola media italiana. Un'alunna di " + perEta(dati.classe) + " ripassa con una mappa concettuale fatta dai suoi appunti.",
    "Materia: " + dati.materia + ". Argomento: " + dati.argomento + ".\nNodi della mappa:\n" + dati.agganci.map((a) => a.breve + ": " + a.titolo).join("\n"),
    "Cerca sul web (al massimo tre ricerche) esempi, curiosità e collegamenti che aiutano a ricordare questi nodi e che negli appunti non ci sono. Riassumi in poche righe in italiano quello che hai trovato, citando le fonti.",
    NIENTE_VERIFICA,
  ].join("\n\n");
}

// { ...come sopra, ricerca, fonti }
export function promptArricchisci(dati) {
  return [
    "Sei un insegnante di scuola media italiana. Aggiungi alla mappa concettuale di un'alunna di " + perEta(dati.classe) + " fino a 6 nodi presi dal web.",
    "Materia: " + dati.materia + ". Argomento: " + dati.argomento + ".\nNodi della mappa:\n" + dati.agganci.map((a) => a.breve + ": " + a.titolo).join("\n"),
    "Per ogni nodo nuovo: aggancio = l'id (n1, n2...) del nodo della mappa a cui si collega meglio; titolo brevissimo, al massimo sei parole; testo di 2 o 3 righe semplici; fonte = il numero della fonte da cui viene. Solo cose che stanno nelle fonti, niente che ripeta i nodi che ci sono già.",
    NIENTE_VERIFICA,
    "Quello che è stato trovato sul web:\n" + (dati.ricerca || "(niente)"),
    "Fonti:\n" + elencoFonti(dati.fonti),
  ].join("\n\n");
}
