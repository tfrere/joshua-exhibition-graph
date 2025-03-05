import { Canvas } from "@react-three/fiber";
import { FlyControls, Stats } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import CustomGraph from "../components/CustomGraph";
import { GamepadControls } from "../components/GamepadControls";
import { useSocketSync } from "../hooks/useSocketSync";
import { useThree } from "@react-three/fiber";
import { useRef, useState } from "react";

interface ControllerConfig {
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
  rotationSpeed: number;
  deadzone: number;
}

function CameraSync() {
  const { camera } = useThree();
  useSocketSync(true, camera);
  return null;
}

export function CustomGraphView() {
  const graphRef = useRef<unknown>(null);
  const [controllerConfig, setControllerConfig] = useState<ControllerConfig>({
    maxSpeed: 1400,
    acceleration: 800,
    deceleration: 0.95,
    rotationSpeed: 4.2,
    deadzone: 0.15
  });

  const handleControllerChange = (key: string, value: number) => {
    setControllerConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas
        camera={{
          position: [400, 400, 400],
          fov: 75,
          near: 1,
          far: 20000,
        }}
      >
        <Stats className="stats" showPanel={0} />
        <color attach="background" args={["#000119"]} />
        <ambientLight intensity={3} />
        <pointLight position={[0, 0, 0]} intensity={2} />
        <pointLight position={[2000, 2000, 2000]} intensity={2} />
        <CustomGraph
          ref={graphRef}
          onNodeClick={(post) => {
            console.log("Post cliqué:", post);
          }}
          onControllerChange={handleControllerChange}
          controllerConfig={controllerConfig}
        />
        <FlyControls movementSpeed={1000} rollSpeed={0.5} dragToLook={true} />
        <GamepadControls config={controllerConfig} />
        <CameraSync />
        <EffectComposer>
          <Bloom
            intensity={10}
            luminanceThreshold={0.01}
            luminanceSmoothing={1.2}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
