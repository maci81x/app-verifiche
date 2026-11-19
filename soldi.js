// Costi in dollari, come le tariffe di supabase/functions/_shared/modelli.js (issue #34): niente conversioni.
// Sotto 1 centesimo 4 decimali, altrimenti «0,00 $» nasconderebbe le chiamate economiche. Script classico: lo usano
// l'app (pannello del genitore) e admin.html.
"use strict";
function dollari(x) {
  const v = Number(x) || 0;
  const cifre = v > 0 && v < 0.01 ? 4 : 2;
  return v.toLocaleString("it-IT", { minimumFractionDigits: cifre, maximumFractionDigits: cifre }) + " $";
}
