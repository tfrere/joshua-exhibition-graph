import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Vector3, Quaternion, Euler } from "three";

const DEADZONE = 0.15;
const MOVEMENT_SPEED = 200; // Doublé pour plus de vitesse
const ROTATION_SPEED = 1.2; // Réduit de 2 à 1.2 pour une rotation plus douce

export function GamepadControls() {
  const { camera } = useThree();
  const gamepadIndex = useRef<number | null>(null);
  const moveVector = useRef(new Vector3());
  const tempVector = useRef(new Vector3());
  const euler = useRef(new Euler(0, 0, 0, "YXZ")); // YXZ pour un contrôle FPS classique
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

    // Mouvement avant/arrière et latéral (Left stick)
    const forwardBackward =
      Math.abs(gamepad.axes[1]) > DEADZONE ? -gamepad.axes[1] : 0;
    const leftRight =
      Math.abs(gamepad.axes[0]) > DEADZONE ? -gamepad.axes[0] : 0;

    // Mouvement vertical (Boutons)
    const upDown =
      (gamepad.buttons[3]?.pressed ? 1 : 0) -
      (gamepad.buttons[0]?.pressed ? 1 : 0);

    // Rotation (Right stick)
    const yawInput = Math.abs(gamepad.axes[2]) > DEADZONE ? gamepad.axes[2] : 0;
    const pitchInput =
      Math.abs(gamepad.axes[3]) > DEADZONE ? gamepad.axes[3] : 0;

    // Roll (Triggers)
    const rollInput =
      (gamepad.buttons[6]?.value || 0) - (gamepad.buttons[7]?.value || 0);

    // Appliquer les mouvements
    moveVector.current.set(0, 0, 0);

    // Avant/Arrière
    tempVector.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    moveVector.current.addScaledVector(tempVector.current, forwardBackward);

    // Gauche/Droite
    tempVector.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
    moveVector.current.addScaledVector(tempVector.current, leftRight);

    // Haut/Bas
    tempVector.current.set(0, 1, 0);
    moveVector.current.addScaledVector(tempVector.current, upDown);

    // Normaliser et appliquer la vitesse
    if (moveVector.current.length() > 0) {
      moveVector.current.normalize().multiplyScalar(MOVEMENT_SPEED * delta);
      camera.position.add(moveVector.current);
    }

    // Obtenir les angles actuels de la caméra
    euler.current.setFromQuaternion(camera.quaternion);

    // Appliquer les rotations de manière relative
    if (yawInput !== 0) {
      euler.current.y -= yawInput * ROTATION_SPEED * delta;
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

    // Appliquer les rotations à la caméra
    camera.quaternion.setFromEuler(euler.current);
  });

  return null;
}
