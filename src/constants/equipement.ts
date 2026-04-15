export const equipementChoices = [
  ["laptop", "Ordinateur portable"],
  ["desktop", "Ordinateur de bureau"],
  ["tablet", "Tablette"],
  ["smartphone", "Smartphone"],
  ["stationery", "Papeterie"],
] as const;

export const minuteOptions = Array.from({ length: 17 }, (_, i) => ({
  value: String(i * 15),
  label: `${i * 15} min`,
}));
