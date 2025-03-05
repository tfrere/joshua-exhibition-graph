export interface Coordinates {
  x: number;
  y: number;
  z: number;
}

export interface CoordinateTypes {
  origin: Coordinates;
  originUp: Coordinates;
  exploded: Coordinates;
  spiral: Coordinates;
  sphere: Coordinates;
  calendar: Coordinates;
  calendarStaged: Coordinates;
  tree: Coordinates;
  treeDiffuse: Coordinates;
  charactersExploded: Coordinates;
  charactersSpheres: Coordinates;
}

export type CoordinateType = keyof CoordinateTypes; 