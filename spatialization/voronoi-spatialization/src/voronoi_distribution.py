#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Module for distributing posts in 3D space using Voronoi-based influence fields.
"""

import numpy as np
from scipy.spatial import Voronoi
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from sklearn.preprocessing import MinMaxScaler
from tqdm import tqdm
import random
# import noise  # Remplacé par numpy pour éviter les problèmes d'installation
import time
import os
from collections import defaultdict
import matplotlib

def prepare_node_positions(nodes_data, space_scale):
    """Extract and normalize node positions."""
    # Extract node positions
    node_positions = np.array([
        [node.get("x", 0), node.get("y", 0), node.get("z", 0)]
        for node in nodes_data
    ])
    
    # Create a mapping from node names to indices
    node_name_to_index = {node["name"]: i for i, node in enumerate(nodes_data)}
    
    # Scale node positions to desired space size
    scaler = MinMaxScaler(feature_range=(-space_scale/2, space_scale/2))
    node_positions = scaler.fit_transform(node_positions)
    
    return node_positions, node_name_to_index

def visualize_3d_points(points, title="3D Points Distribution", colors=None, character_names=None, node_names=None, output_path=None, only_hires=False):
    """Visualize points in 3D space."""
    fig = plt.figure(figsize=(14, 12))
    ax = fig.add_subplot(111, projection='3d')
    
    # Plot points
    if colors is not None:
        # Use colors if provided
        scatter = ax.scatter(points[:, 0], points[:, 1], points[:, 2], s=3, alpha=0.8, c=colors)
    else:
        # Default: single color with alpha transparency
        scatter = ax.scatter(points[:, 0], points[:, 1], points[:, 2], s=2, alpha=0.6)
    
    ax.set_xlabel('X', fontsize=12)
    ax.set_ylabel('Y', fontsize=12)
    ax.set_zlabel('Z', fontsize=12)
    ax.set_title(title, fontsize=14, fontweight='bold')
    
    # Add node names if provided
    if node_names is not None:
        for i, name in enumerate(node_names):
            if i < len(points):  # Ensure we don't exceed the number of points
                ax.text(points[i, 0], points[i, 1], points[i, 2], name, fontsize=8, ha='center', va='bottom')
    
    # Add a legend if colors represent characters
    if colors is not None and character_names is not None:
        # Create a mapping from colors to character names
        unique_characters = {}
        for color, character in character_names.items():
            if character not in unique_characters and color in colors:
                unique_characters[character] = color
        
        # Create a custom legend
        from matplotlib.lines import Line2D
        legend_elements = []
        
        # Trier les personnages par ordre alphabétique pour la légende
        for character, color in sorted(unique_characters.items()):
            legend_elements.append(
                Line2D([0], [0], marker='o', color='w', 
                       label=character,
                       markerfacecolor=color, markersize=8)
            )
        
        # Créer une légende à plusieurs colonnes pour économiser de l'espace
        num_columns = min(3, max(1, len(legend_elements) // 10))
        ax.legend(handles=legend_elements, loc='upper right', 
                 fontsize=9, ncol=num_columns, 
                 bbox_to_anchor=(1.02, 1.02))
    
    # Ajuster les limites des axes pour voir tous les points
    ax.set_xlim(points[:, 0].min() - 10, points[:, 0].max() + 10)
    ax.set_ylim(points[:, 1].min() - 10, points[:, 1].max() + 10)
    ax.set_zlim(points[:, 2].min() - 10, points[:, 2].max() + 10)
    
    # Ajouter une grille pour mieux visualiser la profondeur
    ax.xaxis._axinfo["grid"]['color'] = (0.9, 0.9, 0.9, 0.4)
    ax.yaxis._axinfo["grid"]['color'] = (0.9, 0.9, 0.9, 0.4)
    ax.zaxis._axinfo["grid"]['color'] = (0.9, 0.9, 0.9, 0.4)
    
    plt.tight_layout()
    
    # Définir le chemin de sortie pour les images
    filename_base = title.replace(' ', '_').lower()
    
    # Si output_path est fourni, l'utiliser pour sauvegarder les images
    if output_path:
        # Créer le répertoire de sortie s'il n'existe pas
        os.makedirs(output_path, exist_ok=True)
        
        # Chemins complets pour les fichiers de sortie
        output_hires = os.path.join(output_path, f"{filename_base}_hires.png")
        
        # Version standard uniquement si on ne demande pas que la version haute résolution
        if not only_hires:
            output_std = os.path.join(output_path, f"{filename_base}.png")
            plt.savefig(output_std, dpi=300)
    else:
        # Chemins relatifs
        output_hires = f"{filename_base}_hires.png"
        
        # Version standard uniquement si on ne demande pas que la version haute résolution
        if not only_hires:
            plt.savefig(f"{filename_base}.png", dpi=300)
    
    # Toujours sauvegarder la version haute résolution
    plt.savefig(output_hires, dpi=600)
    
    plt.close()

def compute_voronoi_3d(points):
    """Compute 3D Voronoi diagram."""
    # Add points at "infinity" to ensure all regions are bounded
    # This is a common trick to handle unbounded Voronoi regions
    ptp_bound = np.ptp(points, axis=0).max() * 2
    center = np.mean(points, axis=0)
    
    # Add bounding box points
    extra_points = []
    for direction in [
        [1, 0, 0], [0, 1, 0], [0, 0, 1],
        [-1, 0, 0], [0, -1, 0], [0, 0, -1]
    ]:
        extra_points.append(center + direction * ptp_bound)
    
    # Combine original points with bounding points
    all_points = np.vstack([points, extra_points])
    
    # Compute Voronoi diagram
    vor = Voronoi(all_points)
    return vor

def distance_to_nearest_point(point, points):
    """Calculate distance to nearest point."""
    distances = np.sqrt(np.sum((points - point) ** 2, axis=1))
    return np.min(distances)

def generate_density_field(node_positions, space_scale, density_falloff, resolution=20):
    """Generate a density field based on distance to nodes."""
    # Create a grid
    x = np.linspace(-space_scale/2, space_scale/2, resolution)
    y = np.linspace(-space_scale/2, space_scale/2, resolution)
    z = np.linspace(-space_scale/2, space_scale/2, resolution)
    
    # Initialize density field
    density_field = np.zeros((resolution, resolution, resolution))
    
    # Calculate density based on distance to nearest node
    for i, xi in enumerate(x):
        for j, yj in enumerate(y):
            for k, zk in enumerate(z):
                point = np.array([xi, yj, zk])
                dist = distance_to_nearest_point(point, node_positions)
                # Convert distance to density (closer = higher density)
                density_field[i, j, k] = 1.0 / (1.0 + dist ** density_falloff)
    
    # Normalize density field
    density_field = density_field / density_field.sum()
    
    return density_field, (x, y, z)

def importance_sampling(density_field, grid_coords, num_samples, space_scale):
    """Sample points according to density field using importance sampling."""
    # Flatten the density field and coordinates
    flat_density = density_field.flatten()
    x, y, z = grid_coords
    
    # Create meshgrid of coordinates
    X, Y, Z = np.meshgrid(x, y, z, indexing='ij')
    positions = np.vstack([X.flatten(), Y.flatten(), Z.flatten()]).T
    
    # Sample indices according to density
    indices = np.random.choice(
        len(flat_density), 
        size=num_samples, 
        p=flat_density/flat_density.sum(), 
        replace=True
    )
    
    # Get the sampled positions
    sampled_positions = positions[indices]
    
    # Add jitter to avoid grid-like patterns
    jitter = np.random.uniform(-0.5, 0.5, size=sampled_positions.shape) * (space_scale / len(x))
    sampled_positions += jitter
    
    return sampled_positions

def apply_perlin_noise(positions, perlin_scale, perlin_amplitude):
    """Apply perlin-like noise to positions for organic distribution."""
    # Generate offsets using a perlin-like noise with numpy instead
    offsets = np.zeros_like(positions)
    
    # Les fréquences pour simuler différentes échelles de bruit
    frequencies = [perlin_scale, perlin_scale*2, perlin_scale*4]
    amplitudes = [1.0, 0.5, 0.25]
    
    print("Applying noise distortions to positions...")
    
    # Utiliser des sinusoïdes pour créer un bruit similaire à Perlin
    # C'est une approximation simplifiée mais efficace
    for i, pos in enumerate(tqdm(positions, desc="Applying noise distortions")):
        noise_value = np.zeros(3)
        
        # Combiner plusieurs fréquences pour un effet plus naturel (similar to Perlin)
        for freq, amp in zip(frequencies, amplitudes):
            phase1 = np.random.uniform(0, 2*np.pi)
            phase2 = np.random.uniform(0, 2*np.pi)
            phase3 = np.random.uniform(0, 2*np.pi)
            
            noise_value[0] += amp * np.sin(pos[0] * freq + phase1) * np.cos(pos[1] * freq + phase2)
            noise_value[1] += amp * np.sin(pos[1] * freq + phase2) * np.cos(pos[2] * freq + phase3)
            noise_value[2] += amp * np.sin(pos[2] * freq + phase3) * np.cos(pos[0] * freq + phase1)
        
        # Normaliser et appliquer l'amplitude
        noise_value = noise_value / np.sqrt(np.sum(frequencies))
        offsets[i] = noise_value
    
    # Scale the offsets
    offsets *= perlin_amplitude
    
    # Apply offsets to positions
    return positions + offsets

def find_nearest_node(point, node_positions):
    """Find the index of the nearest node to a given point."""
    distances = np.sqrt(np.sum((node_positions - point) ** 2, axis=1))
    return np.argmin(distances)

def generate_color_map(posts_data):
    """Generate a consistent color mapping for characters."""
    # Get unique character IDs
    character_ids = set()
    for post in posts_data:
        character_ids.add(post.get("character", "unknown"))
    
    # Generate colors using HSV color space for better distribution
    colors = {}
    hue_step = 1.0 / (len(character_ids) + 1)
    
    for i, character_id in enumerate(sorted(character_ids)):
        hue = i * hue_step
        # Convert HSV to RGB (simplified, using a common formula)
        h = hue * 6
        x = 1 - abs(h % 2 - 1)
        
        if h < 1:
            r, g, b = 1, x, 0
        elif h < 2:
            r, g, b = x, 1, 0
        elif h < 3:
            r, g, b = 0, 1, x
        elif h < 4:
            r, g, b = 0, x, 1
        elif h < 5:
            r, g, b = x, 0, 1
        else:
            r, g, b = 1, 0, x
        
        # Convert to hex
        hex_color = "#{:02x}{:02x}{:02x}".format(
            int(r * 255), int(g * 255), int(b * 255)
        )
        colors[character_id] = hex_color
    
    return colors

def map_characters_to_nodes(posts_data, node_positions):
    """Map characters to the most appropriate node."""
    character_to_node = {}
    
    # Récupérer la liste des personnages uniques
    characters = sorted(set(post.get("character", "unknown") for post in posts_data))
    num_characters = len(characters)
    num_nodes = len(node_positions)
    
    # Distribuer les personnages sur les nœuds de manière plus équilibrée
    # Au lieu d'attribuer aléatoirement, nous distribuons uniformément
    for i, character in enumerate(characters):
        # Utiliser une distribution déterministe pour répartir les personnages
        # Si nous avons plus de personnages que de nœuds, certains nœuds seront partagés
        node_idx = i % num_nodes
        character_to_node[character] = node_idx
        print(f"Personnage '{character}' assigné au nœud {node_idx}")
    
    return character_to_node

def visualize_character_nodes(node_positions, character_to_node, color_map, space_scale, output_path=None, only_hires=False):
    """Visualizer les positions des personnages dans l'espace 3D."""
    # Créer un tableau de positions uniques pour les personnages
    character_positions = {}
    node_to_characters = defaultdict(list)
    
    # Inverser le mapping personnage -> nœud pour obtenir nœud -> personnages
    for character, node_idx in character_to_node.items():
        node_to_characters[node_idx].append(character)
    
    # Extraire la position unique pour chaque personnage
    for node_idx, characters in node_to_characters.items():
        node_pos = node_positions[node_idx]
        
        # S'il y a plusieurs personnages pour ce nœud, les espacer légèrement
        if len(characters) > 1:
            radius = space_scale * 0.01  # Petit rayon pour séparer les personnages
            for i, character in enumerate(characters):
                # Générer une position légèrement décalée
                angle = 2 * np.pi * i / len(characters)
                offset = np.array([radius * np.cos(angle), radius * np.sin(angle), 0])
                character_positions[character] = node_pos + offset
        else:
            # Un seul personnage pour ce nœud, utiliser la position du nœud
            character_positions[characters[0]] = node_pos
    
    # Convertir en format pour visualisation
    characters = list(character_positions.keys())
    positions = np.array([character_positions[char] for char in characters])
    colors = [color_map.get(char, "#cccccc") for char in characters]
    
    # Créer un mapping couleur -> personnage pour la légende
    color_to_character = {color_map.get(char, "#cccccc"): char for char in characters}
    
    # Visualiser
    visualize_3d_points(
        positions, 
        "Character Positions", 
        colors, 
        color_to_character,
        output_path=output_path,
        only_hires=only_hires
    )
    
    print(f"Visualisation des {len(characters)} personnages sauvegardée.")

