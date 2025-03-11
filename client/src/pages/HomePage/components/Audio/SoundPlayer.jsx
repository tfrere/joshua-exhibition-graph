import React, { useState, useEffect, useRef } from "react";
import useSound from "use-sound";
import { IconButton, Tooltip } from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";

// Component dedicated to sound management
const SoundPlayer = ({
  soundPath, // Path to the sound file
  defaultVolume = 0.1, // Default volume (10% of max)
  loop = true, // Whether to loop the sound
  autoPlay = true, // Whether to auto-play after interaction
  displayControls = true, // Whether to display control buttons
  controlPosition = { top: "20px", right: "20px" }, // Position of the controls
  tooltipLabels = { mute: "Couper le son", unmute: "Activer le son" }, // Customizable labels
}) => {
  // State to track if sound is playing
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  // Track whether user has interacted with the page
  const [hasInteracted, setHasInteracted] = useState(false);
  // Track loading status
  const [isLoading, setIsLoading] = useState(false);
  // Ref to keep track of previous sound object for cleanup
  const soundRef = useRef(null);

  // Prevent exhausted audio pool issues
  const [key, setKey] = useState(Date.now());

  // Function to clean up previous audio instance
  const cleanupAudio = () => {
    if (soundRef.current) {
      console.log("Cleaning up previous audio instance");
      try {
        // Force HTML5 Audio instances to release
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
  const [play, { stop, sound }] = useSound(soundPath, {
    volume: defaultVolume,
    loop: loop,
    // Options for better handling of large files
    preload: true, // Complete loading for better looping
    html5: false, // Use Web Audio API for better loop behavior
    // Remove sprite to allow native loop mechanism to work
    interrupt: false, // Prevent interruptions that could affect looping
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
      // If needed, force replay if automatic loop fails
      if (isPlaying && !isMuted && loop) {
        setTimeout(() => {
          play();
        }, 100);
      }
    },
  });

  // Control volume when mute state changes
  useEffect(() => {
    if (sound) {
      sound.volume(isMuted ? 0 : defaultVolume);
      console.log("Volume set to:", isMuted ? 0 : defaultVolume);
    }
  }, [sound, isMuted, defaultVolume]);

  // Start or stop the sound after user interaction
  useEffect(() => {
    if (hasInteracted && !isPlaying && sound && autoPlay) {
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
  }, [hasInteracted, isPlaying, play, sound, autoPlay]);

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

  // Listen for first click on the page
  useEffect(() => {
    const handleFirstClick = () => {
      if (!hasInteracted) {
        console.log("First click detected - starting audio");
        setHasInteracted(true);
      }
    };

    // Add event listener to the entire document
    document.addEventListener("click", handleFirstClick);

    // Clean up event listener
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

  return displayControls ? (
    <div
      style={{
        position: "absolute",
        zIndex: 1000,
        ...controlPosition,
      }}
    >
      {/* Only display the sound control button if the user has already interacted with the page */}
      {hasInteracted && (
        <Tooltip title={isMuted ? tooltipLabels.unmute : tooltipLabels.mute}>
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
  ) : null;
};

export default SoundPlayer;
