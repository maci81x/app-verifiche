// Prova che la separazione dei profili regge nel database Supabase vero.
//
// Ogni test è uno script SQL eseguito sul progetto tramite la Management API,
// dentro una transazione che finisce sempre con rollback: crea i suoi utenti,
// agisce con il ruolo `authenticated` e i claim JWT come farebbe PostgREST,
// e non lascia niente nel database.
//
//   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=... npm run test:db
//   RLS_PSQL=postgresql://postgres@127.0.0.1:54329/postgres node --test test/db/rls.test.js
//     (issue #30) stessi test su un Postgres locale, per esempio una copia di sicurezza ripristinata con la migration
//     nuova applicata sopra: si provano le migration prima di darle a Roby, mai sul progetto vero.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
// SQL eseguito come superutente prima del test: serve solo a rompere apposta
// lo schema e controllare che i test se ne accorgano.
const MUTAZIONE = process.env.RLS_MUTAZIONE ?? '';
const LOCALE = process.env.RLS_PSQL;
// Con il pooler di Supabase l'utente temporaneo della CLI diventa postgres con `set role`, non con `reset role`.
const BASE = process.env.RLS_BASE ?? 'reset role';

const ANNA = '11111111-1111-4111-8111-111111111111';
const BEA = '22222222-2222-4222-8222-222222222222';
const GENITORE = '33333333-3333-4333-8333-333333333333';
const ARG = 'a0000000-0000-4000-8000-000000000001';
const CONC = 'c0000000-0000-4000-8000-000000000001';
const SESS = 'e0000000-0000-4000-8000-000000000001';
const DOM = 'd0000000-0000-4000-8000-000000000001';

async function esegui(sql) {
  if (LOCALE) {
    const r = spawnSync('psql', [LOCALE, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: sql, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(JSON.stringify({ message: (/ERROR:\s+(.*)/.exec(r.stderr) || [, r.stderr])[1] }));
    return [];
  }
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const corpo = await r.text();
  if (!r.ok) throw new Error(corpo);
  return JSON.parse(corpo);
}

// Da qui in poi le query girano come l'utente indicato (null = anonimo).
// Il ruolo vive in app_metadata (lo scrive il server): i genitori di prova lo hanno «genitore», gli altri «studente».
const GENITORI = ['33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'];
const claim = (uid) => (uid ? { sub: uid, role: 'authenticated', app_metadata: { ruolo: GENITORI.includes(uid) ? 'genitore' : 'studente' } } : { role: 'anon' });
const come = (uid) => `
  ${BASE};
  select set_config('request.jwt.claims', '${JSON.stringify(claim(uid))}', true);
  set local role ${uid ? 'authenticated' : 'anon'};`;

const q = (s) => s.replaceAll("'", "''");
const verifica = (condizione, messaggio) =>
  `do $t$ begin if not coalesce(${condizione}, false) then raise exception '${q(messaggio)}'; end if; end $t$;`;
// L'istruzione deve fallire con l'errore indicato; se passa, il test fallisce.
const vieta = (sql, errore, messaggio) => `
  do $t$ begin
    ${sql};
    raise exception using errcode = 'TFAIL', message = 'NON BLOCCATO: ${q(messaggio)}';
  exception when ${errore} then null;
  end $t$;`;
// Update e delete che non devono toccare nessuna riga.
const nessunaRiga = (sql, messaggio) => `
  do $t$ declare n int; begin
    ${sql};
    get diagnostics n = row_count;
    if n <> 0 then raise exception '${q(messaggio)} (% righe)', n; end if;
  end $t$;`;
const conta = (tabella) => `(select count(*) from ${tabella})`;

const PREPARA = `
  insert into auth.users (id, email) values
    ('${ANNA}', 'anna@test.invalid'), ('${BEA}', 'bea@test.invalid'), ('${GENITORE}', 'gen@test.invalid');
  insert into public.studenti (id, nome, classe) values ('${ANNA}', 'Anna', '3'), ('${BEA}', 'Bea', '2');
  insert into public.genitori_studenti values ('${GENITORE}', '${ANNA}', 'gen@test.invalid');
  ${come(ANNA)}
  insert into argomenti (id, materia, titolo, trascrizione)
    values ('${ARG}', 'storia', 'La peste del Trecento', 'La peste nera arrivò in Europa nel 1347');
  insert into concetti (id, argomento_id, titolo, ancora, peso)
    values ('${CONC}', '${ARG}', 'Arrivo della peste', 'La peste nera arrivò in Europa nel 1347', 3);
  insert into fonti (argomento_id, storage_path) values ('${ARG}', '${ANNA}/${ARG}/p1.jpg');
  insert into storage.objects (bucket_id, name) values ('fonti', '${ANNA}/${ARG}/p1.jpg');
  insert into sessioni (id, argomento_id, titolo, materia, livello, tipo, modalita, indice, voto)
    values ('${SESS}', '${ARG}', 'La peste del Trecento', 'storia', 'medio', 'miste', 'orale', 70, 7);
  insert into domande (id, sessione_id, argomento_id, concetto_id, concetto_titolo, ordine, tipo, livello,
                       testo, opzioni, corretta, ancora)
    values ('${DOM}', '${SESS}', '${ARG}', '${CONC}', 'Arrivo della peste', 1, 'chiusa', 'medio',
            'Quando arrivò la peste?', '["1347","1492","1215","1789"]', 0, 'La peste nera arrivò in Europa nel 1347');
  insert into risposte (sessione_id, domanda_id, scelta, punteggio) values ('${SESS}', '${DOM}', 1, 0);
`;

// extra: preparazione in più per i test che ne hanno bisogno (famiglie, issue #30).
function prova(nome, corpo, extra = '') {
  test(nome, { skip: !LOCALE && (!TOKEN || !REF) ? 'servono SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF (o RLS_PSQL)' : false }, async () => {
    try {
      await esegui(`begin; ${MUTAZIONE} ${PREPARA} ${extra} ${corpo} rollback;`);
    } catch (e) {
      const m = /"message":"((?:[^"\\]|\\.)*)"/.exec(e.message);
      assert.fail(m ? JSON.parse(`"${m[1]}"`) : e.message);
    }
  });
}

prova("una sorella non vede niente dell'altra", `
  ${come(BEA)}
  ${['argomenti', 'concetti', 'fonti', 'sessioni', 'domande', 'risposte', 'report']
    .map((t) => verifica(`${conta(t)} = 0`, `Bea vede righe di Anna in ${t}`)).join('\n')}
  ${vieta(`perform * from pin_profili`, 'insufficient_privilege', 'Bea legge la tabella dei PIN')}
  ${verifica(`(select array_agg(id) from studenti) = array['${BEA}'::uuid]`, 'Bea vede il profilo di Anna')}
  ${verifica(`${conta('storage.objects')} = 0`, 'Bea vede le foto di Anna nello storage')}
  ${come(ANNA)}
  ${verifica(`${conta('argomenti')} = 1 and ${conta('risposte')} = 1`, 'Anna non vede i suoi dati')}
`);

prova("una sorella non può scrivere nei dati dell'altra", `
  ${come(BEA)}
  ${vieta(`insert into argomenti (studente_id, materia, titolo) values ('${ANNA}', 'x', 'y')`,
    'insufficient_privilege', 'Bea crea un argomento a nome di Anna')}
  ${vieta(`insert into concetti (argomento_id, titolo, ancora) values ('${ARG}', 'x', 'y')`,
    'foreign_key_violation', "Bea aggiunge un concetto all'argomento di Anna")}
  ${vieta(`insert into domande (sessione_id, concetto_titolo, ordine, tipo, livello, testo, risposta_attesa, ancora)
           values ('${SESS}', 'c', 2, 'aperta', 'medio', 'q', 'r', 'a')`,
    'foreign_key_violation', 'Bea aggiunge una domanda alla prova di Anna')}
  ${nessunaRiga(`update argomenti set titolo = 'preso' where id = '${ARG}'`, "Bea modifica l'argomento di Anna")}
  ${nessunaRiga(`delete from sessioni where id = '${SESS}'`, 'Bea cancella la prova di Anna')}
  ${nessunaRiga(`update studenti set scelte = '{}' where id = '${ANNA}'`, 'Bea modifica il profilo di Anna')}
  ${vieta(`update studenti set nome = 'preso' where id = '${ANNA}'`, 'insufficient_privilege', 'Bea cambia il nome di un profilo')}
  ${vieta(`insert into storage.objects (bucket_id, name) values ('fonti', '${ANNA}/intrusa.jpg')`,
    'insufficient_privilege', 'Bea carica una foto nella cartella di Anna')}
  insert into argomenti (id, materia, titolo) values ('a0000000-0000-4000-8000-0000000000b1', 'a', 'b');
  ${vieta(`insert into fonti (argomento_id, storage_path) values ('a0000000-0000-4000-8000-0000000000b1', '${ANNA}/x.jpg')`,
    'check_violation', 'Bea registra una foto dentro la cartella di Anna')}
`);

