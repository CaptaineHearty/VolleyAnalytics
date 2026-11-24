from rest_framework import serializers

from .models import Equipe, Evenement, Joueur, Match


class EquipeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Equipe
        fields = ["id", "nom", "club"]


class JoueurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Joueur
        fields = ["id", "equipe", "nom", "prenom", "numero", "poste"]


class MatchSerializer(serializers.ModelSerializer):
    cree_par = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Match
        fields = [
            "id",
            "equipe_dom",
            "equipe_ext",
            "date",
            "competition",
            "video_nom",
            "video_taille",
            "video_youtube",
            "cree_par",
            "cree_le",
        ]
        read_only_fields = ["cree_le"]

    def validate(self, data):
        def valeur(champ, defaut=None):
            return data.get(champ, getattr(self.instance, champ, defaut))

        dom, ext = valeur("equipe_dom"), valeur("equipe_ext")
        if dom is not None and dom == ext:
            raise serializers.ValidationError(
                {"equipe_ext": "Une équipe ne peut pas jouer contre elle-même."}
            )

        # Une seule source vidéo : un fichier local (nom + taille) ou YouTube.
        fichier = bool(valeur("video_nom", "")) or valeur("video_taille") is not None
        youtube = bool(valeur("video_youtube", ""))
        if fichier and youtube:
            raise serializers.ValidationError(
                {"video": "Choisissez une seule source : un fichier ou une vidéo YouTube."}
            )
        if not youtube and (not valeur("video_nom", "") or valeur("video_taille") is None):
            raise serializers.ValidationError(
                {"video": "Indiquez la vidéo du match : un fichier (nom et taille) ou une vidéo YouTube."}
            )
        return data


class EvenementSerializer(serializers.ModelSerializer):
    saisi_par = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Evenement
        fields = [
            "id",
            "match",
            "t_video",
            "set_num",
            "equipe",
            "joueur",
            "action",
            "zone",
            "qualite",
            "note",
            "saisi_par",
            "cree_le",
        ]
        read_only_fields = ["cree_le"]

    def validate_t_video(self, valeur):
        if valeur < 0:
            raise serializers.ValidationError("L'horodatage ne peut pas être négatif.")
        return valeur

    def validate(self, data):
        def valeur(champ):
            return data.get(champ, getattr(self.instance, champ, None))

        match, equipe, joueur = valeur("match"), valeur("equipe"), valeur("joueur")
        erreurs = {}
        if match and equipe and equipe.pk not in (match.equipe_dom_id, match.equipe_ext_id):
            erreurs["equipe"] = "Cette équipe ne joue pas ce match."
        if joueur and equipe and joueur.equipe_id != equipe.pk:
            erreurs["joueur"] = "Ce joueur n'appartient pas à l'équipe indiquée."
        if erreurs:
            raise serializers.ValidationError(erreurs)
        return data
