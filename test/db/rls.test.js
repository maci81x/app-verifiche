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