prova('il genitore legge tutto tranne le foto e non scrive niente', `
  ${come(BEA)}
  insert into argomenti (materia, titolo) values ('geografia', 'I fiumi');
  ${come(GENITORE)}
  ${verifica(`${conta('argomenti')} = 1 and ${conta('sessioni')} = 1 and ${conta('risposte')} = 1`,
    'il genitore non legge le prove di Anna, o legge anche quelle di Bea')}
  ${verifica(`${conta('fonti')} = 0 and ${conta('storage.objects')} = 0`, 'il genitore vede le foto')}
  ${verifica(`(select array_agg(id) from studenti) = array['${ANNA}'::uuid]`, 'il genitore vede una figlia non collegata')}
  ${nessunaRiga(`update sessioni set voto = 10 where id = '${SESS}'`, 'il genitore cambia un voto')}
  ${nessunaRiga(`delete from risposte`, 'il genitore cancella risposte')}
  ${vieta(`insert into report (studente_id, dal, al, contenuto) values ('${ANNA}', current_date, current_date, '{}')`,
    'insufficient_privilege', 'il genitore scrive un report')}
`);

prova("chi non ha fatto l'accesso non legge niente", `
  ${come(null)}
  ${vieta(`perform * from argomenti`, 'insufficient_privilege', "l'anonimo legge gli argomenti")}
  ${vieta(`perform * from risposte`, 'insufficient_privilege', "l'anonimo legge le risposte")}
  ${verifica(`${conta('storage.objects')} = 0`, "l'anonimo vede le foto")}
`);

prova('eliminare un argomento lascia la prova nello storico', `
  ${come(ANNA)}
  delete from argomenti where id = '${ARG}';
  ${verifica(`(select argomento_id is null and titolo = 'La peste del Trecento' from sessioni where id = '${SESS}')`,
    'la prova è sparita o punta ancora all\'argomento')}
  ${verifica(`(select concetto_id is null and concetto_titolo = 'Arrivo della peste' from domande where id = '${DOM}')`,
    'la domanda ha perso il titolo del concetto')}
  ${verifica(`${conta('risposte')} = 1`, 'le risposte sono sparite')}
  ${verifica(`${conta('fonti')} = 0 and ${conta('concetti')} = 0`, 'foto o concetti sopravvivono all\'argomento')}
`);

prova('svuota la memoria di chi chiama e di nessun altro', `
  ${come(BEA)}
  insert into argomenti (materia, titolo) values ('geografia', 'I fiumi');
  select svuota_memoria();
  ${verifica(`${conta('argomenti')} = 0`, 'la memoria di Bea non è vuota')}
  ${come(ANNA)}
  ${verifica(`${conta('argomenti')} = 1`, 'svuotare Bea ha toccato Anna')}
  select svuota_memoria();
  ${['argomenti', 'concetti', 'fonti', 'sessioni', 'domande', 'risposte']
    .map((t) => verifica(`${conta(t)} = 0`, `restano righe in ${t}`)).join('\n')}
`);

// imposta_pin e verifica_pin sono del vecchio accesso: dalla revisione 20261116 nessun ruolo dell'API le chiama.
prova("PIN: l'hash non si legge, le vecchie funzioni non si chiamano più", `
  ${come(ANNA)}
  ${vieta(`perform * from pin_profili`, 'insufficient_privilege', "l'hash del PIN è leggibile")}
  ${vieta(`perform imposta_pin('2468')`, 'insufficient_privilege', 'Anna si cambia il codice senza il genitore')}
  ${vieta(`perform verifica_pin('2468')`, 'insufficient_privilege', 'Anna prova codici con verifica_pin')}
`);

prova('nessuno svuota una tabella con TRUNCATE, che scavalca le policy', `
  ${come(ANNA)}
  ${['argomenti', 'concetti', 'sessioni', 'domande', 'risposte', 'mappe', 'spiegazioni', 'esercizi_tipi', 'studenti']
    .map((t) => vieta(`truncate ${t} cascade`, 'insufficient_privilege', `Anna svuota ${t} di tutte`)).join('\n')}
`);

prova('una domanda chiusa senza opzioni valide non entra', `
  ${come(ANNA)}
  ${vieta(`insert into domande (sessione_id, concetto_titolo, ordine, tipo, livello, testo, ancora)
           values ('${SESS}', 'c', 2, 'chiusa', 'medio', 'q', 'a')`, 'check_violation', 'chiusa senza opzioni')}
  ${vieta(`insert into domande (sessione_id, concetto_titolo, ordine, tipo, livello, testo, opzioni, corretta, ancora)
           values ('${SESS}', 'c', 2, 'chiusa', 'medio', 'q', '["a","b"]', 2, 'a')`, 'check_violation', 'indice della corretta fuori dalle opzioni')}
  ${vieta(`insert into domande (sessione_id, concetto_titolo, ordine, tipo, livello, testo, ancora)
           values ('${SESS}', 'c', 2, 'aperta', 'medio', 'q', 'a')`, 'check_violation', 'aperta senza risposta attesa')}
  ${vieta(`insert into sessioni (titolo, materia, livello, tipo, modalita, voto)
           values ('x', 'storia', 'medio', 'chiuse', 'scritta', 6.3)`, 'check_violation', 'voto non al mezzo punto')}
`);

// ---------------------------------------------------------------- accesso con codice (issue #1)
// Le funzioni le chiama solo la Edge Function `accedi`/`profili` con la service role.
const comeServizio = `
  ${BASE};
  select set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;`;
const accesso = (pin, studente = ANNA) => `accesso_con_pin('${studente}', '${pin}')`;
const esito = (pin, atteso, messaggio) => verifica(`${accesso(pin)} = '${JSON.stringify(atteso)}'::jsonb`, messaggio);

prova('accesso con codice: giusto entra, sbagliato no, al terzo errore 60 secondi di attesa', `
  ${comeServizio}
  ${esito('0000', { ok: false, attendi: 0 }, 'senza PIN chiunque entra nel profilo')}
  select imposta_pin_di('${ANNA}', '2468');
  ${esito('2468', { ok: true }, 'il PIN giusto non entra')}
  ${esito('1357', { ok: false, attendi: 0 }, 'primo errore: niente attesa')}
  ${esito('1357', { ok: false, attendi: 0 }, 'secondo errore: niente attesa')}
  ${esito('1357', { ok: false, attendi: 60 }, 'terzo errore: dovrebbero essere 60 secondi')}
  ${esito('2468', { ok: false, attendi: 60 }, 'durante il blocco anche il PIN giusto deve aspettare')}
  -- passa il minuto
  ${BASE};
  update public.pin_profili set bloccato_fino = now() - interval '1 second' where user_id = '${ANNA}';
  ${comeServizio}
  ${esito('2468', { ok: true }, 'finito il blocco il PIN giusto non entra')}
  ${verifica(`(select errori = 0 and bloccato_fino is null from pin_profili where user_id = '${ANNA}')`,
    'il PIN giusto non azzera errori e blocco')}
`);

prova('accesso con codice: il PIN giusto azzera il conto degli errori', `
  ${comeServizio}
  select imposta_pin_di('${ANNA}', '2468');
  select ${accesso('1111')}; select ${accesso('1111')};
  ${esito('2468', { ok: true }, 'il PIN giusto non entra')}
  select ${accesso('1111')}; select ${accesso('1111')};
  ${verifica(`(select bloccato_fino is null from pin_profili where user_id = '${ANNA}')`,
    'bloccato dopo due errori: il PIN giusto non aveva azzerato il conto')}
  ${esito('xx', { ok: false, attendi: 60 }, 'un codice malformato non viene contato come errore')}
`);

prova("accesso con codice: il blocco di una sorella non tocca l'altra, gli sconosciuti non entrano", `
  ${comeServizio}
  select imposta_pin_di('${ANNA}', '2468');
  select imposta_pin_di('${BEA}', '1357');
  select ${accesso('0000')}; select ${accesso('0000')}; select ${accesso('0000')};
  ${verifica(`${accesso('1357', BEA)} = '{"ok":true}'::jsonb`, 'il blocco di Anna ferma anche Bea')}
  ${verifica(`${accesso('0000', GENITORE)} = '{"ok":false,"attendi":0}'::jsonb`,
    'il genitore (non è una studentessa) entra con un codice qualsiasi')}
  ${verifica(`${accesso('0000', 'f0000000-0000-4000-8000-000000000000')} = '{"ok":false,"attendi":0}'::jsonb`,
    'un id inesistente entra')}
`);

