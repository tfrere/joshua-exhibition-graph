import { Canvas } from "@react-three/fiber";
import { FlyControls, Stats } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import CustomGraph from "../components/CustomGraph";
import { GamepadControls } from "../components/GamepadControls";
import { useSocketSync } from "../hooks/useSocketSync";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

function CameraSync() {
  const { camera } = useThree();
  useSocketSync(true, camera);
  return null;
}

export function CustomGraphView() {
  const graphRef = useRef<any>(null);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas
        gl={(canvas) => {
          const context = canvas.getContext('webgl2');
          if (!context) {
            console.warn('WebGL 2 n\'est pas disponible, certaines fonctionnalités seront désactivées');
            return {
              powerPreference: "high-performance",
              antialias: true,
              stencil: false,
              depth: true
            };
          }
          return {
            context,
            powerPreference: "high-performance",
            antialias: true,
            stencil: false,
            depth: true
          };
        }}
        camera={{
          position: [400, 400, 400],
          fov: 75,
          near: 0.1,
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
        />
        <FlyControls movementSpeed={1000} rollSpeed={0.5} dragToLook={true} />
        <GamepadControls />
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
