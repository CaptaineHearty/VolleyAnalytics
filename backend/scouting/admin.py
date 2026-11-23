from django.contrib import admin

from .models import Equipe, Evenement, Joueur, Match


class JoueurInline(admin.TabularInline):
    model = Joueur
    extra = 0


@admin.register(Equipe)
class EquipeAdmin(admin.ModelAdmin):
    list_display = ("nom", "club")
    search_fields = ("nom", "club")
    inlines = [JoueurInline]


@admin.register(Joueur)
class JoueurAdmin(admin.ModelAdmin):
    list_display = ("numero", "nom", "prenom", "poste", "equipe")
    list_filter = ("equipe", "poste")
    search_fields = ("nom", "prenom")


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ("date", "equipe_dom", "equipe_ext", "competition", "video_nom")
    list_filter = ("competition",)
    date_hierarchy = "date"


@admin.register(Evenement)
class EvenementAdmin(admin.ModelAdmin):
    list_display = ("match", "set_num", "t_video", "action", "joueur", "zone", "qualite")
    list_filter = ("action", "set_num", "match")
    list_select_related = ("match", "joueur")
