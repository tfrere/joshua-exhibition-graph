import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Vector3, Quaternion, Euler } from "three";

const DEADZONE = 0.15;
const MAX_SPEED = 1400; // Vitesse maximale
const ACCELERATION = 800; // Force d'accélération
const DECELERATION = 0.95; // Facteur de décélération (friction)
const ROTATION_SPEED = 4.2;

export function GamepadControls() {
  const { camera } = useThree();
  const gamepadIndex = useRef<number | null>(null);
  const velocity = useRef(new Vector3()); // Vélocité actuelle
  const tempVector = useRef(new Vector3());
  const euler = useRef(new Euler(0, 0, 0, "YXZ"));
  const rotationQuaternion = useRef(new Quaternion());

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
    const thrust = Math.abs(gamepad.axes[1]) > DEADZONE ? -gamepad.axes[1] : 0;

    // Mouvement vertical (Boutons)
    const upDown =
      (gamepad.buttons[3]?.pressed ? 1 : 0) -
      (gamepad.buttons[0]?.pressed ? 1 : 0);

    // Rotation vue (Right stick)
    const viewYawInput =
      Math.abs(gamepad.axes[2]) > DEADZONE ? gamepad.axes[2] : 0;
    const pitchInput =
      Math.abs(gamepad.axes[3]) > DEADZONE ? gamepad.axes[3] : 0;

    // Roll (Triggers)
    const rollInput =
      (gamepad.buttons[6]?.value || 0) - (gamepad.buttons[7]?.value || 0);

    // Calculer l'accélération dans la direction de vue
    if (thrust !== 0) {
      tempVector.current
        .set(0, 0, -1)
        .applyQuaternion(camera.quaternion)
        .multiplyScalar(thrust * ACCELERATION * delta);
      velocity.current.add(tempVector.current);
    }

    // Ajouter l'accélération verticale
    if (upDown !== 0) {
      tempVector.current
        .set(0, 1, 0)
        .multiplyScalar(upDown * ACCELERATION * delta);
      velocity.current.add(tempVector.current);
    }

    // Appliquer la décélération
    velocity.current.multiplyScalar(DECELERATION);

    // Limiter la vitesse maximale
    const currentSpeed = velocity.current.length();
    if (currentSpeed > MAX_SPEED) {
      velocity.current.multiplyScalar(MAX_SPEED / currentSpeed);
    }

    // Appliquer le mouvement
    camera.position.add(velocity.current.clone().multiplyScalar(delta));

    // Obtenir les angles actuels de la caméra
    euler.current.setFromQuaternion(camera.quaternion);

    // Vue libre avec le stick droit
    if (viewYawInput !== 0) {
      euler.current.y -= viewYawInput * ROTATION_SPEED * delta;
    }
    if (pitchInput !== 0) {
      euler.current.x = Math.max(
        -Math.PI / 2,
        Math.min(
          Math.PI / 2,
          euler.current.x + pitchInput * ROTATION_SPEED * delta
        )
      );
    }
    if (rollInput !== 0) {
      euler.current.z = Math.max(
        -Math.PI / 2,
        Math.min(
          Math.PI / 2,
          euler.current.z + rollInput * ROTATION_SPEED * delta
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