prova('imposta_pin_di: valida il codice e sblocca il profilo', `
  ${comeServizio}
  select imposta_pin_di('${ANNA}', '2468');
  select ${accesso('0000')}; select ${accesso('0000')}; select ${accesso('0000')};
  select imposta_pin_di('${ANNA}', '9753');
  ${esito('9753', { ok: true }, 'il codice nuovo non entra subito: il cambio non toglie il blocco')}
  ${esito('2468', { ok: false, attendi: 0 }, 'il codice vecchio entra ancora')}
  ${vieta(`perform imposta_pin_di('${ANNA}', '12')`, 'raise_exception', 'accettato un PIN di due cifre')}
  ${vieta(`perform imposta_pin_di('${ANNA}', '123456')`, 'raise_exception', 'accettato un PIN di sei cifre (il tastierino ne ha 4)')}
  ${vieta(`perform imposta_pin_di('${ANNA}', null)`, 'raise_exception', 'accettato un PIN vuoto')}
  ${vieta(`perform imposta_pin_di('${GENITORE}', '1234')`, 'raise_exception', 'PIN impostato su un utente che non è una studentessa')}
`);

prova("accesso con codice: l'anonimo e le studentesse non arrivano né alle tabelle né alle funzioni", `
  ${come(null)}
  ${vieta(`perform * from studenti`, 'insufficient_privilege', "l'anonimo legge i profili")}
  ${vieta(`perform * from pin_profili`, 'insufficient_privilege', "l'anonimo legge i PIN")}
  ${vieta(`perform ${accesso('0000')}`, 'insufficient_privilege', "l'anonimo prova i codici")}
  ${vieta(`perform imposta_pin_di('${ANNA}', '1234')`, 'insufficient_privilege', "l'anonimo cambia un codice")}
  ${come(BEA)}
  ${vieta(`perform ${accesso('0000')}`, 'insufficient_privilege', 'Bea prova i codici di Anna')}
  ${vieta(`perform imposta_pin_di('${ANNA}', '1234')`, 'insufficient_privilege', 'Bea cambia il codice di Anna')}
  ${come(GENITORE)}
  ${vieta(`perform imposta_pin_di('${ANNA}', '1234')`, 'insufficient_privilege', 'il genitore chiama la funzione senza passare dalla Edge Function')}
`);

// ---------------------------------------------------------------- mappa concettuale (issue #2)
const ALBERO = `'{"titolo":"La peste del Trecento","nodi":[]}'`;

prova('mappe: una per argomento, la ragazza legge e scrive le sue, il genitore legge, le altre niente', `
  ${come(ANNA)}
  insert into mappe (argomento_id, albero, scartati) values ('${ARG}', ${ALBERO}, 2);
  ${verifica(`(select studente_id = '${ANNA}' and generata is not null from mappe)`, 'la mappa non è di Anna')}
  -- Rigenera: sovrascrive la stessa riga
  insert into mappe (argomento_id, albero, scartati) values ('${ARG}', '{"titolo":"nuova","nodi":[]}', 0)
    on conflict (argomento_id, studente_id) do update set albero = excluded.albero, scartati = excluded.scartati;
  ${verifica(`${conta('mappe')} = 1 and (select albero->>'titolo' = 'nuova' from mappe)`, 'rigenerare non sovrascrive la mappa')}
  ${vieta(`insert into mappe (argomento_id, albero) values ('${ARG}', '[]')`, 'check_violation', "l'albero non è un oggetto")}
  ${come(BEA)}
  ${verifica(`${conta('mappe')} = 0`, 'Bea vede la mappa di Anna')}
  ${vieta(`insert into mappe (argomento_id, albero) values ('${ARG}', ${ALBERO})`,
    'foreign_key_violation', "Bea crea una mappa sull'argomento di Anna")}
  ${vieta(`insert into mappe (studente_id, argomento_id, albero) values ('${ANNA}', '${ARG}', ${ALBERO})`,
    'insufficient_privilege', 'Bea crea una mappa a nome di Anna')}
  ${nessunaRiga(`update mappe set scartati = 9`, 'Bea modifica la mappa di Anna')}
  ${nessunaRiga(`delete from mappe`, 'Bea cancella la mappa di Anna')}
  ${come(GENITORE)}
  ${verifica(`${conta('mappe')} = 1`, 'il genitore non legge la mappa della figlia')}
  ${nessunaRiga(`update mappe set scartati = 9`, 'il genitore modifica la mappa')}
  ${nessunaRiga(`delete from mappe`, 'il genitore cancella la mappa')}
  ${come(null)}
  ${vieta(`perform * from mappe`, 'insufficient_privilege', "l'anonimo legge le mappe")}
  ${come(ANNA)}
  delete from argomenti where id = '${ARG}';
  ${verifica(`${conta('mappe')} = 0`, "la mappa sopravvive all'argomento")}
`);

// ---------------------------------------------------------------- spiegazioni dal web (issue #4)
const SPIEGAZIONE = `'{"spiegazione":"x","esempio":"y","analogia":"z","fonti":[]}'`;

prova('spiegazioni: una per concetto, la ragazza legge e scrive le sue, il genitore legge, le altre niente', `
  ${come(ANNA)}
  insert into spiegazioni (concetto_id, contenuto) values ('${CONC}', ${SPIEGAZIONE});
  ${verifica(`(select studente_id = '${ANNA}' and generata is not null from spiegazioni)`, 'la spiegazione non è di Anna')}
  -- Rigenera: sovrascrive la stessa riga
  insert into spiegazioni (concetto_id, contenuto) values ('${CONC}', '{"spiegazione":"nuova"}')
    on conflict (concetto_id, studente_id) do update set contenuto = excluded.contenuto, generata = now();
  ${verifica(`${conta('spiegazioni')} = 1 and (select contenuto->>'spiegazione' = 'nuova' from spiegazioni)`, 'rigenerare non sovrascrive')}
  ${vieta(`insert into spiegazioni (concetto_id, contenuto) values ('${CONC}', '"testo"')`, 'check_violation', 'il contenuto non è un oggetto')}
  ${come(BEA)}
  ${verifica(`${conta('spiegazioni')} = 0`, 'Bea vede la spiegazione di Anna')}
  ${vieta(`insert into spiegazioni (concetto_id, contenuto) values ('${CONC}', ${SPIEGAZIONE})`,
    'foreign_key_violation', 'Bea crea una spiegazione sul concetto di Anna')}
  ${vieta(`insert into spiegazioni (studente_id, concetto_id, contenuto) values ('${ANNA}', '${CONC}', ${SPIEGAZIONE})`,
    'insufficient_privilege', 'Bea crea una spiegazione a nome di Anna')}
  ${nessunaRiga(`update spiegazioni set contenuto = '{}'`, 'Bea modifica la spiegazione di Anna')}
  ${nessunaRiga(`delete from spiegazioni`, 'Bea cancella la spiegazione di Anna')}
  ${come(GENITORE)}
  ${verifica(`${conta('spiegazioni')} = 1`, 'il genitore non legge la spiegazione della figlia')}
  ${nessunaRiga(`update spiegazioni set contenuto = '{}'`, 'il genitore modifica la spiegazione')}
  ${come(null)}
  ${vieta(`perform * from spiegazioni`, 'insufficient_privilege', "l'anonimo legge le spiegazioni")}
  ${come(ANNA)}
  delete from concetti where id = '${CONC}';
  ${verifica(`${conta('spiegazioni')} = 0`, 'la spiegazione sopravvive al concetto')}
`);

// ---------------------------------------------------------------- le 5 cose da sapere (issue #22)
const CINQUE = `'{"punti":[{"concetto_id":"${CONC}","etichetta":"Quando","testo":"","chiave":"La peste nera arrivò in Europa nel 1347"}],"catena":[],"parole":[],"domanda":null}'`;

