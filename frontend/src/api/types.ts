// Types alignés sur les serializers Django (backend/scouting/serializers.py).

export type Poste = 'PAS' | 'POI' | 'R4' | 'CEN' | 'LIB' | ''

/** S Service, R Réception, P Passe, A Attaque, B Bloc, D Défense */
export type Action = 'S' | 'R' | 'P' | 'A' | 'B' | 'D'

export interface Equipe {
  id: number
  nom: string
  club: string
}

export interface Joueur {
  id: number
  equipe: number
  nom: string
  prenom: string
  numero: number
  poste: Poste
}

export interface Match {
  id: number
  equipe_dom: number
  equipe_ext: number
  date: string
  competition: string
  /** Source vidéo : un fichier local (nom + taille) OU une vidéo YouTube (identifiant). */
  video_nom: string
  video_taille: number | null
  video_youtube: string
  cree_par: string | null
  cree_le: string
}

export interface Evenement {
  id: number
  match: number
  t_video: number
  set_num: number
  equipe: number
  joueur: number | null
  action: Action
  zone: number | null
  qualite: number | null
  note: string
  saisi_par: string | null
  cree_le: string
}

/** Réponse paginée de Django REST Framework. */
export interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
