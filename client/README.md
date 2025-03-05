# R3F Force Graph Demo

Ce projet est une démonstration d'un graphe de force 3D utilisant React Three Fiber (R3F) et r3f-forcegraph.

## Prérequis

- Node.js 20.x
- Yarn

## Installation

1. Clonez ce dépôt
2. Naviguez vers le dossier du projet
3. Installez les dépendances avec Yarn :

```bash
cd joshua-exhibition-graph/client-new
nvm use 20  # Assurez-vous d'utiliser Node.js 20.x
yarn
```

## Développement

Pour lancer le serveur de développement :

```bash
yarn dev
```

L'application sera disponible à l'adresse [http://localhost:5173](http://localhost:5173).

## Fonctionnalités

- Graphe de force 3D interactif
- Génération aléatoire de nœuds et de liens
- Navigation 3D avec contrôles de caméra (zoom, rotation, panoramique)
- Animation automatique du graphe

## Technologies utilisées

- React 19
- Vite 6
- React Three Fiber (R3F)
- Three.js
- r3f-forcegraph

## Structure du projet

- `src/App.jsx` - Composant principal de l'application
- `src/components/ForceGraph.jsx` - Composant du graphe de force
- `src/App.css` - Styles CSS pour l'application
- `src/index.css` - Styles CSS globaux

## Contrôles

- **Rotation** : Cliquez et faites glisser avec la souris
- **Zoom** : Utilisez la molette de la souris
- **Panoramique** : Cliquez avec le bouton droit de la souris et faites glisser