prova('punti_chiave: una per argomento, la ragazza legge e scrive le sue, il genitore legge, le altre niente', `
  ${come(ANNA)}
  insert into punti_chiave (argomento_id, contenuto) values ('${ARG}', ${CINQUE});
  ${verifica(`(select studente_id = '${ANNA}' and generata is not null from punti_chiave)`, 'le 5 cose non sono di Anna')}
  -- Rifalle da capo: sovrascrive la stessa riga
  insert into punti_chiave (argomento_id, contenuto) values ('${ARG}', '{"punti":[]}')
    on conflict (argomento_id, studente_id) do update set contenuto = excluded.contenuto, generata = now();
  ${verifica(`${conta('punti_chiave')} = 1 and (select contenuto->'punti' = '[]'::jsonb from punti_chiave)`, 'rifarle non sovrascrive')}
  ${vieta(`insert into punti_chiave (argomento_id, contenuto) values ('${ARG}', '[1,2]')`, 'check_violation', 'il contenuto non è un oggetto')}
  ${come(BEA)}
  ${verifica(`${conta('punti_chiave')} = 0`, 'Bea vede le 5 cose di Anna')}
  ${vieta(`insert into punti_chiave (argomento_id, contenuto) values ('${ARG}', ${CINQUE})`,
    'foreign_key_violation', "Bea crea le 5 cose sull'argomento di Anna")}
  ${vieta(`insert into punti_chiave (studente_id, argomento_id, contenuto) values ('${ANNA}', '${ARG}', ${CINQUE})`,
    'insufficient_privilege', 'Bea crea le 5 cose a nome di Anna')}
  ${nessunaRiga(`update punti_chiave set contenuto = '{}'`, 'Bea modifica le 5 cose di Anna')}
  ${nessunaRiga(`delete from punti_chiave`, 'Bea cancella le 5 cose di Anna')}
  ${come(GENITORE)}
  ${verifica(`${conta('punti_chiave')} = 1`, 'il genitore non legge le 5 cose della figlia')}
  ${nessunaRiga(`update punti_chiave set contenuto = '{}'`, 'il genitore modifica le 5 cose')}
  ${nessunaRiga(`delete from punti_chiave`, 'il genitore cancella le 5 cose')}
  ${come(null)}
  ${vieta(`perform * from punti_chiave`, 'insufficient_privilege', "l'anonimo legge le 5 cose")}
  ${come(ANNA)}
  delete from argomenti where id = '${ARG}';
  ${verifica(`${conta('punti_chiave')} = 0`, "le 5 cose sopravvivono all'argomento")}
`);

// ---------------------------------------------------------------- tipi di esercizio (issue #5, fetta #6)
const TIPO = `'Espressioni con le frazioni', '[3/4 + (2/5 - 1/10)] x 2', 2, false`;

prova('esercizi_tipi: la ragazza legge e scrive i suoi, il genitore legge, le altre niente', `
  ${verifica(`(select percorso = 'teoria' from argomenti where id = '${ARG}')`, "un argomento di oggi non ha percorso 'teoria'")}
  ${come(ANNA)}
  update argomenti set percorso = 'esercizi' where id = '${ARG}';
  ${vieta(`update argomenti set percorso = 'orale' where id = '${ARG}'`, 'check_violation', 'percorso sconosciuto')}
  insert into esercizi_tipi (argomento_id, titolo, ancora, difficolta, figura) values ('${ARG}', ${TIPO});
  ${verifica(`(select studente_id = '${ANNA}' and stato = 'mai' and tentativi = 0 and media is null from esercizi_tipi)`, 'il tipo non nasce di Anna, mai verificato')}
  update esercizi_tipi set media = 7.5, stato = 'giallo', tentativi = 1;
  ${vieta(`insert into esercizi_tipi (argomento_id, titolo, ancora, difficolta) values ('${ARG}', 'x', 'y', 4)`, 'check_violation', 'difficoltà 4')}
  ${vieta(`insert into esercizi_tipi (argomento_id, titolo, ancora) values ('${ARG}', 'x', '  ')`, 'check_violation', 'ancora vuota')}
  ${come(BEA)}
  ${verifica(`${conta('esercizi_tipi')} = 0`, 'Bea vede i tipi di Anna')}
  ${vieta(`insert into esercizi_tipi (argomento_id, titolo, ancora, difficolta, figura) values ('${ARG}', ${TIPO})`,
    'foreign_key_violation', "Bea crea un tipo sull'argomento di Anna")}
  ${vieta(`insert into esercizi_tipi (studente_id, argomento_id, titolo, ancora, difficolta, figura) values ('${ANNA}', '${ARG}', ${TIPO})`,
    'insufficient_privilege', 'Bea crea un tipo a nome di Anna')}
  ${nessunaRiga(`update esercizi_tipi set media = 1`, 'Bea modifica i tipi di Anna')}
  ${nessunaRiga(`delete from esercizi_tipi`, 'Bea cancella i tipi di Anna')}
  ${come(GENITORE)}
  ${verifica(`${conta('esercizi_tipi')} = 1`, 'il genitore non legge i tipi della figlia')}
  ${nessunaRiga(`update esercizi_tipi set media = 1`, 'il genitore modifica i tipi')}
  ${nessunaRiga(`delete from esercizi_tipi`, 'il genitore cancella i tipi')}
  ${come(null)}
  ${vieta(`perform * from esercizi_tipi`, 'insufficient_privilege', "l'anonimo legge i tipi")}
  ${come(ANNA)}
  delete from argomenti where id = '${ARG}';
  ${verifica(`${conta('esercizi_tipi')} = 0`, "i tipi sopravvivono all'argomento")}
`);

prova('prove di esercizi: colonne nuove con le policy di sempre', `
  ${verifica(`(select percorso = 'teoria' from sessioni where id = '${SESS}')`, "una prova di oggi non ha percorso 'teoria'")}
  ${verifica(`(select esercizio is null from domande where id = '${DOM}')`, 'una domanda di oggi ha un esercizio')}
  ${come(ANNA)}
  update sessioni set percorso = 'esercizi' where id = '${SESS}';
  update domande set esercizio = '{"testo":"Calcola 3/4 + 1/2","risultato":{"valore":"5/4","unita":""}}' where id = '${DOM}';
  ${verifica(`(select esercizio->'risultato'->>'valore' = '5/4' from domande where id = '${DOM}')`, "l'esercizio non si salva")}
  ${vieta(`update sessioni set percorso = 'orale' where id = '${SESS}'`, 'check_violation', 'percorso sconosciuto')}
  ${vieta(`update domande set esercizio = '[1,2]' where id = '${DOM}'`, 'check_violation', "un esercizio che non è un oggetto")}
  ${come(BEA)}
  ${verifica(`${conta("sessioni where percorso = 'esercizi'")} = 0`, 'Bea vede le prove di esercizi di Anna')}
  ${nessunaRiga(`update domande set esercizio = '{}'`, "Bea modifica gli esercizi di Anna")}
  ${nessunaRiga(`update sessioni set percorso = 'teoria'`, "Bea modifica le prove di Anna")}
  ${come(GENITORE)}
  ${verifica(`(select count(*) = 1 from domande where esercizio is not null)`, "il genitore non legge l'esercizio della figlia")}
  ${nessunaRiga(`update domande set esercizio = '{}'`, "il genitore modifica gli esercizi")}
  ${come(null)}
  ${vieta(`perform * from sessioni`, 'insufficient_privilege', "l'anonimo legge le prove")}
`);

// ---------------------------------------------------------------- ripasso dilazionato (issue #20)
const RIPASSO = `'${CONC}', '2026-11-19', 3, 2.6, 'ci', 9`;

prova('ripasso_stato: uno per concetto, la ragazza legge e scrive il suo, il genitore legge, le altre niente', `
  ${come(ANNA)}
  insert into ripasso_stato (concetto_id, prossima, intervallo_giorni, facilita, ultima_sicurezza, ultimo_esito) values (${RIPASSO});
  ${verifica(`(select studente_id = '${ANNA}' and aggiornato is not null from ripasso_stato)`, 'lo stato non è di Anna')}
  -- dopo la risposta seguente: upsert sulla stessa riga
  insert into ripasso_stato (concetto_id, prossima, intervallo_giorni, facilita, ultimo_esito) values ('${CONC}', '2026-11-17', 1, 2.4, 2)
    on conflict (concetto_id, studente_id) do update set prossima = excluded.prossima, intervallo_giorni = excluded.intervallo_giorni,
      facilita = excluded.facilita, ultimo_esito = excluded.ultimo_esito, aggiornato = now();
  ${verifica(`${conta('ripasso_stato')} = 1 and (select intervallo_giorni = 1 and prossima = '2026-11-17' from ripasso_stato)`, "l'upsert non aggiorna")}
  ${vieta(`update ripasso_stato set ultima_sicurezza = 'boh'`, 'check_violation', 'sicurezza sconosciuta')}
  ${vieta(`update ripasso_stato set ultimo_esito = 11`, 'check_violation', 'esito oltre 10')}
  ${vieta(`update ripasso_stato set intervallo_giorni = 0`, 'check_violation', 'intervallo 0')}
  ${vieta(`update ripasso_stato set facilita = 0.5`, 'check_violation', 'facilità sotto 1,3')}
  ${come(BEA)}
  ${verifica(`${conta('ripasso_stato')} = 0`, 'Bea vede il ripasso di Anna')}
  ${vieta(`insert into ripasso_stato (concetto_id, prossima) values ('${CONC}', '2026-11-20')`,
    'foreign_key_violation', 'Bea crea uno stato sul concetto di Anna')}
  ${vieta(`insert into ripasso_stato (studente_id, concetto_id, prossima) values ('${ANNA}', '${CONC}', '2026-11-20')`,
    'insufficient_privilege', 'Bea crea uno stato a nome di Anna')}
  ${nessunaRiga(`update ripasso_stato set intervallo_giorni = 9`, 'Bea modifica il ripasso di Anna')}
  ${nessunaRiga(`delete from ripasso_stato`, 'Bea cancella il ripasso di Anna')}
  ${come(GENITORE)}
  ${verifica(`${conta('ripasso_stato')} = 1`, 'il genitore non legge il ripasso della figlia')}
  ${nessunaRiga(`update ripasso_stato set intervallo_giorni = 9`, 'il genitore modifica il ripasso')}
  ${nessunaRiga(`delete from ripasso_stato`, 'il genitore cancella il ripasso')}
  ${come(null)}
  ${vieta(`perform * from ripasso_stato`, 'insufficient_privilege', "l'anonimo legge il ripasso")}
  ${come(ANNA)}
  delete from concetti where id = '${CONC}';
  ${verifica(`${conta('ripasso_stato')} = 0`, 'lo stato sopravvive al concetto')}
`);

