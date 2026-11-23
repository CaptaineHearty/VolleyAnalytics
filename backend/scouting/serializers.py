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
            "cree_par",
            "cree_le",
        ]
        read_only_fields = ["cree_le"]

    def validate(self, data):
        dom = data.get("equipe_dom", getattr(self.instance, "equipe_dom", None))
        ext = data.get("equipe_ext", getattr(self.instance, "equipe_ext", None))
        if dom is not None and dom == ext:
            raise serializers.ValidationError(
                {"equipe_ext": "Une équipe ne peut pas jouer contre elle-même."}
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
