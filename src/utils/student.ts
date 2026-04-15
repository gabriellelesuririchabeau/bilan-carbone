import type {
  AutresState,
  DejeunerState,
  EquipementState,
  StudentCompletion,
  TransportTrip,
} from "../types/app.types";

export const EMPTY_STUDENT_COMPLETION: StudentCompletion = {
  transport: false,
  dejeuner: false,
  equipement: false,
  autres: false,
};

export function emptyTrips(): TransportTrip[] {
  return [{ mode: "", distanceKm: "", carType: "", carPassengers: "1" }];
}

export function emptyDejeuner(): DejeunerState {
  return {
    sandwich: "none",
    quiche_pizza: "none",
    frites_chips: "none",
    oeufs: "none",
    viande_rouge: "none",
    autre_viande: "none",
    poisson: "none",
    accompagnement: "none",
    plat_pates: "none",
    salade_composee: "none",
    fruit_local: "none",
    fruit_importe: "none",
    laitage: "none",
    dessert: "none",
    boissons: [],
  };
}

export function emptyEquipement(): EquipementState {
  return {
    used_equipment: [],
    emails_with_attachment: "",
    emails_without_attachment: "",
    social_prep_minutes: "",
    social_during_class_minutes: "",
    ai_prep_minutes: "",
    ai_during_class_minutes: "",
  };
}

export function emptyAutres(): AutresState {
  return {
    snacks: [],
    local_fruits: [],
    imported_fruits: [],
    hot_drinks: [],
  };
}
