"""Un match est lié à une seule source vidéo : un fichier local OU une vidéo YouTube."""

import datetime

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from scouting.models import Match

from .factories import creer_equipe, creer_match

pytestmark = pytest.mark.django_db


def match_youtube(**kwargs):
    valeurs = {
        "equipe_dom": creer_equipe("Dom"),
        "equipe_ext": creer_equipe("Ext"),
        "date": datetime.date(2026, 11, 24),
        "video_nom": "",
        "video_taille": None,
        "video_youtube": "dQw4w9WgXcQ",
    }
    valeurs.update(kwargs)
    return Match.objects.create(**valeurs)


class TestBaseDeDonnees:
    def test_match_youtube_accepte(self):
        assert match_youtube().video_youtube == "dQw4w9WgXcQ"

    def test_match_fichier_toujours_accepte(self):
        assert creer_match().video_nom == "match.mp4"

    def test_les_deux_sources_refusees(self):
        with pytest.raises(IntegrityError), transaction.atomic():
            match_youtube(video_nom="match.mp4", video_taille=10)

    def test_aucune_source_refusee(self):
        with pytest.raises(IntegrityError), transaction.atomic():
            match_youtube(video_youtube="")

    def test_fichier_sans_taille_refuse(self):
        with pytest.raises(IntegrityError), transaction.atomic():
            creer_match(video_taille=None)

    @pytest.mark.parametrize("identifiant", ["court", "dQw4w9WgXc!", "a b c d e f"])
    def test_identifiant_invalide_refuse_a_la_validation(self, identifiant):
        match = Match(
            equipe_dom=creer_equipe("A"),
            equipe_ext=creer_equipe("B"),
            date=datetime.date(2026, 11, 24),
            video_youtube=identifiant,
        )
        with pytest.raises(ValidationError) as erreur:
            match.full_clean()
        assert "video_youtube" in erreur.value.message_dict


class TestApi:
    def donnees(self, **kwargs):
        valeurs = {
            "equipe_dom": creer_equipe("Dom").pk,
            "equipe_ext": creer_equipe("Ext").pk,
            "date": "2026-11-24",
        }
        valeurs.update(kwargs)
        return valeurs

    def test_creer_un_match_youtube(self, api):
        reponse = api.post("/api/matchs/", self.donnees(video_youtube="dQw4w9WgXcQ"), format="json")
        assert reponse.status_code == 201
        corps = reponse.json()
        assert corps["video_youtube"] == "dQw4w9WgXcQ"
        assert corps["video_nom"] == ""
        assert corps["video_taille"] is None

    def test_creer_un_match_fichier(self, api):
        reponse = api.post("/api/matchs/", self.donnees(video_nom="m.mp4", video_taille=1234), format="json")
        assert reponse.status_code == 201
        assert reponse.json()["video_youtube"] == ""

    def test_deux_sources_refusees(self, api):
        donnees = self.donnees(video_nom="m.mp4", video_taille=1, video_youtube="dQw4w9WgXcQ")
        reponse = api.post("/api/matchs/", donnees, format="json")
        assert reponse.status_code == 400
        assert "video" in reponse.json()

    def test_aucune_source_refusee(self, api):
        reponse = api.post("/api/matchs/", self.donnees(), format="json")
        assert reponse.status_code == 400
        assert "video" in reponse.json()

    def test_fichier_incomplet_refuse(self, api):
        reponse = api.post("/api/matchs/", self.donnees(video_nom="m.mp4"), format="json")
        assert reponse.status_code == 400

    @pytest.mark.parametrize(
        "identifiant", ["court", "dQw4w9WgXc!", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"]
    )
    def test_identifiant_youtube_invalide(self, api, identifiant):
        reponse = api.post("/api/matchs/", self.donnees(video_youtube=identifiant), format="json")
        assert reponse.status_code == 400
        assert "video_youtube" in reponse.json()

    def test_passer_un_match_fichier_sur_youtube(self, api):
        match = creer_match()
        changement = {"video_nom": "", "video_taille": None, "video_youtube": "dQw4w9WgXcQ"}
        reponse = api.patch(f"/api/matchs/{match.pk}/", changement, format="json")
        assert reponse.status_code == 200
        match.refresh_from_db()
        assert (match.video_nom, match.video_taille, match.video_youtube) == ("", None, "dQw4w9WgXcQ")

    def test_ajouter_youtube_sans_retirer_le_fichier_refuse(self, api):
        match = creer_match()
        reponse = api.patch(f"/api/matchs/{match.pk}/", {"video_youtube": "dQw4w9WgXcQ"}, format="json")
        assert reponse.status_code == 400

    def test_export_csv_d_un_match_youtube(self, api):
        match = match_youtube()
        reponse = api.get(f"/api/matchs/{match.pk}/export/")
        assert reponse.status_code == 200
