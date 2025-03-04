#!/usr/bin/env python3
"""
Decimate posts-flatlist.json by randomly selecting 10% of the posts.
Output is saved to 'decimated-posts-flatlist.json' in the same directory.
Uses a fixed seed for deterministic randomization.
"""

import json
import random
import os
from pathlib import Path

# Set a fixed seed for deterministic randomization
SEED = 42
random.seed(SEED)
print(f"Using random seed: {SEED}")

# Define paths
input_file = Path("data/output/posts-with-positions.json")
output_file = Path("data/output/decimated-posts-with-positions.json")

print(f"Reading posts from {input_file}...")

# Read the input JSON file
with open(input_file, 'r') as f:
    posts = json.load(f)

total_posts = len(posts)
print(f"Total posts: {total_posts}")

# Select 10% of posts randomly
selected_count = int(total_posts * 0.1)
decimated_posts = random.sample(posts, selected_count)

print(f"Selected {selected_count} posts (10% of total)")

# Create output directory if it doesn't exist
os.makedirs(os.path.dirname(output_file), exist_ok=True)

# Write the decimated posts to the output file
with open(output_file, 'w') as f:
    json.dump(decimated_posts, f, indent=2)

print(f"Decimated posts saved to {output_file}")
print("Done!") 