import { Canvas } from "@react-three/fiber";
import { OrbitControls, SpotLight, Stats } from "@react-three/drei";
import { useState } from "react";
import { useControls, folder } from "leva";
import PostsRenderer from "../../components/PostsRenderer";

const HomePage = () => {
  const [gamepadEnabled, setGamepadEnabled] = useState(false);

  // Configurer tous les contrôles avec Leva
  const { debug, backgroundColor } = useControls({
    debug: true,
    backgroundColor: "#523e3e",
  });

  return (
    <div className="canvas-container">
      <Canvas>
        {debug && <Stats />}
        <color attach="background" args={[backgroundColor]} />
        {/* Éclairage amélioré */}
        <ambientLight intensity={1.2} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <pointLight position={[-10, -10, -10]} intensity={1} color="#ffffff" />
        <pointLight position={[0, 20, 0]} intensity={1.2} color="#f0f0ff" />
        <SpotLight
          position={[10, 20, 10]}
          angle={0.3}
          penumbra={0.8}
          intensity={2}
          castShadow
          distance={100}
        />

        <PostsRenderer />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          makeDefault={true}
        />
      </Canvas>
    </div>
  );
};

export default HomePage;
