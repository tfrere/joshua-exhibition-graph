import React, { useEffect, useRef, useState } from "react";

const TextScramble = ({
  text,
  className,
  speed = 0.8,
  charSet = "!<>-_\\/[]{}—=+*^?#________",
}) => {
  const elRef = useRef(null);
  const [displayText, setDisplayText] = useState(text || "");
  const queueRef = useRef([]);
  const frameRef = useRef(0);
  const frameRequestRef = useRef(null);
  const previousTextRef = useRef("");
  const isAnimatingRef = useRef(false);

  // Fonction pour générer un caractère aléatoire
  const randomChar = () => {
    return charSet[Math.floor(Math.random() * charSet.length)];
  };

  // Fonction de mise à jour d'animation
  const update = () => {
    if (!elRef.current) return;

    let output = "";
    let complete = 0;
    const queue = queueRef.current;

    for (let i = 0; i < queue.length; i++) {
      let { from, to, start, end, char } = queue[i];

      if (frameRef.current >= end) {
        complete++;
        output += to;
      } else if (frameRef.current >= start) {
        if (!char || Math.random() < 0.28) {
          char = randomChar();
          queue[i].char = char;
        }
        output += `<span class="scramble-char">${char}</span>`;
      } else {
        output += from;
      }
    }

    elRef.current.innerHTML = output;

    if (complete === queue.length) {
      isAnimatingRef.current = false;
      frameRequestRef.current = null;
    } else {
      frameRef.current++;
      // Nettoyer le frame précédent avant d'en demander un nouveau
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
      }
      frameRequestRef.current = requestAnimationFrame(update);
    }
  };

  // Fonction pour lancer l'animation de texte
  const scrambleText = (newText) => {
    if (!elRef.current) return;

    const oldText = previousTextRef.current;
    previousTextRef.current = newText;

    // Annuler toute animation en cours
    if (frameRequestRef.current) {
      cancelAnimationFrame(frameRequestRef.current);
      frameRequestRef.current = null;
    }

    // Préparation de la nouvelle animation
    const length = Math.max(oldText.length, newText.length);
    queueRef.current = [];

    for (let i = 0; i < length; i++) {
      const from = oldText[i] || "";
      const to = newText[i] || "";
      const start = Math.floor(Math.random() * 8) / speed;
      const end = start + Math.floor(Math.random() * 10) / speed;
      queueRef.current.push({ from, to, start, end });
    }

    // Lancer l'animation
    frameRef.current = 0;
    isAnimatingRef.current = true;
    update();
  };

  // Effet pour démarrer l'animation quand le texte change
  useEffect(() => {
    if (text !== undefined && text !== displayText) {
      setDisplayText(text);
      // Annuler l'animation en cours avant d'en démarrer une nouvelle
      if (isAnimatingRef.current && frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
        frameRequestRef.current = null;
      }
      scrambleText(text);
    }
  }, [text, displayText]);

  // Nettoyage à la destruction du composant
  useEffect(() => {
    return () => {
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
        frameRequestRef.current = null;
      }
      isAnimatingRef.current = false;
    };
  }, []);

  return (
    <span
      ref={elRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: displayText }}
    />
  );
};

export default TextScramble;
