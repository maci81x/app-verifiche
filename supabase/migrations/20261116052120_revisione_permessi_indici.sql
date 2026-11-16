-- Revisione con gli advisor di Supabase (novembre 2026).
--
-- Solo strette di permessi e indici: nessuna tabella, colonna o policy cambia.
-- Le policy RLS restano quelle di sempre; qui si toglie quello che le scavalca
-- o che non serve più.

-- ---------------------------------------------------------------- permessi

-- TRUNCATE non passa dalle policy RLS: con il grant di default una studentessa
-- con una connessione diretta svuoterebbe la tabella di tutte. PostgREST non lo
-- espone, ma il grant non serve a niente: via.
revoke truncate on all tables in schema public from authenticated;

-- L'hash dei PIN si tocca solo con le funzioni security definer (proprietario
-- postgres). RLS senza policy già blocca tutto; togliere anche i grant rende il
-- divieto esplicito (errore di permesso invece di zero righe).
revoke all on public.pin_profili from authenticated;

-- imposta_pin e verifica_pin erano del primo accesso con la sessione già aperta.
-- Dall'issue #1 il codice lo fissa il genitore (Edge Function profili →
-- imposta_pin_di) e lo controlla accedi (accesso_con_pin): l'app non le chiama
-- più. Restano security definer eseguibili da ogni utente autenticato via
-- /rest/v1/rpc (advisor 0029): una ragazza potrebbe cambiarsi il codice senza il
-- genitore, e senza azzerare il blocco. Le funzioni restano (solo aggiunte), ma
-- nessuno dei ruoli dell'API le può chiamare.
revoke execute on function public.imposta_pin(text), public.verifica_pin(text) from authenticated;

-- ---------------------------------------------------------------- indici

-- Cancellare un concetto mette a null concetto_id nelle domande (fk composta
-- concetto_id, studente_id): senza indice ogni cancellazione scorre tutta la tabella.
create index if not exists domande_concetto on public.domande (concetto_id, studente_id);

-- Cancellare un profilo cancella a cascata i collegamenti col genitore: la chiave
-- primaria parte da genitore_id e non serve per cercare per studente_id.
create index if not exists genitori_studenti_studente on public.genitori_studenti (studente_id);