// ---------------------------------------------------------------- diario di ogni giorno (issue #19)
const SCAD = `'Matematica', 'scritta', '2026-11-19'`;

prova('scadenze: la ragazza legge e scrive le sue, il genitore legge, le altre niente', `
  ${come(ANNA)}
  insert into scadenze (materia, tipo, data, fonte) values (${SCAD}, 'diario');
  insert into scadenze (argomento_id, materia, tipo, data) values ('${ARG}', 'storia', 'orale', '2026-11-23');
  ${verifica(`(select bool_and(studente_id = '${ANNA}') and count(*) = 2 from scadenze)`, 'le scadenze non nascono di Anna')}
  ${verifica(`(select fonte = 'manuale' from scadenze where tipo = 'orale')`, "la fonte di default non è 'manuale'")}
  ${vieta(`insert into scadenze (materia, tipo, data) values ('Storia', 'pratica', '2026-11-19')`, 'check_violation', 'tipo sconosciuto')}
  ${vieta(`insert into scadenze (materia, tipo, data, fonte) values (${SCAD}, 'web')`, 'check_violation', 'fonte sconosciuta')}
  ${vieta(`insert into scadenze (materia, tipo, data) values ('  ', 'scritta', '2026-11-19')`, 'check_violation', 'materia vuota')}
  ${vieta(`insert into scadenze (materia, tipo, data) values ('matematica', 'scritta', '2026-11-19')`, 'unique_violation', 'la stessa scadenza segnata due volte')}
  insert into scadenze (materia, tipo, data) values ('matematica', 'orale', '2026-11-19');
  delete from scadenze where tipo = 'orale' and materia = 'matematica';
  ${come(BEA)}
  ${verifica(`${conta('scadenze')} = 0`, 'Bea vede le scadenze di Anna')}
  ${vieta(`insert into scadenze (argomento_id, materia, tipo, data) values ('${ARG}', ${SCAD})`,
    'foreign_key_violation', "Bea crea una scadenza sull'argomento di Anna")}
  ${vieta(`insert into scadenze (studente_id, materia, tipo, data) values ('${ANNA}', ${SCAD})`,
    'insufficient_privilege', 'Bea crea una scadenza a nome di Anna')}
  ${nessunaRiga(`update scadenze set data = '2026-12-01'`, 'Bea sposta le scadenze di Anna')}
  ${nessunaRiga(`delete from scadenze`, 'Bea cancella le scadenze di Anna')}
  ${come(GENITORE)}
  ${verifica(`${conta('scadenze')} = 2`, 'il genitore non legge le scadenze della figlia')}
  ${nessunaRiga(`update scadenze set data = '2026-12-01'`, 'il genitore sposta le scadenze')}
  ${nessunaRiga(`delete from scadenze`, 'il genitore cancella le scadenze')}
  ${come(null)}
  ${vieta(`perform * from scadenze`, 'insufficient_privilege', "l'anonimo legge le scadenze")}
  ${come(ANNA)}
  delete from argomenti where id = '${ARG}';
  ${verifica(`(select count(*) = 2 and count(argomento_id) = 0 from scadenze)`, "la scadenza non resta senza argomento quando l'argomento si cancella")}
  select svuota_memoria();
  ${verifica(`${conta('scadenze')} = 0`, 'svuota_memoria lascia le scadenze')}
`);

prova('giorni_diario: un giorno per data, la ragazza scrive i suoi, il genitore legge, le altre niente', `
  ${come(ANNA)}
  insert into giorni_diario (data, n_foto) values ('2026-11-16', 3);
  insert into giorni_diario (data, n_foto) values ('2026-11-16', 5)
    on conflict (studente_id, data) do update set n_foto = excluded.n_foto;
  ${verifica(`(select count(*) = 1 and min(n_foto) = 5 and bool_and(studente_id = '${ANNA}') from giorni_diario)`, "l'upsert del giorno non sovrascrive")}
  ${vieta(`insert into giorni_diario (data, n_foto) values ('2026-11-17', 0)`, 'check_violation', 'giorno senza foto')}
  ${come(BEA)}
  ${verifica(`${conta('giorni_diario')} = 0`, 'Bea vede i giorni di Anna')}
  ${vieta(`insert into giorni_diario (studente_id, data, n_foto) values ('${ANNA}', '2026-11-17', 1)`,
    'insufficient_privilege', 'Bea segna un giorno a nome di Anna')}
  ${nessunaRiga(`update giorni_diario set n_foto = 9`, 'Bea modifica i giorni di Anna')}
  ${nessunaRiga(`delete from giorni_diario`, 'Bea cancella i giorni di Anna')}
  ${come(GENITORE)}
  ${verifica(`${conta('giorni_diario')} = 1`, 'il genitore non legge i giorni della figlia')}
  ${nessunaRiga(`update giorni_diario set n_foto = 9`, 'il genitore modifica i giorni')}
  ${come(null)}
  ${vieta(`perform * from giorni_diario`, 'insufficient_privilege', "l'anonimo legge i giorni")}
  ${come(ANNA)}
  select svuota_memoria();
  ${verifica(`${conta('giorni_diario')} = 0`, 'svuota_memoria lascia i giorni')}
`);

// ---------------------------------------------------------------- ripasso guidato (issue #21)
prova("sessioni: il tipo 'ripasso' entra, un tipo sconosciuto no, le policy restano quelle", `
  ${come(ANNA)}
  insert into sessioni (argomento_id, titolo, materia, livello, tipo, modalita, indice, voto)
    values ('${ARG}', 'La peste del Trecento', 'storia', 'medio', 'ripasso', 'scritta', 60, 6);
  ${verifica(`(select count(*) = 1 from sessioni where tipo = 'ripasso')`, 'il ripasso non si salva')}
  ${vieta(`insert into sessioni (titolo, materia, livello, tipo, modalita) values ('x', 'storia', 'medio', 'boh', 'scritta')`,
    'check_violation', 'tipo sconosciuto')}
  ${come(BEA)}
  ${verifica(`(select count(*) = 0 from sessioni where tipo = 'ripasso')`, 'Bea vede il ripasso di Anna')}
  ${come(GENITORE)}
  ${verifica(`(select count(*) = 1 from sessioni where tipo = 'ripasso')`, 'il genitore non vede il ripasso della figlia')}
`);

// ---------------------------------------------------------------- famiglie esterne (issue #30)
// Due famiglie: A (esistente: il genitore di Anna) e B (esterna: GEN_B con Carlo e Dora). Bea non ha famiglia.
const GEN_B = '44444444-4444-4444-8444-444444444444';
const CARLO = '55555555-5555-4555-8555-555555555555';
const DORA = '66666666-6666-4666-8666-666666666666';
const FAM_A = 'fa000000-0000-4000-8000-00000000000a';
const FAM_B = 'fa000000-0000-4000-8000-00000000000b';
const ARG_C = 'a0000000-0000-4000-8000-0000000000c1';
const ARG_D = 'a0000000-0000-4000-8000-0000000000d1';
const FAMIGLIE = `
  ${BASE};
  update auth.users set email_confirmed_at = now() where id = '${GENITORE}';
  insert into auth.users (id, email, email_confirmed_at) values
    ('${GEN_B}', 'genb@test.invalid', now()), ('${CARLO}', 'carlo@test.invalid', now()), ('${DORA}', 'dora@test.invalid', now());
  insert into public.famiglie (id, genitore_id, esterna, limite_aiuti, limite_chiamate) values
    ('${FAM_A}', '${GENITORE}', false, 30, 150), ('${FAM_B}', '${GEN_B}', true, 10, 60);
  update public.studenti set famiglia_id = '${FAM_A}', nome_utente = 'anna-t3st' where id = '${ANNA}';
  update public.studenti set nome_utente = 'bea-t3st' where id = '${BEA}';
  insert into public.studenti (id, nome, classe, nome_utente, famiglia_id) values
    ('${CARLO}', 'Carlo', '1', 'carlo-t3st', '${FAM_B}'), ('${DORA}', 'Dora', '2', 'dora-t3st', '${FAM_B}');
  insert into public.genitori_studenti values ('${GEN_B}', '${CARLO}', 'genb@test.invalid'), ('${GEN_B}', '${DORA}', 'genb@test.invalid');
  insert into public.consensi (genitore_id, documento, versione) values ('${GENITORE}', 'privacy', '2026-11-19');
  insert into public.inviti (codice, titolare_id) values ('aaaaaaaa', '${GENITORE}');
  insert into public.consumi (studente_id, giorno, azione, modello) values ('${ANNA}', current_date, 'smista', 'claude-haiku-5-5');
  ${come(CARLO)}
  insert into argomenti (id, materia, titolo) values ('${ARG_C}', 'storia', 'I Romani');
  ${come(DORA)}
  insert into argomenti (id, materia, titolo) values ('${ARG_D}', 'scienze', 'La cellula');
  ${BASE};`;
