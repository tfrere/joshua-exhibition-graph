#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script pour traiter les posts déjà spatialisés et appliquer une transformation Voronoï par dilatation.
"""

import json
import os
import shutil
import random
import numpy as np
from collections import defaultdict
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from tqdm import tqdm
import time
import colorsys

# Import des fonctions du module Voronoï
from src.voronoi_distribution import apply_perlin_noise

# Chemins des fichiers et dossiers
# Utiliser le chemin relatif au script courant (et non à la racine du projet)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR = os.path.join(SCRIPT_DIR, "data", "input")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "data", "output")
VISUALIZATION_DIR = os.path.join(OUTPUT_DIR, "visualizations")

# Chemin vers le dossier client/public/data
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLIENT_DATA_DIR = os.path.join(BASE_DIR, "client", "public", "data")

# Créer les dossiers s'ils n'existent pas
os.makedirs(INPUT_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(CLIENT_DATA_DIR, exist_ok=True)
os.makedirs(VISUALIZATION_DIR, exist_ok=True)

# Fichier d'entrée avec les positions pré-calculées
POSTS_WITH_POSITIONS_FILE = os.path.join(INPUT_DIR, "posts-with-positions.json")

# Fichiers de sortie
LOCAL_OUTPUT_FILE = os.path.join(OUTPUT_DIR, "spatialized_posts.json")
CLIENT_OUTPUT_FILE = os.path.join(CLIENT_DATA_DIR, "spatialized_posts.json")

# Configuration
CONFIG = {
    'output_file': LOCAL_OUTPUT_FILE,
    'max_posts_per_character': None,   # None pour tous les posts
    'space_scale': 100,                # Échelle de l'espace
    'perlin_scale': 0.05,              # Échelle du bruit de Perlin (plus petit = plus lisse)
    'perlin_amplitude':15,            # Amplitude du bruit de Perlin (plus grand = plus de variation)
    'dilatation_factor': 1,           # Facteur de dilatation pour l'effet Voronoï (1.0 = pas de dilatation)
    'random_seed': 42,                 # Graine aléatoire
    'verbose': True,                   # Afficher les étapes
    'visualization': {
        'dpi': 300,                    # Résolution des images
        'figsize': (12, 10),           # Taille des figures
        'marker_size': 3,              # Taille des marqueurs (réduite)
        'alpha': 0.7,                  # Transparence des marqueurs (légèrement augmentée)
        'max_legend_items': 15         # Nombre maximum d'éléments dans la légende
    }
}

# Fixer la graine aléatoire pour la reproductibilité
np.random.seed(CONFIG['random_seed'])
random.seed(CONFIG['random_seed'])

def load_data():
    """Charger les posts avec leurs positions déjà définies."""
    print("Chargement des données pré-spatialisées...")
    
    # Charger les posts avec leurs positions
    with open(POSTS_WITH_POSITIONS_FILE, "r", encoding="utf-8") as f:
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
    
    print(f"Chargement de {len(posts_data)} posts avec leurs positions")
    return posts_data

def apply_voronoi_dilatation(posts_data):
    """
    Applique la transformation Voronoï par dilatation aux posts.
    Cette fonction dilate l'espace autour des centres de clusters de personnages.
    """
    print("Application de la transformation Voronoï par dilatation...")
    
    # Extraire les positions initiales
    positions = []
    for post in posts_data:
        positions.append([
            post.get("x", 0),
            post.get("y", 0),
            post.get("z", 0)
        ])
    
    positions = np.array(positions)
    
    # Calculer les centres des clusters par personnage
    character_centers = defaultdict(list)
    character_indices = defaultdict(list)
    
    for i, post in enumerate(posts_data):
        character = post.get("character", "unknown")
        character_centers[character].append(positions[i])
        character_indices[character].append(i)
    
    # Calculer le centre moyen pour chaque personnage
    avg_centers = {}
    for character, positions_list in character_centers.items():
        avg_centers[character] = np.mean(positions_list, axis=0)
    
    # Appliquer la dilatation par rapport aux centres de clusters
    dilatated_positions = positions.copy()
    
    for character, indices in character_indices.items():
        center = avg_centers[character]
        for idx in indices:
            # Vecteur de la position au centre
            vec = positions[idx] - center
            # Dilatation
            dilatated_positions[idx] = center + vec * CONFIG['dilatation_factor']
    
    # Appliquer un bruit de Perlin pour ajouter de la variabilité
    dilatated_positions = apply_perlin_noise(
        dilatated_positions,
        CONFIG['perlin_scale'],
        CONFIG['perlin_amplitude']
    )
    
    # Mettre à jour les positions dans les données des posts
    spatialized_posts = []
    for i, post in enumerate(posts_data):
        new_post = post.copy()  # Copie pour ne pas modifier l'original
        new_post["original_x"] = post.get("x", 0)
        new_post["original_y"] = post.get("y", 0)
        new_post["original_z"] = post.get("z", 0)
        new_post["x"] = float(dilatated_positions[i][0])
        new_post["y"] = float(dilatated_positions[i][1])
        new_post["z"] = float(dilatated_positions[i][2])
        spatialized_posts.append(new_post)
    
    print(f"Transformation appliquée à {len(spatialized_posts)} posts")
    return spatialized_posts

def generate_distinct_colors(n_colors):
    """
    Génère un ensemble de couleurs distinctes visuellement.
    Utilise le modèle HSV pour assurer une distribution homogène des teintes.
    """
    colors = []
    for i in range(n_colors):
        # Répartir les teintes uniformément sur le cercle des couleurs
        h = i / n_colors
        # Saturation et luminosité fixes pour des couleurs vives mais pas trop agressives
        s = 0.7
        v = 0.9
        # Conversion HSV en RGB
        r, g, b = colorsys.hsv_to_rgb(h, s, v)
        colors.append([r, g, b])
    
    # Mélanger les couleurs pour éviter que des personnages avec des IDs séquentiels
    # aient des couleurs similaires
    random.shuffle(colors)
    return colors

def clean_post_data(posts_with_positions):
    """
    Nettoie les données des posts pour ne garder que le nom du personnage,
    le timestamp et les coordonnées.
    """
    print("Formattage des données des posts...")
    cleaned_posts = []
    
    # Identifier tous les personnages uniques
    unique_characters = set()
    for post in posts_with_positions:
        unique_characters.add(post.get("character", "unknown"))
    
    print(f"Nombre de personnages uniques: {len(unique_characters)}")
    
    # Générer des couleurs distinctes pour chaque personnage
    distinct_colors = generate_distinct_colors(len(unique_characters))
    character_colors = {}
    
    # Assigner une couleur à chaque personnage
    for i, character in enumerate(sorted(unique_characters)):
        character_colors[character] = distinct_colors[i % len(distinct_colors)]
    
    # Créer une palette de couleurs pour les personnages (pour la visualisation)
    for post in posts_with_positions:
        character = post.get("character", "unknown")
        
        # Créer un nouveau dictionnaire avec seulement les champs nécessaires
        cleaned_post = {
            "character": character,
            "timestamp": post.get("creationDate", 0),  # Utiliser creationDate comme timestamp
            "coordinates": {
                "x": post.get("x", 0),
                "y": post.get("y", 0),
                "z": post.get("z", 0)
            },
            "color": character_colors[character]  # Ajouter la couleur pour la visualisation
        }
        
        # Ajouter les coordonnées originales pour référence si disponibles
        if "original_x" in post and "original_y" in post and "original_z" in post:
            cleaned_post["original_coordinates"] = {
                "x": post.get("original_x", 0),
                "y": post.get("original_y", 0),
                "z": post.get("original_z", 0)
            }
        
        # Ajouter d'autres champs utiles si nécessaires
        if "postUID" in post:
            cleaned_post["id"] = post["postUID"]
        
        cleaned_posts.append(cleaned_post)
    
    print(f"Données formatées : {len(cleaned_posts)} posts")
    return cleaned_posts, character_colors

def create_3d_visualization(cleaned_posts, character_colors, filename="all_posts_3d"):
    """Crée une visualisation 3D de tous les posts."""
    print(f"Création de la visualisation 3D pour tous les posts...")
    
    fig = plt.figure(figsize=CONFIG['visualization']['figsize'], dpi=CONFIG['visualization']['dpi'])
    ax = fig.add_subplot(111, projection='3d')
    
    # Extraire les coordonnées et les couleurs
    x_coords = []
    y_coords = []
    z_coords = []
    colors = []
    
    for post in cleaned_posts:
        coords = post["coordinates"]
        x_coords.append(coords["x"])
        y_coords.append(coords["y"])
        z_coords.append(coords["z"])
        colors.append(post["color"])
    
    # Tracer les points
    ax.scatter(
        x_coords, y_coords, z_coords, 
        c=colors, 
        s=CONFIG['visualization']['marker_size'], 
        alpha=CONFIG['visualization']['alpha'],
        edgecolors='none'  # Supprimer les bordures
    )
    
    # Ajouter une légende pour les personnages les plus fréquents
    character_counts = {}
    for post in cleaned_posts:
        character = post["character"]
        if character not in character_counts:
            character_counts[character] = 0
        character_counts[character] += 1
    
    # Trier les personnages par nombre de posts (descendant)
    top_characters = sorted(character_counts.items(), key=lambda x: x[1], reverse=True)
    
    # Limiter le nombre d'éléments dans la légende
    max_legend = min(len(top_characters), CONFIG['visualization']['max_legend_items'])
    
    # Ajouter des points de légende fictifs pour chaque personnage principal
    for i in range(max_legend):
        character, count = top_characters[i]
        color = next((post["color"] for post in cleaned_posts if post["character"] == character), [0, 0, 0])
        ax.scatter([], [], [], c=[color], s=30, label=f"{character} ({count})")
    
    # Configurer les axes
    ax.set_xlabel('X')
    ax.set_ylabel('Y')
    ax.set_zlabel('Z')
    ax.set_title('Distribution 3D des Posts')
    
    # Ajouter la légende
    ax.legend(loc='upper right', bbox_to_anchor=(1.1, 1.0))
    
    # Sauvegarder l'image
    output_path = os.path.join(VISUALIZATION_DIR, f"{filename}.png")
    plt.savefig(output_path, dpi=CONFIG['visualization']['dpi'], bbox_inches='tight')
    plt.close()
    
    print(f"✅ Visualisation 3D sauvegardée dans {output_path}")

def main():
    """Fonction principale pour traiter les posts déjà spatialisés."""
    print("Démarrage du traitement des posts déjà spatialisés...")
    
    # Charger les données pré-spatialisées
    posts_data = load_data()
    
    # Appliquer la transformation Voronoï par dilatation
    spatialized_posts = apply_voronoi_dilatation(posts_data)
    
    # Nettoyer et formater les données des posts
    cleaned_posts, character_colors = clean_post_data(spatialized_posts)
    
    # Créer les visualisations
    print("Génération des visualisations...")
    create_3d_visualization(cleaned_posts, character_colors)
    
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