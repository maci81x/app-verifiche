// Avvio offline dell'interfaccia: prima la rete, se manca la copia salvata.
// I dati (Supabase) e la funzione del modello non passano da qui.
// Alza la versione a ogni rilascio, insieme a ?v= in index.html.
const CACHE_NAME = 'app-verifiche-v24';
const ASSETS = [
  '/app-verifiche/',
  '/app-verifiche/index.html',
  '/app-verifiche/style.css?v=24',
  '/app-verifiche/semaforo.js?v=24',
  '/app-verifiche/app.js?v=24',
  '/app-verifiche/libreria.js?v=24',
  '/app-verifiche/stampa.js?v=24',
  '/app-verifiche/aiuto.js?v=24',
  '/app-verifiche/mappa-card.js?v=24',
  '/app-verifiche/figure.js?v=24',
  '/app-verifiche/formule.js?v=24',
  '/app-verifiche/esercizi.js?v=24',
  '/app-verifiche/prova-esercizi.js?v=24',
  '/app-verifiche/compito.js?v=24',
  '/app-verifiche/classe-app.js?v=24',
  '/app-verifiche/poesia.js?v=24',
  '/app-verifiche/invalsi.js?v=24',
  '/app-verifiche/esempi.js?v=24',
  '/app-verifiche/esame.js?v=24',
  '/app-verifiche/italia-mappa.js?v=24',
  '/app-verifiche/geografia.js?v=24',
  '/app-verifiche/lezione.js?v=24',
  '/app-verifiche/manifest.json',
  '/app-verifiche/icons/icon-192.png',
  '/app-verifiche/icons/icon-512.png',
  '/app-verifiche/icons/icon-maskable-512.png',
  '/app-verifiche/icons/apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.hostname.endsWith('supabase.co')) return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok && (url.origin === location.origin || url.hostname === 'cdn.jsdelivr.net')) {
          const copia = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: url.pathname.endsWith('/') }))
  );
});
