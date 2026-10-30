// Formule degli esercizi di matematica (issue #5, fetta #7). Il modello scrive i passaggi
// in LaTeX; l'app li mostra con KaTeX da CDN, caricato solo quando si apre una vista di
// matematica. Finché KaTeX non c'è (o se non si carica) la formula resta leggibile come
// testo semplice: \frac{3}{4} → 3/4, \sqrt{36} → √36, 5^{2} → 5².
// Script classico, senza dipendenze: lo caricano l'app e i test.

const KATEX = {
  js: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js",
  jsSri: "sha384-7zkQWkzuo3B5mTepMUcHkMB5jZaolc2xDwL6VFqjFALcbeS9Ggm/Yr2r3Dy4lfFg",
  css: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css",
  cssSri: "sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+",
  attesaMs: 8000,
};

const escFormula = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);

const APICI_FORMULE = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const SIMBOLI_LATEX = { cdot: "·", times: "×", div: ":", pi: "π", geq: "≥", leq: "≤", ge: "≥", le: "≤", neq: "≠", approx: "≈", pm: "±", degree: "°", circ: "°" };

// Il gruppo fra graffe che comincia in s[i] ("{"): restituisce contenuto e posizione dopo.
function gruppoGraffe(s, i) {
  if (s[i] !== "{") return null;
  let livello = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") livello++;
    else if (s[j] === "}" && --livello === 0) return { dentro: s.slice(i + 1, j), dopo: j + 1 };
  }
  return null;
}

const semplice = (t) => /^[\w.,·]+$/.test(t.trim());
const tonde = (t) => (semplice(t) ? t.trim() : "(" + t.trim() + ")");

// Sostituisce ogni \comando{...}{...} con quello che restituisce f(gruppi), dal più interno.
function sostituisciComando(s, comando, gruppi, f) {
  for (let giri = 0; giri < 50; giri++) {
    const i = s.lastIndexOf("\\" + comando + "{");
    if (i < 0) return s;
    const presi = [];
    let p = i + comando.length + 1;
    for (let k = 0; k < gruppi; k++) {
      const g = gruppoGraffe(s, p);
      if (!g) return s;
      presi.push(g.dentro);
      p = g.dopo;
    }
    s = s.slice(0, i) + f(presi) + s.slice(p);
  }
  return s;
}

function latexATesto(latex) {
  let s = String(latex || "").replace(/\\left|\\right/g, "");
  s = sostituisciComando(s, "text", 1, ([t]) => t);
  s = sostituisciComando(s, "mathrm", 1, ([t]) => t);
  s = sostituisciComando(s, "frac", 2, ([a, b]) => tonde(a) + "/" + tonde(b));
  s = sostituisciComando(s, "dfrac", 2, ([a, b]) => tonde(a) + "/" + tonde(b));
  s = sostituisciComando(s, "sqrt", 1, ([t]) => "√" + tonde(t));
  s = s.replace(/\^\{([^{}]*)\}|\^(\d)/g, (_, g, d) => {
    const e = (g ?? d).trim();
    return /^\d$/.test(e) ? APICI_FORMULE[+e] : "^" + e;
  });
  s = s.replace(/\\([a-zA-Z]+)/g, (_, nome) => SIMBOLI_LATEX[nome] ?? (nome === "quad" || nome === "qquad" ? " " : nome));
  s = s.replace(/\\[,;:! ]/g, " ").replace(/[{}]/g, "");
  return s.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").trim();
}

// HTML di una formula: testo leggibile subito, KaTeX lo sostituisce appena è pronto.
function formulaHtml(latex) {
  if (!latex) return "";
  return '<span class="formula" data-latex="' + escFormula(latex) + '">' + escFormula(latexATesto(latex)) + "</span>";
}

let katexPronto = null;
// Carica KaTeX una volta sola; risolve false se non arriva (offline, CDN giù): si resta sul testo.
function caricaKatex() {
  if (typeof katex !== "undefined") return Promise.resolve(true);
  if (katexPronto) return katexPronto;
  katexPronto = new Promise((risolvi) => {
    const css = document.getElementById("katex-css") || document.createElement("link");
    Object.assign(css, { id: "katex-css", rel: "stylesheet", href: KATEX.css, integrity: KATEX.cssSri, crossOrigin: "anonymous" });
    const js = document.createElement("script");
    Object.assign(js, { src: KATEX.js, integrity: KATEX.jsSri, crossOrigin: "anonymous", async: true });
    js.onload = () => risolvi(typeof katex !== "undefined");
    js.onerror = () => { katexPronto = null; js.remove(); risolvi(false); };
    document.head.appendChild(css);
    document.head.appendChild(js);
    setTimeout(() => risolvi(typeof katex !== "undefined"), KATEX.attesaMs);
  });
  return katexPronto;
}

// Disegna con KaTeX le formule dentro radice; una formula che KaTeX non capisce resta testo.
function rendiFormule(radice) {
  if (typeof katex === "undefined" || !radice) return;
  radice.querySelectorAll(".formula[data-latex]").forEach((el) => {
    try {
      katex.render(el.dataset.latex, el, { throwOnError: true, displayMode: false });
      el.removeAttribute("data-latex");
    } catch (e) {
      el.title = "formula mostrata come testo";
    }
  });
}