const intestazione = (valore) => `select set_config('request.headers', '${q(JSON.stringify({ 'x-figlio': valore }))}', true);`;
const studentiVisti = (ids) => `(select coalesce(array_agg(id order by id), '{}') from studenti) = array[${ids.map((i) => `'${i}'::uuid`).join(',')}]::uuid[]`;

prova('due famiglie: il genitore B non vede niente della famiglia A, e viceversa', `
  ${come(GEN_B)}
  ${['argomenti', 'concetti', 'fonti', 'sessioni', 'domande', 'risposte', 'report', 'consumi']
    .map((t) => verifica(`(select count(*) from ${t} where studente_id = '${ANNA}') = 0`, `il genitore B vede righe di Anna in ${t}`)).join('\n')}
  ${verifica(studentiVisti([CARLO, DORA]), 'il genitore B non vede esattamente Carlo e Dora')}
  ${verifica(`(select array_agg(genitore_id) from famiglie) = array['${GEN_B}'::uuid]`, 'il genitore B vede famiglie di altri')}
  ${verifica(`${conta('consensi')} = 0 and ${conta('inviti')} = 0`, 'il genitore B vede consensi o inviti del genitore A')}
  ${come(GENITORE)}
  ${verifica(studentiVisti([ANNA]), 'il genitore A vede i figli di B')}
  ${verifica(`${conta('argomenti')} = 1`, 'il genitore A vede gli argomenti di Carlo o Dora')}
  ${verifica(`${conta('famiglie')} = 1 and ${conta('consensi')} = 1 and ${conta('inviti')} = 1 and ${conta('consumi')} = 1`,
    'il genitore A non vede la sua famiglia, i suoi consensi, il suo invito o i consumi di Anna')}
`, FAMIGLIE);

prova('due famiglie: Carlo vede solo sé; nessuno scrive le tabelle nuove; chi studia cambia solo le sue scelte', `
  ${come(CARLO)}
  ${verifica(studentiVisti([CARLO]), 'Carlo vede altri profili')}
  ${verifica(`${conta('argomenti')} = 1 and ${conta('famiglie')} = 0 and ${conta('consumi')} = 0`, 'Carlo vede dati di altri')}
  ${vieta(`insert into consumi (studente_id, giorno, azione, modello) values ('${CARLO}', current_date, 'x', 'y')`,
    'insufficient_privilege', 'Carlo scrive un consumo')}
  ${vieta(`update studenti set famiglia_id = '${FAM_A}' where id = '${CARLO}'`, 'insufficient_privilege', 'Carlo cambia famiglia')}
  ${vieta(`update studenti set nome_utente = 'anna' where id = '${CARLO}'`, 'insufficient_privilege', 'Carlo cambia nome utente')}
  ${vieta(`update studenti set nome = 'Carlino' where id = '${CARLO}'`, 'insufficient_privilege', 'Carlo cambia nome')}
  update studenti set scelte = '{"livello":"difficile","tipo":"miste","modalita":"scritta"}' where id = '${CARLO}';
  ${verifica(`(select scelte->>'livello' from studenti where id = '${CARLO}') = 'difficile'`, 'Carlo non salva le sue scelte')}
  ${come(GEN_B)}
  ${vieta(`insert into famiglie (genitore_id) values ('${GEN_B}')`, 'insufficient_privilege', 'il genitore crea una famiglia')}
  ${vieta(`update famiglie set limite_chiamate = 999`, 'insufficient_privilege', 'il genitore si alza i limiti')}
  ${vieta(`insert into consensi (genitore_id, documento, versione) values ('${GEN_B}', 'privacy', 'x')`,
    'insufficient_privilege', 'il genitore scrive un consenso')}
  ${vieta(`insert into inviti (codice, titolare_id) values ('bbbbbbbb', '${GEN_B}')`, 'insufficient_privilege', 'il genitore crea un invito')}
  ${vieta(`delete from consumi`, 'insufficient_privilege', 'il genitore cancella i consumi')}
`, FAMIGLIE);

prova("x-figlio: il genitore guarda un figlio solo; l'header non allarga mai", `
  ${come(GEN_B)}
  ${verifica(studentiVisti([CARLO, DORA]), 'senza header il genitore B non vede i due figli')}
  ${intestazione(CARLO)}
  ${verifica(studentiVisti([CARLO]), "con l'header di Carlo il genitore vede anche Dora")}
  ${verifica(`(select array_agg(id) from argomenti) = array['${ARG_C}'::uuid]`, "con l'header di Carlo gli argomenti di Dora si vedono")}
  ${intestazione(ANNA)}
  ${verifica(`${conta('studenti')} = 0 and ${conta('argomenti')} = 0`, "con l'header di Anna il genitore B vede qualcosa")}
  ${intestazione("x' or 'a' = 'a")}
  ${verifica(`${conta('studenti')} = 0`, 'un header malformato allarga o rompe le letture')}
  ${come(ANNA)}
  ${intestazione(CARLO)}
  ${verifica(studentiVisti([ANNA]), "Anna con l'header di Carlo vede altro che sé")}
  ${verifica(`${conta('argomenti')} = 1`, "Anna con l'header di Carlo perde i suoi argomenti")}
`, FAMIGLIE);

prova('tabelle e funzioni nuove: anonimo e utenti non arrivano dove non devono', `
  ${come(null)}
  ${['famiglie', 'inviti', 'consensi', 'consumi', 'impostazioni', 'accessi_admin', 'consumi_archiviati', 'tentativi_nome']
    .map((t) => vieta(`perform * from ${t}`, 'insufficient_privilege', `l'anonimo legge ${t}`)).join('\n')}
  ${come(GENITORE)}
  ${vieta(`perform * from impostazioni`, 'insufficient_privilege', 'il genitore legge le impostazioni')}
  ${vieta(`perform * from accessi_admin`, 'insufficient_privilege', 'il genitore legge il registro admin')}
  ${vieta(`perform * from tentativi_nome`, 'insufficient_privilege', 'il genitore legge i tentativi di accesso')}
  ${BASE};
  do $t$ declare f regprocedure; r text; begin
    for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname in
                ('accesso_con_nome', 'posti_occupati', 'invito_valido', 'stato_invito', 'iscrivi_famiglia', 'prenota_chiamata', 'pulisci_iscrizioni', 'archivia_consumi') loop
      foreach r in array array['anon', 'authenticated'] loop
        if has_function_privilege(r, f, 'execute') then raise exception '% può eseguire %', r, f; end if;
      end loop;
      if not has_function_privilege('service_role', f, 'execute') then raise exception 'service_role non esegue %', f; end if;
    end loop;
    if exists (select 1 from unnest(array['famiglie', 'inviti', 'consensi', 'consumi', 'impostazioni', 'accessi_admin']) t
                where not has_table_privilege('service_role', 'public.' || t, 'insert, update, delete, select')) then
      raise exception 'la service role non scrive in tutte le tabelle nuove';
    end if;
    if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in
         ('accesso_con_nome', 'posti_occupati', 'invito_valido', 'stato_invito', 'iscrivi_famiglia', 'prenota_chiamata', 'pulisci_iscrizioni', 'archivia_consumi')) <> 8 then
      raise exception 'mancano funzioni nuove';
    end if;
  end $t$;
  -- nessun'altra funzione security definer in public eseguibile da anon
  do $t$ declare f regprocedure; begin
    for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.prosecdef loop
      if has_function_privilege('anon', f, 'execute') then raise exception 'anon esegue la funzione security definer %', f; end if;
    end loop;
  end $t$;
