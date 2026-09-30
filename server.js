// Serveur Newton IA — aucune dépendance, Node 18 ou plus récent.
const http = require('http'), crypto = require('crypto');
const KEY = process.env.ANTHROPIC_API_KEY, MODEL = process.env.MODEL || 'claude-sonnet-5-5';
const ORIGIN = process.env.ALLOWED_ORIGIN || '*', PORT = process.env.PORT || 3000;
const WA_TOKEN = process.env.WHATSAPP_TOKEN, WA_PHONE = process.env.WHATSAPP_PHONE_ID, WA_VERIFY = process.env.WHATSAPP_VERIFY_TOKEN;
const GKEY = process.env.GEMINI_API_KEY, GMODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const PROVIDER = process.env.PROVIDER || (KEY ? 'anthropic' : 'gemini'); // 'gemini' = clé gratuite Google AI Studio
if ((PROVIDER === 'anthropic' && !KEY) || (PROVIDER === 'gemini' && !GKEY)) { console.error('Il manque la clé : GEMINI_API_KEY (gratuit) ou ANTHROPIC_API_KEY.'); process.exit(1); }

const BASE = "Tu es Newton IA, un assistant camerounais clair, chaleureux et précis. ";
const LANGS = {
  auto: "Réponds dans la langue de l'utilisateur (français, anglais ou pidgin camerounais).",
  fr: "Réponds en français.", en: "Reply in English.",
  pidgin: "Réponds en pidgin camerounais, simple et naturel."
};
const MODES = {
  chat: "",
  devoirs: " Tu aides aux devoirs. Si une photo est fournie, lis l'énoncé, résume-le, puis donne la correction étape par étape en expliquant chaque étape. Signale ce que tu lis mal.",
  scolaire: " Tu suis les programmes officiels du Cameroun de la 6ème à la Terminale (sous-systèmes francophone et anglophone) et les examens BEPC, Probatoire et Baccalauréat. Tu n'as pas accès aux archives officielles : ne présente jamais un sujet inventé comme un sujet officiel ; propose des exercices dans le style de l'examen avec un corrigé détaillé, et dis-le clairement.",
  chorale: " Tu aides les chorales et les enfants de chœur : structure des chants liturgiques, accords, transposition, conseils de répétition. Ne reproduis pas de paroles protégées par le droit d'auteur : demande à l'utilisateur de coller les paroles, ou propose des textes du domaine public et des paroles originales.",
  traducteur: " Tu traduis entre français, anglais, ewondo, bassa et fulfulde. Indique ton niveau de confiance pour l'ewondo, le bassa et le fulfulde (moins bien maîtrisés), propose des alternatives, et recommande la relecture par un locuteur natif pour les textes importants."
};
const IMG = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

async function callAnthropic(messages, mode, lang) {
  const msgs = messages.slice(-20).map(m => {
    const text = String(m.content || '').slice(0, 8000), im = typeof m.image === 'string' && m.image.match(IMG);
    return {
      role: m.role === 'user' ? 'user' : 'assistant',
      content: im ? [{ type: 'image', source: { type: 'base64', media_type: im[1], data: im[2] } }, { type: 'text', text: text || 'Analyse cette image.' }] : text
    };
