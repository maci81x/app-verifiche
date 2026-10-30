-- Prove di esercizi di matematica (issue #5, fetta #8).
--
-- Una prova di esercizi si salva come le altre, in sessioni / domande / risposte, con
-- valori già ammessi (tipo 'aperte', modalita 'scritta', domande 'aperta' con
-- risposta_attesa = risultato): nessun vincolo da cambiare. concetto_titolo è il titolo
-- del tipo di esercizio, così semaforo e storico raggruppano per tipo da soli.
--
-- Solo aggiunte: una colonna con default su sessioni (le prove di oggi restano "teoria")
-- e una colonna facoltativa su domande con l'esercizio completo (consegna, figura,
-- passaggi, risultato), che serve per rivederlo e stamparlo. Le policy esistenti valgono
-- anche per le colonne nuove.

alter table public.sessioni
  add column percorso text not null default 'teoria' check (percorso in ('teoria', 'esercizi'));

alter table public.domande
  add column esercizio jsonb check (esercizio is null or jsonb_typeof(esercizio) = 'object');
