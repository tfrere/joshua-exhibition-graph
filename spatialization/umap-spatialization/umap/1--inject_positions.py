#!/usr/bin/env python3
"""
Inject spatial positions from node-positions.json into each post in posts-flatlist.json.
The matching is done based on the 'slug' field.
Output is saved to 'posts-with-positions.json' in the same directory.
Coordinates (x, y, z) are added directly to the post object.
"""

import json
import os
from pathlib import Path

# Define paths
posts_file = Path("data/input/posts-flatlist.json")
nodes_file = Path("data/input/node-positions.json")
output_file = Path("data/output/posts-with-positions.json")

print(f"Reading posts from {posts_file}...")
with open(posts_file, 'r') as f:
    posts = json.load(f)

print(f"Reading node positions from {nodes_file}...")
with open(nodes_file, 'r') as f:
    nodes = json.load(f)

# Create a mapping of slugs to positions for quick lookup
positions_by_slug = {}
for node in nodes:
    if 'slug' in node and 'x' in node and 'y' in node and 'z' in node:
        positions_by_slug[node['slug']] = {
            'x': node['x'],
            'y': node['y'],
            'z': node['z']
        }

print(f"Found {len(positions_by_slug)} node positions")

# Inject positions into posts
posts_with_positions = []
matched_count = 0
not_matched_count = 0

for post in posts:
    if 'slug' in post and post['slug'] in positions_by_slug:
        # Create a copy of the post
        enriched_post = post.copy()
        
        # Add position data directly to the post object
        enriched_post['x'] = positions_by_slug[post['slug']]['x']
        enriched_post['y'] = positions_by_slug[post['slug']]['y']
        enriched_post['z'] = positions_by_slug[post['slug']]['z']
        
        # Add to the new list
        posts_with_positions.append(enriched_post)
        matched_count += 1
    else:
        # If no position found, still include the post but without position data
        posts_with_positions.append(post)
        not_matched_count += 1

print(f"Matched positions for {matched_count} posts")
print(f"Could not match positions for {not_matched_count} posts")

# Create output directory if it doesn't exist
os.makedirs(os.path.dirname(output_file), exist_ok=True)

# Write the enriched posts to the output file
with open(output_file, 'w') as f:
    json.dump(posts_with_positions, f, indent=2)

print(f"Posts with positions saved to {output_file}")
print("Done!") 