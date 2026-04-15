export type TransportMode =
  | "walk"
  | "bike"
  | "bus"
  | "tram_metro"
  | "train"
  | "car"
  | "motorbike";

export type MealType =
  | "vegetarian"
  | "chicken"
  | "beef"
  | "fish"
  | "vegan";

export type EquipmentType =
  | "none"
  | "laptop"
  | "desktop"
  | "projector"
  | "screen";

export interface TransportResponse {
  mode: TransportMode;
  distanceKm: number;
  passengers?: number;
  roundTrip?: boolean;
}

export interface DejeunerResponse {
  mealType: MealType;
}

export interface EquipementResponse {
  items: EquipmentType[];
}

export interface AutresResponse {
  paperSheets?: number;
  plasticBottles?: number;
}

export const EMISSION_FACTORS = {
  transportKgCo2ePerKm: {
    walk: 0,
    bike: 0,
    bus: 0.103,
    tram_metro: 0.03,
    train: 0.014,
    car: 0.192,
    motorbike: 0.103,
  } as Record<TransportMode, number>,

  mealKgCo2e: {
    vegan: 0.5,
    vegetarian: 0.8,
    chicken: 1.6,
    fish: 2.0,
    beef: 7.0,
  } as Record<MealType, number>,

  equipmentKgCo2ePerUse: {
    none: 0,
    laptop: 0.05,
    desktop: 0.09,
    projector: 0.12,
    screen: 0.04,
  } as Record<EquipmentType, number>,

  others: {
    paperSheet: 0.005,
    plasticBottle: 0.08,
  },
};
export function calculateTransportCarbon(data: TransportResponse): number {
  const factor = EMISSION_FACTORS.transportKgCo2ePerKm[data.mode] ?? 0;
  const multiplier = data.roundTrip ? 2 : 1;
  const totalDistance = (data.distanceKm || 0) * multiplier;

  if (data.mode === "car") {
    const passengers = Math.max(1, data.passengers || 1);
    return (totalDistance * factor) / passengers;
  }

  return totalDistance * factor;
}