`, FAMIGLIE);

const nome = (utente, pin) => `accesso_con_nome('${utente}', '${pin}')`;
const sbaglia5 = `select ${nome('carlo-t3st', '0000')}; select ${nome('carlo-t3st', '0000')}; select ${nome('carlo-t3st', '0000')}; select ${nome('carlo-t3st', '0000')};`;
const fineBlocco = (indietro = '1 second') => `${BASE}; update public.pin_profili set bloccato_fino = now() - interval '${indietro}' where user_id = '${CARLO}'; ${comeServizio}`;
const quintoErrore = (secondi) => `${sbaglia5} ${verifica(`${nome('carlo-t3st', '0000')} = '{"ok":false,"attendi":${secondi}}'::jsonb`, `al quinto errore l'attesa non è ${secondi} secondi`)}`;

prova('accesso con nome utente: 5 errori bloccano, l\'attesa cresce fino a 24 ore e aspettare non la azzera', `
  ${comeServizio}
  select imposta_pin_di('${CARLO}', '1357');
  ${verifica(`${nome('  Carlo-T3ST ', '1357')} = '{"ok":true,"studente_id":"${CARLO}"}'::jsonb`, 'nome utente con spazi e maiuscole non entra')}
  ${verifica(`${nome('nessuno-xyz', '1357')} = '{"ok":false,"attendi":0}'::jsonb`, 'un nome sconosciuto risponde diverso da un codice sbagliato')}
  select ${nome('nessuno-xyz', '0000')}; select ${nome('nessuno-xyz', '0000')}; select ${nome('nessuno-xyz', '0000')};
  ${verifica(`${nome('nessuno-xyz', '0000')} = '{"ok":false,"attendi":60}'::jsonb`, 'un nome sconosciuto non si blocca come uno vero: si capisce che non esiste')}
  ${sbaglia5}
  ${verifica(`(select errori = 4 and bloccato_fino is null from pin_profili where user_id = '${CARLO}')`, 'quattro errori non contati')}
  ${verifica(`${nome('carlo-t3st', '0000')} = '{"ok":false,"attendi":60}'::jsonb`, 'al quinto errore non scatta 1 minuto')}
  ${verifica(`(${nome('carlo-t3st', '1357')} ->> 'attendi')::int > 0`, 'durante il blocco il codice giusto entra')}
  ${verifica(`(select ultimo_blocco is not null and blocchi = 1 from pin_profili where user_id = '${CARLO}')`, 'il blocco non è registrato per il genitore')}
  ${fineBlocco()} ${quintoErrore(300)}
  ${fineBlocco()} ${quintoErrore(900)}
  ${fineBlocco()} ${quintoErrore(3600)}
  ${fineBlocco()} ${quintoErrore(14400)}
  ${fineBlocco()} ${quintoErrore(86400)}
  ${fineBlocco()} ${quintoErrore(86400)}
  ${fineBlocco('30 days')} ${quintoErrore(86400)}
  ${fineBlocco()}
  ${verifica(`${nome('carlo-t3st', '1357')} ->> 'ok' = 'true'`, 'finito il blocco il codice giusto non entra')}
  ${verifica(`(select errori = 0 and blocchi = 7 and bloccato_fino is null from pin_profili where user_id = '${CARLO}')`,
    'un accesso giusto deve scendere di un solo gradino (non riportare la scala a 1 minuto)')}
  ${quintoErrore(86400)}
  -- 7 giorni senza blocchi: la scala riparte
  ${BASE}; update public.pin_profili set bloccato_fino = now() - interval '7 days', ultimo_blocco = now() - interval '8 days' where user_id = '${CARLO}';
  ${comeServizio}
  ${quintoErrore(60)}
  ${BASE}; update public.pin_profili set blocchi = 4, ultimo_blocco = now(), bloccato_fino = now() + interval '1 hour' where user_id = '${CARLO}';
  ${comeServizio}
  select imposta_pin_di('${CARLO}', '2468');
  ${verifica(`(select blocchi = 0 and ultimo_blocco is null and bloccato_fino is null from pin_profili where user_id = '${CARLO}')`,
    'cambiare il codice non toglie blocco e blocchi')}
`, FAMIGLIE);

prova('accesso con nome utente: la famiglia sospesa si dice solo dopo il codice giusto', `
  ${BASE}; update public.famiglie set stato = 'sospesa' where id = '${FAM_B}';
  ${comeServizio}
  select imposta_pin_di('${CARLO}', '1357');
  ${verifica(`${nome('carlo-t3st', '0000')} = '{"ok":false,"attendi":0}'::jsonb`, 'la sospensione si rivela con un codice sbagliato')}
  ${verifica(`${nome('carlo-t3st', '1357')} = '{"ok":false,"sospesa":true,"attendi":0}'::jsonb`, 'una famiglia sospesa entra')}
`, FAMIGLIE);

// Genitori nuovi che si iscrivono: P1 e P2 senza mail confermata, P3 e P4 confermati.
const P = [1, 2, 3, 4].map((i) => `77777777-7777-4777-8777-77777777777${i}`);
const VERSIONI = `'{"privacy":"2026-11-19","condizioni":"2026-11-19","dati_figlio":"2026-11-19"}'::jsonb`;
const iscrivi = (gen, codice) => `iscrivi_famiglia('${gen}', 'Nome', 'Cognome', '${codice}', ${VERSIONI})`;
const esitoIscrizione = (gen, codice, atteso, messaggio) =>
  verifica(`${iscrivi(gen, codice)} ->> ${atteso === 'ok' ? `'ok' = 'true'` : `'errore' = '${atteso}'`}`, messaggio);
const ISCRIZIONI = `
  ${BASE};
  insert into auth.users (id, email, email_confirmed_at) values
    ('${P[0]}', 'p1@test.invalid', null), ('${P[1]}', 'p2@test.invalid', null),
    ('${P[2]}', 'p3@test.invalid', now()), ('${P[3]}', 'p4@test.invalid', now());
  insert into public.inviti (codice, titolare_id) values ('bbbbbbbb', '${GEN_B}');
  insert into public.inviti (codice, titolare_id, prova) values ('dddddddd', '${GENITORE}', true);
  update public.impostazioni set posti_esterni = 2;`;

prova('iscrizione: tetto dei posti, codici, prova monouso, consensi, chi ha invitato chi', `
  ${comeServizio}
  ${verifica(`posti_occupati() = 1`, 'la famiglia B (esterna, confermata) non occupa un posto')}
  ${verifica(`stato_invito('bbbbbbbb') = '{"valido":true,"prova":false,"posti_liberi":true}'::jsonb`, 'stato di un invito valido sbagliato')}
  ${verifica(`stato_invito('zzzzzzzz') = '{"valido":false}'::jsonb`, 'un codice inesistente è valido')}
  ${esitoIscrizione(P[0], ' BBBBBBBB ', 'ok', 'P1 non si iscrive con un codice valido (spazi e maiuscole)')}
  ${verifica(`posti_occupati() = 2`, "un'iscrizione non confermata di oggi non occupa un posto")}
  ${esitoIscrizione(P[1], 'aaaaaaaa', 'posti_esauriti', 'la terza famiglia supera il tetto di 2')}
  ${verifica(`(stato_invito('aaaaaaaa') ->> 'posti_liberi')::boolean = false`, 'stato_invito non vede i posti pieni')}
  ${esitoIscrizione(P[1], 'zzzzzzzz', 'invito_non_valido', 'un codice inesistente iscrive')}
  -- passano 25 ore senza conferma: il posto resta contato finché la pulizia (alla prossima iscrizione) non cancella P1
  ${BASE}; update public.famiglie set creato = now() - interval '25 hours' where genitore_id = '${P[0]}';
  ${comeServizio}
  ${verifica(`posti_occupati() = 2`, 'il tetto non conta tutte le famiglie esterne attive non di prova')}
  ${esitoIscrizione(P[1], 'aaaaaaaa', 'ok', 'P2 non entra quando il posto di un iscritto mai confermato si libera')}
  ${BASE};
  ${verifica(`(select count(*) from auth.users where id = '${P[0]}') = 0 and (select count(*) from public.famiglie where genitore_id = '${P[0]}') = 0`,
    "l'iscrizione mai confermata non è stata cancellata (utente e famiglia)")}
  ${comeServizio}
  ${verifica(`posti_occupati() = 2`, 'dopo la pulizia i posti non sono B e P2')}
  ${verifica(`(select invitata_da = '${GENITORE}' and esterna and not prova and limite_aiuti = 10 and limite_chiamate = 60
                 and codice_invito_usato = 'aaaaaaaa' from famiglie where genitore_id = '${P[1]}')`, 'la famiglia di P2 ha valori sbagliati')}
  ${verifica(`(select count(*) from consensi where genitore_id = '${P[1]}' and versione = '2026-11-19') = 3`, 'i tre consensi non sono registrati con la versione')}
  ${esitoIscrizione(P[2], 'dddddddd', 'ok', 'il codice di prova non iscrive a posti pieni')}
  ${verifica(`(select prova from famiglie where genitore_id = '${P[2]}') and posti_occupati() = 2`, 'la famiglia di prova occupa un posto o non è segnata')}
  ${esitoIscrizione(P[3], 'dddddddd', 'invito_non_valido', 'il codice di prova vale due volte')}
  -- sospendere una famiglia libera il posto
  ${BASE}; update public.famiglie set stato = 'sospesa' where id = '${FAM_B}';
  ${comeServizio}
  ${verifica(`posti_occupati() = 1`, 'una famiglia sospesa occupa un posto')}
