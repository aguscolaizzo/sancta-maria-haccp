# Assistant HACCP — mise en service progressive

## Version initiale (branche de travail)
- Assistant flottant dans le site, interface mobile bilingue, saisie texte.
- Dictée via Web Speech API *si disponible dans le navigateur*. Ce n'est pas encore une transcription via OpenAI/Whisper.
- Commandes françaises/espagnoles limitées et interprétées par règles : préparation d'étiquettes, consultation des échéances, navigation vers nettoyage, friteuse, températures et réceptions.
- Consultation des échéances via la base Cloudflare D1, filtrée par propriétaire.
- **Toutes les modifications restent soumises à l'interface HACCP habituelle et à une confirmation de l'opérateur.** Le chat ne crée pas encore d'étiquettes à partir du message et n'imprime rien.
- Contrôle d'accès existant `authorize()`, anti-CSRF `sameOrigin()`, requêtes bornées; pas de jetons dans le code client.

## Reste à développer avant exploitation comme agent autonome
1. Créer un stockage de demandes et validations temporaires, avec TTL, idempotence, utilisateur associé, journal d'audit, contrôle des droits et validation relecture au moment de l'exécution.
2. Connecter les intentions de création au catalogue, aux lots fournisseurs et à `POST /api/quick-labels` via une couche de services partagée. Exiger le lot fournisseur si la règle le requiert et ne jamais inventer une DLC ou un contrôle de température.
3. Ajouter une passerelle Telegram sécurisée (webhook avec secret, association préalable du compte, vérification par utilisateur, protection contre replay, choix entre messages d'un groupe et chat privé). Aucun bot n'est encore configuré.
4. Pour les notes vocales Telegram, transcrire côté serveur, avec limite de taille/durée et suppression des pièces temporaires. Les clés sont des variables secrètes serveur, jamais dans GitHub ni le navigateur.
5. Pour les impressions Bluetooth SUPVAN, laisser un appareil local lancer la file après confirmation; une impression distante automatique exige une passerelle matérielle locale et des accusés de réception fiables.
6. Introduire un modèle IA via API uniquement en complément de fonctions autorisées et structurées; interdire la génération d'appels SQL et les opérations non déclarées. Ajouter limites de coût et d'usage.
7. Tests de bout en bout, droits membres, fuseau Europe/Paris, DLC fournisseur, double clic/notifications, audit HACCP, puis déploiement test avant production.

## Contexte technique
Application Next.js/vinext Cloudflare, D1 Drizzle, authentification propriétaire/membres existante. Maintenir le site actuel, sans VPS tant que l'intégration Cloudflare suffit.
