import { Canvas } from "@react-three/fiber";
import { FlyControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import ForceGraph from "../components/ForceGraph";
import { GamepadControls } from "../components/GamepadControls";
import { useSocketSync } from "../hooks/useSocketSync";
import { useThree } from "@react-three/fiber";

function CameraSync() {
  const { camera } = useThree();
  useSocketSync(true, camera);
  return null;
}

export function Graph() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas
        camera={{
          position: [0, 0, 500],
          fov: 75,
          near: 0.1,
          far: 100000,
        }}
      >
        <color attach="background" args={["#000119"]} />
        <ambientLight intensity={2} />
        <pointLight position={[10, 10, 10]} />
        <ForceGraph />
        <FlyControls movementSpeed={200} rollSpeed={0.5} dragToLook={true} />
        <GamepadControls />
        <CameraSync />
        <EffectComposer>
          <Bloom
            intensity={2}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
