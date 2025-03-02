precision highp float;

in vec3 vPosition;
in vec3 vVelocity;
in float vCharge;

uniform sampler2D positionTexture;
uniform sampler2D velocityTexture;
uniform sampler2D linkTexture;
uniform vec2 resolution;
uniform float maxRepulsionDistance;
uniform float repulsionStrength;
uniform float linkStrength;
uniform float velocityDecay;

out vec4 fragColor;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    vec3 position = vPosition;
    vec3 velocity = vVelocity;
    vec3 force = vec3(0.0);

    // Calcul des forces de répulsion
    for(float y = 0.0; y < resolution.y; y++) {
        for(float x = 0.0; x < resolution.x; x++) {
            vec2 otherUV = vec2(x, y) / resolution;
            if(otherUV != uv) {
                vec3 otherPos = texture(positionTexture, otherUV).xyz;
                vec3 diff = position - otherPos;
                float dist = length(diff);
                
                if(dist > 0.0 && dist < maxRepulsionDistance) {
                    float strength = repulsionStrength / (dist * dist);
                    force += normalize(diff) * strength;
                }
            }
        }
    }

    // Calcul des forces des liens
    for(float i = 0.0; i < resolution.x; i++) {
        vec4 link = texture(linkTexture, vec2(i / resolution.x, 0.0));
        if(link.x > 0.0) { // Si le lien existe
            vec2 sourceUV = vec2(link.y, link.z) / resolution;
            vec2 targetUV = vec2(link.w, 0.0) / resolution;
            
            if(uv == sourceUV || uv == targetUV) {
                vec3 sourcePos = texture(positionTexture, sourceUV).xyz;
                vec3 targetPos = texture(positionTexture, targetUV).xyz;
                vec3 diff = targetPos - sourcePos;
                float dist = length(diff);
                
                if(dist > 0.0) {
                    vec3 linkForce = normalize(diff) * linkStrength * (dist - link.x);
                    force += uv == sourceUV ? linkForce : -linkForce;
                }
            }
        }
    }

    // Mise à jour de la vélocité et de la position
    velocity = velocity * velocityDecay + force;
    position += velocity;

    // Output : position et vélocité mises à jour
    fragColor = vec4(position, 1.0);
} 