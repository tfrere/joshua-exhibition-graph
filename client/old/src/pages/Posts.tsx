import { useRef, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stats } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import {
  PostsRenderer,
  FrustumCuller,
  Post,
} from "../components/PostsRenderer";

// Composant principal
export function Posts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;

    fetch("/data/spatialized_posts_voronoi.json")
      .then((res) => res.json())
      .then((data) => {
        console.log("Posts chargés:", data.length);
        setPosts(data);
      })
      .catch((error) => {
        console.error("Erreur lors du chargement des posts:", error);
      });
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000000" }}>
      <Canvas
        camera={{ position: [0, 0, 500], near: 0.1, far: 10000 }}
        gl={{ antialias: false }}
        performance={{ min: 0.5 }}
      >
        <Stats className="stats" showPanel={0} />
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 0, 0]} intensity={0.5} />

        {/* Rendu optimisé des posts */}
        <PostsRenderer posts={posts} />
        <FrustumCuller />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxDistance={5000}
          minDistance={50}
          zoomSpeed={1.5}
          dampingFactor={0.3}
          rotateSpeed={0.8}
        />

        <EffectComposer enabled={posts.length < 1000}>
          <Bloom
            intensity={0.1}
            luminanceThreshold={0.9}
            luminanceSmoothing={0.9}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