def position_posts(posts_data, node_positions, config, output_path=None):
    """Position posts in 3D space influenced by node positions."""
    start_time = time.time()
    
    # Get character-node mapping
    character_to_node = map_characters_to_nodes(posts_data, node_positions)
    print(f"Generated character-to-node mapping for {len(character_to_node)} characters")
    
    # Generate density field
    print("Generating density field...")
    density_field, grid_coords = generate_density_field(
        node_positions, 
        config['space_scale'], 
        config['density_falloff']
    )
    
    # Organiser les posts par personnage pour un meilleur traitement
    posts_by_character = {}
    for post in posts_data:
        character = post.get("character", "unknown")
        if character not in posts_by_character:
            posts_by_character[character] = []
        posts_by_character[character].append(post)
    
    # Generate color map for characters
    color_map = generate_color_map(posts_data) if config['use_color_mapping'] else {}
    
    # Visualiser les nœuds des personnages avant de positionner les posts
    # Seulement si les visualisations sont activées
    generate_visualizations = config.get('generate_visualizations', True)
    if config['use_color_mapping'] and generate_visualizations:
        print("Création d'une visualisation des positions des personnages...")
        visualize_character_nodes(node_positions, character_to_node, color_map, config['space_scale'], output_path=output_path)
    
    # Liste pour stocker tous les posts spatialisés
    all_positioned_posts = []
    
    # Traiter chaque personnage séparément
    for character, posts in posts_by_character.items():
        print(f"Positionnement des posts pour le personnage '{character}' ({len(posts)} posts)...")
        
        # Obtenir le nœud associé à ce personnage
        node_idx = character_to_node.get(character, 0)
        node_pos = node_positions[node_idx]
        
        # Créer un sous-espace centré autour du nœud du personnage
        # Définir un rayon d'influence pour ce personnage
        character_radius = config['space_scale'] / 4
        
        # Sample positions from density field, but only around this character's node
        num_samples = len(posts)
        
        # Générer des positions dans une sphère autour du nœud du personnage
        sampled_positions = np.zeros((num_samples, 3))
        
        for i in range(num_samples):
            # Générer un point aléatoire dans une sphère
            theta = np.random.uniform(0, 2 * np.pi)
            phi = np.random.uniform(0, np.pi)
            r = character_radius * np.random.uniform(0.1, 1.0) ** (1/3)  # Distribution en r³ pour uniformité
            
            # Convertir en coordonnées cartésiennes
            x = r * np.sin(phi) * np.cos(theta)
            y = r * np.sin(phi) * np.sin(theta)
            z = r * np.cos(phi)
            
            # Centrer autour du nœud du personnage
            sampled_positions[i] = node_pos + np.array([x, y, z])
        
        # Apply Perlin noise for organic distribution
        print(f"Applying noise distortions for character '{character}'...")
        sampled_positions = apply_perlin_noise(
            sampled_positions, 
            config['perlin_scale'], 
            config['perlin_amplitude'] * 0.5  # Réduire l'amplitude pour maintenir les clusters
        )
        
        # Assign positions to posts
        for i, post in enumerate(posts):
            # Get position
            position = sampled_positions[i % len(sampled_positions)].copy()
            
            # Store the results
            post["coordinates"] = {
                "x": float(position[0]),
                "y": float(position[1]),
                "z": float(position[2])
            }
            
            # Assign color based on character
            if config['use_color_mapping']:
                post["color"] = color_map.get(character, "#cccccc")
            
            # Ajouter à la liste de tous les posts
            all_positioned_posts.append(post)
    
    # Visualize a sample of the result (seulement si les visualisations sont activées)
    if generate_visualizations:
        # S'assurer que nous avons une répartition équilibrée des personnages pour la visualisation
        # Plutôt que de prendre les 10000 premiers posts, prendre un nombre limité de posts par personnage
        
        # Calculer le nombre maximum de posts à visualiser par personnage
        max_posts_per_character_for_viz = 300  # Limiter pour la visualisation
        max_total_sample = 10000  # Maximum total pour la visualisation
        
        # Préparer un échantillon équilibré
        sample_posts = []
        for character, posts in posts_by_character.items():
            # Prendre un échantillon limité pour chaque personnage
            character_sample = posts[:min(len(posts), max_posts_per_character_for_viz)]
            sample_posts.extend(character_sample)
        
        # Limiter l'échantillon total si nécessaire
        if len(sample_posts) > max_total_sample:
            np.random.shuffle(sample_posts)  # Mélanger pour avoir un échantillon représentatif
            sample_posts = sample_posts[:max_total_sample]
        
        print(f"Visualisation d'un échantillon de {len(sample_posts)} posts sur {len(all_positioned_posts)}")
        
        visualize_sample = np.array([
            [post["coordinates"]["x"], post["coordinates"]["y"], post["coordinates"]["z"]]
            for post in sample_posts
        ])
        
        # Extract colors for visualization
        if config['use_color_mapping']:
            visualize_colors = [post["color"] for post in sample_posts]
            
            # Créer un mapping de couleurs vers noms de personnages pour la légende
            color_to_character = {}
            for post in sample_posts:
                color = post["color"]
                character = post.get("character", "unknown")
                color_to_character[color] = character
            
            visualize_3d_points(
                visualize_sample, 
                "Posts Distribution by Character", 
                visualize_colors,
                color_to_character,
                output_path=output_path
            )
        else:
            visualize_3d_points(visualize_sample, "Posts Distribution", output_path=output_path)
    
    end_time = time.time()
    print(f"Positionnement terminé en {end_time - start_time:.2f} secondes.")
    
    return all_positioned_posts 

