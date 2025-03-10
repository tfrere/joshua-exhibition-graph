import { useState, useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import {
  CAMERA_POSITIONS,
  CAMERA_MODES,
  DEFAULT_FLIGHT_CONFIG,
  FlightController,
  calculateCameraTransition,
} from "../utils/advancedCameraControls";
import { getInputManager, useInputs } from "../utils/inputManager";

/**
 * Indicateur de connexion de manette
 */
const GamepadIndicator = () => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const inputManager = getInputManager();

    const checkGamepadStatus = () => {
      setIsConnected(inputManager.isGamepadConnected());
    };

    // Vérifier immédiatement l'état
    checkGamepadStatus();

    // Vérifier périodiquement l'état de la manette
    const intervalId = setInterval(checkGamepadStatus, 1000);

    return () => clearInterval(intervalId);
  }, []);

  // Style pour le conteneur
  const containerStyle = {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    padding: "10px",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: "5px",
    display: "flex",
    alignItems: "center",
    zIndex: 1000,
  };

  // Style pour l'indicateur
  const indicatorStyle = {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: isConnected ? "#00ff00" : "#ff0000",
    marginRight: "10px",
  };

  return (
    <div style={containerStyle}>
      <div style={indicatorStyle}></div>
      <span style={{ color: "white", fontSize: "14px" }}>
        {isConnected ? "Manette connectée" : "Manette déconnectée"}
      </span>
    </div>
  );
};

/**
 * Contrôleur de caméra avancé avec deux modes : orbite et vol libre
 */
