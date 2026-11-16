# Numeri e date da verificare (issue #28)

Tutti i numeri e le date di `supabase/functions/_shared/programma.js` (esclusa la matematica, dove i numeri sono esercizi) e tutti i dati del quiz di geografia d'Italia, ognuno confrontato con una fonte (ISTAT, Treccani, Consiglio d'Europa, Unione europea, Wikipedia italiana). Quelli segnati **corretto** sono stati cambiati nel codice con il valore della fonte.

In tutto 209 dati: 170 giusti, 13 giusti con «circa», 4 corretti, 22 da non verificare (esempi di errore o di grammatica).

## Programma (programma.js)

| dove | dato | scritto | fonte dice | esito | fonte |
|---|---|---|---|---|---|
| st1-fine-impero | Esempio di errore dello studente (476 = IV secolo) | Il 476 è il IV secolo |  (Affermazione volutamente sbagliata) | non serve (esempio di errore o di grammatica) |  |
| st1-fine-impero | I secolo = 1-100, II = 101-200 | 1-100; 101-200 | Convenzione: il secolo n va da (n-1)·100+1 a n·100 | giusto | ragionamento aritmetico |
| st1-fine-impero | Il 476 è nel V secolo | V secolo | 401-500 = V secolo | giusto | ragionamento aritmetico |
| st1-fine-impero | Esempio di errore (476 distruzione improvvisa) | Nel 476 i barbari distruggono Roma |  (Affermazione volutamente sbagliata) | non serve (esempio di errore o di grammatica) |  |
| st1-fine-impero | Nel 476 Odoacre depone l'ultimo imperatore d'Occidente; data simbolo | 476 | 476: Odoacre depone Romolo Augustolo; data presa come simbolo | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Caduta_dell%27Impero_romano_d%27Occidente) |
| st1-fine-impero | Prima del 476 secoli di crisi | secoli di crisi | Crisi dal III secolo, accelerata nel V | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Caduta_dell%27Impero_romano_d%27Occidente) |
| st1-alto-medioevo | Incoronazione di Carlo Magno nell'800 | 800 | 800 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Medioevo) |
| st1-alto-medioevo | Medioevo dal 476 al 1492, circa mille anni | 476-1492, circa mille anni | 476-1492 (1016 anni) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Medioevo) |
| st1-alto-medioevo | Carlo Magno è dell'800 | 800 | incoronazione 800 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Medioevo) |
| st1-alto-medioevo | I Comuni nascono dopo il Mille, tre secoli dopo Carlo Magno | dopo il Mille; tre secoli dopo | Fioritura dei Comuni dopo l'anno 1000 (XI-XII sec.) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Medioevo) |
| st1-feudalesimo | Capitolare di Quierzy (877) rende ereditari i grandi feudi | 877 | 877; tradizionalmente interpretato come sanzione dell'ereditarietà dei feudi maggiori (minori: 1037) (Data giusta. Gli storici oggi ridimensionano la portata (it.wikipedia: non stabilì formalmente l'ereditarietà), ma la formulazione scolastica è quella di Treccani. Volendo: «di fatto diventa ereditario») | giusto | [www.treccani.it](https://www.treccani.it/enciclopedia/feudalesimo/) |
| st1-comuni | Fine della lotta per le investiture nel 1122 (Concordato di Worms) | 1122 | 23 settembre 1122 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Concordato_di_Worms) |
| st1-comuni | Crociate dal 1096 | 1096 | Prima crociata 1096-1099 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Prima_crociata) |
| st1-comuni | Battaglia di Legnano 1176 | 1176 | 29 maggio 1176 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Battaglia_di_Legnano) |
| st1-comuni | L'Italia unita nasce nel 1861 | 1861 | 17 marzo 1861 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Risorgimento) |
| st1-crisi-trecento | Peste del 1348 | 1348 | Peste nera 1346-1353; nel 1348 infetta tutta la penisola (Arriva a Messina nel 1347; 1348 è la data convenzionale) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Peste_nera) |
| ge1-strumenti | Esempio di errore di calcolo (1 cm = 100 m) | 1:100 000, 1 cm = 100 m |  (Affermazione volutamente sbagliata) | non serve (esempio di errore o di grammatica) |  |
| ge1-strumenti | 100 000 cm = 1000 m = 1 km | 1 km | 100 000 cm = 1000 m = 1 km | giusto | ragionamento aritmetico |
| ge1-strumenti | Togli due zeri per i metri e tre per i km | 2 + 3 zeri | cm→m ÷100; m→km ÷1000 | giusto | ragionamento aritmetico |
| ge1-italia-fisica | Po lungo circa 652 km | circa 652 km | 652 km (651,8) | giusto (circa) | [it.wikipedia.org](https://it.wikipedia.org/wiki/Po) |
| ge1-italia-fisica | Il Po attraversa la Pianura Padana | Pianura Padana | Piemonte, Lombardia, Emilia-Romagna, Veneto | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Po) |
| ge1-italia-fisica | Tevere circa 405 km, terzo dopo Po e Adige | circa 405 km; terzo | 405 km; terzo dopo Po e Adige | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Tevere) |
| sc1-materia-stati | Esempio di errore (evapora solo a 100 °C) | L'acqua evapora solo a 100 °C |  (Affermazione volutamente sbagliata) | non serve (esempio di errore o di grammatica) |  |
| sc1-materia-stati | Evaporazione anche a 20 °C, solo in superficie | 20 °C | Sotto la temperatura di ebollizione la vaporizzazione avviene solo in superficie | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Ebollizione) |
| sc1-materia-stati | Ebollizione dell'acqua a 100 °C al livello del mare, in tutto il liquido | 100 °C | 100 °C al livello del mare; coinvolge l'intera massa | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Ebollizione) |
| en1-to-be-have-got | Esempio di errore inglese | I have got 12 years |  (Esempio grammaticale sbagliato) | non serve (esempio di errore o di grammatica) |  |
| en1-to-be-have-got | Età con to be: I am 12 | I am 12 |  (Esempio grammaticale) | non serve (esempio di errore o di grammatica) |  |
| it2-poesia | Esempio di errore (12 sillabe) | 12 sillabe |  (Affermazione volutamente sbagliata) | non serve (esempio di errore o di grammatica) |  |
| it2-poesia | «Mi ritrovai per una selva oscura» ha 11 sillabe con la sinalefe: endecasillabo | 11 sillabe | mi/ri/tro/vai/per/u/na/sel/va‿os/cu/ra = 11 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Endecasillabo) |
| it2-letteratura | Dante 1265-1321 | 1265-1321 | 1265-1321 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Dante_Alighieri) |
| it2-letteratura | Petrarca nel Trecento | Trecento | 1304-1374 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Petrarca) |
| it2-letteratura | Boccaccio nel Trecento | Trecento | 1313-1375 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Giovanni_Boccaccio) |
| it2-letteratura | Ariosto del Cinquecento | Cinquecento | 1474-1533 (opere nel Cinquecento) (Nato nel Quattrocento, opera nel Cinquecento) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Ludovico_Ariosto) |
| it2-letteratura | Machiavelli del Cinquecento | Cinquecento | 1469-1527; Il Principe 1513 (Nato nel Quattrocento, opera nel Cinquecento) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Niccol%C3%B2_Machiavelli) |
| st2-umanesimo-scoperte | Colombo nel 1492 | 1492 | 1492 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Et%C3%A0_delle_scoperte) |
| st2-umanesimo-scoperte | Dias 1488 | 1488 | 1488 Capo di Buona Speranza | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Et%C3%A0_delle_scoperte) |
| st2-umanesimo-scoperte | Colombo 1492 | 1492 | 1492 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Et%C3%A0_delle_scoperte) |
| st2-umanesimo-scoperte | Vasco da Gama 1498 | 1498 | 1498 arriva in India | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Et%C3%A0_delle_scoperte) |
| st2-umanesimo-scoperte | Magellano 1519-1522 | 1519-1522 | 1519-1522 (Magellano muore, Elcano completa) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Et%C3%A0_delle_scoperte) |
| st2-riforma | Riforma di Lutero dal 1517 | 1517 | 1517, 95 tesi | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Riforma_protestante) |
| st2-riforma | Concilio di Trento 1545-1563 | 1545-1563 | 1545-1563 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Concilio_di_Trento) |
| st2-seicento | Dopo il 1689 in Inghilterra potere a re e Parlamento | 1689 | Bill of Rights 1689; nessun re governa più senza il Parlamento | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Gloriosa_rivoluzione) |
| st2-rivoluzioni | Presa della Bastiglia 1789 | 1789 | 14 luglio 1789 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Rivoluzione_francese) |
| st2-rivoluzioni | Repubblica nel 1792 | 1792 | settembre 1792 (22 settembre) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regime_del_Terrore) |
| st2-rivoluzioni | Terrore 1793-94 | 1793-94 | settembre 1793 - luglio 1794 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regime_del_Terrore) |
| st2-rivoluzioni | Colpo di Stato di Napoleone 1799 | 1799 | 18 brumaio, 9 novembre 1799 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Rivoluzione_francese) |
| st2-rivoluzioni | Rivoluzione industriale inizia in Inghilterra a metà Settecento (vapore, tessile) | metà del Settecento | Gran Bretagna, seconda metà del Settecento (1760-1830 circa); tessile e macchina a vapore (Alcuni testi dicono «seconda metà del Settecento»: va bene comunque) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Rivoluzione_industriale) |
| st2-rivoluzioni | Rivoluzione francese dal 1789 | 1789 | 1789 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Rivoluzione_francese) |
| st2-napoleone-risorgimento | Moti del 1820-21 | 1820-21 | luglio 1820 - 1821 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Risorgimento) |
| st2-napoleone-risorgimento | Moti del 1830-31 | 1830-31 | 1830-1831 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Risorgimento) |
| st2-napoleone-risorgimento | 1848 e prima guerra d'indipendenza | 1848 | 23 marzo 1848 - 22 agosto 1849 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Prima_guerra_d%27indipendenza_italiana) |
| st2-napoleone-risorgimento | 1859 (seconda guerra d'indipendenza) | 1859 | 1859 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Seconda_guerra_d%27indipendenza_italiana) |
| st2-napoleone-risorgimento | Spedizione dei Mille 1860 | 1860 | maggio 1860 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Spedizione_dei_Mille) |
| st2-napoleone-risorgimento | 1861 (Regno d'Italia) | 1861 | 17 marzo 1861 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Risorgimento) |
| st2-napoleone-risorgimento | Veneto 1866 | 1866 | 1866 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Risorgimento) |
| st2-napoleone-risorgimento | Roma 1870 | 1870 | 20 settembre 1870 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Risorgimento) |
| st2-napoleone-risorgimento | Esempio di errore (unità nel 1870) | 1870 |  (Affermazione volutamente sbagliata) | non serve (esempio di errore o di grammatica) |  |
| st2-napoleone-risorgimento | Descrizione dell'errore (1870 come proclamazione) | 1870 |  (Descrive l'errore dello studente) | non serve (esempio di errore o di grammatica) |  |
| st2-napoleone-risorgimento | Regno d'Italia nasce il 17 marzo 1861 | 17 marzo 1861 | 17 marzo 1861 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Risorgimento) |
| st2-napoleone-risorgimento | Nel 1870 si aggiunge Roma | 1870 | 20 settembre 1870 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Risorgimento) |
| st2-napoleone-risorgimento | Roma capitale nel 1871 | 1871 | 3 febbraio 1871 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Risorgimento) |
| ge2-europa-fisica | Volga circa 3500 km, il più lungo d'Europa | circa 3500 km | 3531 km; il più lungo d'Europa | giusto (circa) | [it.wikipedia.org](https://it.wikipedia.org/wiki/Volga) |
| ge2-europa-fisica | Danubio circa 2850 km, secondo | circa 2850 km | 2858 km (circa 2860); secondo dopo il Volga (Volendo: «quasi 2900 km») | giusto (circa) | [it.wikipedia.org](https://it.wikipedia.org/wiki/Danubio) |
| ge2-unione-europea | CECA 1951 | 1951 | Trattato di Parigi, 18 aprile 1951 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Comunit%C3%A0_europea_del_carbone_e_dell%27acciaio) |
| ge2-unione-europea | Trattati di Roma 1957 | 1957 | 25 marzo 1957 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Trattati_di_Roma) |
| ge2-unione-europea | Maastricht 1992 | 1992 | firmato 7 febbraio 1992 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Trattato_di_Maastricht) |
| ge2-unione-europea | Euro 2002 | 2002 | monete e banconote in circolazione dal 2002 (L'euro esiste come moneta di conto dal 1999; nelle tasche dal 2002) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Storia_dell%27Unione_europea) |
| ge2-unione-europea | Uscita del Regno Unito nel 2020 | 2020 | 31 gennaio 2020 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Brexit) |
| ge2-unione-europea | L'UE ha 27 Stati membri | 27 | 27 | giusto | [european-union.europa.eu](https://european-union.europa.eu/principles-countries-history/eu-countries_it) |
| ge2-unione-europea | Svizzera, Norvegia, Regno Unito fuori dall'UE | fuori | non presenti tra i 27 | giusto | [european-union.europa.eu](https://european-union.europa.eu/principles-countries-history/eu-countries_it) |
| ge2-unione-europea | Consiglio d'Europa: 46 Stati, diritti umani | 46 | 46 Stati membri; promuove diritti umani, democrazia, Stato di diritto (Pagina coe.int non leggibile (403); dato confermato da it.wikipedia) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Consiglio_d%27Europa) |
| ge2-unione-europea | Consiglio europeo riunisce i capi dei 27 Stati UE | 27 | capi di Stato o di governo dei Paesi membri + presidente | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Consiglio_europeo) |
| ge2-popolazione-economia | Italia 59 milioni di abitanti | 59 milioni | 58 942 828 (1/1/2026, stima ISTAT); 58,88 mln a ottobre 2026 (Volendo: «circa 59 milioni») | giusto (circa) | [it.wikipedia.org](https://it.wikipedia.org/wiki/Demografia_d%27Italia) |
| ge2-popolazione-economia | Superficie circa 302 000 km² | circa 302 000 km² | 302 069 km² | giusto (circa) | [it.wikipedia.org](https://it.wikipedia.org/wiki/Italia) |
| ge2-popolazione-economia | Densità circa 195 ab/km² | circa 195 | circa 195 ab/km² (58,94 mln / 302 069 = 195,13) | giusto (circa) | [it.wikipedia.org](https://it.wikipedia.org/wiki/Italia) |
| en2-past-simple | Esempio grammaticale «in 2010» | in 2010 |  (Esempio grammaticale) | non serve (esempio di errore o di grammatica) |  |
| it3-novecento | Il porto sepolto scritto al fronte nel 1915-1916 | 1915-1916 | da Natale 1915 a ottobre 1916; pubblicato 1916 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Il_porto_sepolto) |
| st3-fine-ottocento | Prima rivoluzione industriale nel Settecento: vapore, carbone, tessile | Settecento | seconda metà del Settecento; tessile e vapore | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Rivoluzione_industriale) |
| st3-fine-ottocento | Seconda dopo il 1870: elettricità, petrolio, acciaio, chimica | dopo il 1870 | convenzionalmente dal 1870; elettricità, chimica, petrolio (Acciaio non citato dalla pagina ma presente in tutti i manuali (processo Bessemer)) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Rivoluzione_industriale) |
| st3-prima-guerra | Sarajevo 1914 causa occasionale | 1914 | 28 giugno 1914 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Prima_guerra_mondiale) |
| st3-prima-guerra | Inizio guerra 1914 | 1914 | 28 luglio 1914 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Prima_guerra_mondiale) |
| st3-prima-guerra | Entrata dell'Italia 1915 | 1915 | dichiarazione all'Austria 23 maggio 1915, operazioni dal 24 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Patto_di_Londra_(1915)) |
| st3-prima-guerra | Caporetto 1917 | 1917 | 24 ottobre - 12 novembre 1917 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Battaglia_di_Caporetto) |
| st3-prima-guerra | Rivoluzione russa 1917 | 1917 | marzo e novembre 1917 (febbraio e ottobre calendario giuliano) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Rivoluzione_russa) |
| st3-prima-guerra | Entrata degli Stati Uniti 1917 | 1917 | 6 aprile 1917 | giusto | [en.wikipedia.org](https://en.wikipedia.org/wiki/American_entry_into_World_War_I) |
| st3-prima-guerra | Fine della guerra 1918 | 1918 | 11 novembre 1918 (armistizio di Compiègne) (Per l'Italia: armistizio di Villa Giusti, 4 novembre 1918) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Prima_guerra_mondiale) |
| st3-prima-guerra | Descrizione dell'errore (Italia con Imperi centrali) | 1915-1918 |  (Descrive l'errore dello studente) | non serve (esempio di errore o di grammatica) |  |
| st3-prima-guerra | Italia nella Triplice alleanza, neutrale nel 1914 | 1914 | Triplice alleanza (1882); neutrale nel 1914 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Prima_guerra_mondiale) |
| st3-prima-guerra | Patto di Londra 1915, con l'Intesa contro l'Austria | 1915 | 26 aprile 1915; guerra all'Austria-Ungheria dal 23 maggio 1915 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Patto_di_Londra_(1915)) |
| st3-totalitarismi | Marcia su Roma 1922 | 1922 | 27-31 ottobre 1922 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Marcia_su_Roma) |
| st3-totalitarismi | Hitler cancelliere 1933 | 1933 | 30 gennaio 1933 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Adolf_Hitler) |
| st3-totalitarismi | Esempio di errore (potere con la forza) | 1933 |  (Affermazione volutamente sbagliata) | non serve (esempio di errore o di grammatica) |  |
| st3-totalitarismi | Partito nazista primo partito con le elezioni | elezioni | luglio 1932: 37,4%, primo partito | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Partito_Nazionalsocialista_Tedesco_dei_Lavoratori) |
| st3-totalitarismi | Hitler nominato cancelliere nel 1933 | 1933 | 30 gennaio 1933, nominato da Hindenburg | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Adolf_Hitler) |
| st3-seconda-guerra | Invasione della Polonia 1939 | 1939 | 1 settembre 1939 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Seconda_guerra_mondiale) |
| st3-seconda-guerra | Entrata dell'Italia 1940 | 1940 | 10 giugno 1940 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Storia_militare_dell%27Italia_durante_la_seconda_guerra_mondiale) |
| st3-seconda-guerra | Pearl Harbor 1941 | 1941 | 7 dicembre 1941 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Attacco_di_Pearl_Harbor) |
| st3-seconda-guerra | Invasione dell'URSS 1941 | 1941 | 22 giugno 1941 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Operazione_Barbarossa) |
| st3-seconda-guerra | 8 settembre 1943 | 8 settembre 1943 | annuncio armistizio 8 settembre 1943 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Armistizio_di_Cassibile) |
| st3-seconda-guerra | 25 aprile 1945 | 25 aprile 1945 | 25 aprile 1945 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Festa_della_Liberazione) |
| st3-seconda-guerra | Fine della guerra ad agosto 1945 | agosto 1945 la fine | Europa: 8 maggio 1945 (resa tedesca); fine della guerra: 2 settembre 1945 (resa del Giappone) (Ad agosto 1945 ci sono le bombe atomiche e l'annuncio della resa giapponese (15 agosto), ma la firma è il 2 settembre) | **corretto**: Segna 8 settembre 1943, 25 aprile 1945, 8 maggio 1945 la fine in Europa e 2 settembre 1945 la resa del Giappone. | [it.wikipedia.org](https://it.wikipedia.org/wiki/Seconda_guerra_mondiale) |
| st3-seconda-guerra | Date dell'errore: 8 settembre 1943 e 25 aprile 1945 | 8/9/1943; 25/4/1945 | entrambe le date corrette (Campo che descrive l'errore; le date in sé sono giuste) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Armistizio_di_Cassibile) |
| st3-seconda-guerra | Esempio di errore (liberazione l'8 settembre) | 8 settembre 1943 |  (Affermazione volutamente sbagliata) | non serve (esempio di errore o di grammatica) |  |
| st3-seconda-guerra | L'8 settembre si annuncia l'armistizio; occupazione tedesca e Resistenza | 8 settembre | 8 settembre 1943 annuncio; invasione tedesca; nasce la Resistenza | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Armistizio_di_Cassibile) |
| st3-seconda-guerra | Liberazione il 25 aprile 1945 | 25 aprile 1945 | 25 aprile 1945 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Festa_della_Liberazione) |
| st3-repubblica-oggi | Svolta del 1946 | 1946 | referendum 2-3 giugno 1946 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Referendum_istituzionale_del_1946) |
| st3-repubblica-oggi | Nel 1946 votano anche le donne | 1946 | per la prima volta voto politico alle donne (Prime amministrative con voto femminile già a marzo 1946) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Referendum_istituzionale_del_1946) |
| st3-repubblica-oggi | Referendum 1946 | 1946 | 2-3 giugno 1946 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Referendum_istituzionale_del_1946) |
| st3-repubblica-oggi | Costituzione 1948 | 1948 | in vigore 1 gennaio 1948 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Costituzione_della_Repubblica_Italiana) |
| st3-repubblica-oggi | Muro di Berlino 1961 | 1961 | 13 agosto 1961 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Muro_di_Berlino) |
| st3-repubblica-oggi | Caduta del muro 1989 | 1989 | 9 novembre 1989 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Muro_di_Berlino) |
| st3-repubblica-oggi | Fine dell'URSS 1991 | 1991 | 26-31 dicembre 1991 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Dissoluzione_dell%27Unione_Sovietica) |
| st3-repubblica-oggi | Unione europea 1993 | 1993 | Maastricht in vigore 1 novembre 1993 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Trattato_di_Maastricht) |
| st3-repubblica-oggi | Esempio di errore (Costituzione 2 giugno 1946) | 2 giugno 1946 |  (Affermazione volutamente sbagliata) | non serve (esempio di errore o di grammatica) |  |
| st3-repubblica-oggi | 2 giugno 1946 referendum: vince la Repubblica, eletta la Costituente | 2 giugno 1946 | 2-3 giugno 1946; Repubblica 54,27%; Costituente eletta lo stesso giorno (Si votò anche il 3 giugno; il 2 giugno è la data ufficiale) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Referendum_istituzionale_del_1946) |
| st3-repubblica-oggi | Costituzione in vigore il 1° gennaio 1948 | 1° gennaio 1948 | 1 gennaio 1948 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Costituzione_della_Repubblica_Italiana) |
| ge3-continenti | Africa circa 14 volte la Groenlandia | circa 14 volte | 30 221 532 / 2 166 086 = 13,95 (Groenlandia: https://it.wikipedia.org/wiki/Groenlandia) | giusto (circa) | [it.wikipedia.org](https://it.wikipedia.org/wiki/Africa) |
| ge3-continenti | Africa ha 54 Stati | 54 | 54 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Africa) |
| ge3-continenti | Migliaia di lingue | migliaia | oltre un migliaio di lingue classificate (Stime correnti circa 2000. Per stare sicuri: «più di mille lingue») | giusto: nel testo ora «più di mille lingue» | [it.wikipedia.org](https://it.wikipedia.org/wiki/Lingue_dell%27Africa) |
| ge3-continenti | Sull'Atlante marocchino nevica | nevica | Alto Atlante (Toubkal 4167 m) innevato ogni inverno (Altezza Toubkal: https://it.wikipedia.org/wiki/Jbel_Toubkal) | giusto | [www.meteoweb.eu](https://www.meteoweb.eu/2026/01/sciare-sullatlante-guida-a-oukaimeden-la-vetta-bianca-del-marocco-nel-2026/1001883168/) |
| ge3-popolazione-mondo | Canada circa 40 milioni di abitanti | circa 40 milioni | 41 575 585 (2025) (Più preciso: «oltre 40 milioni» o «circa 41 milioni») | giusto (circa): nel testo ora «oltre 40 milioni» | [it.wikipedia.org](https://it.wikipedia.org/wiki/Canada) |
| ge3-popolazione-mondo | Canada circa 4 ab/km² | circa 4 | 4,2 ab/km² | giusto (circa) | [it.wikipedia.org](https://it.wikipedia.org/wiki/Canada) |
| ge3-popolazione-mondo | Bangladesh oltre 1000 ab/km² | oltre 1000 | 1265 ab/km² | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Bangladesh) |
| ge3-ambiente-sostenibilita | Agenda 2030 (ambiente, clima, risorse) | Agenda 2030 | adottata dall'ONU il 25 settembre 2015; obiettivi 12 e 13 su risorse e clima | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Agenda_2030) |
| sc3-terra | Esempio di errore (magnitudo) | 5 vs 4 |  (Affermazione volutamente sbagliata) | non serve (esempio di errore o di grammatica) |  |
| sc3-genetica | Aa × Aa: 1 caso su 4 aa | 1 su 4 | AA, Aa, Aa, aa (1:2:1) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Quadrato_di_Punnett) |
| sc3-genetica | Nell'uomo 46 cromosomi | 46 | 23 coppie = 46 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Cromosoma) |
| sc3-sistema-nervoso | Descrizione del mito del 10% | 10% |  (Descrive un errore (mito)) | non serve (esempio di errore o di grammatica) |  |
| sc3-sistema-nervoso | Esempio di errore (10% del cervello) | 10% |  (Affermazione volutamente sbagliata) | non serve (esempio di errore o di grammatica) |  |
| en3-present-perfect | Esempio grammaticale «in 2019» | in 2019 |  (Esempio grammaticale) | non serve (esempio di errore o di grammatica) |  |
| en3-present-perfect | Esempi grammaticali «for three years», «since 2020» | since 2020 |  (Esempio grammaticale) | non serve (esempio di errore o di grammatica) |  |
| en3-passivo | Esempio di errore inglese | in 1990 |  (Esempio grammaticale sbagliato) | non serve (esempio di errore o di grammatica) |  |
| en3-passivo | Esempio grammaticale «in 1990» | in 1990 |  (Esempio grammaticale) | non serve (esempio di errore o di grammatica) |  |
| en3-invalsi | Esempio INVALSI (museo alle 5 / alle 6) | 5; 6 |  (Esempio inventato di errore di lettura) | non serve (esempio di errore o di grammatica) |  |

## Quiz di geografia d'Italia (geografia.js)

| dove | dato | scritto | fonte dice | esito | fonte |
|---|---|---|---|---|---|
| regioni | Le regioni italiane sono 20 | 20 | 20 | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| regioni | 5 a statuto speciale: Valle d'Aosta, Trentino-Alto Adige, Friuli-Venezia Giulia, Sicilia, Sardegna | 5 | 5: Sicilia, Sardegna, Trentino-Alto Adige, Valle d'Aosta, Friuli-Venezia Giulia | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Piemonte: Torino | Torino | Torino | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Valle d'Aosta: Aosta | Aosta | Aosta | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Lombardia: Milano | Milano | Milano | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Trentino-Alto Adige: Trento | Trento | Trento | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Veneto: Venezia | Venezia | Venezia | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Friuli-Venezia Giulia: Trieste | Trieste | Trieste | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Liguria: Genova | Genova | Genova | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Emilia-Romagna: Bologna | Bologna | Bologna | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Toscana: Firenze | Firenze | Firenze | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Umbria: Perugia | Perugia | Perugia | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Marche: Ancona | Ancona | Ancona | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Lazio: Roma | Roma | Roma | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Abruzzo: L'Aquila | L'Aquila | L'Aquila | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Molise: Campobasso | Campobasso | Campobasso | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Campania: Napoli | Napoli | Napoli | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Puglia: Bari | Bari | Bari | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Basilicata: Potenza | Potenza | Potenza | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Calabria: Catanzaro | Catanzaro | Catanzaro | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Sicilia: Palermo | Palermo | Palermo | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| capoluoghi | Capoluogo di Sardegna: Cagliari | Cagliari | Cagliari | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Regioni_d%27Italia) |
| monte-bianco | Monte Bianco il più alto d'Italia e delle Alpi | il più alto | più alto delle Alpi e d'Italia | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Monte_Bianco) |
| monte-bianco | Altezza 4805 m (misura 2021) | 4805 m (misura 2021) | 2021: 4807 m; 2023: 4805,59 m (minimo record); dicembre 2025: 4807,3 m (4805 m è la misura 2023, non 2021. Meglio non legare il quiz a un numero esatto) | **corretto**: Monte Bianco: il monte più alto d'Italia e delle Alpi, circa 4800 m (l'altezza cambia un po' con la neve), in Valle d'Aosta al confine con la Francia. | [it.wikipedia.org](https://it.wikipedia.org/wiki/Monte_Bianco) |
| monte-bianco | In Valle d'Aosta al confine con la Francia | Valle d'Aosta / Francia | spartiacque tra Valle d'Aosta (Courmayeur) e Alta Savoia (Chamonix) (Il confine sulla vetta è conteso nelle carte francesi) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Monte_Bianco) |
| monte-rosa | Monte Rosa fra Piemonte e Valle d'Aosta (e Svizzera) | Piemonte, Valle d'Aosta, Svizzera | confini tra Valle d'Aosta e Piemonte; versante svizzero (Vallese) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Monte_Rosa) |
| monte-rosa | Punta Dufour 4634 m | 4634 m | 4634 m | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Punta_Dufour) |
| monte-rosa | Punta Dufour in Svizzera | in Svizzera | interamente in territorio svizzero, 180 m dal confine | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Punta_Dufour) |
| monviso | Monviso 3841 m | 3841 m | 3841 m | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Monviso) |
| monviso | Monviso in Piemonte | Piemonte | Piemonte, provincia di Cuneo | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Monviso) |
| monviso | Vi nasce il Po | vi nasce il Po | sorgente del Po a Pian del Re, ai piedi del Monviso | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Monviso) |
| gran-sasso | Corno Grande 2912 m | 2912 m | 2912 m | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Gran_Sasso_d%27Italia) |
| gran-sasso | In Abruzzo | Abruzzo | interamente in Abruzzo | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Gran_Sasso_d%27Italia) |
| gran-sasso | Vetta più alta degli Appennini | più alta | la vetta più alta di tutti gli Appennini | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Gran_Sasso_d%27Italia) |
| etna | Etna in Sicilia | Sicilia | Sicilia | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Etna) |
| etna | Vulcano attivo più alto d'Europa | più alto d'Europa | il più alto vulcano attivo in Europa | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Etna) |
| etna | Altezza circa 3300-3400 m, cambia con le eruzioni | circa 3300-3400 m | 3403 m (INGV, bollettino 17/9/2024); 3357 m nel 2021 (Proposta più semplice: «circa 3400 m (cambia con le eruzioni)». Eruzioni in corso da agosto 2026, altezza aggiornata non disponibile) | giusto (circa): nel quiz «circa 3400 m» | [it.wikipedia.org](https://it.wikipedia.org/wiki/Etna) |
| vesuvio | Vesuvio in Campania | Campania | Campania | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Vesuvio) |
| vesuvio | Vesuvio 1281 m | 1281 m | 1281 m (al 2010) (L'altezza del cono varia nel tempo) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Vesuvio) |
| marmolada | Marmolada 3343 m | 3343 m | Punta Penia 3343 m | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Marmolada) |
| marmolada | Fra Trentino-Alto Adige e Veneto | Trentino-Alto Adige / Veneto | vetta condivisa tra provincia di Trento e di Belluno | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Marmolada) |
| marmolada | Vetta più alta delle Dolomiti | più alta | la più alta delle Dolomiti | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Marmolada) |
| po | Po il fiume più lungo d'Italia, 652 km | 652 km | 652 km (651,8); il più lungo interamente in Italia | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Po) |
| po | Nasce dal Monviso (Piemonte) | Monviso, Piemonte | Pian del Re, Crissolo (CN), Piemonte | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Po) |
| po | Attraversa Piemonte, Lombardia, Emilia-Romagna, Veneto | 4 regioni | Piemonte, Lombardia, Emilia-Romagna, Veneto | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Po) |
| po | Sfocia nell'Adriatico con un delta (Veneto ed Emilia-Romagna) | delta Veneto/Emilia-Romagna | delta nelle province di Rovigo (Veneto) e Ferrara (Emilia-Romagna) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Po) |
| adige | Adige 410 km, secondo per lunghezza | 410 km; secondo | circa 410 km; secondo dopo il Po | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Adige) |
| adige | Nasce in Trentino-Alto Adige (Passo di Resia) | Passo di Resia | presso il Passo di Resia, Alta Val Venosta (Alto Adige) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Adige) |
| adige | Sfocia nell'Adriatico in Veneto | Adriatico, Veneto | Adriatico tra Chioggia e Rosolina (Veneto) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Adige) |
| tevere | Tevere 405 km, terzo per lunghezza | 405 km; terzo | 405 km; terzo dopo Po e Adige | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Tevere) |
| tevere | Nasce dal Monte Fumaiolo (Emilia-Romagna) | Monte Fumaiolo, Emilia-Romagna | Monte Fumaiolo, Verghereto, Emilia-Romagna | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Tevere) |
| tevere | Attraversa Toscana, Umbria e Lazio, passa per Roma | Toscana, Umbria, Lazio; Roma | Emilia-Romagna, Toscana, Umbria, Lazio; attraversa Roma | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Tevere) |
| tevere | Sfocia nel Tirreno (Lazio) | Tirreno, Lazio | Mar Tirreno a Ostia (Lazio) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Tevere) |
| arno | Arno 241 km | 241 km | 241 km | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Arno) |
| arno | Nasce dal Monte Falterona | Monte Falterona | versante meridionale del Monte Falterona (Capo d'Arno) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Arno) |
| arno | Scorre in Toscana, passa per Firenze e Pisa | Toscana; Firenze, Pisa | Toscana; Firenze, Pisa | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Arno) |
| arno | Sfocia nel Tirreno | Tirreno | Mar Tirreno a Marina di Pisa (ISPRA); it.wikipedia indica Mar Ligure (Le fonti divergono sul confine Tirreno/Ligure; i manuali scolastici dicono Tirreno. Nel quiz evitare di chiedere il mare dell'Arno o accettare entrambe; il quiz non chiede il mare dell’Arno) | giusto | [www.isprambiente.gov.it](https://www.isprambiente.gov.it/contentfiles/00002500/2582-memdes-79-capitolo2.pdf) |
| piave | Piave circa 220 km | 220 km circa | 231,24 km (Regione Veneto) | **corretto**: Piave: circa 230 km; nasce sul Monte Peralba, a Sappada (Friuli-Venezia Giulia), attraversa il Veneto e sfocia nell'Adriatico. | [it.wikipedia.org](https://it.wikipedia.org/wiki/Piave) |
| piave | Nasce in Veneto | nasce in Veneto | nasce sul Monte Peralba, comune di Sappada, in Friuli-Venezia Giulia (Sappada è passata dal Veneto al Friuli-Venezia Giulia nel 2017) | **corretto**: Piave: circa 230 km; nasce sul Monte Peralba, a Sappada (Friuli-Venezia Giulia), attraversa il Veneto e sfocia nell'Adriatico. | [it.wikipedia.org](https://it.wikipedia.org/wiki/Piave) |
| piave | Sfocia nell'Adriatico | Adriatico | Adriatico a Cortellazzo (Veneto) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Piave) |
| garda | Garda il più grande d'Italia | il più grande | il maggiore lago italiano | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Lago_di_Garda) |
| garda | Circa 368-370 km² | circa 368-370 km² | 368 km² (infobox), circa 370 km² (testo) (Proposta semplice: «circa 370 km²») | giusto (circa): nel quiz «circa 370 km²» | [it.wikipedia.org](https://it.wikipedia.org/wiki/Lago_di_Garda) |
| garda | Fra Lombardia, Veneto e Trentino-Alto Adige | 3 regioni | Lombardia (BS), Veneto (VR), Trentino-Alto Adige (TN) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Lago_di_Garda) |
| maggiore | Secondo per superficie | secondo | secondo per superficie dopo il Garda | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Lago_Maggiore) |
| maggiore | Circa 212 km² | circa 212 km² | 212 km² (circa 80% in Italia) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Lago_Maggiore) |
| maggiore | Fra Piemonte, Lombardia e Svizzera | Piemonte, Lombardia, Svizzera | Piemonte (VCO, NO), Lombardia (VA), Svizzera (Canton Ticino) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Lago_Maggiore) |
| como | Lago di Como in Lombardia | Lombardia | Lombardia (CO, LC) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Lago_di_Como) |
| como | Il più profondo d'Italia | il più profondo | il lago più profondo d'Italia | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Lago_di_Como) |
| como | Profondità circa 410 m | circa 410 m | 412 m (infobox), 418 m (testo; Laghi d'Italia: 418 m) (Valori diversi tra fonti: meglio «oltre 400 m») | giusto (circa): nel quiz «oltre 400 m» | [it.wikipedia.org](https://it.wikipedia.org/wiki/Lago_di_Como) |
| trasimeno | Trasimeno in Umbria | Umbria | Umbria (PG) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Lago_Trasimeno) |
| trasimeno | Il più grande dell'Italia peninsulare | il più grande | il lago più esteso dell'Italia peninsulare | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Lago_Trasimeno) |
| trasimeno | Circa 128 km² | circa 128 km² | 128 km² | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Lago_Trasimeno) |
| bolsena | Bolsena in Lazio | Lazio | Lazio (VT) | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Lago_di_Bolsena) |
| bolsena | Il più grande lago vulcanico d'Europa | il più grande | il lago di origine vulcanica più grande d'Europa | giusto | [it.wikipedia.org](https://it.wikipedia.org/wiki/Lago_di_Bolsena) |
| bolsena | Circa 114 km² | circa 114 km² | 113,5 km² (voce lago); 114,5 km² (Laghi d'Italia) | giusto (circa) | [it.wikipedia.org](https://it.wikipedia.org/wiki/Lago_di_Bolsena) |
