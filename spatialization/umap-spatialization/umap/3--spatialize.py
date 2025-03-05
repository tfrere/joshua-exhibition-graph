import json
import numpy as np
import pandas as pd
from sklearn.preprocessing import OneHotEncoder
from umap import UMAP
from datetime import datetime
from tqdm import tqdm
from time import time
from sklearn.metrics.pairwise import cosine_similarity
from scipy.sparse import hstack
import os
import argparse
import re
from pathlib import Path

# Chemins des fichiers
INPUT_PATH = Path("./data/output/decimated-posts-with-positions.json")
OUTPUT_DIR = Path("./data/output")

# Configuration
UMAP_PARAMS = {
    'n_neighbors': 120,    # encore plus de voisins pour une meilleure connexion globale
    'min_dist': 8,     # un peu plus proche mais pas trop
    'spread': 8,        # distribution plus étalée pour faciliter la navigation
    'n_components': 3,
    'random_state': 42
}

# Poids des différentes composantes dans la vectorisation finale (valeurs par défaut)
DEFAULT_DIMENSIONS = ['source', 'thematic', 'slug']

def print_time_estimate(start_time, current_step, total_steps):
    """Affiche une estimation du temps restant."""
    elapsed = time() - start_time
    estimated_total = (elapsed / current_step) * total_steps
    remaining = estimated_total - elapsed
    print(f"Temps écoulé : {elapsed:.2f}s | Temps restant estimé : {remaining:.2f}s")

def clean_text(text):
    """Nettoie le texte en supprimant les URLs, les caractères spéciaux, etc."""
    if not isinstance(text, str):
        return ""
    # Supprime les URLs
    text = re.sub(r'http\S+', '', text)
    # Supprime les références 4chan
    text = re.sub(r'\/\w+\/', ' ', text)
    text = re.sub(r'ID:\w+', ' ', text)
    # Supprime les caractères spéciaux
    text = re.sub(r'[^\w\s]', ' ', text)
    # Normalise les espaces
    text = ' '.join(text.split())
    return text.lower()

def load_data(file_path):
    """Charge et prépare les données des posts."""
    print("\n📚 Chargement des données...")
    start_time = time()
    
    with open(file_path, 'r', encoding='utf-8') as f:
        posts = json.load(f)
    
    # Prépare les données pour la vectorisation
    processed_posts = []
    for post in tqdm(posts, desc="Traitement des posts"):
        processed_post = {
            'id': post.get('id', ''),
            'original': post
        }
        
        # Ajoute toutes les propriétés disponibles pour une utilisation ultérieure
        for key, value in post.items():
            if key != 'id':
                processed_post[key] = post.get(key, 'unknown')
                
        processed_posts.append(processed_post)
    
    print(f"✅ {len(processed_posts)} posts traités")
    print(f"⏱️  Temps de traitement : {time() - start_time:.2f}s")
    return processed_posts

