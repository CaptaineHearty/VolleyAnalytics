from io import StringIO

import pytest
from django.core.management import call_command


@pytest.mark.django_db
def test_aucune_migration_manquante():
    """Échoue si un modèle a changé sans que la migration ait été générée."""
    sortie = StringIO()
    try:
        call_command("makemigrations", "--check", "--dry-run", stdout=sortie, stderr=StringIO())
    except SystemExit:  # pragma: no cover
        pytest.fail(f"Migrations manquantes :\n{sortie.getvalue()}")
