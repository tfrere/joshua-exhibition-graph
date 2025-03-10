import React, { useState, useEffect, useRef } from "react";
import useSound from "use-sound";
// import { useControls, folder } from "leva";
import { IconButton, Tooltip } from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

// Constante pour le volume du son au démarrage et dans toute l'application
const DEFAULT_VOLUME = 0.1; // 30% du volume maximum

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
    preload: "metadata", // Just load metadata first, not the whole file
    html5: true, // Use HTML5 Audio instead of Web Audio API
    xhr: {
      // Streaming options
      method: "GET",
      headers: {
        Range: "bytes=0-", // Request range for streaming
      },
    },
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
    // Important: set the sprite to force single instance
    sprite: {
      main: [0, 24 * 60 * 60 * 1000], // 24 hours max duration
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
        // Play the main sprite instead of default
        play({ id: "main" });
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
    setHasInteracted(true); // Mark that user has interacted
  };

  // Handle initial audio start
  const startAudio = () => {
    console.log("Starting audio - user interaction received");
    setIsLoading(true);
    setHasInteracted(true);
  };

  // Suggestion for file size optimization
  useEffect(() => {
    console.log(
      "Tip: For better performance, consider compressing your audio file to around 10-20MB"
    );
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        right: "20px",
        zIndex: 1000,
      }}
    >
      {!hasInteracted ? (
        // First-time audio start button
        <Tooltip title="Activer le son">
          <IconButton
            onClick={startAudio}
            aria-label="activer le son"
            size="large"
            sx={{
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              color: "white",
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.8)",
              },
              boxShadow: "0 2px 5px rgba(0, 0, 0, 0.3)",
              transition: "all 0.2s ease",
            }}
          >
            <PlayArrowIcon />
          </IconButton>
        </Tooltip>
      ) : (
        // Mute/unmute toggle button
        <Tooltip title={isMuted ? "Activer le son" : "Couper le son"}>
          <IconButton
            onClick={toggleMute}
            aria-label={isMuted ? "activer le son" : "couper le son"}
            size="large"
            sx={{
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              color: isLoading ? "gray" : "white",
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.8)",
              },
            }}
          >
            {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
          </IconButton>
        </Tooltip>
      )}
    </div>
  );
};

export default AmbientSound;