def vectorize_features(posts, dimensions, custom_weights=None):
    """Vectorise les métadonnées selon les dimensions spécifiées."""
    print("\n🔤 Vectorisation des données...")
    start_time = time()
    
    # Vérifier que les dimensions existent dans les données
    available_keys = set()
    for post in posts[:10]:  # Vérifier les 10 premiers posts pour obtenir les clés disponibles
        available_keys.update(post.keys())
    
    available_keys.discard('id')
    available_keys.discard('original')
    
    valid_dimensions = []
    for dim in dimensions:
        if dim in available_keys:
            valid_dimensions.append(dim)
        else:
            print(f"⚠️ Dimension '{dim}' non trouvée dans les données. Elle sera ignorée.")
    
    if not valid_dimensions:
        print("❌ Aucune dimension valide spécifiée. Utilisation des dimensions par défaut.")
        valid_dimensions = [dim for dim in DEFAULT_DIMENSIONS if dim in available_keys]
        if not valid_dimensions:
            raise ValueError("Aucune dimension valide disponible pour la vectorisation.")
    
    print(f"🔍 Dimensions utilisées pour la vectorisation : {valid_dimensions}")
    
    # Calculer les poids pour chaque dimension
    if custom_weights and len(custom_weights) == len(valid_dimensions):
        # Utiliser les poids personnalisés fournis
        weights = {dim: float(weight) for dim, weight in zip(valid_dimensions, custom_weights)}
        print(f"⚖️ Poids personnalisés utilisés : {weights}")
    else:
        if custom_weights:
            print(f"⚠️ Le nombre de poids ({len(custom_weights)}) ne correspond pas au nombre de dimensions valides ({len(valid_dimensions)}). Utilisation de poids équilibrés.")
        # Répartition égale des poids
        weights = {dim: 1.0 / len(valid_dimensions) for dim in valid_dimensions}
        print(f"⚖️ Poids équilibrés générés : {weights}")
    
    # Normaliser les poids pour qu'ils somment à 1
    total_weight = sum(weights.values())
    if total_weight != 1.0:
        weights = {dim: weight / total_weight for dim, weight in weights.items()}
        print(f"⚖️ Poids normalisés : {weights}")
    
    # Encodage des métadonnées catégorielles
    print("   Encodage des métadonnées...")
    categorical_encoders = {}
    categorical_vectors = {}
    
    for feature in valid_dimensions:
        encoder = OneHotEncoder(sparse_output=True, handle_unknown='ignore')
        feature_values = [[post.get(feature, 'unknown')] for post in posts]
        feature_vectors = encoder.fit_transform(feature_values)
        categorical_encoders[feature] = encoder
        categorical_vectors[feature] = feature_vectors
        
        # Afficher les catégories uniques pour chaque feature
        unique_values = encoder.categories_[0]
        print(f"\n📊 Catégories pour {feature}:")
        for val in unique_values:
            count = sum(1 for post in posts if post.get(feature, 'unknown') == val)
            print(f"   - {val}: {count} posts")
    
    # Combinaison des vecteurs avec les poids
    print("\n   Combinaison des vecteurs...")
    weighted_vectors = []
    
    for feature in valid_dimensions:
        feature_vectors = categorical_vectors[feature]
        if feature_vectors.shape[1] > 0:  # Si des catégories ont été trouvées
            feature_vectors_normalized = feature_vectors / feature_vectors.max() if feature_vectors.max() > 0 else feature_vectors
            weighted_vectors.append(weights[feature] * feature_vectors_normalized)
    
    # Combiner tous les vecteurs
    combined_vectors = hstack(weighted_vectors)
    
    # Calcul de quelques statistiques
    sample_size = min(1000, combined_vectors.shape[0])
    similarities = cosine_similarity(combined_vectors[:sample_size], combined_vectors[:sample_size])
    avg_similarity = np.mean(similarities[similarities != 1])
    
    print(f"\n✅ Dimension des vecteurs finaux : {combined_vectors.shape}")
    print(f"📊 Similarité moyenne entre les posts : {avg_similarity:.3f}")
    print(f"⏱️  Temps de vectorisation : {time() - start_time:.2f}s")
    
    return combined_vectors, valid_dimensions, weights

def apply_umap(vectors):
    """Applique UMAP pour la réduction dimensionnelle."""
    print("\n🌐 Application d'UMAP...")
    start_time = time()
    
    umap_model = UMAP(**UMAP_PARAMS)
    with tqdm(total=100, desc="Progression UMAP") as pbar:
        def update_progress(progress):
            increment = progress - pbar.n
            if increment > 0:
                pbar.update(increment)
        
        umap_model._handle_progress = update_progress
        coordinates = umap_model.fit_transform(vectors.toarray())
    
    # Calcul de quelques statistiques sur les coordonnées
    distances = np.sqrt(np.sum((coordinates[:, None] - coordinates) ** 2, axis=2))
    avg_distance = np.mean(distances[distances > 0])
    max_distance = np.max(distances)
    
    print(f"📊 Distance moyenne entre les points : {avg_distance:.3f}")
    print(f"📊 Distance maximale entre les points : {max_distance:.3f}")
    print(f"⏱️  Temps de réduction dimensionnelle : {time() - start_time:.2f}s")
    return coordinates

