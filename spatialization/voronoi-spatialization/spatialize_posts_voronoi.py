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
    position_posts,
    create_combined_visualization,
    create_top_characters_visualization
)

# Chemins des fichiers et dossiers
# Utiliser le chemin relatif au script courant (et non à la racine du projet)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR = os.path.join(SCRIPT_DIR, "data", "input")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "data", "output")

# Chemin vers le dossier client/public/data
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLIENT_DATA_DIR = os.path.join(BASE_DIR, "client", "public", "data")

# Créer les dossiers s'ils n'existent pas
os.makedirs(INPUT_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(CLIENT_DATA_DIR, exist_ok=True)

# Fichiers d'entrée
NODE_POSITIONS_FILE = os.path.join(INPUT_DIR, "node-positions.json")
POSTS_FILE = os.path.join(INPUT_DIR, "posts.json")

# Fichiers de sortie
LOCAL_OUTPUT_FILE = os.path.join(OUTPUT_DIR, "spatialized_posts_voronoi.json")
CLIENT_OUTPUT_FILE = os.path.join(CLIENT_DATA_DIR, "spatialized_posts_voronoi.json")

# Configuration
CONFIG = {
    'output_file': LOCAL_OUTPUT_FILE,
    'max_posts_per_character': None,  # None pour tous les posts
    'space_scale': 500,               # Augmenté pour plus d'espace entre les clusters
    'perlin_scale': 0.06,             # Réduit pour des variations plus douces
    'perlin_amplitude': 100,           # Augmenté significativement pour une meilleure dispersion
    'density_falloff': 1.5,           # Réduit pour une distribution plus uniforme
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
    with open(NODE_POSITIONS_FILE, "r", encoding="utf-8") as f:
        nodes_data = json.load(f)
    
    # Charger les posts
    with open(POSTS_FILE, "r", encoding="utf-8") as f:
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

def clean_post_data(spatialized_posts):
    """
    Nettoie les données des posts pour ne garder que le nom du personnage,
    le timestamp et les coordonnées.
    """
    print("Nettoyage des données des posts...")
    cleaned_posts = []
    
    for post in spatialized_posts:
        # Créer un nouveau dictionnaire avec seulement les champs nécessaires
        cleaned_post = {
            "character": post.get("character", "unknown"),
            "timestamp": post.get("timestamp", 0),
            "coordinates": post.get("coordinates", {"x": 0, "y": 0, "z": 0})
        }
        
        # Ajouter la couleur si présente (utile pour la visualisation)
        if "color" in post:
            cleaned_post["color"] = post["color"]
        
        cleaned_posts.append(cleaned_post)
    
    print(f"Données nettoyées : {len(cleaned_posts)} posts")
    return cleaned_posts

def main():
    """Fonction principale pour exécuter le processus de spatialisation."""
    print("Démarrage de la spatialisation des posts selon l'approche Voronoï...")
    
    # Charger les données
    nodes_data, posts_data = load_data()
    
    # Préparer les positions des nœuds
    node_positions, node_name_to_index = prepare_node_positions(nodes_data, CONFIG['space_scale'])
    
    # Extraire les noms des nœuds dans le même ordre que les positions
    node_names = [node["name"] for node in nodes_data]
    
    # Supprimer la visualisation des positions des nœuds (uniquement conserver la visualisation combinée)
    # visualize_3d_points(node_positions, "Positions des Nœuds", node_names=node_names, output_path=OUTPUT_DIR)
    
    # Positionner les posts sans générer de visualisation
    # Modifier CONFIG pour désactiver la visualisation intermédiaire des personnages
    config_copy = CONFIG.copy()
    config_copy['generate_visualizations'] = False
    
    # Positionner les posts sans générer de visualisations
    spatialized_posts = position_posts(posts_data, node_positions, config_copy, output_path=OUTPUT_DIR)
    
    # Nettoyer les données des posts pour ne garder que les champs nécessaires
    cleaned_posts = clean_post_data(spatialized_posts)
    
    # Créer une carte de correspondance personnage -> nœud
    character_to_node = {}
    for post in cleaned_posts:
        character = post.get("character", "unknown")
        if character not in character_to_node:
            # Trouver le nœud le plus proche de ce post
            coords = post["coordinates"]
            post_pos = np.array([coords["x"], coords["y"], coords["z"]])
            distances = np.sqrt(np.sum((node_positions - post_pos) ** 2, axis=1))
            node_idx = np.argmin(distances)
            character_to_node[character] = node_idx
    
    # Extraire les couleurs utilisées dans les posts spatialisés
    color_map = {}
    for post in cleaned_posts:
        character = post.get("character", "unknown")
        if "color" in post and character not in color_map:
            color_map[character] = post["color"]
    
    # Créer uniquement la visualisation combinée en haute résolution
    print("Création de la visualisation combinée en haute résolution...")
    create_combined_visualization(
        node_positions, 
        node_names, 
        cleaned_posts, 
        character_to_node, 
        color_map, 
        CONFIG['space_scale'], 
        output_path=OUTPUT_DIR,
        only_hires=True  # Paramètre pour ne générer que la version haute résolution
    )
    
    # Créer la visualisation des 5 personnages les plus actifs
    print("Création de la visualisation des 5 personnages les plus actifs...")
    create_top_characters_visualization(
        cleaned_posts,
        character_to_node,
        node_positions,
        CONFIG['space_scale'],
        output_path=OUTPUT_DIR,
        only_hires=True,  # Paramètre pour ne générer que la version haute résolution
        num_top_characters=5  # Nombre de personnages principaux à afficher
    )
    
    # Sauvegarder les résultats dans le dossier local
    print(f"Sauvegarde des résultats dans {CONFIG['output_file']}...")
    with open(CONFIG['output_file'], "w", encoding="utf-8") as f:
        json.dump(cleaned_posts, f)
    
    # Copier également dans le dossier client/public/data
    print(f"Copie des résultats dans {CLIENT_OUTPUT_FILE}...")
    try:
        shutil.copy2(CONFIG['output_file'], CLIENT_OUTPUT_FILE)
        print(f"✅ Fichier copié avec succès dans le dossier client/public/data!")
    except Exception as e:
        print(f"⚠️ Erreur lors de la copie du fichier vers client/public/data: {e}")
        print("Vous devrez peut-être copier manuellement le fichier.")
    
    print("Terminé ! 🎉")

if __name__ == "__main__":
    main() 