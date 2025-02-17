import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useState,
  useMemo,
} from "react";
import {
  Vector3,
  Color,
  InstancedMesh,
  Matrix4,
  Object3D,
  BufferGeometry,
  Material,
  Float32BufferAttribute,
  InstancedBufferAttribute,
} from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useClosestNode } from "../hooks/useClosestNode";

interface Post {
  creationDate: number;
  thematic: string;
  uid: string;
  coordinates: {
    x: number;
    y: number;
    z: number;
  };
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

  // Normaliser à une échelle adaptée
  const scale = 1000; // Réduction de l'échelle pour compenser le spread plus élevé
  return posts.map((post) => ({
    ...post,
    coordinates: {
      x: ((post.coordinates.x - minX) / (maxX - minX) - 0.5) * scale,
      y: ((post.coordinates.y - minY) / (maxY - minY) - 0.5) * scale,
      z: ((post.coordinates.z - minZ) / (maxZ - minZ) - 0.5) * scale,
    },
  }));
};

const HIGHLIGHT_SCALE = 2;

// Fonction utilitaire pour mettre à jour les visuels
const updateInstancedMesh = (
  mesh: InstancedMesh,
  posts: Post[],
  colorMap: { [key: string]: Color },
  activePost: Post | null
) => {
  const colors = new Float32Array(posts.length * 3);
  const matrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3(1, 1, 1);
  const quaternion = new Object3D().quaternion;

  posts.forEach((post, i) => {
    // Couleur
    const color =
      activePost?.creationDate === post.creationDate
        ? new Color("#ffffff")
        : colorMap[post.thematic] || new Color("#ffffff");
    color.toArray(colors, i * 3);

    // Position et échelle
    position.set(post.coordinates.x, post.coordinates.y, post.coordinates.z);

    if (activePost?.creationDate === post.creationDate) {
      scale.set(HIGHLIGHT_SCALE, HIGHLIGHT_SCALE, HIGHLIGHT_SCALE);
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

export default forwardRef(function CustomGraph(
  { onNodeClick }: CustomGraphProps,
  ref
) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [colorMap, setColorMap] = useState<{ [key: string]: Color }>({});
  const meshRef = useRef<InstancedMesh>(null);
  const { camera } = useThree();

  const { activePost, findClosestNode } = useClosestNode(posts, camera);

  // Mettre à jour les visuels quand l'activePost change
  useEffect(() => {
    if (!meshRef.current || posts.length === 0) return;
    updateInstancedMesh(meshRef.current, posts, colorMap, activePost);
  }, [posts, colorMap, activePost]);

  // Chargement initial des données
  useEffect(() => {
    console.log("Chargement des posts...");
    fetch("/data/spatialized_posts.json")
      .then((response) => response.json())
      .then((data: RawPost[]) => {
        console.log(`${data.length} posts chargés`);

        // Normaliser les coordonnées
        const normalizedData = normalizeCoordinates(data);

        // Log des premières coordonnées normalisées
        console.log(
          "Exemple de coordonnées normalisées:",
          normalizedData.slice(0, 3).map((p) => p.coordinates)
        );

        const loadedPosts = normalizedData.map((post) => ({
          creationDate: post.creationDate,
          thematic: post.thematic || "unknown",
          uid: post.uid,
          coordinates: post.coordinates,
        }));

        // Trier par creationDate pour assurer un ordre cohérent
        loadedPosts.sort((a: Post, b: Post) => a.creationDate - b.creationDate);
        setPosts(loadedPosts);

        // Générer la map des couleurs pour les thématiques uniques
        const uniqueThematics = Array.from(
          new Set(loadedPosts.map((p: Post) => p.thematic))
        );
        console.log("Thématiques uniques:", uniqueThematics);
        setColorMap(generateColorMap(uniqueThematics));
      })
      .catch((error) => console.error("Error loading posts:", error));
  }, []);

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
        x: post.coordinates.x,
        y: post.coordinates.y,
        z: post.coordinates.z,
      })),
    }),
  }));

  if (posts.length === 0) {
    console.log("Pas de posts à afficher");
    return null;
  }

  console.log("Rendu du graphe avec", posts.length, "posts");

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, posts.length]}
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
  );
});
