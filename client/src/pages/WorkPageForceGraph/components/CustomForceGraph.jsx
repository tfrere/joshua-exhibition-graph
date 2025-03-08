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
      cooldownTime = 15000, // Temps après lequel la simulation se stabilise (ms)
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

    // Préparer les données adaptées à d3-force - cette partie n'est exécutée que lorsque graphData change
    const { nodesData, linksData } = useMemo(() => {
      if (!graphData || !graphData.nodes || !graphData.links) {
        return { nodesData: [], linksData: [] };
      }

      // Fonction déterministe pour générer des positions initiales basées sur l'ID du nœud
      // Cette fonction produira toujours la même valeur pour le même ID
      const getPositionFromId = (id, index, axis) => {
        // Convertir l'ID en chaîne de caractères pour le hachage
        const idString = String(id || `generated_${index}`);
        
        // On utilise une approche simple de hachage pour générer un nombre entre 0 et 1
        // basé sur différentes parties de l'ID pour chaque axe
        let hash = 0;
        // On utilise des multiplieurs différents pour chaque axe pour éviter les alignements
        const multiplier = axis === 'x' ? 1 : axis === 'y' ? 2 : 3;
        
        for (let i = 0; i < idString.length; i++) {
          const char = idString.charCodeAt(i);
          // On utilise un algorithme de hachage simple
          hash = ((hash << 5) - hash + char * multiplier) | 0;
        }
        
        // Normaliser entre -1 et 1
        const normalized = (hash % 1000) / 500 - 1;
        // Étendre à la plage -100 à 100
        return normalized * 100;
      };

      // Copier les données pour ne pas modifier les originales et assurer que chaque nœud a un ID
      const nodesData = graphData.nodes.map((node, index) => {
        // S'assurer que chaque nœud a un ID unique (utilisé pour les liens)
        const nodeId = node.id || `generated_${index}`;
        
        return {
          ...node,
          // Assurer qu'il y a toujours un ID
          id: nodeId,
          // Utiliser notre fonction déterministe pour les positions initiales
          x: getPositionFromId(nodeId, index, 'x'),
          y: getPositionFromId(nodeId, index, 'y'),
          z: getPositionFromId(nodeId, index, 'z'),
          // Stocker les positions originales si elles existaient
          originalX: node.x,
          originalY: node.y,
          originalZ: node.z,
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

      console.log(
        `Graphe préparé avec ${nodesData.length} nœuds et ${linksData.length} liens`
      );
      return { nodesData, linksData };
    }, [graphData]);

    // Exposer les méthodes et données via la ref
    useImperativeHandle(ref, () => ({
      // Récupérer les positions actuelles des nœuds
      getNodesPositions: () => {
        return nodesData.map((node) => ({
          id: node.id,
          slug: node.slug,
          x: node.x,
          y: node.y,
          z: node.z,
          isJoshua: node.isJoshua,
          type: node.type,
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
          console.log("Simulation stabilisée manuellement");
        }
      },
    }));

    // Configurer la simulation - séparer en deux effets pour éviter les redémarrages multiples
    useEffect(() => {
      if (isLoadingGraph || nodesData.length === 0) return;

      console.log("Initialisation de la simulation 3D");

      // Réinitialiser le statut de stabilisation
      isStabilized.current = false;
      setIsSimulationRunning(true);

      // Créer une nouvelle simulation
      const simulation = forceSimulation(nodesData)
        .alphaDecay(0.006) // Stabilisation plus lente pour une meilleure distribution 3D
        .velocityDecay(0.3) // Friction réduite pour permettre plus de mouvement
        .force("charge", forceManyBody().strength(chargeStrength)) // Force de répulsion standard
        .force("center", forceCenter().strength(centerStrength * 0.5)) // Force de centrage réduite pour permettre plus d'étalement
        .force(
          "collision",
          forceCollide().radius(nodeSize).strength(collisionStrength)
        ) // Collision standard
        .force(
          "link",
          forceLink(linksData).distance(linkDistance).strength(linkStrength)
        );

      // Référence pour éviter que onGraphStabilized soit appelé plusieurs fois
      const onStabilizeCalledRef = { called: false };

      // Utiliser la simulation 3D native
      simulation.on("tick", () => {
        // Calculer le mouvement total pour détecter la stabilisation
        let totalMovement = 0;

        // La simulation 3D met automatiquement à jour les positions x, y, z
        // Nous n'avons plus besoin de calculer manuellement les forces 3D
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
          console.log("Graphe stabilisé naturellement (mouvement < 0.5)");
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
            console.log(
              "Simulation stabilisée après cooldown, appel du callback"
            );
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
            console.log(
              "Simulation stabilisée naturellement, appel du callback"
            );
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

    // Mise à jour des paramètres sans redémarrer la simulation
    useEffect(() => {
      const simulation = simulationRef.current;
      if (!simulation || isLoadingGraph || isStabilized.current) return;

      // Mettre à jour les forces sans redémarrer la simulation
      if (simulation.force("charge")) {
        simulation.force("charge").strength(chargeStrength);
      }
      if (simulation.force("center")) {
        simulation.force("center").strength(centerStrength * 0.5);
      }
      if (simulation.force("collision")) {
        simulation
          .force("collision")
          .radius(nodeSize)
          .strength(collisionStrength);
      }
      if (simulation.force("link")) {
        simulation.force("link").distance(linkDistance).strength(linkStrength);
      }

      // Réveiller légèrement la simulation si elle s'est trop ralentie
      if (simulation.alpha() < 0.1) {
        simulation.alpha(0.1);
      }
    }, [
      chargeStrength,
      centerStrength,
      nodeSize,
      collisionStrength,
      linkDistance,
      linkStrength,
      isLoadingGraph,
    ]);

    // Gérer le rendu et les mises à jour de la simulation
    useFrame(() => {
      if (!nodesRef.current || !linksRef.current) return;

      // Appliquer un tick de simulation si elle est en cours
      if (isSimulationRunning && simulationRef.current) {
        simulationRef.current.tick();
      }

      // Mettre à jour les positions des objets THREE.js pour les nœuds
      const nodeObjects = nodesRef.current.children;
      for (let i = 0; i < nodeObjects.length; i++) {
        const node = i < nodesData.length ? nodesData[i] : null;
        if (node && nodeObjects[i]) {
          // Mettre à jour la position visuelle du nœud
          nodeObjects[i].position.set(node.x, node.y, node.z);
        }
      }

      // Mettre à jour les positions des liens - PARTIE CRITIQUE
      const linkObjects = linksRef.current.children;

      // Pour chaque lien, recalculer sa position et son orientation
      for (let i = 0; i < linkObjects.length; i++) {
        if (i >= linksData.length) continue; // Sécurité pour éviter les erreurs d'index

        const link = linksData[i];
        const linkObject = linkObjects[i];

        // Vérifier que le lien et l'objet existent
        if (!link || !linkObject) continue;

        // Dans notre nouvelle structure, source et target sont déjà des objets nœuds complets
        const sourceNode = link.source;
        const targetNode = link.target;

        // Vérifier que les nœuds existent et ont des positions
        if (!sourceNode || !targetNode) continue;

        // Mettre à jour la position du lien avec les coordonnées actuelles des nœuds
        updateSimpleLinkPosition(
          linkObject,
          new THREE.Vector3(
            sourceNode.x || 0,
            sourceNode.y || 0,
            sourceNode.z || 0
          ),
          new THREE.Vector3(
            targetNode.x || 0,
            targetNode.y || 0,
            targetNode.z || 0
          )
        );
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
        console.error("Erreur de mise à jour de lien:", error);
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
            const sourcePosition = sourceNode
              ? new THREE.Vector3(
                  sourceNode.x || 0,
                  sourceNode.y || 0,
                  sourceNode.z || 0
                )
              : new THREE.Vector3(0, 0, 0);

            const targetPosition = targetNode
              ? new THREE.Vector3(
                  targetNode.x || 0,
                  targetNode.y || 0,
                  targetNode.z || 0
                )
              : new THREE.Vector3(0, 10, 0);

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

            // Ajouter les métadonnées nécessaires au tracking
            nodeObj.userData = { ...nodeObj.userData, node, index: i };

            return (
              <primitive
                key={`node-${i}`}
                object={nodeObj}
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