def save_results(posts, coordinates, dimensions, weights, output_file):
    """Sauvegarde les résultats avec les coordonnées."""
    print("\n💾 Sauvegarde des résultats...")
    start_time = time()
    results = []
    
    for post, coords in tqdm(zip(posts, coordinates), total=len(posts), desc="Préparation des données"):
        spatialized_post = post['original'].copy()
        spatialized_post['coordinates'] = {
            'x': float(coords[0]),
            'y': float(coords[1]),
            'z': float(coords[2])
        }
        # Ajouter des métadonnées sur la spatialisation
        spatialized_post['_spatialMetadata'] = {
            'dimensions': dimensions,
            'weights': weights,
            'umap_params': UMAP_PARAMS
        }
        results.append(spatialized_post)
    
    # Création du nom de fichier avec les paramètres et dimensions
    dimensions_str = "-".join(dimensions)
    output_filename = f"spatialized_posts_dim-{dimensions_str}_n-{UMAP_PARAMS['n_neighbors']}_d-{UMAP_PARAMS['min_dist']}_s-{UMAP_PARAMS['spread']}.json"
    output_path = OUTPUT_DIR / output_filename

    output_filename2 = "spatialized_posts.json"
    output_path2 = OUTPUT_DIR / output_filename2
    
    # Créer le dossier de sortie s'il n'existe pas
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    
    with open(output_path2, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    

    print(f"✅ Résultats sauvegardés dans : {output_path}")
    print(f"✅ et une copie dans : {output_path2}")
    print(f"⏱️  Temps de sauvegarde : {time() - start_time:.2f}s")
    return output_path

def main():
    # Configurer l'analyse des arguments de ligne de commande
    global INPUT_PATH, OUTPUT_DIR, UMAP_PARAMS
    
    parser = argparse.ArgumentParser(description='Spatialisation des posts avec UMAP')
    parser.add_argument('--input', type=str, default=str(INPUT_PATH),
                        help='Chemin vers le fichier de posts')
    parser.add_argument('--output-dir', type=str, default=str(OUTPUT_DIR),
                        help='Dossier de sortie pour les résultats')
    parser.add_argument('--dimensions', type=str, nargs='+', default=DEFAULT_DIMENSIONS,
                        help='Dimensions à utiliser pour la vectorisation, ex: source thematic slug')
    parser.add_argument('--weights', type=float, nargs='+', default=None,
                        help='Poids à appliquer à chaque dimension (doit être le même nombre que --dimensions)')
    parser.add_argument('--n-neighbors', type=int, default=UMAP_PARAMS['n_neighbors'],
                        help='Nombre de voisins pour UMAP')
    parser.add_argument('--min-dist', type=float, default=UMAP_PARAMS['min_dist'],
                        help='Distance minimale pour UMAP')
    parser.add_argument('--spread', type=float, default=UMAP_PARAMS['spread'],
                        help='Spread pour UMAP')
    
    args = parser.parse_args()
    
    # Mettre à jour les paramètres
    INPUT_PATH = Path(args.input)
    OUTPUT_DIR = Path(args.output_dir)
    UMAP_PARAMS['n_neighbors'] = args.n_neighbors
    UMAP_PARAMS['min_dist'] = args.min_dist
    UMAP_PARAMS['spread'] = args.spread
    
    total_start_time = time()
    
    # Afficher la configuration
    print("\n🔧 Configuration:")
    print(f"   - Fichier d'entrée: {INPUT_PATH}")
    print(f"   - Dossier de sortie: {OUTPUT_DIR}")
    print(f"   - Dimensions: {args.dimensions}")
    if args.weights:
        print(f"   - Poids: {args.weights}")
    print(f"   - Paramètres UMAP: n_neighbors={UMAP_PARAMS['n_neighbors']}, min_dist={UMAP_PARAMS['min_dist']}, spread={UMAP_PARAMS['spread']}")
    
    # Vérifier que le fichier d'entrée existe
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Le fichier d'entrée n'existe pas : {INPUT_PATH}")
    
    # Charge les données
    posts = load_data(INPUT_PATH)
    
    # Vectorise les features avec les dimensions spécifiées
    vectors, valid_dimensions, weights = vectorize_features(posts, args.dimensions, args.weights)
    
    # Applique UMAP
    coordinates = apply_umap(vectors)
    
    # Sauvegarde les résultats
    output_path = save_results(posts, coordinates, valid_dimensions, weights, 'spatialized_posts.json')
    
    total_time = time() - total_start_time
    print(f"\n🎉 Spatialisation terminée en {total_time:.2f} secondes !")
    print(f"📁 Résultats disponibles dans : {output_path}")

if __name__ == "__main__":
    main() 