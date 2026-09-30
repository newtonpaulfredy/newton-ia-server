# Serveur Newton IA

Garde ta clé API secrète, relaie les messages du site (texte + photos) et, en option, fait tourner le bot WhatsApp.

## Tester sur ton ordinateur
1. Installe Node.js 18+ et crée une clé sur console.anthropic.com
2. Dans ce dossier :
   - Mac/Linux : `ANTHROPIC_API_KEY=ta-clé node server.js`
   - Windows (PowerShell) : `$env:ANTHROPIC_API_KEY="ta-clé"; node server.js`
3. Dans Newton IA, « Connecter mon IA » → `http://localhost:3000/chat`

## Mettre en ligne
Render, Railway ou Fly.io (commande de démarrage : `node server.js`). Mets les variables dans les réglages de l'hébergeur, jamais dans le code : `ANTHROPIC_API_KEY`, `ALLOWED_ORIGIN` (adresse de ton site). Colle ensuite `https://ton-serveur/chat` dans l'app.

## Bot WhatsApp (facultatif)
1. Sur developers.facebook.com, crée une app « Business » et ajoute le produit WhatsApp.
2. Récupère le jeton d'accès (`WHATSAPP_TOKEN`, prends un jeton permanent) et l'identifiant du numéro (`WHATSAPP_PHONE_ID`).
3. Choisis un mot secret (`WHATSAPP_VERIFY_TOKEN`). Recommandé : ajoute aussi `WHATSAPP_APP_SECRET`.
4. Dans WhatsApp > Configuration > Webhook, mets `https://ton-serveur/whatsapp` et ton mot secret, puis abonne le champ « messages ».
5. Envoie un message au numéro : Newton répond. Une photo d'exercice est corrigée en mode devoirs.
WhatsApp impose ses règles et parfois des frais de messagerie : consulte la documentation de Meta.

## Modes
`chat`, `devoirs`, `scolaire`, `chorale`, `traducteur` (voir `MODES` dans server.js pour changer leur comportement).
Variables facultatives : `MODEL`, `PORT`.
