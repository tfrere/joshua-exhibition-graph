import json
import os
from datetime import datetime
from collections import defaultdict
from decimal import Decimal, getcontext
import math
import random
import itertools
import numpy as np

# Configurer la précision du module decimal
getcontext().prec = 15

# Charger le fichier des personnages pour obtenir leur nombre
characters_file = "./data/1a_database_characters.json"
with open(characters_file, 'r', encoding='utf-8') as f:
    characters_data = json.load(f)
nb_characters = len(characters_data)

# Créer des tableaux de positions avec numpy (valeurs aléatoires)
popX = np.random.randint(-500, 501, size=nb_characters, dtype=np.int32)
popY = np.random.randint(-500, 501, size=nb_characters, dtype=np.int32)
popZ = np.random.randint(-500, 501, size=nb_characters, dtype=np.int32)

def load_json_file(file_path):
    """Charge un fichier JSON et retourne son contenu."""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json_file(data, file_path):
    """Sauvegarde les données au format JSON."""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def random_float_spread(value):
    """Équivalent de THREEMath.randFloatSpread."""
    return random.uniform(-value, value)

def random_float(min_val, max_val):
    """Équivalent de THREEMath.randFloat."""
    return random.uniform(min_val, max_val)

def calculate_coordinates_origin(posts_data):
    """
    Place tous les points à l'origine (0,0,0).
    """
    for post in posts_data:
        if 'coordinates' not in post:
            post['coordinates'] = {}
        
        post['coordinates']['origin'] = {
            'x': 0.0,
            'y': 0.0,
            'z': 0.0
        }
    return posts_data

def calculate_coordinates_exploded(posts_data):
    """
    Disperse les points de manière aléatoire dans une sphère.
    """
    for post in posts_data:
        if 'coordinates' not in post:
            post['coordinates'] = {}
            
        radius = 10
        radius_xy = radius + random_float_spread(200)
        radius_z = radius + random_float_spread(10)
        
        theta = random_float_spread(360)
        phi = random_float_spread(360)
        
        post['coordinates']['exploded'] = {
            'x': float(f"{radius_xy * math.sin(theta) * math.cos(phi):.6f}"),
            'y': float(f"{radius_xy * math.sin(theta) * math.sin(phi):.6f}"),
            'z': float(f"{radius_z * math.cos(theta):.6f}")
        }
    return posts_data

def calculate_coordinates_characters_exploded(posts_data):
    """
    Disperse les points de manière aléatoire dans une sphère.
    """
    for post in posts_data:
        if 'coordinates' not in post:
            post['coordinates'] = {}
            
        radius = 10
        radius_xy = radius + random_float_spread(200)
        radius_z = radius + random_float_spread(10)
        
        theta = random_float_spread(360)
        phi = random_float_spread(360)
        
        post['coordinates']['charactersExploded'] = {
            'x': popX[post.get('charId', 0)] + float(f"{radius_xy * math.sin(theta) * math.cos(phi):.6f}"),
            'y': popY[post.get('charId', 0)] + float(f"{radius_xy * math.sin(theta) * math.sin(phi):.6f}"),
            'z': popZ[post.get('charId', 0)] + float(f"{radius_z * math.cos(theta):.6f}")
        }
    return posts_data

def calculate_coordinates_spiral(posts_data):
    """
    Organise les points en spirale.
    """
    for post in posts_data:
        if 'coordinates' not in post:
            post['coordinates'] = {}
            
        offset_stage = -40
        radius = 20 + float(post.get('postDetails', {}).get('rankInDay', 1))
        stage = offset_stage + float(post.get('charId', 0)) * 2
        offset_theta = math.pi / 2
        
        # Calcul de theta basé sur la semaine et le jour
        week_num = float(post.get('creationDateDetails', {}).get('yearDayNum', 0)) / 7
        weekday_num = float(post.get('creationDateDetails', {}).get('weekDayNum', 0))
        year_weeks_num = float(post.get('creationDateDetails', {}).get('yearWeeksNum', 52))
        
        theta = offset_theta + 2 * math.pi * ((week_num / year_weeks_num) + (weekday_num / 7 / year_weeks_num))
        
        post['coordinates']['spiral'] = {
            'x': float(f"{radius * math.cos(theta):.6f}"),
            'y': float(f"{radius * math.sin(theta):.6f}"),
            'z': float(f"{stage:.6f}")
        }
    return posts_data

