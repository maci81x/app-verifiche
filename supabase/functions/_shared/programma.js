// Mappa del programma della scuola media (issue #28). Solo dati, nessun import.
//
// Per ogni classe (1, 2, 3) → materia → argomento: titolo, prerequisiti (id di argomenti
// della stessa materia, stessa classe o prima), strategie con un nome da prof, errori
// tipici riconoscibili per id e parole chiave per riconoscere un esercizio fotografato.
// Il server la usa per mettere nei prompt argomenti, strategie ed errori adatti alla classe.
//
// È una base di partenza: il materiale fotografato ha sempre la precedenza (libri e prof
// cambiano l'ordine e i contenuti).
//
// Fonti: Indicazioni nazionali per il primo ciclo. Dalle nuove Indicazioni (in vigore dal
// 1° settembre 2026): più grammatica e sintassi, poesie a memoria, scrittura a mano,
// latino facoltativo (LEL, Lingua e cultura latina) in 2ª e 3ª.

export const MATERIE = ["matematica", "italiano", "storia", "geografia", "scienze", "inglese"];

export const PROGRAMMA = {
  // ───────────────────────────────────────────── 1ª media
  1: {
    matematica: [
      {
        id: "ma1-naturali-decimali",
        titolo: "Numeri naturali e decimali",
        prerequisiti: [],
        strategie: [
          { nome: "Tabella delle cifre", quando: "Quando devi leggere, scrivere o confrontare numeri grandi o con la virgola.", passi: ["Scrivi il numero nella tabella migliaia, centinaia, decine, unità, decimi, centesimi.", "Allinea le virgole.", "Confronta cifra per cifra partendo da sinistra."] },
        ],
        errori_tipici: [
          { id: "decimali-piu-cifre-piu-grande", errore: "Più cifre dopo la virgola vuol dire numero più grande", esempio: "0,25 > 0,3", come_riconoscerlo: "Nel confronto tra decimali vince il numero con più cifre dopo la virgola.", spiegazione: "Scrivi 0,3 come 0,30: trenta centesimi contro venticinque centesimi. Quindi 0,3 è più grande di 0,25." },
        ],
        parole_chiave: ["numeri naturali", "numeri decimali", "valore posizionale", "decimi", "centesimi", "arrotondamento", "retta dei numeri"],
      },
      {
        id: "ma1-operazioni-espressioni",
        titolo: "Le quattro operazioni ed espressioni",
        prerequisiti: ["ma1-naturali-decimali"],
        strategie: [
          { nome: "Prima le parentesi, poi per e diviso", quando: "Quando risolvi un'espressione con più operazioni e parentesi.", passi: ["Parti dalle parentesi tonde, poi quadre, poi graffe.", "Dentro ogni parentesi fai prima moltiplicazioni e divisioni, da sinistra a destra.", "Poi addizioni e sottrazioni, da sinistra a destra.", "Riscrivi tutta l'espressione a ogni passo."] },
          { nome: "Stima prima di calcolare", quando: "Quando vuoi controllare se un risultato è credibile.", passi: ["Arrotonda i numeri a cifre tonde.", "Fai il conto a mente.", "Confronta la stima con il risultato."] },
        ],
        errori_tipici: [
          { id: "ordine-operazioni", errore: "Fare le operazioni da sinistra a destra senza priorità", esempio: "3 + 4 × 2 = 14", come_riconoscerlo: "L'addizione è stata fatta prima della moltiplicazione.", spiegazione: "Pensa a 3 euro più 4 pacchi da 2 euro: spendi 3 + 8 = 11 euro, non 14. Per questo la moltiplicazione va prima." },
          { id: "divisione-per-zero", errore: "Dividere per zero", esempio: "5 : 0 = 0", come_riconoscerlo: "C'è una divisione con zero al divisore e un risultato scritto.", spiegazione: "Se 5 : 0 facesse 0, allora 0 × 0 dovrebbe fare 5. Non torna: la divisione per zero è impossibile." },
        ],
        parole_chiave: ["espressione", "parentesi", "addizione", "sottrazione", "moltiplicazione", "divisione", "proprietà"],
      },
      {
        id: "ma1-potenze",
        titolo: "Le potenze e le loro proprietà",
        prerequisiti: ["ma1-operazioni-espressioni"],
        strategie: [
          { nome: "Scrivi la potenza per esteso", quando: "Quando non ricordi cosa fa una potenza o una proprietà.", passi: ["Scrivi la base tante volte quanto dice l'esponente.", "Moltiplica.", "Confronta con la proprietà che volevi usare."] },
          { nome: "Stessa base, guarda gli esponenti", quando: "Quando moltiplichi o dividi potenze con la stessa base.", passi: ["Controlla che la base sia proprio la stessa.", "Nel prodotto somma gli esponenti, nella divisione sottraili.", "Lascia la base com'è."] },
        ],
        errori_tipici: [
          { id: "potenza-base-per-esponente", errore: "Moltiplicare la base per l'esponente", esempio: "2³ = 6", come_riconoscerlo: "Il risultato è base × esponente.", spiegazione: "2³ vuol dire 2 × 2 × 2, cioè 8, non 6. Prova con 3²: 3 × 3 fa 9, mentre 3 × 2 fa 6." },
          { id: "potenze-prodotto-esponenti", errore: "Moltiplicare gli esponenti nel prodotto di potenze", esempio: "2² × 2³ = 2⁶", come_riconoscerlo: "Nel prodotto di potenze con la stessa base gli esponenti sono stati moltiplicati.", spiegazione: "Scrivi per esteso: (2 × 2) × (2 × 2 × 2) sono cinque 2, quindi 2⁵ = 32. Con 2⁶ verrebbe 64." },
          { id: "esponente-zero", errore: "Pensare che una potenza con esponente zero faccia zero", esempio: "7⁰ = 0", come_riconoscerlo: "Una potenza con esponente 0 ha come risultato 0.", spiegazione: "7² : 7² fa 1, e con la regola della divisione fa 7⁰. Quindi 7⁰ = 1." },
        ],
        parole_chiave: ["potenza", "base", "esponente", "al quadrato", "al cubo", "proprietà delle potenze"],
      },
      {
        id: "ma1-divisibilita-primi",
        titolo: "Divisibilità, numeri primi e scomposizione in fattori",
        prerequisiti: ["ma1-operazioni-espressioni", "ma1-potenze"],
        strategie: [
          { nome: "Albero dei fattori", quando: "Quando devi scomporre un numero in fattori primi.", passi: ["Dividi per il primo più piccolo che funziona: 2, 3, 5, 7...", "Scrivi il quoziente sotto e continua.", "Fermati quando arrivi a 1.", "Raccogli i fattori uguali in potenze."] },
          { nome: "Criteri di divisibilità", quando: "Quando devi capire in fretta se un numero si divide per 2, 3, 5, 9 o 10.", passi: ["Per 2 guarda l'ultima cifra pari.", "Per 3 e per 9 somma le cifre.", "Per 5 l'ultima cifra è 0 o 5, per 10 è 0."] },
        ],
        errori_tipici: [
          { id: "uno-numero-primo", errore: "Considerare 1 un numero primo", esempio: "I primi fino a 10 sono 1, 2, 3, 5, 7.", come_riconoscerlo: "L'1 compare nell'elenco dei primi o nella scomposizione.", spiegazione: "Un numero primo ha esattamente due divisori. 1 ne ha uno solo, se stesso, quindi non è primo." },
          { id: "scomposizione-non-prima", errore: "Lasciare fattori non primi nella scomposizione", esempio: "60 = 4 × 15", come_riconoscerlo: "Nella scomposizione finale ci sono numeri come 4, 6, 9, 15.", spiegazione: "4 e 15 si dividono ancora: 4 = 2² e 15 = 3 × 5. La scomposizione finita è 60 = 2² × 3 × 5." },
        ],
        parole_chiave: ["divisore", "multiplo", "numero primo", "scomposizione", "fattori primi", "criteri di divisibilità"],
      },
      {
        id: "ma1-mcd-mcm",
        titolo: "MCD e mcm",
        prerequisiti: ["ma1-divisibilita-primi"],
        strategie: [
          { nome: "Comuni col più piccolo, comuni e non comuni col più grande", quando: "Quando calcoli MCD e mcm con la scomposizione.", passi: ["Scomponi i numeri in fattori primi.", "Per il MCD prendi solo i fattori comuni, con l'esponente più piccolo.", "Per il mcm prendi tutti i fattori, comuni e non comuni, con l'esponente più grande.", "Moltiplica."] },
          { nome: "Si incontrano o si dividono?", quando: "Quando un problema non dice se usare MCD o mcm.", passi: ["Se cerchi quando due cose si ripetono insieme, è mcm.", "Se devi dividere in gruppi uguali più grandi possibile, è MCD.", "Controlla: il MCD è più piccolo dei numeri, il mcm più grande."] },
        ],
        errori_tipici: [
          { id: "mcd-mcm-scambiati", errore: "Scambiare MCD e mcm", esempio: "MCD(12, 18) = 36", come_riconoscerlo: "Il MCD è più grande dei numeri di partenza, o il mcm è più piccolo.", spiegazione: "Il MCD deve dividere 12: 36 non sta dentro 12. Il divisore comune più grande è 6, mentre 36 è il mcm." },
          { id: "mcm-prodotto", errore: "Fare sempre il prodotto per trovare il mcm", esempio: "mcm(4, 6) = 24", come_riconoscerlo: "Il mcm è il prodotto dei numeri anche quando hanno fattori in comune.", spiegazione: "12 è già multiplo di 4 e di 6, ed è più piccolo di 24. Il prodotto funziona solo se i numeri non hanno fattori in comune." },
        ],
        parole_chiave: ["mcd", "mcm", "massimo comun divisore", "minimo comune multiplo", "fattori comuni"],
      },
      {
        id: "ma1-frazioni-intro",
        titolo: "Introduzione alle frazioni: frazione di una quantità, equivalenti, confronto",
        prerequisiti: ["ma1-mcd-mcm"],
        strategie: [
          { nome: "Diviso il denominatore, per il numeratore", quando: "Quando calcoli la frazione di una quantità.", passi: ["Dividi la quantità per il denominatore: trovi una parte.", "Moltiplica per il numeratore.", "Controlla che 3/4 di qualcosa sia meno dell'intero."] },
          { nome: "Barra delle frazioni", quando: "Quando devi confrontare frazioni o capire se sono equivalenti.", passi: ["Disegna due barre uguali.", "Dividile in parti come dicono i denominatori.", "Colora le parti del numeratore e confronta."] },
        ],
        errori_tipici: [
          { id: "frazioni-confronto-denominatore", errore: "Pensare che un denominatore più grande dia una frazione più grande", esempio: "1/8 > 1/4", come_riconoscerlo: "Tra frazioni con lo stesso numeratore viene scelta quella col denominatore più grande.", spiegazione: "Una pizza divisa in 8 dà fette più piccole di una pizza divisa in 4. Quindi 1/8 è meno di 1/4." },
          { id: "frazione-equivalente-somma", errore: "Aggiungere lo stesso numero sopra e sotto", esempio: "2/3 = 4/5", come_riconoscerlo: "Per l'equivalente è stato sommato, non moltiplicato, lo stesso numero.", spiegazione: "2/3 = 4/6, perché si moltiplica sopra e sotto per 2. Con la somma 1/2 diventerebbe 2/3, ma metà pizza non è due terzi." },
        ],
        parole_chiave: ["frazione", "numeratore", "denominatore", "frazioni equivalenti", "semplificare", "frazione di una quantità"],
      },
      {
        id: "ma1-geometria-enti",
        titolo: "Geometria: enti fondamentali, segmenti e angoli",
        prerequisiti: [],
        strategie: [
          { nome: "Disegna e scrivi i dati sulla figura", quando: "Quando hai un problema con segmenti o angoli.", passi: ["Disegna la figura grande.", "Scrivi le misure note sulla figura.", "Segna con un punto di domanda quello che cerchi."] },
          { nome: "L'angolo va a 180 o a 90", quando: "Quando cerchi un angolo vicino a un altro.", passi: ["Capisci se gli angoli sono supplementari (180°) o complementari (90°).", "Sottrai l'angolo noto dal totale.", "Controlla la somma."] },
        ],
        errori_tipici: [
          { id: "angolo-lunghezza-lati", errore: "Misurare l'angolo dalla lunghezza dei lati", esempio: "L'angolo con i lati più lunghi è più grande.", come_riconoscerlo: "Due angoli uguali vengono detti diversi perché sono disegnati con lati di lunghezza diversa.", spiegazione: "L'angolo misura quanto si aprono i lati, non quanto sono lunghi. Allunga i lati di un angolo retto: resta 90°." },
          { id: "complementare-supplementare", errore: "Confondere complementare e supplementare", esempio: "Il supplementare di 30° è 60°.", come_riconoscerlo: "Il supplementare è calcolato con 90° o il complementare con 180°.", spiegazione: "Supplementari fanno insieme 180°, complementari 90°. 30° + 60° fa 90°, quindi 60° è il complementare." },
        ],
        parole_chiave: ["punto", "retta", "semiretta", "segmento", "angolo", "goniometro", "complementari", "supplementari"],
      },
      {
        id: "ma1-rette-poligoni",
        titolo: "Rette parallele e perpendicolari, triangoli, quadrilateri e perimetri",
        prerequisiti: ["ma1-geometria-enti"],
        strategie: [
          { nome: "Somma degli angoli interni", quando: "Quando cerchi un angolo di un triangolo o di un quadrilatero.", passi: ["Ricorda: triangolo 180°, quadrilatero 360°.", "Somma gli angoli noti.", "Sottrai dal totale."] },
          { nome: "Perimetro è il giro", quando: "Quando devi calcolare il perimetro di un poligono.", passi: ["Immagina di camminare sul bordo.", "Somma tutti i lati, anche quelli uguali non scritti.", "Scrivi l'unità di misura lineare (cm, m)."] },
        ],
        errori_tipici: [
          { id: "triangolo-disuguaglianza", errore: "Costruire un triangolo con lati impossibili", esempio: "Triangolo con lati 2 cm, 3 cm e 7 cm", come_riconoscerlo: "Un lato è più lungo della somma degli altri due.", spiegazione: "Prova con tre bastoncini: 2 + 3 fa 5, e due lati da 5 in tutto non arrivano a chiudere un lato da 7. Ogni lato deve essere minore della somma degli altri due." },
          { id: "somma-angoli-quadrilatero", errore: "Usare 180° anche per i quadrilateri", esempio: "In un rettangolo gli angoli sommano 180°.", come_riconoscerlo: "Nel quadrilatero la somma degli angoli è presa uguale a 180°.", spiegazione: "Un rettangolo ha quattro angoli da 90°: 4 × 90 = 360°. Una diagonale lo divide in due triangoli, 180° + 180°." },
        ],
        parole_chiave: ["parallele", "perpendicolari", "triangolo", "quadrilatero", "poligono", "perimetro", "angoli interni"],
      },
      {
        id: "ma1-misure",
        titolo: "Misure e problemi con le unità",
        prerequisiti: ["ma1-naturali-decimali"],
        strategie: [
          { nome: "Scala delle unità", quando: "Quando devi trasformare km, m, cm, kg, g, l, ml.", passi: ["Scrivi la scala km hm dam m dm cm mm.", "Conta i gradini dall'unità di partenza a quella di arrivo.", "Scendendo moltiplichi per 10 a ogni gradino, salendo dividi."] },
          { nome: "Stessa unità prima di fare i conti", quando: "Quando in un problema compaiono unità diverse.", passi: ["Scegli un'unità sola.", "Trasforma tutte le misure.", "Fai i conti e scrivi l'unità nel risultato."] },
        ],
        errori_tipici: [
          { id: "equivalenze-verso", errore: "Moltiplicare invece di dividere nelle equivalenze", esempio: "250 cm = 25 000 m", come_riconoscerlo: "Passando a un'unità più grande il numero è diventato più grande.", spiegazione: "Il metro è più lungo del centimetro, quindi servono meno metri: 250 cm = 2,5 m. Unità più grande, numero più piccolo." },
          { id: "unita-miste", errore: "Sommare misure con unità diverse", esempio: "2 m + 30 cm = 32", come_riconoscerlo: "Nel conto ci sono unità diverse e il risultato non ha unità o ne ha una a caso.", spiegazione: "2 m sono 200 cm: 200 + 30 = 230 cm, cioè 2,3 m. Con 32 un tavolo di 2 metri diventerebbe lungo 32 centimetri." },
        ],
        parole_chiave: ["unità di misura", "equivalenze", "metro", "chilogrammo", "litro", "problema"],
      },
    ],
    italiano: [
      {
        id: "it1-ortografia",
        titolo: "Ortografia, punteggiatura e scrittura a mano",
        prerequisiti: [],
        strategie: [
          { nome: "Prova della sostituzione", quando: "Quando non sai se scrivere «a/ha», «anno/hanno», «e/è».", passi: ["Prova a mettere al posto della parola una forma di «avere» o «essere» al passato, per esempio «aveva».", "Se la frase ha senso, ci vuole l'h o l'accento.", "Se non ha senso, niente h e niente accento."] },
          { nome: "Rileggi a voce", quando: "Quando hai finito di scrivere un testo.", passi: ["Leggi piano, una frase alla volta.", "Fermati dove senti una pausa e controlla la punteggiatura.", "Cerca le parole che sbagli più spesso."] },
        ],
        errori_tipici: [
          { id: "acca-verbo-avere", errore: "Dimenticare l'h del verbo avere", esempio: "Loro anno un cane.", come_riconoscerlo: "«o, a, ai, anno» sono usati come verbo senza h.", spiegazione: "Prova con «avevano un cane»: la frase funziona, quindi è il verbo avere e serve «hanno». «Anno» è l'anno del calendario." },
          { id: "qual-e-apostrofo", errore: "Scrivere «qual'è» con l'apostrofo", esempio: "Qual'è il tuo nome?", come_riconoscerlo: "C'è l'apostrofo tra «qual» e «è».", spiegazione: "«Qual» esiste anche da solo, come in «qual buon vento». Non manca nessuna lettera, quindi niente apostrofo: «qual è»." },
        ],
        parole_chiave: ["ortografia", "accento", "apostrofo", "punteggiatura", "acca", "dettato"],
      },
      {
        id: "it1-analisi-grammaticale",
        titolo: "Analisi grammaticale: le parti del discorso",
        prerequisiti: ["it1-ortografia"],
        strategie: [
          { nome: "Che lavoro fa la parola?", quando: "Quando una parola può essere di più tipi, come «la», «che», «bene».", passi: ["Guarda la parola dentro la frase, non da sola.", "Chiediti se accompagna un nome, lo sostituisce o indica un'azione.", "Scegli la parte del discorso in base al lavoro che fa."] },
          { nome: "Le nove parti del discorso", quando: "Quando inizi un'analisi grammaticale.", passi: ["Ripassa le variabili: articolo, nome, aggettivo, pronome, verbo.", "E le invariabili: avverbio, preposizione, congiunzione, interiezione.", "Per ogni parola variabile scrivi genere e numero."] },
        ],
        errori_tipici: [
          { id: "articolo-pronome-la", errore: "Confondere articolo e pronome", esempio: "«La vedo»: «la» = articolo", come_riconoscerlo: "«lo, la, li, le» sono chiamati articolo anche davanti a un verbo.", spiegazione: "L'articolo accompagna un nome. In «la vedo» dopo «la» c'è un verbo, e «la» sostituisce una persona: è un pronome." },
          { id: "aggettivo-avverbio", errore: "Confondere aggettivo e avverbio", esempio: "«Corre veloce»: «veloce» = aggettivo", come_riconoscerlo: "Una parola che descrive come si fa un'azione è chiamata aggettivo.", spiegazione: "L'aggettivo si accorda con un nome. Qui «veloce» dice come corre, quindi modifica il verbo e fa da avverbio, come «velocemente»." },
        ],
        parole_chiave: ["analisi grammaticale", "nome", "aggettivo", "articolo", "pronome", "avverbio", "preposizione", "congiunzione"],
      },
      {
        id: "it1-verbo",
        titolo: "Il verbo: coniugazioni, modi e tempi",
        prerequisiti: ["it1-analisi-grammaticale"],
        strategie: [
          { nome: "Prima il modo, poi il tempo", quando: "Quando devi analizzare una forma verbale.", passi: ["Trova l'infinito e la coniugazione.", "Capisci il modo: indicativo, congiuntivo, condizionale, imperativo o indefinito.", "Poi il tempo, la persona e il numero."] },
          { nome: "Ieri, oggi, domani", quando: "Quando non sai quale tempo usare in una frase.", passi: ["Chiediti quando succede l'azione.", "Metti la frase su una linea del tempo.", "Scegli il tempo che corrisponde a quel punto."] },
        ],
        errori_tipici: [
          { id: "se-condizionale", errore: "Usare il condizionale dopo «se»", esempio: "Se avrei tempo, verrei.", come_riconoscerlo: "Dopo «se» c'è un verbo che finisce in -rei, -resti, -rebbe.", spiegazione: "Dopo «se» nell'ipotesi ci vuole il congiuntivo: «se avessi tempo». Il condizionale va nell'altra parte: «verrei»." },
          { id: "passato-prossimo-remoto", errore: "Confondere passato prossimo e passato remoto", esempio: "«andò» analizzato come passato prossimo", come_riconoscerlo: "Una forma semplice è chiamata passato prossimo, o una composta passato remoto.", spiegazione: "Il passato prossimo ha l'ausiliare: «è andato». Il passato remoto è una parola sola: «andò»." },
        ],
        parole_chiave: ["verbo", "modo", "tempo", "coniugazione", "indicativo", "congiuntivo", "condizionale", "ausiliare"],
      },
      {
        id: "it1-narrativo",
        titolo: "Testo narrativo, fiaba, favola e riassunto",
        prerequisiti: [],
        strategie: [
          { nome: "Chi, dove, quando, cosa, perché", quando: "Quando leggi un racconto o devi riassumerlo.", passi: ["Rispondi alle cinque domande in una riga ciascuna.", "Dividi il testo in sequenze.", "Dai un titolo a ogni sequenza."] },
          { nome: "Schema della fiaba", quando: "Quando analizzi o scrivi una fiaba.", passi: ["Trova la situazione iniziale.", "Trova il problema e l'aiutante.", "Trova la soluzione e la situazione finale."] },
        ],
        errori_tipici: [
          { id: "fiaba-favola", errore: "Confondere fiaba e favola", esempio: "«La volpe e l'uva» è una fiaba.", come_riconoscerlo: "Un testo breve con animali e una morale è chiamato fiaba, o il contrario.", spiegazione: "La favola è breve, ha animali che parlano e finisce con una morale, come in Esopo e Fedro. La fiaba ha magia, re, fate e prove da superare." },
          { id: "riassunto-discorso-diretto", errore: "Copiare frasi e dialoghi nel riassunto", esempio: "Il lupo disse: «Nonna, che orecchie grandi!»", come_riconoscerlo: "Nel riassunto ci sono virgolette, battute o frasi identiche al testo.", spiegazione: "Il riassunto racconta i fatti con parole tue, in terza persona. Se copi le battute diventa lungo quasi come il testo e non è più un riassunto." },
        ],
        parole_chiave: ["testo narrativo", "fiaba", "favola", "morale", "sequenze", "riassunto", "narratore", "personaggi"],
      },
      {
        id: "it1-epica",
        titolo: "Mito ed epica: Iliade, Odissea, Eneide",
        prerequisiti: ["it1-narrativo"],
        strategie: [
          { nome: "Carta d'identità del poema", quando: "Quando studi un poema epico.", passi: ["Scrivi autore, lingua e periodo.", "Scrivi l'eroe e il suo viaggio o la sua guerra.", "Scrivi tre episodi che ricordi meglio."] },
          { nome: "Riconosci gli epiteti", quando: "Quando leggi un brano epico.", passi: ["Cerca le espressioni che si ripetono vicino a un nome, come «Achille piè veloce».", "Scrivi chi descrivono.", "Chiediti perché servivano a chi raccontava a memoria."] },
        ],
        errori_tipici: [
          { id: "eneide-omero", errore: "Attribuire l'Eneide a Omero", esempio: "L'Eneide è di Omero e racconta Enea.", come_riconoscerlo: "L'Eneide è collegata a Omero o alla lingua greca.", spiegazione: "Omero è legato a Iliade e Odissea, in greco. L'Eneide l'ha scritta Virgilio, in latino, al tempo di Augusto." },
          { id: "iliade-odissea", errore: "Scambiare Iliade e Odissea", esempio: "Nell'Iliade Ulisse torna a Itaca.", come_riconoscerlo: "Il ritorno di Ulisse è messo nell'Iliade, o l'ira di Achille nell'Odissea.", spiegazione: "L'Iliade racconta la guerra di Troia e l'ira di Achille. L'Odissea racconta il viaggio di ritorno di Odisseo, cioè Ulisse." },
        ],
        parole_chiave: ["mito", "epica", "iliade", "odissea", "eneide", "omero", "virgilio", "epiteto"],
      },
      {
        id: "it1-poesia-memoria",
        titolo: "Prime poesie: verso, strofa, rima e poesie a memoria",
        prerequisiti: [],
        strategie: [
          { nome: "Una strofa alla volta", quando: "Quando devi imparare una poesia a memoria.", passi: ["Leggi tutta la poesia a voce due volte.", "Ripeti la prima strofa senza guardare.", "Aggiungi una strofa e ripeti dall'inizio.", "Ripeti il giorno dopo prima di rileggere."] },
          { nome: "Caccia alla rima", quando: "Quando devi trovare lo schema delle rime.", passi: ["Leggi l'ultima parola di ogni verso.", "Dai la stessa lettera alle parole che finiscono uguali.", "Scrivi lo schema, per esempio ABAB."] },
        ],
        errori_tipici: [
          { id: "verso-frase", errore: "Confondere verso e frase", esempio: "Contare i versi contando i punti.", come_riconoscerlo: "Il numero dei versi coincide con il numero delle frasi e non con le righe.", spiegazione: "Il verso è una riga della poesia, anche se la frase continua sotto. Una frase può stare su tre versi." },
        ],
        parole_chiave: ["poesia", "verso", "strofa", "rima", "a memoria", "schema delle rime"],
      },
    ],
    storia: [
      {
        id: "st1-fine-impero",
        titolo: "Il crollo dell'Impero romano d'Occidente e i regni romano-barbarici",
        prerequisiti: [],
        strategie: [
          { nome: "Causa → fatto → conseguenza", quando: "Quando devi spiegare perché è successo un evento.", passi: ["Scrivi il fatto al centro.", "A sinistra elenca le cause.", "A destra elenca le conseguenze.", "Collega con frecce e parole come «perciò», «quindi»."] },
          { nome: "Linea del tempo", quando: "Quando devi ricordare l'ordine degli eventi.", passi: ["Disegna una linea con i secoli.", "Metti le date principali.", "Scrivi sotto ogni data una parola chiave."] },
        ],
        errori_tipici: [
          { id: "secolo-anno", errore: "Sbagliare il secolo di una data", esempio: "Il 476 è il IV secolo.", come_riconoscerlo: "Il secolo è stato preso dalle prime cifre della data.", spiegazione: "Il I secolo va dall'anno 1 al 100, il II dal 101 al 200. Quindi gli anni 4xx sono nel V secolo: il 476 è V secolo." },
          { id: "caduta-improvvisa", errore: "Pensare che l'Impero sia caduto in un giorno", esempio: "Nel 476 i barbari distruggono Roma e l'Impero finisce.", come_riconoscerlo: "La fine dell'Impero ha una sola causa e succede tutta in un anno.", spiegazione: "Il 476 è una data simbolo: Odoacre depone l'ultimo imperatore. Prima c'erano stati secoli di crisi economica, militare e politica." },
        ],
        parole_chiave: ["impero romano", "476", "barbari", "odoacre", "regni romano-barbarici", "invasioni"],
      },
      {
        id: "st1-alto-medioevo",
        titolo: "Alto Medioevo: Bizantini, Longobardi, Islam e Carlo Magno",
        prerequisiti: ["st1-fine-impero"],
        strategie: [
          { nome: "Confronto tra periodi", quando: "Quando devi confrontare popoli o imperi.", passi: ["Fai una tabella con le stesse voci: territorio, capo, religione, economia.", "Compila una colonna per ogni popolo.", "Sottolinea le differenze."] },
          { nome: "Causa → fatto → conseguenza", quando: "Quando studi la nascita del Sacro Romano Impero.", passi: ["Scrivi il fatto: incoronazione dell'800.", "Cerca le cause: alleanza con il papa, conquiste dei Franchi.", "Cerca le conseguenze."] },
        ],
        errori_tipici: [
          { id: "medioevo-tutto-uguale", errore: "Trattare il Medioevo come un periodo tutto uguale", esempio: "Nel Medioevo c'erano i Comuni e Carlo Magno insieme.", come_riconoscerlo: "Fatti di secoli diversi sono messi nello stesso momento.", spiegazione: "Il Medioevo dura circa mille anni, dal 476 al 1492. Carlo Magno è dell'800, i Comuni nascono dopo il Mille: tre secoli dopo." },
        ],
        parole_chiave: ["bizantini", "giustiniano", "longobardi", "maometto", "islam", "franchi", "carlo magno", "sacro romano impero"],
      },
      {
        id: "st1-feudalesimo",
        titolo: "Feudalesimo e sistema curtense",
        prerequisiti: ["st1-alto-medioevo"],
        strategie: [
          { nome: "Piramide sociale", quando: "Quando devi spiegare chi comanda su chi.", passi: ["Disegna una piramide.", "In alto il re o l'imperatore, poi vassalli, valvassori, valvassini.", "In basso servi della gleba e contadini.", "Scrivi cosa si scambiano: terra contro fedeltà."] },
        ],
        errori_tipici: [
          { id: "feudo-proprieta", errore: "Pensare che il feudo fosse proprietà del vassallo", esempio: "Il vassallo compra il feudo dal re.", come_riconoscerlo: "Il feudo è comprato o posseduto per sempre.", spiegazione: "Il feudo era una concessione in cambio di fedeltà e aiuto militare. Solo con il Capitolare di Quierzy (877) diventa ereditario per i grandi feudi." },
        ],
        parole_chiave: ["feudalesimo", "feudo", "vassallo", "valvassore", "servi della gleba", "curtis", "omaggio"],
      },
      {
        id: "st1-comuni",
        titolo: "La rinascita dopo il Mille, i Comuni, Impero e Chiesa, le crociate",
        prerequisiti: ["st1-feudalesimo"],
        strategie: [
          { nome: "Causa → fatto → conseguenza", quando: "Quando spieghi la nascita dei Comuni.", passi: ["Cause: più cibo, più persone, più commerci.", "Fatto: i cittadini si governano da sé.", "Conseguenze: scontri con l'imperatore, Lega lombarda."] },
          { nome: "Linea del tempo", quando: "Quando ordini crociate e lotte tra papa e imperatore.", passi: ["Segna la lotta per le investiture e il 1122.", "Segna le crociate dal 1096.", "Segna Legnano 1176."] },
        ],
        errori_tipici: [
          { id: "comune-oggi", errore: "Confondere il Comune medievale con il Comune di oggi", esempio: "Il Comune medievale era un ufficio dello Stato italiano.", come_riconoscerlo: "Il Comune medievale è descritto come parte di uno Stato.", spiegazione: "Il Comune medievale era una città che si governava da sola, con consoli e podestà. L'Italia unita nasce solo nel 1861." },
        ],
        parole_chiave: ["comuni", "rinascita", "mercanti", "crociate", "investiture", "barbarossa", "lega lombarda", "borghesia"],
      },
      {
        id: "st1-crisi-trecento",
        titolo: "Crisi del Trecento, peste nera, monarchie nazionali e Signorie",
        prerequisiti: ["st1-comuni"],
        strategie: [
          { nome: "Causa → fatto → conseguenza", quando: "Quando studi la peste e la crisi del Trecento.", passi: ["Scrivi le cause: carestie, commerci, scarsa igiene.", "Scrivi il fatto: la peste del 1348.", "Scrivi le conseguenze: meno popolazione, rivolte, salari più alti."] },
          { nome: "Confronto tra periodi", quando: "Quando confronti Comune e Signoria.", passi: ["Chi comanda in ciascuno?", "Come si sceglie chi comanda?", "Cosa cambia per i cittadini?"] },
        ],
        errori_tipici: [
          { id: "signoria-comune", errore: "Confondere Signoria e Comune", esempio: "Nella Signoria i cittadini eleggono i consoli.", come_riconoscerlo: "Nella Signoria il potere è descritto come collettivo.", spiegazione: "Nel Comune governano magistrati eletti. Nella Signoria il potere passa a un signore e alla sua famiglia, come i Medici a Firenze." },
        ],
        parole_chiave: ["peste nera", "1348", "crisi", "monarchie nazionali", "guerra dei cent'anni", "signorie", "principati"],
      },
    ],
    geografia: [
      {
        id: "ge1-strumenti",
        titolo: "Gli strumenti della geografia: carte, scala, coordinate",
        prerequisiti: [],
        strategie: [
          { nome: "Leggi la scala", quando: "Quando devi trovare una distanza vera su una carta.", passi: ["Misura la distanza sulla carta in centimetri.", "Moltiplica per il numero della scala.", "Trasforma il risultato in metri o chilometri."] },
          { nome: "Prima la latitudine", quando: "Quando devi trovare un punto con le coordinate.", passi: ["Trova il parallelo: latitudine nord o sud.", "Trova il meridiano: longitudine est o ovest.", "Il punto è dove si incrociano."] },
        ],
        errori_tipici: [
          { id: "scala-calcolo", errore: "Leggere male la scala", esempio: "Scala 1:100 000, 1 cm = 100 m", come_riconoscerlo: "La distanza vera è dieci o cento volte troppo piccola o troppo grande.", spiegazione: "100 000 cm sono 1000 m, cioè 1 km. Togli due zeri per i metri e altri tre per i chilometri." },
          { id: "latitudine-longitudine", errore: "Scambiare latitudine e longitudine", esempio: "La latitudine si misura dal meridiano di Greenwich.", come_riconoscerlo: "Paralleli e meridiani sono scambiati.", spiegazione: "La latitudine si conta dall'Equatore, verso nord o sud, lungo i paralleli. La longitudine si conta da Greenwich, verso est o ovest." },
        ],
        parole_chiave: ["carta geografica", "scala", "legenda", "latitudine", "longitudine", "paralleli", "meridiani"],
      },
      {
        id: "ge1-italia-fisica",
        titolo: "Italia fisica: monti, pianure, fiumi, laghi e mari",
        prerequisiti: ["ge1-strumenti"],
        strategie: [
          { nome: "Disegna la cartina a memoria", quando: "Quando studi monti, fiumi e laghi d'Italia.", passi: ["Disegna lo stivale semplice.", "Aggiungi Alpi e Appennini.", "Aggiungi i fiumi principali e i laghi.", "Controlla sull'atlante cosa manca."] },
        ],
        errori_tipici: [
          { id: "fiume-piu-lungo", errore: "Indicare il Tevere come fiume più lungo d'Italia", esempio: "Il fiume più lungo è il Tevere.", come_riconoscerlo: "Il primato è dato a un fiume diverso dal Po.", spiegazione: "Il Po è lungo circa 652 km e attraversa la Pianura Padana. Il Tevere, circa 405 km, è il terzo dopo il Po e l'Adige." },
          { id: "lago-piu-grande", errore: "Indicare il Lago Maggiore come lago più grande", esempio: "Il lago più grande d'Italia è il Maggiore.", come_riconoscerlo: "Il primato è dato a un lago diverso dal Garda.", spiegazione: "Il nome inganna: il lago più esteso è il Garda. Il Maggiore viene secondo." },
        ],
        parole_chiave: ["alpi", "appennini", "pianura padana", "po", "lago di garda", "mari", "vulcani", "isole"],
      },
      {
        id: "ge1-clima-ambienti",
        titolo: "Clima e ambienti d'Italia e d'Europa",
        prerequisiti: ["ge1-italia-fisica"],
        strategie: [
          { nome: "Fattori del clima", quando: "Quando devi spiegare perché un posto ha un certo clima.", passi: ["Guarda la latitudine.", "Guarda l'altitudine.", "Guarda la distanza dal mare e i venti."] },
        ],
        errori_tipici: [
          { id: "tempo-clima", errore: "Confondere tempo meteorologico e clima", esempio: "Oggi a Milano il clima è piovoso.", come_riconoscerlo: "Si parla di clima per un giorno o per pochi giorni.", spiegazione: "Il tempo è quello di oggi. Il clima è la media di almeno trent'anni. Una giornata di sole a Londra non cambia il suo clima." },
        ],
        parole_chiave: ["clima", "fattori climatici", "ambiente", "mediterraneo", "alpino", "temperature", "precipitazioni"],
      },
      {
        id: "ge1-regioni-italia",
        titolo: "Le regioni d'Italia, i capoluoghi e le città",
        prerequisiti: ["ge1-italia-fisica"],
        strategie: [
          { nome: "Nord, Centro, Sud e isole", quando: "Quando devi imparare regioni e capoluoghi.", passi: ["Dividi le regioni in quattro gruppi.", "Impara un gruppo alla volta con il capoluogo.", "Interrogati a voce con la cartina coperta."] },
        ],
        errori_tipici: [
          { id: "capoluogo-citta-grande", errore: "Pensare che il capoluogo sia sempre la città più grande", esempio: "Il capoluogo dell'Abruzzo è Pescara.", come_riconoscerlo: "Al posto del capoluogo c'è la città più popolosa della regione.", spiegazione: "Pescara è la città più popolosa dell'Abruzzo, ma il capoluogo è L'Aquila. Lo stesso succede in Calabria con Catanzaro e Reggio." },
          { id: "regioni-statuto-speciale", errore: "Sbagliare il numero delle regioni a statuto speciale", esempio: "Le regioni a statuto speciale sono tre.", come_riconoscerlo: "L'elenco non ha cinque regioni.", spiegazione: "Sono cinque: Valle d'Aosta, Trentino-Alto Adige, Friuli-Venezia Giulia, Sicilia e Sardegna. Le regioni in tutto sono venti." },
        ],
        parole_chiave: ["regioni", "capoluogo", "provincia", "statuto speciale", "città", "comuni"],
      },
    ],
    scienze: [
      {
        id: "sc1-metodo-scientifico",
        titolo: "Il metodo scientifico",
        prerequisiti: [],
        strategie: [
          { nome: "Le fasi in ordine", quando: "Quando devi descrivere o progettare un esperimento.", passi: ["Osserva e fai una domanda.", "Scrivi un'ipotesi.", "Fai l'esperimento.", "Analizza i dati e scrivi la conclusione."] },
          { nome: "Cambia una cosa sola", quando: "Quando progetti un esperimento.", passi: ["Scegli la variabile da cambiare.", "Tieni uguale tutto il resto.", "Misura cosa cambia."] },
        ],
        errori_tipici: [
          { id: "piu-variabili", errore: "Cambiare più cose insieme in un esperimento", esempio: "Una pianta al sole con acqua, una al buio senza acqua.", come_riconoscerlo: "Tra i gruppi cambiano due o più condizioni.", spiegazione: "Se la pianta al buio secca, non sai se è colpa del buio o dell'acqua. Cambiando una cosa sola sai cosa ha causato la differenza." },
          { id: "ipotesi-conclusione", errore: "Confondere ipotesi e conclusione", esempio: "Ipotesi: le piante al buio crescono meno, perché l'ho visto.", come_riconoscerlo: "L'ipotesi riporta un risultato già misurato.", spiegazione: "L'ipotesi è una previsione da controllare prima dell'esperimento. La conclusione arriva dopo, dai dati." },
        ],
        parole_chiave: ["metodo scientifico", "ipotesi", "esperimento", "osservazione", "variabile", "conclusione"],
      },
      {
        id: "sc1-materia-stati",
        titolo: "La materia e i suoi stati",
        prerequisiti: ["sc1-metodo-scientifico"],
        strategie: [
          { nome: "Disegna le particelle", quando: "Quando devi spiegare solido, liquido e gas.", passi: ["Nel solido disegna palline vicine e ordinate.", "Nel liquido vicine ma disordinate.", "Nel gas lontane e sparse."] },
        ],
        errori_tipici: [
          { id: "evaporazione-ebollizione", errore: "Confondere evaporazione ed ebollizione", esempio: "L'acqua evapora solo a 100 °C.", come_riconoscerlo: "Si dice che un liquido evapora solo alla temperatura di ebollizione.", spiegazione: "I panni stesi si asciugano anche a 20 °C: è evaporazione, solo in superficie. L'ebollizione avviene in tutto il liquido, a 100 °C per l'acqua al livello del mare." },
          { id: "massa-cambiamento-stato", errore: "Pensare che la massa cambi nei passaggi di stato", esempio: "Il ghiaccio che si scioglie pesa meno.", come_riconoscerlo: "Dopo un passaggio di stato la massa è diversa.", spiegazione: "Metti un cubetto in un sacchetto chiuso sulla bilancia: quando si scioglie la bilancia segna lo stesso. Cambia la disposizione delle particelle, non quante sono." },
        ],
        parole_chiave: ["materia", "solido", "liquido", "gassoso", "fusione", "evaporazione", "condensazione", "massa"],
      },
      {
        id: "sc1-calore-temperatura",
        titolo: "Calore e temperatura",
        prerequisiti: ["sc1-materia-stati"],
        strategie: [
          { nome: "Dal caldo al freddo", quando: "Quando devi capire dove va il calore.", passi: ["Trova il corpo più caldo.", "Il calore passa da lì a quello più freddo.", "Si ferma quando le temperature sono uguali."] },
        ],
        errori_tipici: [
          { id: "calore-temperatura", errore: "Confondere calore e temperatura", esempio: "Una vasca di acqua tiepida ha meno calore di una tazza bollente.", come_riconoscerlo: "Calore e temperatura sono usati come la stessa cosa.", spiegazione: "La temperatura dice quanto è caldo un corpo. Il calore è energia che passa. Una vasca tiepida può cedere molta più energia di una tazza bollente, perché ha molta più acqua." },
          { id: "freddo-passa", errore: "Pensare che il freddo passi da un corpo all'altro", esempio: "Il ghiaccio passa il freddo alla bibita.", come_riconoscerlo: "Si parla di freddo che si trasferisce.", spiegazione: "Passa solo il calore, dal più caldo al più freddo. La bibita si raffredda perché cede calore al ghiaccio." },
        ],
        parole_chiave: ["calore", "temperatura", "termometro", "conduzione", "convezione", "irraggiamento", "dilatazione"],
      },
      {
        id: "sc1-cellula",
        titolo: "La cellula",
        prerequisiti: ["sc1-metodo-scientifico"],
        strategie: [
          { nome: "La cellula come una città", quando: "Quando devi ricordare gli organuli.", passi: ["Il nucleo è il municipio con le istruzioni.", "I mitocondri sono la centrale elettrica.", "La membrana è il confine con le porte.", "Disegna e scrivi accanto il compito di ognuno."] },
          { nome: "Tabella animale-vegetale", quando: "Quando confronti cellula animale e vegetale.", passi: ["Elenca le parti in comune.", "Aggiungi quelle solo vegetali: parete, cloroplasti, grande vacuolo."] },
        ],
        errori_tipici: [
          { id: "vegetale-senza-mitocondri", errore: "Pensare che le cellule vegetali non abbiano mitocondri", esempio: "La cellula vegetale ha i cloroplasti al posto dei mitocondri.", come_riconoscerlo: "I mitocondri compaiono solo nella cellula animale.", spiegazione: "Anche le piante respirano e hanno bisogno di energia di notte. Le cellule vegetali hanno sia cloroplasti sia mitocondri." },
        ],
        parole_chiave: ["cellula", "nucleo", "membrana", "citoplasma", "mitocondri", "cloroplasti", "microscopio"],
      },
      {
        id: "sc1-viventi-classificazione",
        titolo: "I viventi e la classificazione",
        prerequisiti: ["sc1-cellula"],
        strategie: [
          { nome: "Dal grande al piccolo", quando: "Quando classifichi un essere vivente.", passi: ["Parti dal regno.", "Scendi: phylum, classe, ordine, famiglia, genere, specie.", "Per ogni gradino scrivi la caratteristica che usi."] },
        ],
        errori_tipici: [
          { id: "balena-pesce", errore: "Classificare per l'ambiente invece che per le caratteristiche", esempio: "La balena è un pesce.", come_riconoscerlo: "Un animale è messo in una classe solo per dove vive o come si muove.", spiegazione: "La balena respira con i polmoni e allatta i piccoli: è un mammifero. Anche il pipistrello vola ma è un mammifero, non un uccello." },
        ],
        parole_chiave: ["viventi", "classificazione", "regni", "specie", "vertebrati", "invertebrati", "mammiferi"],
      },
      {
        id: "sc1-piante",
        titolo: "Le piante e la fotosintesi",
        prerequisiti: ["sc1-cellula"],
        strategie: [
          { nome: "Cosa entra, cosa esce", quando: "Quando devi spiegare la fotosintesi.", passi: ["Entrano acqua, anidride carbonica e luce.", "Escono zuccheri e ossigeno.", "Scrivi dove succede: nelle foglie, nei cloroplasti."] },
        ],
        errori_tipici: [
          { id: "piante-cibo-terreno", errore: "Pensare che le piante prendano il cibo dal terreno", esempio: "La pianta si nutre di terra attraverso le radici.", come_riconoscerlo: "Il nutrimento della pianta viene tutto dal suolo.", spiegazione: "Un albero di una tonnellata non lascia una buca da una tonnellata. La sostanza viene soprattutto dall'anidride carbonica dell'aria, con la fotosintesi." },
        ],
        parole_chiave: ["pianta", "radice", "fusto", "foglia", "fotosintesi", "clorofilla", "fiore"],
      },
    ],
    inglese: [
      {
        id: "en1-to-be-have-got",
        titolo: "To be e have got",
        prerequisiti: [],
        strategie: [
          { nome: "Chi è o cosa ha?", quando: "Quando devi scegliere tra to be e have got.", passi: ["Se descrivi età, stato, nazionalità usi to be.", "Se parli di cose che possiedi usi have got.", "Controlla la forma: I am, she is, they are."] },
        ],
        errori_tipici: [
          { id: "have-eta", errore: "Usare have per l'età", esempio: "I have got 12 years.", come_riconoscerlo: "L'età è espressa con have o have got.", spiegazione: "In inglese l'età si dice con to be: «I am 12». L'italiano dice «ho 12 anni», ma l'inglese dice «sono 12»." },
          { id: "has-got-terza-persona", errore: "Usare have got con he, she, it", esempio: "She have got a cat.", come_riconoscerlo: "Con he, she, it c'è have invece di has.", spiegazione: "Con la terza persona singolare la forma è has: «She has got a cat»." },
        ],
        parole_chiave: ["to be", "have got", "i am", "she is", "has got", "short answers"],
      },
      {
        id: "en1-present-simple",
        titolo: "Present simple",
        prerequisiti: ["en1-to-be-have-got"],
        strategie: [
          { nome: "Parole spia del tempo", quando: "Quando devi capire se usare il present simple.", passi: ["Cerca always, usually, often, sometimes, never, every day.", "Se ci sono, è un'abitudine: present simple.", "Ricorda la -s con he, she, it."] },
          { nome: "Do o does?", quando: "Quando fai una domanda o una negativa.", passi: ["Con he, she, it usa does o doesn't.", "Con gli altri usa do o don't.", "Dopo does il verbo torna senza -s."] },
        ],
        errori_tipici: [
          { id: "terza-persona-s", errore: "Dimenticare la -s alla terza persona", esempio: "He play football every Sunday.", come_riconoscerlo: "Con he, she, it il verbo al present simple non ha -s.", spiegazione: "Con he, she, it il verbo prende la -s: «he plays». Prova a dirlo a voce: «she likes», «it rains»." },
          { id: "does-verbo-s", errore: "Lasciare la -s dopo does", esempio: "Does she likes pizza?", come_riconoscerlo: "Dopo does o doesn't il verbo ha ancora la -s.", spiegazione: "La -s si sposta su does: il verbo torna base. «Does she like pizza?», «She doesn't like pizza»." },
        ],
        parole_chiave: ["present simple", "always", "usually", "every day", "does", "doesn't", "adverbs of frequency"],
      },
      {
        id: "en1-can",
        titolo: "Can per abilità e permesso",
        prerequisiti: ["en1-present-simple"],
        strategie: [
          { nome: "Can più verbo base", quando: "Quando scrivi una frase con can.", passi: ["Scrivi il soggetto e can.", "Aggiungi il verbo senza to e senza -s.", "Per la negativa usa can't, per la domanda metti can davanti."] },
        ],
        errori_tipici: [
          { id: "can-to", errore: "Mettere to dopo can", esempio: "I can to swim.", come_riconoscerlo: "Dopo can c'è to.", spiegazione: "Can è un verbo modale: dopo viene il verbo base, senza to. «I can swim»." },
          { id: "can-s", errore: "Aggiungere la -s a can o al verbo", esempio: "She cans dance.", come_riconoscerlo: "Can o il verbo dopo hanno la -s con he, she, it.", spiegazione: "Can è uguale per tutte le persone e il verbo dopo resta base: «She can dance»." },
        ],
        parole_chiave: ["can", "can't", "ability", "permission", "abilità"],
      },
      {
        id: "en1-present-continuous",
        titolo: "Present continuous",
        prerequisiti: ["en1-to-be-have-got", "en1-present-simple"],
        strategie: [
          { nome: "Parole spia del tempo", quando: "Quando devi scegliere tra present simple e present continuous.", passi: ["Cerca now, at the moment, look!, listen!", "Se ci sono, l'azione succede adesso: present continuous.", "Scrivi be più verbo in -ing."] },
        ],
        errori_tipici: [
          { id: "continuous-senza-be", errore: "Dimenticare il verbo to be", esempio: "She reading a book now.", come_riconoscerlo: "C'è il verbo in -ing ma manca am, is o are.", spiegazione: "Il present continuous ha due pezzi: be più -ing. «She is reading a book»." },
          { id: "simple-continuous-now", errore: "Usare il present simple per un'azione di adesso", esempio: "Look! It rains.", come_riconoscerlo: "Con now o look! c'è il present simple.", spiegazione: "«Look!» dice che sta succedendo adesso: «It's raining». «It rains» vuol dire che piove di solito." },
        ],
        parole_chiave: ["present continuous", "-ing", "now", "at the moment", "look", "listen"],
      },
    ],
  },

  // ───────────────────────────────────────────── 2ª media
  2: {
    matematica: [
      {
        id: "ma2-frazioni-operazioni",
        titolo: "Operazioni con le frazioni ed espressioni",
        prerequisiti: ["ma1-frazioni-intro", "ma1-mcd-mcm", "ma1-operazioni-espressioni", "ma1-potenze"],
        strategie: [
          { nome: "Stesso denominatore prima di sommare", quando: "Quando sommi o sottrai frazioni.", passi: ["Trova il mcm dei denominatori.", "Trasforma ogni frazione con quel denominatore.", "Somma o sottrai solo i numeratori.", "Semplifica il risultato."] },
          { nome: "Semplifica in croce", quando: "Quando moltiplichi frazioni.", passi: ["Prima di moltiplicare cerca un numeratore e un denominatore con un divisore comune.", "Dividili entrambi.", "Poi moltiplica sopra per sopra e sotto per sotto."] },
          { nome: "Diviso diventa per l'inverso", quando: "Quando dividi due frazioni.", passi: ["Lascia la prima frazione com'è.", "Cambia il diviso in per.", "Capovolgi la seconda frazione e moltiplica."] },
        ],
        errori_tipici: [
          { id: "frazioni-somma-denominatori", errore: "Sommare i denominatori", esempio: "1/2 + 1/3 = 2/5", come_riconoscerlo: "Nel risultato il denominatore è la somma dei denominatori.", spiegazione: "Mezza pizza più mezza pizza fa una pizza intera, ma con questa regola 1/2 + 1/2 farebbe 2/4, cioè ancora mezza pizza. Serve lo stesso denominatore: 1/2 + 1/3 = 3/6 + 2/6 = 5/6." },
          { id: "divisione-frazioni-senza-inverso", errore: "Dividere sopra per sopra e sotto per sotto senza capovolgere", esempio: "3/4 : 1/2 = 3/8", come_riconoscerlo: "Nella divisione la seconda frazione non è stata capovolta.", spiegazione: "Quante mezze pizze stanno in 3/4 di pizza? Più di una, quindi il risultato deve essere più di 1. Con l'inverso: 3/4 × 2/1 = 3/2." },
          { id: "semplificare-somma", errore: "Semplificare dentro una somma", esempio: "(2 + 3)/2 = 3", come_riconoscerlo: "È stato semplificato un numero che sta in una somma, non in un prodotto.", spiegazione: "(2 + 3)/2 = 5/2 = 2,5, non 3. Si semplificano solo fattori, cioè numeri che moltiplicano tutto il numeratore." },
        ],
        parole_chiave: ["frazioni", "mcm", "denominatore comune", "frazione inversa", "espressione con le frazioni", "semplificare", "reciproco"],
      },
      {
        id: "ma2-problemi-frazioni",
        titolo: "Problemi con le frazioni",
        prerequisiti: ["ma2-frazioni-operazioni"],
        strategie: [
          { nome: "Dalla parte all'intero", quando: "Quando conosci il valore di una frazione e cerchi il totale.", passi: ["Disegna la barra divisa come dice il denominatore.", "Dividi il valore noto per il numeratore: trovi una parte.", "Moltiplica per il denominatore: trovi l'intero.", "Controlla rifacendo la frazione dell'intero."] },
          { nome: "Andare a ritroso", quando: "Quando il problema racconta più passaggi e chiede la quantità di partenza.", passi: ["Parti dall'ultimo dato, quello che resta alla fine.", "Fai a ogni passo l'operazione contraria.", "Arriva all'inizio.", "Rifai il racconto in avanti con il tuo numero per controllare."] },
          { nome: "Barra delle frazioni", quando: "Quando non capisci cosa chiede il problema.", passi: ["Disegna una barra per l'intero.", "Colora le parti di cui parla il testo.", "Scrivi i numeri sopra la barra."] },
        ],
        errori_tipici: [
          { id: "intero-moltiplica-frazione", errore: "Moltiplicare per la frazione quando si cerca l'intero", esempio: "I 3/5 della classe sono 15 alunni: la classe è 3/5 × 15 = 9.", come_riconoscerlo: "Si cerca il totale e il risultato è più piccolo della parte nota.", spiegazione: "Una parte della classe non può essere più grande della classe intera. Dalla parte all'intero: 15 : 3 = 5 alunni per quinto, 5 × 5 = 25." },
          { id: "frazione-del-resto", errore: "Calcolare la seconda frazione sul totale invece che sul resto", esempio: "Spende 1/2 dei soldi e poi 1/3 di quello che resta: in tutto 1/2 + 1/3.", come_riconoscerlo: "Il testo dice «del resto» o «di quello che rimane» ma la frazione è applicata al totale.", spiegazione: "1/3 del resto è 1/3 di metà, cioè 1/6 del totale. Prova con 60 €: spende 30, poi 10, non 20." },
        ],
        parole_chiave: ["problema", "frazione", "intero", "parte", "rimanente", "del resto", "quanto era"],
      },
      {
        id: "ma2-decimali-periodici",
        titolo: "Numeri decimali periodici e frazione generatrice",
        prerequisiti: ["ma2-frazioni-operazioni", "ma1-naturali-decimali"],
        strategie: [
          { nome: "Tanti 9 quante le cifre del periodo, tanti 0 quante quelle dell'antiperiodo", quando: "Quando cerchi la frazione generatrice.", passi: ["Al numeratore scrivi tutto il numero senza virgola meno la parte prima del periodo.", "Al denominatore scrivi un 9 per ogni cifra del periodo e uno 0 per ogni cifra dell'antiperiodo.", "Semplifica.", "Controlla dividendo."] },
        ],
        errori_tipici: [
          { id: "generatrice-antiperiodo", errore: "Dimenticare l'antiperiodo nella frazione generatrice", esempio: "0,1(6) = 16/99", come_riconoscerlo: "C'è un antiperiodo ma al denominatore ci sono solo 9.", spiegazione: "Prova a dividere: 16 : 99 fa 0,1616..., non 0,1666... La regola dà (16 − 1)/90 = 15/90 = 1/6, e 1 : 6 fa proprio 0,1666..." },
        ],
        parole_chiave: ["periodico", "periodo", "antiperiodo", "frazione generatrice", "decimale limitato"],
      },
      {
        id: "ma2-radice-quadrata",
        titolo: "La radice quadrata",
        prerequisiti: ["ma1-potenze", "ma1-divisibilita-primi"],
        strategie: [
          { nome: "Radice e quadrato si annullano", quando: "Quando devi controllare una radice.", passi: ["Calcola la radice.", "Eleva il risultato al quadrato.", "Deve tornare il numero di partenza."] },
          { nome: "Tra due quadrati perfetti", quando: "Quando stimi una radice non esatta.", passi: ["Trova i quadrati perfetti vicini, per esempio 49 e 64.", "La radice sta tra le loro radici, 7 e 8.", "Usa le tavole o la calcolatrice per il valore."] },
        ],
        errori_tipici: [
          { id: "radice-meta", errore: "Dividere per 2 invece di fare la radice", esempio: "√36 = 18", come_riconoscerlo: "La radice è la metà del numero.", spiegazione: "Controlla: 18 × 18 = 324, non 36. La radice di 36 è 6, perché 6 × 6 = 36." },
          { id: "radice-somma", errore: "Fare la radice di una somma termine per termine", esempio: "√(9 + 16) = 3 + 4 = 7", come_riconoscerlo: "La radice di una somma è scritta come somma di radici.", spiegazione: "√(9 + 16) = √25 = 5, non 7. La radice si distribuisce sul prodotto, non sulla somma." },
        ],
        parole_chiave: ["radice quadrata", "quadrato perfetto", "tavole numeriche", "radicando", "estrazione di radice"],
      },
      {
        id: "ma2-proporzioni",
        titolo: "Rapporti e proporzioni",
        prerequisiti: ["ma2-frazioni-operazioni"],
        strategie: [
          { nome: "Prodotto dei medi uguale prodotto degli estremi", quando: "Quando cerchi il termine incognito di una proporzione.", passi: ["Individua medi ed estremi.", "Se x è un medio, moltiplica gli estremi e dividi per l'altro medio.", "Se x è un estremo, moltiplica i medi e dividi per l'altro estremo.", "Controlla che i due prodotti siano uguali."] },
        ],
        errori_tipici: [
          { id: "proporzione-medi-estremi", errore: "Moltiplicare medi con estremi", esempio: "3 : 6 = x : 8 → x = 3 × 6 : 8", come_riconoscerlo: "Nel calcolo di x sono stati mescolati un medio e un estremo.", spiegazione: "Medi 6 e x, estremi 3 e 8: 6 × x = 3 × 8, quindi x = 4. Prova: 3 : 6 e 4 : 8 valgono entrambi 1/2." },
        ],
        parole_chiave: ["rapporto", "proporzione", "medi", "estremi", "proprietà fondamentale", "termine incognito"],
      },
      {
        id: "ma2-percentuali",
        titolo: "Percentuali, sconti e aumenti",
        prerequisiti: ["ma2-proporzioni"],
        strategie: [
          { nome: "Il 100% è il totale", quando: "Quando risolvi un problema con le percentuali.", passi: ["Trova quale numero è il 100% nel testo.", "Calcola l'1% dividendo per 100.", "Moltiplica per la percentuale richiesta."] },
          { nome: "Proporzione della percentuale", quando: "Quando non sai cosa moltiplicare e cosa dividere.", passi: ["Scrivi parte : totale = percentuale : 100.", "Metti x al posto del dato mancante.", "Risolvi la proporzione."] },
        ],
        errori_tipici: [
          { id: "percentuale-totale-sbagliato", errore: "Calcolare la percentuale sul totale che non è il 100%", esempio: "Un prezzo scontato del 20% è 64 €: prima costava 64 + 20% di 64 = 76,80 €.", come_riconoscerlo: "La percentuale è applicata al prezzo finale invece che a quello di partenza.", spiegazione: "Prova in avanti: 76,80 € scontato del 20% fa 61,44 €, non 64. Il 100% è il prezzo di prima: 64 € sono l'80%, quindi 64 : 80 × 100 = 80 €." },
          { id: "sconti-successivi-somma", errore: "Sommare due sconti successivi", esempio: "Sconto del 10% e poi del 20%: sconto totale 30%.", come_riconoscerlo: "Due percentuali in sequenza sono state sommate.", spiegazione: "Su 100 €: meno 10% fa 90 €, meno 20% di 90 fa 72 €. Lo sconto vero è 28%, perché il secondo si calcola su un prezzo già più basso." },
        ],
        parole_chiave: ["percentuale", "%", "sconto", "aumento", "prezzo", "interesse", "totale"],
      },
      {
        id: "ma2-proporzionalita",
        titolo: "Proporzionalità diretta e inversa",
        prerequisiti: ["ma2-proporzioni"],
        strategie: [
          { nome: "Raddoppia e guarda", quando: "Quando devi capire se due grandezze sono direttamente o inversamente proporzionali.", passi: ["Raddoppia una grandezza.", "Se l'altra raddoppia, è diretta.", "Se l'altra si dimezza, è inversa.", "Controlla: diretta ha rapporto costante, inversa prodotto costante."] },
        ],
        errori_tipici: [
          { id: "inversa-come-diretta", errore: "Trattare una proporzionalità inversa come diretta", esempio: "3 operai fanno un lavoro in 6 giorni, 6 operai lo fanno in 12 giorni.", come_riconoscerlo: "Più operai o più velocità danno un tempo più lungo.", spiegazione: "Più persone lavorano, meno tempo serve. Il prodotto resta uguale: 3 × 6 = 18, quindi 6 operai ci mettono 3 giorni." },
        ],
        parole_chiave: ["proporzionalità diretta", "proporzionalità inversa", "costante", "grafico", "iperbole", "tabella"],
      },
      {
        id: "ma2-aree-poligoni",
        titolo: "Aree dei poligoni ed equivalenza",
        prerequisiti: ["ma1-rette-poligoni", "ma1-misure"],
        strategie: [
          { nome: "Scomponi la figura", quando: "Quando la figura non è un poligono standard.", passi: ["Dividi la figura in rettangoli e triangoli.", "Calcola l'area di ogni pezzo.", "Somma, o sottrai i pezzi che mancano."] },
          { nome: "Formula inversa", quando: "Quando conosci l'area e cerchi un lato o un'altezza.", passi: ["Scrivi la formula dell'area.", "Metti i dati noti.", "Fai l'operazione contraria per trovare il dato mancante."] },
        ],
        errori_tipici: [
          { id: "area-perimetro", errore: "Confondere area e perimetro", esempio: "Rettangolo 3 cm × 5 cm: area = 3 + 5 + 3 + 5 = 16 cm²", come_riconoscerlo: "Per l'area sono stati sommati i lati, o per il perimetro moltiplicati.", spiegazione: "Disegna il rettangolo su quadretti da 1 cm: dentro ci sono 3 file da 5, cioè 15 quadretti. L'area è 15 cm², il perimetro, il giro del bordo, è 16 cm." },
          { id: "triangolo-senza-diviso-due", errore: "Dimenticare il diviso 2 nell'area del triangolo", esempio: "Triangolo base 6 cm, altezza 4 cm: area = 24 cm²", come_riconoscerlo: "L'area del triangolo è base per altezza senza dividere.", spiegazione: "Due triangoli uguali formano un rettangolo 6 × 4 = 24 cm². Un triangolo solo è la metà: 12 cm²." },
        ],
        parole_chiave: ["area", "superficie", "base", "altezza", "parallelogramma", "trapezio", "rombo", "equivalenza"],
      },
      {
        id: "ma2-pitagora",
        titolo: "Il teorema di Pitagora e le sue applicazioni",
        prerequisiti: ["ma2-radice-quadrata", "ma2-aree-poligoni"],
        strategie: [
          { nome: "Cerco l'ipotenusa o un cateto?", quando: "Prima di applicare il teorema di Pitagora.", passi: ["Trova l'angolo retto: l'ipotenusa è il lato opposto.", "Se cerchi l'ipotenusa, somma i quadrati dei cateti.", "Se cerchi un cateto, sottrai al quadrato dell'ipotenusa il quadrato dell'altro cateto.", "Fai la radice e controlla che l'ipotenusa sia il lato più lungo."] },
          { nome: "Terne pitagoriche", quando: "Quando i numeri sembrano familiari.", passi: ["Ricorda 3-4-5, 5-12-13, 8-15-17.", "Controlla se i lati sono multipli di una terna.", "Usa la terna per verificare il risultato."] },
        ],
        errori_tipici: [
          { id: "pitagora-cateto-somma", errore: "Sommare i quadrati quando si cerca un cateto", esempio: "Ipotenusa 10 cm, cateto 6 cm: altro cateto = √(100 + 36) ≈ 11,66 cm", come_riconoscerlo: "Si cerca un cateto e il risultato è più lungo dell'ipotenusa.", spiegazione: "L'ipotenusa è sempre il lato più lungo, e qui il cateto verrebbe più lungo di lei. Per il cateto si sottrae: √(100 − 36) = √64 = 8 cm." },
          { id: "pitagora-radice-dimenticata", errore: "Dimenticare la radice alla fine", esempio: "Cateti 3 cm e 4 cm: ipotenusa = 25 cm", come_riconoscerlo: "Il risultato è la somma dei quadrati, senza radice.", spiegazione: "Un lato di 25 cm con cateti di 3 e 4 cm non chiude il triangolo. 25 è l'area del quadrato sull'ipotenusa, il lato è √25 = 5 cm." },
        ],
        parole_chiave: ["pitagora", "ipotenusa", "cateto", "triangolo rettangolo", "terne pitagoriche", "diagonale"],
      },
    ],
    italiano: [
      {
        id: "it2-analisi-logica",
        titolo: "Analisi logica: soggetto e predicato",
        prerequisiti: ["it1-analisi-grammaticale", "it1-verbo"],
        strategie: [
          { nome: "Trova prima il verbo", quando: "Quando inizi l'analisi logica di una frase.", passi: ["Cerca il verbo coniugato: è il predicato.", "Chiediti «chi fa l'azione?» o «di chi si parla?»: è il soggetto.", "Controlla che soggetto e verbo siano d'accordo nel numero.", "Poi passa ai complementi."] },
          { nome: "Verbale o nominale?", quando: "Quando trovi il verbo essere.", passi: ["Se essere è seguito da un nome o un aggettivo che descrive il soggetto, è predicato nominale.", "Se vuol dire «stare» o «trovarsi», è predicato verbale.", "Nel nominale separa copula e parte nominale."] },
        ],
        errori_tipici: [
          { id: "soggetto-primo-nome", errore: "Prendere come soggetto il primo nome della frase", esempio: "«A Marco piace la pizza»: soggetto = Marco", come_riconoscerlo: "Il soggetto indicato è il primo nome, anche se il verbo non concorda.", spiegazione: "Prova a cambiare il numero: «A Marco piacciono le pizze». Il verbo segue «le pizze», quindi il soggetto è «la pizza» e «a Marco» è complemento di termine." },
          { id: "soggetto-sottinteso", errore: "Non vedere il soggetto sottinteso", esempio: "«Mangiamo alle otto»: soggetto assente", come_riconoscerlo: "Nella frase senza soggetto scritto viene detto che il soggetto non c'è.", spiegazione: "La desinenza -iamo dice chi fa l'azione: noi. Il soggetto c'è, è sottinteso." },
        ],
        parole_chiave: ["analisi logica", "soggetto", "predicato verbale", "predicato nominale", "copula", "sottinteso"],
      },
      {
        id: "it2-complementi",
        titolo: "Analisi logica: i complementi",
        prerequisiti: ["it2-analisi-logica"],
        strategie: [
          { nome: "La domanda del complemento", quando: "Quando devi riconoscere un complemento.", passi: ["Parti dal verbo.", "Fai la domanda: chi? che cosa? a chi? di chi? dove? quando? con chi?", "La domanda che funziona dà il nome del complemento.", "Non fidarti solo della preposizione."] },
        ],
        errori_tipici: [
          { id: "di-sempre-specificazione", errore: "Pensare che «di» introduca sempre il complemento di specificazione", esempio: "«Parliamo di sport»: complemento di specificazione", come_riconoscerlo: "Ogni complemento con «di» è chiamato di specificazione.", spiegazione: "Fai la domanda: «parliamo di che cosa? riguardo a cosa?». È complemento di argomento. La stessa preposizione introduce complementi diversi." },
          { id: "oggetto-termine", errore: "Confondere complemento oggetto e complemento di termine", esempio: "«Telefono a Luca»: complemento oggetto", come_riconoscerlo: "Un complemento con «a» è chiamato oggetto.", spiegazione: "Il complemento oggetto non ha preposizione e risponde a «chi? che cosa?». «A Luca» risponde a «a chi?»: è di termine." },
        ],
        parole_chiave: ["complemento oggetto", "complemento di termine", "specificazione", "luogo", "tempo", "mezzo", "compagnia", "agente"],
      },
      {
        id: "it2-testi",
        titolo: "Testo descrittivo, regolativo ed espositivo",
        prerequisiti: ["it1-narrativo"],
        strategie: [
          { nome: "A cosa serve il testo?", quando: "Quando devi riconoscere un tipo di testo.", passi: ["Se fa vedere com'è qualcosa, è descrittivo.", "Se dice cosa fare, è regolativo.", "Se spiega un argomento, è espositivo.", "Cerca gli indizi: aggettivi, imperativi, dati."] },
          { nome: "Dall'alto in basso", quando: "Quando scrivi una descrizione.", passi: ["Scegli un ordine: dall'alto in basso, da vicino a lontano.", "Usa i cinque sensi.", "Chiudi con un'impressione personale."] },
        ],
        errori_tipici: [
          { id: "descrizione-elenco", errore: "Fare una descrizione che è solo un elenco", esempio: "La stanza ha un letto, una sedia, un armadio, una finestra.", come_riconoscerlo: "Ci sono solo nomi uno dopo l'altro, senza aggettivi, ordine o sensi.", spiegazione: "Chi legge non vede la stanza: grande o piccola? luminosa? Una descrizione segue un ordine e usa aggettivi e sensi." },
        ],
        parole_chiave: ["testo descrittivo", "testo regolativo", "testo espositivo", "istruzioni", "ricetta", "descrizione"],
      },
      {
        id: "it2-lettera-diario",
        titolo: "Lettera, diario e testo autobiografico",
        prerequisiti: ["it1-narrativo"],
        strategie: [
          { nome: "Le parti della lettera", quando: "Quando scrivi una lettera.", passi: ["In alto luogo e data.", "Poi il saluto iniziale.", "Il corpo, con le cose da dire in ordine.", "Saluto finale e firma."] },
        ],
        errori_tipici: [
          { id: "diario-senza-data", errore: "Scrivere una pagina di diario senza data e senza emozioni", esempio: "Oggi sono andato a scuola. Poi a casa. Poi a calcio.", come_riconoscerlo: "Manca la data e ci sono solo fatti, senza pensieri o sentimenti.", spiegazione: "Il diario lo scrivi in prima persona per te: data, fatti e soprattutto cosa hai provato. Senza emozioni diventa una cronaca." },
        ],
        parole_chiave: ["lettera", "diario", "autobiografia", "prima persona", "data", "destinatario"],
      },
      {
        id: "it2-poesia",
        titolo: "Poesia e figure retoriche, poesie a memoria",
        prerequisiti: ["it1-poesia-memoria"],
        strategie: [
          { nome: "Cerca il «come»", quando: "Quando devi distinguere similitudine e metafora.", passi: ["Cerca «come», «simile a», «sembra».", "Se c'è, è una similitudine.", "Se il paragone è senza «come», è una metafora."] },
          { nome: "Conta le sillabe con la sinalefe", quando: "Quando devi riconoscere il tipo di verso.", passi: ["Dividi il verso in sillabe.", "Unisci la vocale finale di una parola con quella iniziale della successiva.", "Conta fino all'ultimo accento e aggiungi uno."] },
          { nome: "Una strofa alla volta", quando: "Quando devi imparare una poesia a memoria.", passi: ["Leggi a voce tutta la poesia.", "Copia a mano la prima strofa.", "Ripetila senza guardare e aggiungi la successiva.", "Ripassa il giorno dopo."] },
        ],
        errori_tipici: [
          { id: "similitudine-metafora", errore: "Confondere similitudine e metafora", esempio: "«Sei un leone»: similitudine", come_riconoscerlo: "Un paragone senza «come» è chiamato similitudine.", spiegazione: "La similitudine ha il «come»: «sei forte come un leone». La metafora toglie il «come» e dice direttamente «sei un leone»." },
          { id: "sillabe-senza-sinalefe", errore: "Contare le sillabe senza sinalefe", esempio: "«Mi ritrovai per una selva oscura» contato come 12 sillabe", come_riconoscerlo: "Il conteggio dà troppe sillabe per un verso che dovrebbe essere un endecasillabo.", spiegazione: "In «selva oscura» la a finale e la o iniziale si leggono in una sillaba sola: è la sinalefe. Con la sinalefe il verso di Dante ha 11 sillabe: è un endecasillabo." },
        ],
        parole_chiave: ["poesia", "figure retoriche", "similitudine", "metafora", "personificazione", "anafora", "endecasillabo", "a memoria"],
      },
      {
        id: "it2-letteratura",
        titolo: "Letteratura dalle origini al Seicento e Settecento",
        prerequisiti: [],
        strategie: [
          { nome: "Autore nel suo tempo", quando: "Quando studi un autore.", passi: ["Metti l'autore sulla linea del tempo.", "Scrivi due fatti storici di quel periodo.", "Collega le opere principali ai temi del periodo."] },
        ],
        errori_tipici: [
          { id: "autori-secoli", errore: "Mettere un autore nel secolo che non è il suo", esempio: "Dante è un autore del Cinquecento.", come_riconoscerlo: "Autori e secoli non corrispondono sulla linea del tempo.", spiegazione: "Dante vive tra Duecento e Trecento (1265-1321), come Petrarca e Boccaccio nel Trecento. Ariosto e Machiavelli sono del Cinquecento." },
        ],
        parole_chiave: ["letteratura", "dante", "divina commedia", "petrarca", "boccaccio", "stilnovo", "goldoni", "illuminismo"],
      },
    ],
    storia: [
      {
        id: "st2-umanesimo-scoperte",
        titolo: "Umanesimo, Rinascimento e scoperte geografiche",
        prerequisiti: ["st1-crisi-trecento"],
        strategie: [
          { nome: "Causa → fatto → conseguenza", quando: "Quando studi le scoperte geografiche.", passi: ["Cause: ricerca di spezie, nuove navi e strumenti, Turchi a Costantinopoli.", "Fatto: Colombo nel 1492.", "Conseguenze: imperi coloniali, scambio colombiano, conquista degli Aztechi e degli Inca."] },
          { nome: "Linea del tempo", quando: "Quando ordini i viaggi di esplorazione.", passi: ["Segna Dias 1488, Colombo 1492, Vasco da Gama 1498, Magellano 1519-1522.", "Scrivi per ognuno la direzione del viaggio."] },
        ],
        errori_tipici: [
          { id: "colombo-india", errore: "Pensare che Colombo sapesse di aver trovato un nuovo continente", esempio: "Colombo scopre l'America e la chiama America.", come_riconoscerlo: "Colombo è descritto come consapevole del nuovo continente.", spiegazione: "Colombo era convinto di essere arrivato in Asia, alle Indie. Il nome America viene da Amerigo Vespucci, che capì che era un continente nuovo." },
        ],
        parole_chiave: ["umanesimo", "rinascimento", "scoperte geografiche", "colombo", "1492", "conquistadores", "stampa"],
      },
      {
        id: "st2-riforma",
        titolo: "Riforma protestante e Controriforma",
        prerequisiti: ["st2-umanesimo-scoperte"],
        strategie: [
          { nome: "Confronto tra periodi", quando: "Quando confronti cattolici e protestanti.", passi: ["Fai una tabella: salvezza, Bibbia, sacramenti, ruolo del papa.", "Compila la colonna cattolica e quella protestante.", "Sottolinea le differenze principali."] },
        ],
        errori_tipici: [
          { id: "riforma-controriforma", errore: "Confondere Riforma e Controriforma", esempio: "Con la Controriforma Lutero si separa dalla Chiesa.", come_riconoscerlo: "Lutero è associato alla Controriforma o il Concilio di Trento alla Riforma.", spiegazione: "La Riforma è quella di Lutero, dal 1517. La Controriforma è la risposta della Chiesa cattolica, con il Concilio di Trento (1545-1563)." },
        ],
        parole_chiave: ["riforma", "lutero", "1517", "indulgenze", "calvino", "controriforma", "concilio di trento"],
      },
      {
        id: "st2-seicento",
        titolo: "Il Seicento: assolutismo, rivoluzione scientifica e rivoluzione inglese",
        prerequisiti: ["st2-riforma"],
        strategie: [
          { nome: "Confronto tra periodi", quando: "Quando confronti Francia e Inghilterra nel Seicento.", passi: ["Chi ha il potere in Francia? Il re assoluto, Luigi XIV.", "Chi ha il potere in Inghilterra dopo il 1689? Re e Parlamento.", "Scrivi la differenza in una frase."] },
        ],
        errori_tipici: [
          { id: "assolutismo-costituzionale", errore: "Confondere monarchia assoluta e monarchia parlamentare", esempio: "Luigi XIV doveva chiedere il permesso al Parlamento.", come_riconoscerlo: "Il re assoluto è descritto con limiti al suo potere.", spiegazione: "«Lo Stato sono io»: Luigi XIV non aveva limiti. In Inghilterra, dopo la Gloriosa rivoluzione e il Bill of Rights, il re doveva rispettare il Parlamento." },
        ],
        parole_chiave: ["seicento", "assolutismo", "luigi xiv", "galileo", "rivoluzione scientifica", "parlamento", "guerra dei trent'anni"],
      },
      {
        id: "st2-rivoluzioni",
        titolo: "Illuminismo, rivoluzione americana, francese e industriale",
        prerequisiti: ["st2-seicento"],
        strategie: [
          { nome: "Causa → fatto → conseguenza", quando: "Quando studi una rivoluzione.", passi: ["Scrivi le cause economiche, sociali e politiche.", "Scrivi i fatti principali con le date.", "Scrivi le conseguenze di breve e di lungo periodo."] },
          { nome: "Linea del tempo", quando: "Quando ordini le fasi della rivoluzione francese.", passi: ["Segna 1789 presa della Bastiglia.", "Segna 1792 la repubblica e 1793-94 il Terrore.", "Segna 1799 il colpo di Stato di Napoleone."] },
        ],
        errori_tipici: [
          { id: "rivoluzione-industriale-francia", errore: "Mettere la prima rivoluzione industriale in Francia", esempio: "La rivoluzione industriale inizia in Francia con la Bastiglia.", come_riconoscerlo: "Rivoluzione industriale e rivoluzione francese sono confuse.", spiegazione: "La rivoluzione industriale inizia in Inghilterra a metà del Settecento, con la macchina a vapore e il tessile. La rivoluzione francese è politica, dal 1789." },
        ],
        parole_chiave: ["illuminismo", "rivoluzione americana", "rivoluzione francese", "1789", "bastiglia", "rivoluzione industriale", "macchina a vapore"],
      },
      {
        id: "st2-napoleone-risorgimento",
        titolo: "Napoleone, Restaurazione e Risorgimento",
        prerequisiti: ["st2-rivoluzioni"],
        strategie: [
          { nome: "Linea del tempo", quando: "Quando ordini le tappe dell'unità d'Italia.", passi: ["Segna i moti del 1820-21 e 1830-31.", "Segna il 1848 e la prima guerra d'indipendenza.", "Segna il 1859, la spedizione dei Mille nel 1860 e il 1861.", "Aggiungi Veneto 1866 e Roma 1870."] },
          { nome: "Confronto tra periodi", quando: "Quando confronti i protagonisti del Risorgimento.", passi: ["Fai una tabella con Mazzini, Garibaldi e Cavour.", "Per ognuno scrivi l'idea di Italia e il metodo.", "Sottolinea cosa li divideva."] },
        ],
        errori_tipici: [
          { id: "unita-1870", errore: "Confondere la data dell'unità con quella di Roma capitale", esempio: "L'Italia si unisce nel 1870.", come_riconoscerlo: "Il 1870 è dato come data della proclamazione del Regno d'Italia.", spiegazione: "Il Regno d'Italia nasce il 17 marzo 1861. Nel 1870 si aggiunge Roma, che diventa capitale nel 1871." },
        ],
        parole_chiave: ["napoleone", "congresso di vienna", "restaurazione", "risorgimento", "mazzini", "garibaldi", "cavour", "1861"],
      },
    ],
    geografia: [
      {
        id: "ge2-europa-fisica",
        titolo: "Europa: territorio, rilievi, fiumi e climi",
        prerequisiti: ["ge1-clima-ambienti"],
        strategie: [
          { nome: "Disegna la cartina a memoria", quando: "Quando studi l'Europa fisica.", passi: ["Disegna il contorno semplice dell'Europa.", "Aggiungi le catene montuose principali.", "Aggiungi i fiumi e i mari.", "Controlla sull'atlante cosa manca."] },
        ],
        errori_tipici: [
          { id: "confini-europa", errore: "Sbagliare i confini dell'Europa a est", esempio: "L'Europa finisce al confine tra Polonia e Russia.", come_riconoscerlo: "Il confine orientale non segue gli Urali.", spiegazione: "Per convenzione l'Europa arriva agli Urali, al fiume Ural, al Caspio e al Caucaso. La Russia sta in parte in Europa e in parte in Asia." },
          { id: "fiume-piu-lungo-europa", errore: "Indicare il Danubio come fiume più lungo d'Europa", esempio: "Il fiume più lungo d'Europa è il Danubio.", come_riconoscerlo: "Il primato non è dato al Volga.", spiegazione: "Il Volga, in Russia, è lungo circa 3500 km. Il Danubio, circa 2850 km, è il secondo." },
        ],
        parole_chiave: ["europa", "urali", "alpi", "danubio", "volga", "penisola", "clima continentale"],
      },
      {
        id: "ge2-unione-europea",
        titolo: "L'Unione europea e le sue istituzioni",
        prerequisiti: [],
        strategie: [
          { nome: "Chi fa cosa", quando: "Quando studi le istituzioni dell'Unione europea.", passi: ["Parlamento europeo: eletto dai cittadini, fa le leggi con il Consiglio.", "Commissione: propone le leggi e le fa applicare.", "Consiglio europeo: i capi di Stato e di governo danno la direzione.", "Scrivi una riga per ognuno con la sede."] },
          { nome: "Linea del tempo", quando: "Quando ordini le tappe dell'integrazione europea.", passi: ["Segna 1951 CECA, 1957 Trattati di Roma.", "Segna 1992 Maastricht e 2002 l'euro.", "Segna l'uscita del Regno Unito nel 2020."] },
        ],
        errori_tipici: [
          { id: "europa-unione-europea", errore: "Confondere Europa e Unione europea", esempio: "La Svizzera e la Norvegia sono nell'Unione europea.", come_riconoscerlo: "Tutti gli Stati europei sono messi nell'Unione europea.", spiegazione: "L'Unione europea ha 27 Stati membri. Svizzera, Norvegia e Regno Unito sono in Europa ma fuori dall'Unione." },
          { id: "consiglio-europa", errore: "Confondere Consiglio europeo e Consiglio d'Europa", esempio: "Il Consiglio d'Europa è un'istituzione dell'Unione europea.", come_riconoscerlo: "Il Consiglio d'Europa è messo tra le istituzioni dell'Unione.", spiegazione: "Il Consiglio d'Europa è un'organizzazione diversa, con 46 Stati, che si occupa di diritti umani. Il Consiglio europeo riunisce i capi dei 27 Stati dell'Unione." },
        ],
        parole_chiave: ["unione europea", "parlamento europeo", "commissione europea", "euro", "trattati", "stati membri", "cittadinanza europea"],
      },
      {
        id: "ge2-popolazione-economia",
        titolo: "Europa: popolazione, città ed economia",
        prerequisiti: ["ge2-europa-fisica"],
        strategie: [
          { nome: "Leggi il grafico", quando: "Quando trovi tabelle e grafici su popolazione ed economia.", passi: ["Leggi titolo e unità di misura.", "Trova il valore più alto e quello più basso.", "Scrivi una frase su cosa mostra."] },
        ],
        errori_tipici: [
          { id: "densita-calcolo", errore: "Calcolare la densità dividendo al contrario", esempio: "Densità = superficie : abitanti", come_riconoscerlo: "La densità ha come risultato un numero piccolissimo o km² per abitante.", spiegazione: "La densità dice quante persone ci sono in ogni km²: abitanti diviso superficie. L'Italia, 59 milioni di abitanti su circa 302 000 km², ha circa 195 abitanti per km²." },
        ],
        parole_chiave: ["popolazione", "densità", "città", "settori economici", "migrazioni", "invecchiamento"],
      },
      {
        id: "ge2-stati-europa",
        titolo: "Gli Stati d'Europa per regioni",
        prerequisiti: ["ge2-europa-fisica"],
        strategie: [
          { nome: "Scheda Stato", quando: "Quando studi uno Stato europeo.", passi: ["Capitale, lingua, forma di governo, moneta.", "Territorio e clima in due righe.", "Economia e una curiosità.", "Confronta con l'Italia."] },
        ],
        errori_tipici: [
          { id: "capitale-citta-grande", errore: "Scambiare la capitale con la città più famosa", esempio: "La capitale della Svizzera è Zurigo.", come_riconoscerlo: "La capitale è sostituita dalla città più grande o più famosa.", spiegazione: "Zurigo è la città più popolosa, ma la sede del governo svizzero è Berna. Lo stesso inganno capita con la Turchia, capitale Ankara e non Istanbul." },
        ],
        parole_chiave: ["stati europei", "capitale", "europa mediterranea", "europa centrale", "europa nordica", "europa orientale"],
      },
    ],
    scienze: [
      {
        id: "sc2-chimica",
        titolo: "Chimica di base: atomi, elementi, composti e reazioni",
        prerequisiti: ["sc1-materia-stati"],
        strategie: [
          { nome: "Mattoncini Lego", quando: "Quando devi distinguere atomo, molecola, elemento e composto.", passi: ["L'atomo è il mattoncino.", "La molecola è un gruppo di mattoncini attaccati.", "Elemento: mattoncini tutti uguali. Composto: mattoncini diversi legati."] },
          { nome: "Conta gli atomi", quando: "Quando leggi una formula o una reazione.", passi: ["Leggi i simboli: ogni lettera maiuscola è un elemento.", "Il numero piccolo dice quanti atomi.", "Controlla che a sinistra e a destra ci siano gli stessi atomi."] },
        ],
        errori_tipici: [
          { id: "miscuglio-composto", errore: "Confondere miscuglio e composto", esempio: "L'acqua salata è un composto.", come_riconoscerlo: "Una mescolanza separabile con metodi fisici è chiamata composto.", spiegazione: "Se fai evaporare l'acqua salata, il sale resta: le due sostanze si separano. In un composto, come l'acqua H₂O, gli elementi sono legati e servono reazioni chimiche per separarli." },
          { id: "massa-reazione", errore: "Pensare che in una reazione la massa sparisca", esempio: "Il legno bruciato pesa meno, quindi la massa si è distrutta.", come_riconoscerlo: "Si dice che la massa diminuisce o aumenta senza contare i gas.", spiegazione: "La massa si conserva (Lavoisier). Il legno sembra pesare meno perché anidride carbonica e vapore vanno nell'aria. In un recipiente chiuso la massa resta uguale." },
        ],
        parole_chiave: ["atomo", "molecola", "elemento", "composto", "tavola periodica", "reazione chimica", "formula", "miscuglio"],
      },
      {
        id: "sc2-corpo-movimento",
        titolo: "Corpo umano: scheletro e muscoli",
        prerequisiti: ["sc1-cellula"],
        strategie: [
          { nome: "Funzione e struttura insieme", quando: "Quando studi ossa, articolazioni e muscoli.", passi: ["Scrivi la parte.", "Scrivi a cosa serve.", "Collega la forma alla funzione, per esempio il cranio protegge il cervello."] },
        ],
        errori_tipici: [
          { id: "muscoli-spingono", errore: "Pensare che i muscoli spingano", esempio: "Il tricipite spinge il braccio per piegarlo.", come_riconoscerlo: "I muscoli sono descritti mentre spingono le ossa.", spiegazione: "I muscoli possono solo tirare, contraendosi. Per questo lavorano a coppie: il bicipite piega il braccio, il tricipite lo distende." },
        ],
        parole_chiave: ["scheletro", "ossa", "articolazioni", "muscoli", "tendini", "apparato locomotore"],
      },
      {
        id: "sc2-corpo-apparati",
        titolo: "Corpo umano: apparati digerente, respiratorio, circolatorio ed escretore",
        prerequisiti: ["sc2-corpo-movimento"],
        strategie: [
          { nome: "Segui il percorso", quando: "Quando studi un apparato.", passi: ["Disegna l'apparato con frecce.", "Segui il cibo, l'aria o il sangue passo per passo.", "Scrivi cosa succede in ogni organo."] },
        ],
        errori_tipici: [
          { id: "arterie-ossigenato", errore: "Pensare che le arterie portino sempre sangue ricco di ossigeno", esempio: "Tutte le arterie portano sangue ossigenato.", come_riconoscerlo: "Arteria e vena sono distinte solo dal tipo di sangue.", spiegazione: "Le arterie escono dal cuore, le vene ci tornano. L'arteria polmonare porta ai polmoni sangue povero di ossigeno." },
          { id: "digestione-stomaco", errore: "Pensare che la digestione avvenga tutta nello stomaco", esempio: "Il cibo viene assorbito nello stomaco.", come_riconoscerlo: "L'assorbimento è messo nello stomaco.", spiegazione: "La digestione inizia in bocca e continua nello stomaco, ma la maggior parte delle sostanze viene assorbita nell'intestino tenue, grazie ai villi." },
        ],
        parole_chiave: ["apparato digerente", "respiratorio", "circolatorio", "cuore", "arterie", "vene", "polmoni", "reni"],
      },
      {
        id: "sc2-forze-equilibrio",
        titolo: "Forze, moto ed equilibrio, le leve",
        prerequisiti: ["sc1-metodo-scientifico"],
        strategie: [
          { nome: "Disegna le frecce", quando: "Quando devi capire cosa succede a un oggetto sotto più forze.", passi: ["Disegna l'oggetto come un punto.", "Disegna ogni forza come una freccia.", "Se le frecce si annullano è in equilibrio, altrimenti si muove verso la più forte."] },
          { nome: "Fulcro, potenza, resistenza", quando: "Quando classifichi una leva.", passi: ["Trova il fulcro.", "Trova dove spingi (potenza) e dove sta il peso (resistenza).", "Guarda cosa sta in mezzo: decide il genere della leva."] },
        ],
        errori_tipici: [
          { id: "pesante-cade-prima", errore: "Pensare che un oggetto più pesante cada più velocemente", esempio: "Una biglia di ferro cade prima di una di legno uguale.", come_riconoscerlo: "La velocità di caduta è legata al peso.", spiegazione: "Senza aria, tutti gli oggetti cadono con la stessa accelerazione: sulla Luna un martello e una piuma toccano terra insieme. È l'aria che rallenta la piuma." },
          { id: "massa-peso", errore: "Confondere massa e peso", esempio: "Sulla Luna la mia massa è più piccola.", come_riconoscerlo: "Massa e peso sono usati come sinonimi.", spiegazione: "La massa è la quantità di materia, in kg, e non cambia. Il peso è la forza di gravità, in newton: sulla Luna è circa un sesto." },
        ],
        parole_chiave: ["forza", "newton", "peso", "massa", "equilibrio", "leva", "fulcro", "velocità"],
      },
    ],
    inglese: [
      {
        id: "en2-past-simple",
        titolo: "Past simple: verbi regolari e irregolari",
        prerequisiti: ["en1-present-simple"],
        strategie: [
          { nome: "Parole spia del tempo", quando: "Quando devi capire se usare il past simple.", passi: ["Cerca yesterday, last week, ago, in 2010, when I was.", "Se ci sono, l'azione è finita nel passato: past simple.", "Regolari con -ed, irregolari dalla tabella."] },
          { nome: "Did fa il lavoro", quando: "Quando fai una domanda o una negativa al passato.", passi: ["Metti did o didn't.", "Il verbo dopo torna base.", "Controlla: un solo passato per frase."] },
        ],
        errori_tipici: [
          { id: "did-verbo-passato", errore: "Usare il passato anche dopo did", esempio: "Did you went to the party?", come_riconoscerlo: "Dopo did o didn't il verbo è al passato.", spiegazione: "Il passato è già in did: il verbo torna base. «Did you go?», «I didn't go»." },
          { id: "irregolari-ed", errore: "Aggiungere -ed ai verbi irregolari", esempio: "I goed to school.", come_riconoscerlo: "Un verbo irregolare ha la -ed.", spiegazione: "Go è irregolare: il passato è went. I verbi più usati sono quasi tutti irregolari, per questo si imparano a memoria." },
        ],
        parole_chiave: ["past simple", "yesterday", "ago", "last", "did", "didn't", "irregular verbs"],
      },
      {
        id: "en2-futuro",
        titolo: "Il futuro: going to, will e present continuous",
        prerequisiti: ["en1-present-continuous"],
        strategie: [
          { nome: "Piano o previsione?", quando: "Quando devi scegliere la forma del futuro.", passi: ["Se è un piano già deciso, usa going to.", "Se è una decisione presa ora o una previsione, usa will.", "Se è un appuntamento fissato, puoi usare il present continuous."] },
        ],
        errori_tipici: [
          { id: "will-to", errore: "Mettere to dopo will", esempio: "I will to call you.", come_riconoscerlo: "Dopo will c'è to.", spiegazione: "Will è un modale come can: dopo viene il verbo base. «I will call you»." },
          { id: "going-to-senza-be", errore: "Dimenticare be in going to", esempio: "She going to study.", come_riconoscerlo: "C'è going to senza am, is o are.", spiegazione: "Going to ha bisogno di be: «She is going to study»." },
        ],
        parole_chiave: ["future", "will", "going to", "tomorrow", "next week", "plans", "predictions"],
      },
      {
        id: "en2-comparativi",
        titolo: "Comparativi e superlativi",
        prerequisiti: ["en1-to-be-have-got"],
        strategie: [
          { nome: "Corto -er, lungo more", quando: "Quando formi un comparativo.", passi: ["Conta le sillabe dell'aggettivo.", "Una sillaba: aggiungi -er e than.", "Tre o più sillabe: more davanti.", "Ricorda gli irregolari: good-better, bad-worse."] },
        ],
        errori_tipici: [
          { id: "more-er", errore: "Usare insieme more e -er", esempio: "My house is more bigger than yours.", come_riconoscerlo: "Nello stesso comparativo ci sono more e -er.", spiegazione: "Il comparativo si fa in un modo solo: bigger oppure more beautiful. More bigger dice due volte la stessa cosa." },
          { id: "good-gooder", errore: "Rendere regolari gli irregolari", esempio: "This film is gooder than that one.", come_riconoscerlo: "Good, bad o far hanno -er o more.", spiegazione: "Good è irregolare: better, the best. Bad diventa worse, the worst." },
        ],
        parole_chiave: ["comparative", "superlative", "than", "the most", "-er", "-est", "better"],
      },
      {
        id: "en2-quantita",
        titolo: "Countable e uncountable: some, any, much, many",
        prerequisiti: ["en1-present-simple"],
        strategie: [
          { nome: "Si possono contare?", quando: "Quando scegli tra much e many.", passi: ["Prova a contare: one apple, two apples.", "Se si contano, many. Se no, much.", "Nelle frasi affermative usa a lot of per tutti e due."] },
        ],
        errori_tipici: [
          { id: "much-many", errore: "Usare much con i nomi numerabili", esempio: "How much friends have you got?", come_riconoscerlo: "Much è usato con un plurale numerabile.", spiegazione: "Friends si contano: one friend, two friends. Quindi «How many friends»." },
        ],
        parole_chiave: ["some", "any", "much", "many", "a lot of", "countable", "uncountable"],
      },
    ],
  },

  // ───────────────────────────────────────────── 3ª media
  3: {
    matematica: [
      {
        id: "ma3-relativi",
        titolo: "I numeri relativi",
        prerequisiti: ["ma1-operazioni-espressioni", "ma1-potenze"],
        strategie: [
          { nome: "Regola dei segni", quando: "Quando moltiplichi o dividi numeri relativi.", passi: ["Segni uguali danno più.", "Segni diversi danno meno.", "Poi moltiplica o dividi i valori assoluti."] },
          { nome: "Termometro", quando: "Quando sommi numeri relativi.", passi: ["Parti dal primo numero sulla retta o sul termometro.", "Se aggiungi un positivo sali, se aggiungi un negativo scendi.", "Leggi dove arrivi."] },
        ],
        errori_tipici: [
          { id: "meno-per-meno", errore: "Meno per meno fa meno", esempio: "(−3) · (−4) = −12", come_riconoscerlo: "Il prodotto o il quoziente di due negativi è negativo.", spiegazione: "Guarda la sequenza: (−3) · 2 = −6, (−3) · 1 = −3, (−3) · 0 = 0. Ogni volta si sale di 3, quindi (−3) · (−1) = +3 e (−3) · (−4) = +12." },
          { id: "parentesi-segni", errore: "Togliere le parentesi senza cambiare i segni", esempio: "10 − (4 − 1) = 10 − 4 − 1 = 5", come_riconoscerlo: "Dopo un meno davanti alla parentesi i segni dentro sono rimasti uguali.", spiegazione: "Calcola prima la parentesi: 4 − 1 = 3, e 10 − 3 = 7, non 5. Il meno davanti toglie tutta la parentesi, quindi cambia ogni segno: 10 − 4 + 1 = 7." },
          { id: "potenza-negativo-segno", errore: "Sbagliare il segno della potenza di un negativo", esempio: "(−2)² = −4", come_riconoscerlo: "Una potenza pari di un numero negativo ha risultato negativo.", spiegazione: "(−2)² = (−2) · (−2), cioè meno per meno: +4. Con esponente dispari il segno resta: (−2)³ = −8." },
        ],
        parole_chiave: ["numeri relativi", "numeri negativi", "valore assoluto", "regola dei segni", "opposto", "retta orientata"],
      },
      {
        id: "ma3-calcolo-letterale",
        titolo: "Calcolo letterale: monomi, polinomi e prodotti notevoli",
        prerequisiti: ["ma3-relativi"],
        strategie: [
          { nome: "Solo i simili si sommano", quando: "Quando sommi monomi.", passi: ["Raggruppa i monomi con la stessa parte letterale.", "Somma i coefficienti.", "Lascia la parte letterale com'è."] },
          { nome: "Quadrato del primo, doppio prodotto, quadrato del secondo", quando: "Quando sviluppi il quadrato di un binomio.", passi: ["Scrivi il quadrato del primo termine.", "Aggiungi il doppio prodotto con il suo segno.", "Aggiungi il quadrato del secondo termine."] },
        ],
        errori_tipici: [
          { id: "quadrato-binomio-senza-doppio", errore: "Dimenticare il doppio prodotto", esempio: "(a + b)² = a² + b²", come_riconoscerlo: "Nello sviluppo del quadrato di un binomio mancano i termini 2ab.", spiegazione: "Prova con a = 1 e b = 2: (1 + 2)² = 9, mentre 1 + 4 = 5. Manca 2ab = 4: 1 + 4 + 4 = 9." },
          { id: "monomi-non-simili", errore: "Sommare monomi non simili", esempio: "3x + 2x² = 5x³", come_riconoscerlo: "Sono stati sommati monomi con parti letterali diverse.", spiegazione: "Prova con x = 1: 3 + 2 = 5, sembra funzionare. Con x = 2: 6 + 8 = 14, mentre 5 · 8 = 40. Non si sommano, si lascia 3x + 2x²." },
        ],
        parole_chiave: ["calcolo letterale", "monomio", "polinomio", "coefficiente", "parte letterale", "prodotti notevoli", "monomi simili"],
      },
      {
        id: "ma3-equazioni",
        titolo: "Equazioni di primo grado e problemi con le equazioni",
        prerequisiti: ["ma3-relativi", "ma3-calcolo-letterale", "ma2-frazioni-operazioni"],
        strategie: [
          { nome: "Chiamo x quello che non so", quando: "Quando risolvi un problema con un'equazione.", passi: ["Scrivi «x =» e cosa rappresenta.", "Traduci le frasi del testo in espressioni con x.", "Scrivi l'equazione e risolvila.", "Controlla che il risultato abbia senso nel problema."] },
          { nome: "Bilancia", quando: "Quando sposti termini da un membro all'altro.", passi: ["Immagina i due membri come i piatti di una bilancia.", "Fai la stessa operazione su tutti e due i lati.", "Lascia le x a sinistra e i numeri a destra.", "Verifica sostituendo il risultato."] },
          { nome: "Prima via i denominatori", quando: "Quando l'equazione ha frazioni.", passi: ["Trova il mcm dei denominatori.", "Moltiplica ogni termine dei due membri per il mcm.", "Risolvi l'equazione senza frazioni."] },
        ],
        errori_tipici: [
          { id: "trasporto-senza-cambio-segno", errore: "Spostare un termine senza cambiare segno", esempio: "x + 5 = 12 → x = 12 + 5", come_riconoscerlo: "Un termine passato all'altro membro ha lo stesso segno di prima.", spiegazione: "Verifica con x = 17: 17 + 5 fa 22, non 12. Togliendo 5 da tutti e due i lati: x = 12 − 5 = 7." },
          { id: "dividere-coefficiente-segno", errore: "Sottrarre il coefficiente invece di dividere", esempio: "3x = 12 → x = 12 − 3 = 9", come_riconoscerlo: "Il coefficiente della x è stato sottratto o spostato col segno cambiato.", spiegazione: "3x vuol dire 3 per x: l'operazione contraria è dividere. x = 4, e 3 · 4 = 12. Con x = 9 verrebbe 27." },
          { id: "mcm-solo-frazioni", errore: "Moltiplicare per il mcm solo i termini con il denominatore", esempio: "x/2 + 3 = 5 → x + 3 = 10", come_riconoscerlo: "Dopo aver tolto i denominatori, i termini interi non sono stati moltiplicati.", spiegazione: "Ogni termine va moltiplicato per 2: x + 6 = 10, quindi x = 4. Verifica: 4/2 + 3 = 5. Con x = 7 verrebbe 6,5." },
        ],
        parole_chiave: ["equazione", "incognita", "primo membro", "secondo membro", "principi di equivalenza", "verifica", "problema con le equazioni"],
      },
      {
        id: "ma3-piano-cartesiano",
        titolo: "Piano cartesiano e funzioni: la retta",
        prerequisiti: ["ma3-relativi", "ma2-proporzionalita"],
        strategie: [
          { nome: "Prima la x, poi la y", quando: "Quando segni un punto nel piano cartesiano.", passi: ["Parti dall'origine.", "Spostati in orizzontale della x.", "Poi in verticale della y."] },
          { nome: "Tabella di due punti", quando: "Quando disegni una retta da un'equazione.", passi: ["Scegli due valori di x, per esempio 0 e 1.", "Calcola le y.", "Segna i due punti e uniscili con la riga."] },
        ],
        errori_tipici: [
          { id: "coordinate-scambiate", errore: "Scambiare ascissa e ordinata", esempio: "Il punto (2; 5) segnato a x = 5, y = 2", come_riconoscerlo: "Il punto è nella posizione delle coordinate invertite.", spiegazione: "Nella coppia la prima è sempre la x, in orizzontale. Ricorda l'ordine alfabetico: x viene prima di y." },
        ],
        parole_chiave: ["piano cartesiano", "ascissa", "ordinata", "coordinate", "retta", "funzione", "coefficiente angolare"],
      },
      {
        id: "ma3-statistica-probabilita",
        titolo: "Statistica e probabilità",
        prerequisiti: ["ma2-percentuali", "ma2-frazioni-operazioni"],
        strategie: [
          { nome: "Casi favorevoli su casi possibili", quando: "Quando calcoli una probabilità.", passi: ["Elenca tutti i casi possibili.", "Conta quelli favorevoli.", "Scrivi la frazione favorevoli/possibili.", "Controlla che sia tra 0 e 1."] },
          { nome: "Media, moda, mediana", quando: "Quando analizzi una serie di dati.", passi: ["Media: somma e dividi per quanti sono.", "Moda: il valore più frequente.", "Mediana: metti in ordine e prendi quello in mezzo."] },
        ],
        errori_tipici: [
          { id: "mediana-senza-ordinare", errore: "Prendere la mediana senza ordinare i dati", esempio: "Dati 7, 2, 9: mediana = 2", come_riconoscerlo: "La mediana è il valore centrale della lista non ordinata.", spiegazione: "In ordine i dati sono 2, 7, 9: in mezzo c'è 7. La mediana deve dividere i dati in due metà, una più piccola e una più grande." },
          { id: "probabilita-maggiore-uno", errore: "Ottenere una probabilità maggiore di 1", esempio: "Probabilità di un numero pari con un dado = 6/3", come_riconoscerlo: "La probabilità è più di 1 o più del 100%.", spiegazione: "La frazione è capovolta: favorevoli sopra, possibili sotto. 3/6 = 1/2. Una probabilità sopra 1 vorrebbe dire più che certo." },
        ],
        parole_chiave: ["statistica", "media", "moda", "mediana", "frequenza", "probabilità", "eventi", "istogramma"],
      },
      {
        id: "ma3-cerchio",
        titolo: "Circonferenza, cerchio e pi greco",
        prerequisiti: ["ma2-aree-poligoni"],
        strategie: [
          { nome: "Raggio prima di tutto", quando: "Quando risolvi un problema su cerchio e circonferenza.", passi: ["Trova il raggio, anche dal diametro dividendo per 2.", "Circonferenza: 2 · π · r.", "Area: π · r²."] },
        ],
        errori_tipici: [
          { id: "diametro-raggio", errore: "Usare il diametro al posto del raggio", esempio: "Diametro 10 cm: area = 3,14 × 10² = 314 cm²", come_riconoscerlo: "Nella formula dell'area c'è il diametro al quadrato.", spiegazione: "Il raggio è 5 cm: area = 3,14 × 25 = 78,5 cm². Con il diametro l'area viene quattro volte più grande, come un quadrato di lato 10 cm che contiene tutto il cerchio con spazio in più." },
          { id: "circonferenza-area", errore: "Confondere circonferenza e area del cerchio", esempio: "Raggio 3 cm: area = 2 × 3,14 × 3 = 18,84 cm²", come_riconoscerlo: "Per l'area è stata usata 2πr, o per la circonferenza πr².", spiegazione: "La circonferenza è il bordo, una lunghezza in cm: 2πr. L'area è la superficie dentro, in cm²: πr² = 28,26 cm²." },
        ],
        parole_chiave: ["circonferenza", "cerchio", "raggio", "diametro", "pi greco", "settore circolare", "arco"],
      },
      {
        id: "ma3-solidi",
        titolo: "I solidi: superfici e volumi di prismi, piramidi, cilindro, cono e sfera",
        prerequisiti: ["ma3-cerchio", "ma2-pitagora", "ma2-aree-poligoni"],
        strategie: [
          { nome: "Sviluppo del solido", quando: "Quando calcoli la superficie di un solido.", passi: ["Disegna il solido aperto, come una scatola smontata.", "Calcola l'area di ogni faccia.", "Somma laterale e basi per la superficie totale."] },
          { nome: "Area di base per altezza", quando: "Quando calcoli il volume di prismi e cilindri.", passi: ["Calcola l'area di base.", "Moltiplica per l'altezza.", "Per piramide e cono dividi per 3."] },
        ],
        errori_tipici: [
          { id: "unita-quadrato-cubo", errore: "Dimenticare le unità al quadrato e al cubo", esempio: "Cubo di spigolo 2 cm: volume = 8 cm; e 1 m³ = 10 dm³", come_riconoscerlo: "Un'area non ha ², un volume non ha ³, o nelle equivalenze si usa il salto di 10.", spiegazione: "In un cubo di 1 m ci stanno 10 × 10 × 10 cubetti da 1 dm: 1 m³ = 1000 dm³. Per le aree il salto è 100, per i volumi 1000." },
          { id: "cono-senza-terzo", errore: "Dimenticare il diviso 3 nel volume di piramide e cono", esempio: "Cono r = 3 cm, h = 4 cm: volume = 3,14 × 9 × 4 = 113,04 cm³", come_riconoscerlo: "Il volume di piramide o cono è uguale a quello del prisma o cilindro con stessa base e altezza.", spiegazione: "Con tre coni pieni d'acqua riempi un cilindro della stessa base e altezza. Il volume del cono è un terzo: 37,68 cm³." },
          { id: "apotema-altezza", errore: "Confondere altezza e apotema", esempio: "Superficie laterale della piramide calcolata con l'altezza del solido", come_riconoscerlo: "Nella superficie laterale compare l'altezza invece dell'apotema, o nel volume l'apotema.", spiegazione: "L'altezza va dal vertice al centro della base, l'apotema dal vertice al lato della base, sulla faccia. Formano un triangolo rettangolo: l'apotema è l'ipotenusa, quindi è più lunga." },
        ],
        parole_chiave: ["solidi", "volume", "superficie laterale", "superficie totale", "prisma", "piramide", "cilindro", "cono"],
      },
    ],
    italiano: [
      {
        id: "it3-analisi-periodo",
        titolo: "Analisi del periodo: principale e coordinate",
        prerequisiti: ["it2-analisi-logica", "it2-complementi"],
        strategie: [
          { nome: "Conta i verbi", quando: "Quando inizi l'analisi del periodo.", passi: ["Sottolinea tutti i predicati.", "Ogni predicato è una proposizione.", "Dividi il periodo con una barra prima di ogni proposizione.", "Cerca la principale: quella che sta in piedi da sola."] },
          { nome: "La prova del «da sola»", quando: "Quando non sai qual è la principale.", passi: ["Leggi ogni proposizione da sola.", "La principale ha senso compiuto.", "Le altre hanno bisogno di qualcosa."] },
        ],
        errori_tipici: [
          { id: "servile-due-proposizioni", errore: "Contare due proposizioni con un verbo servile", esempio: "«Voglio andare al mare»: due proposizioni", come_riconoscerlo: "Verbo servile e infinito sono divisi in due proposizioni.", spiegazione: "Volere, potere, dovere con l'infinito formano un solo predicato. «Voglio andare» è una proposizione sola." },
          { id: "coordinata-subordinata", errore: "Confondere coordinata e subordinata", esempio: "«Studio perché domani ho la verifica»: coordinata", come_riconoscerlo: "Una proposizione introdotta da una congiunzione subordinante è chiamata coordinata.", spiegazione: "Le coordinate sono sullo stesso piano, unite da e, ma, o, però. «Perché» introduce una causa che dipende dalla principale: è subordinata causale." },
        ],
        parole_chiave: ["analisi del periodo", "proposizione", "principale", "coordinata", "periodo", "congiunzioni"],
      },
      {
        id: "it3-subordinate",
        titolo: "Analisi del periodo: le subordinate",
        prerequisiti: ["it3-analisi-periodo"],
        strategie: [
          { nome: "La domanda della subordinata", quando: "Quando devi riconoscere il tipo di subordinata.", passi: ["Parti dalla proposizione da cui dipende.", "Fai una domanda: perché? quando? che cosa? con quale scopo?", "La domanda dà il nome: causale, temporale, oggettiva, finale.", "Controlla se è esplicita (verbo coniugato) o implicita (infinito, gerundio, participio)."] },
        ],
        errori_tipici: [
          { id: "che-sempre-relativa", errore: "Pensare che «che» introduca sempre una relativa", esempio: "«So che hai ragione»: relativa", come_riconoscerlo: "Ogni proposizione con «che» è chiamata relativa.", spiegazione: "Prova a sostituire «che» con «il quale»: «so il quale hai ragione» non funziona. Qui «che» è congiunzione e la proposizione risponde a «so che cosa?»: è oggettiva." },
          { id: "finale-causale", errore: "Confondere finale e causale", esempio: "«Studio per passare l'esame»: causale", come_riconoscerlo: "Una proposizione con «per» più infinito che indica uno scopo è chiamata causale.", spiegazione: "La causale dice perché succede, la finale a quale scopo. Passare l'esame è lo scopo, viene dopo: è finale." },
        ],
        parole_chiave: ["subordinata", "oggettiva", "soggettiva", "relativa", "causale", "temporale", "finale", "implicita"],
      },
      {
        id: "it3-argomentativo",
        titolo: "Il testo argomentativo",
        prerequisiti: ["it2-testi"],
        strategie: [
          { nome: "Tesi, argomenti, antitesi, conclusione", quando: "Quando scrivi o analizzi un testo argomentativo.", passi: ["Scrivi la tesi in una frase.", "Trova almeno due argomenti con esempi.", "Scrivi l'antitesi e rispondi.", "Chiudi ribadendo la tesi."] },
        ],
        errori_tipici: [
          { id: "argomentativo-senza-antitesi", errore: "Scrivere un testo argomentativo senza antitesi", esempio: "Il telefono a scuola va vietato perché distrae. Fine.", come_riconoscerlo: "Non c'è nessuna opinione contraria e nessuna risposta.", spiegazione: "Chi legge pensa subito a un'obiezione, per esempio che il telefono serve per le ricerche. Se non la confuti, la tua tesi resta debole." },
          { id: "opinione-senza-prove", errore: "Dare opinioni senza argomenti", esempio: "Secondo me lo sport fa bene perché è così.", come_riconoscerlo: "Il «perché» ripete la tesi o non porta dati, esempi o esperienze.", spiegazione: "Un argomento risponde a «come lo sai?». Un dato, un esempio, un'esperienza rendono la tesi credibile." },
        ],
        parole_chiave: ["testo argomentativo", "tesi", "antitesi", "argomenti", "confutazione", "conclusione", "opinione"],
      },
      {
        id: "it3-ottocento",
        titolo: "Letteratura dell'Ottocento: Foscolo, Leopardi, Manzoni, Verga",
        prerequisiti: ["it2-letteratura"],
        strategie: [
          { nome: "Autore nel suo tempo", quando: "Quando studi un autore dell'Ottocento.", passi: ["Metti l'autore sulla linea del tempo con il Risorgimento.", "Scrivi la corrente: Neoclassicismo, Romanticismo, Verismo.", "Collega un'opera a un tema."] },
          { nome: "Una strofa alla volta", quando: "Quando devi imparare a memoria una poesia, come «L'infinito».", passi: ["Leggi a voce tutta la poesia.", "Ripeti pochi versi senza guardare.", "Aggiungi pochi versi e ripeti dall'inizio.", "Ripassa il giorno dopo."] },
        ],
        errori_tipici: [
          { id: "manzoni-poesia", errore: "Confondere le opere degli autori", esempio: "«L'infinito» è di Manzoni.", come_riconoscerlo: "Un'opera è attribuita all'autore che non l'ha scritta.", spiegazione: "«L'infinito» è di Leopardi. Manzoni ha scritto «I promessi sposi», Verga «I Malavoglia», Foscolo «Dei Sepolcri»." },
        ],
        parole_chiave: ["ottocento", "romanticismo", "leopardi", "manzoni", "foscolo", "verga", "verismo", "promessi sposi"],
      },
      {
        id: "it3-novecento",
        titolo: "Letteratura del Novecento: Pascoli, D'Annunzio, Ungaretti, Montale e il romanzo",
        prerequisiti: ["it3-ottocento"],
        strategie: [
          { nome: "Collegamenti con la storia", quando: "Quando studi un autore del Novecento.", passi: ["Scrivi cosa succede nella storia in quegli anni.", "Cerca come entra nelle opere, per esempio la guerra in Ungaretti.", "Annota il collegamento per l'esame."] },
        ],
        errori_tipici: [
          { id: "ungaretti-guerra", errore: "Collegare l'autore alla guerra di un altro periodo", esempio: "Ungaretti scrive «Veglia» nella Seconda guerra mondiale.", come_riconoscerlo: "Opera e guerra non corrispondono nelle date.", spiegazione: "Ungaretti scrive le poesie de «Il porto sepolto» al fronte nella Prima guerra mondiale, nel 1915-1916. Primo Levi racconta invece la Seconda guerra e la Shoah." },
        ],
        parole_chiave: ["novecento", "pascoli", "d'annunzio", "ungaretti", "montale", "pirandello", "primo levi", "ermetismo"],
      },
      {
        id: "it3-esame-scritto",
        titolo: "Preparazione allo scritto dell'esame di italiano",
        prerequisiti: ["it3-argomentativo", "it1-narrativo"],
        strategie: [
          { nome: "Scaletta prima di scrivere", quando: "Quando inizi una prova scritta.", passi: ["Leggi la traccia due volte e sottolinea le richieste.", "Scrivi una scaletta: introduzione, sviluppo, conclusione.", "Scrivi la brutta.", "Rileggi per ortografia e punteggiatura e copia in bella a mano."] },
        ],
        errori_tipici: [
          { id: "fuori-traccia", errore: "Andare fuori traccia", esempio: "Traccia sull'amicizia: il testo racconta solo una vacanza.", come_riconoscerlo: "Il testo non risponde alle domande della traccia.", spiegazione: "Rileggi la traccia e controlla ogni richiesta: se ne manca una, il testo non risponde a quello che chiede la prova, anche se è scritto bene." },
        ],
        parole_chiave: ["esame", "prova scritta", "traccia", "scaletta", "comprensione del testo", "sintesi", "brutta copia"],
      },
    ],
    storia: [
      {
        id: "st3-fine-ottocento",
        titolo: "Seconda rivoluzione industriale, imperialismo e Italia giolittiana",
        prerequisiti: ["st2-napoleone-risorgimento"],
        strategie: [
          { nome: "Causa → fatto → conseguenza", quando: "Quando studi l'imperialismo.", passi: ["Cause: materie prime, mercati, nazionalismo.", "Fatto: spartizione dell'Africa.", "Conseguenze: rivalità tra potenze, sfruttamento dei popoli colonizzati."] },
        ],
        errori_tipici: [
          { id: "prima-seconda-rivoluzione-industriale", errore: "Confondere prima e seconda rivoluzione industriale", esempio: "La seconda rivoluzione industriale si basa sulla macchina a vapore e il carbone.", come_riconoscerlo: "Le innovazioni del Settecento sono messe alla fine dell'Ottocento.", spiegazione: "La prima, nel Settecento, è vapore, carbone e tessile. La seconda, dopo il 1870, porta elettricità, petrolio, acciaio e chimica." },
        ],
        parole_chiave: ["seconda rivoluzione industriale", "imperialismo", "colonialismo", "belle époque", "giolitti", "società di massa"],
      },
      {
        id: "st3-prima-guerra",
        titolo: "La Prima guerra mondiale e la rivoluzione russa",
        prerequisiti: ["st3-fine-ottocento"],
        strategie: [
          { nome: "Causa → fatto → conseguenza", quando: "Quando spieghi perché scoppia la Prima guerra mondiale.", passi: ["Cause profonde: nazionalismi, alleanze, corsa agli armamenti.", "Causa occasionale: Sarajevo 1914.", "Conseguenze: fine di quattro imperi, trattati di pace, crisi del dopoguerra."] },
          { nome: "Linea del tempo", quando: "Quando ordini le fasi della guerra.", passi: ["Segna 1914 inizio, 1915 entrata dell'Italia.", "Segna 1917 Caporetto, rivoluzione russa e entrata degli Stati Uniti.", "Segna 1918 la fine."] },
        ],
        errori_tipici: [
          { id: "causa-occasionale-profonda", errore: "Confondere causa occasionale e cause profonde", esempio: "La Prima guerra mondiale scoppia solo perché uccidono l'arciduca.", come_riconoscerlo: "L'attentato di Sarajevo è l'unica causa citata.", spiegazione: "Un omicidio da solo non porta milioni di soldati in guerra. L'attentato è stato la scintilla, ma la miccia erano alleanze, nazionalismi e rivalità." },
          { id: "italia-schieramento", errore: "Sbagliare lo schieramento dell'Italia", esempio: "L'Italia combatte con la Germania nella Prima guerra mondiale.", come_riconoscerlo: "L'Italia è messa con gli Imperi centrali nel 1915-1918.", spiegazione: "L'Italia era nella Triplice alleanza ma nel 1914 resta neutrale. Con il Patto di Londra del 1915 entra in guerra con l'Intesa, contro l'Austria." },
        ],
        parole_chiave: ["prima guerra mondiale", "1914", "sarajevo", "trincea", "caporetto", "rivoluzione russa", "lenin", "versailles"],
      },
      {
        id: "st3-totalitarismi",
        titolo: "I totalitarismi: fascismo, nazismo e stalinismo",
        prerequisiti: ["st3-prima-guerra"],
        strategie: [
          { nome: "Confronto tra periodi", quando: "Quando confronti i regimi totalitari.", passi: ["Fai una tabella: capo, partito unico, propaganda, nemici, economia.", "Compila per fascismo, nazismo e stalinismo.", "Scrivi cosa hanno in comune e cosa li distingue."] },
          { nome: "Causa → fatto → conseguenza", quando: "Quando spieghi l'arrivo al potere di un regime.", passi: ["Cause: crisi del dopoguerra, paura, disoccupazione.", "Fatto: marcia su Roma 1922, Hitler cancelliere 1933.", "Conseguenze: fine delle libertà, leggi razziali."] },
        ],
        errori_tipici: [
          { id: "hitler-elezioni-dittatore", errore: "Pensare che Hitler abbia preso il potere solo con un colpo di Stato", esempio: "Hitler conquista il potere con la forza nel 1933.", come_riconoscerlo: "La salita al potere di Hitler è descritta senza elezioni e nomina.", spiegazione: "Il partito nazista diventa il primo partito con le elezioni e Hitler è nominato cancelliere nel 1933. Poi, una volta al governo, elimina le libertà e diventa dittatore." },
        ],
        parole_chiave: ["totalitarismo", "fascismo", "mussolini", "nazismo", "hitler", "stalin", "propaganda", "leggi razziali"],
      },
      {
        id: "st3-seconda-guerra",
        titolo: "La Seconda guerra mondiale, la Shoah e la Resistenza",
        prerequisiti: ["st3-totalitarismi"],
        strategie: [
          { nome: "Linea del tempo", quando: "Quando ordini le fasi della Seconda guerra mondiale.", passi: ["Segna 1939 invasione della Polonia, 1940 entrata dell'Italia.", "Segna 1941 Pearl Harbor e invasione dell'URSS.", "Segna 8 settembre 1943, 25 aprile 1945, 8 maggio 1945 la fine in Europa e 2 settembre 1945 la resa del Giappone."] },
          { nome: "Causa → fatto → conseguenza", quando: "Quando studi un evento della guerra.", passi: ["Scrivi il fatto.", "Scrivi le cause.", "Scrivi le conseguenze per l'Italia e per il mondo."] },
        ],
        errori_tipici: [
          { id: "otto-settembre", errore: "Confondere 8 settembre 1943 e 25 aprile 1945", esempio: "L'8 settembre 1943 l'Italia viene liberata.", come_riconoscerlo: "L'armistizio è scambiato con la Liberazione.", spiegazione: "L'8 settembre si annuncia l'armistizio: inizia l'occupazione tedesca e la Resistenza. La Liberazione si festeggia il 25 aprile 1945." },
        ],
        parole_chiave: ["seconda guerra mondiale", "1939", "shoah", "olocausto", "resistenza", "8 settembre", "25 aprile", "bomba atomica"],
      },
      {
        id: "st3-repubblica-oggi",
        titolo: "Repubblica, Costituzione, guerra fredda e mondo di oggi",
        prerequisiti: ["st3-seconda-guerra"],
        strategie: [
          { nome: "Confronto tra periodi", quando: "Quando confronti l'Italia prima e dopo il 1946.", passi: ["Forma dello Stato: monarchia o repubblica.", "Chi vota: con il 1946 votano anche le donne.", "Diritti: cosa garantisce la Costituzione."] },
          { nome: "Linea del tempo", quando: "Quando ordini il secondo Novecento.", passi: ["Segna 1946 referendum, 1948 Costituzione.", "Segna 1961 muro di Berlino e 1989 la sua caduta.", "Segna 1991 fine dell'URSS e 1993 Unione europea."] },
        ],
        errori_tipici: [
          { id: "costituzione-1946", errore: "Confondere referendum e entrata in vigore della Costituzione", esempio: "La Costituzione entra in vigore il 2 giugno 1946.", come_riconoscerlo: "La data del referendum è data come data della Costituzione.", spiegazione: "Il 2 giugno 1946 si vota il referendum: vince la Repubblica e si elegge l'Assemblea costituente. La Costituzione entra in vigore il 1° gennaio 1948." },
          { id: "guerra-fredda-combattuta", errore: "Pensare che la guerra fredda sia una guerra combattuta tra USA e URSS", esempio: "Nella guerra fredda Stati Uniti e Unione Sovietica si bombardano.", come_riconoscerlo: "Si descrivono battaglie dirette tra le due superpotenze.", spiegazione: "USA e URSS non si sono mai combattuti direttamente: si chiama «fredda» per questo. Si scontravano con armi, propaganda e guerre in altri Paesi, come Corea e Vietnam." },
        ],
        parole_chiave: ["repubblica", "costituzione", "1948", "guerra fredda", "muro di berlino", "decolonizzazione", "globalizzazione"],
      },
    ],
    geografia: [
      {
        id: "ge3-continenti",
        titolo: "I continenti: territorio, clima e Stati principali",
        prerequisiti: ["ge2-europa-fisica"],
        strategie: [
          { nome: "Scheda continente", quando: "Quando studi un continente.", passi: ["Posizione e confini.", "Rilievi, fiumi e climi principali.", "Popolazione, Stati più importanti, economia.", "Un problema attuale."] },
        ],
        errori_tipici: [
          { id: "carta-mercatore", errore: "Giudicare la grandezza dei continenti dalla carta di Mercatore", esempio: "La Groenlandia è grande come l'Africa.", come_riconoscerlo: "Le dimensioni sono stimate da un planisfero, senza dati.", spiegazione: "La carta di Mercatore ingrandisce le terre vicine ai poli. L'Africa è circa 14 volte più grande della Groenlandia." },
          { id: "africa-paese", errore: "Trattare l'Africa come un unico Paese", esempio: "In Africa si parla africano e fa sempre caldo.", come_riconoscerlo: "Un continente è descritto come uno Stato con una lingua e un clima.", spiegazione: "L'Africa ha 54 Stati, più di mille lingue e climi diversi, dal deserto alla foresta pluviale. Sull'Atlante marocchino nevica." },
        ],
        parole_chiave: ["continenti", "africa", "asia", "america", "oceania", "antartide", "planisfero", "fusi orari"],
      },
      {
        id: "ge3-popolazione-mondo",
        titolo: "Popolazione mondiale, migrazioni e città",
        prerequisiti: ["ge2-popolazione-economia"],
        strategie: [
          { nome: "Causa → fatto → conseguenza", quando: "Quando spieghi una migrazione.", passi: ["Fattori di spinta: guerre, povertà, clima.", "Fattori di attrazione: lavoro, sicurezza, famiglia.", "Conseguenze per il Paese di partenza e quello di arrivo."] },
        ],
        errori_tipici: [
          { id: "popolazione-densita-totale", errore: "Confondere popolazione totale e densità", esempio: "Il Canada è molto popolato perché è grande.", come_riconoscerlo: "La grandezza del territorio è usata per dire quante persone ci vivono.", spiegazione: "Il Canada è enorme ma ha oltre 40 milioni di abitanti, circa 4 per km². Il Bangladesh è piccolo e ne ha oltre 1000 per km²." },
        ],
        parole_chiave: ["popolazione mondiale", "migrazioni", "urbanizzazione", "megalopoli", "natalità", "speranza di vita"],
      },
      {
        id: "ge3-sviluppo-globalizzazione",
        titolo: "Sviluppo, disuguaglianze e globalizzazione",
        prerequisiti: ["ge3-popolazione-mondo"],
        strategie: [
          { nome: "Più indicatori insieme", quando: "Quando confronti lo sviluppo di due Paesi.", passi: ["Guarda il PIL per abitante.", "Guarda l'Indice di sviluppo umano: salute, istruzione, reddito.", "Confronta e scrivi una conclusione con i dati."] },
        ],
        errori_tipici: [
          { id: "pil-tutti-ricchi", errore: "Pensare che un PIL alto voglia dire che tutti stanno bene", esempio: "Il Paese ha un PIL altissimo, quindi nessuno è povero.", come_riconoscerlo: "Il PIL totale è usato da solo per parlare del benessere di tutti.", spiegazione: "Il PIL è una somma: non dice come è distribuita la ricchezza. Un Paese può avere un PIL alto e molte persone povere. Per questo si usa anche l'ISU." },
        ],
        parole_chiave: ["sviluppo", "sottosviluppo", "pil", "isu", "globalizzazione", "disuguaglianze", "multinazionali"],
      },
      {
        id: "ge3-ambiente-sostenibilita",
        titolo: "Ambiente, cambiamento climatico, risorse e Agenda 2030",
        prerequisiti: ["ge1-clima-ambienti"],
        strategie: [
          { nome: "Causa → fatto → conseguenza", quando: "Quando spieghi un problema ambientale.", passi: ["Scrivi le cause umane e naturali.", "Scrivi cosa sta succedendo, con un dato.", "Scrivi le conseguenze e una possibile soluzione."] },
        ],
        errori_tipici: [
          { id: "ozono-effetto-serra", errore: "Confondere buco dell'ozono ed effetto serra", esempio: "Il riscaldamento globale è causato dal buco nell'ozono.", come_riconoscerlo: "Il buco dell'ozono è indicato come causa del riscaldamento globale.", spiegazione: "L'ozono ci protegge dai raggi ultravioletti, ed era danneggiato dai CFC. Il riscaldamento globale dipende dai gas serra, come l'anidride carbonica, che trattengono il calore." },
        ],
        parole_chiave: ["ambiente", "cambiamento climatico", "effetto serra", "risorse", "energie rinnovabili", "agenda 2030", "sostenibilità"],
      },
    ],
    scienze: [
      {
        id: "sc3-terra",
        titolo: "La Terra: struttura interna, vulcani, terremoti e rocce",
        prerequisiti: ["sc1-materia-stati"],
        strategie: [
          { nome: "Disegna la Terra a strati", quando: "Quando studi la struttura interna della Terra.", passi: ["Disegna una sfera tagliata a metà.", "Segna crosta, mantello, nucleo esterno e interno.", "Scrivi per ogni strato stato e temperatura."] },
        ],
        errori_tipici: [
          { id: "magnitudo-intensita", errore: "Confondere magnitudo e intensità di un terremoto", esempio: "Un terremoto di magnitudo 5 è sempre più grave di uno di magnitudo 4.", come_riconoscerlo: "Magnitudo (Richter) e danni (Mercalli) sono usati come la stessa cosa.", spiegazione: "La magnitudo misura l'energia liberata. I danni, misurati con la scala Mercalli, dipendono anche da profondità, distanza e qualità delle case." },
          { id: "nucleo-liquido", errore: "Pensare che l'interno della Terra sia tutto lava liquida", esempio: "Sotto la crosta c'è solo lava.", come_riconoscerlo: "Mantello e nucleo sono descritti come liquidi.", spiegazione: "Le onde sismiche mostrano che il mantello è quasi tutto solido e il nucleo interno è solido. È liquido solo il nucleo esterno." },
        ],
        parole_chiave: ["crosta", "mantello", "nucleo", "placche", "vulcani", "terremoti", "rocce", "magnitudo"],
      },
      {
        id: "sc3-universo",
        titolo: "Universo, sistema solare e moti della Terra e della Luna",
        prerequisiti: ["sc2-forze-equilibrio"],
        strategie: [
          { nome: "Modello con la lampada", quando: "Quando devi spiegare giorno, notte, stagioni o fasi lunari.", passi: ["La lampada è il Sole, una palla è la Terra.", "Fai ruotare la palla: giorno e notte.", "Falla girare intorno alla lampada con l'asse inclinato: le stagioni."] },
        ],
        errori_tipici: [
          { id: "stagioni-distanza", errore: "Pensare che le stagioni dipendano dalla distanza dal Sole", esempio: "D'estate fa caldo perché la Terra è più vicina al Sole.", come_riconoscerlo: "Le stagioni sono spiegate con la distanza Terra-Sole.", spiegazione: "Quando da noi è estate, in Australia è inverno: se fosse la distanza sarebbe estate ovunque. Le stagioni dipendono dall'inclinazione dell'asse terrestre." },
          { id: "fasi-lunari-ombra", errore: "Pensare che le fasi lunari siano l'ombra della Terra", esempio: "La luna calante è coperta dall'ombra della Terra.", come_riconoscerlo: "Le fasi sono spiegate con l'ombra della Terra.", spiegazione: "L'ombra della Terra sulla Luna fa l'eclissi, che è rara. Le fasi cambiano perché vediamo una parte diversa della metà illuminata della Luna mentre ci gira intorno." },
        ],
        parole_chiave: ["universo", "sistema solare", "pianeti", "rotazione", "rivoluzione", "stagioni", "fasi lunari", "eclissi"],
      },
      {
        id: "sc3-genetica",
        titolo: "Genetica ed ereditarietà",
        prerequisiti: ["sc1-cellula"],
        strategie: [
          { nome: "Quadrato di Punnett", quando: "Quando calcoli i figli possibili di un incrocio.", passi: ["Scrivi i gameti di un genitore in alto e dell'altro a sinistra.", "Riempi le caselle unendo le lettere.", "Conta le combinazioni e scrivi le proporzioni."] },
        ],
        errori_tipici: [
          { id: "recessivo-sparisce", errore: "Pensare che un carattere recessivo sparisca", esempio: "Due genitori con occhi scuri non possono avere un figlio con occhi chiari.", come_riconoscerlo: "Si dice che il recessivo non può ricomparire.", spiegazione: "Se i due genitori sono Aa, il quadrato di Punnett dà 1 caso su 4 di aa. Il recessivo era nascosto, non sparito." },
          { id: "gene-cromosoma", errore: "Confondere gene, cromosoma e DNA", esempio: "Un gene contiene tanti cromosomi.", come_riconoscerlo: "L'ordine di grandezza tra DNA, gene e cromosoma è invertito.", spiegazione: "Il DNA è la molecola, un gene è un tratto di DNA, un cromosoma è un lungo filamento di DNA con molti geni. Nell'uomo ci sono 46 cromosomi." },
        ],
        parole_chiave: ["genetica", "mendel", "dna", "gene", "cromosoma", "dominante", "recessivo", "punnett"],
      },
      {
        id: "sc3-sistema-nervoso",
        titolo: "Sistema nervoso, organi di senso e salute",
        prerequisiti: ["sc2-corpo-apparati"],
        strategie: [
          { nome: "Stimolo → nervo → risposta", quando: "Quando spieghi come reagisce il corpo.", passi: ["Scrivi lo stimolo e l'organo di senso.", "Segui il messaggio lungo i nervi fino al midollo o al cervello.", "Scrivi la risposta del muscolo."] },
        ],
        errori_tipici: [
          { id: "riflesso-cervello", errore: "Pensare che tutti i movimenti passino dal cervello", esempio: "Togli la mano dal fuoco perché il cervello lo decide.", come_riconoscerlo: "Un riflesso è spiegato come decisione del cervello.", spiegazione: "Nel riflesso il messaggio arriva al midollo spinale, che risponde subito. Per questo togli la mano prima ancora di sentire dolore." },
          { id: "dieci-per-cento", errore: "Credere che usiamo solo il 10% del cervello", esempio: "Usiamo solo il 10% del nostro cervello.", come_riconoscerlo: "Compare l'idea del cervello usato in piccola parte.", spiegazione: "Le immagini del cervello mostrano attività in tutte le aree durante la giornata. Un danno anche piccolo in qualunque zona ha effetti." },
        ],
        parole_chiave: ["sistema nervoso", "neurone", "cervello", "midollo spinale", "riflesso", "sinapsi", "organi di senso"],
      },
      {
        id: "sc3-energia",
        titolo: "L'energia: forme, trasformazioni e fonti",
        prerequisiti: ["sc2-forze-equilibrio", "sc1-calore-temperatura"],
        strategie: [
          { nome: "Catena dell'energia", quando: "Quando segui le trasformazioni dell'energia.", passi: ["Parti dalla fonte, per esempio il Sole.", "Scrivi ogni trasformazione con una freccia.", "Alla fine segna l'energia dispersa come calore."] },
        ],
        errori_tipici: [
          { id: "energia-consumata", errore: "Pensare che l'energia si consumi e sparisca", esempio: "La pila scarica ha distrutto la sua energia.", come_riconoscerlo: "L'energia è descritta come distrutta o creata dal nulla.", spiegazione: "L'energia non si crea e non si distrugge, si trasforma. L'energia della pila è diventata luce, movimento e calore che si disperde." },
          { id: "rinnovabile-pulita", errore: "Confondere rinnovabile e senza impatto", esempio: "Le fonti rinnovabili non hanno nessun effetto sull'ambiente.", come_riconoscerlo: "Rinnovabile viene usato come sinonimo di impatto zero.", spiegazione: "Rinnovabile vuol dire che non si esaurisce. Anche una diga o un parco eolico cambiano il paesaggio, ma producono molta meno anidride carbonica dei combustibili fossili." },
        ],
        parole_chiave: ["energia", "energia cinetica", "energia potenziale", "trasformazione", "fonti rinnovabili", "combustibili fossili", "joule"],
      },
    ],
    inglese: [
      {
        id: "en3-present-perfect",
        titolo: "Present perfect",
        prerequisiti: ["en2-past-simple"],
        strategie: [
          { nome: "Parole spia del tempo", quando: "Quando scegli tra present perfect e past simple.", passi: ["Con yesterday, ago, last, in 2019 usa il past simple.", "Con ever, never, already, yet, just, since, for usa il present perfect.", "Present perfect: have o has più participio passato."] },
        ],
        errori_tipici: [
          { id: "present-perfect-yesterday", errore: "Usare il present perfect con un tempo finito", esempio: "I have seen him yesterday.", come_riconoscerlo: "C'è il present perfect con yesterday, ago o last.", spiegazione: "Yesterday dice esattamente quando: il tempo è finito, quindi ci vuole il past simple. «I saw him yesterday»." },
          { id: "since-for", errore: "Confondere since e for", esempio: "I have lived here since three years.", come_riconoscerlo: "Since è usato con una durata, o for con un momento di inizio.", spiegazione: "For va con una durata: for three years. Since va con il momento di inizio: since 2020." },
        ],
        parole_chiave: ["present perfect", "ever", "never", "already", "yet", "just", "since", "for"],
      },
      {
        id: "en3-condizionali",
        titolo: "Periodo ipotetico: zero, first e second conditional",
        prerequisiti: ["en2-futuro", "en2-past-simple"],
        strategie: [
          { nome: "Reale o immaginario?", quando: "Quando scegli il tipo di conditional.", passi: ["Se è sempre vero, zero conditional: if più present, present.", "Se è possibile nel futuro, first: if più present, will.", "Se è immaginario, second: if più past simple, would."] },
        ],
        errori_tipici: [
          { id: "if-will", errore: "Usare will dopo if", esempio: "If it will rain, I will stay at home.", come_riconoscerlo: "Nella frase con if c'è will.", spiegazione: "Nel first conditional, dopo if va il present simple: «If it rains, I will stay at home». Will va solo nell'altra metà." },
          { id: "if-would", errore: "Usare would dopo if", esempio: "If I would be rich, I would travel.", come_riconoscerlo: "Nella frase con if c'è would.", spiegazione: "Nel second conditional dopo if va il past simple: «If I were rich, I would travel». È come in italiano: «se fossi», non «se sarei»." },
        ],
        parole_chiave: ["conditional", "if", "would", "will", "zero conditional", "first conditional", "second conditional"],
      },
      {
        id: "en3-passivo",
        titolo: "La forma passiva",
        prerequisiti: ["en2-past-simple", "en3-present-perfect"],
        strategie: [
          { nome: "Be più participio", quando: "Quando trasformi una frase in passiva.", passi: ["Il complemento oggetto diventa soggetto.", "Metti be nel tempo della frase attiva.", "Aggiungi il participio passato.", "Se serve, chi fa l'azione va dopo by."] },
        ],
        errori_tipici: [
          { id: "passivo-senza-participio", errore: "Usare il verbo base invece del participio", esempio: "The house is build in 1990.", come_riconoscerlo: "Dopo be c'è il verbo base invece del participio passato.", spiegazione: "Il passivo è be più participio: built. E se è successo nel 1990, anche be va al passato: «The house was built in 1990»." },
        ],
        parole_chiave: ["passive", "passive voice", "by", "was built", "is made", "past participle"],
      },
      {
        id: "en3-invalsi",
        titolo: "Comprensione di testi e Preparazione INVALSI di inglese (reading e listening)",
        prerequisiti: ["en3-present-perfect", "en2-past-simple"],
        strategie: [
          { nome: "Prima le domande, poi il testo", quando: "Quando fai un esercizio di reading o di listening.", passi: ["Leggi le domande prima del testo o dell'audio.", "Sottolinea le parole chiave delle domande.", "Cerca nel testo o ascolta solo quelle informazioni.", "Scegli la risposta che dice la stessa cosa con altre parole."] },
          { nome: "Ascolto in due giri", quando: "Quando fai un listening.", passi: ["Al primo ascolto capisci l'argomento e segna le risposte facili.", "Al secondo controlla quelle in dubbio.", "Non lasciare risposte vuote."] },
        ],
        errori_tipici: [
          { id: "parola-trappola", errore: "Scegliere la risposta che ripete una parola del testo", esempio: "Nel testo c'è «Tom doesn't like football», la risposta scelta è «Tom likes football».", come_riconoscerlo: "La risposta scelta contiene le stesse parole del testo ma non lo stesso significato.", spiegazione: "Le domande INVALSI spesso mettono le parole del testo nella risposta che non funziona. Cerca la risposta che ha lo stesso significato, anche con parole diverse." },
          { id: "risposta-da-conoscenze", errore: "Rispondere con quello che sai invece che con il testo", esempio: "Il testo dice che il museo chiude alle 5, la risposta è «alle 6» perché di solito è così.", come_riconoscerlo: "La risposta è plausibile ma non si trova nel testo.", spiegazione: "La prova controlla cosa capisci del testo. Torna al punto del testo che risponde e controlla che la tua scelta sia scritta lì." },
        ],
        parole_chiave: ["invalsi", "reading", "listening", "comprehension", "true or false", "multiple choice", "text"],
      },
    ],
  },
};
