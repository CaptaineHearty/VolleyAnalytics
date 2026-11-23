# Site web volley — Architecture (v1, sans IA)

Validée le 23/11/2026.

## Objectif
Outil de saisie de statistiques de volley à partir d'une vidéo de match (caméra fixe derrière le terrain) : lecteur vidéo + saisie rapide des actions, horodatées sur la vidéo.

## Principe clé
La vidéo reste sur le poste de l'utilisateur : elle est lue en local dans le navigateur (`URL.createObjectURL()` → `<video>`). Seuls les événements saisis (avec leur horodatage vidéo) sont envoyés au serveur. Pas d'upload ni de stockage vidéo.

## Stack
| Couche | Choix |
|---|---|
| Backend | Django + Django REST Framework |
| Auth / admin | Intégrés à Django |
| Base de données | PostgreSQL (prod), SQLite (dev) |
| Frontend (écran de saisie) | React + TypeScript, via Vite (template `react-ts`) |
| Alternative frontend légère | Alpine.js dans les templates Django |
| Vidéo | `<video>` HTML5 natif + `requestVideoFrameCallback()` pour la précision à l'image |
| Format vidéo conseillé | MP4 / H.264 |
| Export | CSV côté serveur |

## Modèle de données minimal
```
Equipe ─< Joueur
Match (equipe_dom, equipe_ext, date, nom_fichier_video)
Evenement (match, t_video, set, joueur, action, zone, qualite, saisi_par)
```

## Périmètre MVP
- Lecteur vidéo avec raccourcis (pause, retour 3 s, ralenti)
- Saisie rapide : joueur, action, zone, qualité
- Journal des actions cliquable (retour au moment vidéo)
- Export CSV

## Évolutions prévues (plus tard)
- Clic directement sur la vidéo + homographie (calibrage 4 coins) → coordonnées terrain (`x_terrain`, `y_terrain` sur `Evenement`)
- Scouting à plusieurs en parallèle sur la même vidéo
- Export .dvw (compatibilité Open Volley)
- Détection automatique (IA) entraînée sur les données saisies

## Sources
- Django REST Framework : https://www.django-rest-framework.org/
- Vite (templates) : https://vite.dev/guide/
- Alpine.js : https://alpinejs.dev/
- requestVideoFrameCallback (MDN) : https://developer.mozilla.org/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback
- Codecs vidéo web (MDN) : https://developer.mozilla.org/docs/Web/Media/Formats/Video_codecs
- Sélection de codec H.264 (MDN) : https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API/Codec_selection
