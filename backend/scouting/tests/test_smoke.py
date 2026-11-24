import pytest


@pytest.mark.django_db
def test_page_de_connexion_admin_repond(client):
    reponse = client.get("/admin/login/")
    assert reponse.status_code == 200


@pytest.mark.django_db
def test_admin_accessible_au_superuser(admin_client):
    for url in ["/admin/scouting/equipe/", "/admin/scouting/match/", "/admin/scouting/evenement/"]:
        assert admin_client.get(url).status_code == 200


def test_politique_de_referent_compatible_youtube(client):
    """YouTube refuse la lecture intégrée sans en-tête Referer (erreur 153)."""
    reponse = client.get("/admin/login/")
    assert reponse["Referrer-Policy"] == "strict-origin-when-cross-origin"
