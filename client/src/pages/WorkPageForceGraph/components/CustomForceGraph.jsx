import {
  useRef,
  useEffect,
  useState,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
} from "d3-force-3d";
import { useData } from "../../../contexts/DataContext";
import { Html } from "@react-three/drei";
// Importer les fonctions de nodeUtils.js
import { createNodeObject } from "./ForceGraph/utils/nodeUtils";

/**
 * Composant de graphe de force personnalisé utilisant d3-force et React Three Fiber.
 * Cette implémentation offre un contrôle total sur l'apparence et le comportement du graphe.
 */
const CustomForceGraph = forwardRef(
  (
    {
      nodeSize = 5,
      chargeStrength = -30,
      centerStrength = 0.03,
      linkStrength = 0.5,
      linkDistance = 40,
      simulationSpeed = 0.5,
      collisionStrength = 5,
      cooldownTime = 8000, // Temps après lequel la simulation se stabilise (ms)
      onGraphStabilized = () => {},
    },
    ref
  ) => {
    const { graphData, isLoadingGraph } = useData();
    const simulationRef = useRef(null);
    const nodesRef = useRef(null);
    const linksRef = useRef(null);
    const isStabilized = useRef(false);
    const [hoverInfo, setHoverInfo] = useState(null);
    const [isSimulationRunning, setIsSimulationRunning] = useState(true);

    // Référence pour suivre si le rendu initial a été effectué (tous les nœuds à 0,0,0)
    const initialRenderDoneRef = useRef(false);
    // Facteur de transition pour un déploiement progressif
    const transitionFactorRef = useRef(0);
    // Temps de démarrage de la transition
    const transitionStartTimeRef = useRef(0);
    // Durée totale de la transition en millisecondes
    const TRANSITION_DURATION = 1500;

    // Fonction déterministe pour générer des coordonnées initiales basées sur l'ID du nœud
    const generateDeterministicPosition = (nodeId, axis) => {
      // Si nodeId est undefined ou null, retourner 0
      if (!nodeId) return 0;
      
      // Convertir nodeId en chaîne de caractères
      const idString = String(nodeId);
      
      // Initialiser un nombre hash
      let hash = 0;
      
      // Utiliser des valeurs de départ différentes pour chaque axe
      const seedOffset = axis === 'x' ? 1 : axis === 'y' ? 2 : 3;
      
      // Algorithme simple de hachage
      for (let i = 0; i < idString.length; i++) {
        const char = idString.charCodeAt(i);
        // Utiliser une multiplication différente selon l'axe pour éviter la corrélation
        hash = ((hash << 5) - hash + char * seedOffset) | 0;
      }
      
      // Convertir le hash en nombre entre -1 et 1
      // Utiliser modulo 1000 puis division pour normaliser entre -1 et 1
      return (hash % 1000) / 500 - 1;
    };

    // Préparer les données adaptées à d3-force - cette partie n'est exécutée que lorsque graphData change
    const { nodesData, linksData } = useMemo(() => {
      if (!graphData || !graphData.nodes || !graphData.links) {
        return { nodesData: [], linksData: [] };
      }

      // Copier les données pour ne pas modifier les originales et assurer que chaque nœud a un ID
      const nodesData = graphData.nodes.map((node, index) => {
        // S'assurer que chaque nœud a un ID unique (utilisé pour les liens)
        const nodeId = node.id || `generated_${index}`;
        
        // Générer des positions déterministes pour chaque nœud
        const initialX = generateDeterministicPosition(nodeId, 'x');
        const initialY = generateDeterministicPosition(nodeId, 'y');
        const initialZ = generateDeterministicPosition(nodeId, 'z');
        
        return {
          ...node, // Copier toutes les propriétés originales (important pour préserver isJoshua, type, etc.)
          // Assurer qu'il y a toujours un ID
          id: nodeId,
          // Utiliser les positions déterministes générées
          x: initialX,
          y: initialY,
          z: initialZ,
          // Conserver les vélocités à 0 au démarrage
          vx: 0,
          vy: 0,
          vz: 0,
          // Stocker les positions originales si elles existaient
          originalX: node.x,
          originalY: node.y,
          originalZ: node.z,
          // S'assurer que les propriétés critiques pour la spatialisation sont définies
          slug: node.slug || nodeId,
          isJoshua: node.isJoshua === true,
          type: node.type || 'entity',
          // Stocker l'index pour référence
          index,
        };
      });

      // Créer une map des IDs de nœuds vers leurs indices dans le tableau
      const nodeIdToIndex = {};
      const nodeIndexToId = {};
      nodesData.forEach((node, index) => {
        if (node.id) {
          nodeIdToIndex[node.id] = index;
          nodeIndexToId[index] = node.id;
        }
      });

      // Convertir les liens pour utiliser les indices plutôt que les IDs
      const linksData = graphData.links
        .map((link, linkIndex) => {
          // Source et target peuvent être des objets, des chaînes, ou des indices
          const sourceId =
            typeof link.source === "object" ? link.source.id : link.source;
          const targetId =
            typeof link.target === "object" ? link.target.id : link.target;

          // Récupérer les indices correspondants (priorité à l'ID, puis à l'indice direct)
          let sourceIndex, targetIndex;

          if (
            typeof sourceId === "string" &&
            nodeIdToIndex[sourceId] !== undefined
          ) {
            sourceIndex = nodeIdToIndex[sourceId];
          } else if (
            typeof sourceId === "number" &&
            sourceId >= 0 &&
            sourceId < nodesData.length
          ) {
            sourceIndex = sourceId;
          } else {
            console.warn(`Lien ${linkIndex}: source invalide`, sourceId);
            return null;
          }

          if (
            typeof targetId === "string" &&
            nodeIdToIndex[targetId] !== undefined
          ) {
            targetIndex = nodeIdToIndex[targetId];
          } else if (
            typeof targetId === "number" &&
            targetId >= 0 &&
            targetId < nodesData.length
          ) {
            targetIndex = targetId;
          } else {
            console.warn(`Lien ${linkIndex}: target invalide`, targetId);
            return null;
          }

          // Créer un nouveau lien avec les références par indice
          return {
            ...link,
            // Utiliser directement les objets nœuds pour plus de stabilité
            source: nodesData[sourceIndex],
            target: nodesData[targetIndex],
            value: link.value || 1,
            // Stocker les IDs originaux pour référence
            originalSourceId: sourceId,
            originalTargetId: targetId,
          };
        })
        .filter((link) => link !== null);

      console.log("[CYCLE DE VIE] Préparation des données du graphe - Positions initialisées de manière déterministe");
      return { nodesData, linksData };
    }, [graphData]);

    // Exposer les méthodes et données via la ref
    useImperativeHandle(ref, () => ({
      // Récupérer les positions actuelles des nœuds
      getNodesPositions: () => {
        // console.log("CustomForceGraph: Retourne les positions des nœuds pour spatialisation");
        console.log("[CYCLE DE VIE] Demande des positions actuelles des nœuds via la ref");
        return nodesData.map((node) => ({
          // Propriétés utilisées par ForceGraph
          id: node.id,
          group: node.group || 0,
          name: node.name || "",
          x: node.x,
          y: node.y,
          z: node.z,
          value: node.value || 1,
          
          // Propriétés critiques pour la spatialisation des posts
          slug: node.slug,
          isJoshua: node.isJoshua === true, // S'assurer que c'est un booléen
          type: node.type || (node.isJoshua === true ? "character" : "entity"),
          
          // Autres propriétés qui pourraient être utiles
          originalX: node.originalX,
          originalY: node.originalY,
          originalZ: node.originalZ
        }));
      },
      // Vérifier si la simulation est stabilisée
      isStabilized: () => isStabilized.current,
      // Forcer la stabilisation de la simulation
      stabilize: () => {
        if (simulationRef.current) {
          simulationRef.current.stop();
          isStabilized.current = true;
          setIsSimulationRunning(false);
          onGraphStabilized();
          // console.log("Simulation stabilisée manuellement");
          console.log("[CYCLE DE VIE] Stabilisation manuelle de la simulation");
        }
      },
    }));

    // Configurer la simulation - séparer en deux effets pour éviter les redémarrages multiples
    useEffect(() => {
      if (isLoadingGraph || nodesData.length === 0) return;

      console.log("[CYCLE DE VIE] Initialisation de la simulation 3D - Création des forces");

      // Donner une petite impulsion aléatoire initiale aux nœuds pour démarrer le mouvement
      // mais seulement après un délai pour permettre le rendu initial à l'origine
      setTimeout(() => {
        if (!isStabilized.current) {
          console.log("[CYCLE DE VIE] Application des impulsions initiales aux nœuds après délai");
          
          // Impulsions initiales
          nodesData.forEach(node => {
            // Laisser les positions telles qu'elles ont été initialisées de manière déterministe
            // Ajouter de petites impulsions pour démarrer le mouvement
            node.vx = (Math.random() - 0.5) * 0.05;
            node.vy = (Math.random() - 0.5) * 0.05;
            node.vz = (Math.random() - 0.5) * 0.05;
          });
          
          // Maintenant marquer que le rendu initial est terminé et démarrer la transition
          console.log("[CYCLE DE VIE] Début de la transition d'origine vers positions calculées");
          initialRenderDoneRef.current = true;
          transitionStartTimeRef.current = Date.now();
        }
      }, 100);

      // Réinitialiser le statut de stabilisation et de rendu initial
      isStabilized.current = false;
      initialRenderDoneRef.current = false;
      transitionFactorRef.current = 0;
      setIsSimulationRunning(true);

      // Positions déjà initialisées de manière déterministe lors de la création des nodesData
      console.log("[CYCLE DE VIE] Positions des nœuds initialisées de manière déterministe");
      
      // Créer une nouvelle simulation avec des forces standard
      const simulation = forceSimulation(nodesData, 3)
        .alphaDecay(0.003) // Stabilisation plus lente pour une meilleure distribution 3D
        .velocityDecay(0.9) // Friction modérée pour un bon équilibre
        .force("charge", forceManyBody().strength(chargeStrength)) // Force de répulsion standard
        .force("center", forceCenter(0, 0, 0).strength(centerStrength)) // Force de centrage 
        .force(
          "collision",
          forceCollide().radius(nodeSize).strength(collisionStrength)
        ) // Collision standard
        .force(
          "link",
          forceLink(linksData).distance(linkDistance).strength(linkStrength)
        ); // Liens standard

      // Référence pour éviter que onGraphStabilized soit appelé plusieurs fois
      const onStabilizeCalledRef = { called: false };

      // Utiliser la simulation 3D native
      simulation.on("tick", () => {
        // Calculer le mouvement total pour détecter la stabilisation
        let totalMovement = 0;

        // La simulation 3D met automatiquement à jour les positions x, y, z
        nodesData.forEach(node => {
          // Limiter la vitesse maximale
          const maxVelocity = 5 * simulationSpeed;
          node.vx = Math.min(Math.max(node.vx || 0, -maxVelocity), maxVelocity);
          node.vy = Math.min(Math.max(node.vy || 0, -maxVelocity), maxVelocity);
          node.vz = Math.min(Math.max(node.vz || 0, -maxVelocity), maxVelocity);

          // Calculer le mouvement pour cette itération
          totalMovement += Math.abs(node.vx) + Math.abs(node.vy) + Math.abs(node.vz);
        });

        // Détecter la stabilisation basée sur le mouvement total
        if (totalMovement < 0.5 && !isStabilized.current) {
          console.log("[CYCLE DE VIE] Stabilisation naturelle du graphe (mouvement < 0.5)");
          isStabilized.current = true;
          setIsSimulationRunning(false);

          // N'appeler onGraphStabilized qu'une seule fois
          if (!onStabilizeCalledRef.called) {
            onGraphStabilized();
            onStabilizeCalledRef.called = true;
          }
        }
      });

      // Supprimer les forces standard qui seraient en conflit
      simulation.force("x", null);
      simulation.force("y", null);
      simulation.force("z", null);

      // Configurer le timer pour arrêter la simulation
      const stabilizeTimer = setTimeout(() => {
        if (!isStabilized.current) {
          simulation.stop();
          isStabilized.current = true;
          setIsSimulationRunning(false);

          // N'appeler onGraphStabilized qu'une seule fois
          if (!onStabilizeCalledRef.called) {
            // console.log(
            //   "Simulation stabilisée après cooldown, appel du callback"
            // );
            console.log("[CYCLE DE VIE] Stabilisation après cooldown");
            onGraphStabilized();
            onStabilizeCalledRef.called = true;
          }
        }
      }, cooldownTime);

      // Détecter aussi quand alpha devient très faible (stabilisation naturelle)
      simulation.on("tick", () => {
        if (simulation.alpha() < 0.001 && !isStabilized.current) {
          simulation.stop();
          isStabilized.current = true;
          setIsSimulationRunning(false);

          // N'appeler onGraphStabilized qu'une seule fois
          if (!onStabilizeCalledRef.called) {
            // console.log(
            //   "Simulation stabilisée naturellement, appel du callback"
            // );
            console.log("[CYCLE DE VIE] Stabilisation naturelle (alpha < 0.001)");
            onGraphStabilized();
            onStabilizeCalledRef.called = true;
          }
        }
      });

      // Nettoyer
      simulationRef.current = simulation;

      return () => {
        simulation.stop();
        clearTimeout(stabilizeTimer);
      };
    }, [nodesData, linksData, isLoadingGraph]); // Dépendances réduites au minimum pour éviter les redémarrages

    // Gérer le rendu et les mises à jour de la simulation
    useFrame(() => {
      if (!nodesRef.current || !linksRef.current) return;

      // Ajout d'un log pour surveiller les tick de simulation au début de la transition
      const isStartingTransition = initialRenderDoneRef.current && transitionFactorRef.current === 0;
      if (isStartingTransition && isSimulationRunning && simulationRef.current) {
        console.log("[CYCLE DE VIE] Premier tick de simulation après le début de la transition");
        
        // Vérifier si les positions des nœuds dans la simulation ne sont pas à l'origine
        let maxPositionValue = 0;
        nodesData.forEach(node => {
          const posValue = Math.max(Math.abs(node.x), Math.abs(node.y), Math.abs(node.z));
          maxPositionValue = Math.max(maxPositionValue, posValue);
        });
        
        if (maxPositionValue > 1) {
          console.log(`[CYCLE DE VIE] PROBLÈME DÉTECTÉ: Positions des nœuds déjà loin de l'origine (max: ${maxPositionValue.toFixed(2)})`);
        }
      }

      // Appliquer un tick de simulation si elle est en cours
      if (isSimulationRunning && simulationRef.current) {
        simulationRef.current.tick();
      }

      // Mise à jour du facteur de transition si la transition est en cours
      if (initialRenderDoneRef.current && transitionFactorRef.current < 1) {
        const elapsed = Date.now() - transitionStartTimeRef.current;
        const oldFactor = transitionFactorRef.current;
        transitionFactorRef.current = Math.min(elapsed / TRANSITION_DURATION, 1);
        
        // Détecter les changements significatifs dans le facteur de transition
        if (Math.floor(oldFactor * 10) !== Math.floor(transitionFactorRef.current * 10)) {
          console.log(`[CYCLE DE VIE] Transition à ${Math.floor(transitionFactorRef.current * 100)}%`);
        }
        
        // Détecter la fin de la transition
        if (oldFactor < 1 && transitionFactorRef.current === 1) {
          console.log("[CYCLE DE VIE] Transition terminée - Nœuds déployés à leurs positions finales");
        }
      }

      // Mettre à jour les positions des objets THREE.js pour les nœuds
      const nodeObjects = nodesRef.current.children;
      for (let i = 0; i < nodeObjects.length; i++) {
        const node = i < nodesData.length ? nodesData[i] : null;
        if (node && nodeObjects[i]) {
          if (!initialRenderDoneRef.current) {
            // Avant le début de la transition, tous les nœuds sont à l'origine
            nodeObjects[i].position.set(0, 0, 0);
          } else {
            // Pendant la transition, interpoler entre l'origine et la position calculée
            const factor = transitionFactorRef.current;
            
            // CORRECTION POUR ÉVITER LE SAUT: Forcer les positions à 0 au tout début de la transition
            const useRealPositions = factor > 0.01; // N'utiliser les vraies positions qu'après 1% de la transition
            
            const posX = useRealPositions ? node.x * factor : 0;
            const posY = useRealPositions ? node.y * factor : 0;
            const posZ = useRealPositions ? node.z * factor : 0;
            
            nodeObjects[i].position.set(posX, posY, posZ);
          }
        }
      }

      // Même correction pour les liens
      const linkObjects = linksRef.current.children;
      for (let i = 0; i < linkObjects.length; i++) {
        if (i >= linksData.length) continue;

        const link = linksData[i];
        const linkObject = linkObjects[i];
        if (!link || !linkObject) continue;

        const sourceNode = link.source;
        const targetNode = link.target;
        if (!sourceNode || !targetNode) continue;

        if (!initialRenderDoneRef.current) {
          updateSimpleLinkPosition(
            linkObject,
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 0)
          );
        } else {
          const factor = transitionFactorRef.current;
          // CORRECTION POUR ÉVITER LE SAUT: Forcer les positions à 0 au tout début de la transition
          const useRealPositions = factor > 0.01; // N'utiliser les vraies positions qu'après 1% de la transition
          
          updateSimpleLinkPosition(
            linkObject,
            new THREE.Vector3(
              useRealPositions ? sourceNode.x * factor : 0,
              useRealPositions ? sourceNode.y * factor : 0,
              useRealPositions ? sourceNode.z * factor : 0
            ),
            new THREE.Vector3(
              useRealPositions ? targetNode.x * factor : 0,
              useRealPositions ? targetNode.y * factor : 0,
              useRealPositions ? targetNode.z * factor : 0
            )
          );
        }
      }
    });

    // Fonction simplifiée pour créer un lien sans plans
    const createSimpleLinkObject = (link, source, target) => {
      // Création d'un groupe pour contenir le lien
      const group = new THREE.Group();

      // Initialiser la géométrie avec les positions
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array([
        source.x,
        source.y,
        source.z,
        target.x,
        target.y,
        target.z,
      ]);
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );

      // Déterminer la couleur du lien en fonction de son type
      let color = 0xaaaaaa; // Couleur par défaut
      if (
        link.type === "joshua-connection" ||
        link._relationType === "Joshua Identity" ||
        (link.value && link.value > 1.5)
      ) {
        color = 0xff5555; // Couleur rouge pour les liens spéciaux
      }

      // Créer une ligne simple
      const lineMaterial = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.8,
        linewidth: 1,
      });

      const line = new THREE.Line(geometry, lineMaterial);
      group.add(line);

      // Stocker les références pour les mises à jour
      group.userData = {
        line: line,
        positions: positions,
      };

      return group;
    };

    // Fonction simplifiée pour mettre à jour un lien
    const updateSimpleLinkPosition = (linkObject, source, target) => {
      try {
        // Vérifier la structure
        if (linkObject.userData && linkObject.userData.positions) {
          // Mettre à jour les positions
          const positions = linkObject.userData.positions;
          positions[0] = source.x;
          positions[1] = source.y;
          positions[2] = source.z;
          positions[3] = target.x;
          positions[4] = target.y;
          positions[5] = target.z;

          // Marquer pour mise à jour
          linkObject.userData.line.geometry.attributes.position.needsUpdate = true;
        }
      } catch (error) {
        // console.error("Erreur de mise à jour de lien:", error);
        console.log("[CYCLE DE VIE] Erreur lors de la mise à jour d'un lien", error.message);
      }
    };

    // Gérer les événements de survol
    const handleNodeHover = (event, node) => {
      event.stopPropagation();
      setHoverInfo({
        position: new THREE.Vector3(node.x, node.y, node.z),
        content: node.name || node.id,
      });
    };

    const handleNodeLeave = () => {
      setHoverInfo(null);
    };

    // Rendu du graphe
    return (
      <group>
        {/* Groupe pour les liens */}
        <group ref={linksRef}>
          {linksData.map((link, i) => {
            // Récupérer les nœuds source et cible directement
            const sourceNode = link.source;
            const targetNode = link.target;

            // Obtenir les positions des nœuds pour la création du lien
            // Au premier rendu, forcer les positions à 0,0,0 pour que les liens partent de l'origine
            const sourcePosition = sourceNode
              ? new THREE.Vector3(
                  !isSimulationRunning || isStabilized.current ? sourceNode.x || 0 : 0,
                  !isSimulationRunning || isStabilized.current ? sourceNode.y || 0 : 0,
                  !isSimulationRunning || isStabilized.current ? sourceNode.z || 0 : 0
                )
              : new THREE.Vector3(0, 0, 0);

            const targetPosition = targetNode
              ? new THREE.Vector3(
                  !isSimulationRunning || isStabilized.current ? targetNode.x || 0 : 0,
                  !isSimulationRunning || isStabilized.current ? targetNode.y || 0 : 0,
                  !isSimulationRunning || isStabilized.current ? targetNode.z || 0 : 0
                )
              : new THREE.Vector3(0, 0, 0);

            // Créer l'objet représentant le lien en utilisant notre fonction simplifiée
            const linkObj = createSimpleLinkObject(
              link,
              sourcePosition,
              targetPosition
            );

            return <primitive key={`link-${i}`} object={linkObj} />;
          })}
        </group>

        {/* Groupe pour les nœuds */}
        <group ref={nodesRef}>
          {nodesData.map((node, i) => {
            // Créer l'objet nœud en utilisant directement la fonction importée
            const nodeObj = createNodeObject(node);
            
            // Forcer la position initiale à l'origine (0,0,0)
            nodeObj.position.set(0, 0, 0);

            // Ajouter les métadonnées nécessaires au tracking
            nodeObj.userData = { ...nodeObj.userData, node, index: i };

            return (
              <primitive
                key={`node-${i}`}
                object={nodeObj}
                position={[0, 0, 0]}
                onPointerOver={(e) => handleNodeHover(e, node)}
                onPointerOut={handleNodeLeave}
              />
            );
          })}
        </group>

        {/* Tooltip pour les nœuds survolés */}
        {hoverInfo && (
          <Html position={hoverInfo.position} style={{ pointerEvents: "none" }}>
            <div
              style={{
                background: "rgba(0,0,0,0.8)",
                color: "white",
                padding: "5px 10px",
                borderRadius: "4px",
                fontSize: "12px",
                whiteSpace: "nowrap",
              }}
            >
              {hoverInfo.content}
            </div>
          </Html>
        )}
      </group>
    );
  }
);

export default CustomForceGraph;
