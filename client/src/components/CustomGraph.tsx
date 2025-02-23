import {
    useRef,
    forwardRef,
    useImperativeHandle,
    useEffect,
    useState,
    useCallback,
} from "react";
import {
    Vector3,
    Color,
    InstancedMesh,
    Matrix4,
    Object3D,
    InstancedBufferAttribute,
    AxesHelper,
} from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useClosestNode } from "../hooks/useClosestNode";
import { Pane } from "tweakpane";
import { createPane } from "../config/tweakpaneConfig";
import { CoordinateTypes, CoordinateType as CoordType } from "../types/coordinates";
import { useDebugMode } from "../hooks/useDebugMode";
import { useSpring } from '@react-spring/three';

interface Post {
    creationDate: number;
    thematic: string;
    uid: string;
    coordinates: CoordinateTypes;
    color?: string;
}

interface CustomGraphProps {
    onNodeClick?: (post: Post) => void;
    onControllerChange: (key: string, value: number) => void;
    controllerConfig: {
        maxSpeed: number;
        acceleration: number;
        deceleration: number;
        rotationSpeed: number;
        deadzone: number;
    };
}

interface RawPost {
    creationDate: number;
    thematic: string;
    uid: string;
    coordinates: CoordinateTypes;
    color?: string;
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

// Fonction pour normaliser les coordonnées
const normalizeCoordinates = (posts: RawPost[], coordinateType: CoordinateType) => {
    // Trouver les min/max pour chaque axe
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    posts.forEach((post) => {
        minX = Math.min(minX, post.coordinates[coordinateType].x);
        maxX = Math.max(maxX, post.coordinates[coordinateType].x);
        minY = Math.min(minY, post.coordinates[coordinateType].y);
        maxY = Math.max(maxY, post.coordinates[coordinateType].y);
        minZ = Math.min(minZ, post.coordinates[coordinateType].z);
        maxZ = Math.max(maxZ, post.coordinates[coordinateType].z);
    });

    // Calculer les plages pour chaque axe
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const rangeZ = maxZ - minZ;

    // Normaliser à une échelle adaptée
    const scale = 1000;
    return posts.map((post) => ({
        creationDate: post.creationDate,
        thematic: post.thematic,
        uid: post.uid,
        color: post.color,
        coordinates: {
            ...post.coordinates,
            [coordinateType]: {
                x: rangeX === 0 ? 0 : ((post.coordinates[coordinateType].x - minX) / rangeX - 0.5) * scale,
                y: rangeY === 0 ? 0 : ((post.coordinates[coordinateType].y - minY) / rangeY - 0.5) * scale,
                z: rangeZ === 0 ? 0 : ((post.coordinates[coordinateType].z - minZ) / rangeZ - 0.5) * scale,
            }
        }
    }));
};

// Fonction utilitaire pour mettre à jour les visuels
const updateInstancedMesh = (
    mesh: InstancedMesh,
    posts: Post[],
    colorMap: { [key: string]: Color },
    activePost: Post | null,
    coordinateType: CoordinateType,
    highlightScale: number
) => {
    const colors = new Float32Array(posts.length * 3);
    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3(1, 1, 1);
    const quaternion = new Object3D().quaternion;

    posts.forEach((post, i) => {
        // Utiliser la couleur du post si elle existe, sinon utiliser la couleur de la thématique
        const color = new Color(post.color);
        color.toArray(colors, i * 3);

        // Position et échelle
        const coords = post.coordinates[coordinateType];
        position.set(coords.x, coords.y, coords.z);

        if (activePost?.creationDate === post.creationDate) {
            scale.set(highlightScale, highlightScale, highlightScale);
        } else {
            scale.set(1, 1, 1);
        }

        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(i, matrix);
    });

    mesh.geometry.setAttribute("color", new InstancedBufferAttribute(colors, 3));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.attributes.color.needsUpdate = true;
};

type CoordinateType = CoordType;

const COORDINATE_TYPES: CoordinateType[] = [
    "origin",
    "exploded",
    "charactersExploded",
    "charactersSpheres",
    "spiral",
    "sphere",
    "calendar",
    "calendarStaged",
    "tree",
    "treeDiffuse"
];

// Fonction pour analyser les données et logger les informations importantes
const analyzeData = (posts: Post[], coordinateType: CoordinateType) => {
    console.group(`📊 Analyse des données pour le layout "${coordinateType}"`);
    console.log(`Nombre total de posts: ${posts.length}`);

    if (posts.length === 0) {
        console.warn("⚠️ Aucun post n'a été chargé!");
        console.groupEnd();
        return;
    }

    // Analyse des coordonnées pour le type spécifié
    const coordinates = posts.map(post => post.coordinates[coordinateType]);
    
    // Calcul des min/max pour chaque axe
    const stats = coordinates.reduce((acc, coord) => {
        return {
            minX: Math.min(acc.minX, coord.x),
            maxX: Math.max(acc.maxX, coord.x),
            minY: Math.min(acc.minY, coord.y),
            maxY: Math.max(acc.maxY, coord.y),
            minZ: Math.min(acc.minZ, coord.z),
            maxZ: Math.max(acc.maxZ, coord.z),
        };
    }, {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity,
    });

    console.log("Plages de valeurs:");
    console.log(`X: [${stats.minX.toFixed(2)}, ${stats.maxX.toFixed(2)}]`);
    console.log(`Y: [${stats.minY.toFixed(2)}, ${stats.maxY.toFixed(2)}]`);
    console.log(`Z: [${stats.minZ.toFixed(2)}, ${stats.maxZ.toFixed(2)}]`);

    // Vérification des valeurs invalides
    const invalidPosts = posts.filter(post => {
        const coord = post.coordinates[coordinateType];
        return isNaN(coord.x) || isNaN(coord.y) || isNaN(coord.z) ||
               !isFinite(coord.x) || !isFinite(coord.y) || !isFinite(coord.z);
    });

    if (invalidPosts.length > 0) {
        console.warn(`⚠️ ${invalidPosts.length} posts ont des coordonnées invalides!`);
        console.log("Premier post invalide:", invalidPosts[0]);
    }

    // Vérification de la distribution des points
    const avgX = coordinates.reduce((sum, coord) => sum + coord.x, 0) / coordinates.length;
    const avgY = coordinates.reduce((sum, coord) => sum + coord.y, 0) / coordinates.length;
    const avgZ = coordinates.reduce((sum, coord) => sum + coord.z, 0) / coordinates.length;

    console.log("\nMoyennes des coordonnées:");
    console.log(`X: ${avgX.toFixed(2)}`);
    console.log(`Y: ${avgY.toFixed(2)}`);
    console.log(`Z: ${avgZ.toFixed(2)}`);

    console.groupEnd();
};

export default forwardRef(function CustomGraph(
    { onNodeClick, onControllerChange, controllerConfig }: CustomGraphProps,
    ref
) {
    const [rawPosts, setRawPosts] = useState<RawPost[]>([]);
    const [posts, setPosts] = useState<Post[]>([]);
    const [nextPosts, setNextPosts] = useState<Post[]>([]);
    const [colorMap, setColorMap] = useState<{ [key: string]: Color }>({});
    const [coordinateType, setCoordinateType] = useState<CoordinateType>("exploded");
    const [highlightScale, setHighlightScale] = useState(5);
    const initialCoordinateType = useRef(coordinateType);
    const [previousCoordinateType, setPreviousCoordinateType] = useState<CoordinateType>("exploded");
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [transitionProgress, setTransitionProgress] = useSpring(() => ({
        value: 0,
        onChange: (result: { value: unknown }) => {
            const value = result.value as number;
            if (value >= 0.99) {
                setPosts(nextPosts);
                setIsTransitioning(false);
            }
        }
    }));
    const [showAxes, setShowAxes] = useState(false);
    const meshRef = useRef<InstancedMesh>(null);
    const axesRef = useRef<AxesHelper>(null);
    const paneRef = useRef<Pane | null>(null);
    const { camera } = useThree();
    const { isDebugMode, setIsDebugMode, debugLog } = useDebugMode();

    const { activePost, findClosestNode } = useClosestNode(posts, camera, coordinateType);

    // Initialisation des données et des couleurs
    useEffect(() => {
        if (rawPosts.length === 0) return;

        // Trier une seule fois
        const sortedPosts = [...rawPosts].sort((a, b) => a.creationDate - b.creationDate);
        
        // Générer la map des couleurs une seule fois
        const uniqueThematics = Array.from(
            new Set(sortedPosts.map((p) => p.thematic || "unknown"))
        );
        setColorMap(generateColorMap(uniqueThematics));

        // Initialiser avec les données triées
        const initialNormalizedData = normalizeCoordinates(sortedPosts, initialCoordinateType.current);
        const initialPosts = initialNormalizedData.map((post) => ({
            creationDate: post.creationDate,
            thematic: post.thematic || "unknown",
            uid: post.uid,
            color: post.color,
            coordinates: post.coordinates,
        }));

        setPosts(initialPosts);
        setNextPosts(initialPosts);

        // Analyser les données pour le débogage
        debugLog(`Analyse des données initiales ${analyzeData(initialPosts, initialCoordinateType.current)}`);
        ;
    }, [rawPosts, debugLog]);

    // Gestion du changement de type de coordonnées
    useEffect(() => {
        if (rawPosts.length === 0 || !posts.length) return;

        // Utiliser les rawPosts uniquement pour obtenir les nouvelles coordonnées
        const normalizedData = normalizeCoordinates(rawPosts, coordinateType);

        // Créer les nouveaux posts en préservant toutes les coordonnées existantes
        const newPosts = posts.map((post, index) => {
            const normalizedPost = normalizedData[index];
            return {
                ...post,
                coordinates: {
                    ...post.coordinates,
                    [coordinateType]: normalizedPost.coordinates[coordinateType]
                }
            };
        });

        // Analyser les données pour le débogage
        debugLog(`Analyse des données initiales ${analyzeData(newPosts, initialCoordinateType.current)}`);

        setNextPosts(newPosts);
        setIsTransitioning(true);
        setTransitionProgress.start({
            from: { value: 0 },
            to: { value: 1 },
            config: { 
                duration: 1000,
                easing: t => t * (2 - t)
            }
        });
    }, [coordinateType, rawPosts, posts, setTransitionProgress, debugLog]);

    // Mémoriser handleCoordinateTypeChange
    const handleCoordinateTypeChange = useCallback((newType: CoordinateType) => {
        setPreviousCoordinateType(coordinateType);
        setCoordinateType(newType);
    }, [coordinateType]);

    // Initialiser Tweakpane
    useEffect(() => {
        if (!paneRef.current) {
            paneRef.current = createPane(
                {
                    coordinateType,
                    debug: isDebugMode,
                    showAxes,
                    highlightScale,
                    controller: controllerConfig
                },
                {
                    onCoordinateTypeChange: handleCoordinateTypeChange,
                    onDebugChange: setIsDebugMode,
                    onShowAxesChange: setShowAxes,
                    onHighlightScaleChange: setHighlightScale,
                    onControllerChange
                },
                COORDINATE_TYPES
            );
        }

        return () => {
            if (paneRef.current) {
                paneRef.current.dispose();
                paneRef.current = null;
            }
        };
    }, [coordinateType, isDebugMode, showAxes, highlightScale, controllerConfig, handleCoordinateTypeChange, setIsDebugMode, onControllerChange]);

    // Mettre à jour les visuels quand l'activePost ou le type de coordonnées change
    useEffect(() => {
        if (!meshRef.current || posts.length === 0) return;
        updateInstancedMesh(meshRef.current, posts, colorMap, activePost, coordinateType, highlightScale);
    }, [posts, colorMap, activePost, coordinateType, highlightScale]);

    // Chargement initial des données
    useEffect(() => {
        debugLog("Chargement des posts...");
        fetch("/data/spatialized_posts.json")
            .then((response) => response.json())
            .then((data: RawPost[]) => {
                debugLog(`${data.length} posts chargés`);
                setRawPosts(data);
            })
            .catch((error) => console.error("Error loading posts:", error));
    }, [debugLog]);

    // Animation de la transition
    useFrame(() => {
        if (!meshRef.current || !isTransitioning || posts.length === 0) return;

        const mesh = meshRef.current;
        const progress = transitionProgress.value.get();
        const matrix = new Matrix4();
        const position = new Vector3();
        const scale = new Vector3(1, 1, 1);
        const quaternion = new Object3D().quaternion;

        posts.forEach((post, i) => {
            const nextPost = nextPosts[i];
            const currentCoords = post.coordinates[previousCoordinateType];
            const nextCoords = nextPost.coordinates[coordinateType];

            position.set(
                currentCoords.x + (nextCoords.x - currentCoords.x) * progress,
                currentCoords.y + (nextCoords.y - currentCoords.y) * progress,
                currentCoords.z + (nextCoords.z - currentCoords.z) * progress
            );

            if (activePost?.creationDate === post.creationDate) {
                scale.set(highlightScale, highlightScale, highlightScale);
            } else {
                scale.set(1, 1, 1);
            }

            matrix.compose(position, quaternion, scale);
            mesh.setMatrixAt(i, matrix);
        });

        mesh.instanceMatrix.needsUpdate = true;
    });

    // Détecter le post le plus proche à chaque frame
    useFrame((state) => {
        if (posts.length === 0 || !meshRef.current) return;
        findClosestNode(state.clock.getElapsedTime() * 1000);
    });

    // Exposer les méthodes via la ref
    useImperativeHandle(ref, () => ({
        getGraphData: () => ({
            posts: posts.map((post) => ({
                ...post,
                x: post.coordinates[coordinateType].x,
                y: post.coordinates[coordinateType].y,
                z: post.coordinates[coordinateType].z,
            })),
        }),
    }));

    if (posts.length === 0) {
        debugLog("Pas de posts à afficher");
        return null;
    }

    debugLog("Rendu du graphe avec", posts.length, "posts");

    return (
        <>
            {showAxes && <axesHelper ref={axesRef} args={[10]} />}
            <instancedMesh
                ref={meshRef}
                args={[undefined, undefined, posts.length]}
                frustumCulled={false}
                onClick={(e) => {
                    if (onNodeClick && e.instanceId !== undefined) {
                        onNodeClick(posts[e.instanceId]);
                    }
                }}
            >
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshPhongMaterial
                    vertexColors={true}
                    emissive="#000000"
                    emissiveIntensity={0}
                    shininess={100}
                />
            </instancedMesh>
        </>
    );
});
