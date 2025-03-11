# Système de Passes pour la Visualisation Spatiale

Ce document explique le fonctionnement du système de passes utilisé pour la visualisation spatiale des posts dans l'application Joshua.

## Principes généraux

Le système de passes permet d'appliquer séquentiellement différentes transformations aux positions des posts. Chaque passe a un rôle spécifique dans le processus de visualisation.

La configuration se fait via un tableau de passes dans l'ordre d'exécution souhaité, où chaque passe peut être activée ou désactivée individuellement.

## Configuration des passes

Dans `WorkPostPage.jsx`, la configuration se fait comme suit :

```javascript
const DEFAULT_POSTS_SPATIAL_CONFIG = {
  // Paramètres généraux
  joshuaOnly: false,
  preserveOtherPositions: true,
  radius: 60,
  minDistance: 40,
  verticalSpread: 1.5,
  horizontalSpread: 1.5,

  // Paramètres de coloration
  useUniqueColorsPerCharacter: true,

  // Passes de traitement dans l'ordre d'exécution
  passes: [
    {
      name: "voronoi", // Nom de la passe
      enabled: true, // Activer/désactiver
      config: {
        // Configuration spécifique
        perlinScale: 0.05,
        perlinAmplitude: 1,
        dilatationFactor: 1.2,
      },
    },
    // Autres passes...
  ],
};
```

## Passes disponibles

### 1. Passe Voronoi

- **Fichier** : `voronoiPass.js`
- **Fonction** : Spatialisation initiale des posts autour des nœuds de personnages
- **Paramètres** :
  - `perlinScale` : Échelle du bruit de Perlin (défaut: 0.05)
  - `perlinAmplitude` : Amplitude du bruit de Perlin (défaut: 1)
  - `dilatationFactor` : Facteur de dilatation des clusters (défaut: 1.2)

### 2. Passe Flowfield

- **Fichier** : `flowfieldPass.js`
- **Fonction** : Animation des positions des posts à travers un champ de vecteurs
- **Paramètres** :
  - `frames` : Nombre d'itérations de l'animation (défaut: 100)
  - `flowScale` : Échelle du flowfield (défaut: 0.02)
  - `flowStrength` : Force du flowfield (défaut: 5)

### 3. Passe Spherize

- **Fichier** : `spherizePass.js`
- **Fonction** : Normalisation des positions dans une sphère
- **Paramètres** :
  - `sphereRadius` : Rayon de la sphère (défaut: 250)
  - `volumeExponent` : Exposant pour la redistribution volumique (défaut: 2/3)
  - `minRadius` : Rayon minimal depuis le centre (défaut: 0)
  - `jitter` : Facteur de variation aléatoire (défaut: 0.2)

### 4. Passe Displacement

- **Fichier** : `displacementPass.js`
- **Fonction** : Déplacement radial basé sur du bruit de Perlin
- **Paramètres** :
  - `intensity` : Intensité du déplacement (défaut: 10)
  - `frequency` : Fréquence du bruit de Perlin (défaut: 0.05)
  - `seed` : Valeur de départ pour la génération du bruit (défaut: 42)
  - `minRadius` : Rayon minimal à préserver (défaut: 0)

## Ordre des passes

L'ordre des passes est important car chaque passe s'applique sur le résultat de la précédente. Un ordre typique est :

1. **Voronoi** : Positionnement initial des posts
2. **Flowfield** : Animation organique des positions
3. **Spherize** : Contrainte dans une sphère
4. **Displacement** : Ajout de texture avec du bruit de Perlin

## Implémentation technique

Le système utilise deux modes de fonctionnement :

1. **Mode tableau de passes** : Si un tableau `passes` est défini, le système exécute les passes dans l'ordre spécifié.
2. **Mode legacy** : Si aucun tableau n'est défini, le système utilise les options à plat (comme `useFlowfield`, `normalizeInSphere`, etc.).

## Ajouter une nouvelle passe

Pour ajouter une nouvelle passe :

1. Créer un nouveau fichier `nomDeLaPassePass.js` avec une fonction d'exportation principale
2. Modifier `postsPositionUtils.js` pour ajouter un nouveau cas dans le switch-case
3. Documenter la passe dans ce fichier README.md
4. Ajouter la configuration de la passe dans `DEFAULT_POSTS_SPATIAL_CONFIG`

## Déboggage

Chaque passe génère des logs détaillés dans la console pour suivre son exécution. Ces logs contiennent des informations sur les paramètres utilisés et le nombre de posts traités.
