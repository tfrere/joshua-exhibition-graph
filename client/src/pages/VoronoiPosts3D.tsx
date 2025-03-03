import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { StatsDisplay } from "../components/StatsDisplay";

// Définir les couleurs pour les fonds et autres éléments
const COLORS = {
  background: "#000000",
};

// Interface pour les posts spatialisés
interface SpatializedPost {
  id: string;
  character: string;
  content: string;
  title?: string;
  creationDate: number;
  coordinates: {
    x: number;
    y: number;
    z: number;
  };
  color: string;
  type: string;
  sourceType: string;
}

// Composant pour afficher un post individuel
const PostPoint = ({
  post,
  onClick,
  isSelected,
  distanceToCamera,
}: {
  post: SpatializedPost;
  onClick: () => void;
  isSelected: boolean;
  distanceToCamera: number;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const size = isSelected ? 0.8 : 0.4;

  // Déterminer l'opacité en fonction de la distance
  const opacity = Math.max(0.1, Math.min(1, 1 - distanceToCamera / 500));

  return (
    <group
      position={[post.coordinates.x, post.coordinates.y, post.coordinates.z]}
    >
      <mesh ref={meshRef} onClick={onClick}>
        <sphereGeometry args={[size, 8, 8]} />
        <meshStandardMaterial
          color={post.color}
          transparent
          opacity={opacity}
          emissive={post.color}
          emissiveIntensity={isSelected ? 2 : 0.5}
        />
      </mesh>

      {isSelected && (
        <Billboard>
          <Text
            fontSize={3}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            position={[0, 5, 0]}
            maxWidth={30}
          >
            {post.content.length > 100
              ? post.content.substring(0, 100) + "..."
              : post.content}
          </Text>
        </Billboard>
      )}
    </group>
  );
};

// Composant pour afficher tous les posts
const PostsCloud = () => {
  const [posts, setPosts] = useState<SpatializedPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { camera } = useThree();

  // Limiter le nombre de posts à afficher pour des performances optimales
  const MAX_POSTS = 10000;

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const response = await fetch("/data/spatialized_posts_voronoi.json");
        const data = await response.json();

        // Limiter le nombre de posts si nécessaire
        const limitedData = data.slice(0, MAX_POSTS);

        setPosts(limitedData);
        console.log(
          `Chargé ${limitedData.length} posts sur ${data.length} totaux`
        );
      } catch (error) {
        console.error("Erreur lors du chargement des posts:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, []);

  // Calculer les distances des posts à la caméra pour l'opacité
  const postsWithDistance = useMemo(() => {
    const cameraPosition = camera.position;

    return posts.map((post) => {
      const distance = Math.sqrt(
        Math.pow(cameraPosition.x - post.coordinates.x, 2) +
          Math.pow(cameraPosition.y - post.coordinates.y, 2) +
          Math.pow(cameraPosition.z - post.coordinates.z, 2)
      );

      return {
        post,
        distance,
      };
    });
  }, [posts, camera.position]);

  // Trier les posts par distance pour un rendu optimal
  const sortedPosts = useMemo(() => {
    return [...postsWithDistance].sort((a, b) => a.distance - b.distance);
  }, [postsWithDistance]);

  if (loading) {
    return (
      <Text fontSize={5} color="#ffffff" anchorX="center" anchorY="middle">
        Chargement des posts...
      </Text>
    );
  }

  return (
    <>
      {sortedPosts.map(({ post, distance }) => (
        <PostPoint
          key={post.id}
          post={post}
          onClick={() =>
            setSelectedPost(selectedPost === post.id ? null : post.id)
          }
          isSelected={selectedPost === post.id}
          distanceToCamera={distance}
        />
      ))}
    </>
  );
};

// Composant pour gérer la caméra et les contrôles
const CameraController = () => {
  const { camera, gl } = useThree();

  useEffect(() => {
    // Configuration initiale de la caméra
    camera.position.set(0, 0, 200);
    camera.far = 10000;
    camera.updateProjectionMatrix();
  }, [camera]);

  return <OrbitControls enableDamping dampingFactor={0.05} rotateSpeed={0.5} />;
};

// Page principale
export const VoronoiPosts3D = () => {
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Canvas dpr={[1, 2]} gl={{ antialias: true }}>
        <color attach="background" args={[COLORS.background]} />
        <fog attach="fog" args={[COLORS.background, 100, 700]} />
        <ambientLight intensity={0.5} />
        <CameraController />
        <PostsCloud />
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            height={300}
          />
        </EffectComposer>
      </Canvas>

      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          color: "white",
          zIndex: 100,
        }}
      >
        <h1>Distribution Voronoï des Posts</h1>
        <p>Visualisation basée sur les champs d'influence des personnages</p>
      </div>

      <StatsDisplay />
    </div>
  );
};
