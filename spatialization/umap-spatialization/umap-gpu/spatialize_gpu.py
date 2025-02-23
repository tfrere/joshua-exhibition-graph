import json
import numpy as np
import pandas as pd
import torch
from umap import UMAP
from sklearn.preprocessing import OneHotEncoder
from datetime import datetime
from tqdm import tqdm
from time import time
from pathlib import Path
import torch.nn.functional as F

# Vérification du GPU
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Utilisation de : {device}")
if torch.cuda.is_available():
    print(f"GPU : {torch.cuda.get_device_name(0)}")

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
    """Vectorise les métadonnées avec PyTorch sur GPU."""
    print("\n🔤 Vectorisation des données sur GPU...")
    start_time = time()
    
    # Préparation des données pour one-hot encoding
    features = ['sourceType', 'thematic', 'character']
    encoders = {}
    feature_vectors = {}
    
    for feature in features:
        # Utiliser sklearn pour l'encodage initial
        encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
        values = [[post[feature]] for post in posts]
        vectors = encoder.fit_transform(values)
        
        # Convertir en tensor PyTorch sur GPU
        feature_vectors[feature] = torch.tensor(vectors, dtype=torch.float32, device=device)
        encoders[feature] = encoder
        
        # Afficher les statistiques
        unique_values = encoder.categories_[0]
        print(f"\n📊 Catégories pour {feature}:")
        for val in unique_values:
            count = sum(1 for post in posts if post[feature] == val)
            print(f"   - {val}: {count} posts")
    
    # Normalisation et pondération sur GPU
    weighted_vectors = []
    for feature in features:
        vectors = feature_vectors[feature]
        if vectors.shape[1] > 0:
            # Normalisation min-max sur GPU
            vectors = (vectors - vectors.min(0)[0]) / (vectors.max(0)[0] - vectors.min(0)[0] + 1e-8)
            weighted_vectors.append(WEIGHTS[feature] * vectors)
    
    # Concaténation sur GPU
    combined_vectors = torch.cat(weighted_vectors, dim=1)
    
    # Calcul de similarités sur un échantillon
    sample_size = min(1000, combined_vectors.shape[0])
    sample_vectors = combined_vectors[:sample_size]
    
    # Calcul de similarité cosinus sur GPU
    normalized = F.normalize(sample_vectors, p=2, dim=1)
    similarities = torch.mm(normalized, normalized.t())
    
    # Masquer la diagonale pour le calcul de la moyenne
    mask = ~torch.eye(sample_size, device=device).bool()
    avg_similarity = similarities[mask].mean().item()
    
    print(f"\n✅ Dimension des vecteurs finaux : {combined_vectors.shape}")
    print(f"📊 Similarité moyenne entre les posts : {avg_similarity:.3f}")
    print(f"⏱️  Temps de vectorisation : {time() - start_time:.2f}s")
    
    return combined_vectors

def apply_umap_gpu(vectors):
    """Applique UMAP avec accélération GPU via PyTorch."""
    print("\n🌐 Application d'UMAP...")
    start_time = time()
    
    # Convertir les données en numpy pour UMAP
    vectors_cpu = vectors.cpu().numpy()
    
    # Initialisation de UMAP
    umap_model = UMAP(**UMAP_PARAMS)
    
    # Application de UMAP avec barre de progression
    with tqdm(total=100, desc="Progression UMAP") as pbar:
        def update_progress(progress):
            increment = progress - pbar.n
            if increment > 0:
                pbar.update(increment)
        
        umap_model._handle_progress = update_progress
        coordinates = umap_model.fit_transform(vectors_cpu)
    
    # Convertir les coordonnées en tensor PyTorch pour les calculs de statistiques
    coordinates_gpu = torch.tensor(coordinates, device=device)
    
    # Calcul des statistiques sur GPU
    distances = torch.cdist(coordinates_gpu, coordinates_gpu)
    mask = ~torch.eye(len(coordinates_gpu), device=device).bool()
    avg_distance = distances[mask].mean().item()
    max_distance = distances.max().item()
    
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
    output_filename = f"spatialized_posts_gpu_torch_n-{UMAP_PARAMS['n_neighbors']}_d-{UMAP_PARAMS['min_dist']}_s-{UMAP_PARAMS['spread']}.json"
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