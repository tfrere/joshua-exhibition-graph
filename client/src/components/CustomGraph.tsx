import {
    useRef,
    forwardRef,
    useImperativeHandle,
    useEffect,
    useState,
    useMemo,
    useCallback,
} from "react";
import {
    Vector3,
    Color,
    InstancedMesh,
    Matrix4,
    Object3D,
    InstancedBufferAttribute,
    RawShaderMaterial,
    SphereGeometry,
    GLSL3
} from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useClosestNode } from "../hooks/useClosestNode";
import { waveVertexShader, waveFragmentShader } from "../js/shader/waveShader";
import { sphereVertexShader, sphereFragmentShader } from "../js/shader/sphereShader";
import { params, setupControls } from "../config/controlParams";
import type { ControlParams } from "../config/controlParams";

interface Post {
    creationDate: number;
    thematic: string;
    uid: string;
    coordinates: {
        x: number;
        y: number;
        z: number;
    };
    transformedCoordinates?: {
        x: number;
        y: number;
        z: number;
    };
    character: string;
    postCharacterRank: number;
}

interface CustomGraphProps {
    onNodeClick?: (post: Post) => void;
}

interface RawPost {
    creationDate: number;
    thematic: string;
    uid: string;
    coordinates: {
        x: number;
        y: number;
        z: number;
    };
    character?: string;
    postCharacterRank?: number;
}

// Génération de couleurs uniques pour les thématiques
const generateColorMap = (thematics: string[]) => {
    const colors: { [key: string]: Color } = {};
    const baseColors = [
        "#ff6b6b",
        "#4ecdc4",
        "#45b7d1",
        "#96ceb4",
        "#ffeead",
        "#ff9a9e",
        "#81ecec",
        "#74b9ff",
        "#a8e6cf",
        "#dfe6e9",
        "#fab1a0",
        "#55efc4",
        "#0984e3",
        "#b2bec3",
        "#fd79a8",
        "#00cec9",
        "#6c5ce7",
        "#00b894",
        "#d63031",
        "#e17055",
    ];

    thematics.forEach((thematic, index) => {
        colors[thematic] = new Color(baseColors[index % baseColors.length]);
    });

    return colors;
};

// Génération de couleurs uniques pour les characters
const generateCharacterColorMap = (characters: string[]) => {
    const colors: { [key: string]: Color } = {};
    const baseColors = [
        "#FFB3BA", // Rose pastel
        "#BAFFC9", // Vert menthe pastel
        "#BAE1FF", // Bleu ciel pastel
        "#FFE4B5", // Pêche pastel
        "#E0BBE4", // Lavande pastel
        "#957DAD", // Violet pastel
        "#D4A5A5", // Vieux rose
        "#9DC88D", // Vert sauge
        "#A7C5EB", // Bleu poudré
        "#F9C6C9", // Rose poudré
        "#B5EAD7", // Vert d'eau
        "#C7CEEA", // Bleu pervenche
        "#FFDAC1", // Abricot pastel
        "#E2F0CB", // Vert citron pastel
        "#F0E6EF", // Mauve pâle
        "#D7E3FC", // Bleu glacier
        "#FFD3B6", // Corail pastel
        "#D4F0F0", // Turquoise pastel
        "#FCE1E4", // Rose pâle
        "#DAEAF6", // Bleu brume
    ];

    characters.forEach((character, index) => {
        colors[character] = new Color(baseColors[index % baseColors.length]);
    });

    return colors;
};

// Fonction pour normaliser les coordonnées
const normalizeCoordinates = (posts: RawPost[]) => {
    // Trouver les min/max pour chaque axe
    let minX = Infinity,
        maxX = -Infinity;
    let minY = Infinity,
        maxY = -Infinity;
    let minZ = Infinity,
        maxZ = -Infinity;

    posts.forEach((post) => {
        minX = Math.min(minX, post.coordinates.x);
        maxX = Math.max(maxX, post.coordinates.x);
        minY = Math.min(minY, post.coordinates.y);
        maxY = Math.max(maxY, post.coordinates.y);
        minZ = Math.min(minZ, post.coordinates.z);
        maxZ = Math.max(maxZ, post.coordinates.z);
    });

    console.log("Échelle d'origine:", {
        x: [minX, maxX],
        y: [minY, maxY],
        z: [minZ, maxZ],
    });

    // Vérifier si les plages sont valides
    const xRange = maxX - minX;
    const yRange = maxY - minY;
    const zRange = maxZ - minZ;

    // Si une plage est nulle, utiliser une valeur par défaut pour éviter la division par zéro
    const scale = 1000;
    return posts.map((post) => ({
        ...post,
        coordinates: {
            x: xRange === 0 ? 0 : ((post.coordinates.x - minX) / xRange - 0.5) * scale,
            y: yRange === 0 ? 0 : ((post.coordinates.y - minY) / yRange - 0.5) * scale,
            z: zRange === 0 ? 0 : ((post.coordinates.z - minZ) / zRange - 0.5) * scale,
        },
    }));
};

