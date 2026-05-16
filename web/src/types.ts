export type Direction = 'idle' | 'up' | 'down';

export interface Elevator {
  id: number;
  currentFloor: number;
  direction: Direction;
  doorsOpen: boolean;
  queue: number[];
}

export interface Call {
  floor: number;
  direction: Direction;
}

export interface Stats {
  ticks: number;
  stopsServed: number;
  callsPlaced: number;
  callsServed: number;
}

export interface Snapshot {
  floors: number;
  elevators: Elevator[];
  calls: Call[];
  stats: Stats;
}

export interface Health {
  status: string;
  version: string;
}

export interface Config {
  floors: number;
  elevators: number;
}
