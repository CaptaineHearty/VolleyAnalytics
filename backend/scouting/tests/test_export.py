import csv
import io

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from scouting.export import EN_TETES, nom_fichier, nombre_fr, texte_sur

from .factories import creer_equipe, creer_evenement, creer_joueur, creer_match

pytestmark = pytest.mark.django_db


def url(match):
    return f"/api/matchs/{match.pk}/export/"


def lignes(reponse):
    """Décode le CSV comme le ferait Excel : UTF-8 avec BOM, séparateur « ; »."""
    texte = reponse.content.decode("utf-8-sig")
    return list(csv.reader(io.StringIO(texte), delimiter=";"))


class TestFichier:
    def test_reponse_est_un_telechargement_csv(self, api):
        reponse = api.get(url(creer_match()))
        assert reponse.status_code == 200
        assert reponse["Content-Type"] == "text/csv; charset=utf-8"
        assert reponse["Content-Disposition"] == 'attachment; filename="2026-11-23_domicile-exterieur.csv"'

    def test_commence_par_le_bom_utf8_pour_excel(self, api):
        assert api.get(url(creer_match())).content.startswith(b"\xef\xbb\xbf")

    def test_match_sans_evenement_donne_seulement_les_en_tetes(self, api):
        assert lignes(api.get(url(creer_match()))) == [EN_TETES]

    def test_client_qui_demande_du_csv_est_servi(self, api):
        reponse = api.get(url(creer_match()), HTTP_ACCEPT="text/csv")
        assert reponse.status_code == 200


class TestContenu:
    def test_une_ligne_lisible_par_evenement(self, api):
        match = creer_match()
        joueur = creer_joueur(equipe=match.equipe_dom, numero=10, prenom="Éloïse", nom="Ngapeth")
        creer_evenement(
            match=match, joueur=joueur, t_video=42.5, set_num=2, action="A", zone=4, qualite=3, note="ligne"
        )
        assert lignes(api.get(url(match)))[1] == [
            "2",
            "42,50",
            "Domicile",
            "10",
            "Éloïse Ngapeth",
            "Attaque",
            "4",
            "3",
            "ligne",
            "",
        ]

    def test_ordre_chronologique(self, api):
        match = creer_match()
        creer_evenement(match=match, t_video=30)
        creer_evenement(match=match, t_video=5)
        temps = [ligne[1] for ligne in lignes(api.get(url(match)))[1:]]
        assert temps == ["5,00", "30,00"]

    def test_champs_facultatifs_vides(self, api):
        match = creer_match()
        creer_evenement(match=match, joueur=None, zone=None, qualite=None)
        ligne = lignes(api.get(url(match)))[1]
        assert ligne[3:5] == ["", ""]  # numéro, joueur
        assert ligne[6:8] == ["", ""]  # zone, qualité

    def test_scout_indique(self, api, utilisateur):
        match = creer_match()
        creer_evenement(match=match, saisi_par=utilisateur)
        assert lignes(api.get(url(match)))[1][-1] == "scout"

    def test_n_exporte_que_le_match_demande(self, api):
        match = creer_match()
        creer_evenement(match=match)
        creer_evenement()  # autre match
        assert len(lignes(api.get(url(match)))) == 2

    def test_point_virgule_et_guillemets_dans_une_note(self, api):
        match = creer_match()
        creer_evenement(match=match, note='bloc "out"; à revoir')
        assert lignes(api.get(url(match)))[1][8] == 'bloc "out"; à revoir'

    def test_nombre_de_requetes_constant(self, api):
        """Pas de requête SQL par ligne : 50 actions coûtent autant qu'une seule."""
        match = creer_match()
        joueur = creer_joueur(equipe=match.equipe_dom)
        creer_evenement(match=match, joueur=joueur)
        with CaptureQueriesContext(connection) as une:
            api.get(url(match))
        for i in range(49):
            creer_evenement(match=match, joueur=joueur, t_video=i)
        with CaptureQueriesContext(connection) as cinquante:
            api.get(url(match))
        assert len(cinquante) == len(une)


class TestInjectionDeFormules:
    @pytest.mark.parametrize("note", ["=1+1", "+1+1", "-1+1", "@SUM(1,1)", "\t=1+1", "\r=1+1"])
    def test_note_neutralisee(self, api, note):
        match = creer_match()
        creer_evenement(match=match, note=note)
        assert lignes(api.get(url(match)))[1][8] == "'" + note

    def test_nom_d_equipe_neutralise(self, api):
        match = creer_match(equipe_dom=creer_equipe("=HYPERLINK(1)"))
        creer_evenement(match=match)
        assert lignes(api.get(url(match)))[1][2] == "'=HYPERLINK(1)"

    @pytest.mark.parametrize(("entree", "sortie"), [("", ""), ("bloc", "bloc"), ("a=b", "a=b")])
    def test_texte_normal_intact(self, entree, sortie):
        assert texte_sur(entree) == sortie


class TestAcces:
    def test_anonyme_refuse(self):
        assert APIClient().get(url(creer_match())).status_code == 403

    @pytest.mark.parametrize("accept", [None, "text/csv"])
    def test_match_inexistant(self, api, accept):
        en_tetes = {"HTTP_ACCEPT": accept} if accept else {}
        assert api.get("/api/matchs/999999/export/", **en_tetes).status_code == 404


class TestUtilitaires:
    def test_nombre_fr(self):
        assert nombre_fr(3.14159) == "3,14"
        assert nombre_fr(0) == "0,00"

    def test_nom_de_fichier_sans_accents_ni_espaces(self):
        match = creer_match(equipe_dom=creer_equipe("Évry Volley"), equipe_ext=creer_equipe("Saint-Ouen"))
        assert nom_fichier(match) == "2026-11-23_evry-volley-saint-ouen.csv"

    def test_nom_de_fichier_de_secours(self):
        match = creer_match(equipe_dom=creer_equipe("!!!"), equipe_ext=creer_equipe("???"))
        assert nom_fichier(match) == "2026-11-23_match.csv"
