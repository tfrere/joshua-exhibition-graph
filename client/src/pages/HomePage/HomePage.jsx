import { Canvas } from "@react-three/fiber";
import { OrbitControls, SpotLight, Stats } from "@react-three/drei";
import { useState } from "react";
import { useControls, folder } from "leva";
import GamepadControls from "../../components/GamepadControls";
import PostsRenderer from "../../components/PostsRenderer";

const HomePage = () => {
  const [gamepadEnabled, setGamepadEnabled] = useState(false);

  // Configurer tous les contrôles avec Leva
  const { debug, backgroundColor } = useControls({
    debug: true,
    backgroundColor: "#523e3e",
  });

  // Configurer les contrôles de la manette
  const gamepadControls = useControls({
    Manette: folder({
      enabled: {
        value: gamepadEnabled,
        onChange: (v) => setGamepadEnabled(v),
      },
      config: folder({
        maxSpeed: { value: 10, min: 1, max: 50 },
        acceleration: { value: 15, min: 1, max: 30 },
        deceleration: { value: 0.95, min: 0.5, max: 0.99 },
        rotationSpeed: { value: 1.5, min: 0.1, max: 5 },
        deadzone: { value: 0.1, min: 0.01, max: 0.5 },
      }),
    }),
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

        {gamepadControls.enabled && (
          <GamepadControls config={gamepadControls.config} />
        )}
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
