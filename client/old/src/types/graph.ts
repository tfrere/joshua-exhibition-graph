export interface Node {
  id: string;
  name: string;
  slug: string;
  val: number;
  color?: string;
  type: "character" | "contact" | "source" | "post";
  platform?: string;
  date?: string;
  url?: string;
  isJoshua?: boolean;
}

export interface Link {
  source: string;
  target: string;
  type: string;
  value: number;
}
