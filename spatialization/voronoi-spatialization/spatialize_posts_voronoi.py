#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script principal pour spatialiser les posts dans l'espace 3D en utilisant une approche Voronoï.
"""

import json
import os
import time
import random
from collections import defaultdict
import numpy as np
from tqdm import tqdm
import shutil

# Import des fonctions du module
from src.voronoi_distribution import (
    prepare_node_positions,
    visualize_3d_points,
    position_posts
)

# Chemins des fichiers et dossiers
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLIENT_DATA_DIR = os.path.join(BASE_DIR, "client", "public", "data")
LOCAL_OUTPUT_FILE = "spatialized_posts_voronoi.json"
CLIENT_OUTPUT_FILE = os.path.join(CLIENT_DATA_DIR, "spatialized_posts_voronoi.json")

# Configuration
CONFIG = {
    'output_file': LOCAL_OUTPUT_FILE,
    'max_posts_per_character': None,  # None pour tous les posts
    'space_scale': 400,               # Échelle de l'espace 3D (augmentée pour plus de séparation)
    'perlin_scale': 0.03,             # Échelle du bruit de Perlin (réduite pour moins de distorsion)
    'perlin_amplitude': 10,           # Amplitude des perturbations (réduite pour conserver les clusters)
    'density_falloff': 2.0,           # Puissance de l'atténuation de densité (augmentée pour des limites plus nettes)
    'use_color_mapping': True,        # Coloration par personnage
    'random_seed': 42,                # Graine aléatoire
    'verbose': True                   # Afficher les étapes
}

# Fixer la graine aléatoire pour la reproductibilité
np.random.seed(CONFIG['random_seed'])
random.seed(CONFIG['random_seed'])

def load_data():
    """Charger les positions des nœuds et les posts."""
    print("Chargement des données...")
    
    # Charger les positions des nœuds
    with open("node-positions.json", "r", encoding="utf-8") as f:
        nodes_data = json.load(f)
    
    # Charger les posts
    with open("posts.json", "r", encoding="utf-8") as f:
        posts_data = json.load(f)
    
    if CONFIG['max_posts_per_character']:
        print(f"Limitation à {CONFIG['max_posts_per_character']} posts par personnage...")
        
        # Grouper les posts par personnage
        character_posts = defaultdict(list)
        for post in posts_data:
            character_posts[post.get("character", "unknown")].append(post)
        
        # Limiter les posts par personnage
        limited_posts = []
        for character, posts in character_posts.items():
            limited_posts.extend(posts[:CONFIG['max_posts_per_character']])
        
        posts_data = limited_posts
    
    print(f"Chargement de {len(nodes_data)} nœuds et {len(posts_data)} posts")
    return nodes_data, posts_data

def main():
    """Fonction principale pour exécuter le processus de spatialisation."""
    print("Démarrage de la spatialisation des posts selon l'approche Voronoï...")
    
    # Charger les données
    nodes_data, posts_data = load_data()
    
    # Préparer les positions des nœuds
    node_positions, node_name_to_index = prepare_node_positions(nodes_data, CONFIG['space_scale'])
    
    # Visualiser les positions des nœuds
    visualize_3d_points(node_positions, "Positions des Nœuds")
    
    # Positionner les posts
    spatialized_posts = position_posts(posts_data, node_positions, CONFIG)
    
    # Sauvegarder les résultats localement
    print(f"Sauvegarde des résultats dans {CONFIG['output_file']}...")
    with open(CONFIG['output_file'], "w", encoding="utf-8") as f:
        json.dump(spatialized_posts, f)
    
    # Copier le fichier dans le dossier public/data du client
    if os.path.exists(CLIENT_DATA_DIR):
        print(f"Copie du fichier dans {CLIENT_OUTPUT_FILE}...")
        shutil.copy2(CONFIG['output_file'], CLIENT_OUTPUT_FILE)
        print(f"✅ Fichier copié avec succès dans le dossier client/public/data!")
    else:
        print(f"⚠️ Le dossier {CLIENT_DATA_DIR} n'a pas été trouvé.")
        print("Vous devrez copier manuellement le fichier généré vers ce dossier.")
    
    print("Terminé ! 🎉")

if __name__ == "__main__":
    main() 