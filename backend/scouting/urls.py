from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("equipes", views.EquipeViewSet, basename="equipe")
router.register("joueurs", views.JoueurViewSet, basename="joueur")
router.register("matchs", views.MatchViewSet, basename="match")
router.register("evenements", views.EvenementViewSet, basename="evenement")

urlpatterns = router.urls
