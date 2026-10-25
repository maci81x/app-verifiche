#!/usr/bin/env python3
"""Prova la lettura di foto vere passando dalla Edge Function vera, senza salvare niente.

    python3 scripts/prova-foto.py --materia storia --argomento "La peste del Trecento" foto1.jpg foto2.HEIC

Fa quello che fa l'app: porta ogni foto a 2000 px sul lato lungo raddrizzandola
secondo l'orientamento salvato dal telefono, la manda alla funzione `modello` a
gruppi di quattro con un secondo tentativo dopo 1,8 secondi, poi chiede i
concetti. Accede come l'utente di prova Anna di .env.local. Stampa tutto a schermo.

Serve Pillow (già presente su questo Mac). Gli HEIC dell'iPhone li converte sips.
"""
import argparse, base64, io, json, os, subprocess, sys, tempfile, time, urllib.error, urllib.request
from PIL import Image, ImageOps

LATO_MAX, PER_GRUPPO, ATTESA_RIPROVA = 2000, 4, 1.8
GRUPPO_ILLEGGIBILE = "[gruppo di foto non leggibile]"
RADICE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def leggi_env():
    env = {}
    with open(os.path.join(RADICE, ".env.local")) as f:
        for riga in f:
            if "=" in riga and not riga.lstrip().startswith("#"):
                k, v = riga.strip().split("=", 1)
                env[k] = v
    return env


def chiama(url, corpo, intestazioni):
    req = urllib.request.Request(url, json.dumps(corpo).encode(), {"content-type": "application/json", **intestazioni})
    try:
        with urllib.request.urlopen(req, timeout=170) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.load(e)
        except ValueError:
            return e.code, {"errore": e.reason}


class Definitivo(Exception):
    pass


def prepara(percorso, i, tmp):
    sorgente = percorso
    if percorso.lower().endswith((".heic", ".heif")):
        sorgente = os.path.join(tmp, f"{i}.jpg")
        subprocess.run(["sips", "-s", "format", "jpeg", percorso, "--out", sorgente], check=True, capture_output=True)
    img = Image.open(sorgente)
    prima, orient = img.size, img.getexif().get(0x0112, "-")
    img = ImageOps.exif_transpose(img).convert("RGB")  # come il browser: raddrizza secondo l'EXIF
    img.thumbnail((LATO_MAX, LATO_MAX))                # mai ingrandire
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=92)
    print(f"  {i + 1}. {os.path.basename(percorso)}: {prima[0]}×{prima[1]} (EXIF {orient}) → "
          f"{img.size[0]}×{img.size[1]}, {len(buf.getvalue()) // 1024} KB")
    return base64.b64encode(buf.getvalue()).decode()


def main():
    p = argparse.ArgumentParser(description="Prova la lettura di foto vere senza salvare niente.")
    p.add_argument("--materia", required=True)
    p.add_argument("--argomento", required=True)
    p.add_argument("foto", nargs="+")
    a = p.parse_args()

    env = leggi_env()
    url, chiave = env["SUPABASE_URL"], env["SUPABASE_PUBLISHABLE_KEY"]
    s, r = chiama(f"{url}/auth/v1/token?grant_type=password",
                  {"email": env["TEST_ANNA_EMAIL"], "password": env["TEST_ANNA_PASSWORD"]}, {"apikey": chiave})
    if s != 200:
        sys.exit(f"Accesso non riuscito: {r}")
    auth = {"apikey": chiave, "authorization": f"Bearer {r['access_token']}"}
    funzione = f"{url}/functions/v1/modello"
    t0 = time.time()
    tempo = lambda: f"{time.time() - t0:.1f}s"

    def modello(corpo):
        s, r = chiama(funzione, corpo, auth)
        if s in (401, 403, 429):
            raise Definitivo(f"{s} {r.get('errore')}")
        if s != 200:
            raise RuntimeError(f"{s} {r.get('errore')}")
        return r

    def con_riprova(f):
        try:
            return f()
        except Definitivo:
            raise
        except Exception as e:
            print(f"     primo tentativo fallito ({e}), riprovo")
            time.sleep(ATTESA_RIPROVA)
            return f()

    print(f"\nMateria: {a.materia} · Argomento: {a.argomento}\n\nFoto")
    with tempfile.TemporaryDirectory() as tmp:
        immagini = [prepara(f, i, tmp) for i, f in enumerate(a.foto)]

    try:
        print("\nLettura")
        testi = []
        for n in range(0, len(immagini), PER_GRUPPO):
            g = immagini[n:n + PER_GRUPPO]
            print(f"  Leggo le foto {n + 1}-{n + len(g)} di {len(immagini)}  ({tempo()})")
            try:
                t = con_riprova(lambda: modello({"azione": "trascrivi", "immagini": g})["trascrizione"])
                if t:
                    testi.append(t)
            except Definitivo:
                raise
            except Exception as e:
                print(f"     gruppo perso: {e}")
                testi.append(GRUPPO_ILLEGGIBILE)
        trascrizione = "\n\n".join(testi)
        print(f"\n{'=' * 20} TESTO ESTRATTO {'=' * 20}\n{trascrizione}\n{'=' * 56}")

        print(f"\nSeparo i concetti  ({tempo()})")
        r = modello({"azione": "concetti", "materia": a.materia, "titolo": a.argomento, "testo": trascrizione,
                     "pagine": len(immagini)})
        piatto = lambda s: " ".join(s.lower().split())
        print(f"\n{'=' * 20} CONCETTI ({len(r['concetti'])}) {'=' * 20}")
        for i, c in enumerate(r["concetti"], 1):
            nota = "" if piatto(c["ancora"]) in piatto(trascrizione) else "  ⚠ non compare identica nel testo"
            print(f"\n{i}. {c['titolo']}  {'●' * c['peso']}{'○' * (3 - c['peso'])}")
            print(f"   {c['descrizione']}")
            print(f"   ancora: «{c['ancora']}»{nota}")
            if c.get("errore_appunti"):
                print(f"   ✎ errore negli appunti: {c['errore_appunti']}")
        if r.get("senza_ancora") or r.get("non_ancorati"):
            print(f"\nScartati: {r.get('senza_ancora', 0)} senza ancora, {r.get('non_ancorati', 0)} con l'ancora che non regge sul testo")
        print(f"\nFatto in {tempo()}. Niente è stato salvato.\n")
    except Definitivo as e:
        msg = {"403 not_granted": "la funzione non ha la chiave Anthropic (segreto ANTHROPIC_API_KEY mancante o non valido)",
               "429 rate_limited": "troppe richieste in poco tempo, aspetta un minuto"}.get(str(e), str(e))
        sys.exit(f"\nErrore: {msg}")


if __name__ == "__main__":
    main()
