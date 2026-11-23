from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.renderers import BaseRenderer
from rest_framework.settings import api_settings

from .export import generer_csv, nom_fichier
from .models import Equipe, Evenement, Joueur, Match
from .serializers import EquipeSerializer, EvenementSerializer, JoueurSerializer, MatchSerializer


class CSVRenderer(BaseRenderer):
    """Déclare le type text/csv à DRF.

    La vue d'export renvoie déjà le fichier tout fait ; ce renderer sert
    surtout à ce qu'un client qui envoie `Accept: text/csv` ne reçoive pas
    une erreur 406, et à rendre lisibles les erreurs (404, 403) dans ce cas.
    """

    media_type = "text/csv"
    format = "csv"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if isinstance(data, dict) and "detail" in data:
            return str(data["detail"]).encode(self.charset)
        return str(data or "").encode(self.charset)


class PaginationEvenements(PageNumberPagination):
    """Un match compte facilement plusieurs centaines d'actions :
    le client peut demander jusqu'à 1000 événements par page (?page_size=)."""

    page_size = 500
    page_size_query_param = "page_size"
    max_page_size = 1000


def filtrer_par_id(queryset, request, param, champ=None):
    """Filtre ?<param>=<id> ; ignore une valeur non numérique."""
    valeur = request.query_params.get(param)
    if valeur and valeur.isdigit():
        return queryset.filter(**{champ or param: int(valeur)})
    return queryset


class EquipeViewSet(viewsets.ModelViewSet):
    queryset = Equipe.objects.order_by("nom")
    serializer_class = EquipeSerializer


class JoueurViewSet(viewsets.ModelViewSet):
    serializer_class = JoueurSerializer

    def get_queryset(self):
        return filtrer_par_id(Joueur.objects.all(), self.request, "equipe")


class MatchViewSet(viewsets.ModelViewSet):
    queryset = Match.objects.select_related("equipe_dom", "equipe_ext", "cree_par")
    serializer_class = MatchSerializer

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)

    @action(
        detail=True,
        methods=["get"],
        url_path="export",
        renderer_classes=[*api_settings.DEFAULT_RENDERER_CLASSES, CSVRenderer],
    )
    def export_csv(self, request, pk=None):
        """GET /api/matchs/<id>/export/ : télécharge les événements en CSV."""
        match = self.get_object()
        reponse = HttpResponse(generer_csv(match), content_type="text/csv; charset=utf-8")
        reponse["Content-Disposition"] = f'attachment; filename="{nom_fichier(match)}"'
        return reponse


class EvenementViewSet(viewsets.ModelViewSet):
    serializer_class = EvenementSerializer
    pagination_class = PaginationEvenements

    def get_queryset(self):
        qs = Evenement.objects.select_related("saisi_par")
        qs = filtrer_par_id(qs, self.request, "match")
        return filtrer_par_id(qs, self.request, "set", "set_num")

    def perform_create(self, serializer):
        serializer.save(saisi_par=self.request.user)