`, FAMIGLIE + ISCRIZIONI);

prova("iscrizione non confermata: entro 24 ore si conferma, dopo è rifiutata e la pulizia libera il posto", `
  ${BASE}; update public.impostazioni set posti_esterni = 3;
  ${comeServizio}
  ${esitoIscrizione(P[0], 'bbbbbbbb', 'ok', 'P1 non si iscrive')}
  ${esitoIscrizione(P[1], 'aaaaaaaa', 'ok', 'P2 non si iscrive')}
  ${verifica(`posti_occupati() = 3`, 'le iscrizioni non confermate di oggi non occupano un posto')}
  ${esitoIscrizione(P[2], 'dddddddd', 'ok', 'il codice di prova non entra a posti pieni')}
  ${BASE};
  update auth.users set email_confirmed_at = now() where id = '${P[0]}';
  ${verifica(`(select email_confirmed_at is not null from auth.users where id = '${P[0]}')`, 'entro 24 ore la conferma non riesce')}
  update public.famiglie set creato = now() - interval '25 hours' where genitore_id = '${P[1]}';
  ${vieta(`update auth.users set email_confirmed_at = now() where id = '${P[1]}'`, 'raise_exception', 'dopo 24 ore la conferma riesce ancora')}
  ${comeServizio}
  ${verifica(`posti_occupati() = 3`, 'prima della pulizia il posto di P2 non è più contato')}
  ${verifica(`(stato_invito('bbbbbbbb') ->> 'posti_liberi')::boolean`, 'controllare un invito non libera il posto di chi non ha confermato')}
  ${BASE};
  ${verifica(`(select count(*) from auth.users where id = '${P[1]}') = 0`, "l'utente non confermato non è stato cancellato")}
  ${comeServizio}
  ${verifica(`posti_occupati() = 2`, 'la pulizia non libera il posto')}
  ${verifica(`pulisci_iscrizioni() = 0`, 'la pulizia cancella anche chi ha confermato o è di prova')}
  ${verifica(`(select count(*) from famiglie where genitore_id in ('${P[0]}', '${P[2]}')) = 2`, 'la pulizia ha toccato famiglie confermate o di prova')}
`, FAMIGLIE + ISCRIZIONI);

prova('prenota_chiamata: tetto atomico della famiglia, sospensione, limiti senza famiglia', `
  ${BASE}; update public.famiglie set limite_chiamate = 2 where id = '${FAM_B}';
  ${comeServizio}
  ${verifica(`prenota_chiamata('${CARLO}', current_date, 'smista') ->> 'ok' = 'true'`, 'prima chiamata rifiutata')}
  ${verifica(`prenota_chiamata('${CARLO}', current_date, 'smista') ->> 'ok' = 'true'`, 'seconda chiamata rifiutata')}
  ${verifica(`prenota_chiamata('${CARLO}', current_date, 'smista') = '{"ok":false,"errore":"tetto_giornaliero","tetto":2}'::jsonb`,
    'la terza chiamata supera il tetto di 2 (le righe prenotate non contano)')}
  ${verifica(`prenota_chiamata('${CARLO}', current_date + 1, 'smista') ->> 'ok' = 'true'`, 'il tetto di ieri vale anche oggi')}
  ${verifica(`(prenota_chiamata('${DORA}', current_date, 'smista') ->> 'limite_aiuti')::int = 10`, 'Dora non ha il limite di aiuti della famiglia')}
  ${verifica(`(select prenota_chiamata('${ANNA}', current_date, 'x') @> '{"ok":true,"limite_aiuti":30,"tetto":150}'::jsonb)`, 'Anna (famiglia esistente) non ha 30 e 150')}
  ${verifica(`(select prenota_chiamata('${BEA}', current_date, 'x') @> '{"ok":true,"limite_aiuti":10,"tetto":60}'::jsonb)`, 'senza famiglia non valgono 10 e 60')}
  ${BASE}; update public.famiglie set stato = 'sospesa' where id = '${FAM_B}';
  ${comeServizio}
  ${verifica(`prenota_chiamata('${DORA}', current_date, 'smista') = '{"ok":false,"errore":"famiglia_sospesa"}'::jsonb`, 'una famiglia sospesa chiama il modello')}
`, FAMIGLIE);

prova('tetto della famiglia: eliminare e ricreare un figlio non azzera le chiamate di oggi, e il costo resta per l\'admin', `
  ${BASE};
  update public.famiglie set limite_chiamate = 2 where id = '${FAM_B}';
  insert into public.consumi (studente_id, giorno, azione, modello, costo) values
    ('${CARLO}', current_date, 'smista', 'claude-haiku-5-5', 0.001), ('${CARLO}', current_date, 'smista', 'claude-haiku-5-5', 0.002);
  ${comeServizio}
  select archivia_consumi('${CARLO}');
  ${BASE};
  ${verifica(`(select chiamate = 2 and costo = 0.003 from public.consumi_archiviati where famiglia_id = '${FAM_B}' and giorno = current_date)`,
    'il consumo del figlio non è stato archiviato per la famiglia')}
  ${verifica(`(select count(*) from public.consumi where studente_id = '${CARLO}') = 0`, 'archiviare non toglie le righe vive (si conterebbero due volte)')}
  ${comeServizio}
  ${verifica(`archivia_consumi('${CARLO}') = 0`, 'ripetere l\'archiviazione archivia due volte')}
  ${BASE};
  delete from auth.users where id = '${CARLO}';
  insert into public.consumi_archiviati (famiglia_id, giorno, chiamate, costo) values ('${FAM_B}', current_date, 5, 0);
  ${comeServizio}
  ${verifica(`prenota_chiamata('${DORA}', current_date, 'smista') ->> 'ok' = 'true'`, 'Dora non può chiamare con la famiglia a 7 su 8')}
  ${verifica(`prenota_chiamata('${DORA}', current_date, 'smista') = '{"ok":false,"errore":"tetto_giornaliero","tetto":8}'::jsonb`,
    'la famiglia supera il suo tetto (limite per figlio × 4) eliminando e ricreando i figli')}
  ${verifica(`prenota_chiamata('${DORA}', current_date + 1, 'smista') ->> 'ok' = 'true'`, 'il tetto della famiglia vale anche il giorno dopo')}
  ${come(GEN_B)}
  ${vieta(`perform * from consumi_archiviati`, 'insufficient_privilege', 'il genitore legge l\'archivio dei consumi')}
`, FAMIGLIE);

prova('storage: solo chi studia carica foto, mai i genitori', `
  ${come(GEN_B)}
  ${vieta(`insert into storage.objects (bucket_id, name) values ('fonti', '${GEN_B}/file.jpg')`, 'insufficient_privilege', 'il genitore carica un file nella sua cartella')}
  ${come(CARLO)}
  insert into storage.objects (bucket_id, name) values ('fonti', '${CARLO}/${ARG_C}/p1.jpg');
  ${verifica(`(select count(*) from storage.objects where name like '${CARLO}/%') = 1`, 'Carlo non carica le sue foto')}
  ${BASE}; delete from public.studenti where id = '${DORA}';
  ${come(DORA)}
  ${vieta(`insert into storage.objects (bucket_id, name) values ('fonti', '${DORA}/x/p.jpg')`, 'insufficient_privilege', 'un profilo eliminato (token ancora valido) carica foto')}
`, FAMIGLIE);

prova('cancellazioni: consumi via col figlio, genitore con figli non si cancella, invitata_da si svuota', `
  ${BASE};
  insert into public.consumi (studente_id, giorno, azione, modello) values ('${CARLO}', current_date, 'x', 'y');
  insert into auth.users (id, email) values ('${P[0]}', 'p1@test.invalid');
  insert into public.famiglie (genitore_id, esterna, invitata_da) values ('${P[0]}', true, '${GEN_B}');
  delete from auth.users where id = '${CARLO}';
  ${verifica(`(select count(*) from public.consumi where studente_id = '${CARLO}') = 0`, 'i consumi di Carlo restano dopo la cancellazione')}
  ${vieta(`delete from auth.users where id = '${GEN_B}'`, 'foreign_key_violation', 'si cancella il genitore di una famiglia che ha ancora Dora')}
  ${verifica(`(select count(*) from public.studenti where id = '${DORA}') = 1`, 'Dora è sparita')}
  delete from auth.users where id = '${DORA}';
  delete from auth.users where id = '${GEN_B}';
  ${verifica(`(select invitata_da is null from public.famiglie where genitore_id = '${P[0]}')`, "invitata_da punta a un utente cancellato")}
  ${verifica(`(select count(*) from public.famiglie where genitore_id = '${GEN_B}') = 0`, 'la famiglia di B resta senza genitore')}
`, FAMIGLIE);
