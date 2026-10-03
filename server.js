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

/* ===== Actualités : Newton connaît l'actualité récente ===== */
const FRESH = /actualit|nouvelles?\b|derni[èe]res? (infos?|nouvelles?)|aujourd'?hui|ce matin|cette semaine|hier\b|en ce moment|r[ée]cemment|breaking|\bnews\b|m[ée]t[ée]o|\bscores?\b|r[ée]sultats? d|classement|\bmatch|taux de change|cours (du|de la|des|d')|prix (du|de la|des)|[ée]lections?|pr[ée]sident|premier ministre|gouvernement|20(2[5-9]|3\d)/i;
const newsCache = new Map();
const decodeX = t => t.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '').trim();
async function newsItems(q) {
  const key = q.toLowerCase(), c = newsCache.get(key); if (c && Date.now() - c.t < 300000) return c.v;
  let v = null;
  try {
    const r = await fetch('https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:7d') + '&hl=fr&gl=CM&ceid=CM:fr', { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewtonIA)' } });
    if (r.ok) {
      const x = await r.text(), g = (b, t) => decodeX(((b.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>')) || [])[1]) || '');
      v = [...x.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8).map(m => ({ t: g(m[1], 'title'), s: g(m[1], 'source'), d: g(m[1], 'pubDate').slice(0, 16) })).filter(i => i.t);
      if (!v.length) v = null;
    }
  } catch (e) {}
  if (newsCache.size > 200) newsCache.clear();
  newsCache.set(key, { t: Date.now(), v }); return v;
}
async function freshCtx(messages, mode) {
  const last = [...(messages || [])].reverse().find(m => m && m.role === 'user'), raw = String((last && last.content) || '');
  if (!(mode === 'web' || FRESH.test(raw))) return '';
  let q = raw.replace(/\[Contenu du document\][\s\S]*$/, '').replace(/\([^)]{40,}\)\s*$/, '').replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  if (q.length < 30 && !/cameroun|yaound|douala/i.test(q)) q += ' Cameroun';
  const it = await newsItems(q); if (!it) return '';
  return 'Informations récentes trouvées sur le web (Google Actualités) pour « ' + q + ' » :\n' + it.map(i => '- ' + i.t + (i.s ? ' — ' + i.s : '') + (i.d ? ' (' + i.d + ')' : '')).join('\n') + '\nUtilise ces éléments pour répondre à la question sur l\'actualité ; ne les invente pas et ne les complète pas avec des faits non fournis.';
}
const dateFR = () => { try { return new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Douala', dateStyle: 'full', timeStyle: 'short' }); } catch (e) { return new Date().toISOString(); } };
function sysP(mode, lang, custom, extra) {
  return BASE + (LANGS[lang] || LANGS.auto) + (MODES[mode] || '') + " Date et heure actuelles (Cameroun) : " + dateFR() + ". Tes connaissances internes ont une date limite : pour tout fait récent, appuie-toi sur les actualités ou résultats web fournis, cite le média et la date, et dis honnêtement quand l'information peut être dépassée." + (extra ? "\n\n" + extra : '') + (custom ? " Préférences de l'utilisateur (à respecter) : " + String(custom).slice(0, 600) : '');
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
    body: JSON.stringify({ model: MODEL, max_tokens: 4096, system: sysP(mode, lang, custom, messages.extra), messages: msgs })
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
  const mk = tools => JSON.stringify(Object.assign({ systemInstruction: { parts: [{ text: sysP(mode, lang, custom, messages.extra) }] }, contents, generationConfig: { maxOutputTokens: 4096 } }, tools ? { tools: [{ google_search: {} }] } : {}));
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
  const msgs = [{ role: 'system', content: sysP(mode, lang, custom, messages.extra) }].concat(rec.map((m, i) => {
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
  if (m.extra === undefined) m.extra = await freshCtx(m, mode).catch(() => '');
  if (PROVIDER === 'anthropic') return callAnthropic(m, mode, lang, custom);
  if (PROVIDER === 'groq') return callGroq(m, mode, lang, custom);
  if (GROQ && Date.now() < gBad) return withNote(await callGroq(m, mode, lang, custom), mode);
  try { return await callGemini(m, mode, lang, custom); }
  catch (e) { if (!GROQ) throw e; gBad = Date.now() + 60000; console.error('Gemini indisponible (' + e.message + '), bascule vers Groq'); return withNote(await callGroq(m, mode, lang, custom), mode); }
}

const hits = new Map(); // 20 messages par minute et par adresse ou numéro
function limited(id, max = 20) {
  if (hits.size > 5000) hits.clear();
  const now = Date.now(), h = (hits.get(id) || []).filter(t => now - t < 60000);
  h.push(now); hits.set(id, h); return h.length > max;
}
function send(res, code, obj, cors = true) {
  const h = { 'Content-Type': 'application/json' };
  if (cors) Object.assign(h, { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' });
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

/* ===== Comptes et base de données chiffrée (Supabase) ===== */
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, ''), SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const AUTH_SECRET = process.env.AUTH_SECRET || '', DATA_KEY = process.env.DATA_KEY || '';
const DB_ON = !!(SB_URL && SB_KEY && AUTH_SECRET && DATA_KEY);
const b64u = b => Buffer.from(b).toString('base64url');
function signTok(p) { const a = b64u(JSON.stringify(p)); return a + '.' + crypto.createHmac('sha256', AUTH_SECRET).update(a).digest('base64url'); }
function readTok(h) {
  const m = /^Bearer\s+(\S+)$/.exec(h || ''); if (!m || !DB_ON) return null;
  const [a, s] = m[1].split('.'); if (!a || !s) return null;
  const e = crypto.createHmac('sha256', AUTH_SECRET).update(a).digest('base64url');
  if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null;
  try { const p = JSON.parse(Buffer.from(a, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch (e) { return null; }
}
function hashPw(pw) { const salt = crypto.randomBytes(16); return salt.toString('hex') + ':' + crypto.scryptSync(pw, salt, 32).toString('hex'); }
function checkPw(pw, st) { const [s, h] = String(st).split(':'); if (!s || !h) return false; const x = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 32), y = Buffer.from(h, 'hex'); return x.length === y.length && crypto.timingSafeEqual(x, y); }
const ukey = uid => crypto.createHash('sha256').update(DATA_KEY + '|' + uid).digest();
function enc(uid, txt) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', ukey(uid), iv), e = Buffer.concat([c.update(txt, 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), e]).toString('base64'); }
function dec(uid, b64) { const b = Buffer.from(b64, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', ukey(uid), b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); }
async function sb(path, o = {}) {
  const h = { apikey: SB_KEY, 'Content-Type': 'application/json' }; if (SB_KEY.startsWith('eyJ')) h.Authorization = 'Bearer ' + SB_KEY; if (o.prefer) h.Prefer = o.prefer;
  const r = await fetch(SB_URL + '/rest/v1/' + path, { method: o.method || 'GET', headers: h, body: o.body ? JSON.stringify(o.body) : undefined, signal: AbortSignal.timeout(20000) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
  if (!r.ok) { console.error('supabase', r.status, t.slice(0, 200)); throw new Error('db ' + r.status); }
  return j;
}
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
function readJson(req, max = 6e6) {
  return new Promise((ok, ko) => { const ps = []; let n = 0; req.on('data', c => { n += c.length; if (n > max) { ko(new Error('trop gros')); req.destroy(); } else ps.push(c); }); req.on('end', () => { try { ok(JSON.parse(Buffer.concat(ps).toString() || '{}')); } catch (e) { ko(new Error('json')); } }); req.on('error', ko); });
}
const session = row => ({ token: signTok({ uid: row.id, name: row.name, exp: Date.now() + 30 * 864e5 }), user: { id: row.id, name: row.name, email: row.email } });
async function api(req, res, url) {
  const p = url.pathname, m = req.method, ip = req.socket.remoteAddress;
  if (p === '/auth/status') return send(res, 200, { db: DB_ON, edit: !!GKEY });
  if (p === '/edit') return handleEdit(req, res);
  if (!DB_ON) return send(res, 503, { error: "La base de données n'est pas encore configurée sur le serveur." });
  const bad = (c, msg) => send(res, c, { error: msg });
  if (p === '/auth/register' && m === 'POST') {
    if (limited('au' + ip, 8)) return bad(429, 'Trop de tentatives. Réessaie dans une minute.');
    const b = await readJson(req, 1e5), email = clean(b.email, 120).toLowerCase(), name = clean(b.name, 40), pw = String(b.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2 || pw.length < 8 || pw.length > 100) return bad(400, 'Vérifie ton prénom, ton e-mail et un mot de passe de 8 caractères minimum.');
    const ex = await sb('app_users?email=eq.' + encodeURIComponent(email) + '&select=id');
    if (ex && ex.length) return bad(409, 'Un compte existe déjà avec cet e-mail.');
    const row = (await sb('app_users', { method: 'POST', body: { name, email, pass_hash: hashPw(pw) }, prefer: 'return=representation' }))[0];
    return send(res, 200, session(row));
  }
  if (p === '/auth/login' && m === 'POST') {
    if (limited('au' + ip, 8)) return bad(429, 'Trop de tentatives. Réessaie dans une minute.');
    const b = await readJson(req, 1e5), email = clean(b.email, 120).toLowerCase(), pw = String(b.password || '');
    const rows = await sb('app_users?email=eq.' + encodeURIComponent(email) + '&select=id,name,email,pass_hash');
    if (!rows || !rows.length || !checkPw(pw, rows[0].pass_hash)) return bad(401, 'E-mail ou mot de passe incorrect.');
    return send(res, 200, session(rows[0]));
  }
  const u = readTok(req.headers.authorization);
  if (!u) return bad(401, 'Session expirée. Reconnecte-toi.');
  if (limited('sy' + u.uid, 240)) return bad(429, 'Trop de requêtes. Réessaie dans une minute.');
  if (p === '/me') {
    if (m === 'GET') { const r = await sb('app_users?id=eq.' + u.uid + '&select=id,name,email'); return r && r.length ? send(res, 200, { user: r[0] }) : bad(401, 'Compte introuvable.'); }
    if (m === 'POST') { const b = await readJson(req, 1e4), name = clean(b.name, 40); if (name.length < 2) return bad(400, 'Prénom trop court.'); const r = await sb('app_users?id=eq.' + u.uid, { method: 'PATCH', body: { name }, prefer: 'return=representation' }); return send(res, 200, session(r[0])); }
    if (m === 'DELETE') { await sb('app_users?id=eq.' + u.uid, { method: 'DELETE' }); return send(res, 200, { ok: true }); }
  }
  if (p === '/sync' && m === 'GET') {
    const rows = await sb('app_chats?user_id=eq.' + u.uid + '&select=id,data,updated_at&order=updated_at.desc&limit=500'), items = [];
    for (const r of rows || []) { try { items.push({ id: r.id, t: Number(r.updated_at), d: dec(u.uid, r.data) }); } catch (e) {} }
    return send(res, 200, { items });
  }
  const mm = /^\/sync\/([\w-]{1,40})$/.exec(p);
  if (mm && m === 'PUT') {
    const b = await readJson(req, 6e6); if (typeof b.d !== 'string' || b.d.length > 5e6) return bad(400, 'Données invalides.');
    await sb('app_chats?on_conflict=user_id,id', { method: 'POST', body: { user_id: u.uid, id: mm[1], data: enc(u.uid, b.d), updated_at: Math.floor(Number(b.t) || Date.now()) }, prefer: 'resolution=merge-duplicates' });
    return send(res, 200, { ok: true });
  }
  if (mm && m === 'DELETE') { await sb('app_chats?user_id=eq.' + u.uid + '&id=eq.' + encodeURIComponent(mm[1]), { method: 'DELETE' }); return send(res, 200, { ok: true }); }
  return bad(404, 'Introuvable.');
}
/* ===== Retouche de photo (modèle d'images Gemini) ===== */
let gImg = null;
async function imgModel() {
  if (process.env.GEMINI_IMAGE_MODEL) return process.env.GEMINI_IMAGE_MODEL;
  if (gImg) return gImg;
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': GKEY } }), j = await r.json();
  const c = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', '')).filter(n => /image/.test(n) && !/imagen|embed/.test(n));
  c.sort((a, b) => (/flash/.test(b) - /flash/.test(a)) || b.localeCompare(a));
  return (gImg = c[0] || null);
}
const fr = msg => Object.assign(new Error('fr'), { fr: msg });
async function editImage(dataUrl, prompt) {
  const im = IMG.exec(dataUrl || ''); if (!im) throw fr('Photo invalide : envoie une image JPEG, PNG ou WebP.');
  if (!GKEY) throw fr("La retouche d'images demande une clé Gemini sur le serveur.");
  const model = await imgModel(); if (!model) throw fr("Ta clé Gemini n'a accès à aucun modèle de retouche d'images pour le moment.");
  const instr = "Retouche cette photo réelle. Conserve EXACTEMENT le visage, l'identité, la pose, les proportions, l'arrière-plan, l'éclairage et le style photographique de l'image d'origine : le résultat doit rester une vraie photographie réaliste, jamais un dessin, une illustration ni un rendu 3D. Modifie uniquement ce qui est demandé : " + prompt;
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', { method: 'POST', headers: { 'x-goog-api-key': GKEY, 'content-type': 'application/json' }, signal: AbortSignal.timeout(90000),
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ inlineData: { mimeType: im[1], data: im[2] } }, { text: instr }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('edit', r.status, JSON.stringify(j).slice(0, 200)); throw fr(r.status === 429 ? "Le quota gratuit de retouche d'images est atteint. Réessaie plus tard." : r.status === 403 || r.status === 404 ? "Ta clé Gemini n'a pas accès à la retouche d'images (modèle « image » de Google AI Studio)." : 'La retouche a échoué (code ' + r.status + ').'); }
  const parts = ((j.candidates || [])[0] || {}).content ? (j.candidates[0].content.parts || []) : [];
  const ip = parts.find(p => p.inlineData || p.inline_data); if (!ip) throw fr("Le modèle n'a pas renvoyé d'image. Reformule ta demande, par exemple : « ajoute une veste bleue » ou « change l'arrière-plan en plage ».");
  const d = ip.inlineData || ip.inline_data;
  return { image: 'data:' + (d.mimeType || d.mime_type || 'image/png') + ';base64,' + d.data, note: parts.filter(p => p.text).map(p => p.text).join(' ').slice(0, 300) };
}
async function handleEdit(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non autorisée.' });
  if (limited('ed' + req.socket.remoteAddress, 6)) return send(res, 429, { error: 'Trop de retouches. Réessaie dans une minute.' });
  try { const b = await readJson(req, 6e6); const out = await editImage(b.image, clean(b.prompt, 500) || 'Améliore légèrement la photo.'); return send(res, 200, out); }
  catch (e) { return send(res, e.fr ? 422 : 500, { error: e.fr || 'La retouche a échoué.' }); }
}
/* ===== Réponses en flux (affichage au fil de l'écriture) ===== */
async function* sseLines(body) {
  let buf = ''; const dec = new TextDecoder();
  for await (const ch of body) { buf += dec.decode(ch, { stream: true }); let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l.startsWith('data:')) yield l.slice(5).trim(); } }
}
async function gemStream(messages, mode, lang, custom) {
  const contents = messages.slice(-20).map(m => { const text = String(m.content || '').slice(0, 8000), im = typeof m.image === 'string' && m.image.match(IMG), parts = []; if (im) parts.push({ inlineData: { mimeType: im[1], data: im[2] } }); parts.push({ text: text || 'Analyse cette image.' }); return { role: m.role === 'user' ? 'user' : 'model', parts }; });
  while (contents.length && contents[0].role !== 'user') contents.shift();
  const mk = tools => JSON.stringify(Object.assign({ systemInstruction: { parts: [{ text: sysP(mode, lang, custom, messages.extra) }] }, contents, generationConfig: { maxOutputTokens: 4096 } }, tools ? { tools: [{ google_search: {} }] } : {}));
  let tools = mode === 'web', body = mk(tools), last = 'gemini';
  const models = await geminiModels();
  for (const m of models.slice(0, GROQ ? 2 : 3)) {
    let r; try { r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':streamGenerateContent?alt=sse', { method: 'POST', headers: { 'x-goog-api-key': GKEY, 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(90000) }); } catch (e) { last = 'gemini réseau'; continue; }
    if (r.ok) return (async function* () { const src = new Set(); for await (const p of sseLines(r.body)) { let j; try { j = JSON.parse(p); } catch (e) { continue; } const c = (j.candidates || [])[0] || {}; const t = ((c.content || {}).parts || []).map(x => x.text || '').join(''); ((((c.groundingMetadata || {}).groundingChunks)) || []).forEach(g => g.web && g.web.title && src.add(g.web.title)); if (t) yield t; } if (src.size) yield '\n\nSources : ' + [...src].slice(0, 5).join(', '); })();
    last = 'gemini ' + r.status; console.error(last, m);
    if (r.status === 400 && tools) { tools = false; body = mk(false); continue; }
    if (r.status === 400 || r.status === 403) break;
  }
  throw new Error(last);
}
async function groqStream(messages, mode, lang, custom) {
  const rec = messages.slice(-12), lastM = rec[rec.length - 1] || {}, hasImg = typeof lastM.image === 'string' && IMG.test(lastM.image);
  const msgs = [{ role: 'system', content: sysP(mode, lang, custom, messages.extra) }].concat(rec.map((m, i) => { const text = String(m.content || '').slice(0, 8000) || 'Analyse cette image.'; return { role: m.role === 'user' ? 'user' : 'assistant', content: hasImg && i === rec.length - 1 ? [{ type: 'text', text }, { type: 'image_url', image_url: { url: m.image } }] : text }; }));
  const model = hasImg ? (process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct') : (process.env.GROQ_MODEL || 'openai/gpt-oss-20b');
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + GROQ, 'content-type': 'application/json' }, signal: AbortSignal.timeout(90000), body: JSON.stringify(Object.assign({ model, messages: msgs, max_tokens: 4096, stream: true }, /gpt-oss/.test(model) ? { reasoning_effort: 'low' } : {})) });
  if (!r.ok) { console.error('groq', r.status); throw new Error('groq ' + r.status); }
  return (async function* () { for await (const p of sseLines(r.body)) { if (p === '[DONE]') return; try { const t = JSON.parse(p).choices[0].delta.content; if (t) yield t; } catch (e) {} } })();
}
async function chatStream(res, p) {
  const messages = Array.isArray(p.messages) ? p.messages : [], mode = p.mode, lang = p.lang, custom = p.custom;
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no', 'Access-Control-Allow-Origin': ORIGIN });
  const w = o => { try { res.write('data: ' + JSON.stringify(o) + '\n\n'); } catch (e) {} };
  let ended = false, sent = false; res.on('close', () => { ended = true; });
  try {
    messages.extra = await freshCtx(messages, mode).catch(() => '');
    let it = null, note = '';
    if (PROVIDER === 'gemini' && !(GROQ && Date.now() < gBad)) { try { it = await gemStream(messages, mode, lang, custom); } catch (e) { if (!GROQ) throw e; gBad = Date.now() + 60000; console.error('Gemini indisponible (' + e.message + '), bascule vers Groq'); } }
    if (!it && (PROVIDER === 'groq' || (PROVIDER === 'gemini' && GROQ))) { it = await groqStream(messages, mode, lang, custom); if (mode === 'web') note = '\n\n(Recherche web indisponible pour le moment : réponse basée sur les connaissances de Newton.)'; }
    if (!it) { w({ t: await callClaude(messages, mode, lang, custom) }); sent = true; }
    else { for await (const t of it) { if (ended) break; sent = true; w({ t }); } if (note && sent) w({ t: note }); }
  } catch (e) { console.error('stream', e.message); w({ t: sent ? '\n\n(connexion interrompue)' : 'Newton est très sollicité en ce moment. Réessaie dans quelques secondes.' }); }
  try { res.write('data: [DONE]\n\n'); res.end(); } catch (e) {}
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS' && !/^\/(image|whatsapp|webhook)/.test(url.pathname)) return send(res, 204, {});
  if (/^\/(auth\/|me$|sync|edit$)/.test(url.pathname)) { api(req, res, url).catch(e => { console.error('api', e.message); if (!res.headersSent) send(res, 500, { error: 'Erreur du serveur.' }); }); return; }
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
      const parsed = JSON.parse(raw); if (parsed.stream) return chatStream(res, parsed); const { messages, mode, lang, custom } = parsed;
      send(res, 200, { reply: await callClaude(messages || [], mode, lang, custom) });
    } catch (e) { console.error('chat', e.message); send(res, 400, { reply: /50\d|429|réseau/.test(e.message) ? 'Newton est très sollicité en ce moment (' + e.message + '). Réessaie dans quelques secondes.' : 'Service IA indisponible (' + e.message + ').' }); }
  });
}).listen(PORT, () => console.log('Newton écoute sur le port ' + PORT + ' Phone:' + WA_PHONE));
