# Revue de code - Kanban Studio

Date : 2026-08-26
Perimetre : repo entier (`backend/`, `frontend/`, `scripts/`, `Dockerfile`, docs)
Methode : lecture complete des fichiers source, execution des suites de tests (`uv run pytest`, `npm run test:unit`, `npm run lint`)

## Resume

L'application est un MVP Kanban simple et coherent avec les specifications d'`AGENTS.md`. La structure suit fidelement le contrat documente dans `CLAUDE.md` (un seul blob JSON pour le board, duplique en 3 endroits, single-origin serving). Le code est propre, sans sur-ingenierie, et la suite de tests existante passe integralement :

- Backend : `uv run pytest` -> 16/16 tests OK
- Frontend unit : `npm run test:unit` -> 17/17 tests OK
- Frontend lint : `npm run lint` -> 1 erreur (voir Action 1)

Le point le plus important releve n'est pas un bug actif mais une absence de garde-fou : rien ne verifie que `columns[].cardIds` reste coherent avec `cards`, ni cote backend (Pydantic) ni cote frontend au moment de la sauvegarde. Comme le board est un blob unique reecrit integralement par le PUT et par l'IA (qui genere du JSON librement), c'est le point le plus probable de corruption de donnees silencieuse.

## Constats et actions

### 1. Lint frontend en echec (bloquant CI si le lint est un gate)

`frontend/tests/kanban.spec.ts:3` :
```ts
const login = async (page: any) => {
```
`npm run lint` echoue avec `Unexpected any. Specify a different type`.

**Action** : typer avec `Page` importe de `@playwright/test` :
```ts
import { expect, test, type Page } from "@playwright/test";
const login = async (page: Page) => { ... }
```

### 2. Aucune verification d'integrite referentielle sur `BoardData`

`backend/models.py` accepte n'importe quelle combinaison de `columns[].cardIds` et `cards` sans validation croisee. Or deux voies alimentent ce modele avec des donnees non fiables :
- `PUT /api/board` (`backend/board.py`) accepte le board tel quel.
- La reponse IA (`backend/ai.py:181-184`) valide seulement la forme Pydantic de base, pas la coherence.

Consequences possibles : un `cardId` reference dans une colonne sans entree correspondante dans `cards` (carte fantome), une meme carte presente dans deux colonnes (duplication visuelle), ou une carte orpheline dans `cards` sans jamais apparaitre dans aucune colonne.

Cote frontend, `KanbanBoard.tsx:315` masque silencieusement le symptome :
```ts
cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
```
Ce `filter(Boolean)` evite un crash mais cache l'incoherence au lieu de la signaler ; les cartes fantomes disparaissent sans trace et sans persister de correctif en base.

**Action** : ajouter un `model_validator(mode="after")` sur `BoardData` dans `backend/models.py` qui verifie que chaque `cardId` de chaque colonne existe dans `cards`, et lever une erreur de validation sinon (rejette le PUT, et fait tomber `parse_structured_response` sur `validated_board = None` pour les reponses IA malformees, ce qui est deja gere). Documenter le comportement attendu (cartes orphelines autorisees ou non) dans `docs/DATABASE.md`.

### 3. Echec silencieux de validation du board genere par l'IA

`backend/ai.py:181-184` :
```python
try:
    validated_board = BoardData.model_validate(board_data)
except Exception:
    validated_board = None
```
Si le LLM renvoie un `board` dont le contenu textuel du `message` annonce une modification ("carte ajoutee a Review") mais dont le JSON `board` echoue la validation Pydantic, l'utilisateur recoit un message de confirmation alors que rien n'a change en base. Aucune trace n'est loggee pour ce cas precis (contrairement aux autres branches d'erreur du fichier qui utilisent `print(...)`).

**Action** : logger l'exception (`print(f"[AI Chat] board validation failed: {exc}")`) pour permettre le diagnostic, et envisager de renvoyer un message coherent avec l'echec plutot que le message brut du modele quand `validated_board is None` mais que le modele annoncait une modification.

### 4. CORS permissif combine a `allow_credentials=True`

`backend/main.py:29-35` :
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
L'authentification se fait par Bearer token dans l'en-tete `Authorization`, jamais par cookie : `allow_credentials=True` n'apporte donc rien ici et n'est utile que pour les cookies/sessions. Combiner un wildcard d'origine avec les credentials est une configuration a eviter par principe (les specs CORS interdisent d'ailleurs cette combinaison pour les requetes avec cookies, et Starlette echoue silencieusement a renvoyer `*` dans ce cas precis).

**Action** : retirer `allow_credentials=True` (inutile pour un flux Bearer token), ou restreindre `allow_origins` a l'origine reelle de service si le credential doit rester. Vu que le frontend et le backend sont servis en single-origin (cf. `CLAUDE.md`), le CORS pourrait meme etre supprime entierement pour cette app.

### 5. Pas de limitation de tentatives sur `/api/auth/login`