def calculate_coordinates_sphere(posts_data, character_id_map):
    """
    Organise les points en sphère, groupés par character ID.
    """
    # Grouper les posts par character ID
    id_groups = {}
    for post in posts_data:
        # Récupérer l'ID du character à partir de son slug
        character_id = character_id_map.get(post.get('charId', ''), 1)  # Utiliser 1 comme valeur par défaut si non trouvé
        if character_id not in id_groups:
            id_groups[character_id] = []
        id_groups[character_id].append(post)
    
    # Traiter chaque groupe
    for character_id, group_posts in id_groups.items():
        nb_particles = len(group_posts)
        task_stage = 2
        stage = float(character_id) * task_stage
        
        for i, post in enumerate(group_posts):
            if 'coordinates' not in post:
                post['coordinates'] = {}
                
            phi = math.acos(-1 + (2 * i) / nb_particles)
            theta = math.sqrt(nb_particles * math.pi) * phi
            
            post['coordinates']['sphere'] = {
                'x': float(f"{stage * math.cos(theta) * math.sin(phi):.6f}"),
                'y': float(f"{stage * math.sin(theta) * math.sin(phi):.6f}"),
                'z': float(f"{stage * math.cos(phi):.6f}")
            }
    return posts_data

def calculate_coordinates_characters_spheres(posts_data, character_id_map):
    """
    Organise les points en sphère, groupés par character ID.
    """
    # Grouper les posts par character ID
    id_groups = {}
    for post in posts_data:
        # Récupérer l'ID du character à partir de son slug
        character_id = character_id_map.get(post.get('charId', ''), 1)  # Utiliser 1 comme valeur par défaut si non trouvé
        if character_id not in id_groups:
            id_groups[character_id] = []
        id_groups[character_id].append(post)
    
    # Traiter chaque groupe
    for character_id, group_posts in id_groups.items():
        nb_particles = len(group_posts)
        charRadius = 50
        
        for i, post in enumerate(group_posts):
            if 'coordinates' not in post:
                post['coordinates'] = {}
                
            phi = math.acos(-1 + (2 * i) / nb_particles)
            theta = math.sqrt(nb_particles * math.pi) * phi
            
            post['coordinates']['charactersSpheres'] = {
                'x': popX[post.get('charId', 0)] + float(f"{charRadius * math.cos(theta) * math.sin(phi):.6f}"),
                'y': popY[post.get('charId', 0)] + float(f"{charRadius * math.sin(theta) * math.sin(phi):.6f}"),
                'z': popZ[post.get('charId', 0)] + float(f"{charRadius * math.cos(phi):.6f}")
            }
    return posts_data

def calculate_coordinates_calendar(posts_data):
    """
    Organise les points en calendrier.
    """
    offset_col = -100
    offset_row = -12
    month_stage = 15
    task_stage = 4
    
    for post in posts_data:
        if 'coordinates' not in post:
            post['coordinates'] = {}
            
        month_num = post.get('creationDateDetails', {}).get('monthNum', 1)
        weekday_num = post.get('creationDateDetails', {}).get('weekDayNum', 1)
        month_day_num = post.get('creationDateDetails', {}).get('monthDayNum', 1)
        character_id = float(post.get('charId', 0))
        
        col = offset_col + (month_num * month_stage) + weekday_num
        month_week = math.ceil((month_day_num - 1 - weekday_num) / 7)
        row = offset_row + task_stage - month_week + (offset_row + character_id) * task_stage
        
        post['coordinates']['calendar'] = {
            'x': float(f"{col:.6f}"),
            'y': float(f"{row:.6f}"),
            'z': 0.0
        }
    return posts_data

