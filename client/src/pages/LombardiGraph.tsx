import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { Pane } from "tweakpane";

interface Node {
  id: string;
  name: string;
  type: "character" | "contact";
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  level: number;
}

interface Link {
  source: string;
  target: string;
}

interface RawLink {
  character: string;
  contact: string;
}

const NODE_COLORS = {
  character: "rgba(50, 50, 50, 0.8)", // Noir avec légère transparence pour les characters
  contact: "rgba(50, 50, 50, 0.6)", // Noir plus transparent pour les contacts
} as const;

// Configuration des dimensions des nœuds et des flèches
const baseNodeSize = 55;
const sizeIncrement = 12;
const arrowHeadLength = 6;
const arrowHeadSize = 6;
const radiusIncrement = 100;

export function LombardiGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const paneRef = useRef<Pane | null>(null);
  const graphInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!svgRef.current || graphInitializedRef.current) return;
    graphInitializedRef.current = true;

    // Nettoyer le SVG existant
    d3.select(svgRef.current).selectAll("*").remove();

    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("background", "#F2EFDD"); // Fond beige

    // Charger les données
    fetch("/data/links.json")
      .then((res) => res.json())
      .then((rawLinks: RawLink[]) => {
        // Créer un Map pour stocker les nœuds uniques avec leur type principal
        const uniqueNodes = new Map<
          string,
          { name: string; type: "character" | "contact" }
        >();

        // Première passe : collecter tous les noms et déterminer leur type principal
        rawLinks.forEach((link) => {
          if (link.character) {
            uniqueNodes.set(link.character, {
              name: link.character,
              type: "character",
            });
          }
          if (link.contact && !uniqueNodes.has(link.contact)) {
            uniqueNodes.set(link.contact, {
              name: link.contact,
              type: "contact",
            });
          }
        });

        // Créer les nœuds
        const nodes: Node[] = Array.from(uniqueNodes.entries()).map(
          ([id, info]) => ({
            id: `node-${id}`,
            name: info.name,
            type: info.type,
            level: info.type === "character" ? 1 : 2,
          })
        );

        // Créer les liens en utilisant les IDs uniques
        const links: Link[] = rawLinks
          .filter((link) => link.character && link.contact)
          .map((link) => ({
            source: `node-${link.character}`,
            target: `node-${link.contact}`,
          }));

        console.log(`Nœuds uniques créés: ${nodes.length}`);
        console.log(`Liens créés: ${links.length}`);

        // Créer la simulation de force
        const simulation = d3
          .forceSimulation(nodes as any)
          .force(
            "link",
            d3
              .forceLink(links)
              .id((d: any) => d.id)
              .distance((d: any) => (d.source.level === 1 ? 300 : 200))
          )
          .force(
            "charge",
            d3
              .forceManyBody()
              .strength((d: any) => (d.level === 1 ? -2000 : -1000))
              .distanceMax(500)
          )
          .force(
            "collision",
            d3
              .forceCollide()
              .radius((d: any) => (baseNodeSize - d.level * sizeIncrement) * 2)
              .strength(0.9)
          )
          .force(
            "r",
            d3
              .forceRadial(
                (d: any) => (d.level === 1 ? 200 : 400),
                width / 2,
                height / 2
              )
              .strength(1)
          )
          .alpha(1)
          .alphaDecay(0.005)
          .velocityDecay(0.4)
          .alphaMin(0.001);

        // Chauffer le système
        for (let i = 0; i < 100; ++i) simulation.tick();

        // Dessiner les liens avec des courbes
        const link = svg
          .append("g")
          .selectAll("path")
          .data(links)
          .join("path")
          .attr("stroke", "rgba(50, 50, 50, 0.6)") // Noir avec transparence
          .attr("stroke-opacity", 0.3)
          .attr("stroke-width", 1)
          .attr("fill", "none");

        // Ajouter les flèches
        const arrow = svg
          .append("g")
          .selectAll("path")
          .data(links)
          .join("path")
          .attr(
            "d",
            `M0,-${arrowHeadSize / 2}L${arrowHeadSize},0L0,${arrowHeadSize / 2}`
          )
          .attr("stroke", "rgba(50, 50, 50, 0.6)") // Noir avec transparence
          .attr("stroke-opacity", 0.3)
          .attr("stroke-width", 1)
          .attr("fill", "none");

        // Dessiner les nœuds
        const node = svg
          .append("g")
          .selectAll("circle")
          .data(nodes)
          .join("circle")
          .attr("r", (d) => baseNodeSize - d.level * sizeIncrement)
          .attr("fill", "rgba(0, 0, 0, 0.0)")
          .attr("stroke", (d) => NODE_COLORS[d.type])
          .attr("stroke-width", 1)
          .call(drag(simulation) as any);

        // Ajouter les labels avec gestion du texte multiligne
        const text = svg
          .append("g")
          .selectAll("text")
          .data(nodes)
          .join("text")
          .style("font-family", "Arial, sans-serif")
          .style("font-size", "10px")
          .style("fill", "#333") // Texte en gris foncé
          .style("user-select", "none")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .each(function (d: Node) {
            const maxLength = (baseNodeSize - d.level * sizeIncrement - 16) * 2;
            const lines = splitText(d.name, maxLength);
            const lineHeight = 12;
            const totalHeight = (lines.length - 1) * lineHeight;
            const textElement = d3.select(this);

            lines.forEach((line, i) => {
              textElement
                .append("tspan")
                .attr("x", 0)
                .attr("dy", `${i === 0 ? -totalHeight / 2 : lineHeight}px`)
                .text(line);
            });
          });

        // Mettre à jour les positions à chaque tick
        simulation.on("tick", () => {
          link.attr("d", (d: any) => {
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const dr = Math.sqrt(dx * dx + dy * dy);

            const sourceSize = baseNodeSize - d.source.level * sizeIncrement;
            const targetSize = baseNodeSize - d.target.level * sizeIncrement;

            const angle = Math.atan2(dy, dx);
            const sourceOffsetAngle = -Math.PI / 8;
            const targetOffsetAngle = Math.PI / 8;

            const sx =
              d.source.x + Math.cos(angle + sourceOffsetAngle) * sourceSize;
            const sy =
              d.source.y + Math.sin(angle + sourceOffsetAngle) * sourceSize;
            const tx =
              d.target.x - Math.cos(angle + targetOffsetAngle) * targetSize;
            const ty =
              d.target.y - Math.sin(angle + targetOffsetAngle) * targetSize;

            return `M${sx},${sy}A${dr},${dr} 0 0,1 ${tx},${ty}`;
          });

          arrow.attr("transform", (d: any) => {
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const angle = Math.atan2(dy, dx);
            const targetOffsetAngle = Math.PI / 8;
            const targetSize = baseNodeSize - d.target.level * sizeIncrement;

            const tx =
              d.target.x -
              Math.cos(angle + targetOffsetAngle) *
                (targetSize + arrowHeadLength);
            const ty =
              d.target.y -
              Math.sin(angle + targetOffsetAngle) *
                (targetSize + arrowHeadLength);

            return `translate(${tx},${ty}) rotate(${
              ((angle + targetOffsetAngle) * 180) / Math.PI
            })`;
          });

          node
            .attr(
              "cx",
              (d: any) => (d.x = Math.max(50, Math.min(width - 50, d.x)))
            )
            .attr(
              "cy",
              (d: any) => (d.y = Math.max(50, Math.min(height - 50, d.y)))
            );

          text.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
        });

        // Initialiser Tweakpane
        if (!paneRef.current) {
          paneRef.current = new Pane();
          paneRef.current
            .addButton({ title: "Télécharger SVG" })
            .on("click", () => {
              const serializer = new XMLSerializer();
              const source = serializer.serializeToString(svgRef.current!);
              const blob = new Blob([source], {
                type: "image/svg+xml;charset=utf-8",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "graph.svg";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            });
        }
      });
  }, []);

  // Fonction pour gérer le drag & drop des nœuds
  const drag = (simulation: d3.Simulation<any, undefined>) => {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3
      .drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  };

  // Fonction pour diviser le texte en plusieurs lignes
  function splitText(text: string, maxLength: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      if (currentLine.length + word.length + 1 <= maxLength) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <svg ref={svgRef} />
    </div>
  );
}
