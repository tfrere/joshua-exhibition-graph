import React, { useState, useEffect, useRef } from "react";
import useSound from "use-sound";
// import { useControls, folder } from "leva";
import { IconButton, Tooltip } from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";

// Constante pour le volume du son au démarrage et dans toute l'application
const DEFAULT_VOLUME = 0.1; // 10% du volume maximum

// Component dedicated to ambient sound management
const AmbientSound = () => {
  // State to track if sound is playing
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  // Track whether user has interacted with the page
  const [hasInteracted, setHasInteracted] = useState(false);
  // Track loading status
  const [isLoading, setIsLoading] = useState(false);
  // Ref to keep track of previous sound object for cleanup
  const soundRef = useRef(null);

  // Prévenir les problèmes de pool audio épuisé
  const [key, setKey] = useState(Date.now());

  // Fonction pour nettoyer l'instance audio précédente
  const cleanupAudio = () => {
    if (soundRef.current) {
      console.log("Cleaning up previous audio instance");
      try {
        // Force les instances HTML5 Audio à se libérer
        soundRef.current._sounds.forEach((sound) => {
          if (sound._node) {
            sound._node.pause();
            sound._node.src = "";
            sound._node.load();
          }
        });
        soundRef.current.unload();
      } catch (e) {
        console.warn("Cleanup error:", e);
      }
    }
  };

  // Reset audio instance on hot reload (development only)
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  // Initialize sound with use-sound with improved options for large files
  // Added key to force recreation on specific events
  const [play, { stop, sound }] = useSound("/sounds/ambiant.mp3", {
    volume: DEFAULT_VOLUME,
    loop: true,
    // Options for better handling of large files
    preload: true, // Chargement complet pour une meilleure boucle
    html5: false, // Utiliser Web Audio API pour un meilleur comportement de boucle
    // Supprimer le sprite pour permettre au mécanisme de boucle natif de fonctionner
    interrupt: false, // Empêcher les interruptions qui pourraient affecter la boucle
    onload: () => {
      console.log("Audio file loaded successfully!");
      setIsLoading(false);
      // Save reference to sound object for cleanup
      if (sound && !soundRef.current) {
        soundRef.current = sound;
      }
    },
    onloaderror: (error) => {
      console.error("Error loading audio file:", error);
      setIsLoading(false);
    },
    onplayerror: (error) => {
      console.error("Error playing audio:", error);
      // Try again with user interaction, but using a new instance
      if (hasInteracted) {
        setKey(Date.now()); // Force new instance
      }
    },
    onend: () => {
      console.log("Audio reached end - should loop automatically");
      // Si nécessaire, forcer la relecture en cas d'échec de boucle automatique
      if (isPlaying && !isMuted) {
        setTimeout(() => {
          play();
        }, 100);
      }
    },
  });

  // Control volume when mute state changes
  useEffect(() => {
    if (sound) {
      sound.volume(isMuted ? 0 : DEFAULT_VOLUME);
      console.log("Volume set to:", isMuted ? 0 : DEFAULT_VOLUME);
    }
  }, [sound, isMuted]);

  // Start or stop the sound after user interaction
  useEffect(() => {
    if (hasInteracted && !isPlaying && sound) {
      setIsLoading(true);
      console.log("User has interacted, trying to play audio...");
      try {
        // Play without specifying sprite ID to use native looping
        play();
        setIsPlaying(true);
        console.log("Audio playback started!");
      } catch (error) {
        console.error("Error playing audio:", error);
        setIsLoading(false);
      }
    }
  }, [hasInteracted, isPlaying, play, sound]);

  // Make sure sound stops when component unmounts
  useEffect(() => {
    return () => {
      if (isPlaying) {
        console.log("Cleaning up: stopping audio");
        stop();
        cleanupAudio();
      }
    };
  }, [isPlaying, stop]);

  // Handle mute/unmute toggle
  const toggleMute = () => {
    console.log("Toggle mute:", !isMuted);
    setIsMuted((prev) => !prev);
  };

  // Écoute le premier clic sur la page
  useEffect(() => {
    const handleFirstClick = () => {
      if (!hasInteracted) {
        console.log("Premier clic détecté - démarrage de l'audio");
        setHasInteracted(true);
      }
    };

    // Ajouter l'écouteur d'événement sur tout le document
    document.addEventListener("click", handleFirstClick);

    // Nettoyage de l'écouteur d'événement
    return () => {
      document.removeEventListener("click", handleFirstClick);
    };
  }, [hasInteracted]);

  // Suggestion for file size optimization
  useEffect(() => {
    console.log(
      "Tip: For better performance, consider compressing your audio file to around 10-20MB"
    );
  }, []);

  // return (
  //   <div
  //     style={{
  //       position: "absolute",
  //       top: "20px",
  //       right: "20px",
  //       zIndex: 1000,
  //     }}
  //   >
  //     {/* N'afficher le bouton de contrôle du son que si l'utilisateur a déjà interagi avec la page */}
  //     {hasInteracted && (
  //       <Tooltip title={isMuted ? "Activer le son" : "Couper le son"}>
  //         <IconButton
  //           onClick={toggleMute}
  //           aria-label={isMuted ? "activer le son" : "couper le son"}
  //           size="large"
  //           sx={{
  //             backgroundColor: "rgba(0, 0, 0, 0.6)",
  //             color: isLoading ? "gray" : "white",
  //             "&:hover": {
  //               backgroundColor: "rgba(0, 0, 0, 0.8)",
  //             },
  //           }}
  //         >
  //           {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
  //         </IconButton>
  //       </Tooltip>
  //     )}
  //   </div>
  // );
  return null;
};

export default AmbientSound;
