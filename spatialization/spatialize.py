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

# Configuration
UMAP_PARAMS = {
    'n_neighbors': 25,    # encore plus de voisins pour une meilleure connexion globale
    'min_dist': 0.25,     # un peu plus proche mais pas trop
    'spread': 0.3,        # forcer une distribution plus compacte
    'n_components': 3,
    'random_state': 42
}

# Poids des différentes composantes dans la vectorisation finale
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

def vectorize_features(posts):
    """Vectorise les métadonnées."""
    print("\n🔤 Vectorisation des données...")
    start_time = time()
    
    # Encodage des métadonnées catégorielles
    print("   Encodage des métadonnées...")
    categorical_encoders = {}
    categorical_vectors = {}
    
    for feature in ['sourceType', 'thematic', 'character']:
        encoder = OneHotEncoder(sparse_output=True, handle_unknown='ignore')
        feature_values = [[post[feature]] for post in posts]
        feature_vectors = encoder.fit_transform(feature_values)
        categorical_encoders[feature] = encoder
        categorical_vectors[feature] = feature_vectors
        
        # Afficher les catégories uniques pour chaque feature
        unique_values = encoder.categories_[0]
        print(f"\n📊 Catégories pour {feature}:")
        for val in unique_values:
            count = sum(1 for post in posts if post[feature] == val)
            print(f"   - {val}: {count} posts")
    
    # Combinaison des vecteurs avec les poids
    print("\n   Combinaison des vecteurs...")
    weighted_vectors = []
    
    for feature in ['sourceType', 'thematic', 'character']:
        feature_vectors = categorical_vectors[feature]
        if feature_vectors.shape[1] > 0:  # Si des catégories ont été trouvées
            feature_vectors_normalized = feature_vectors / feature_vectors.max() if feature_vectors.max() > 0 else feature_vectors
            weighted_vectors.append(WEIGHTS[feature] * feature_vectors_normalized)
    
    # Combiner tous les vecteurs
    combined_vectors = hstack(weighted_vectors)
    
    # Calcul de quelques statistiques
    sample_size = min(1000, combined_vectors.shape[0])
    similarities = cosine_similarity(combined_vectors[:sample_size], combined_vectors[:sample_size])
    avg_similarity = np.mean(similarities[similarities != 1])
    
    print(f"\n✅ Dimension des vecteurs finaux : {combined_vectors.shape}")
    print(f"📊 Similarité moyenne entre les posts : {avg_similarity:.3f}")
    print(f"⏱️  Temps de vectorisation : {time() - start_time:.2f}s")
    
    return combined_vectors

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
    output_path = f"spatialized_posts_n-{UMAP_PARAMS['n_neighbors']}_d-{UMAP_PARAMS['min_dist']}_s-{UMAP_PARAMS['spread']}.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    
    print(f"✅ Résultats sauvegardés dans : {output_path}")
    print(f"⏱️  Temps de sauvegarde : {time() - start_time:.2f}s")
    return output_path

def main():
    total_start_time = time()
    
    # Charge les données
    posts = load_data('posts.json')
    
    # Vectorise les features
    vectors = vectorize_features(posts)
    
    # Applique UMAP
    coordinates = apply_umap(vectors)
    
    # Sauvegarde les résultats
    output_path = save_results(posts, coordinates, 'spatialized_posts.json')
    
    total_time = time() - total_start_time
    print(f"\n🎉 Spatialisation terminée en {total_time:.2f} secondes !")
    print(f"📁 Résultats disponibles dans : {output_path}")

if __name__ == "__main__":
    main() 