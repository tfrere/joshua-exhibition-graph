# Distribution Voronoï des Posts

Ce script distribue les 40 000 posts dans un espace 3D en utilisant une approche Voronoï basée sur les positions des personnages (nœuds). Chaque post est positionné dans l'espace en fonction du personnage qui l'a publié, créant un effet de "nébuleuse" où les posts gravitent autour de leurs auteurs.

## Approche technique

1. **Diagramme de Voronoï 3D** - Génère un champ d'influence basé sur la position des personnages
2. **Champ de densité** - Transforme la distance aux frontières Voronoï en densité de probabilité
3. **Échantillonnage pondéré** - Distribue les points selon le champ de densité
4. **Bruit de Perlin** - Ajoute des perturbations organiques pour l'effet nébuleuse
5. **Gradients de densité** - Diminue progressivement l'influence en s'éloignant des nœuds
6. **Coloration par personnage** - Chaque personnage a une couleur unique pour ses posts

## Installation

Ce projet utilise [Poetry](https://python-poetry.org/) pour la gestion des dépendances.

### Prérequis

- Python 3.8+
- Poetry (voir [guide d'installation](https://python-poetry.org/docs/#installation))

### Installation des dépendances

```bash
cd joshua-exhibition-graph/spatialization/voronoi-spatialization
poetry install
```

## Utilisation

```bash
cd joshua-exhibition-graph/spatialization/voronoi-spatialization
poetry run python spatialize_posts_voronoi.py
```

Le script générera:

- Un fichier JSON `spatialized_posts_voronoi.json` contenant tous les posts avec leurs nouvelles coordonnées 3D et couleurs
- Des visualisations PNG des distributions de points

## Configuration

Vous pouvez ajuster les paramètres au début du script:

- `MAX_POSTS_PER_CHARACTER`: Limiter le nombre de posts par personnage (None = tous)
- `SPACE_SCALE`: Échelle de l'espace 3D (défaut: 300)
- `PERLIN_SCALE`: Échelle du bruit de Perlin (défaut: 0.05)
- `PERLIN_AMPLITUDE`: Amplitude des perturbations (défaut: 15)
- `DENSITY_FALLOFF`: Puissance de l'atténuation de densité (défaut: 1.5)
- `USE_COLOR_MAPPING`: Activer la coloration par personnage (défaut: True)
- `RANDOM_SEED`: Graine aléatoire pour la reproductibilité (défaut: 42)

## Intégration dans l'application

Une fois le fichier de sortie généré, copiez-le dans `joshua-exhibition-graph/client/public/data/` pour l'utiliser dans l'application web.
