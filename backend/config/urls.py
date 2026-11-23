from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("scouting.urls")),
    # Connexion pour l'interface navigable de DRF (pratique en dev)
    path("api-auth/", include("rest_framework.urls")),
]
