from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models

ID_YOUTUBE = RegexValidator(
    r"^[A-Za-z0-9_-]{11}$", "Identifiant de vidéo YouTube invalide : 11 lettres, chiffres, - ou _."
)


class Equipe(models.Model):
    nom = models.CharField(max_length=100)
    club = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return self.nom


class Joueur(models.Model):
    class Poste(models.TextChoices):
        PASSEUR = "PAS", "Passeur"
        POINTU = "POI", "Pointu"
        RECEPTIONNEUR = "R4", "Réceptionneur-attaquant"
        CENTRAL = "CEN", "Central"
        LIBERO = "LIB", "Libéro"

    equipe = models.ForeignKey(Equipe, on_delete=models.CASCADE, related_name="joueurs")
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100, blank=True)
    numero = models.PositiveSmallIntegerField()
    poste = models.CharField(max_length=3, choices=Poste.choices, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["equipe", "numero"], name="numero_unique_par_equipe"),
        ]
        ordering = ["equipe", "numero"]

    def __str__(self):
        return f"#{self.numero} {self.prenom} {self.nom}".strip()


class Match(models.Model):
    equipe_dom = models.ForeignKey(Equipe, on_delete=models.PROTECT, related_name="matchs_dom")
    equipe_ext = models.ForeignKey(Equipe, on_delete=models.PROTECT, related_name="matchs_ext")
    date = models.DateField()
    competition = models.CharField(max_length=100, blank=True)
    # Deux sources possibles, jamais les deux :
    # - un fichier local : la vidéo reste sur le poste, on garde son nom et sa
    #   taille pour vérifier que l'utilisateur recharge le bon fichier ;
    # - une vidéo YouTube : on garde son identifiant.
    video_nom = models.CharField(max_length=255, blank=True)
    video_taille = models.PositiveBigIntegerField(
        null=True, blank=True, help_text="Taille du fichier en octets"
    )
    video_youtube = models.CharField(
        max_length=11,
        blank=True,
        validators=[ID_YOUTUBE],
        help_text="Identifiant YouTube (11 caractères), ex. dQw4w9WgXcQ",
    )
    cree_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]
        constraints = [
            models.CheckConstraint(
                condition=(models.Q(video_youtube="", video_taille__isnull=False) & ~models.Q(video_nom=""))
                | (~models.Q(video_youtube="") & models.Q(video_nom="", video_taille__isnull=True)),
                name="match_une_seule_source_video",
            ),
        ]

    def __str__(self):
        return f"{self.equipe_dom} – {self.equipe_ext} ({self.date})"


class Evenement(models.Model):
    class Action(models.TextChoices):
        SERVICE = "S", "Service"
        RECEPTION = "R", "Réception"
        PASSE = "P", "Passe"
        ATTAQUE = "A", "Attaque"
        BLOC = "B", "Bloc"
        DEFENSE = "D", "Défense"

    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name="evenements")
    t_video = models.FloatField(help_text="Horodatage dans la vidéo, en secondes")
    set_num = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    equipe = models.ForeignKey(Equipe, on_delete=models.PROTECT)
    joueur = models.ForeignKey(Joueur, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=1, choices=Action.choices)
    zone = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(6)]
    )
    qualite = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MaxValueValidator(3)], help_text="0 (erreur) à 3 (parfait)"
    )
    note = models.CharField(max_length=255, blank=True)
    saisi_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    # Évolution prévue : x_terrain / y_terrain (clic sur la vidéo + homographie)

    class Meta:
        ordering = ["match", "t_video"]
        indexes = [models.Index(fields=["match", "t_video"])]

    def __str__(self):
        return f"{self.t_video:.2f}s {self.get_action_display()} {self.joueur or ''}".strip()
