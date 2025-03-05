import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stats } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { PostsRenderer, FrustumCuller } from "../components/PostsRenderer";
import { APP_CONFIG } from "../config";
import { useData } from "../contexts/DataContext";

/**
 * Page d'affichage des posts spatialisés
 */
function PostsPage() {
  const { postsData, isLoadingPosts, postsError } = useData();
  const loaderRef = useRef(null);

  // État de chargement
  if (isLoadingPosts && postsData.length === 0) {
    console.log("Chargement des posts...");
  }

  // État d'erreur
  if (postsError) {
    console.error("Erreur lors du chargement des posts:", postsError);
  }

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000000" }}>
      {/* Indicateur de chargement */}
      {isLoadingPosts && postsData.length === 0 && (
        <div
          ref={loaderRef}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "white",
            fontSize: "24px",
            zIndex: 1000,
          }}
        >
          Chargement des posts...
        </div>
      )}

      <Canvas
        camera={{ position: [0, 0, 500], near: 0.1, far: 100000 }}
        gl={{ antialias: false }}
        performance={{ min: 0.5 }}
      >
        <Stats className="stats" showPanel={0} />
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 0, 0]} intensity={0.5} />

        <PostsRenderer posts={postsData} />

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

        <EffectComposer enabled={postsData.length < 1000}>
          <Bloom
            intensity={APP_CONFIG.bloomIntensity}
            luminanceThreshold={APP_CONFIG.bloomThreshold}
            luminanceSmoothing={APP_CONFIG.bloomSmoothness}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

export default PostsPage;
