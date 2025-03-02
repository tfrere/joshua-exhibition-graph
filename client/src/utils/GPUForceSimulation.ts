import * as THREE from 'three';

interface SimulationNode {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    charge: number;
}

interface SimulationLink {
    source: number;
    target: number;
    distance: number;
    strength: number;
}

// Vertex shader optimisé
const vertexShader = `
precision mediump float;

in vec3 position;
in vec3 velocity;
in float charge;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float deltaTime;

out vec3 vPosition;
out vec3 vVelocity;
out float vCharge;

void main() {
    vPosition = position;
    vVelocity = velocity;
    vCharge = charge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Fragment shader optimisé
const fragmentShader = `
precision mediump float;

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

// Constantes pour l'optimisation
const int BATCH_SIZE = 16;
const float MIN_DISTANCE = 0.1;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    vec3 position = vPosition;
    vec3 velocity = vVelocity;
    vec3 force = vec3(0.0);
    float maxDistSq = maxRepulsionDistance * maxRepulsionDistance;

    // Calcul des forces de répulsion par lots
    for(int by = 0; by < int(resolution.y); by += BATCH_SIZE) {
        for(int bx = 0; bx < int(resolution.x); bx += BATCH_SIZE) {
            // Calculer la force moyenne pour ce lot
            vec3 batchForce = vec3(0.0);
            int count = 0;
            
            for(int y = 0; y < BATCH_SIZE && by + y < int(resolution.y); y++) {
                for(int x = 0; x < BATCH_SIZE && bx + x < int(resolution.x); x++) {
                    vec2 otherUV = vec2(float(bx + x), float(by + y)) / resolution;
                    if(otherUV != uv) {
                        vec3 otherPos = texture(positionTexture, otherUV).xyz;
                        vec3 diff = position - otherPos;
                        float distSq = dot(diff, diff);
                        
                        if(distSq > MIN_DISTANCE && distSq < maxDistSq) {
                            float dist = sqrt(distSq);
                            batchForce += normalize(diff) * repulsionStrength / distSq;
                            count++;
                        }
                    }
                }
            }
            
            // Ajouter la force moyenne du lot
            if(count > 0) {
                force += batchForce / float(count);
            }
        }
    }

    // Optimisation du calcul des forces des liens
    vec3 linkForce = vec3(0.0);
    int linkCount = 0;
    
    // Réduire le nombre d'itérations pour les liens
    for(int i = 0; i < int(resolution.x); i += 2) {
        vec4 link = texture(linkTexture, vec2(float(i) / resolution.x, 0.0));
        if(link.x <= 0.0) continue;
        
        vec2 sourceUV = vec2(link.y, link.z) / resolution;
        vec2 targetUV = vec2(link.w, 0.0) / resolution;
        
        if(uv == sourceUV || uv == targetUV) {
            vec3 sourcePos = texture(positionTexture, sourceUV).xyz;
            vec3 targetPos = texture(positionTexture, targetUV).xyz;
            vec3 diff = targetPos - sourcePos;
            float dist = length(diff);
            
            if(dist > MIN_DISTANCE) {
                vec3 currentLinkForce = normalize(diff) * linkStrength * (dist - link.x);
                linkForce += uv == sourceUV ? currentLinkForce : -currentLinkForce;
                linkCount++;
            }
        }
    }
    
    // Ajouter la force moyenne des liens
    if(linkCount > 0) {
        force += linkForce / float(linkCount);
    }

    // Mise à jour de la vélocité avec amortissement adaptatif
    float speed = length(velocity);
    float dampingFactor = velocityDecay * (1.0 - min(speed * 0.01, 0.9));
    velocity = velocity * dampingFactor + force * (1.0 - dampingFactor);

    // Limiter la vitesse maximale
    float maxSpeed = 100.0;
    speed = length(velocity);
    if(speed > maxSpeed) {
        velocity = (velocity / speed) * maxSpeed;
    }

    // Mise à jour de la position avec sous-pas
    const int SUBSTEPS = 2;
    vec3 newPosition = position;
    for(int i = 0; i < SUBSTEPS; i++) {
        newPosition += velocity * (1.0 / float(SUBSTEPS));
    }

    // Output : position et vélocité mises à jour
    fragColor = vec4(newPosition, 1.0);
}`;

export class GPUForceSimulation {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private positionRenderTarget: THREE.WebGLRenderTarget;
    private velocityRenderTarget: THREE.WebGLRenderTarget;
    private linkTexture: THREE.DataTexture;
    private material: THREE.RawShaderMaterial;
    private geometry: THREE.BufferGeometry;
    private mesh: THREE.Mesh;
    private textureSize: number;

    constructor(renderer: THREE.WebGLRenderer) {
        this.renderer = renderer;
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // Optimiser la taille de texture
        const maxNodes = 1000;
        this.textureSize = Math.min(512, Math.ceil(Math.sqrt(maxNodes)));

        // Créer les render targets avec des paramètres optimisés
        const renderTargetOptions = {
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            stencilBuffer: false,
            depthBuffer: false,
            generateMipmaps: false
        };

        this.positionRenderTarget = new THREE.WebGLRenderTarget(
            this.textureSize, 
            this.textureSize, 
            renderTargetOptions
        );

        this.velocityRenderTarget = new THREE.WebGLRenderTarget(
            this.textureSize, 
            this.textureSize, 
            renderTargetOptions
        );

        // Optimiser la texture des liens
        this.linkTexture = new THREE.DataTexture(
            new Float32Array(this.textureSize * 4),
            this.textureSize,
            1,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.linkTexture.minFilter = THREE.NearestFilter;
        this.linkTexture.magFilter = THREE.NearestFilter;
        this.linkTexture.generateMipmaps = false;

        // Créer la géométrie optimisée
        this.geometry = new THREE.PlaneGeometry(2, 2);
        
        const velocityArray = new Float32Array(8);
        const chargeArray = new Float32Array(4);
        this.geometry.setAttribute('velocity', new THREE.BufferAttribute(velocityArray, 2));
        this.geometry.setAttribute('charge', new THREE.BufferAttribute(chargeArray, 1));

        // Créer le matériau optimisé
        this.material = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader,
            fragmentShader,
            uniforms: {
                positionTexture: { value: null },
                velocityTexture: { value: null },
                linkTexture: { value: this.linkTexture },
                resolution: { value: new THREE.Vector2(this.textureSize, this.textureSize) },
                maxRepulsionDistance: { value: 50.0 }, // Réduit pour optimisation
                repulsionStrength: { value: 25.0 }, // Réduit pour optimisation
                linkStrength: { value: 0.05 }, // Réduit pour optimisation
                velocityDecay: { value: 0.95 },
                deltaTime: { value: 0.016 },
                modelViewMatrix: { value: new THREE.Matrix4() },
                projectionMatrix: { value: new THREE.Matrix4() }
            }
        });
        
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.scene.add(this.mesh);
    }

    updateNodes(nodes: SimulationNode[]) {
        const positionData = new Float32Array(this.textureSize * this.textureSize * 4);
        const velocityData = new Float32Array(this.textureSize * this.textureSize * 4);

        nodes.forEach((node, i) => {
            const idx = i * 4;
            // Position
            positionData[idx] = node.position.x;
            positionData[idx + 1] = node.position.y;
            positionData[idx + 2] = node.position.z;
            positionData[idx + 3] = 1;
            // Vélocité
            velocityData[idx] = node.velocity.x;
            velocityData[idx + 1] = node.velocity.y;
            velocityData[idx + 2] = node.velocity.z;
            velocityData[idx + 3] = node.charge;
        });

        // Mettre à jour les textures
        const positionTexture = new THREE.DataTexture(
            positionData,
            this.textureSize,
            this.textureSize,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        positionTexture.needsUpdate = true;

        const velocityTexture = new THREE.DataTexture(
            velocityData,
            this.textureSize,
            this.textureSize,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        velocityTexture.needsUpdate = true;

        this.material.uniforms.positionTexture.value = positionTexture;
        this.material.uniforms.velocityTexture.value = velocityTexture;
    }

    updateLinks(links: SimulationLink[]) {
        const linkData = new Float32Array(this.textureSize * 4);
        
        links.forEach((link, i) => {
            const idx = i * 4;
            linkData[idx] = link.distance;
            linkData[idx + 1] = link.source;
            linkData[idx + 2] = link.target;
            linkData[idx + 3] = link.strength;
        });

        this.linkTexture.image.data = linkData;
        this.linkTexture.needsUpdate = true;
    }

    step() {
        // Sauvegarder le render target actuel
        const currentRenderTarget = this.renderer.getRenderTarget();

        // Première passe : calculer les nouvelles positions
        this.renderer.setRenderTarget(this.positionRenderTarget);
        this.renderer.render(this.scene, this.camera);

        // Deuxième passe : calculer les nouvelles vélocités
        this.material.uniforms.positionTexture.value = this.positionRenderTarget.texture;
        this.renderer.setRenderTarget(this.velocityRenderTarget);
        this.renderer.render(this.scene, this.camera);

        // Restaurer le render target
        this.renderer.setRenderTarget(currentRenderTarget);

        // Échanger les textures pour le prochain frame
        const temp = this.positionRenderTarget;
        this.positionRenderTarget = this.velocityRenderTarget;
        this.velocityRenderTarget = temp;
    }

    getPositions(): Float32Array {
        const buffer = new Float32Array(this.textureSize * this.textureSize * 4);
        this.renderer.readRenderTargetPixels(
            this.positionRenderTarget,
            0, 0,
            this.textureSize, this.textureSize,
            buffer
        );
        return buffer;
    }

    dispose() {
        this.positionRenderTarget.dispose();
        this.velocityRenderTarget.dispose();
        this.linkTexture.dispose();
        this.material.dispose();
        this.geometry.dispose();
    }
} 