// Fonction utilitaire pour mettre à jour les visuels
const updateInstancedMesh = (
    mesh: InstancedMesh,
    posts: Post[],
    colorMap: { [key: string]: Color },
    activePost: Post | null,
    characterColorMap: { [key: string]: Color }
) => {
    const colors = new Float32Array(posts.length * 3);
    const positions = new Float32Array(posts.length * 3);
    const ranks = new Float32Array(posts.length);
    const highlightStates = new Float32Array(posts.length);
    const creationDates = new Float32Array(posts.length);
    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3(1, 1, 1);
    const quaternion = new Object3D().quaternion;

    // Trouver les dates min et max pour la normalisation
    const minDate = Math.min(...posts.map(p => p.creationDate));
    const maxDate = Math.max(...posts.map(p => p.creationDate));
    const dateRange = maxDate - minDate;

    // Trouver le rank maximum pour la normalisation
    const maxRank = Math.max(...posts.map(p => p.postCharacterRank || 0));

    posts.forEach((post, i) => {
        // Couleur basée sur le character (toujours utiliser la couleur de base)
        const color = characterColorMap[post.character];
        color.toArray(colors, i * 3);

        // État de surbrillance basé sur le post actif
        highlightStates[i] = activePost?.creationDate === post.creationDate ? 1.0 : 0.0;

        // Position
        const coords = post.transformedCoordinates || post.coordinates;
        positions[i * 3] = coords.x;
        positions[i * 3 + 1] = coords.y;
        positions[i * 3 + 2] = coords.z;

        // Rank normalisé entre 0 et 1
        ranks[i] = maxRank > 0 ? (post.postCharacterRank || 0) / maxRank : 0;

        // Date de création normalisée entre 0 et 1000
        creationDates[i] = dateRange > 0 ? ((post.creationDate - minDate) / dateRange) * 1000 : 0;

        // Position pour la matrice
        position.set(coords.x, coords.y, coords.z);
        scale.set(1, 1, 1);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(i, matrix);
    });

    mesh.geometry.setAttribute("instanceColor", new InstancedBufferAttribute(colors, 3));
    mesh.geometry.setAttribute("position", mesh.geometry.attributes.position);
    mesh.geometry.setAttribute("instancePosition", new InstancedBufferAttribute(positions, 3));
    mesh.geometry.setAttribute("instanceRank", new InstancedBufferAttribute(ranks, 1));
    mesh.geometry.setAttribute("isHighlighted", new InstancedBufferAttribute(highlightStates, 1));
    mesh.geometry.setAttribute("creationDate", new InstancedBufferAttribute(creationDates, 1));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.attributes.instanceColor.needsUpdate = true;
    mesh.geometry.attributes.instancePosition.needsUpdate = true;
    mesh.geometry.attributes.instanceRank.needsUpdate = true;
    mesh.geometry.attributes.isHighlighted.needsUpdate = true;
    mesh.geometry.attributes.creationDate.needsUpdate = true;
};

// Générer des positions pour les centres des galaxies (characters ou thématiques)
const generateGalaxyPositions = (items: string[]) => {
    const positions: { [key: string]: { x: number; y: number; z: number } } = {};
    const radius = 500; // Rayon de la sphère sur laquelle seront placés les centres
    
    items.forEach((item, index) => {
        if (!positions[item]) {
            // Calculer une position sur une sphère pour une meilleure distribution
            const phi = Math.acos(-1 + (2 * index) / items.length);
            const theta = Math.sqrt(items.length * Math.PI) * phi;
            
            positions[item] = {
                x: radius * Math.cos(theta) * Math.sin(phi),
                y: radius * Math.sin(theta) * Math.sin(phi),
                z: radius * Math.cos(phi)
            };
        }
    });
    return positions;
};

