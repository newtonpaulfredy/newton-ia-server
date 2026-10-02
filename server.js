// Serveur Newton IA — aucune dépendance, Node 18 ou plus récent.
const http = require('http'), crypto = require('crypto');
const KEY = process.env.ANTHROPIC_API_KEY, MODEL = process.env.MODEL || 'claude-sonnet-5-5';
const ORIGIN = process.env.ALLOWED_ORIGIN || '*', PORT = process.env.PORT || 3000;
// Accepte plusieurs noms de variables pour WhatsApp
const WA_TOKEN = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATS_TOKEN;
const WA_PHONE = process.env.WHATSAPP_PHONE_ID || process.env.PHONE_NUMBER_ID || process.env.PHONE_ID || process.env.PHONE || process.env.PHONE_NUMBER;
const WA_VERIFY = process.env.WHATSAPP_VERIFY_TOKEN || process.env.VERIFY_TOKEN || process.env.VERIFICATION_TOKEN || process.env.VERIF_TOKEN;
const GKEY = process.env.GEMINI_API_KEY, GMODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GROQ = process.env.GROQ_API_KEY; // facultatif : 2e IA gratuite (Groq) utilisée si Gemini est surchargé
const PROVIDER = process.env.PROVIDER || (KEY ? 'anthropic' : GKEY ? 'gemini' : 'groq');
if ((PROVIDER === 'anthropic' && !KEY) || (PROVIDER === 'gemini' && !GKEY) || (PROVIDER === 'groq' && !GROQ)) { console.error('Il manque la clé : GEMINI_API_KEY (gratuit), GROQ_API_KEY ou ANTHROPIC_API_KEY.'); process.exit(1); }

const BASE = "Tu es Newton IA, un assistant camerounais clair, chaleureux et précis. Tu as été créé par AYISSI PAUL FREDY, de l'entreprise NEWTON DESIGN. Si on te demande qui t'a créé, qui est ton créateur ou qui t'a développé, réponds que tu as été créé par AYISSI PAUL FREDY de l'entreprise NEWTON DESIGN. Si on te demande précisément quelle technologie ou quel modèle d'IA tu utilises, dis honnêtement que tu t'appuies sur des modèles d'IA de partenaires, sans inventer de détails. Sois concis et va droit au but, sauf si on te demande des détails. Tu ne crées pas toi-même de fichiers : si on te demande un PDF, rédige le texte final complet et dis à l'utilisateur d'appuyer sur le bouton « PDF » ou « Fichiers » sous ta réponse (Word, Excel, PowerPoint et ZIP y sont aussi) ; si on te demande une affiche, propose le titre, l'accroche, la date, le lieu et le contact, et dis d'utiliser Outils puis « Affiches » dans le menu. Pour créer une image, l'utilisateur doit choisir le mode « Images » dans le menu : hors de ce mode, invite-le à le faire. N'utilise pas de symboles décoratifs inutiles. ";
const LANGS = {
  auto: "Réponds dans la langue de l'utilisateur (français, anglais ou pidgin camerounais).",
  fr: "Réponds en français.", en: "Reply in English.",
  pidgin: "Réponds en pidgin camerounais, simple et naturel."
};
const MODES = {
  chat: "",
  web: " Tu disposes de la recherche web : utilise-la pour répondre avec des informations à jour et cite brièvement tes sources.",
  devoirs: " Tu aides aux devoirs. Si une photo est fournie, lis l'énoncé, résume-le, puis donne la correction étape par étape en expliquant chaque étape. Signale ce que tu lis mal.",
  scolaire: " Tu suis les programmes officiels du Cameroun de la 6ème à la Terminale (sous-systèmes francophone et anglophone) et les examens BEPC, Probatoire et Baccalauréat. Tu n'as pas accès aux archives officielles : ne présente jamais un sujet inventé comme un sujet officiel ; propose des exercices dans le style de l'examen avec un corrigé détaillé, et dis-le clairement.",
  chorale: " Tu aides les chorales et les enfants de chœur : structure des chants liturgiques, accords, transposition, conseils de répétition. Ne reproduis pas de paroles protégées par le droit d'auteur : demande à l'utilisateur de coller les paroles, ou propose des textes du domaine public et des paroles originales.",
  traducteur: " Tu traduis entre français, anglais, ewondo, bassa et fulfulde. Indique ton niveau de confiance pour l'ewondo, le bassa et le fulfulde (moins bien maîtrisés), propose des alternatives, et recommande la relecture par un locuteur natif pour les textes importants."
};
const IMG = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

