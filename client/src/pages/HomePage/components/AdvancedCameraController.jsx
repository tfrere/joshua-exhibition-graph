import { useState, useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import useSound from "use-sound";
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
 * Contrôleur de caméra avancé en mode vol libre uniquement
 */
export function AdvancedCameraController({ config = DEFAULT_FLIGHT_CONFIG }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef(null);
  const [mode, setMode] = useState(CAMERA_MODES.FLIGHT);
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

  // Variables for automatic rotation
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(false);
  const lastInteractionTime = useRef(Date.now());
  const autoRotateTimerId = useRef(null);
  const AUTO_ROTATE_DELAY = 10000; // 10 seconds before auto rotation activation
  const AUTO_ORBIT_DELAY = 10000; // 10 seconds before orbit mode
  const AUTO_ROTATE_SPEED = 0.025; // Auto rotation speed
  const [orbitModeActive, setOrbitModeActive] = useState(false);
  const orbitTimerId = useRef(null);
  const orbitAttempted = useRef(false); // Nouvel état pour suivre les tentatives d'activation

  // Paramètres d'orbite et de rotation
  const ORBIT_SPEED = 0.05; // Vitesse de déplacement orbital (plus la valeur est élevée, plus l'orbite est rapide)
  const ORBIT_YAW = 0.8; // Vitesse de rotation de la caméra sur elle-même (yaw)
  const ORBIT_PITCH = 0.02; // Vitesse de tangage vertical (pitch)
  const ORBIT_ACCELERATION_TIME = 2.0; // Durée en secondes de l'accélération progressive

  // Timers et références pour l'accélération
  const orbitStartTime = useRef(null);

  // Sound for acceleration
  const [
    playAcceleration,
    { stop: stopAcceleration, sound: accelerationSound },
  ] = useSound("/sounds/acceleration.mp3", {
    volume: 0,
    loop: true,
    interrupt: false,
    soundEnabled: true,
    playbackRate: 1,
  });

  const accelerationPlaying = useRef(false);
  const currentAccelerationVolume = useRef(0);
  const currentAccelerationPitch = useRef(1);

  // Récupérer les entrées unifiées (clavier et manette)
  const inputs = useInputs();
  const prevInputs = useRef({});

  // Exposer l'état global pour d'autres composants
  useEffect(() => {
    window.__cameraAnimating = false;
    window.__cameraMode = mode;
    window.__orbitModeActive = false;
    window.__cameraPosition = null;
    window.__cameraTarget = null;

    return () => {
      window.__cameraAnimating = undefined;
      window.__cameraMode = undefined;
      window.__orbitModeActive = undefined;
      window.__cameraPosition = undefined;
      window.__cameraTarget = undefined;
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

  // Mise à jour de l'état global quand le mode orbite change
  useEffect(() => {
    window.__orbitModeActive = orbitModeActive;
    console.log(
      "Orbit mode global state updated:",
      orbitModeActive ? "active" : "inactive"
    );

    // Si l'orbite est activée, enregistrer le temps de démarrage pour l'accélération
    if (orbitModeActive) {
      orbitStartTime.current = Date.now();
      console.log("Starting orbit acceleration curve");
    }

    // Si on vient de désactiver le mode orbite, réinitialiser le FlightController
    // pour éviter que la rotation continue avec l'inertie
    if (!orbitModeActive && flightController.current) {
      console.log(
        "Orbit mode disabled, resetting flight controller rotation velocity"
      );
      flightController.current.reset();
      // Réinitialiser le timer d'accélération
      orbitStartTime.current = null;
    }

    // Forcer une vérification supplémentaire après un court délai
    // pour s'assurer que l'état global est bien synchronisé
    setTimeout(() => {
      if (window.__orbitModeActive !== orbitModeActive) {
        console.log("Fixing orbit mode state synchronization");
        window.__orbitModeActive = orbitModeActive;
      }
    }, 100);
  }, [orbitModeActive]);

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

  // Initialiser la caméra à la position 0 (vue globale à 600 unités)
  useEffect(() => {
    if (camera) {
      // Définir la position initiale de la caméra avec un délai pour permettre
      // au système de se stabiliser au démarrage
      console.log("Setting initial camera position");

      // On commence par désactiver toute transition ou orbite
      transitioning.current.active = false;
      setIsTransitioning(false);
      setOrbitModeActive(false);

      // Puis on place la caméra à sa position initiale
      animateToCameraPosition(0);

      // Une fois la position initiale définie, on démarrer le timer d'inactivité
      // avec un délai pour éviter les conflits avec la transition initiale
      setTimeout(() => {
        console.log("Initializing inactivity timer after startup");
        detectUserActivity();
      }, 2000); // Délai de 2 secondes
    }
  }, [camera]);

  // Function to detect user activity
  const detectUserActivity = () => {
    console.log("User activity detected, resetting timers");
    lastInteractionTime.current = Date.now();
    orbitAttempted.current = false; // Réinitialiser également cet état

    // Exposer le temps d'inactivité et le temps restant pour l'interface
    window.__lastInteractionTime = lastInteractionTime.current;
    window.__autoOrbitDelay = AUTO_ORBIT_DELAY;

    // If auto rotation or orbit mode is enabled, disable it
    if (autoRotateEnabled) {
      setAutoRotateEnabled(false);
    }

    if (orbitModeActive) {
      console.log("Disabling orbit mode due to user activity");
      setOrbitModeActive(false);

      // Réinitialiser le FlightController pour éviter l'effet d'inertie de rotation
      if (flightController.current) {
        console.log("Resetting flight controller to stop rotation momentum");
        flightController.current.reset();
      }
    }

    // Cancel existing timers
    if (autoRotateTimerId.current) {
      clearTimeout(autoRotateTimerId.current);
      autoRotateTimerId.current = null;
    }

    if (orbitTimerId.current) {
      clearTimeout(orbitTimerId.current);
      orbitTimerId.current = null;
    }

    // Ne programmer les timers que si on est en mode normal
    // (pas en transition et pas en mode orbite)
    if (!transitioning.current.active && !orbitModeActive) {
      // Program auto rotation activation after delay
      autoRotateTimerId.current = setTimeout(() => {
        console.log("Auto-rotation timer expired, checking conditions...");
        // Vérifier à nouveau qu'on n'est pas en transition ou en orbite avant d'activer
        if (!transitioning.current.active && !orbitModeActive) {
          console.log("Activating auto-rotation");
          setAutoRotateEnabled(true);
        } else {
          console.log(
            "Auto-rotation cancelled - camera in transition or orbit mode"
          );
        }
      }, AUTO_ROTATE_DELAY);

      // Program orbit mode activation after delay
      orbitTimerId.current = setTimeout(() => {
        console.log("Orbit timer expired, checking conditions...");

        // Vérifier à nouveau qu'on n'est pas en transition ou en orbite avant d'activer
        if (!transitioning.current.active && !orbitModeActive) {
          console.log(
            "Conditions met - Activating orbit mode after inactivity"
          );
          orbitAttempted.current = true;

          // Retour à la position par défaut PUIS activation du mode orbite
          animateToCameraPosition(0, true); // Le second paramètre indique qu'il faut activer l'orbite après
        } else {
          console.log(
            "Orbit activation cancelled - camera already in transition or orbit mode"
          );
          console.log(
            "  transitioning.current.active:",
            transitioning.current.active
          );
          console.log("  orbitModeActive:", orbitModeActive);
        }
      }, AUTO_ORBIT_DELAY);

      console.log(
        "Auto-rotation timer set to expire in",
        AUTO_ROTATE_DELAY / 1000,
        "seconds"
      );
      console.log(
        "Orbit timer set to expire in",
        AUTO_ORBIT_DELAY / 1000,
        "seconds"
      );
    } else {
      console.log(
        "Not scheduling auto-rotation/orbit timers - camera in transition or orbit mode"
      );
      console.log(
        "  transitioning.current.active:",
        transitioning.current.active
      );
      console.log("  orbitModeActive:", orbitModeActive);
    }
  };

  // Add event listeners for mouse movements and clicks
  useEffect(() => {
    const handleMouseActivity = () => detectUserActivity();

    // Add event listeners to window level
    window.addEventListener("mousemove", handleMouseActivity);
    window.addEventListener("mousedown", handleMouseActivity);
    window.addEventListener("mouseup", handleMouseActivity);
    window.addEventListener("keydown", handleMouseActivity);
    window.addEventListener("wheel", handleMouseActivity);
    window.addEventListener("touchstart", handleMouseActivity);
    window.addEventListener("touchmove", handleMouseActivity);

    // Add specifically to Three.js canvas event listeners
    // These listeners are essential to detect user interaction
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

    // Start initial timer
    detectUserActivity();

    // Cleanup on unmount
    return () => {
      // Cleanup window event listeners
      window.removeEventListener("mousemove", handleMouseActivity);
      window.removeEventListener("mousedown", handleMouseActivity);
      window.removeEventListener("mouseup", handleMouseActivity);
      window.removeEventListener("keydown", handleMouseActivity);
      window.removeEventListener("wheel", handleMouseActivity);
      window.removeEventListener("touchstart", handleMouseActivity);
      window.removeEventListener("touchmove", handleMouseActivity);

      // Cleanup canvas event listeners
      if (gl && gl.domElement) {
        gl.domElement.removeEventListener("mousemove", handleMouseActivity);
        gl.domElement.removeEventListener("mousedown", handleMouseActivity);
        gl.domElement.removeEventListener("mouseup", handleMouseActivity);
        gl.domElement.removeEventListener("touchstart", handleMouseActivity);
        gl.domElement.removeEventListener("touchmove", handleMouseActivity);
        gl.domElement.removeEventListener("wheel", handleMouseActivity);
      }

      if (autoRotateTimerId.current) {
        clearTimeout(autoRotateTimerId.current);
      }
    };
  }, [gl]); // Add dependencies to recreate listeners if necessary

  // Handle unified inputs
  useEffect(() => {
    // Si on est en mode orbite et que n'importe quelle entrée est détectée, désactiver l'orbite
    if (orbitModeActive) {
      const hasAnyInput =
        inputs.moveForward !== 0 ||
        inputs.moveRight !== 0 ||
        inputs.moveUp !== 0 ||
        inputs.lookHorizontal !== 0 ||
        inputs.lookVertical !== 0 ||
        inputs.roll !== 0 ||
        inputs.toggleMode ||
        inputs.nextPosition ||
        inputs.action1 ||
        inputs.action2;

      if (hasAnyInput) {
        console.log("User input detected, disabling orbit mode");
        setOrbitModeActive(false);

        // Réinitialiser le FlightController pour éviter l'effet d'inertie de rotation
        if (flightController.current) {
          console.log("Resetting flight controller to stop rotation momentum");
          flightController.current.reset();
        }

        detectUserActivity();
      }
    }

    // Si des entrées non-nulles sont détectées, signaler l'activité
    const hasNonZeroInput =
      inputs.moveForward !== 0 ||
      inputs.moveRight !== 0 ||
      inputs.moveUp !== 0 ||
      inputs.lookHorizontal !== 0 ||
      inputs.lookVertical !== 0 ||
      inputs.roll !== 0 ||
      inputs.toggleMode ||
      inputs.nextPosition;

    if (hasNonZeroInput) {
      detectUserActivity();
    }

    // React to following position request
    if (
      inputs.nextPosition &&
      !prevInputs.current.nextPosition &&
      !isTransitioning
    ) {
      const nextIndex = (positionIndex + 1) % CAMERA_POSITIONS.length;
      animateToCameraPosition(nextIndex);
    }

    // Update previous inputs
    prevInputs.current = { ...inputs };
  }, [inputs, isTransitioning, positionIndex, orbitModeActive]);

  // Animation by frame for flight mode and transitions
  useFrame((state, delta) => {
    // Exposer les positions de la caméra et de sa cible pour l'interface utilisateur
    if (camera) {
      // Exposer la position actuelle
      window.__cameraPosition = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      };

      // Calculer et exposer une approximation de la cible
      const target = new Vector3(0, 0, -100)
        .applyQuaternion(camera.quaternion)
        .add(camera.position);
      window.__cameraTarget = {
        x: target.x,
        y: target.y,
        z: target.z,
      };

      // Mise à jour du temps restant avant l'activation de l'auto-orbite
      // seulement si nous ne sommes ni en transition ni en orbite
      if (
        !transitioning.current.active &&
        !orbitModeActive &&
        window.__lastInteractionTime
      ) {
        const elapsedTime = Date.now() - window.__lastInteractionTime;
        const remainingTime = Math.max(
          0,
          window.__autoOrbitDelay - elapsedTime
        );
        window.__timeBeforeAutoOrbit = remainingTime;
      } else if (transitioning.current.active || orbitModeActive) {
        // Si en transition ou en orbite, il n'y a pas de compte à rebours
        window.__timeBeforeAutoOrbit = null;
      }
    }

    // Handle camera transitions
    if (transitioning.current.active) {
      const elapsed = (Date.now() - transitioning.current.startTime) / 1000;
      const progress = Math.min(elapsed / transitioning.current.duration, 1);

      // Calculer la nouvelle position et orientation de la caméra
      calculateCameraTransition(
        camera,
        null, // On n'utilise plus controlsRef ici
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

      // Exposer l'état d'animation pour l'interface utilisateur
      window.__cameraAnimating = true;

      if (progress >= 1) {
        transitioning.current.active = false;
        setIsTransitioning(false);
        window.__cameraAnimating = false;

        // Une fois la transition terminée, réinitialiser le FlightController pour éviter des mouvements brusques
        if (flightController.current) {
          flightController.current.reset();
        }

        // Reset input handler for allowing new transitions
        const inputManager = getInputManager();
        if (inputManager.inputs.nextPosition) {
          setTimeout(() => {
            // Force nextPosition state reset
            inputManager.inputs.nextPosition = false;
            inputManager.notifyListeners();
          }, 100);
        }
      }
    }
    // Mode orbite automatique
    else if (orbitModeActive && flightController.current) {
      // En mode orbite, on applique une rotation lente autour de la sphère
      // Log moins fréquent pour éviter de saturer la console
      if (Math.random() < 0.01) {
        // Log environ 1% du temps pour vérifier que l'orbite est active
        console.log("Orbit mode active - applying orbital movement");
      }

      // S'assurer que le mode orbite est correctement reflété dans l'état global
      window.__orbitModeActive = true;

      // Calculer le facteur d'accélération entre 0 et 1
      let accelerationFactor = 1.0; // Par défaut, vitesse complète

      if (orbitStartTime.current) {
        const elapsedTime = (Date.now() - orbitStartTime.current) / 1000; // en secondes

        if (elapsedTime < ORBIT_ACCELERATION_TIME) {
          // Utiliser une courbe d'accélération cubique (easeInOutCubic)
          // qui démarre doucement, accélère au milieu, puis ralentit l'accélération vers la fin
          const progress = elapsedTime / ORBIT_ACCELERATION_TIME;

          // Courbe easeInOutCubic
          accelerationFactor =
            progress < 0.5
              ? 4 * progress * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 3) / 2;

          if (Math.random() < 0.05) {
            // Log occasionnel pour montrer la progression de l'accélération
            console.log(
              `Orbit acceleration: ${(accelerationFactor * 100).toFixed(0)}%`
            );
          }
        } else {
          // Après la période d'accélération, vitesse constante maximale
          accelerationFactor = 1.0;
          // On peut réinitialiser la référence pour économiser les calculs
          orbitStartTime.current = null;
        }
      }

      // Appliquer le facteur d'accélération aux paramètres de rotation
      const orbitInput = {
        thrust: 0,
        lateral: 0,
        upDown: 0,
        yaw: ORBIT_YAW * accelerationFactor,
        pitch: ORBIT_PITCH * accelerationFactor,
        roll: 0,
      };

      // Calculer un mouvement orbital RÉEL autour du centre
      // Obtenir la position actuelle par rapport au centre
      const position = camera.position.clone();
      const distance = position.length();

      // Maintenir la distance avec le centre (0,0,0)
      if (Math.abs(distance - 600) > 10) {
        const direction = position.clone().normalize();
        const targetPos = direction.multiplyScalar(600);
        camera.position.lerp(targetPos, 0.05);
      }

      // ---------- AJOUT DU MOUVEMENT ORBITAL ----------
      // Créer un mouvement orbital en déplaçant la caméra autour du centre
      // en plus de la rotation de la caméra elle-même

      // 1. Calculer l'angle actuel dans le plan XZ
      const angleXZ = Math.atan2(camera.position.x, camera.position.z);

      // 2. Créer un nouvel angle en ajoutant une rotation (plus rapide que le yaw pour un effet visible)
      // Appliquer également le facteur d'accélération à la vitesse de déplacement orbital
      const orbitSpeed = ORBIT_SPEED * delta * accelerationFactor;
      const newAngleXZ = angleXZ + orbitSpeed;

      // 3. Calculer la nouvelle position en conservant la même hauteur et distance
      const horizontalDistance = Math.sqrt(
        camera.position.x * camera.position.x +
          camera.position.z * camera.position.z
      );
      const newX = Math.sin(newAngleXZ) * horizontalDistance;
      const newZ = Math.cos(newAngleXZ) * horizontalDistance;

      // 4. Appliquer la nouvelle position tout en maintenant la hauteur (Y)
      camera.position.x = newX;
      camera.position.z = newZ;

      // Fin des ajouts pour le mouvement orbital

      // Appliquer la rotation de la caméra elle-même (pour qu'elle tourne sur elle-même)
      flightController.current.setInput(orbitInput);
      flightController.current.update(delta);

      // S'assurer que la caméra pointe toujours vers le centre
      camera.lookAt(0, 0, 0);

      // Log debug info occasionally (every ~5 seconds)
      if (
        Math.floor(Date.now() / 5000) % 1 === 0 &&
        Math.floor(Date.now()) % 5000 < 100
      ) {
        console.log(
          `Audio - Volume: ${currentAccelerationVolume.current.toFixed(
            2
          )}, Pitch: ${currentAccelerationPitch.current.toFixed(
            2
          )}, AccelFactor: ${accelerationFactor.toFixed(2)}`
        );
      }
    }
    // On est en mode vol, mais pas en transition ni en mode orbite
    else if (flightController.current && !transitioning.current.active) {
      // S'assurer que le mode orbite est correctement reflété dans l'état global
      window.__orbitModeActive = false;

      // In flight mode, apply inputs to flight controller
      const flightInput = {
        thrust: inputs.moveForward,
        lateral: inputs.moveRight,
        upDown: inputs.moveUp,
        yaw: inputs.lookHorizontal,
        pitch: inputs.lookVertical,
        roll: inputs.roll,
      };

      // Si une entrée est détectée, arrêter l'orbite automatique
      if (
        inputs.moveForward !== 0 ||
        inputs.moveRight !== 0 ||
        inputs.moveUp !== 0 ||
        inputs.lookHorizontal !== 0 ||
        inputs.lookVertical !== 0 ||
        inputs.roll !== 0
      ) {
        if (orbitModeActive) {
          console.log("User input detected in flight mode - disabling orbit");
          setOrbitModeActive(false);
          detectUserActivity();
        }
      }

      flightController.current.setInput(flightInput);
      flightController.current.update(delta);

      // Exposer l'état d'animation pour l'interface utilisateur
      window.__cameraAnimating = false;

      // Handle acceleration sound
      if (flightController.current) {
        // Calculate movement intensity based on velocity
        const velocity = flightController.current.velocity;
        const speed = velocity.length();
        const maxSpeed = flightController.current.config.maxSpeed;

        // Get acceleration factor from the controller (if available)
        const accelerationFactor = window.__accelerationFactor || 1;

        // Calculate normalized volume (0 to 1) based on current speed and acceleration factor
        // Increase volume based on acceleration factor
        const targetVolume = Math.min(
          (speed / (maxSpeed * 0.5)) * (0.5 + accelerationFactor / 2),
          1
        );

        // Also adjust pitch based on acceleration factor (higher speed = higher pitch)
        const targetPitch = 0.8 + (accelerationFactor - 1) * 0.3; // Range from 0.8 to 1.4

        // Smooth volume transition
        currentAccelerationVolume.current =
          currentAccelerationVolume.current * 0.95 + targetVolume * 0.05;

        // Smooth pitch transition
        currentAccelerationPitch.current =
          (currentAccelerationPitch.current || 1) * 0.95 + targetPitch * 0.05;

        // Play or stop sound based on acceleration
        if (speed > 0.5 && !accelerationPlaying.current) {
          playAcceleration();
          accelerationPlaying.current = true;
        }

        // Update sound volume and pitch
        if (accelerationSound && accelerationPlaying.current) {
          // Appliquer le volume
          accelerationSound.volume(currentAccelerationVolume.current);

          // Appliquer la modulation de hauteur (pitch)
          try {
            // Différentes approches possibles selon la version de Howler.js utilisée
            if (typeof accelerationSound.rate === "function") {
              // Méthode directe si disponible
              accelerationSound.rate(currentAccelerationPitch.current);
            } else if (
              accelerationSound._sounds &&
              accelerationSound._sounds.length > 0
            ) {
              // Accès aux sons internes
              accelerationSound._sounds.forEach((sound) => {
                if (
                  sound._node &&
                  typeof sound._node.playbackRate !== "undefined"
                ) {
                  sound._node.playbackRate.value =
                    currentAccelerationPitch.current;
                }
              });
            }
          } catch (error) {
            console.error("Erreur lors de l'ajustement du pitch:", error);
          }

          // Log debug info occasionally (every ~5 seconds)
          if (
            Math.floor(Date.now() / 5000) % 1 === 0 &&
            Math.floor(Date.now()) % 5000 < 100
          ) {
            console.log(
              `Audio - Volume: ${currentAccelerationVolume.current.toFixed(
                2
              )}, Pitch: ${currentAccelerationPitch.current.toFixed(
                2
              )}, AccelFactor: ${accelerationFactor.toFixed(2)}`
            );
          }

          // Stop sound if almost stopped
          if (speed < 0.5) {
            stopAcceleration();
            accelerationPlaying.current = false;
          }
        }
      }

      // If auto rotation is enabled, apply a slow rotation
      if (autoRotateEnabled && !isTransitioning && !flightInput.yaw) {
        // Add slight horizontal rotation
        flightController.current.setInput({
          ...flightInput,
          yaw: AUTO_ROTATE_SPEED,
        });
      }
    }
  });

  // Function to animate to a predefined camera position
  const animateToCameraPosition = (index, activateOrbitAfter = false) => {
    const targetPos = CAMERA_POSITIONS[index];
    if (!targetPos) return;

    // Ensure camera is available
    if (!camera) {
      console.error("Camera not available for animation");
      return;
    }

    // Si on était en mode orbite, désactiver temporairement pendant la transition
    const wasOrbiting = orbitModeActive;
    if (wasOrbiting) {
      console.log("Temporarily disabling orbit mode during transition");
      setOrbitModeActive(false);
    }

    // Marker l'état de transition
    console.log(
      `Starting camera transition to position ${index}, activateOrbitAfter:`,
      activateOrbitAfter
    );
    setIsTransitioning(true);
    window.__cameraAnimating = true;

    // Initialize transition
    const trans = transitioning.current;
    trans.active = true;
    trans.startTime = Date.now();
    trans.startPosition.copy(camera.position);

    // Méthode améliorée pour calculer la cible actuelle de la caméra
    // Projeter un point à 100 unités devant la caméra
    const direction = new Vector3(0, 0, -100).applyQuaternion(
      camera.quaternion
    );
    trans.startTarget.copy(camera.position).add(direction);

    // Copier les positions cibles finales
    trans.endPosition.copy(targetPos.position);
    trans.endTarget.copy(targetPos.target);

    // Mettre à jour l'état de l'interface utilisateur
    setPositionIndex(index);
    setIsTransitioning(true);
    window.__cameraAnimating = true;

    // En cas de transition vers la position par défaut, afficher un message dans la console
    if (index === 0) {
      console.log("Transition vers la vue globale à 600 unités de distance");

      // Si on doit activer l'orbite après la transition, programmer un délai
      if (activateOrbitAfter) {
        // Programmer l'activation de l'orbite une fois la transition terminée
        const orbiteActivationDelay = trans.duration * 1000 + 100;
        console.log(
          `Programming orbit activation in ${orbiteActivationDelay}ms after transition`
        );

        setTimeout(() => {
          if (!transitioning.current.active) {
            console.log("Orbit activation - transition completed");
            setOrbitModeActive(true);
            // Force update global state immediately
            window.__orbitModeActive = true;
          } else {
            // Si toujours en transition, réessayer dans un moment
            console.log(
              "Still transitioning, retrying orbit activation shortly"
            );
            setTimeout(() => {
              console.log("Second attempt at orbit activation");
              setOrbitModeActive(true);
              // Force update global state immediately
              window.__orbitModeActive = true;
            }, 500);
          }
        }, orbiteActivationDelay);
      }
    }

    // Ne pas réinitialiser les timers d'inactivité pendant une transition automatique vers l'orbite
    if (!activateOrbitAfter) {
      // Reset auto rotation timer
      detectUserActivity();
    } else {
      console.log(
        "Not resetting activity timers as we're transitioning to orbit mode"
      );
    }
  };

  // Initialize flight controller once camera is available
  useEffect(() => {
    if (camera && !flightController.current) {
      flightController.current = new FlightController(camera, config);
      console.log("Flight controller initialized with camera", camera);

      // Exposer la fonction animateToCameraPosition au niveau global
      window.__animateToCameraPosition = animateToCameraPosition;

      // Exposer également le gestionnaire d'entrées au niveau global pour le FlightController
      window.getInputManager = getInputManager;
    }
  }, [camera, config]);

  // Update flight controller configuration when it changes
  useEffect(() => {
    if (flightController.current) {
      flightController.current.config = config;
    }
  }, [config]);

  // Nettoyer la référence globale lors du démontage
  useEffect(() => {
    return () => {
      // Supprimer la référence globale quand le composant est démonté
      if (window.__animateToCameraPosition === animateToCameraPosition) {
        window.__animateToCameraPosition = null;
      }

      // Nettoyer les timers d'autorotation et d'orbite
      if (autoRotateTimerId.current) {
        clearTimeout(autoRotateTimerId.current);
      }

      if (orbitTimerId.current) {
        clearTimeout(orbitTimerId.current);
      }

      // Arrêter le son d'accélération
      if (accelerationPlaying.current) {
        stopAcceleration();
        accelerationPlaying.current = false;
      }
    };
  }, [stopAcceleration]);

  // Aucun élément visuel n'est rendu maintenant puisqu'on n'a plus besoin d'OrbitControls
  return null;
}

// Export GamepadIndicator component for use in WorkPage
export { GamepadIndicator };

export default AdvancedCameraController;