`backend/auth.py:29-38` n'a aucun rate limiting. Les identifiants sont volontairement en dur pour le MVP (documente), mais rien n'empeche un brute force trivial si le port est expose au-dela de `localhost`. Faible priorite tant que le deploiement reste strictement local, mais a traiter avant toute exposition reseau.

**Action** : si le service doit un jour etre accessible au-dela de `localhost`, ajouter un throttling basique (ex. limite par IP) avant le passage en production.

### 6. Couverture de tests unitaires frontend incomplete sur les composants de presentation

Seuls `KanbanBoard.test.tsx`, `KanbanChatSidebar.test.tsx`, `LoginForm.test.tsx` et `kanban.test.ts` existent. `KanbanColumn.tsx`, `KanbanCard.tsx`, `NewCardForm.tsx` et `KanbanCardPreview.tsx` ne sont testes qu'indirectement via `KanbanBoard.test.tsx` et les tests e2e Playwright. Le renommage de colonne, la suppression de carte, et la validation du formulaire d'ajout (`NewCardForm.tsx:15-17`, titre requis) n'ont pas de test unitaire isole.

**Action** : ajouter des tests cibles pour `NewCardForm` (soumission avec titre vide bloquee, reset apres ajout) et `KanbanColumn` (rendu de l'etat vide "Drop a card here", appel de `onDeleteCard`). Priorite basse, le comportement est deja couvert de bout en bout par Playwright.

### 7. Le payload envoye a `/api/ai/chat` grossit sans borne cote client

`frontend/src/components/KanbanChatSidebar.tsx:204` envoie tout l'historique `updatedMessages` (jamais tronque cote client) a chaque appel, meme si `backend/ai.py:238` ne garde que les 10 derniers messages pour le LLM. Sur une session de chat tres longue, la bande passante de la requete croit inutilement puisque le backend jette la majorite du payload recu.

**Action** : tronquer `messages` cote client avant l'appel (ex. `messages.slice(-10)` dans `sendAIChatMessage` ou dans `KanbanChatSidebar`), ce qui evite aussi de dupliquer la constante magique `10` entre frontend et backend sans qu'elle soit visible des deux cotes.

### 8. Absence de volume Docker pour la persistance SQLite

`scripts/start.sh:34` lance le conteneur sans `-v`, et `CLAUDE.md` documente deja explicitement que les donnees sont perdues a la suppression du conteneur. Ce n'est pas un bug (comportement voulu pour le MVP), mais c'est un ecart facile a corriger si la persistance entre redemarrages devient un besoin reel pour un outil de gestion de projet.

**Action (optionnelle)** : si la persistance doit survivre a `./scripts/stop.sh` + `./scripts/start.sh`, ajouter `-v "$(pwd)/data:/app/data"` (et l'equivalent dans `start.bat`) plutot que de laisser les donnees dans le conteneur.

## Points positifs a noter

- Aucune utilisation de `dangerouslySetInnerHTML` : le rendu Markdown-like du chat IA (`KanbanChatSidebar.tsx`) construit des elements React (`renderInline`), donc pas de vecteur XSS via les reponses du LLM meme si celui-ci est influencable par l'utilisateur.
- Toutes les requetes SQL sont parametrees (`database.py`), aucune injection SQL possible.
- `parse_structured_response` (`backend/ai.py`) est robuste face a la sloppiness connue des LLM (fences de code, JSON tronque, `cards` en array, `cardIds` absents) — bon exemple de gestion defensive **justifiee** par un besoin reel documente, contrairement a de la defensive programming gratuite.
- Le `.env` n'est jamais copie dans l'image Docker (absent du `Dockerfile`, seulement passe via `--env-file` a l'execution) et reste hors du controle de version (`.gitignore`). Bonne hygiene de secrets.
- La suite de tests backend couvre les 401 sur toutes les routes protegees, la persistance SQLite, et le parsing degrade de l'IA — bon niveau de confiance pour un MVP.

## Recapitulatif des actions

| # | Priorite | Fichier | Action |
|---|----------|---------|--------|
| 1 | Haute | `frontend/tests/kanban.spec.ts` | Remplacer `any` par le type `Page` pour faire passer le lint |
| 2 | Haute | `backend/models.py` | Ajouter une validation d'integrite referentielle `cardIds` <-> `cards` sur `BoardData` |
| 3 | Moyenne | `backend/ai.py` | Logger l'echec de validation du board IA au lieu de l'avaler silencieusement |
| 4 | Moyenne | `backend/main.py` | Retirer ou restreindre `allow_credentials=True` avec `allow_origins=["*"]` |
| 5 | Basse | `backend/auth.py` | Rate limiting sur `/api/auth/login` si exposition au-dela de `localhost` |
| 6 | Basse | `frontend/src/components/` | Completer les tests unitaires de `NewCardForm` et `KanbanColumn` |
| 7 | Basse | `frontend/src/components/KanbanChatSidebar.tsx` | Tronquer l'historique envoye a l'API au lieu de tout envoyer |
| 8 | Optionnelle | `scripts/start.sh` / `start.bat` | Ajouter un volume Docker pour la persistance SQLite si besoin |
