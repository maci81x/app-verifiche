// Prova che la separazione dei profili regge nel database Supabase vero.
//
// Ogni test è uno script SQL eseguito sul progetto tramite la Management API,
// dentro una transazione che finisce sempre con rollback: crea i suoi utenti,
// agisce con il ruolo `authenticated` e i claim JWT come farebbe PostgREST,
// e non lascia niente nel database.
//
//   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=... npm run test:db
import { test } from 'node:test';
import assert from 'node:assert/strict';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
// SQL eseguito come superutente prima del test: serve solo a rompere apposta
// lo schema e controllare che i test se ne accorgano.
const MUTAZIONE = process.env.RLS_MUTAZIONE ?? '';

const ANNA = '11111111-1111-4111-8111-111111111111';
const BEA = '22222222-2222-4222-8222-222222222222';
const GENITORE = '33333333-3333-4333-8333-333333333333';
const ARG = 'a0000000-0000-4000-8000-000000000001';
const CONC = 'c0000000-0000-4000-8000-000000000001';
const SESS = 'e0000000-0000-4000-8000-000000000001';
const DOM = 'd0000000-0000-4000-8000-000000000001';

async function esegui(sql) {
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
const come = (uid) => `
  reset role;
  select set_config('request.jwt.claims', '${JSON.stringify(uid ? { sub: uid, role: 'authenticated' } : { role: 'anon' })}', true);
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

function prova(nome, corpo) {
  test(nome, { skip: !TOKEN || !REF ? 'servono SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF' : false }, async () => {
    try {
      await esegui(`begin; ${MUTAZIONE} ${PREPARA} ${corpo} rollback;`);
    } catch (e) {
      const m = /"message":"((?:[^"\\]|\\.)*)"/.exec(e.message);
      assert.fail(m ? JSON.parse(`"${m[1]}"`) : e.message);
    }
  });
}

prova("una sorella non vede niente dell'altra", `
  ${come(BEA)}
  ${['argomenti', 'concetti', 'fonti', 'sessioni', 'domande', 'risposte', 'pin_profili', 'report']
    .map((t) => verifica(`${conta(t)} = 0`, `Bea vede righe di Anna in ${t}`)).join('\n')}
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
  ${nessunaRiga(`update studenti set nome = 'preso' where id = '${ANNA}'`, 'Bea modifica il profilo di Anna')}
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

prova("PIN: si imposta, si verifica, l'hash non si legge", `
  ${come(ANNA)}
  ${verifica(`verifica_pin('0000')`, 'senza PIN il profilo dovrebbe essere aperto')}
  select imposta_pin('2468');
  ${verifica(`verifica_pin('2468')`, 'il PIN giusto non viene accettato')}
  ${verifica(`not verifica_pin('1357')`, 'il PIN sbagliato viene accettato')}
  ${verifica(`${conta('pin_profili')} = 0`, "l'hash del PIN è leggibile")}
  ${vieta(`perform imposta_pin('12')`, 'raise_exception', 'accettato un PIN di due cifre')}
  ${come(BEA)}
  ${verifica(`verifica_pin('0000')`, 'il PIN di Anna blocca anche Bea')}
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
  reset role;
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
  reset role;
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
