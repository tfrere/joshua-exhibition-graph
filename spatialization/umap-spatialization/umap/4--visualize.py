import json
import matplotlib.pyplot as plt
from matplotlib.colors import hsv_to_rgb
import numpy as np
from pathlib import Path
import hashlib
import pandas as pd
from mpl_toolkits.mplot3d import Axes3D
from matplotlib.ticker import MaxNLocator
import seaborn as sns
from matplotlib.colors import ListedColormap
import argparse


def load_data(file_path):
    """Charge les données spatialisées à partir d'un fichier JSON."""
    print(f"\n📚 Chargement des données depuis {file_path}...")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            posts = json.load(f)
        print(f"✅ {len(posts)} posts chargés")
        return posts
    except FileNotFoundError:
        print(f"❌ Fichier non trouvé: {file_path}")
        return None
    except json.JSONDecodeError:
        print(f"❌ Erreur de décodage JSON: {file_path}")
        return None


def extract_coordinates(posts):
    """Extrait les coordonnées des posts."""
    x = []
    y = []
    z = []
    slugs = []
    ids = []
    
    for post in posts:
        try:
            coords = post['coordinates']
            x.append(coords['x'])
            y.append(coords['y'])
            z.append(coords['z'])
            slugs.append(post.get('slug', 'unknown'))
            ids.append(post.get('id', 'unknown'))
        except KeyError:
            print(f"⚠️ Post sans coordonnées: {post.get('id', 'unknown')}")
    
    return np.array(x), np.array(y), np.array(z), slugs, ids


def generate_colors_for_slugs(slugs):
    """Génère une couleur unique pour chaque slug basée sur une palette."""
    unique_slugs = sorted(set(slugs))
    n_slugs = len(unique_slugs)
    
    print(f"📊 {n_slugs} slugs uniques trouvés")
    
    # Utiliser une palette de couleurs adaptée au nombre de slugs
    if n_slugs <= 10:
        palette = sns.color_palette("tab10", n_colors=n_slugs)
    elif n_slugs <= 20:
        palette = sns.color_palette("tab20", n_colors=n_slugs)
    else:
        # Pour un grand nombre de catégories, utiliser une palette HSV
        hsv_colors = [(i/n_slugs, 0.8, 0.8) for i in range(n_slugs)]
        palette = [hsv_to_rgb(hsv) for hsv in hsv_colors]
    
    # Créer un dictionnaire de mappage slug -> couleur
    color_dict = {slug: palette[i] for i, slug in enumerate(unique_slugs)}
    
    # Convertir en tableau de couleurs pour chaque point
    colors = [color_dict[slug] for slug in slugs]
    
    return colors, color_dict


def plot_3d_scatter(x, y, z, colors, color_dict, slugs, figure_size=(16, 12), point_size=5):
    """Crée un graphique 3D des points."""
    fig = plt.figure(figsize=figure_size)
    ax = fig.add_subplot(111, projection='3d')
    
    # Tracer les points
    scatter = ax.scatter(x, y, z, c=colors, s=point_size, alpha=0.7)
    
    # Configurer les axes
    ax.set_xlabel('X')
    ax.set_ylabel('Y')
    ax.set_zlabel('Z')
    ax.set_title('Visualisation 3D des posts spatialisés', fontsize=16)
    
    # Créer une légende
    unique_slugs = sorted(set(slugs))
    legend_handles = []
    
    for slug in unique_slugs:
        color = color_dict[slug]
        legend_handles.append(plt.Line2D([0], [0], marker='o', color='w', 
                             markerfacecolor=color, markersize=10, label=slug))
    
    # Ajouter la légende à l'extérieur de la figure
    ax.legend(handles=legend_handles, title="Slugs", loc='center left', 
              bbox_to_anchor=(1.05, 0.5), ncol=1)
    
    # Ajuster les limites des axes pour une meilleure visualisation
    ax.set_box_aspect([1, 1, 1])  # Aspect ratio égal sur tous les axes
    
    plt.tight_layout()
    return fig, ax


def save_visualization(fig, output_path):
    """Sauvegarde la visualisation dans un fichier."""
    fig.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"\n✅ Visualisation sauvegardée dans: {output_path}")


def main():
    # Configurer l'analyse des arguments de ligne de commande
    parser = argparse.ArgumentParser(description='Visualisation 3D des posts spatialisés')
    parser.add_argument('--input', type=str, default='./data/output/spatialized_posts.json',
                        help='Chemin vers le fichier de posts spatialisés')
    parser.add_argument('--output', type=str, default='./visualization.png',
                        help='Chemin pour sauvegarder la visualisation')
    parser.add_argument('--point-size', type=int, default=5,
                        help='Taille des points dans la visualisation')
    parser.add_argument('--figure-width', type=int, default=16,
                        help='Largeur de la figure en pouces')
    parser.add_argument('--figure-height', type=int, default=12,
                        help='Hauteur de la figure en pouces')
    
    args = parser.parse_args()
    
    # Charger les données
    posts = load_data(args.input)
    
    if posts:
        # Extraire les coordonnées
        x, y, z, slugs, ids = extract_coordinates(posts)
        
        # Générer les couleurs
        colors, color_dict = generate_colors_for_slugs(slugs)
        
        # Créer la visualisation
        fig, ax = plot_3d_scatter(x, y, z, colors, color_dict, slugs, 
                                 figure_size=(args.figure_width, args.figure_height),
                                 point_size=args.point_size)
        
        # Sauvegarder la figure
        save_visualization(fig, args.output)
        
        # Afficher la figure
        plt.show()
    
    else:
        print("❌ Impossible de visualiser les données.")


if __name__ == "__main__":
    main() 