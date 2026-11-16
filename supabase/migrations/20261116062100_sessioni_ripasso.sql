-- Ripasso guidato (issue #21): una sessione di ripasso si salva in `sessioni` con tipo 'ripasso'.
--
-- La scrive l'app con i permessi di chi studia alla fine del ripasso guidato (ripasso.js,
-- salvaRipassoGuidato), con le sue domande e risposte come una verifica. Policy invariate.
--
-- Unica eccezione alla regola delle sole aggiunte, chiesta dalla issue: il vincolo sul tipo si
-- ricrea con lo stesso nome e gli stessi valori, più 'ripasso'. Le righe che ci sono già lo
-- rispettano tutte (il nuovo insieme contiene il vecchio). La migration gira in una transazione
-- sola: se qualcosa non va, il vincolo vecchio resta com'era.

alter table public.sessioni drop constraint sessioni_tipo_check;
alter table public.sessioni add constraint sessioni_tipo_check
  check (tipo in ('miste', 'chiuse', 'aperte', 'ripasso'));