export function AdvancedCameraController({ config = DEFAULT_FLIGHT_CONFIG }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef(null);
  const [mode, setMode] = useState(CAMERA_MODES.ORBIT);
  const [positionIndex, setPositionIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const flightController = useRef(null);
  const transitioning = useRef({
    active: false,
    startTime: 0,
    duration: 2.0,
    startPosition: new Vector3(),
    startTarget: new Vector3(),
    endPosition: new Vector3(),
    endTarget: new Vector3(),
  });

  // Variables pour la rotation automatique
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(false);
  const lastInteractionTime = useRef(Date.now());
  const autoRotateTimerId = useRef(null);
  const AUTO_ROTATE_DELAY = 5000; // 5 secondes avant activation de la rotation auto
  const AUTO_ROTATE_SPEED = 0.025; // Vitesse de rotation automatique

  // Récupérer les entrées unifiées (clavier et manette)
  const inputs = useInputs();
  const prevInputs = useRef({});

  // Exposer l'état global pour d'autres composants
  useEffect(() => {
    window.__cameraAnimating = false;
    window.__cameraMode = mode;

    return () => {
      window.__cameraAnimating = undefined;
      window.__cameraMode = undefined;
    };
  }, []);

  // Mise à jour de l'état global quand le mode change
  useEffect(() => {
    window.__cameraMode = mode;
  }, [mode]);

  // Mise à jour de l'état global quand l'animation change
  useEffect(() => {
    window.__cameraAnimating = isTransitioning;
  }, [isTransitioning]);

  // Configurer le gestionnaire d'entrées
  useEffect(() => {
    // Mettre à jour la configuration du gestionnaire d'entrées
    const inputManager = getInputManager();
    inputManager.updateConfig({
      deadzone: config.deadzone,
    });

    // Cleanup
    return () => {
      // Rien à faire ici, car le gestionnaire d'entrées est un singleton global
    };
  }, [config]);

  // Fonction pour détecter l'activité de l'utilisateur
  const detectUserActivity = () => {
    lastInteractionTime.current = Date.now();

    // Si la rotation auto est activée, la désactiver
    if (autoRotateEnabled) {
      setAutoRotateEnabled(false);
    }

    // Annuler le timer existant et en démarrer un nouveau
    if (autoRotateTimerId.current) {
      clearTimeout(autoRotateTimerId.current);
    }

    // Programmer l'activation de la rotation auto après le délai
    autoRotateTimerId.current = setTimeout(() => {
      setAutoRotateEnabled(true);
    }, AUTO_ROTATE_DELAY);
  };

  // Ajouter des écouteurs pour les mouvements de souris et les clics
  useEffect(() => {
    const handleMouseActivity = () => detectUserActivity();

    // Ajouter les écouteurs d'événements au niveau de la fenêtre
    window.addEventListener("mousemove", handleMouseActivity);
    window.addEventListener("mousedown", handleMouseActivity);
    window.addEventListener("mouseup", handleMouseActivity);
    window.addEventListener("keydown", handleMouseActivity);
    window.addEventListener("wheel", handleMouseActivity);
    window.addEventListener("touchstart", handleMouseActivity);
    window.addEventListener("touchmove", handleMouseActivity);

    // Ajouter spécifiquement des écouteurs au canvas de Three.js
    // Ces écouteurs sont essentiels car OrbitControls peut capturer les événements
    // avant qu'ils n'atteignent window
    if (gl && gl.domElement) {
      window.addEventListener("mousemove", handleMouseActivity, {
        passive: true,
      });
      window.addEventListener("mousedown", handleMouseActivity, {
        passive: true,
      });
      window.addEventListener("mouseup", handleMouseActivity, {
        passive: true,
      });
      window.addEventListener("touchstart", handleMouseActivity, {
        passive: true,
      });
      window.addEventListener("touchmove", handleMouseActivity, {
        passive: true,
      });
      window.addEventListener("wheel", handleMouseActivity, {
        passive: true,
      });
    }

    // OrbitControls génère également des événements de changement
    // lorsque l'utilisateur interagit avec lui
    if (controlsRef.current) {
      controlsRef.current.addEventListener("change", handleMouseActivity);
    }

    // Démarrer le timer initial
    detectUserActivity();

    // Nettoyage lors du démontage
    return () => {
      // Nettoyage des écouteurs de la fenêtre
      window.removeEventListener("mousemove", handleMouseActivity);
      window.removeEventListener("mousedown", handleMouseActivity);
      window.removeEventListener("mouseup", handleMouseActivity);
      window.removeEventListener("keydown", handleMouseActivity);
      window.removeEventListener("wheel", handleMouseActivity);
      window.removeEventListener("touchstart", handleMouseActivity);
      window.removeEventListener("touchmove", handleMouseActivity);

      // Nettoyage des écouteurs du canvas
      if (gl && gl.domElement) {
        gl.domElement.removeEventListener("mousemove", handleMouseActivity);
        gl.domElement.removeEventListener("mousedown", handleMouseActivity);
        gl.domElement.removeEventListener("mouseup", handleMouseActivity);
        gl.domElement.removeEventListener("touchstart", handleMouseActivity);
        gl.domElement.removeEventListener("touchmove", handleMouseActivity);
        gl.domElement.removeEventListener("wheel", handleMouseActivity);
      }

      // Nettoyage de l'écouteur OrbitControls
      if (controlsRef.current) {
        controlsRef.current.removeEventListener("change", handleMouseActivity);
      }

      if (autoRotateTimerId.current) {
        clearTimeout(autoRotateTimerId.current);
      }
    };
  }, [gl, controlsRef.current]); // Ajouter les dépendances pour recréer les écouteurs si nécessaire

  // Traiter les entrées unifiées
  useEffect(() => {
    // Si l'une des entrées a changé, détecter l'activité
    if (JSON.stringify(inputs) !== JSON.stringify(prevInputs.current)) {
      detectUserActivity();
    }

    // Réagir au changement de mode
    if (inputs.toggleMode && !prevInputs.current.toggleMode) {
      toggleMode();
    }

    // Réagir à la demande de positionnement suivant
    if (
      inputs.nextPosition &&
      !prevInputs.current.nextPosition &&
      !isTransitioning
    ) {
      const nextIndex = (positionIndex + 1) % CAMERA_POSITIONS.length;
      animateToCameraPosition(nextIndex);
    }

    // Mettre à jour les entrées précédentes
    prevInputs.current = { ...inputs };
  }, [inputs, isTransitioning, positionIndex]);

  // Animation par frame pour le mode vol et les transitions
  useFrame((state, delta) => {
    // Gérer les transitions de caméra
    if (transitioning.current.active) {
      const elapsed = (Date.now() - transitioning.current.startTime) / 1000;
      const progress = Math.min(elapsed / transitioning.current.duration, 1);

      calculateCameraTransition(
        camera,
        controlsRef.current,
        {
          position: transitioning.current.startPosition,
          target: transitioning.current.startTarget,
        },
        {
          position: transitioning.current.endPosition,
          target: transitioning.current.endTarget,
        },
        progress
      );

      if (progress >= 1) {
        transitioning.current.active = false;
        setIsTransitioning(false);

        // Réinitialiser le gestionnaire d'entrées pour permettre de nouvelles transitions
        const inputManager = getInputManager();
        if (inputManager.inputs.nextPosition) {
          setTimeout(() => {
            // Force la réinitialisation de l'état nextPosition
            inputManager.inputs.nextPosition = false;
            inputManager.notifyListeners();
          }, 100);
        }
      }
    }
    // Appliquer les contrôles selon le mode actif
    else if (mode === CAMERA_MODES.FLIGHT && flightController.current) {
      // En mode vol, appliquer les entrées au contrôleur de vol
      const flightInput = {
        thrust: inputs.moveForward,
        lateral: inputs.moveRight,
        upDown: inputs.moveUp,
        yaw: inputs.lookHorizontal,
        pitch: inputs.lookVertical,
        roll: inputs.roll,
      };

      flightController.current.setInput(flightInput);
      flightController.current.update(delta);

      // Si la rotation automatique est activée, appliquer une rotation lente
      if (autoRotateEnabled && !isTransitioning && !flightInput.yaw) {
        // Ajouter une légère rotation horizontale
        flightController.current.setInput({
          ...flightInput,
          yaw: AUTO_ROTATE_SPEED,
        });
      }
    } else if (mode === CAMERA_MODES.ORBIT && controlsRef.current) {
      // En mode orbite, manipuler directement la caméra et les contrôles
      const orbitControls = controlsRef.current;

      if (orbitControls && !isTransitioning) {
        // Activer/désactiver la rotation automatique selon l'état
        orbitControls.autoRotate = autoRotateEnabled;
        orbitControls.autoRotateSpeed = AUTO_ROTATE_SPEED * 10; // OrbitControls utilise une échelle différente

        // Manipuler la position cible des contrôles d'orbite si l'utilisateur interagit
        const rotationSpeed = config.rotationSpeed * 0.05;
        const moveSpeed = 2;

        // Pour les rotations, déplacer la caméra autour du point cible
        if (Math.abs(inputs.lookHorizontal) > 0) {
          // Rotation horizontale - déplacer sur l'axe azimutal
          orbitControls.azimuthAngle += -inputs.lookHorizontal * rotationSpeed;
        }

        if (Math.abs(inputs.lookVertical) > 0) {
          // Rotation verticale - déplacer sur l'axe polaire
          orbitControls.polarAngle += -inputs.lookVertical * rotationSpeed;
          // Limiter l'angle polaire pour éviter les retournements
          orbitControls.polarAngle = Math.max(
            0.1,
            Math.min(Math.PI - 0.1, orbitControls.polarAngle)
          );
        }

        // Pour le zoom avant/arrière, ajuster la distance
        if (Math.abs(inputs.moveForward) > 0) {
          const zoomFactor = 1 + inputs.moveForward * 0.05;
          orbitControls.dolly(zoomFactor > 1 ? 1 / zoomFactor : -zoomFactor);
        }

        // Pour les déplacements latéraux, ajuster la cible
        if (Math.abs(inputs.moveRight) > 0 || Math.abs(inputs.moveUp) > 0) {
          const offset = new Vector3();

          // Calculer la direction droite/gauche par rapport à la caméra
          if (Math.abs(inputs.moveRight) > 0) {
            const right = new Vector3(1, 0, 0);
            right.applyQuaternion(camera.quaternion);
            right.multiplyScalar(-inputs.moveRight * moveSpeed);
            offset.add(right);
          }

          // Calculer la direction haut/bas
          if (Math.abs(inputs.moveUp) > 0) {
            const up = new Vector3(0, 1, 0);
            up.multiplyScalar(inputs.moveUp * moveSpeed);
            offset.add(up);
          }

          // Déplacer la cible des contrôles
          orbitControls.target.add(offset);
        }

        // Mettre à jour les contrôles
        orbitControls.update();
      }
    }
  });

  // Fonction pour basculer entre les modes
  const toggleMode = () => {
    const newMode =
      mode === CAMERA_MODES.ORBIT ? CAMERA_MODES.FLIGHT : CAMERA_MODES.ORBIT;

    // Si on passe en mode orbite, réinitialiser le contrôleur de vol
    if (newMode === CAMERA_MODES.ORBIT && flightController.current) {
      flightController.current.reset();
    }

    setMode(newMode);

    // Réinitialiser le timer de rotation automatique
    detectUserActivity();
  };

  // Fonction pour animer vers une position de caméra prédéfinie
  const animateToCameraPosition = (index) => {
    const targetPos = CAMERA_POSITIONS[index];
    if (!targetPos) return;

    // S'assurer que camera et controls sont disponibles
    if (!camera) {
      console.error("Camera non disponible pour l'animation");
      return;
    }

    const currentControls = controlsRef.current;

    // Initialiser la transition
    const trans = transitioning.current;
    trans.active = true;
    trans.startTime = Date.now();
    trans.startPosition.copy(camera.position);

    // Stocker la cible selon le mode actuel
    if (mode === CAMERA_MODES.ORBIT && currentControls) {
      trans.startTarget.copy(currentControls.target);
    } else {
      // En mode vol, calculer une position cible devant la caméra
      trans.startTarget
        .copy(camera.position)
        .add(new Vector3(0, 0, -100).applyQuaternion(camera.quaternion));
    }

    trans.endPosition.copy(targetPos.position);
    trans.endTarget.copy(targetPos.target);

    setPositionIndex(index);
    setIsTransitioning(true);

    // Réinitialiser le timer de rotation automatique
    detectUserActivity();
  };

  // Initialiser le contrôleur de vol une fois que la caméra est disponible
  useEffect(() => {
    if (camera && !flightController.current) {
      flightController.current = new FlightController(camera, config);
      console.log("Contrôleur de vol initialisé avec la caméra", camera);
    }
  }, [camera, config]);

  // Mettre à jour la configuration du contrôleur de vol quand elle change
  useEffect(() => {
    if (flightController.current) {
      flightController.current.config = config;
    }
  }, [config]);

  return (
    <>
      {/* Contrôles d'orbite pour le mode ORBIT */}
      <OrbitControls
        ref={controlsRef}
        args={[camera, gl.domElement]}
        enableDamping
        dampingFactor={0.25}
        rotateSpeed={0.5}
        enabled={mode === CAMERA_MODES.ORBIT && !isTransitioning}
        autoRotate={
          autoRotateEnabled && mode === CAMERA_MODES.ORBIT && !isTransitioning
        }
        autoRotateSpeed={AUTO_ROTATE_SPEED * 10}
      />
    </>
  );
}

// Exporter le composant GamepadIndicator pour pouvoir l'utiliser dans WorkPage
export { GamepadIndicator };

export default AdvancedCameraController;
