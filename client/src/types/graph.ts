export interface Node {
  id: string;
  name: string;
  val: number;
  color?: string;
  type: "character" | "contact" | "source";
  isJoshua?: boolean;
  thematic?: string;
  career?: string;
  genre?: string;
  polarisation?: string;
  sources?: string[];
}

export interface Link {
  source: string;
  target: string;
  isDirect: string;
  relationType: string;
  mediaImpact: string;
  virality: string;
  mediaCoverage: string;
  linkType: string;
}
