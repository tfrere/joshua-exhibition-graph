import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import ForceGraph from "./components/ForceGraph";
import { GamepadControls } from "./components/GamepadControls";

function App() {
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
        <OrbitControls makeDefault />
        <GamepadControls />
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

export default App;
