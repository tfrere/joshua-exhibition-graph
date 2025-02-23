import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Vector3, Euler } from "three";

interface ControllerConfig {
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
  rotationSpeed: number;
  deadzone: number;
}

interface GamepadControlsProps {
  config: ControllerConfig;
}

export function GamepadControls({ config }: GamepadControlsProps) {
  const { camera } = useThree();
  const gamepadIndex = useRef<number | null>(null);
  const velocity = useRef(new Vector3());
  const tempVector = useRef(new Vector3());
  const euler = useRef(new Euler(0, 0, 0, "YXZ"));

  useEffect(() => {
    const handleGamepadConnected = (e: GamepadEvent) => {
      console.log("Manette connectée à l'index %d", e.gamepad.index);
      gamepadIndex.current = e.gamepad.index;
    };

    const handleGamepadDisconnected = (e: GamepadEvent) => {
      console.log("Manette déconnectée de l'index %d", e.gamepad.index);
      if (gamepadIndex.current === e.gamepad.index) {
        gamepadIndex.current = null;
      }
    };

    window.addEventListener("gamepadconnected", handleGamepadConnected);
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);

    return () => {
      window.removeEventListener("gamepadconnected", handleGamepadConnected);
      window.removeEventListener(
        "gamepaddisconnected",
        handleGamepadDisconnected
      );
    };
  }, []);

  useFrame((state, delta) => {
    if (gamepadIndex.current === null) return;

    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[gamepadIndex.current];
    if (!gamepad) return;

    // Mouvement avant/arrière (Left stick Y)
    const thrust = Math.abs(gamepad.axes[1]) > config.deadzone ? -gamepad.axes[1] : 0;

    // Mouvement vertical (Boutons)
    const upDown =
      (gamepad.buttons[3]?.pressed ? 1 : 0) -
      (gamepad.buttons[0]?.pressed ? 1 : 0);

    // Rotation vue (Right stick)
    const viewYawInput =
      Math.abs(gamepad.axes[2]) > config.deadzone ? gamepad.axes[2] : 0;
    const pitchInput =
      Math.abs(gamepad.axes[3]) > config.deadzone ? gamepad.axes[3] : 0;

    // Roll (Triggers)
    const rollInput =
      (gamepad.buttons[6]?.value || 0) - (gamepad.buttons[7]?.value || 0);

    // Calculer l'accélération dans la direction de vue
    if (thrust !== 0) {
      tempVector.current
        .set(0, 0, -1)
        .applyQuaternion(camera.quaternion)
        .multiplyScalar(thrust * config.acceleration * delta);
      velocity.current.add(tempVector.current);
    }

    // Ajouter l'accélération verticale
    if (upDown !== 0) {
      tempVector.current
        .set(0, 1, 0)
        .multiplyScalar(upDown * config.acceleration * delta);
      velocity.current.add(tempVector.current);
    }

    // Appliquer la décélération
    velocity.current.multiplyScalar(config.deceleration);

    // Limiter la vitesse maximale
    const currentSpeed = velocity.current.length();
    if (currentSpeed > config.maxSpeed) {
      velocity.current.multiplyScalar(config.maxSpeed / currentSpeed);
    }

    // Appliquer le mouvement
    camera.position.add(velocity.current.clone().multiplyScalar(delta));

    // Obtenir les angles actuels de la caméra
    euler.current.setFromQuaternion(camera.quaternion);

    // Vue libre avec le stick droit
    if (viewYawInput !== 0) {
      euler.current.y -= viewYawInput * config.rotationSpeed * delta;
    }
    if (pitchInput !== 0) {
      euler.current.x = Math.max(
        -Math.PI / 2,
        Math.min(
          Math.PI / 2,
          euler.current.x + pitchInput * config.rotationSpeed * delta
        )
      );
    }
    if (rollInput !== 0) {
      euler.current.z = Math.max(
        -Math.PI / 2,
        Math.min(
          Math.PI / 2,
          euler.current.z + rollInput * config.rotationSpeed * delta
        )
      );
    }

    // Appliquer les rotations de la vue
    if (viewYawInput !== 0 || pitchInput !== 0 || rollInput !== 0) {
      camera.quaternion.setFromEuler(euler.current);
    }
  });

  return null;
}