def calculate_coordinates_calendar_staged(posts_data):
    """
    Organise les points en calendrier avec étages.
    """
    offset_col = -100
    offset_row = -12
    month_stage = 15
    task_stage = 5
    
    for post in posts_data:
        if 'coordinates' not in post:
            post['coordinates'] = {}
            
        month_num = post.get('creationDateDetails', {}).get('monthNum', 1)
        weekday_num = post.get('creationDateDetails', {}).get('weekDayNum', 1)
        month_day_num = post.get('creationDateDetails', {}).get('monthDayNum', 1)
        year = post.get('creationDateDetails', {}).get('year', 2000)
        character_id = float(post.get('charId', 0))
        rank_in_day = float(post.get('postDetails', {}).get('rankInDay', 1))
        
        col = offset_col + (month_num * month_stage) + weekday_num
        month_week = math.ceil((month_day_num - 1 - weekday_num) / 7)
        row = offset_row + task_stage - month_week + (offset_row + character_id) * task_stage
        stage = rank_in_day + (year - 2000) * 200
        
        post['coordinates']['calendarStaged'] = {
            'x': float(f"{col:.6f}"),
            'y': float(f"{row:.6f}"),
            'z': float(f"{stage:.6f}")
        }
    return posts_data

def calculate_coordinates_tree(posts_data):
    """
    Organise les points en arbre.
    """
    # Obtenir la liste unique des charId
    characters = sorted(set(post.get('charId', 0) for post in posts_data))
    nb_characters = len(characters)
    
    for post in posts_data:
        if 'coordinates' not in post:
            post['coordinates'] = {}
            
        radius = float(post.get('postDetails', {}).get('globalRank', 0)) / 40
        offset_y = -60
        stage = offset_y + float(post.get('postDetails', {}).get('characterRank', 0)) / 20
        
        theta = -math.pi * (float(post.get('charId', 0)) / nb_characters)
        delta = math.pi / 12 * random.random()
        
        post['coordinates']['tree'] = {
            'x': float(f"{radius * math.cos(theta + delta):.6f}"),
            'y': float(f"{stage:.6f}"),
            'z': float(f"{radius * math.sin(theta):.6f}")
        }
    return posts_data

def calculate_coordinates_tree_diffuse(posts_data):
    """
    Organise les points en arbre avec diffusion.
    """
    # Obtenir la liste unique des charId
    characters = sorted(set(post.get('charId', 0) for post in posts_data))
    nb_characters = len(characters)
    
    for post in posts_data:
        if 'coordinates' not in post:
            post['coordinates'] = {}
            
        radius = float(post.get('postDetails', {}).get('globalRank', 0)) / 40
        offset_y = -60
        stage = offset_y + float(post.get('characterRank', 0)) / 15
        
        theta = -math.pi * (float(post.get('charId', 0)) / nb_characters)
        delta = math.pi / 2 * random.random()
        
        post['coordinates']['treeDiffuse'] = {
            'x': float(f"{radius * math.cos(theta + delta):.6f}"),
            'y': float(f"{stage:.6f}"),
            'z': float(f"{radius * math.sin(theta):.6f}")
        }
    return posts_data

def main():
    # Charger les fichiers
    posts_file = "./data/4b_posts_flat_augmented.json"
    characters_file = "./data/1a_database_characters.json"
    
    posts_data = load_json_file(posts_file)
    characters_data = load_json_file(characters_file)
    
    # Créer un dictionnaire de correspondance character -> id
    character_id_map = {char['slug']: char['id'] for char in characters_data}
    
    # Calculer les coordonnées pour chaque layout
    spatialized_posts = posts_data  # Initialisation de spatialized_posts
    # spatialized_posts = calculate_coordinates_origin(spatialized_posts)
    spatialized_posts = calculate_coordinates_exploded(spatialized_posts)
    spatialized_posts = calculate_coordinates_spiral(spatialized_posts)
    spatialized_posts = calculate_coordinates_sphere(spatialized_posts, character_id_map)
    spatialized_posts = calculate_coordinates_calendar(spatialized_posts)
    spatialized_posts = calculate_coordinates_calendar_staged(spatialized_posts)
    spatialized_posts = calculate_coordinates_tree(spatialized_posts)
    spatialized_posts = calculate_coordinates_tree_diffuse(spatialized_posts)
    spatialized_posts = calculate_coordinates_characters_exploded(spatialized_posts)
    spatialized_posts = calculate_coordinates_characters_spheres(spatialized_posts, character_id_map)
    

    # Sauvegarder le résultat
    output_file = "./data/spatialized_posts.json"
    save_json_file(spatialized_posts, output_file)
    print(f"Fichier {output_file} mis à jour avec les coordonnées des posts pour tous les layouts")

if __name__ == "__main__":
    main() 