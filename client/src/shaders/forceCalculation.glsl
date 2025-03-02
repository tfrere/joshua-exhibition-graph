#version 430
layout(local_size_x = 256) in;

struct Node {
    vec4 position;
    vec4 velocity;
    float charge;
};

layout(std430, binding = 0) buffer NodesBuffer {
    Node nodes[];
};

layout(std430, binding = 1) buffer LinksBuffer {
    ivec2 links[];
};

layout(std430, binding = 2) buffer LinkPropertiesBuffer {
    float linkDistances[];
    float linkStrengths[];
};

uniform float deltaTime;
uniform float repulsionStrength;
uniform float maxRepulsionDistance;

void main() {
    uint index = gl_GlobalInvocationID.x;
    if (index >= nodes.length()) return;

    vec3 force = vec3(0.0);
    vec3 pos = nodes[index].position.xyz;

    // Calcul des forces de répulsion
    for (uint i = 0; i < nodes.length(); i++) {
        if (i == index) continue;
        
        vec3 diff = pos - nodes[i].position.xyz;
        float dist = length(diff);
        
        if (dist > 0.0 && dist < maxRepulsionDistance) {
            float strength = repulsionStrength / (dist * dist);
            force += normalize(diff) * strength;
        }
    }

    // Calcul des forces des liens
    for (uint i = 0; i < links.length(); i++) {
        if (links[i].x == index || links[i].y == index) {
            uint other = (links[i].x == index) ? links[i].y : links[i].x;
            vec3 diff = nodes[other].position.xyz - pos;
            float dist = length(diff);
            
            if (dist > 0.0) {
                float strength = linkStrengths[i];
                float targetDist = linkDistances[i];
                force += normalize(diff) * (dist - targetDist) * strength;
            }
        }
    }

    // Mise à jour de la position et de la vélocité
    nodes[index].velocity.xyz = nodes[index].velocity.xyz * 0.9 + force * deltaTime;
    nodes[index].position.xyz += nodes[index].velocity.xyz * deltaTime;
} 