import json
import numpy as np
import pandas as pd
from cudf import DataFrame
from cuml.preprocessing import OneHotEncoder
from cuml.manifold import UMAP
from datetime import datetime
from tqdm import tqdm
from time import time
from cuml.metrics import pairwise_distances
import os
from pathlib import Path

# Chemins des fichiers
INPUT_PATH = Path("../client/public/data/posts.json")
OUTPUT_DIR = Path("../client/public/data")

# Configuration optimisée pour GPU
UMAP_PARAMS = {
    'n_neighbors': 1000,    # Plus de voisins pour une meilleure connexion globale
    'min_dist': 0.05,       # Distance minimale entre les points
    'spread': 0.8,          # Distribution plus étalée
    'n_components': 3,      # Dimensions de sortie
    'random_state': 42
}

# Poids des différentes composantes
WEIGHTS = {
    'sourceType': 0.33,
    'thematic': 0.33,
    'character': 0.34
}

def print_time_estimate(start_time, current_step, total_steps):
    """Affiche une estimation du temps restant."""
    elapsed = time() - start_time
    estimated_total = (elapsed / current_step) * total_steps
    remaining = estimated_total - elapsed
    print(f"⏱️  Temps écoulé : {elapsed:.2f}s | Temps restant estimé : {remaining:.2f}s")

def clean_text(text):
    """Nettoie le texte."""
    if not isinstance(text, str):
        return ""
    text = text.lower()
    return ' '.join(text.split())

def load_data(file_path):
    """Charge et prépare les données des posts."""
    print("\n📚 Chargement des données...")
    start_time = time()
    
    with open(file_path, 'r', encoding='utf-8') as f:
        posts = json.load(f)
    
    # Préparation des données
    processed_posts = []
    for post in tqdm(posts, desc="Traitement des posts"):
        processed_posts.append({
            'id': post.get('id', ''),
            'sourceType': post.get('sourceType', 'unknown'),
            'thematic': post.get('thematic', 'unknown'),
            'character': post.get('character', 'unknown'),
            'original': post
        })
    
    print(f"✅ {len(processed_posts)} posts traités")
    print(f"⏱️  Temps de traitement : {time() - start_time:.2f}s")
    return processed_posts

def vectorize_features_gpu(posts):
    """Vectorise les métadonnées avec accélération GPU."""
    print("\n🔤 Vectorisation des données sur GPU...")
    start_time = time()
    
    # Création du DataFrame RAPIDS
    df = DataFrame({
        'sourceType': [post['sourceType'] for post in posts],
        'thematic': [post['thematic'] for post in posts],
        'character': [post['character'] for post in posts]
    })
    
    # Encodage des métadonnées catégorielles
    print("   Encodage des métadonnées...")
    categorical_vectors = {}
    
    for feature in ['sourceType', 'thematic', 'character']:
        # Utilisation de get_dummies de cudf pour one-hot encoding
        feature_vectors = DataFrame.get_dummies(df[feature], prefix=feature)
        categorical_vectors[feature] = feature_vectors
        
        # Afficher les catégories uniques
        unique_values = df[feature].unique().values_host
        print(f"\n📊 Catégories pour {feature}:")
        for val in unique_values:
            count = (df[feature] == val).sum()
            print(f"   - {val}: {count} posts")
    
    # Combinaison des vecteurs avec les poids
    print("\n   Combinaison des vecteurs...")
    weighted_vectors = []
    
    for feature in ['sourceType', 'thematic', 'character']:
        feature_vectors = categorical_vectors[feature]
        if len(feature_vectors.columns) > 0:
            feature_vectors_normalized = feature_vectors / feature_vectors.max() if feature_vectors.max().any() else feature_vectors
            weighted_vectors.append(WEIGHTS[feature] * feature_vectors_normalized)
    
    # Combiner tous les vecteurs
    combined_vectors = pd.concat([v.to_pandas() for v in weighted_vectors], axis=1)
    
    # Calcul de similarités sur un échantillon
    sample_size = min(1000, combined_vectors.shape[0])
    sample_vectors = combined_vectors.iloc[:sample_size]
    similarities = pairwise_distances(sample_vectors, metric='cosine')
    avg_similarity = float(np.mean(similarities[np.eye(sample_size, dtype=bool) == 0]))
    
    print(f"\n✅ Dimension des vecteurs finaux : {combined_vectors.shape}")
    print(f"📊 Similarité moyenne entre les posts : {avg_similarity:.3f}")
    print(f"⏱️  Temps de vectorisation : {time() - start_time:.2f}s")
    
    return combined_vectors

def apply_umap_gpu(vectors):
    """Applique UMAP avec accélération GPU."""
    print("\n🌐 Application d'UMAP sur GPU...")
    start_time = time()
    
    # Initialisation de UMAP optimisé GPU
    umap_model = UMAP(**UMAP_PARAMS)
    
    with tqdm(total=100, desc="Progression UMAP") as pbar:
        def update_progress(progress):
            increment = progress - pbar.n
            if increment > 0:
                pbar.update(increment)
        
        coordinates = umap_model.fit_transform(vectors)
    
    # Calcul des statistiques
    distances = pairwise_distances(coordinates, metric='euclidean')
    avg_distance = float(np.mean(distances[distances > 0]))
    max_distance = float(np.max(distances))
    
    print(f"📊 Distance moyenne entre les points : {avg_distance:.3f}")
    print(f"📊 Distance maximale entre les points : {max_distance:.3f}")
    print(f"⏱️  Temps de réduction dimensionnelle : {time() - start_time:.2f}s")
    
    return coordinates

def save_results(posts, coordinates, output_file):
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
        results.append(spatialized_post)
    
    # Création du nom de fichier avec les paramètres
    output_filename = f"spatialized_posts_gpu_n-{UMAP_PARAMS['n_neighbors']}_d-{UMAP_PARAMS['min_dist']}_s-{UMAP_PARAMS['spread']}.json"
    output_path = OUTPUT_DIR / output_filename
    
    # Créer le dossier de sortie s'il n'existe pas
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    
    print(f"✅ Résultats sauvegardés dans : {output_path}")
    print(f"⏱️  Temps de sauvegarde : {time() - start_time:.2f}s")
    return output_path

def main():
    total_start_time = time()
    
    # Vérifier que le fichier d'entrée existe
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Le fichier d'entrée n'existe pas : {INPUT_PATH}")
    
    # Charge les données
    posts = load_data(INPUT_PATH)
    
    # Vectorise les features sur GPU
    vectors = vectorize_features_gpu(posts)
    
    # Applique UMAP sur GPU
    coordinates = apply_umap_gpu(vectors)
    
    # Sauvegarde les résultats
    output_path = save_results(posts, coordinates, 'spatialized_posts.json')
    
    total_time = time() - total_start_time
    print(f"\n🎉 Spatialisation GPU terminée en {total_time:.2f} secondes !")
    print(f"📁 Résultats disponibles dans : {output_path}")

if __name__ == "__main__":
    main() 