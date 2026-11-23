import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.db.models import ProtectedError

from scouting.models import Evenement, Joueur

from .factories import creer_equipe, creer_evenement, creer_joueur, creer_match

pytestmark = pytest.mark.django_db


class TestJoueur:
    def test_str(self):
        joueur = creer_joueur(numero=10, prenom="Earvin", nom="Ngapeth")
        assert str(joueur) == "#10 Earvin Ngapeth"

    def test_numero_unique_par_equipe(self):
        equipe = creer_equipe()
        creer_joueur(equipe=equipe, numero=7)
        with pytest.raises(IntegrityError):
            creer_joueur(equipe=equipe, numero=7, nom="Autre")

    def test_meme_numero_autorise_dans_deux_equipes(self):
        creer_joueur(equipe=creer_equipe("A"), numero=7)
        creer_joueur(equipe=creer_equipe("B"), numero=7)
        assert Joueur.objects.filter(numero=7).count() == 2


class TestMatch:
    def test_str(self):
        match = creer_match()
        assert str(match) == "Domicile – Extérieur (2026-11-23)"

    def test_suppression_equipe_protegee_si_match(self):
        match = creer_match()
        with pytest.raises(ProtectedError):
            match.equipe_dom.delete()

    def test_suppression_match_supprime_ses_evenements(self):
        evenement = creer_evenement()
        evenement.match.delete()
        assert not Evenement.objects.exists()


class TestEvenement:
    def test_ordre_chronologique(self):
        match = creer_match()
        tardif = creer_evenement(match=match, t_video=30.0)
        precoce = creer_evenement(match=match, t_video=5.0)
        assert list(match.evenements.all()) == [precoce, tardif]

    def test_str(self):
        evenement = creer_evenement(t_video=3.256)
        assert str(evenement) == "3.26s Service"

    def test_joueur_supprime_garde_l_evenement(self):
        match = creer_match()
        joueur = creer_joueur(equipe=match.equipe_dom)
        evenement = creer_evenement(match=match, joueur=joueur)
        joueur.delete()
        evenement.refresh_from_db()
        assert evenement.joueur is None

    @pytest.mark.parametrize(
        ("champ", "valeur"),
        [("zone", 0), ("zone", 7), ("qualite", 4), ("set_num", 0), ("set_num", 6)],
    )
    def test_valeurs_hors_bornes_refusees(self, champ, valeur):
        evenement = creer_evenement()
        setattr(evenement, champ, valeur)
        with pytest.raises(ValidationError) as erreur:
            evenement.full_clean()
        assert champ in erreur.value.message_dict

    def test_action_inconnue_refusee(self):
        evenement = creer_evenement()
        evenement.action = "X"
        with pytest.raises(ValidationError):
            evenement.full_clean()
