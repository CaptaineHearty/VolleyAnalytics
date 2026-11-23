import pytest
from rest_framework.test import APIClient


@pytest.fixture
def utilisateur(django_user_model):
    return django_user_model.objects.create_user(username="scout", password="mdp-de-test-123")


@pytest.fixture
def api(utilisateur):
    """Client API déjà connecté."""
    client = APIClient()
    client.force_authenticate(user=utilisateur)
    return client
