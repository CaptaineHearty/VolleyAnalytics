# VolleyAnalytics

Outil web de saisie de statistiques de volley à partir de la vidéo d'un match. Voir `architecture.md`.

## Démarrer en local (Windows PowerShell)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Sans variable `DATABASE_URL`, le projet utilise SQLite (`backend/db.sqlite3`).

## Frontend (React + TypeScript, Vite)

Nécessite Node.js 22.12 ou plus récent (Node 24 LTS conseillé). Dans un second terminal, Django tournant déjà :

```powershell
cd frontend
npm install
npm run dev
```

Ouvrir http://localhost:5173. En dev, Vite renvoie `/api`, `/api-auth`, `/admin` et `/static`
vers Django (port 8000) : tout passe par la même origine, la session et le CSRF de Django fonctionnent tels quels.

```powershell
npm run lint        # oxlint
npm run typecheck   # TypeScript
npm test            # Vitest
npm run build       # build de production dans frontend/dist
```

## Qualité du code

Une seule fois, à la racine du dépôt :

```powershell
pre-commit install
```

Ensuite, à chaque commit, ruff corrige et formate le code automatiquement.

À la main, depuis `backend/` :

```powershell
ruff check .          # lint
ruff format .         # formatage
pytest                # tests + couverture (minimum 90 %)
```

## Branches et CI

- `dev` : intégration ; `main` : version stable.
- On travaille sur des branches `feature/...` et on ouvre une pull request vers `dev`.
- La CI GitHub Actions (`.github/workflows/ci.yml`) tourne sur chaque push et chaque PR vers `dev` et `main` :
  - **Lint** : `ruff check` et `ruff format --check`
  - **Tests** : `pytest` sur PostgreSQL 16, plus une vérification des migrations manquantes
  - **Frontend** : oxlint, vérification TypeScript, tests Vitest et build
  - **Réglages de production** : `manage.py check --deploy`

## Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `DJANGO_SECRET_KEY` | Clé secrète | valeur de dev, à changer en prod |
| `DJANGO_DEBUG` | Mode debug | `true` |
| `DJANGO_ALLOWED_HOSTS` | Hôtes autorisés, séparés par des virgules | `localhost,127.0.0.1` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Origines de confiance (prod) | vide |
| `DATABASE_URL` | Base de données | SQLite local |
