"""Petits constructeurs d'objets pour les tests (sans dépendance externe)."""

import datetime

from scouting.models import Equipe, Evenement, Joueur, Match


def creer_equipe(nom="Paris Volley", **kwargs):
    return Equipe.objects.create(nom=nom, **kwargs)


def creer_joueur(equipe=None, numero=7, nom="Dupont", **kwargs):
    return Joueur.objects.create(equipe=equipe or creer_equipe(), numero=numero, nom=nom, **kwargs)


def creer_match(**kwargs):
    valeurs = {
        "equipe_dom": kwargs.pop("equipe_dom", None) or creer_equipe("Domicile"),
        "equipe_ext": kwargs.pop("equipe_ext", None) or creer_equipe("Extérieur"),
        "date": datetime.date(2026, 11, 23),
        "video_nom": "match.mp4",
        "video_taille": 1_000_000,
    }
    valeurs.update(kwargs)
    return Match.objects.create(**valeurs)


def creer_evenement(match=None, **kwargs):
    match = match or creer_match()
    valeurs = {
        "match": match,
        "t_video": 12.5,
        "set_num": 1,
        "equipe": match.equipe_dom,
        "action": Evenement.Action.SERVICE,
    }
    valeurs.update(kwargs)
    return Evenement.objects.create(**valeurs)
