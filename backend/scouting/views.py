from rest_framework import viewsets
from rest_framework.pagination import PageNumberPagination

from .models import Equipe, Evenement, Joueur, Match
from .serializers import EquipeSerializer, EvenementSerializer, JoueurSerializer, MatchSerializer


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


class EvenementViewSet(viewsets.ModelViewSet):
    serializer_class = EvenementSerializer
    pagination_class = PaginationEvenements

    def get_queryset(self):
        qs = Evenement.objects.select_related("saisi_par")
        qs = filtrer_par_id(qs, self.request, "match")
        return filtrer_par_id(qs, self.request, "set", "set_num")

    def perform_create(self, serializer):
        serializer.save(saisi_par=self.request.user)
