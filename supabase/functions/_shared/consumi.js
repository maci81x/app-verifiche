// Somme dei consumi per il pannello admin (issue #34): righe per profilo e giorno, poi oggi e il mese corrente.
// Le chiamate dei figli eliminati (consumi_archiviati) contano come «profilo eliminato».
const arrotonda = (x) => Math.round(x * 1e6) / 1e6;

export function sommeConsumi(righe, archivio, oggi) {
  const mese = oggi.slice(0, 7);
  const somme = {};
  const tot = { oggi: { chiamate: 0, costo: 0 }, mese: { chiamate: 0, costo: 0 } };
  const aggiungi = (chiave, studente_id, giorno, chiamate, costo) => {
    const s = (somme[chiave] ??= { studente_id, giorno, chiamate: 0, costo: 0 });
    s.chiamate += chiamate; s.costo = arrotonda(s.costo + costo);
    for (const [k, vale] of [["oggi", giorno === oggi], ["mese", giorno.startsWith(mese)]])
      if (vale) { tot[k].chiamate += chiamate; tot[k].costo = arrotonda(tot[k].costo + costo); }
  };
  for (const a of archivio) aggiungi("eliminato:" + a.famiglia_id + "|" + a.giorno, "profilo eliminato", a.giorno, Number(a.chiamate) || 0, Number(a.costo) || 0);
  for (const r of righe) aggiungi(r.studente_id + "|" + r.giorno, r.studente_id, r.giorno, 1, Number(r.costo) || 0);
  return { righe: Object.values(somme).sort((a, b) => (a.giorno < b.giorno ? 1 : a.giorno > b.giorno ? -1 : 0)), ...tot };
}

// Dal giorno «giorni fa», ma sempre almeno dal primo del mese: il totale del mese deve essere completo.
export function inizioFinestra(oggi, giorni) {
  const fa = new Date(Date.parse(oggi + "T12:00:00Z") - giorni * 86400000).toISOString().slice(0, 10);
  const primo = oggi.slice(0, 8) + "01";
  return fa < primo ? fa : primo;
}