function sysP(mode, lang, custom) {
  return BASE + (LANGS[lang] || LANGS.auto) + (MODES[mode] || '') + (custom ? " Préférences de l'utilisateur (à respecter) : " + String(custom).slice(0, 600) : '');
}
async function callAnthropic(messages, mode, lang, custom) {
  const msgs = messages.slice(-20).map(m => {
    const text = String(m.content || '').slice(0, 8000), im = typeof m.image === 'string' && m.image.match(IMG);
    return {
      role: m.role === 'user' ? 'user' : 'assistant',
      content: im ? [{ type: 'image', source: { type: 'base64', media_type: im[1], data: im[2] } }, { type: 'text', text: text || 'Analyse cette image.' }] : text
    };
  });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 4096, system: sysP(mode, lang, custom), messages: msgs })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('anthropic ' + r.status);
  return j.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
let gList = null, gAt = 0;
async function geminiModels() { // modèles « flash » disponibles pour ta clé, du plus récent au plus léger
  if (gList && Date.now() - gAt < 600000) return gList;
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': GKEY } });
  const j = await r.json();
  const ok = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace('models/', '')).filter(n => /^gemini-[\d.]+-flash(-lite)?$/.test(n));
  ok.sort((a, b) => parseFloat(b.split('-')[1]) - parseFloat(a.split('-')[1]) || (a.endsWith('-lite') - b.endsWith('-lite')));
  gList = [process.env.GEMINI_MODEL, ...ok].filter((x, i, a) => x && a.indexOf(x) === i); gAt = Date.now();
  return gList;
}
async function callGemini(messages, mode, lang, custom) {
  let contents = messages.slice(-20).map(m => {
    const text = String(m.content || '').slice(0, 8000), im = typeof m.image === 'string' && m.image.match(IMG), parts = [];
    if (im) parts.push({ inlineData: { mimeType: im[1], data: im[2] } });
    parts.push({ text: text || 'Analyse cette image.' });
    return { role: m.role === 'user' ? 'user' : 'model', parts };
  });
  while (contents.length && contents[0].role !== 'user') contents.shift();
  const mk = tools => JSON.stringify(Object.assign({ systemInstruction: { parts: [{ text: sysP(mode, lang, custom) }] }, contents, generationConfig: { maxOutputTokens: 4096 } }, tools ? { tools: [{ google_search: {} }] } : {}));
  let tools = mode === 'web', body = mk(tools), last = 'gemini';
  const rounds = GROQ ? 1 : 3, per = GROQ ? 2 : 3; // avec Groq en secours, on ne perd pas de temps
  for (let round = 0; round < rounds; round++) {
    let models = [];
    try { models = await geminiModels(); } catch (e) { last = 'gemini réseau'; }
    for (const m of models.slice(0, per)) {
      let r, j;
      try { r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', { method: 'POST', headers: { 'x-goog-api-key': GKEY, 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(25000) }); j = await r.json(); }
      catch (e) { last = 'gemini réseau'; continue; }
      if (r.ok) {
        const cand = (j.candidates || [])[0] || {};
        let t = ((cand.content || {}).parts || []).map(p => p.text || '').join('');
        const src = [...new Set((((cand.groundingMetadata || {}).groundingChunks) || []).map(c => c.web && c.web.title).filter(Boolean))].slice(0, 5);
        if (t && src.length) t += '\n\nSources : ' + src.join(', ');
        console.log('gemini ok avec', m);
        return t || "Je n'ai pas pu répondre à cette demande. Reformule ou change de sujet.";
      }
      last = 'gemini ' + r.status; console.error(last, m, JSON.stringify(j).slice(0, 200));
      if (r.status === 400 && tools) { tools = false; body = mk(false); continue; }
      if (r.status === 400 || r.status === 403) throw new Error(last);
    }
    if (round < rounds - 1) await sleep(1000 * (round + 1));
  }
  throw new Error(last);
}
async function callGroq(messages, mode, lang, custom) { // 2e IA gratuite (API compatible OpenAI)
  const rec = messages.slice(-12), lastM = rec[rec.length - 1] || {}, hasImg = typeof lastM.image === 'string' && IMG.test(lastM.image);
  const msgs = [{ role: 'system', content: sysP(mode, lang, custom) }].concat(rec.map((m, i) => {
    const text = String(m.content || '').slice(0, 8000) || 'Analyse cette image.';
    return { role: m.role === 'user' ? 'user' : 'assistant', content: hasImg && i === rec.length - 1 ? [{ type: 'text', text }, { type: 'image_url', image_url: { url: m.image } }] : text };
  }));
  const model = hasImg ? (process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct') : (process.env.GROQ_MODEL || 'openai/gpt-oss-20b');
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + GROQ, 'content-type': 'application/json' },
    body: JSON.stringify(Object.assign({ model, messages: msgs, max_tokens: 4096 }, /gpt-oss/.test(model) ? { reasoning_effort: 'low' } : {}))
  });
  const j = await r.json();
  if (!r.ok) { console.error('groq', r.status, JSON.stringify(j).slice(0, 200)); throw new Error('groq ' + r.status); }
  console.log('groq ok avec', model);
  return (j.choices?.[0]?.message?.content) || "Je n'ai pas pu répondre à cette demande.";
}
let gBad = 0;
const withNote = (t, mode) => mode === 'web' ? t + '\n\n(Recherche web indisponible pour le moment : réponse basée sur les connaissances de Newton.)' : t;
async function callClaude(m, mode, lang, custom) {
  if (PROVIDER === 'anthropic') return callAnthropic(m, mode, lang, custom);
  if (PROVIDER === 'groq') return callGroq(m, mode, lang, custom);
  if (GROQ && Date.now() < gBad) return withNote(await callGroq(m, mode, lang, custom), mode);
  try { return await callGemini(m, mode, lang, custom); }
  catch (e) { if (!GROQ) throw e; gBad = Date.now() + 60000; console.error('Gemini indisponible (' + e.message + '), bascule vers Groq'); return withNote(await callGroq(m, mode, lang, custom), mode); }
}

