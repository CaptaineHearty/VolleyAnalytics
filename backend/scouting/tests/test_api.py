import pytest
from rest_framework.test import APIClient

from scouting.models import Evenement, Match

from .factories import creer_equipe, creer_evenement, creer_joueur, creer_match

pytestmark = pytest.mark.django_db


def resultats(reponse):
    return reponse.json()["results"]


class TestAuthentification:
    @pytest.mark.parametrize("url", ["/api/equipes/", "/api/joueurs/", "/api/matchs/", "/api/evenements/"])
    def test_anonyme_refuse(self, url):
        assert APIClient().get(url).status_code == 403


class TestEquipesEtJoueurs:
    def test_creer_et_lister_equipes(self, api):
        reponse = api.post("/api/equipes/", {"nom": "Ivry", "club": "ESIEA"}, format="json")
        assert reponse.status_code == 201
        assert [e["nom"] for e in resultats(api.get("/api/equipes/"))] == ["Ivry"]

    def test_filtrer_joueurs_par_equipe(self, api):
        a, b = creer_equipe("A"), creer_equipe("B")
        creer_joueur(equipe=a, numero=1)
        creer_joueur(equipe=b, numero=2)
        reponse = api.get(f"/api/joueurs/?equipe={a.pk}")
        assert [j["numero"] for j in resultats(reponse)] == [1]

    def test_filtre_non_numerique_ignore(self, api):
        creer_joueur()
        assert len(resultats(api.get("/api/joueurs/?equipe=abc"))) == 1

    def test_numero_en_double_renvoie_400_et_pas_500(self, api):
        equipe = creer_equipe()
        creer_joueur(equipe=equipe, numero=7)
        donnees = {"equipe": equipe.pk, "nom": "Autre", "numero": 7}
        assert api.post("/api/joueurs/", donnees, format="json").status_code == 400


class TestMatchs:
    def donnees(self, **kwargs):
        valeurs = {
            "equipe_dom": creer_equipe("Dom").pk,
            "equipe_ext": creer_equipe("Ext").pk,
            "date": "2026-11-23",
            "video_nom": "match.mp4",
            "video_taille": 123456,
        }
        valeurs.update(kwargs)
        return valeurs

    def test_creation_enregistre_l_auteur(self, api, utilisateur):
        reponse = api.post("/api/matchs/", self.donnees(), format="json")
        assert reponse.status_code == 201
        assert Match.objects.get().cree_par == utilisateur
        assert reponse.json()["cree_par"] == "scout"

    def test_auteur_non_modifiable_par_le_client(self, api, django_user_model):
        autre = django_user_model.objects.create_user(username="autre")
        api.post("/api/matchs/", self.donnees(cree_par=autre.pk), format="json")
        assert Match.objects.get().cree_par.username == "scout"

    def test_equipe_contre_elle_meme_refusee(self, api):
        equipe = creer_equipe()
        reponse = api.post(
            "/api/matchs/", self.donnees(equipe_dom=equipe.pk, equipe_ext=equipe.pk), format="json"
        )
        assert reponse.status_code == 400
        assert "equipe_ext" in reponse.json()

    def test_modification_partielle(self, api):
        match = creer_match()
        reponse = api.patch(f"/api/matchs/{match.pk}/", {"competition": "Coupe"}, format="json")
        assert reponse.status_code == 200
        match.refresh_from_db()
        assert match.competition == "Coupe"


class TestEvenements:
    @pytest.fixture
    def match(self):
        return creer_match()

    def donnees(self, match, **kwargs):
        valeurs = {
            "match": match.pk,
            "t_video": 42.04,
            "set_num": 1,
            "equipe": match.equipe_dom.pk,
            "action": "A",
            "zone": 4,
            "qualite": 3,
        }
        valeurs.update(kwargs)
        return valeurs

    def test_creation_enregistre_le_scout(self, api, match, utilisateur):
        reponse = api.post("/api/evenements/", self.donnees(match), format="json")
        assert reponse.status_code == 201
        assert Evenement.objects.get().saisi_par == utilisateur

    @pytest.mark.parametrize(
        ("champ", "valeur"),
        [
            ("zone", 0),
            ("zone", 7),
            ("qualite", 4),
            ("qualite", -1),
            ("set_num", 0),
            ("set_num", 6),
            ("action", "X"),
            ("t_video", -1),
        ],
    )
    def test_valeur_invalide_refusee(self, api, match, champ, valeur):
        reponse = api.post("/api/evenements/", self.donnees(match, **{champ: valeur}), format="json")
        assert reponse.status_code == 400
        assert champ in reponse.json()
        assert not Evenement.objects.exists()

    def test_zone_et_qualite_facultatives(self, api, match):
        reponse = api.post("/api/evenements/", self.donnees(match, zone=None, qualite=None), format="json")
        assert reponse.status_code == 201

    def test_equipe_hors_match_refusee(self, api, match):
        intrus = creer_equipe("Intrus")
        reponse = api.post("/api/evenements/", self.donnees(match, equipe=intrus.pk), format="json")
        assert reponse.status_code == 400
        assert "equipe" in reponse.json()

    def test_joueur_d_une_autre_equipe_refuse(self, api, match):
        joueur_adverse = creer_joueur(equipe=match.equipe_ext)
        reponse = api.post("/api/evenements/", self.donnees(match, joueur=joueur_adverse.pk), format="json")
        assert reponse.status_code == 400
        assert "joueur" in reponse.json()

    def test_modification_partielle_revalide_la_coherence(self, api, match):
        evenement = creer_evenement(match=match)
        joueur_adverse = creer_joueur(equipe=match.equipe_ext)
        reponse = api.patch(f"/api/evenements/{evenement.pk}/", {"joueur": joueur_adverse.pk}, format="json")
        assert reponse.status_code == 400

    def test_liste_filtree_par_match_et_triee(self, api, match):
        creer_evenement(match=match, t_video=30)
        creer_evenement(match=match, t_video=5)
        creer_evenement(t_video=1)  # autre match
        reponse = api.get(f"/api/evenements/?match={match.pk}")
        assert [e["t_video"] for e in resultats(reponse)] == [5, 30]

    def test_filtre_par_set(self, api, match):
        creer_evenement(match=match, set_num=1)
        creer_evenement(match=match, set_num=2)
        reponse = api.get(f"/api/evenements/?match={match.pk}&set=2")
        assert [e["set_num"] for e in resultats(reponse)] == [2]

    def test_pagination_jusqu_a_1000(self, api, match):
        Evenement.objects.bulk_create(
            Evenement(match=match, t_video=i, set_num=1, equipe=match.equipe_dom, action="S")
            for i in range(600)
        )
        assert len(resultats(api.get(f"/api/evenements/?match={match.pk}"))) == 500
        assert len(resultats(api.get(f"/api/evenements/?match={match.pk}&page_size=1000"))) == 600

    def test_suppression(self, api, match):
        evenement = creer_evenement(match=match)
        assert api.delete(f"/api/evenements/{evenement.pk}/").status_code == 204
        assert not Evenement.objects.exists()
