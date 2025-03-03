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

def visualize_3d_points(points, title="3D Points Distribution", colors=None, character_names=None):
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
    plt.savefig(f"{title.replace(' ', '_').lower()}.png", dpi=300)
    
    # Sauvegarder également une version avec une meilleure résolution
    plt.savefig(f"{title.replace(' ', '_').lower()}_hires.png", dpi=600)
    
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

def visualize_character_nodes(node_positions, character_to_node, color_map, space_scale):
    """Visualizer les positions des personnages dans l'espace 3D."""
    # Créer un tableau de positions uniques pour les personnages
    unique_character_nodes = {}
    character_colors = {}
    
    # Pour chaque personnage, récupérer son nœud et sa couleur
    for character, node_idx in character_to_node.items():
        if character in color_map:
            node_pos = node_positions[node_idx]
            unique_character_nodes[character] = node_pos
            character_colors[character] = color_map[character]
    
    # Convertir en arrays numpy pour la visualisation
    characters = list(unique_character_nodes.keys())
    character_positions = np.array([unique_character_nodes[char] for char in characters])
    node_colors = [character_colors[char] for char in characters]
    
    # Création de la figure
    fig = plt.figure(figsize=(14, 12))
    ax = fig.add_subplot(111, projection='3d')
    
    # Afficher les nœuds avec des points plus grands
    scatter = ax.scatter(
        character_positions[:, 0], 
        character_positions[:, 1], 
        character_positions[:, 2],
        s=100,  # Points plus grands
        c=node_colors,
        edgecolors='black',  # Contour noir pour plus de visibilité
        alpha=1.0  # Opacité complète
    )
    
    # Ajouter des étiquettes de texte pour chaque personnage
    for i, char in enumerate(characters):
        pos = character_positions[i]
        ax.text(pos[0], pos[1], pos[2], char, fontsize=8, ha='center', va='bottom')
    
    # Configurer les axes
    ax.set_xlabel('X', fontsize=12)
    ax.set_ylabel('Y', fontsize=12)
    ax.set_zlabel('Z', fontsize=12)
    ax.set_title("Distribution des Personnages dans l'Espace 3D", fontsize=14, fontweight='bold')
    
    # Définir les limites des axes
    margin = space_scale * 0.1  # Marge de 10%
    ax.set_xlim(-space_scale/2 - margin, space_scale/2 + margin)
    ax.set_ylim(-space_scale/2 - margin, space_scale/2 + margin)
    ax.set_zlim(-space_scale/2 - margin, space_scale/2 + margin)
    
    # Ajouter une légende
    from matplotlib.lines import Line2D
    legend_elements = []
    
    # Créer la légende
    for character, color in sorted(character_colors.items()):
        legend_elements.append(
            Line2D([0], [0], marker='o', color='w', 
                  label=character,
                  markerfacecolor=color, 
                  markeredgecolor='black',
                  markersize=8)
        )
    
    # Légende sur plusieurs colonnes
    num_columns = min(3, max(1, len(legend_elements) // 10))
    ax.legend(handles=legend_elements, loc='upper right', 
             fontsize=9, ncol=num_columns, 
             bbox_to_anchor=(1.02, 1.02))
    
    # Ajouter une grille
    ax.xaxis._axinfo["grid"]['color'] = (0.9, 0.9, 0.9, 0.4)
    ax.yaxis._axinfo["grid"]['color'] = (0.9, 0.9, 0.9, 0.4)
    ax.zaxis._axinfo["grid"]['color'] = (0.9, 0.9, 0.9, 0.4)
    
    plt.tight_layout()
    plt.savefig("character_nodes_distribution.png", dpi=300)
    plt.savefig("character_nodes_distribution_hires.png", dpi=600)
    plt.close()
    
    print(f"Visualisation des {len(characters)} personnages sauvegardée.")

def position_posts(posts_data, node_positions, config):
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
    if config['use_color_mapping']:
        print("Création d'une visualisation des positions des personnages...")
        visualize_character_nodes(node_positions, character_to_node, color_map, config['space_scale'])
    
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
    
    # Visualize a sample of the result
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
            color_to_character
        )
    else:
        visualize_3d_points(visualize_sample, "Posts Distribution")
    
    print(f"Positioned {len(all_positioned_posts)} posts in {time.time() - start_time:.2f} seconds")
    return all_positioned_posts 