const hits = new Map(); // 20 messages par minute et par adresse ou numéro
function limited(id) {
  if (hits.size > 5000) hits.clear();
  const now = Date.now(), h = (hits.get(id) || []).filter(t => now - t < 60000);
  h.push(now); hits.set(id, h); return h.length > 20;
}
function send(res, code, obj, cors = true) {
  const h = { 'Content-Type': 'application/json' };
  if (cors) Object.assign(h, { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' });
  res.writeHead(code, h); res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  const parts = []; let n = 0;
  req.on('data', c => { n += c.length; if (n > 4e6) req.destroy(); else parts.push(c); });
  req.on('end', () => cb(Buffer.concat(parts)));
}

/* ---------- WhatsApp (API Cloud de Meta) ---------- */
const wa = new Map();
const GRAPH = 'https://graph.facebook.com/v21.0/';
async function waSend(to, text) {
  for (let i = 0; i < text.length; i += 3800)
    await fetch(GRAPH + WA_PHONE + '/messages', {
      method: 'POST', headers: { Authorization: 'Bearer ' + WA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(i, i + 3800) } })
    });
}
async function waImage(id) {
  const m = await (await fetch(GRAPH + id, { headers: { Authorization: 'Bearer ' + WA_TOKEN } })).json();
  const b = await fetch(m.url, { headers: { Authorization: 'Bearer ' + WA_TOKEN } });
  return 'data:' + (m.mime_type || 'image/jpeg') + ';base64,' + Buffer.from(await b.arrayBuffer()).toString('base64');
}
function okSig(raw, sig) {
  const s = process.env.WHATSAPP_APP_SECRET; if (!s) return true;
  const h = 'sha256=' + crypto.createHmac('sha256', s).update(raw).digest('hex');
  return !!sig && sig.length === h.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(h));
}
async function handleWA(m) {
  const from = m.from;
  try {
    if (limited('wa' + from)) return waSend(from, 'Trop de messages. Réessaie dans une minute.');
    let e, mode = 'chat';
    if (m.type === 'text') e = { role: 'user', content: m.text.body };
    else if (m.type === 'image') { e = { role: 'user', content: m.image.caption || 'Corrige cet exercice étape par étape.', image: await waImage(m.image.id) }; mode = 'devoirs'; }
    else return waSend(from, 'Je comprends les messages écrits et les photos.');
    if (wa.size > 2000) wa.clear();
    const h = wa.get(from) || [], reply = await callClaude([...h, e], mode, 'auto');
    wa.set(from, [...h, { role: 'user', content: e.content }, { role: 'assistant', content: reply }].slice(-10));
    await waSend(from, reply);
  } catch (err) { console.error(err.message); }
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<h1>Newton IA OK</h1><p>Serveur en ligne sur le port ' + PORT + '</p><p>Routes : /chat, /image, /webhook et /whatsapp</p><p>Phone : ' + (WA_PHONE ? 'OK' : 'MANQUE') + ' Token : ' + (WA_TOKEN ? 'OK' : 'MANQUE') + ' Verify : ' + (WA_VERIFY ? 'OK' : 'MANQUE') + '</p>');
  }
  if (url.pathname === '/image') {
    const cors = { 'Access-Control-Allow-Origin': ORIGIN };
    if (req.method === 'OPTIONS') { res.writeHead(204, Object.assign({ 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, cors)); return res.end(); }
    const fail = (c, msg) => { res.writeHead(c, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors)); res.end(JSON.stringify({ error: msg })); };
    const p = (url.searchParams.get('prompt') || '').slice(0, 400);
    if (!p) return fail(400, "Décris l'image à créer.");
    if (limited('img' + req.socket.remoteAddress)) return fail(429, 'Trop de demandes. Réessaie dans une minute.');
    return (async () => {
      try {
        const seed = String(url.searchParams.get('seed') || '1').replace(/\D/g, '').slice(0, 9) || '1';
        const r = await fetch('https://image.pollinations.ai/prompt/' + encodeURIComponent(p) + '?width=768&height=768&nologo=true&seed=' + seed, { signal: AbortSignal.timeout(50000) });
        const ct = r.headers.get('content-type') || '';
        if (!r.ok || !ct.startsWith('image/')) return fail(502, "Le service d'images est occupé. Réessaie dans un instant.");
        const buf = Buffer.from(await r.arrayBuffer());
        res.writeHead(200, Object.assign({ 'Content-Type': ct, 'Cache-Control': 'public, max-age=86400' }, cors)); res.end(buf);
      } catch (e) { fail(504, "L'image met trop de temps à arriver. Réessaie."); }
    })();
  }
  if (url.pathname === '/whatsapp' || url.pathname === '/webhook') {
    if (!WA_TOKEN || !WA_PHONE || !WA_VERIFY) { console.error('Variables WhatsApp manquantes : TOKEN=', !!WA_TOKEN, 'PHONE=', !!WA_PHONE, 'VERIFY=', !!WA_VERIFY); return send(res, 500, { error: 'Variables manquantes' }, false); }
    if (req.method === 'GET') {
      if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === WA_VERIFY) { console.log('Webhook vérifié'); res.writeHead(200); return res.end(url.searchParams.get('hub.challenge')); }
      res.writeHead(403); return res.end('Token invalide');
    }
    return readBody(req, raw => {
      if (!okSig(raw, req.headers['x-hub-signature-256'])) { res.writeHead(403); return res.end(); }
      res.writeHead(200); res.end();
      try { for (const en of JSON.parse(raw).entry || []) for (const ch of en.changes || []) for (const m of ch.value.messages || []) handleWA(m); } catch (e) {}
    });
  }
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST' || url.pathname !== '/chat') return send(res, 404, { reply: 'Introuvable.' });
  if (limited(req.socket.remoteAddress)) return send(res, 429, { reply: 'Trop de messages. Réessaie dans une minute.' });
  readBody(req, async raw => {
    try {
      const { messages, mode, lang, custom } = JSON.parse(raw);
      send(res, 200, { reply: await callClaude(messages || [], mode, lang, custom) });
    } catch (e) { console.error('chat', e.message); send(res, 400, { reply: /50\d|429|réseau/.test(e.message) ? 'Newton est très sollicité en ce moment (' + e.message + '). Réessaie dans quelques secondes.' : 'Service IA indisponible (' + e.message + ').' }); }
  });
}).listen(PORT, () => console.log('Newton écoute sur le port ' + PORT + ' Phone:' + WA_PHONE));