// Fonction pour calculer la position finale d'un point selon le layout
const calculateFinalPosition = (
    post: Post, 
    characterPositions: { [key: string]: { x: number; y: number; z: number } },
    thematicPositions: { [key: string]: { x: number; y: number; z: number } },
    layout: ControlParams['layout']
) => {
    switch (layout) {
        case 'Characters galaxy':
            return characterPositions[post.character] || { x: 0, y: 0, z: 0 };
            
        case 'Thematics galaxy':
            return thematicPositions[post.thematic] || { x: 0, y: 0, z: 0 };
            
        case 'Chronologic':
            // En mode chronologique, on retourne les coordonnées de base
            // Le shader s'occupera de calculer la position finale
            return post.coordinates;
    }
};

// Définir les types pour les refs WebGL
interface WebGLRefs {
    transformFeedback: WebGLTransformFeedback | null;
    positionBuffer: WebGLBuffer | null;
}

export default forwardRef(function CustomGraph(
    { onNodeClick }: CustomGraphProps,
    ref
) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [transformedPosts, setTransformedPosts] = useState<Post[]>([]);
    const [colorMap, setColorMap] = useState<{ [key: string]: Color }>({});
    const meshRef = useRef<InstancedMesh>(null);
    const { gl, camera } = useThree();
    const [updateTrigger, setUpdateTrigger] = useState(0);
    const [previousLayout, setPreviousLayout] = useState<ControlParams['layout']>('Characters galaxy');
    const [transitionStartTime, setTransitionStartTime] = useState(0);
    const TRANSITION_DURATION = 10.0; // durée de la transition en secondes
    const [shaderMaterial, setShaderMaterial] = useState<RawShaderMaterial | null>(null);
    const transformFeedback = useRef<WebGLRefs['transformFeedback']>(null);
    const positionBuffer = useRef<WebGLRefs['positionBuffer']>(null);

    const { activePost, findClosestNode } = useClosestNode(transformedPosts, camera);

    const [characterPositions, setCharacterPositions] = useState<{ [key: string]: { x: number; y: number; z: number } }>({});
    const [thematicPositions, setThematicPositions] = useState<{ [key: string]: { x: number; y: number; z: number } }>({});

    // Créer la géométrie de la sphère avec une taille de base de 1
    const sphereGeometry = useMemo(() => {
        return new SphereGeometry(1, 16, 16);
    }, []);

    // Chargement initial des données
    useEffect(() => {
        console.log("Chargement des posts...");
        fetch("/data/spatialized_posts.json")
            .then((response) => response.json())
            .then((data: RawPost[]) => {
                const normalizedData = normalizeCoordinates(data);
                const loadedPosts = normalizedData.map((post) => ({
                    creationDate: post.creationDate,
                    thematic: post.thematic || "unknown",
                    uid: post.uid,
                    coordinates: post.coordinates,
                    character: post.character || "",
                    postCharacterRank: post.postCharacterRank || 0,
                }));

                // Trier par creationDate pour assurer un ordre cohérent
                loadedPosts.sort((a: Post, b: Post) => a.creationDate - b.creationDate);
                setPosts(loadedPosts);

                // Calculer le nombre de personnages et thématiques uniques
                const uniqueCharacters = Array.from(new Set(loadedPosts.map(p => p.character || "unknown")));
                const uniqueThematics = Array.from(new Set(loadedPosts.map(p => p.thematic || "unknown")));
                const numCharacters = uniqueCharacters.length;
                const numThematics = uniqueThematics.length;
                console.log("Nombre de personnages uniques:", numCharacters);
                console.log("Nombre de thématiques uniques:", numThematics);

                // Créer le material du shader avec la bonne taille de tableau
                const material = new RawShaderMaterial({
                    glslVersion: GLSL3,
                    vertexShader: sphereVertexShader,
                    fragmentShader: sphereFragmentShader,
                    uniforms: {
                        time: { value: 0.0 },
                        characterPositions: { value: new Float32Array(numCharacters * 3) },
                        thematicPositions: { value: new Float32Array(numThematics * 3) },
                        numCharacters: { value: numCharacters },
                        numThematics: { value: numThematics },
                        orbitSpeed: { value: params.values.orbitSpeed },
                        pointSize: { value: params.values.pointSize },
                        highlightScale: { value: params.values.highlightScale },
                        highlightColor: { value: new Color(params.values.highlightColor).toArray() },
                        layoutType: { value: 0 },
                        transitionProgress: { value: 1.0 },
                    },
                });
                setShaderMaterial(material);

                // Générer la map des couleurs pour les thématiques uniques
                setColorMap(generateColorMap(uniqueThematics));
            })
            .catch((error) => console.error("Error loading posts:", error));
    }, []);

    // Initialiser les contrôles
    useEffect(() => {
        if (!shaderMaterial) return;
        
        const pane = setupControls();
        
        // Ajouter un listener global pour les changements
        const cleanup = params.onChange(() => {
            if (params.values.layout !== previousLayout) {
                setTransitionStartTime(Date.now() / 1000);
                setPreviousLayout(params.values.layout);
                shaderMaterial.uniforms.transitionProgress.value = 0.0;
            }
            setUpdateTrigger(prev => prev + 1);
        });

        return () => {
            pane.dispose();
            cleanup();
            sphereGeometry.dispose();
        };
    }, [previousLayout, shaderMaterial]);

    // Calculer les positions transformées quand les posts ou les positions des characters changent
    useEffect(() => {
        if (posts.length === 0) return;
        
        const updatedPosts = posts.map(post => ({
            ...post,
            transformedCoordinates: calculateFinalPosition(
                post,
                characterPositions,
                thematicPositions,
                params.values.layout
            )
        }));
        
        setTransformedPosts(updatedPosts);
    }, [posts, characterPositions, thematicPositions, params.values.layout]);

    // Générer les positions des centres des galaxies
    useEffect(() => {
        if (posts.length === 0 || !shaderMaterial) return;

        const characters = Array.from(new Set(posts.map(p => p.character || "unknown")));
        const thematics = Array.from(new Set(posts.map(p => p.thematic || "unknown")));

        console.log("Unique characters:", characters);
        console.log("Unique themes:", thematics);
        const characterPos = generateGalaxyPositions(characters);
        const thematicPos = generateGalaxyPositions(thematics);

        setCharacterPositions(characterPos);
        setThematicPositions(thematicPos);

        // Convertir les positions des personnages en tableau plat
        const characterFlatPositions = Object.values(characterPos).flatMap((pos: { x: number; y: number; z: number }) => [
            pos.x,
            pos.y,
            pos.z
        ]);

        // Convertir les positions des thématiques en tableau plat
        const thematicFlatPositions = Object.values(thematicPos).flatMap((pos: { x: number; y: number; z: number }) => [
            pos.x,
            pos.y,
            pos.z
        ]);

        // Créer les tableaux de la bonne taille
        const characterPaddedPositions = new Float32Array(Object.keys(characterPos).length * 3);
        const thematicPaddedPositions = new Float32Array(Object.keys(thematicPos).length * 3);
        
        characterPaddedPositions.set(characterFlatPositions);
        thematicPaddedPositions.set(thematicFlatPositions);

        // Mettre à jour le matériau du shader
        shaderMaterial.uniforms.characterPositions.value = characterPaddedPositions;
        shaderMaterial.uniforms.thematicPositions.value = thematicPaddedPositions;
        shaderMaterial.uniforms.numCharacters.value = Object.keys(characterPos).length;
        shaderMaterial.uniforms.numThematics.value = Object.keys(thematicPos).length;
    }, [posts, shaderMaterial]);

    // Mettre à jour le mesh quand les positions transformées changent
    useEffect(() => {
        if (!meshRef.current || transformedPosts.length === 0) return;
        
        // Créer les tableaux pour les attributs d'index
        const characterIndices = new Float32Array(posts.length);
        const thematicIndices = new Float32Array(posts.length);
        const vertexIds = new Float32Array(posts.length);
        
        posts.forEach((post, i) => {
            // Trouver l'index du character dans l'ordre des positions
            const characterIndex = Object.keys(characterPositions).indexOf(post.character);
            characterIndices[i] = characterIndex >= 0 ? characterIndex : 0;

            // Trouver l'index de la thématique dans l'ordre des positions
            const thematicIndex = Object.keys(thematicPositions).indexOf(post.thematic);
            thematicIndices[i] = thematicIndex >= 0 ? thematicIndex : 0;

            // Ajouter l'ID du vertex
            vertexIds[i] = i;
        });

        // Ajouter les attributs au mesh
        meshRef.current.geometry.setAttribute(
            'characterIndex',
            new InstancedBufferAttribute(characterIndices, 1)
        );
        meshRef.current.geometry.setAttribute(
            'thematicIndex',
            new InstancedBufferAttribute(thematicIndices, 1)
        );
        meshRef.current.geometry.setAttribute(
            'vertexId',
            new InstancedBufferAttribute(vertexIds, 1)
        );
        
        updateInstancedMesh(meshRef.current, transformedPosts, colorMap, activePost, generateCharacterColorMap(posts.map(p => p.character)));
    }, [transformedPosts, colorMap, activePost, characterPositions, thematicPositions]);

    // Mettre à jour le mesh quand les paramètres changent
    useEffect(() => {
        if (!meshRef.current || transformedPosts.length === 0) return;
        updateInstancedMesh(
            meshRef.current,
            transformedPosts,
            colorMap,
            activePost,
            generateCharacterColorMap(posts.map(p => p.character))
        );
    }, [updateTrigger, transformedPosts, colorMap, activePost, posts]);

    // Détecter le post le plus proche à chaque frame
    useFrame((state) => {
        if (transformedPosts.length === 0 || !meshRef.current) return;
        findClosestNode(state.clock.getElapsedTime() * 1000);
    });

    // Exposer les méthodes via la ref
    useImperativeHandle(ref, () => ({
        getGraphData: () => ({
            posts: posts.map((post) => ({
                ...post,
                x: post.coordinates.x,
                y: post.coordinates.y,
                z: post.coordinates.z,
            })),
        }),
    }));

    // Mettre à jour les uniforms du shader à chaque frame
    useFrame((state) => {
        if (!shaderMaterial || transformedPosts.length === 0 || !meshRef.current) return;

        const currentTime = state.clock.getElapsedTime();
        shaderMaterial.uniforms.time.value = currentTime;
        shaderMaterial.uniforms.orbitSpeed.value = params.values.orbitSpeed;
        shaderMaterial.uniforms.pointSize.value = params.values.pointSize;
        shaderMaterial.uniforms.highlightScale.value = params.values.highlightScale;
        
        const color = new Color(params.values.highlightColor);
        shaderMaterial.uniforms.highlightColor.value = [color.r, color.g, color.b];

        const timeSinceTransitionStart = currentTime - transitionStartTime;
        const progress = Math.min(timeSinceTransitionStart / TRANSITION_DURATION, 1.0);
        shaderMaterial.uniforms.transitionProgress.value = progress;

        const getLayoutTypeValue = (layout: ControlParams['layout']) => 
            layout === 'Characters galaxy' ? 0 :
            layout === 'Thematics galaxy' ? 1 : 2;

        shaderMaterial.uniforms.layoutType.value = getLayoutTypeValue(params.values.layout);
        
        findClosestNode(currentTime * 1000);
    });

    const waveShaderMaterial = new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: waveVertexShader,
        fragmentShader: waveFragmentShader,
        uniforms: {
            time: { value: 0.0 },
            characterPositions: { value: Object.values(characterPositions) },
            thematicPositions: { value: Object.values(thematicPositions) },
        },
    });

    useFrame((state) => {
        waveShaderMaterial.uniforms.time.value = state.clock.getElapsedTime();
        findClosestNode(state.clock.getElapsedTime() * 1000);
    });

    // Log uniquement quand le nombre de posts change
    useEffect(() => {
        if (posts.length > 0) {
            console.log("Rendu du graphe avec", posts.length, "posts");
            console.log("Character positions:", characterPositions);
        } else {
            console.log("Pas de posts à afficher");
        }
    }, [posts.length, characterPositions]);

    useEffect(() => {
        if (!gl.capabilities.isWebGL2) {
            console.warn("WebGL 2 n'est pas disponible, le Transform Feedback ne sera pas utilisé");
            return;
        }

        const glContext = gl.getContext() as WebGL2RenderingContext;
        
        // Créer un programme séparé pour le Transform Feedback
        const program = glContext.createProgram();
        const vShader = glContext.createShader(glContext.VERTEX_SHADER);
        const fShader = glContext.createShader(glContext.FRAGMENT_SHADER);
        
        // Compiler les shaders
        glContext.shaderSource(vShader!, sphereVertexShader);
        glContext.compileShader(vShader!);
        let log = glContext.getShaderInfoLog(vShader!);
        if (log) console.warn('Vertex shader compilation:', log);

        glContext.shaderSource(fShader!, sphereFragmentShader);
        glContext.compileShader(fShader!);
        log = glContext.getShaderInfoLog(fShader!);
        if (log) console.warn('Fragment shader compilation:', log);

        // Attacher les shaders au programme
        glContext.attachShader(program!, vShader!);
        glContext.attachShader(program!, fShader!);
        
        // Spécifier les variables à capturer avant de lier le programme
        glContext.transformFeedbackVaryings(
            program!,
            ['vFinalPosition'],
            glContext.SEPARATE_ATTRIBS
        );
        
        // Lier le programme
        glContext.linkProgram(program!);
        log = glContext.getProgramInfoLog(program!);
        if (log) console.warn('Program linking:', log);

        // Créer le Transform Feedback
        transformFeedback.current = glContext.createTransformFeedback();
        glContext.bindTransformFeedback(glContext.TRANSFORM_FEEDBACK, transformFeedback.current);

        // Créer le buffer pour stocker les positions
        positionBuffer.current = glContext.createBuffer();
        glContext.bindBuffer(glContext.ARRAY_BUFFER, positionBuffer.current);
        glContext.bufferData(glContext.ARRAY_BUFFER, posts.length * 3 * 4, glContext.STATIC_DRAW);
        
        // Lier le buffer au Transform Feedback
        glContext.bindBufferBase(glContext.TRANSFORM_FEEDBACK_BUFFER, 0, positionBuffer.current);

        // Nettoyer
        glContext.bindBuffer(glContext.ARRAY_BUFFER, null);
        glContext.bindTransformFeedback(glContext.TRANSFORM_FEEDBACK, null);

        return () => {
            if (vShader) glContext.deleteShader(vShader);
            if (fShader) glContext.deleteShader(fShader);
            if (program) glContext.deleteProgram(program);
            if (transformFeedback.current) {
                glContext.deleteTransformFeedback(transformFeedback.current);
            }
            if (positionBuffer.current) {
                glContext.deleteBuffer(positionBuffer.current);
            }
        };
    }, [gl, posts.length]);

    // Fonction pour lire les positions depuis le Transform Feedback
    const readPositions = useCallback(() => {
        if (!gl.capabilities.isWebGL2) return;
        
        const glContext = gl.getContext() as WebGL2RenderingContext;
        
        // S'assurer que le GPU a fini son travail
        glContext.finish();
        
        // Désactiver le Transform Feedback
        glContext.bindTransformFeedback(glContext.TRANSFORM_FEEDBACK, null);
        
        // Lire les données
        glContext.bindBuffer(glContext.ARRAY_BUFFER, positionBuffer.current);
        const positions = new Float32Array(posts.length * 3);
        glContext.getBufferSubData(glContext.ARRAY_BUFFER, 0, positions);
        
        // Nettoyer
        glContext.bindBuffer(glContext.ARRAY_BUFFER, null);
        
        // Réactiver le Transform Feedback pour le prochain frame
        glContext.bindTransformFeedback(glContext.TRANSFORM_FEEDBACK, transformFeedback.current);
        
        return positions;
    }, [gl, posts.length]);

    // Mettre à jour les positions à chaque frame
    useFrame(() => {
        if (!gl.capabilities.isWebGL2 || !transformFeedback.current || !positionBuffer.current) return;

        // Temporairement désactivé pour améliorer les performances
        /*
        const glContext = gl.getContext() as WebGL2RenderingContext;
        
        // Activer le Transform Feedback
        glContext.bindTransformFeedback(glContext.TRANSFORM_FEEDBACK, transformFeedback.current);
        glContext.bindBufferBase(glContext.TRANSFORM_FEEDBACK_BUFFER, 0, positionBuffer.current);
        glContext.beginTransformFeedback(glContext.POINTS);
        
        // Rendre la scène avec le programme Transform Feedback
        if (meshRef.current?.geometry) {
            const geometry = meshRef.current.geometry;
            const count = geometry.attributes.position.count;
            glContext.drawArrays(glContext.POINTS, 0, count);
        }
        
        // Terminer le Transform Feedback
        glContext.endTransformFeedback();
        */
    });

    if (posts.length === 0 || !shaderMaterial) {
        return null;
    }

    return (
        <instancedMesh
            ref={meshRef}
            args={[undefined, undefined, posts.length]}
            onClick={(e) => {
                if (onNodeClick && e.instanceId !== undefined) {
                    onNodeClick(posts[e.instanceId]);
                }
            }}
            frustumCulled={false}
        >
            <primitive object={sphereGeometry} />
            <primitive attach="material" object={shaderMaterial} />
        </instancedMesh>
    );
});
