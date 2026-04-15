export const studentGroups = Array.from({ length: 10 }, (_, i) => i + 1);

export const transportModes = [
  ["walk", "Marche à pied"],
  ["bus", "Bus"],
  ["rail", "Métro, tramway, train"],
  ["escooter", "Trottinette électrique"],
  ["bike", "Vélo"],
  ["ebike", "Vélo électrique"],
  ["motorbike", "2 roues thermique"],
  ["car", "Voiture"],
] as const;

export const carTypes = [
  ["electric", "Électrique"],
  ["hybrid", "Hybride"],
  ["diesel", "Diésel"],
  ["petrol", "Essence"],
] as const;

export const transportReportTemplate = [
  { rowKey: "walk", label: "Marche à pied", factor: 0 },
  { rowKey: "bus", label: "Bus", factor: 0.74 },
  { rowKey: "rail", label: "Métro, tramway, train", factor: 10 },
  { rowKey: "escooter", label: "Trottinette électrique", factor: 82.5 },
  { rowKey: "bike", label: "Vélo", factor: 0 },
  { rowKey: "ebike", label: "Vélo électrique", factor: 23 },
  { rowKey: "motorbike", label: "2 roues thermique", factor: 140 },
  { rowKey: "car_electric", label: "Voiture électrique", factor: 110 },
  { rowKey: "car_hybrid", label: "Voiture hybride", factor: 177 },
  { rowKey: "car_diesel", label: "Voiture diésel", factor: 262 },
  { rowKey: "car_petrol", label: "Voiture essence", factor: 275 },
] as const;
