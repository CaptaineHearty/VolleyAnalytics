"""Export CSV des événements d'un match, pensé pour Excel en français.

- Encodage UTF-8 avec BOM : sans lui, Excel affiche mal les accents.
- Séparateur « ; » et virgule décimale : réglages régionaux français d'Excel.
- Les textes saisis par l'utilisateur sont neutralisés contre l'injection
  de formules (recommandation OWASP « CSV Injection »).
"""

import csv
import io

from django.utils.text import slugify

from .models import Match

BOM = "﻿"
EN_TETES = [
    "Set",
    "Temps vidéo (s)",
    "Équipe",
    "Numéro",
    "Joueur",
    "Action",
    "Zone",
    "Qualité",
    "Note",
    "Saisi par",
]
# Caractères qui font interpréter une cellule comme une formule (OWASP).
DEBUTS_DANGEREUX = ("=", "+", "-", "@", "\t", "\r")


def texte_sur(valeur: str) -> str:
    """Préfixe d'une apostrophe un texte qui serait lu comme une formule."""
    if valeur and valeur.startswith(DEBUTS_DANGEREUX):
        return "'" + valeur
    return valeur


def nombre_fr(valeur: float) -> str:
    return f"{valeur:.2f}".replace(".", ",")


def vide_si_none(valeur) -> str:
    return "" if valeur is None else str(valeur)


def nom_fichier(match: Match) -> str:
    equipes = slugify(f"{match.equipe_dom.nom}-{match.equipe_ext.nom}") or "match"
    return f"{match.date:%Y-%m-%d}_{equipes}.csv"


def generer_csv(match: Match) -> str:
    tampon = io.StringIO()
    tampon.write(BOM)
    ecrivain = csv.writer(tampon, delimiter=";", lineterminator="\r\n")
    ecrivain.writerow(EN_TETES)

    evenements = match.evenements.select_related("equipe", "joueur", "saisi_par").order_by("t_video", "id")
    for ev in evenements:
        joueur = ev.joueur
        nom_joueur = f"{joueur.prenom} {joueur.nom}".strip() if joueur else ""
        ecrivain.writerow(
            [
                ev.set_num,
                nombre_fr(ev.t_video),
                texte_sur(ev.equipe.nom),
                vide_si_none(joueur.numero if joueur else None),
                texte_sur(nom_joueur),
                ev.get_action_display(),
                vide_si_none(ev.zone),
                vide_si_none(ev.qualite),
                texte_sur(ev.note),
                texte_sur(ev.saisi_par.get_username() if ev.saisi_par else ""),
            ]
        )
    return tampon.getvalue()