def create_combined_visualization(node_positions, node_names, posts_data, character_to_node, color_map, space_scale, output_path=None, only_hires=False):
    """
    Crée une visualisation combinée montrant à la fois les nœuds des personnages et les posts spatialisés.
    
    Args:
        node_positions: Positions des nœuds dans l'espace 3D
        node_names: Noms des nœuds
        posts_data: Données des posts spatialisés
        character_to_node: Dictionnaire mappant les personnages aux indices des nœuds
        color_map: Dictionnaire des couleurs par personnage
        space_scale: Échelle de l'espace 3D
        output_path: Chemin où sauvegarder l'image
        only_hires: Si True, ne génère que la version haute résolution
    """
    print("Création d'une visualisation combinée des nœuds et des posts...")
    
    # Initialiser la figure 3D
    fig = plt.figure(figsize=(16, 14))
    ax = fig.add_subplot(111, projection='3d')
    
    # --- ÉTAPE 1: Afficher les posts en petits points ---
    posts_positions = np.array([
        [post["coordinates"]["x"], post["coordinates"]["y"], post["coordinates"]["z"]]
        for post in posts_data
    ])
    
    # Limiter le nombre de posts si trop nombreux pour la visualisation
    max_posts_for_viz = 10000
    if len(posts_positions) > max_posts_for_viz:
        # Échantillonner de façon aléatoire
        indices = np.random.choice(len(posts_positions), max_posts_for_viz, replace=False)
        posts_positions = posts_positions[indices]
        # Extraire les couleurs correspondantes si disponibles
        if "color" in posts_data[0]:
            post_colors = [posts_data[i]["color"] for i in indices if i < len(posts_data)]
        else:
            post_colors = 'lightgray'  # Couleur par défaut
    else:
        # Utiliser tous les posts
        if "color" in posts_data[0]:
            post_colors = [post.get("color", "lightgray") for post in posts_data]
        else:
            post_colors = 'lightgray'  # Couleur par défaut
    
    # Tracer les posts en petits points
    ax.scatter(
        posts_positions[:, 0], 
        posts_positions[:, 1], 
        posts_positions[:, 2],
        s=1,  # Points très petits
        c=post_colors,
        alpha=0.3,  # Transparents
        marker='.'
    )
    
    # --- ÉTAPE 2: Afficher les nœuds des personnages ---
    
    # Préparer une cartographie des personnages aux nœuds
    character_positions = {}
    node_to_characters = defaultdict(list)
    
    # Associer les personnages aux nœuds
    for character, node_idx in character_to_node.items():
        node_to_characters[node_idx].append(character)
    
    # Extraire la position unique pour chaque personnage avec léger offset si plusieurs par nœud
    for node_idx, characters in node_to_characters.items():
        node_pos = node_positions[node_idx]
        
        # S'il y a plusieurs personnages pour ce nœud, les espacer
        if len(characters) > 1:
            radius = space_scale * 0.02  # Rayon pour séparer les personnages
            for i, character in enumerate(characters):
                angle = 2 * np.pi * i / len(characters)
                offset = np.array([radius * np.cos(angle), radius * np.sin(angle), 0])
                character_positions[character] = node_pos + offset
        else:
            # Un seul personnage pour ce nœud
            character_positions[characters[0]] = node_pos
    
    # Tracer les nœuds des personnages
    characters = list(character_positions.keys())
    char_positions = np.array([character_positions[char] for char in characters])
    char_colors = [color_map.get(char, "#cccccc") for char in characters]
    
    # Afficher les nœuds avec des points plus grands
    ax.scatter(
        char_positions[:, 0], 
        char_positions[:, 1], 
        char_positions[:, 2],
        s=100,  # Points plus grands
        c=char_colors,
        edgecolors='black',  # Contour noir
        alpha=1.0,  # Opacité complète
        marker='o',
        zorder=10  # S'assurer qu'ils sont au-dessus des posts
    )
    
    # Ajouter les étiquettes de texte pour chaque personnage
    for i, character in enumerate(characters):
        pos = char_positions[i]
        ax.text(
            pos[0], pos[1], pos[2] + space_scale * 0.01,  # Légèrement au-dessus
            character,
            fontsize=8,
            ha='center', va='bottom',
            fontweight='bold',
            zorder=11  # Au-dessus de tout
        )
    
    # --- ÉTAPE 3: Ajouter une légende des personnages ---
    from matplotlib.lines import Line2D
    legend_elements = []
    
    # Créer une légende pour un sous-ensemble des personnages (pour éviter d'être trop encombré)
    # Limiter à 20 personnages maximum pour la légende
    sorted_characters = sorted(character_positions.keys())
    legend_characters = sorted_characters[:min(20, len(sorted_characters))]
    
    for character in legend_characters:
        legend_elements.append(
            Line2D([0], [0], marker='o', color='w', 
                  label=character,
                  markerfacecolor=color_map.get(character, "#cccccc"), 
                  markeredgecolor='black',
                  markersize=8)
        )
    
    # Afficher le nombre total si on a limité
    if len(sorted_characters) > 20:
        legend_title = f"Personnages (20 sur {len(sorted_characters)} affichés)"
    else:
        legend_title = "Personnages"
    
    # Créer une légende à plusieurs colonnes
    num_columns = min(3, max(1, len(legend_elements) // 7))
    legend = ax.legend(
        handles=legend_elements, 
        loc='upper right',
        title=legend_title,
        fontsize=8, 
        ncol=num_columns,
        bbox_to_anchor=(1.05, 1.05)
    )
    legend.get_title().set_fontweight('bold')
    
    # --- ÉTAPE 4: Configurer la figure ---
    ax.set_xlabel('X', fontsize=12)
    ax.set_ylabel('Y', fontsize=12)
    ax.set_zlabel('Z', fontsize=12)
    ax.set_title("Distribution des Personnages et des Posts dans l'Espace 3D", fontsize=14, fontweight='bold')
    
    # Ajuster les limites des axes
    all_positions = np.vstack([posts_positions, char_positions])
    x_min, y_min, z_min = all_positions.min(axis=0) - space_scale * 0.05
    x_max, y_max, z_max = all_positions.max(axis=0) + space_scale * 0.05
    
    ax.set_xlim(x_min, x_max)
    ax.set_ylim(y_min, y_max)
    ax.set_zlim(z_min, z_max)
    
    # Ajouter une grille pour mieux visualiser la profondeur
    ax.xaxis._axinfo["grid"]['color'] = (0.9, 0.9, 0.9, 0.4)
    ax.yaxis._axinfo["grid"]['color'] = (0.9, 0.9, 0.9, 0.4)
    ax.zaxis._axinfo["grid"]['color'] = (0.9, 0.9, 0.9, 0.4)
    
    # Ajuster la position de la caméra pour une meilleure vue
    ax.view_init(elev=30, azim=45)
    
    plt.tight_layout()
    
    # Définir le chemin de sortie pour l'image
    if output_path:
        # Créer le répertoire de sortie s'il n'existe pas
        os.makedirs(output_path, exist_ok=True)
        output_file_hires = os.path.join(output_path, "distribution_combinee_hires.png")
        
        # Version standard uniquement si on ne demande pas que la version haute résolution
        if not only_hires:
            output_file = os.path.join(output_path, "distribution_combinee.png")
            plt.savefig(output_file, dpi=300, bbox_inches='tight')
            print(f"Visualisation combinée (standard) sauvegardée dans {output_file}")
    else:
        output_file_hires = "distribution_combinee_hires.png"
        
        # Version standard uniquement si on ne demande pas que la version haute résolution
        if not only_hires:
            plt.savefig("distribution_combinee.png", dpi=300, bbox_inches='tight')
    
    # Toujours sauvegarder la version haute résolution
    plt.savefig(output_file_hires, dpi=600, bbox_inches='tight')
    print(f"Visualisation combinée (haute résolution) sauvegardée dans {output_file_hires}")
    
    plt.close()
    
    return output_file_hires 

def create_top_characters_visualization(posts_data, character_to_node, node_positions, space_scale, output_path=None, only_hires=False, num_top_characters=5):
    """
    Crée une visualisation des posts appartenant uniquement aux personnages les plus actifs.
    
    Args:
        posts_data: Données des posts spatialisés
        character_to_node: Dictionnaire mappant les personnages aux indices des nœuds
        node_positions: Positions des nœuds dans l'espace 3D
        space_scale: Échelle de l'espace 3D
        output_path: Chemin où sauvegarder l'image
        only_hires: Si True, ne génère que la version haute résolution
        num_top_characters: Nombre de personnages principaux à afficher
    """
    print(f"Création d'une visualisation des {num_top_characters} personnages les plus actifs...")
    
    # Compter les posts par personnage
    character_post_counts = {}
    for post in posts_data:
        character = post.get("character", "unknown")
        if character not in character_post_counts:
            character_post_counts[character] = 0
        character_post_counts[character] += 1
    
    # Sélectionner les personnages avec le plus de posts
    top_characters = sorted(character_post_counts.items(), key=lambda x: x[1], reverse=True)[:num_top_characters]
    top_character_names = [char[0] for char in top_characters]
    
    print(f"Top {num_top_characters} personnages: {', '.join([f'{char} ({count} posts)' for char, count in top_characters])}")
    
    # Filtrer les posts pour ne garder que ceux des personnages principaux
    filtered_posts = [post for post in posts_data if post.get("character", "unknown") in top_character_names]
    
    # Créer une palette de couleurs distinctes pour les personnages principaux
    distinct_colors = [
        "#E41A1C",  # Rouge vif
        "#377EB8",  # Bleu
        "#4DAF4A",  # Vert
        "#984EA3",  # Violet
        "#FF7F00",  # Orange
        "#FFFF33",  # Jaune
        "#A65628",  # Marron
        "#F781BF",  # Rose
    ]
    
    # Assurer que nous avons assez de couleurs
    if num_top_characters > len(distinct_colors):
        # Ajouter des couleurs supplémentaires si nécessaire
        from matplotlib import cm
        additional_colors = cm.rainbow(np.linspace(0, 1, num_top_characters - len(distinct_colors)))
        distinct_colors.extend([matplotlib.colors.rgb2hex(c) for c in additional_colors[:, :3]])
    
    # Créer un nouveau mapping de couleurs pour les personnages principaux
    top_color_map = {char: distinct_colors[i] for i, char in enumerate(top_character_names)}
    
    # Initialiser la figure 3D
    fig = plt.figure(figsize=(20, 16))
    ax = fig.add_subplot(111, projection='3d')
    
    # Tracer les points pour chaque personnage séparément (pour la légende)
    handles = []
    labels = []
    
    # Tracer les posts par personnage
    for char_idx, character in enumerate(top_character_names):
        # Filtrer les posts pour ce personnage
        char_posts = [post for post in filtered_posts if post.get("character", "unknown") == character]
        
        # Extraire les positions
        positions = np.array([
            [post["coordinates"]["x"], post["coordinates"]["y"], post["coordinates"]["z"]]
            for post in char_posts
        ])
        
        # Couleur pour ce personnage
        color = top_color_map[character]
        
        # Tracer les points
        scatter = ax.scatter(
            positions[:, 0], 
            positions[:, 1], 
            positions[:, 2],
            s=3,  # Points légèrement plus grands que dans la vue complète
            c=color,
            alpha=0.7,  # Moins transparent pour cette vue
            marker='.',
            label=f"{character} ({len(char_posts)} posts)"
        )
        
        # Stocker le scatter plot pour la légende
        handles.append(scatter)
        labels.append(f"{character} ({len(char_posts)} posts)")
        
        # Trouver la position du nœud pour ce personnage
        if character in character_to_node:
            node_idx = character_to_node[character]
            node_pos = node_positions[node_idx]
            
            # Tracer le nœud avec un point plus grand
            ax.scatter(
                node_pos[0], node_pos[1], node_pos[2],
                s=200,  # Encore plus grand que dans la vue complète
                c=color,
                edgecolors='black',
                linewidths=2,
                alpha=1.0,
                marker='o',
                zorder=10
            )
            
            # Ajouter le nom du personnage
            ax.text(
                node_pos[0], node_pos[1], node_pos[2] + space_scale * 0.02,
                character,
                fontsize=12,
                ha='center', va='bottom',
                fontweight='bold',
                bbox=dict(facecolor='white', alpha=0.8, edgecolor='none', pad=3),
                zorder=11
            )
    
    # Configurer les axes
    ax.set_xlabel('X', fontsize=12)
    ax.set_ylabel('Y', fontsize=12)
    ax.set_zlabel('Z', fontsize=12)
    ax.set_title(f"Distribution des {num_top_characters} Personnages les Plus Actifs", fontsize=16, fontweight='bold')
    
    # Ajuster les limites des axes
    all_positions = np.array([
        [post["coordinates"]["x"], post["coordinates"]["y"], post["coordinates"]["z"]]
        for post in filtered_posts
    ])
    
    # Trouver les positions des nœuds pour ces personnages
    node_positions_filtered = []
    for character in top_character_names:
        if character in character_to_node:
            node_idx = character_to_node[character]
            node_positions_filtered.append(node_positions[node_idx])
    
    # Combiner les positions des posts et des nœuds
    if node_positions_filtered:
        all_positions = np.vstack([all_positions, node_positions_filtered])
    
    # Définir les limites avec un peu de marge
    x_min, y_min, z_min = all_positions.min(axis=0) - space_scale * 0.1
    x_max, y_max, z_max = all_positions.max(axis=0) + space_scale * 0.1
    
    ax.set_xlim(x_min, x_max)
    ax.set_ylim(y_min, y_max)
    ax.set_zlim(z_min, z_max)
    
    # Ajouter une grille pour mieux visualiser la profondeur
    ax.xaxis._axinfo["grid"]['color'] = (0.9, 0.9, 0.9, 0.3)
    ax.yaxis._axinfo["grid"]['color'] = (0.9, 0.9, 0.9, 0.3)
    ax.zaxis._axinfo["grid"]['color'] = (0.9, 0.9, 0.9, 0.3)
    
    # Ajouter la légende
    ax.legend(
        handles=handles,
        labels=labels,
        title="Personnages",
        loc='upper right',
        fontsize=10,
        title_fontsize=12,
        framealpha=0.8
    )
    
    # Ajuster la position de la caméra pour une meilleure vue
    ax.view_init(elev=25, azim=40)
    
    plt.tight_layout()
    
    # Définir le chemin de sortie pour l'image
    if output_path:
        # Créer le répertoire de sortie s'il n'existe pas
        os.makedirs(output_path, exist_ok=True)
        output_file_hires = os.path.join(output_path, "top_characters_hires.png")
        
        # Version standard uniquement si on ne demande pas que la version haute résolution
        if not only_hires:
            output_file = os.path.join(output_path, "top_characters.png")
            plt.savefig(output_file, dpi=300, bbox_inches='tight')
            print(f"Visualisation des personnages principaux (standard) sauvegardée dans {output_file}")
    else:
        output_file_hires = "top_characters_hires.png"
        
        # Version standard uniquement si on ne demande pas que la version haute résolution
        if not only_hires:
            plt.savefig("top_characters.png", dpi=300, bbox_inches='tight')
    
    # Toujours sauvegarder la version haute résolution
    plt.savefig(output_file_hires, dpi=600, bbox_inches='tight')
    print(f"Visualisation des personnages principaux (haute résolution) sauvegardée dans {output_file_hires}")
    
    plt.close()
    
    return output_file_hires 