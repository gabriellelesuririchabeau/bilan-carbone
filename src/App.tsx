import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import kedgeLogo from "./assets/KEDGE_BS_blanc.png";
import homeIllustration from "./assets/home-illustration.png";

import type {
  Screen,
  TeacherMenu,
  TeacherSessionTab,
  TeacherAnalysesTab,
  StudentAnalysesTab,
  SessionRow,
  TransportTrip,
  DejeunerState,
  EquipementState,
  AutresState,
  ResponseCounts,
  GroupReportRow,
  ReportableRow,
  StudentCompletion,
  QuestionnaireKey,
  StudentDraft,
  TeacherDraft,
  AdminTab,
  GroupProposalRow,
  GroupProposalState,
  ConsolidatedProposalRow,
} from "./types/app.types";

import { studentGroups, transportModes, carTypes } from "./constants/transport";
import {
  sandwichOptions,
  quichePizzaOptions,
  fritesChipsOptions,
  oeufsOptions,
  viandeRougeOptions,
  autreViandeOptions,
  poissonOptions,
  accompagnementOptions,
  platPatesOptions,
  saladeComposeeOptions,
  fruitLocalOptions,
  fruitImporteOptions,
  laitageOptions,
  dessertOptions,
  boissonOptions,
} from "./constants/dejeuner";
import { equipementChoices, minuteOptions } from "./constants/equipement";
import {
  snackOptions,
  localFruitSnackOptions,
  importedFruitSnackOptions,
  hotDrinkOptions,
} from "./constants/autres";
import { normalizeEmail, getStudentDraftKey, getTeacherDraftKey } from "./utils/storage";
import { supabase } from "./lib/supabase";
import {
  EMPTY_STUDENT_COMPLETION,
  emptyTrips,
  emptyDejeuner,
  emptyEquipement,
  emptyAutres,
} from "./utils/student";
import { EMPTY_COUNTS, buildTransportRowsForGroup } from "./utils/teacher";

type TransportReportableRowRpc = {
  row_key: string | null;
  label: string | null;
  persons: number | null;
  quantity: number | null;
};

type DejeunerReportableRowRpc = {
  category: string | null;
  label: string | null;
  quantity: number | null;
};

type DejeunerAnalysisRow = {
  rowKey: string;
  category: string;
  label: string;
  factor: number;
  quantity: number;
};
type EquipementReportableRowRpc = {
  category: string | null;
  row_key: string | null;
  label: string | null;
  quantity: number | null;
};

type EquipementAnalysisRow = {
  rowKey: string;
  category: string;
  label: string;
  factor: number;
  quantity: number;
};

type AutresReportableRowRpc = {
  category: string | null;
  row_key: string | null;
  label: string | null;
  quantity: number | null;
};

type AutresAnalysisRow = {
  rowKey: string;
  category: string;
  label: string;
  factor: number;
  quantity: number;
};

type SalleAnalysisRow = {
  rowKey: string;
  label: string;
  factor: number;
  quantity: number;
};

type ConsolidatedProposalOption = {
  id: string;
  text: string;
  theme: string;
  sourceGroupNumbers: number[];
};

type TeacherVoteRow = {
  proposal_id: string;
  rank: number;
  student_email?: string | null;
};

type TeacherVoteResult = {
  proposalId: string;
  text: string;
  score: number;
  totalVotes: number;
  rank1Count: number;
  rank2Count: number;
  rank3Count: number;
};

type AssignmentMode = "emails" | "groups";
type AssignmentMethod = "import" | "random";

type StudentAssignmentDraft = {
  email: string;
  first_name: string;
  last_name: string;
  group_number: number;
};

const DEJEUNER_ANALYSIS_ROWS: DejeunerAnalysisRow[] = [
{ rowKey: "kebab", category: "Sandwich", label: "Kebab", factor: 3570, quantity: 0 },
{ rowKey: "hamburger", category: "Sandwich", label: "Hamburger", factor: 4375, quantity: 0 },
{ rowKey: "sandwich_jambon_beurre", category: "Sandwich", label: "Sandwich Jambon-beurre", factor: 1455, quantity: 0 },
{ rowKey: "sandwich_fromage", category: "Sandwich", label: "Sandwich Fromage", factor: 1428, quantity: 0 },
{ rowKey: "sandwich_thon_crudites", category: "Sandwich", label: "Sandwich Poisson crudités", factor: 750, quantity: 0 },
{ rowKey: "sandwich_crudites", category: "Sandwich", label: "Sandwich Crudités", factor: 693, quantity: 0 },
{ rowKey: "panini", category: "Sandwich", label: "Panini", factor: 1100, quantity: 0 },
{ rowKey: "quiche", category: "Quiche/Pizza", label: "Quiche", factor: 856, quantity: 0 },
{ rowKey: "pizza", category: "Quiche/Pizza", label: "Pizza", factor: 616, quantity: 0 },

{ rowKey: "spaghetti_bolognaise", category: "Plat de pâtes", label: "Spaghetti bolognaise", factor: 1659, quantity: 0 },
{ rowKey: "lasagnes", category: "Plat de pâtes", label: "Lasagnes", factor: 1542, quantity: 0 },
{ rowKey: "tagliatelles_carbonara", category: "Plat de pâtes", label: "Tagliatelles carbonara", factor: 825, quantity: 0 },

{ rowKey: "salade_pommes_de_terre", category: "Salade composée", label: "Salade de pommes de terre", factor: 1123, quantity: 0 },
{ rowKey: "salade_nicoise", category: "Salade composée", label: "Salade niçoise", factor: 1080, quantity: 0 },
{ rowKey: "salade_thon_crudites", category: "Salade composée", label: "Salade Thon crudités", factor: 1285, quantity: 0 },
{ rowKey: "salade_riz", category: "Salade composée", label: "Salade de riz", factor: 365, quantity: 0 },
{ rowKey: "salade_pates", category: "Salade composée", label: "Salade de pâtes", factor: 530, quantity: 0 },

  { rowKey: "boeuf", category: "Protéines", label: "Bœuf", factor: 3530, quantity: 0 },
  { rowKey: "agneau", category: "Protéines", label: "Agneau", factor: 5220, quantity: 0 },
  { rowKey: "porc", category: "Protéines", label: "Porc", factor: 1330, quantity: 0 },
  { rowKey: "poulet", category: "Protéines", label: "Volaille", factor: 933, quantity: 0 },
  { rowKey: "poisson", category: "Protéines", label: "Poisson", factor: 1193, quantity: 0 },
  { rowKey: "oeufs_omelette", category: "Protéines", label: "Œufs (omelette)", factor: 680, quantity: 0 },

  { rowKey: "frites_chips", category: "Accompagnements", label: "Frites / chips", factor: 393, quantity: 0 },
  { rowKey: "legumes", category: "Accompagnements", label: "Légumes", factor: 103, quantity: 0 },
  { rowKey: "salade", category: "Accompagnements", label: "Salade", factor: 100, quantity: 0 },
  { rowKey: "pates", category: "Accompagnements", label: "Pâtes", factor: 263, quantity: 0 },
  { rowKey: "riz", category: "Accompagnements", label: "Riz", factor: 330, quantity: 0 },

  { rowKey: "eau_robinet", category: "Boissons", label: "Eau du robinet", factor: 0, quantity: 0 },
  { rowKey: "eau_bouteille", category: "Boissons", label: "Eau bouteille", factor: 183.25, quantity: 0 },
  { rowKey: "soda", category: "Boissons", label: "Soda", factor: 326, quantity: 0 },
  { rowKey: "cafe", category: "Boissons", label: "Café", factor: 80, quantity: 0 },
  { rowKey: "the", category: "Boissons", label: "Thé", factor: 20, quantity: 0 },
  { rowKey: "chocolat_lait_boisson", category: "Boissons", label: "Chocolat au lait (boisson)", factor: 250, quantity: 0 },

  { rowKey: "laitage", category: "Desserts", label: "Laitage", factor: 360, quantity: 0 },
  { rowKey: "glace", category: "Desserts", label: "Glace", factor: 88, quantity: 0 },
  { rowKey: "patisserie", category: "Desserts", label: "Pâtisserie", factor: 300, quantity: 0 },

  { rowKey: "pomme", category: "Fruits", label: "Pomme", factor: 43, quantity: 0 },
  { rowKey: "raisin", category: "Fruits", label: "Raisin", factor: 69, quantity: 0 },
  { rowKey: "poire", category: "Fruits", label: "Poire", factor: 44, quantity: 0 },
  { rowKey: "banane", category: "Fruits", label: "Banane", factor: 88, quantity: 0 },
  { rowKey: "ananas", category: "Fruits", label: "Ananas", factor: 130, quantity: 0 },
  { rowKey: "mangue", category: "Fruits", label: "Mangue", factor: 570, quantity: 0 },
];
const EQUIPEMENT_ANALYSIS_ROWS: EquipementAnalysisRow[] = [
  { rowKey: "laptop", category: "Matériel", label: "Ordinateur portable", factor: 247, quantity: 0 },
  { rowKey: "desktop", category: "Matériel", label: "Ordinateur de bureau", factor: 171, quantity: 0 },
  { rowKey: "laptop_desktop_tablet", category: "Matériel", label: "Ordinateur portable et ordinateur de bureau et/ou tablette", factor: 181, quantity: 0 },
  { rowKey: "tablet", category: "Matériel", label: "Tablette", factor: 0.05, quantity: 0 },
  { rowKey: "smartphone", category: "Matériel", label: "Smartphone", factor: 0.08, quantity: 0 },
  { rowKey: "stationery", category: "Matériel", label: "Papeterie", factor: 22.9, quantity: 0 },
  { rowKey: "emails_without_attachment", category: "Activité", label: "Nombre d'emails envoyés sans pièce jointe", factor: 4, quantity: 0 },
  { rowKey: "emails_with_attachment", category: "Activité", label: "Nombre d'emails envoyés avec pièce jointe", factor: 11, quantity: 0 },
  { rowKey: "social_minutes", category: "Activité", label: "Réseaux sociaux", factor: 1.1, quantity: 0 },
  { rowKey: "ai_minutes", category: "Activité", label: "IA", factor: 5, quantity: 0 },
];

const AUTRES_ANALYSIS_ROWS: AutresAnalysisRow[] = [
  { rowKey: "eau_robinet", category: "Boissons", label: "Eau du robinet", factor: 0, quantity: 0 },
  { rowKey: "eau_bouteille", category: "Boissons", label: "Eau bouteille", factor: 183.25, quantity: 0 },
  { rowKey: "soda", category: "Boissons", label: "Soda", factor: 326, quantity: 0 },
  { rowKey: "coffee", category: "Boissons", label: "Café", factor: 80, quantity: 0 },
  { rowKey: "tea", category: "Boissons", label: "Thé", factor: 20, quantity: 0 },
  { rowKey: "milk_chocolate", category: "Boissons", label: "Chocolat au lait", factor: 250, quantity: 0 },

  { rowKey: "chocolate_bar", category: "Grignotage", label: "Barres chocolatées", factor: 300, quantity: 0 },
  { rowKey: "viennoiserie", category: "Grignotage", label: "Viennoiseries", factor: 70, quantity: 0 },
  { rowKey: "biscuits", category: "Grignotage", label: "Biscuits", factor: 400, quantity: 0 },
  { rowKey: "bonbons", category: "Grignotage", label: "Bonbons", factor: 360, quantity: 0 },
  { rowKey: "chips", category: "Grignotage", label: "Chips", factor: 393, quantity: 0 },

  { rowKey: "apple", category: "Fruits locaux", label: "Pomme", factor: 43, quantity: 0 },
  { rowKey: "grapes", category: "Fruits locaux", label: "Raisin", factor: 69, quantity: 0 },
  { rowKey: "pear", category: "Fruits locaux", label: "Poire", factor: 44, quantity: 0 },

  { rowKey: "banana", category: "Fruits importés", label: "Banane", factor: 88, quantity: 0 },
  { rowKey: "pineapple", category: "Fruits importés", label: "Ananas", factor: 130, quantity: 0 },
  { rowKey: "mango", category: "Fruits importés", label: "Mangue", factor: 570, quantity: 0 },
];

const SALLE_ANALYSIS_ROWS: SalleAnalysisRow[] = [
  { rowKey: "ampoules", label: "Ampoules", factor: 0.004, quantity: 0 },
  { rowKey: "chauffage", label: "Chauffage", factor: 546, quantity: 0 },
  { rowKey: "climatisation", label: "Climatisation", factor: 250, quantity: 0 },
  { rowKey: "videoprojecteur", label: "Vidéoprojecteur", factor: 26, quantity: 0 },
  { rowKey: "ecran_fixe", label: "Écran fixe", factor: 137, quantity: 0 },
];

const TRANSPORT_LABELS_FR: Record<string, string> = {
  walking: "Marche à pied",
  walk: "Marche à pied",
  marche: "Marche à pied",
  marche_a_pied: "Marche à pied",
  bus: "Bus",
  metro_tram_train: "Métro, tramway, train",
  metro_tramway_train: "Métro, tramway, train",
  metro: "Métro, tramway, train",
  train: "Métro, tramway, train",
  electric_scooter: "Trottinette électrique",
  trottinette_electrique: "Trottinette électrique",
  bike: "Vélo",
  velo: "Vélo",
  electric_bike: "Vélo électrique",
  velo_electrique: "Vélo électrique",
  motorcycle: "2 roues thermique",
  deux_roues_thermique: "2 roues thermique",
  electric_car: "Voiture électrique",
  voiture_electrique: "Voiture électrique",
  hybrid_car: "Voiture hybride",
  voiture_hybride: "Voiture hybride",
  diesel_car: "Voiture diesel",
  voiture_diesel: "Voiture diesel",
  gasoline_car: "Voiture essence",
  essence_car: "Voiture essence",
  voiture_essence: "Voiture essence",
};

function getTransportLabelFr(rowKey: string | null | undefined, fallbackLabel: string | null | undefined) {
  const key = String(rowKey ?? "").trim();
  return TRANSPORT_LABELS_FR[key] ?? String(fallbackLabel ?? key);
}

function normalizeTransportResponseRowKey(mode: string | null | undefined, carType: string | null | undefined) {
  const cleanMode = String(mode ?? "").trim();
  const cleanCarType = String(carType ?? "").trim();

  if (cleanMode === "car") {
    if (["electric_car", "voiture_electrique", "electric"].includes(cleanCarType)) return "electric_car";
    if (["hybrid_car", "voiture_hybride", "hybrid"].includes(cleanCarType)) return "hybrid_car";
    if (["diesel_car", "voiture_diesel", "diesel"].includes(cleanCarType)) return "diesel_car";
    if (["gasoline_car", "essence_car", "voiture_essence", "gasoline", "essence"].includes(cleanCarType)) return "gasoline_car";
    return cleanCarType || "car";
  }

  if (["walk", "marche", "marche_a_pied"].includes(cleanMode)) return "walking";
  if (["metro", "train", "metro_tramway_train"].includes(cleanMode)) return "metro_tram_train";
  if (["trottinette_electrique"].includes(cleanMode)) return "electric_scooter";
  if (["velo"].includes(cleanMode)) return "bike";
  if (["velo_electrique"].includes(cleanMode)) return "electric_bike";
  if (["deux_roues_thermique"].includes(cleanMode)) return "motorcycle";

  return cleanMode;
}

function getTransportFallbackLabel(rowKey: string) {
  const modeEntry = transportModes.find(([value]) => normalizeTransportResponseRowKey(value, null) === rowKey);
  if (modeEntry) return modeEntry[1];

  const carEntry = carTypes.find(([value]) => normalizeTransportResponseRowKey("car", value) === rowKey);
  if (carEntry) return carEntry[1];

  return getTransportLabelFr(rowKey, rowKey);
}

const AUTRES_CATEGORY_ORDER = ["Boissons", "Grignotage", "Fruits locaux", "Fruits importés"];
const AUTRES_ROW_ORDER: Record<string, number> = {
  eau_robinet: 0,
  eau_bouteille: 1,
  soda: 2,
  coffee: 3,
  cafe: 3,
  "café": 3,
  tea: 4,
  the: 4,
  "thé": 4,
  milk_chocolate: 5,
  hot_chocolate: 5,
  chocolat_chaud: 5,
  chocolat_lait: 5,

  chocolate_bar: 6,
  chocolat_bar: 6,
  barre_chocolatee: 6,
  viennoiserie: 7,
  viennoiseries: 7,
  biscuits: 8,
  bonbons: 9,
  chips: 10,

  apple: 11,
  pomme: 11,
  grapes: 12,
  raisin: 12,
  pear: 13,
  poire: 13,

  banana: 14,
  banane: 14,
  pineapple: 15,
  ananas: 15,
  mango: 16,
  mangue: 16,
};

function orderAutresAnalysisRows(rows: AutresAnalysisRow[]): AutresAnalysisRow[] {
  return [...rows].sort((a, b) => {
    const ia = AUTRES_CATEGORY_ORDER.indexOf(a.category);
    const ib = AUTRES_CATEGORY_ORDER.indexOf(b.category);
    if (ia !== ib) return ia - ib;
    const ka = AUTRES_ROW_ORDER[a.rowKey] ?? 999;
    const kb = AUTRES_ROW_ORDER[b.rowKey] ?? 999;
    if (ka !== kb) return ka - kb;
    return a.label.localeCompare(b.label);
  });
}

function compareAutresReportableRows(
  a: { category: string | null; row_key?: string | null; label: string | null },
  b: { category: string | null; row_key?: string | null; label: string | null }
) {
  const ca = String(a.category ?? "");
  const cb = String(b.category ?? "");
  const ia = AUTRES_CATEGORY_ORDER.indexOf(ca);
  const ib = AUTRES_CATEGORY_ORDER.indexOf(cb);
  if (ia !== ib) return ia - ib;
  const ka = AUTRES_ROW_ORDER[String(a.row_key ?? "")] ?? 999;
  const kb = AUTRES_ROW_ORDER[String(b.row_key ?? "")] ?? 999;
  if (ka !== kb) return ka - kb;
  return String(a.label ?? "").localeCompare(String(b.label ?? ""));
}



function buildDejeunerRowsForGroup(rowsDb: GroupReportRow[], groupNumber: number): DejeunerAnalysisRow[] {
  return DEJEUNER_ANALYSIS_ROWS.map((baseRow) => {
    const dbRow = rowsDb.find(
      (row) =>
        row.group_number === groupNumber &&
        row.theme === "dejeuner" &&
        row.row_key === baseRow.rowKey
    );

    return {
      ...baseRow,
      quantity: Number(dbRow?.quantity ?? 0),
      factor: Number(dbRow?.factor ?? baseRow.factor),
    };
  });
}
function buildEquipementRowsForGroup(
  rowsDb: GroupReportRow[],
  groupNumber: number
): EquipementAnalysisRow[] {
  return EQUIPEMENT_ANALYSIS_ROWS.map((baseRow) => {
    const candidateKeys = [baseRow.rowKey];
    if (baseRow.rowKey === "social_minutes") candidateKeys.push("social_prep_minutes", "social_during_class_minutes");
    if (baseRow.rowKey === "ai_minutes") candidateKeys.push("ai_prep_minutes", "ai_during_class_minutes");

    const matchedRows = rowsDb.filter(
      (row) =>
        row.group_number === groupNumber &&
        row.theme === "equipement" &&
        candidateKeys.includes(String(row.row_key))
    );

    const dbRow = matchedRows[0];

    return {
      ...baseRow,
      quantity: matchedRows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0),
      factor: Number(dbRow?.factor ?? baseRow.factor),
    };
  });
}
type AnalysisTheme = "transport" | "dejeuner" | "equipement" | "autres" | "salle";

function buildAutresRowsForGroup(
  rowsDb: GroupReportRow[],
  groupNumber: number
): AutresAnalysisRow[] {
  return AUTRES_ANALYSIS_ROWS.map((baseRow) => {
    const candidateKeys = [baseRow.rowKey];

    if (baseRow.rowKey === "coffee") candidateKeys.push("cafe", "café");
    if (baseRow.rowKey === "tea") candidateKeys.push("the", "thé");
    if (baseRow.rowKey === "milk_chocolate") candidateKeys.push("hot_chocolate", "chocolat_chaud", "chocolat_lait");
    if (baseRow.rowKey === "chocolate_bar") candidateKeys.push("chocolat_bar", "barre_chocolatee");
    if (baseRow.rowKey === "viennoiserie") candidateKeys.push("viennoiseries");
    if (baseRow.rowKey === "apple") candidateKeys.push("pomme");
    if (baseRow.rowKey === "grapes") candidateKeys.push("raisin");
    if (baseRow.rowKey === "pear") candidateKeys.push("poire");
    if (baseRow.rowKey === "banana") candidateKeys.push("banane");
    if (baseRow.rowKey === "pineapple") candidateKeys.push("ananas");
    if (baseRow.rowKey === "mango") candidateKeys.push("mangue");

    const matchedRows = rowsDb.filter(
      (row) =>
        row.group_number === groupNumber &&
        row.theme === "autres_consommations" &&
        candidateKeys.includes(String(row.row_key))
    );

    const dbRow = matchedRows[0];

    return {
      ...baseRow,
      quantity: matchedRows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0),
      factor:
        baseRow.factor === 0
          ? 0
          : Number(dbRow?.factor ?? 0) > 0
            ? Number(dbRow?.factor)
            : baseRow.factor,
    };
  });
}

function buildSalleRowsForGroup(
  rowsDb: GroupReportRow[],
  groupNumber: number
): SalleAnalysisRow[] {
  return SALLE_ANALYSIS_ROWS.map((baseRow) => {
    const matchedRows = rowsDb.filter(
      (row) =>
        row.group_number === groupNumber &&
        row.theme === "salle" &&
        String(row.row_key) === baseRow.rowKey
    );

    const dbRow = matchedRows[0];

    return {
      ...baseRow,
      quantity: matchedRows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0),
      factor: Number(dbRow?.factor ?? 0) > 0 ? Number(dbRow?.factor) : baseRow.factor,
    };
  });
}

function getThemeForGroup(groupNumber: number): AnalysisTheme {
  if (groupNumber <= 2) return "transport";
  if (groupNumber <= 5) return "dejeuner";
  if (groupNumber <= 7) return "equipement";
  if (groupNumber <= 9) return "autres";
  return "salle";
}

function getThemeLabel(theme: AnalysisTheme): string {
  if (theme === "transport") return "Transport";
  if (theme === "dejeuner") return "Déjeuner";
  if (theme === "equipement") return "Équipement";
  if (theme === "autres") return "Autres consommations";
  return "Salle de cours";
}

function getThemeLabelForButton(theme: AnalysisTheme): string {
  if (theme === "transport") return "transport";
  if (theme === "dejeuner") return "déjeuner";
  if (theme === "equipement") return "équipement";
  if (theme === "autres") return "autres consommations";
  return "salle de cours";
}


function getSyntheseThemeLabel(theme: string): string {
  if (theme === "transport") return "Transport";
  if (theme === "dejeuner") return "Déjeuner";
  if (theme === "equipement") return "Équipement";
  if (theme === "autres_consommations") return "Autres consommations";
  if (theme === "salle") return "Salle de cours";
  return theme;
}

function computeSynthese(groupReports: GroupReportRow[]) {
  const result: Record<string, { total: number; groups: Set<number> }> = {};

  groupReports.forEach((row) => {
    const theme = String(row.theme ?? "");
    if (!theme) return;

    if (!result[theme]) {
      result[theme] = {
        total: 0,
        groups: new Set<number>(),
      };
    }

    const quantity = Number(row.quantity ?? 0);
    const factor = Number(row.factor ?? 0);
    result[theme].total += quantity * factor;

    if (typeof row.group_number === "number" && quantity > 0) {
      result[theme].groups.add(row.group_number);
    }
  });

  const preferredOrder = [
    "transport",
    "dejeuner",
    "equipement",
    "autres_consommations",
    "salle",
  ];

  return Object.entries(result)
    .map(([theme, data]) => {
      const activeGroups = data.groups.size;

      return {
        theme,
        label: getSyntheseThemeLabel(theme),
        total: data.total,
        activeGroups,
        average: activeGroups > 0 ? data.total / activeGroups : 0,
      };
    })
    .sort((a, b) => {
      const ia = preferredOrder.indexOf(a.theme);
      const ib = preferredOrder.indexOf(b.theme);
      if (ia === -1 && ib === -1) return a.label.localeCompare(b.label);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
}

function renderSyntheseDashboard(
  items: Array<{
    theme: string;
    label: string;
    total: number;
    activeGroups: number;
    average: number;
  }>
) {
  const maxAverage = Math.max(...items.map((item) => item.average), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={styles.syntheseGrid}>
        {items.map((item) => (
          <div key={item.theme} style={styles.syntheseCard}>
            <div style={styles.syntheseCardHeader}>{item.label}</div>

            <div style={styles.syntheseCardMain}>
              {formatInteger(Math.round(item.average))}
              <span style={styles.syntheseUnit}> gCO2</span>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.innerCardFull}>
        <h3 style={styles.innerTitle}>Moyenne par thématique</h3>

        {!items.length ? (
          <p style={styles.bodyText}>Aucune donnée disponible.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {items.map((item, index) => {
              const width =
                maxAverage > 0
                  ? `${Math.max((item.average / maxAverage) * 100, 2)}%`
                  : "0%";

              return (
                <div key={item.theme}>
                  <div style={styles.syntheseBarHeader}>
                    <span>{item.label}</span>
                    <strong>{formatDecimal(item.average)}</strong>
                  </div>

                  <div style={styles.syntheseBarTrack}>
                    <div
                      style={{
                        ...styles.syntheseBarFill,
                        width,
                        background: CHART_COLORS[index % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const CHART_COLORS = [
  "#f97316",
  "#2563eb",
  "#16a34a",
  "#9333ea",
  "#dc2626",
  "#0891b2",
  "#ca8a04",
  "#db2777",
  "#4f46e5",
  "#65a30d",
  "#0f766e",
  "#c2410c",
];

const FR_NUMBER_FORMAT = new Intl.NumberFormat("fr-FR");
const FR_DECIMAL_FORMAT = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatInteger(value: number | string | null | undefined) {
  return FR_NUMBER_FORMAT.format(Number(value ?? 0));
}

function formatDecimal(value: number | string | null | undefined, digits = 2) {
  const numericValue = Number(value ?? 0);

  if (digits === 2) {
    return FR_DECIMAL_FORMAT.format(numericValue);
  }

  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(numericValue);
}

function formatReportNumber(value: number | string | null | undefined, digits = 2) {
  const numericValue =
    typeof value === "string"
      ? Number(value.replace(",", "."))
      : Number(value ?? 0);

  if (!Number.isFinite(numericValue)) {
    return "0";
  }

  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })
    .format(numericValue)
    .replace(/\./g, ",");
}

function formatFactorNumber(value: number | string | null | undefined) {
  const numericValue =
    typeof value === "string"
      ? Number(value.replace(",", "."))
      : Number(value ?? 0);

  if (!Number.isFinite(numericValue)) {
    return "0";
  }

  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })
    .format(numericValue)
    .replace(/\./g, ",");
}

function formatSessionCode(value: string | null | undefined) {
  return String(value ?? "").toUpperCase();
}

function parseStudentAssignments(rawText: string): StudentAssignmentDraft[] {
  return rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index) => {
      if (index !== 0) return true;
      return !line.toLowerCase().includes("email");
    })
    .map((line) => {
      const separator = line.includes(";") ? ";" : "\t";
      const parts = line.split(separator).map((part) => part.trim());

      let groupIndex = -1;
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const numericValue = Number(parts[i]);
        if (Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 10) {
          groupIndex = i;
          break;
        }
      }

      return {
        email: normalizeEmail(parts[0] ?? ""),
        first_name: parts[1] ?? "",
        last_name: parts[2] ?? "",
        group_number: groupIndex >= 0 ? Number(parts[groupIndex]) : Number(parts[3] ?? 0),
      };
    })
    .filter((student) => {
      return (
        student.email &&
        student.email.includes("@") &&
        Number.isInteger(student.group_number) &&
        student.group_number >= 1 &&
        student.group_number <= 10
      );
    });
}

function capitalizeNamePart(value: string) {
  const cleanValue = String(value ?? "").trim().toLowerCase();
  if (!cleanValue) return "";

  return cleanValue
    .split(/([\\s-]+)/)
    .map((part) => {
      if (/^[\\s-]+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

function formatAssignmentLastName(student: StudentAssignmentDraft) {
  return String(student.last_name ?? "").trim().toUpperCase();
}

function formatAssignmentFirstName(student: StudentAssignmentDraft) {
  return String(student.first_name ?? "")
    .trim()
    .split(/\\s+/)
    .map((word) =>
      word
        .split("-")
        .map((part) => capitalizeNamePart(part))
        .join("-")
    )
    .join(" ");
}

function renderAssignmentsTable(assignments: StudentAssignmentDraft[], searchText = "") {
  const query = searchText.trim().toLowerCase();

  const filteredAssignments = [...assignments]
    .filter((student) => {
      if (!query) return true;
      return (
        student.email.toLowerCase().includes(query) ||
        formatAssignmentLastName(student).toLowerCase().includes(query) ||
        formatAssignmentFirstName(student).toLowerCase().includes(query) ||
        String(student.group_number).includes(query)
      );
    })
    .sort((a, b) => {
      if (a.group_number !== b.group_number) return a.group_number - b.group_number;
      const lastNameCompare = formatAssignmentLastName(a).localeCompare(formatAssignmentLastName(b));
      if (lastNameCompare !== 0) return lastNameCompare;
      return formatAssignmentFirstName(a).localeCompare(formatAssignmentFirstName(b));
    });

  if (!filteredAssignments.length) {
    return (
      <div style={{ ...styles.emptyText, marginTop: 12 }}>
        Aucun étudiant ne correspond à la recherche.
      </div>
    );
  }

  return (
    <div
      style={{
        maxHeight: 360,
        overflowY: "auto",
        overflowX: "auto",
        marginTop: 14,
        border: "1px solid #d8e0ec",
        borderRadius: 14,
        background: "#fff",
      }}
    >
      <table style={{ ...styles.reportTable, marginTop: 0 }}>
        <thead>
          <tr>
            <th style={{ ...styles.reportTh, position: "sticky", top: 0, zIndex: 2 }}>Nom</th>
            <th style={{ ...styles.reportTh, position: "sticky", top: 0, zIndex: 2 }}>Prénom</th>
            <th style={{ ...styles.reportTh, position: "sticky", top: 0, zIndex: 2 }}>Groupe</th>
            <th style={{ ...styles.reportTh, position: "sticky", top: 0, zIndex: 2 }}>Email</th>
          </tr>
        </thead>
        <tbody>
          {filteredAssignments.map((student) => (
            <tr key={`${student.email}-${student.group_number}`}>
              <td style={styles.reportTd}>{formatAssignmentLastName(student)}</td>
              <td style={styles.reportTd}>{formatAssignmentFirstName(student)}</td>
              <td style={styles.reportTd}>{student.group_number}</td>
              <td style={styles.reportTd}>{student.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function generateRandomAssignments(rawText: string): StudentAssignmentDraft[] {
  const students = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index) => {
      if (index !== 0) return true;
      return !line.toLowerCase().includes("email");
    })
    .map((line) => {
      const separator = line.includes(";") ? ";" : "\t";
      const parts = line.split(separator).map((part) => part.trim());

      return {
        email: normalizeEmail(parts[0] ?? ""),
        first_name: parts[1] ?? "",
        last_name: parts[2] ?? "",
      };
    })
    .filter((student) => student.email && student.email.includes("@"));

  return students
    .map((student) => ({ ...student, sortKey: Math.random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((student, index) => ({
      email: student.email,
      first_name: student.first_name,
      last_name: student.last_name,
      group_number: (index % 10) + 1,
    }));
}

function serializeStudentAssignments(assignments: StudentAssignmentDraft[]) {
  return assignments
    .map((student) =>
      [
        student.email,
        student.first_name,
        student.last_name,
        student.group_number,
      ].join(";")
    )
    .join("\n");
}

function downloadTextFile(filename: string, content: string) {
  // BOM UTF-8 pour que Microsoft Excel reconnaisse correctement les accents.
  const blob = new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

type DraftNumberInputProps = {
  value: number | string | null | undefined;
  style?: React.CSSProperties;
  min?: number;
  onCommit: (value: number) => Promise<void> | void;
};

function DraftNumberInput({ value, style, min = 0, onCommit }: DraftNumberInputProps) {
  const [draftValue, setDraftValue] = useState(String(value ?? 0));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    // Ne jamais réécrire le champ pendant que l'utilisateur est en train de saisir :
    // c'est ce qui faisait revenir le transport à 0 après un re-render.
    if (!isFocused) {
      setDraftValue(String(value ?? 0));
    }
  }, [value, isFocused]);

  function parseDraft(nextValue: string) {
    const cleanValue = String(nextValue ?? "").trim();
    if (cleanValue === "") return null;

    const numericValue = Number(cleanValue.replace(",", "."));
    if (!Number.isFinite(numericValue)) return null;
    return Math.max(min, numericValue);
  }

  async function commitValue(nextValue = draftValue) {
    const numericValue = parseDraft(nextValue);

    if (numericValue === null) {
      setDraftValue(String(value ?? 0));
      return;
    }

    await onCommit(numericValue);
    setDraftValue(String(numericValue));
  }

  return (
    <input
      type="number"
      min={min}
      value={draftValue}
      style={style}
      onFocus={() => setIsFocused(true)}
      onChange={(e) => {
        const nextValue = e.target.value;
        setDraftValue(nextValue);

        const numericValue = parseDraft(nextValue);
        if (numericValue === null) return;

        // Sauvegarde immédiate et calcul immédiat, sans touche Entrée.
        void onCommit(numericValue);
      }}
      onBlur={() => {
        setIsFocused(false);
        void commitValue();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
    />
  );
}

type DejeunerStructureItem = {
  rowKey: string;
  label: string;
  aliases?: string[];
};

type DejeunerStructureGroup = {
  title: string;
  items: DejeunerStructureItem[];
};

type DejeunerStructureSection = {
  title: string;
  groups: DejeunerStructureGroup[];
};

const DEJEUNER_REPORT_STRUCTURE: DejeunerStructureSection[] = [
  {
    title: "Plat principal",
    groups: [
      {
        title: "Sandwich",
        items: [
          { rowKey: "kebab", label: "Kebab" },
          { rowKey: "hamburger", label: "Hamburger" },
          { rowKey: "sandwich_jambon_beurre", label: "Sandwich Jambon-beurre" },
          { rowKey: "sandwich_fromage", label: "Sandwich Fromage" },
          {
            rowKey: "sandwich_thon_crudites",
            label: "Sandwich poisson crudités",
            aliases: ["Sandwich Poisson crudités", "Sandwich Thon crudités"],
          },
          { rowKey: "sandwich_crudites", label: "Sandwich Crudités" },
          { rowKey: "panini", label: "Panini" },
        ],
      },
      {
        title: "Quiche/Pizza",
        items: [
          { rowKey: "quiche", label: "Quiche" },
          { rowKey: "pizza", label: "Pizza" },
        ],
      },
      {
        title: "Plat de pâtes",
        items: [
          { rowKey: "spaghetti_bolognaise", label: "Spaghetti bolognaise" },
          { rowKey: "lasagnes", label: "Lasagnes" },
          { rowKey: "tagliatelles_carbonara", label: "Tagliatelles carbonara" },
        ],
      },
      {
        title: "Salade composée",
        items: [
          { rowKey: "salade_pommes_de_terre", label: "Salade de pommes de terre" },
          { rowKey: "salade_nicoise", label: "Salade niçoise" },
          { rowKey: "salade_thon_crudites", label: "Salade Thon crudités" },
          { rowKey: "salade_riz", label: "Salade de riz" },
          { rowKey: "salade_pates", label: "Salade de pâtes" },
        ],
      },
    ],
  },
  {
    title: "Protéines",
    groups: [
      {
        title: "Viande rouge",
        items: [
          { rowKey: "boeuf", label: "Bœuf", aliases: ["Boeuf"] },
          { rowKey: "agneau", label: "Agneau" },
        ],
      },
      {
        title: "Viande blanche",
        items: [
          { rowKey: "porc", label: "Porc" },
          { rowKey: "poulet", label: "Volaille", aliases: ["Poulet"] },
        ],
      },
      {
        title: "Poisson",
        items: [{ rowKey: "poisson", label: "Poisson" }],
      },
      {
        title: "Œufs",
        items: [{ rowKey: "oeufs_omelette", label: "Œufs (omelette)", aliases: ["Oeufs (omelette)"] }],
      },
    ],
  },
  {
    title: "Accompagnements",
    groups: [
      {
        title: "Accompagnement",
        items: [
          { rowKey: "legumes", label: "Légumes" },
          { rowKey: "salade", label: "Salade" },
          { rowKey: "pates", label: "Pâtes" },
          { rowKey: "riz", label: "Riz" },
        ],
      },
      {
        title: "Frites / chips",
        items: [{ rowKey: "frites_chips", label: "Frites / chips" }],
      },
    ],
  },
  {
    title: "Desserts et fruits",
    groups: [
      {
        title: "Fruit local",
        items: [
          { rowKey: "pomme", label: "Pomme" },
          { rowKey: "raisin", label: "Raisin" },
          { rowKey: "poire", label: "Poire" },
        ],
      },
      {
        title: "Fruit importé",
        items: [
          { rowKey: "banane", label: "Banane" },
          { rowKey: "ananas", label: "Ananas" },
          { rowKey: "mangue", label: "Mangue" },
        ],
      },
      {
        title: "Laitage",
        items: [{ rowKey: "laitage", label: "Laitage" }],
      },
      {
        title: "Dessert",
        items: [
          { rowKey: "glace", label: "Glace" },
          { rowKey: "patisserie", label: "Pâtisserie" },
        ],
      },
      {
        title: "Boissons",
        items: [
          { rowKey: "eau_robinet", label: "Eau du robinet" },
          { rowKey: "eau_bouteille", label: "Eau bouteille" },
          { rowKey: "soda", label: "Soda" },
          { rowKey: "cafe", label: "Café" },
          { rowKey: "the", label: "Thé" },
          { rowKey: "chocolat_lait_boisson", label: "Chocolat au lait (boisson)" },
        ],
      },
    ],
  },
];

function normalizeDejeunerLookupValue(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type CarbonBarRow = {
  label: string;
  total: number;
  count: number;
};

function renderCarbonHistogram(title: string, rows: CarbonBarRow[]) {
  const filteredRows = rows.filter((row) => row.count > 0 || row.total > 0);
  const maxTotal = Math.max(...filteredRows.map((row) => row.total), 0);
  const grandTotal = filteredRows.reduce((sum, row) => sum + row.total, 0);

  return (
    <div style={styles.innerCardFull}>
      <h3 style={styles.innerTitle}>{title}</h3>

      {!filteredRows.length ? (
        <div style={styles.infoMessage}>
          Aucune donnée carbone à visualiser pour le moment.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 16,
            }}
          >
            {filteredRows.map((row, index) => {
              const hasEmission = row.total > 0;
              const width =
                maxTotal > 0 && hasEmission
                  ? `${Math.max((row.total / maxTotal) * 100, 2)}%`
                  : "0%";

              return (
                <div
                  key={`${row.label}-${index}`}
                  style={{
                    background: "#dbe4f0",
                    border: "1px solid #c3d0df",
                    borderRadius: 16,
                    padding: 14,
                    boxShadow: "inset 0 1px 2px rgba(255,255,255,0.35)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 10,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    <span>{row.label}</span>
                    <span>{formatDecimal(row.total)}</span>
                  </div>

                  <div
                    style={{
                      height: 20,
                      width: "100%",
                      background: "#f8fafc",
                      borderRadius: 999,
                      overflow: "hidden",
                      boxShadow: "inset 0 1px 2px rgba(15,23,42,0.08)",
                    }}
                  >
                    {hasEmission && (
                      <div
                        style={{
                          height: "100%",
                          width,
                          background: CHART_COLORS[index % CHART_COLORS.length],
                          borderRadius: 999,
                          transition: "width 0.25s ease",
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

<div
  style={{
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    background: "#dbe4f0",
    border: "1px solid #c3d0df",
    boxShadow: "inset 0 1px 2px rgba(255,255,255,0.35)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  }}
>
  <span
    style={{
      fontWeight: 900,
      color: "#0f172a",
      fontSize: 18,
    }}
  >
    Total émissions
  </span>

  <span
    style={{
      fontWeight: 900,
      color: "#0f172a",
      fontSize: 18,
    }}
  >
    {formatDecimal(grandTotal)}
  </span>
</div>
        </>
      )}
    </div>
  );
}

type StudentSidebarProps = {
  active: "mise_en_oeuvre" | "collecte" | "analyses" | "bilans" | "synthese" | "vote";
  onGo: (screen: Screen) => void;
  analysisUnlocked: boolean;
  syntheseUnlocked: boolean;
  voteUnlocked: boolean;
  onBeforeOpenAnalysis?: () => Promise<boolean> | boolean;
  onBeforeOpenSynthese?: () => Promise<boolean> | boolean;
  onBeforeOpenVote?: () => Promise<boolean> | boolean;
  sessionCode?: string;
  sessionId?: string;
};

function StudentSidebar({
  active,
  onGo,
  analysisUnlocked,
  syntheseUnlocked,
  voteUnlocked,
  onBeforeOpenAnalysis,
  onBeforeOpenSynthese,
  onBeforeOpenVote,
  sessionCode,
  sessionId,
}: StudentSidebarProps) {
    return (
    <aside style={styles.sidebar}>
      <div style={styles.sidebarBrand}>
        <img src={kedgeLogo} alt="KEDGE Business School" style={styles.sidebarLogo} />
      </div>

      <button
        type="button"
        style={active === "mise_en_oeuvre" ? styles.sidebarButtonActive : styles.sidebarButton}
        onClick={() => onGo("student_mise_en_oeuvre")}
      >
        Mise en oeuvre
      </button>

      <button
        type="button"
        style={active === "collecte" ? styles.sidebarButtonActive : styles.sidebarButton}
        onClick={() => onGo("student_transport")}
      >
        Collecte des données
      </button>

      <button
        type="button"
        style={active === "analyses" ? styles.sidebarButtonActive : styles.sidebarButton}
        onClick={async () => {
          const refreshedAccess = await onBeforeOpenAnalysis?.();
          const canOpenAnalysis =
            typeof refreshedAccess === "boolean" ? refreshedAccess : analysisUnlocked;
          if (!canOpenAnalysis) {
            window.alert("L'accès à l'analyse n'a pas encore été autorisé par le professeur.");
            return;
          }
          onGo("student_analyses");
        }}
      >
        Analyses {analysisUnlocked ? "🔓" : "🔒"}
      </button>

      <button
        type="button"
        style={active === "vote" ? styles.sidebarButtonActive : styles.sidebarButton}
        onClick={async () => {
          const refreshedAccess = await onBeforeOpenVote?.();
          const canOpenVote =
            typeof refreshedAccess === "boolean" ? refreshedAccess : voteUnlocked;

          if (!canOpenVote) {
            window.alert("L'accès au vote n'a pas encore été autorisé par le professeur.");
            return;
          }

          onGo("student_vote");
        }}
      >
        Vote {voteUnlocked ? "🔓" : "🔒"}
      </button>

      <button
        type="button"
        style={active === "synthese" ? styles.sidebarButtonActive : styles.sidebarButton}
        onClick={async () => {
          const refreshedAccess = await onBeforeOpenSynthese?.();
          const canOpenSynthese =
            typeof refreshedAccess === "boolean" ? refreshedAccess : syntheseUnlocked;

          if (!canOpenSynthese) {
            window.alert("L'accès à la synthèse n'a pas encore été autorisé par le professeur.");
            return;
          }

          onGo("student_synthese");
        }}
      >
        Synthèse {syntheseUnlocked ? "🔓" : "🔒"}
      </button>

      {/* ✅ AJOUT : affichage debug session en bas de sidebar */}
      <div style={styles.sidebarFooter}>
        {(sessionCode || sessionId) && (
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.55)",
              marginBottom: 8,
              wordBreak: "break-all",
              lineHeight: 1.5,
            }}
          >
            {sessionCode && (
              <div>
                <strong>Code :</strong> {formatSessionCode(sessionCode)}
              </div>
            )}
            {sessionId && (
              <div>
                <strong>ID :</strong> {sessionId}
              </div>
            )}
          </div>
        )}
        <button style={styles.sidebarSmallButton} onClick={() => onGo("home" as Screen)}>
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

type StudentQuestionnaireTabsProps = {
  active: QuestionnaireKey;
  completion: StudentCompletion;
  onNavigate: (target: QuestionnaireKey) => void;
  canAccess: (target: QuestionnaireKey) => boolean;
};

function StudentQuestionnaireTabs({
  active,
  completion,
  onNavigate,
  canAccess,
}: StudentQuestionnaireTabsProps) {
  const label = (text: string, done: boolean) => (done ? `${text} ✓` : text);

  const buttonStyle = (target: QuestionnaireKey) => {
    if (target === active) return styles.sidebarButtonActive;
    return canAccess(target) ? styles.sidebarButton : styles.secondaryButton;
  };

  return (
    <div style={styles.row}>
      <button style={buttonStyle("transport")} type="button" onClick={() => onNavigate("transport")}>
        {label("Transport", completion.transport)}
      </button>
      <button style={buttonStyle("dejeuner")} type="button" onClick={() => onNavigate("dejeuner")}>
        {label("Déjeuner", completion.dejeuner)}
      </button>
      <button style={buttonStyle("equipement")} type="button" onClick={() => onNavigate("equipement")}>
        {label("Équipement", completion.equipement)}
      </button>
      <button style={buttonStyle("autres")} type="button" onClick={() => onNavigate("autres")}>
        {label("Autres consommations", completion.autres)}
      </button>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");

  const [teacherMenu, setTeacherMenu] = useState<TeacherMenu>("sessions");
  const [teacherSessionTab, setTeacherSessionTab] = useState<TeacherSessionTab>("counts");
  const [teacherAnalysesTab, setTeacherAnalysesTab] =
    useState<TeacherAnalysesTab>("donnees_a_reporter");
  const [studentAnalysesTab, setStudentAnalysesTab] =
    useState<StudentAnalysesTab>("donnees_a_reporter");
  const [teacherShowCarbonChart, setTeacherShowCarbonChart] = useState(false);
  const [studentShowCarbonChart, setStudentShowCarbonChart] = useState(false);

  const [openProposalGroup, setOpenProposalGroup] = useState<number | null>(null);
const [teacherGroupProposals, setTeacherGroupProposals] = useState<Record<number, GroupProposalState>>({});

  const [adminTab, setAdminTab] = useState<AdminTab>("teachers");
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "teacher" | "student" | "">("");
  const [authPortal, setAuthPortal] = useState<"teacher" | "admin">("teacher");
  const [adminTeachers, setAdminTeachers] = useState<any[]>([]);
  const [adminSessions, setAdminSessions] = useState<any[]>([]);
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [newTeacherPassword, setNewTeacherPassword] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [isCreatingTeacher, setIsCreatingTeacher] = useState(false);

  const [teacherGroupNumber, setTeacherGroupNumber] = useState(1);
  const [studentGroupNumber, setStudentGroupNumber] = useState(1);

  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [teacherUserId, setTeacherUserId] = useState("");
  const [teacherUserEmail, setTeacherUserEmail] = useState("");
  const [teacherDisplayName, setTeacherDisplayName] = useState("");
  const [openTeacherActionsId, setOpenTeacherActionsId] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editingTeacherName, setEditingTeacherName] = useState("");
  const [editingTeacherEmail, setEditingTeacherEmail] = useState("");

  const [studentEmail, setStudentEmail] = useState("");
  const [studentCodeSession, setStudentCodeSession] = useState("");
  const [studentAssignedGroup, setStudentAssignedGroup] = useState<number | null>(null);
const [studentAssignedFirstName, setStudentAssignedFirstName] = useState("");
const [studentAssignedLastName, setStudentAssignedLastName] = useState("");

const effectiveStudentGroupNumber = studentAssignedGroup ?? studentGroupNumber;


const [quickSessionCampus, setQuickSessionCampus] = useState("");
const [quickSessionProgramme, setQuickSessionProgramme] = useState("");
const [quickSessionLevel, setQuickSessionLevel] = useState("");
const [quickSessionSuffix, setQuickSessionSuffix] = useState("");  const [teacherSessions, setTeacherSessions] = useState<SessionRow[]>([]);

  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [selectedSessionCode, setSelectedSessionCode] = useState("");
  const [studentSelectedSessionId, setStudentSelectedSessionId] = useState("");
  const [studentSelectedSessionCode, setStudentSelectedSessionCode] = useState("");

  const [settingsTitle, setSettingsTitle] = useState("");
  const [settingsCampus, setSettingsCampus] = useState("");
  const [settingsAllowedEmailsText, setSettingsAllowedEmailsText] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [assignmentSearch, setAssignmentSearch] = useState("");

const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("emails");
const [assignmentMethod, setAssignmentMethod] = useState<AssignmentMethod>("import");
const [assignmentRawText, setAssignmentRawText] = useState("");
const [newStudentEmail, setNewStudentEmail] = useState("");
const [newStudentFirstName, setNewStudentFirstName] = useState("");
const [newStudentLastName, setNewStudentLastName] = useState("");
const [newStudentGroupNumber, setNewStudentGroupNumber] = useState(1);
const [autoAssignNewStudentGroup, setAutoAssignNewStudentGroup] = useState(true);

  const [transportTrips, setTransportTrips] = useState<TransportTrip[]>(emptyTrips());
  const [transportMessage, setTransportMessage] = useState("");

  const [dejeuner, setDejeuner] = useState<DejeunerState>(emptyDejeuner());
  const [dejeunerMessage, setDejeunerMessage] = useState("");

  const [equipement, setEquipement] = useState<EquipementState>(emptyEquipement());
  const [equipementMessage, setEquipementMessage] = useState("");

  const [autres, setAutres] = useState<AutresState>(emptyAutres());
  const [autresMessage, setAutresMessage] = useState("");

  const [counts, setCounts] = useState<ResponseCounts>(EMPTY_COUNTS);
  const [message, setMessage] = useState("");
  const [teacherTransportReportRowsDb, setTeacherTransportReportRowsDb] = useState<GroupReportRow[]>([]);
  const [studentTransportReportRowsDb, setStudentTransportReportRowsDb] = useState<GroupReportRow[]>([]);
  const [teacherTransportReportableRows, setTeacherTransportReportableRows] = useState<ReportableRow[]>([]);
  const [studentTransportReportableRows, setStudentTransportReportableRows] = useState<ReportableRow[]>([]);
  const [teacherDejeunerReportableRows, setTeacherDejeunerReportableRows] = useState<DejeunerReportableRowRpc[]>([]);
  const [studentDejeunerReportableRows, setStudentDejeunerReportableRows] = useState<DejeunerReportableRowRpc[]>([]);
  const [teacherDejeunerReportRowsDb, setTeacherDejeunerReportRowsDb] = useState<GroupReportRow[]>([]);
  const [studentDejeunerReportRowsDb, setStudentDejeunerReportRowsDb] = useState<GroupReportRow[]>([]);
  const [teacherEquipementReportableRows, setTeacherEquipementReportableRows] =
  useState<EquipementReportableRowRpc[]>([]);
const [studentEquipementReportableRows, setStudentEquipementReportableRows] =
  useState<EquipementReportableRowRpc[]>([]);
const [teacherEquipementReportRowsDb, setTeacherEquipementReportRowsDb] =
  useState<GroupReportRow[]>([]);
const [studentEquipementReportRowsDb, setStudentEquipementReportRowsDb] =
  useState<GroupReportRow[]>([]);
const [teacherAutresReportableRows, setTeacherAutresReportableRows] =
  useState<AutresReportableRowRpc[]>([]);
const [studentAutresReportableRows, setStudentAutresReportableRows] =
  useState<AutresReportableRowRpc[]>([]);
const [teacherAutresReportRowsDb, setTeacherAutresReportRowsDb] =
  useState<GroupReportRow[]>([]);
const [studentAutresReportRowsDb, setStudentAutresReportRowsDb] =
  useState<GroupReportRow[]>([]);
const [teacherSalleReportRowsDb, setTeacherSalleReportRowsDb] =
  useState<GroupReportRow[]>([]);
const [studentSalleReportRowsDb, setStudentSalleReportRowsDb] =
  useState<GroupReportRow[]>([]);

  const [studentCompletion, setStudentCompletion] =
    useState<StudentCompletion>(EMPTY_STUDENT_COMPLETION);
  const [studentAnalysisUnlocked, setStudentAnalysisUnlocked] = useState(false);
  const [studentSyntheseUnlocked, setStudentSyntheseUnlocked] = useState(false);
  const [studentVoteUnlocked, setStudentVoteUnlocked] = useState(false);
const [consolidatedProposals, setConsolidatedProposals] = useState<ConsolidatedProposalOption[]>([]);
const [importedProposalRawText, setImportedProposalRawText] = useState("");
const [importedProposalDrafts, setImportedProposalDrafts] = useState<string[]>([]);
const [isSubmittingImportedProposals, setIsSubmittingImportedProposals] = useState(false);

const [studentVotes, setStudentVotes] = useState<{
  rank1?: string;
  rank2?: string;
  rank3?: string;
}>({});
const [studentVoteSubmitted, setStudentVoteSubmitted] = useState(false);
const [teacherVoteRows, setTeacherVoteRows] = useState<TeacherVoteRow[]>([]);

const [teacherVoteView, setTeacherVoteView] = useState<"proposals" | "results">("proposals");

const teacherVoteResults = useMemo<TeacherVoteResult[]>(() => {
  const proposalMap = new Map(
    consolidatedProposals.map((proposal) => [
      proposal.id,
      {
        proposalId: proposal.id,
        text: proposal.text,
        score: 0,
        totalVotes: 0,
        rank1Count: 0,
        rank2Count: 0,
        rank3Count: 0,
      },
    ])
  );

  teacherVoteRows.forEach((row) => {
    const current = proposalMap.get(String(row.proposal_id));
    if (!current) return;

    current.totalVotes += 1;

    if (row.rank === 1) {
      current.rank1Count += 1;
      current.score += 3;
      return;
    }

    if (row.rank === 2) {
      current.rank2Count += 1;
      current.score += 2;
      return;
    }

    if (row.rank === 3) {
      current.rank3Count += 1;
      current.score += 1;
    }
  });

  return Array.from(proposalMap.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.rank1Count !== a.rank1Count) return b.rank1Count - a.rank1Count;
    if (b.totalVotes !== a.totalVotes) return b.totalVotes - a.totalVotes;
    return a.text.localeCompare(b.text);
  });
}, [consolidatedProposals, teacherVoteRows]);

  const teacherTransportRows = useMemo(
    () => buildTransportRowsForGroup(teacherTransportReportRowsDb, teacherGroupNumber),
    [teacherTransportReportRowsDb, teacherGroupNumber]
  );

  const studentTransportRows = useMemo(
    () => buildTransportRowsForGroup(studentTransportReportRowsDb, effectiveStudentGroupNumber),
    [studentTransportReportRowsDb, effectiveStudentGroupNumber]
  );

  const teacherDejeunerRows = useMemo(
    () => buildDejeunerRowsForGroup(teacherDejeunerReportRowsDb, teacherGroupNumber),
    [teacherDejeunerReportRowsDb, teacherGroupNumber]
  );

  const studentDejeunerRows = useMemo(
    () => buildDejeunerRowsForGroup(studentDejeunerReportRowsDb, effectiveStudentGroupNumber),
    [studentDejeunerReportRowsDb, effectiveStudentGroupNumber]
  );
const teacherEquipementRows = useMemo(
  () => buildEquipementRowsForGroup(teacherEquipementReportRowsDb, teacherGroupNumber),
  [teacherEquipementReportRowsDb, teacherGroupNumber]
);

const studentEquipementRows = useMemo(
  () => buildEquipementRowsForGroup(studentEquipementReportRowsDb, effectiveStudentGroupNumber),
  [studentEquipementReportRowsDb, effectiveStudentGroupNumber]
);

  const teacherTheme = getThemeForGroup(teacherGroupNumber);
  const studentTheme = getThemeForGroup(effectiveStudentGroupNumber);

  const teacherDisplayedTransportReportableRows = teacherTransportReportableRows;
  const studentDisplayedTransportReportableRows = studentTransportReportableRows;

const teacherTransportChartRows = useMemo(
  () =>
    teacherTransportRows.map((row) => ({
      label: row.label,
      total: Number(row.distanceTotalKm || 0) * Number(row.factor || 0),
      count: Number(row.persons || 0),
    })),
  [teacherTransportRows]
);

const studentTransportChartRows = useMemo(
  () =>
    studentTransportRows.map((row) => ({
      label: row.label,
      total: Number(row.distanceTotalKm || 0) * Number(row.factor || 0),
      count: Number(row.persons || 0),
    })),
  [studentTransportRows]
);

const teacherDejeunerChartRows = useMemo(
  () =>
    teacherDejeunerRows.map((row) => ({
      label: row.label,
      total: Number(row.quantity || 0) * Number(row.factor || 0),
      count: Number(row.quantity || 0),
    })),
  [teacherDejeunerRows]
);

const studentDejeunerChartRows = useMemo(
  () =>
    studentDejeunerRows.map((row) => ({
      label: row.label,
      total: Number(row.quantity || 0) * Number(row.factor || 0),
      count: Number(row.quantity || 0),
    })),
  [studentDejeunerRows]
);
const teacherEquipementChartRows = useMemo(
  () =>
    teacherEquipementRows.map((row) => ({
      label: row.label,
      total: Number(row.quantity || 0) * Number(row.factor || 0),
      count: Number(row.quantity || 0),
    })),
  [teacherEquipementRows]
);

const studentEquipementChartRows = useMemo(
  () =>
    studentEquipementRows.map((row) => ({
      label: row.label,
      total: Number(row.quantity || 0) * Number(row.factor || 0),
      count: Number(row.quantity || 0),
    })),
  [studentEquipementRows]
);
const teacherAutresRows = useMemo(
  () => buildAutresRowsForGroup(teacherAutresReportRowsDb, teacherGroupNumber),
  [teacherAutresReportRowsDb, teacherGroupNumber]
);

const studentAutresRows = useMemo(
  () => buildAutresRowsForGroup(studentAutresReportRowsDb, effectiveStudentGroupNumber),
  [studentAutresReportRowsDb, effectiveStudentGroupNumber]
);

const teacherAutresChartRows = useMemo(
  () =>
    orderAutresAnalysisRows(teacherAutresRows).map((row) => ({
      label: row.label,
      total: Number(row.quantity || 0) * Number(row.factor || 0),
      count: Number(row.quantity || 0),
    })),
  [teacherAutresRows]
);

const studentAutresChartRows = useMemo(
  () =>
    orderAutresAnalysisRows(studentAutresRows).map((row) => ({
      label: row.label,
      total: Number(row.quantity || 0) * Number(row.factor || 0),
      count: Number(row.quantity || 0),
    })),
  [studentAutresRows]
);

const teacherSalleRows = useMemo(
  () => buildSalleRowsForGroup(teacherSalleReportRowsDb, teacherGroupNumber),
  [teacherSalleReportRowsDb, teacherGroupNumber]
);

const studentSalleRows = useMemo(
  () => buildSalleRowsForGroup(studentSalleReportRowsDb, effectiveStudentGroupNumber),
  [studentSalleReportRowsDb, effectiveStudentGroupNumber]
);

const teacherSalleChartRows = useMemo(
  () =>
    teacherSalleRows.map((row) => ({
      label: row.label,
      total: Number(row.quantity || 0) * Number(row.factor || 0),
      count: Number(row.quantity || 0),
    })),
  [teacherSalleRows]
);

const studentSalleChartRows = useMemo(
  () =>
    studentSalleRows.map((row) => ({
      label: row.label,
      total: Number(row.quantity || 0) * Number(row.factor || 0),
      count: Number(row.quantity || 0),
    })),
  [studentSalleRows]
);


const teacherSyntheseSourceRows = useMemo(
  () => [
    ...teacherTransportReportRowsDb,
    ...teacherDejeunerReportRowsDb,
    ...teacherEquipementReportRowsDb,
    ...teacherAutresReportRowsDb,
    ...teacherSalleReportRowsDb,
  ],
  [
    teacherTransportReportRowsDb,
    teacherDejeunerReportRowsDb,
    teacherEquipementReportRowsDb,
    teacherAutresReportRowsDb,
    teacherSalleReportRowsDb,
  ]
);

const studentSyntheseSourceRows = useMemo(
  () => [
    ...studentTransportReportRowsDb,
    ...studentDejeunerReportRowsDb,
    ...studentEquipementReportRowsDb,
    ...studentAutresReportRowsDb,
    ...studentSalleReportRowsDb,
  ],
  [
    studentTransportReportRowsDb,
    studentDejeunerReportRowsDb,
    studentEquipementReportRowsDb,
    studentAutresReportRowsDb,
    studentSalleReportRowsDb,
  ]
);

const teacherSyntheseData = useMemo(
  () => computeSynthese(teacherSyntheseSourceRows),
  [teacherSyntheseSourceRows]
);

const studentSyntheseData = useMemo(
  () =>
    computeSynthese(
      studentSyntheseSourceRows.filter((row) =>
        !studentAssignedGroup || Number(row.group_number) === studentAssignedGroup
      )
    ),
  [studentSyntheseSourceRows, studentAssignedGroup]
);

  const sortedFilteredEmails = useMemo(() => {
    return settingsAllowedEmailsText
      .split("\n")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .filter((email) => email.includes(userSearch.toLowerCase()));
  }, [settingsAllowedEmailsText, userSearch]);

  const parsedStudentAssignments = useMemo(() => {
  if (assignmentMode !== "groups") return [];
  return parseStudentAssignments(assignmentRawText);
}, [assignmentMode, assignmentRawText]);

  const randomStudentAssignments = useMemo(() => {
    if (assignmentMode !== "groups" || assignmentMethod !== "random") return [];
    return generateRandomAssignments(settingsAllowedEmailsText);
  }, [assignmentMode, assignmentMethod, settingsAllowedEmailsText]);

  const activeStudentAssignments = useMemo(() => {
    if (assignmentMode !== "groups") return [];
    return assignmentMethod === "random" ? randomStudentAssignments : parsedStudentAssignments;
  }, [assignmentMode, assignmentMethod, parsedStudentAssignments, randomStudentAssignments]);

  const displayedStudentAssignments = useMemo(() => {
    if (activeStudentAssignments.length > 0) return activeStudentAssignments;

    const parsedFromAllowedEmails = parseStudentAssignments(settingsAllowedEmailsText);
    if (parsedFromAllowedEmails.length > 0) return parsedFromAllowedEmails;

    return [];
  }, [activeStudentAssignments, settingsAllowedEmailsText]);

  const filteredAdminTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return adminTeachers;

    return adminTeachers.filter((teacher) =>
      String(teacher.name ?? teacher.full_name ?? "").toLowerCase().includes(q) ||
      String(teacher.email ?? "").toLowerCase().includes(q)
    );
  }, [adminTeachers, teacherSearch]);

  const filteredAdminSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    if (!q) return adminSessions;

    return adminSessions.filter((session) =>
      String(session.teacher_name ?? "").toLowerCase().includes(q) ||
      String(session.teacher_email ?? "").toLowerCase().includes(q)
    );
  }, [adminSessions, sessionSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!openTeacherActionsId) return;
      const target = event.target as Node | null;
      if (actionsMenuRef.current && target && !actionsMenuRef.current.contains(target)) {
        setOpenTeacherActionsId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openTeacherActionsId]);

  useEffect(() => {
    if (studentAssignedGroup && studentGroupNumber !== studentAssignedGroup) {
      setStudentGroupNumber(studentAssignedGroup);
      setOpenProposalGroup(null);
    }
  }, [studentAssignedGroup, studentGroupNumber]);

  useEffect(() => {
    if (!studentAssignedGroup) return;
    if (openProposalGroup !== null && openProposalGroup !== studentAssignedGroup) {
      setOpenProposalGroup(null);
    }
  }, [studentAssignedGroup, openProposalGroup]);

  useEffect(() => {
    if (!studentAssignedGroup) return;

    if (
      screen === "student_analyses" ||
      screen === "student_synthese" ||
      screen === "student_vote"
    ) {
      setStudentGroupNumber(studentAssignedGroup);
    }
  }, [screen, studentAssignedGroup]);

  useEffect(() => {
  if (screen === "student_analyses" && !studentAnalysisUnlocked) {
    setScreen("student_mise_en_oeuvre");
    return;
  }

  if (screen === "student_synthese" && !studentSyntheseUnlocked) {
    setScreen("student_mise_en_oeuvre");
    return;
  }

  if (screen === "student_vote" && !studentVoteUnlocked) {
    setScreen("student_mise_en_oeuvre");
  }
}, [
  screen,
  studentAnalysisUnlocked,
  studentSyntheseUnlocked,
  studentVoteUnlocked,
]);

  function goToScreen(next: Screen) {
    setScreen(next);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, 0);
  }

  const saveStudentDraft = useCallback((nextScreen?: StudentDraft["screen"]) => {
    if (!studentEmail.trim() || !studentCodeSession.trim()) return;

    const payload: StudentDraft = {
      transportTrips,
      dejeuner,
      equipement,
      autres,
      studentCompletion,
      screen:
        nextScreen ??
        ([
          "student_mise_en_oeuvre",
          "student_transport",
          "student_dejeuner",
          "student_equipement",
          "student_autres",
          "student_analyses",
          "student_bilans",
          "student_synthese",
          "student_vote",
        ].includes(screen)
          ? (screen as StudentDraft["screen"])
          : "student_mise_en_oeuvre"),
    };

    localStorage.setItem(
      getStudentDraftKey(studentEmail, studentCodeSession),
      JSON.stringify(payload)
    );
  }, [
    autres,
    dejeuner,
    equipement,
    screen,
    studentCodeSession,
    studentCompletion,
    studentEmail,
    transportTrips,
  ]);

function emptyGroupProposalState(): GroupProposalState {
  return {
    proposal_1: "",
    proposal_2: "",
    proposal_3: "",
    is_validated: false,
  };
}

function normalizeProposalText(value: string) {
  return value.trim();
}

function updateTeacherGroupProposalField(
  groupNumber: number,
  field: "proposal_1" | "proposal_2" | "proposal_3",
  value: string
) {
  setTeacherGroupProposals((prev) => ({
    ...prev,
    [groupNumber]: {
      ...(prev[groupNumber] ?? emptyGroupProposalState()),
      [field]: value,
    },
  }));
}

  function loadStudentDraft(email: string, sessionCode: string): StudentDraft | null {
    const raw = localStorage.getItem(getStudentDraftKey(email, sessionCode));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StudentDraft;
    } catch {
      return null;
    }
  }
async function restoreStudentStateFromDraft(email: string, sessionCode: string) {
  const draft = loadStudentDraft(email, sessionCode);

  setTransportTrips(draft?.transportTrips?.length ? draft.transportTrips : emptyTrips());
  setDejeuner(draft?.dejeuner ?? emptyDejeuner());
  setEquipement(draft?.equipement ?? emptyEquipement());
  setAutres(draft?.autres ?? emptyAutres());

  setStudentCompletion(draft?.studentCompletion ?? EMPTY_STUDENT_COMPLETION);

  if (draft?.screen) {
    setScreen(draft.screen);
  }
}

  function saveStudentDraftSnapshot(params?: {
  completion?: Partial<StudentCompletion>;
  nextScreen?: StudentDraft["screen"];
}) {
  if (!studentEmail.trim() || !studentCodeSession.trim()) return;

  const nextCompletion: StudentCompletion = {
    ...studentCompletion,
    ...(params?.completion ?? {}),
  };

  const payload: StudentDraft = {
    transportTrips,
    dejeuner,
    equipement,
    autres,
    studentCompletion: nextCompletion,
    screen:
      params?.nextScreen ??
      ([
        "student_mise_en_oeuvre",
        "student_transport",
        "student_dejeuner",
        "student_equipement",
        "student_autres",
        "student_analyses",
        "student_synthese",
        "student_vote",
      ].includes(screen)
        ? (screen as StudentDraft["screen"])
        : "student_mise_en_oeuvre"),
  };

  localStorage.setItem(
    getStudentDraftKey(studentEmail, studentCodeSession),
    JSON.stringify(payload)
  );
}

  const saveTeacherDraft = useCallback(() => {
    if (!teacherUserEmail.trim() || !selectedSessionCode.trim()) return;

    const payload: TeacherDraft = {
      teacherMenu,
      teacherSessionTab,
      teacherAnalysesTab,
      teacherGroupNumber,
    };

    localStorage.setItem(
      getTeacherDraftKey(teacherUserEmail, selectedSessionCode),
      JSON.stringify(payload)
    );
  }, [
    selectedSessionCode,
    teacherAnalysesTab,
    teacherGroupNumber,
    teacherMenu,
    teacherSessionTab,
    teacherUserEmail,
  ]);

  function loadTeacherDraft(email: string, sessionCode: string): TeacherDraft | null {
    const raw = localStorage.getItem(getTeacherDraftKey(email, sessionCode));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TeacherDraft;
    } catch {
      return null;
    }
  }

  function canAccessStudentQuestionnaire(target: QuestionnaireKey) {
    if (target === "transport") return true;
    if (target === "dejeuner") return studentCompletion.transport;
    if (target === "equipement") {
      return studentCompletion.transport && studentCompletion.dejeuner;
    }
    return (
      studentCompletion.transport &&
      studentCompletion.dejeuner &&
      studentCompletion.equipement
    );
  }

  function goToStudentQuestionnaire(target: QuestionnaireKey) {
    if (!canAccessStudentQuestionnaire(target)) {
      window.alert("Vous devez d'abord valider le questionnaire précédent.");
      return;
    }

    if (target === "transport") goToScreen("student_transport");
    if (target === "dejeuner") goToScreen("student_dejeuner");
    if (target === "equipement") goToScreen("student_equipement");
    if (target === "autres") goToScreen("student_autres");
  }

  function resetStudentQuestionnaire(target: QuestionnaireKey) {
    if (!window.confirm("⚠️ Voulez-vous vraiment réinitialiser ce questionnaire ?")) {
      return;
    }

    if (target === "transport") {
      setTransportTrips(emptyTrips());
      setTransportMessage("");
      setStudentCompletion((prev) => ({ ...prev, transport: false }));
    }

    if (target === "dejeuner") {
      setDejeuner(emptyDejeuner());
      setDejeunerMessage("");
      setStudentCompletion((prev) => ({ ...prev, dejeuner: false }));
    }

    if (target === "equipement") {
      setEquipement(emptyEquipement());
      setEquipementMessage("");
      setStudentCompletion((prev) => ({ ...prev, equipement: false }));
    }

    if (target === "autres") {
      setAutres(emptyAutres());
      setAutresMessage("");
      setStudentCompletion((prev) => ({ ...prev, autres: false }));
    }
  }

async function loadTeacherGroupProposals(sessionId: string) {
  if (!sessionId) {
    setTeacherGroupProposals({});
    return;
  }

  const { data, error } = await supabase.rpc("get_group_proposals_for_session", {
    p_session_id: sessionId,
  });

  if (error) {
    setMessage(`Erreur chargement propositions : ${error.message}`);
    setTeacherGroupProposals({});
    return;
  }

  const nextState: Record<number, GroupProposalState> = {};

  for (let group = 1; group <= 10; group++) {
    nextState[group] = emptyGroupProposalState();
  }

  (data ?? []).forEach((row: GroupProposalRow) => {
    nextState[row.group_number] = {
      proposal_1: String(row.proposal_1 ?? ""),
      proposal_2: String(row.proposal_2 ?? ""),
      proposal_3: String(row.proposal_3 ?? ""),
      is_validated: Boolean(row.is_validated),
    };
  });

  setTeacherGroupProposals(nextState);
}

async function loadConsolidatedProposals(sessionId: string) {
  if (!sessionId) {
    setConsolidatedProposals([]);
    return;
  }

  const { data, error } = await supabase
    .from("consolidated_proposals")
    .select("id, text, theme, source_group_numbers, created_at")
    .eq("session_id", sessionId)
    .eq("theme", "vote")
    .order("created_at", { ascending: true });

  if (error) {
    setMessage(`Erreur chargement consolidation : ${error.message}`);
    setConsolidatedProposals([]);
    return;
  }

  const rows: ConsolidatedProposalOption[] = ((data ?? []) as ConsolidatedProposalRow[]).map((row) => ({
    id: String(row.id ?? ""),
    text: String(row.text ?? ""),
    theme: String(row.theme ?? "vote"),
    sourceGroupNumbers: Array.isArray(row.source_group_numbers)
      ? row.source_group_numbers.map((value) => Number(value))
      : [],
  }));

  setConsolidatedProposals(rows.filter((row) => row.id && row.text));
}

async function loadStudentVotes(sessionId: string, email: string) {
  if (!sessionId || !email) {
    setStudentVotes({});
    return;
  }

  const { data, error } = await supabase
    .from("proposal_votes")
    .select("proposal_id, rank")
    .eq("session_id", sessionId)
    .eq("student_email", normalizeEmail(email));

  if (error) {
    setStudentVotes({});
    setMessage(`Erreur chargement votes étudiant : ${error.message}`);
    return;
  }

  const nextVotes: {
    rank1?: string;
    rank2?: string;
    rank3?: string;
  } = {};

  (data ?? []).forEach((row: { proposal_id: string; rank: number }) => {
    if (row.rank === 1) nextVotes.rank1 = row.proposal_id;
    if (row.rank === 2) nextVotes.rank2 = row.proposal_id;
    if (row.rank === 3) nextVotes.rank3 = row.proposal_id;
  });

setStudentVotes(nextVotes);
setStudentVoteSubmitted(Boolean(nextVotes.rank1 || nextVotes.rank2 || nextVotes.rank3));
}
function selectVote(rank: 1 | 2 | 3, proposalId: string) {
  const currentValues = [studentVotes.rank1, studentVotes.rank2, studentVotes.rank3].filter(Boolean);

  const alreadySelectedForAnotherRank =
    currentValues.includes(proposalId) &&
    studentVotes[`rank${rank}` as "rank1" | "rank2" | "rank3"] !== proposalId;

  if (alreadySelectedForAnotherRank) {
    window.alert("Cette proposition est déjà sélectionnée pour un autre rang.");
    return;
  }

  setStudentVotes((prev) => ({
    ...prev,
    [`rank${rank}`]: proposalId,
  }));

  setStudentVoteSubmitted(false);
}

function clearVote(rank: 1 | 2 | 3) {
  setStudentVotes((prev) => ({
    ...prev,
    [`rank${rank}`]: undefined,
  }));

  setStudentVoteSubmitted(false);
}

async function loadTeacherVoteRows(sessionId: string) {
  if (!sessionId) {
    setTeacherVoteRows([]);
    return;
  }

  const { data, error } = await supabase
    .from("proposal_votes")
    .select("proposal_id, rank, student_email")
    .eq("session_id", sessionId);

  if (error) {
    setTeacherVoteRows([]);
    setMessage(`Erreur chargement résultats vote : ${error.message}`);
    return;
  }

  setTeacherVoteRows((data ?? []) as TeacherVoteRow[]);
}


async function saveStudentVotes() {
  if (!studentSelectedSessionId || !studentEmail) {
    window.alert("Session ou email étudiant manquant.");
    return;
  }

  const rows = [
    { rank: 1, proposal_id: studentVotes.rank1 },
    { rank: 2, proposal_id: studentVotes.rank2 },
    { rank: 3, proposal_id: studentVotes.rank3 },
  ].filter((row): row is { rank: number; proposal_id: string } => Boolean(row.proposal_id));

  const selectedIds = rows.map((row) => row.proposal_id);
  const uniqueIds = new Set(selectedIds);

  if (uniqueIds.size !== selectedIds.length) {
    window.alert("Vous ne pouvez pas voter deux fois pour la même proposition.");
    return;
  }

  if (rows.length === 0) {
    window.alert("Sélectionnez au moins une proposition avant de valider.");
    return;
  }

  const { error: deleteError } = await supabase
    .from("proposal_votes")
    .delete()
    .eq("session_id", studentSelectedSessionId)
    .eq("student_email", normalizeEmail(studentEmail));

  if (deleteError) {
    setMessage(`Erreur suppression anciens votes : ${deleteError.message}`);
    return;
  }

  const payload = rows.map((row) => ({
    session_id: studentSelectedSessionId,
    student_email: normalizeEmail(studentEmail),
    proposal_id: row.proposal_id,
    rank: row.rank,
  }));

  const { error: insertError } = await supabase
    .from("proposal_votes")
    .insert(payload);

  if (insertError) {
    setMessage(`Erreur enregistrement votes : ${insertError.message}`);
    return;
  }

await loadStudentVotes(studentSelectedSessionId, studentEmail);
setStudentVoteSubmitted(true);
setMessage("Vote enregistré.");
}

function getProposalTextById(proposalId?: string) {
  if (!proposalId) return "Aucun choix";

  const found = consolidatedProposals.find((proposal) => proposal.id === proposalId);
  return found?.text ?? "Proposition introuvable";
}

function buildConsolidationPrompt() {
  return [
    "Tu reçois une liste de propositions étudiantes classées par groupe.",
    "",
    "Consignes impératives :",
    "- Conserver 1 idée = 1 proposition",
    "- Proposer seulement 10 propositions",
    "- Ne jamais fusionner deux propositions différentes",
    "- Ne jamais mettre plusieurs idées dans une seule ligne",
    "- Regrouper des propositions si elles semblent proches ou sont du même type",
    "- Ne pas inventer d'idée nouvelle",
    "- Reformuler uniquement si nécessaire pour clarifier",
    "- Si deux propositions sont vraiment identiques, tu peux n'en garder qu'une seule",
    "- Produire une liste finale simple, claire, directement exploitable pour un vote",
    "",
    "Format de sortie STRICT :",
    "- Texte brut uniquement",
    "- Une seule proposition par ligne",
    "- Chaque ligne doit commencer par un numéro",
    "",
    "Exemple attendu :",
    "1. Réduire l'usage de la voiture individuelle",
    "2. Installer plus d'options végétariennes",
    "3. Encourager le covoiturage entre étudiants",
    "",
    "Interdictions :",
    "- Pas de sous-points",
    "- Pas de paragraphes",
    "- Pas de titres",
    "- Pas de commentaire",
    "- Pas de ligne du type '1. Proposition A / Proposition B / Proposition C'",
    "",
    "Réponds uniquement avec la liste finale numérotée.",
  ].join("\n");
}

function sanitizeFilenamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function exportConsolidationTxt() {
  if (!selectedSessionId) {
    window.alert("Aucune session sélectionnée.");
    return;
  }

  const validatedGroups = Object.entries(teacherGroupProposals)
    .map(([groupKey, group]) => ({
      groupNumber: Number(groupKey),
      proposals: [
        normalizeProposalText(group?.proposal_1 ?? ""),
        normalizeProposalText(group?.proposal_2 ?? ""),
        normalizeProposalText(group?.proposal_3 ?? ""),
      ].filter(Boolean),
      isValidated: Boolean(group?.is_validated),
    }))
    .filter((group) => group.isValidated && group.proposals.length > 0)
    .sort((a, b) => a.groupNumber - b.groupNumber);

  if (validatedGroups.length === 0) {
    window.alert("Aucune proposition validée à exporter.");
    return;
  }

  const sections: string[] = [];

  sections.push("# CONSOLIDATION DES PROPOSITIONS ÉTUDIANTES");
  sections.push("");
  sections.push("## INSTRUCTIONS");
  sections.push(buildConsolidationPrompt());
  sections.push("");
  sections.push("## DONNÉES DES GROUPES");
  sections.push("");

  validatedGroups.forEach((group) => {
    sections.push(`Groupe ${group.groupNumber} :`);
    group.proposals.forEach((proposal) => {
      sections.push(`- ${proposal}`);
    });
    sections.push("");
  });

  sections.push("## RAPPEL");
  sections.push("Réponds sous forme de texte brut compatible import.");
  sections.push("Une proposition par ligne numérotée.");
  sections.push("");

  const fileContent = sections.join("\n");

  const sessionCodePart = sanitizeFilenamePart(selectedSessionCode || "session");
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  const fileName = `consolidation_${sessionCodePart}_${yyyy}-${mm}-${dd}.txt`;

  const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);

  setMessage(`Fichier de consolidation exporté : ${fileName}`);
}

function parseConsolidatedTxt(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;

      // garde uniquement lignes type "1. Texte"
      return /^\d+\.\s+/.test(line);
    })
    .map((line) => {
      // enlève "1. "
      return line.replace(/^\d+\.\s+/, "").trim();
    })
    .filter(Boolean);
}

function cleanProposals(proposals: string[]): string[] {
  const unique = new Set<string>();

  proposals.forEach((p) => {
    const clean = p.replace(/\s+/g, " ").trim();
    if (!clean) return;
    unique.add(clean);
  });

  return Array.from(unique).slice(0, 10); // max 10
}

function previewImportedProposalsFromText() {
  const parsed = parseConsolidatedTxt(importedProposalRawText);
  const cleaned = cleanProposals(parsed);

  if (cleaned.length === 0) {
    window.alert("Aucune proposition valide détectée dans le texte collé.");
    return;
  }

  setImportedProposalDrafts(cleaned);
  setMessage(
    `${cleaned.length} proposition(s) détectée(s). Vérifiez-les puis cliquez sur "Soumettre ces propositions au vote".`
  );
}
async function submitImportedProposalsToVote() {
  if (!selectedSessionId) {
    window.alert("Aucune session sélectionnée.");
    return;
  }

  if (importedProposalDrafts.length === 0) {
    window.alert("Aucune proposition importée à soumettre.");
    return;
  }

  const hasExistingConsolidation = consolidatedProposals.length > 0;
  const hasVotes = teacherVoteRows.length > 0;

  if (hasExistingConsolidation || hasVotes) {
    const confirmed = window.confirm(
      hasVotes
        ? "Des propositions ou des votes existent déjà. Soumettre ces nouvelles propositions peut écraser l'existant et rendre les votes incohérents. Continuer ?"
        : "Des propositions consolidées existent déjà. Les remplacer ?"
    );

    if (!confirmed) return;
  }

  setIsSubmittingImportedProposals(true);

  const payload = importedProposalDrafts.map((text) => ({
    text,
    sourceGroupNumbers: [],
  }));

  const { error } = await supabase.rpc("regenerate_consolidated_proposals", {
    p_session_id: selectedSessionId,
    p_theme: "vote",
    p_payload: payload,
  });

  setIsSubmittingImportedProposals(false);

  if (error) {
    setMessage(`Erreur soumission propositions : ${error.message}`);
    return;
  }

  await loadConsolidatedProposals(selectedSessionId);
  await loadTeacherVoteRows(selectedSessionId);

setImportedProposalDrafts([]);
setImportedProposalRawText("");
setTeacherVoteView("proposals");
setMessage("Propositions soumises au vote avec succès.");
}

async function saveTeacherGroupProposals(params: {
  sessionId: string;
  groupNumber: number;
  proposal_1: string;
  proposal_2: string;
  proposal_3: string;
  is_validated: boolean;
  source?: "teacher" | "student";
}) {
  const {
    sessionId,
    groupNumber,
    proposal_1,
    proposal_2,
    proposal_3,
    is_validated,
    source = "teacher",
  } = params;

  const cleaned1 = normalizeProposalText(proposal_1);
  const cleaned2 = normalizeProposalText(proposal_2);
  const cleaned3 = normalizeProposalText(proposal_3);

  const proposals = [cleaned1, cleaned2, cleaned3].filter(Boolean);

  if (is_validated && proposals.length === 0) {
    window.alert("Ajoutez au moins une proposition avant de valider.");
    return false;
  }

  const uniqueLower = new Set(proposals.map((p) => p.toLowerCase()));
  if (uniqueLower.size !== proposals.length) {
    window.alert("Évitez les propositions en doublon.");
    return false;
  }

  let error: { message: string } | null = null;

  if (source === "student") {
    const response = await supabase.rpc("save_group_proposals_student", {
      p_session_id: sessionId,
      p_group_number: groupNumber,
      p_proposal_1: cleaned1,
      p_proposal_2: cleaned2,
      p_proposal_3: cleaned3,
      p_is_validated: is_validated,
    });

    error = response.error ?? null;
  } else {
    const response = await supabase
      .from("group_proposals")
      .upsert(
        {
          session_id: sessionId,
          group_number: groupNumber,
          proposal_1: cleaned1 || null,
          proposal_2: cleaned2 || null,
          proposal_3: cleaned3 || null,
          is_validated,
          updated_by: teacherUserId || null,
        },
        { onConflict: "session_id,group_number" }
      );

    error = response.error ?? null;
  }

  if (error) {
    setMessage(`Erreur sauvegarde propositions : ${error.message}`);
    return false;
  }

  setTeacherGroupProposals((prev) => ({
    ...prev,
    [groupNumber]: {
      proposal_1: cleaned1,
      proposal_2: cleaned2,
      proposal_3: cleaned3,
      is_validated,
    },
  }));

  return true;
}

async function handleValidateGroupProposals(groupNumber: number, source: "teacher" | "student" = "teacher") {
  const sessionId = source === "student" ? studentSelectedSessionId : selectedSessionId;
  if (!sessionId) return;

  const current = teacherGroupProposals[groupNumber] ?? emptyGroupProposalState();

const ok = await saveTeacherGroupProposals({
  sessionId,
  groupNumber,
  proposal_1: current.proposal_1,
  proposal_2: current.proposal_2,
  proposal_3: current.proposal_3,
  is_validated: true,
  source,
});

  if (!ok) return;

  setMessage(`Propositions du groupe ${groupNumber} validées.`);
}

async function handleUnlockGroupProposals(groupNumber: number, source: "teacher" | "student" = "teacher") {
  const sessionId = source === "student" ? studentSelectedSessionId : selectedSessionId;
  if (!sessionId) return;

  const confirmed = window.confirm(
    `Voulez-vous réactiver la modification des propositions du groupe ${groupNumber} ?`
  );
  if (!confirmed) return;

  const current = teacherGroupProposals[groupNumber] ?? emptyGroupProposalState();

const ok = await saveTeacherGroupProposals({
  sessionId,
  groupNumber,
  proposal_1: current.proposal_1,
  proposal_2: current.proposal_2,
  proposal_3: current.proposal_3,
  is_validated: false,
  source,
});

  if (!ok) return;

  setMessage(`Modification réactivée pour le groupe ${groupNumber}.`);
}

  async function loadTeacherSessions(userId: string) {
    const { data, error } = await supabase
      .from("sessions")
      // ✅ CORRIGÉ : ajout de allowed_emails dans le select
.select("id,title,campus,session_code,created_at")
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Erreur chargement sessions : ${error.message}`);
      return;
    }

    setTeacherSessions((data ?? []) as SessionRow[]);
  }


async function loadCurrentUserRole(_userId: string) {
  const { data, error } = await supabase.rpc("get_my_role");

  if (error) {
    setMessage(`Erreur chargement rôle utilisateur : ${error.message}`);
    return "";
  }

  const role = (data ?? "") as "admin" | "teacher" | "student" | "";
  setCurrentUserRole(role);
  return role;
}

async function loadTeacherProfileName(userId: string) {
  if (!userId) {
    setTeacherDisplayName("");
    return;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("name,email")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Erreur chargement profil prof :", error);
    setTeacherDisplayName("");
    return;
  }

  setTeacherDisplayName(String(data?.name ?? ""));
}

  async function loadAdminTeachers() {
    const { data, error } = await supabase
      .from("admin_teachers_overview")
      .select("*");

    if (error) {
      setMessage(`Erreur chargement professeurs : ${error.message}`);
      return;
    }

    setAdminTeachers(data ?? []);
  }

  async function loadAdminSessions() {
    const { data, error } = await supabase
      .from("admin_sessions_overview")
      .select("*");

    if (error) {
      setMessage(`Erreur chargement sessions admin : ${error.message}`);
      return;
    }

    setAdminSessions(data ?? []);
  }

  async function handleAdminDeactivateTeacher(userId: string) {
    const { error } = await supabase.rpc("admin_deactivate_teacher", {
      p_target_user_id: userId,
    });

    if (error) {
      setMessage(`Erreur désactivation professeur : ${error.message}`);
      return;
    }

    await loadAdminTeachers();
  }

  async function handleAdminReactivateTeacher(userId: string) {
    const { error } = await supabase.rpc("admin_reactivate_teacher", {
      p_target_user_id: userId,
    });

    if (error) {
      setMessage(`Erreur réactivation professeur : ${error.message}`);
      return;
    }

    await loadAdminTeachers();
  }

  async function handleAdminPromote(userId: string) {
    const { error } = await supabase.rpc("admin_promote_teacher_to_admin", {
      p_target_user_id: userId,
    });

    if (error) {
      setMessage(`Erreur promotion admin : ${error.message}`);
      return;
    }

    await loadAdminTeachers();
  }

  async function handleAdminDemote(userId: string) {
    const { error } = await supabase.rpc("admin_demote_admin_to_teacher", {
      p_target_user_id: userId,
    });

    if (error) {
      setMessage(`Erreur retour au rôle professeur : ${error.message}`);
      return;
    }

    await loadAdminTeachers();
  }

  function handleStartTeacherEdit(teacher: any) {
    setEditingTeacherId(String(teacher.user_id));
    setEditingTeacherName(String(teacher.name ?? teacher.full_name ?? ""));
    setEditingTeacherEmail(String(teacher.email ?? ""));
    setOpenTeacherActionsId(null);
  }

  async function handleSaveTeacherEdit() {
    if (!editingTeacherId) return;

    const normalizedEmail = normalizeEmail(editingTeacherEmail);
    const normalizedName = editingTeacherName.trim();

    if (!normalizedName || !normalizedEmail) {
      setMessage("Nom et email obligatoires pour la modification.");
      return;
    }

    const { error } = await supabase.rpc("admin_update_teacher_profile", {
      p_target_user_id: editingTeacherId,
      p_name: normalizedName,
      p_email: normalizedEmail,
    });

    if (error) {
      setMessage(`Erreur modification professeur : ${error.message}`);
      return;
    }

    setEditingTeacherId(null);
    setEditingTeacherName("");
    setEditingTeacherEmail("");
    await loadAdminTeachers();
    setMessage("Professeur modifié.");
  }

async function handleAdminDeleteTeacher(userId: string) {
  const ok = window.confirm("Supprimer définitivement ce professeur ?");
  if (!ok) return;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setMessage("Vous devez être connecté en admin.");
      return;
    }

    const response = await fetch(
      "https://xfseuhgjfadxvwjgtlce.supabase.co/functions/v1/delete_teacher",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      }
    );

    const rawText = await response.text();

    let data: any = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { raw: rawText };
    }

    if (!response.ok) {
      setMessage(`Erreur suppression professeur : ${data?.error || rawText || response.status}`);
      return;
    }

    await loadAdminTeachers();
    setMessage("Professeur supprimé.");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur réseau";
    setMessage(`Erreur suppression professeur : ${message}`);
  }
}

async function handleCreateTeacher(name: string, email: string, password: string) {
  setMessage("");

  const normalizedName = name.trim();
  const normalizedEmail = normalizeEmail(email);
  const safePassword = password.trim();

  if (!normalizedName || !normalizedEmail || !safePassword) {
    setMessage("Nom, email et mot de passe obligatoires.");
    return;
  }

  setIsCreatingTeacher(true);

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setMessage("Vous devez être connecté en admin.");
      return;
    }

    const response = await fetch(
      "https://xfseuhgjfadxvwjgtlce.supabase.co/functions/v1/create_teacher",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: normalizedName,
          email: normalizedEmail,
          password: safePassword,
        }),
      }
    );

    const rawText = await response.text();

    let data: any = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { raw: rawText };
    }

    if (!response.ok) {
      setMessage(`Erreur création professeur : ${data?.error || rawText || response.status}`);
      return;
    }

    setNewTeacherName("");
    setNewTeacherEmail("");
    setNewTeacherPassword("");
    setMessage(`Professeur créé avec succès : ${normalizedEmail}`);

    loadAdminTeachers().catch(console.error);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur réseau";
    setMessage(`Erreur création professeur : ${message}`);
  } finally {
    setIsCreatingTeacher(false);
  }
}

  async function handleGoToAdminFromTeacher() {
    if (currentUserRole !== "admin") {
      window.alert("Accès refusé : vous n'avez pas les droits administrateur.");
      return;
    }

    await loadAdminTeachers();
    await loadAdminSessions();
    setAdminTab("teachers");
    setScreen("admin_dashboard" as Screen);
    setMessage("Interface administrateur ouverte.");
  }

  async function loadSessionCounts(sessionId: string) {
    if (!sessionId) {
      setCounts(EMPTY_COUNTS);
      return;
    }

    const { data, error } = await supabase.rpc("get_session_response_counts", {
      p_session_id: sessionId,
    });

    if (error) {
      setCounts(EMPTY_COUNTS);
      setMessage(`Erreur suivi des réponses : ${error.message}`);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    setCounts({
      transport_count: Number(row?.transport_count ?? 0),
      dejeuner_count: Number(row?.dejeuner_count ?? 0),
      equipement_count: Number(row?.equipement_count ?? 0),
      autres_count: Number(row?.autres_count ?? 0),
    });
  }

  async function loadTransportReportRows(
    sessionId: string,
    setRows: React.Dispatch<React.SetStateAction<GroupReportRow[]>>
  ) {
    if (!sessionId) {
      setRows([]);
      return;
    }

    const { data, error } = await supabase
      .from("group_reports")
      .select("*")
      .eq("session_id", sessionId)
      .eq("theme", "transport")
      .order("group_number", { ascending: true })
      .order("row_key", { ascending: true });

    if (error) {
      setRows([]);
      setMessage(`Erreur chargement report transport : ${error.message}`);
      return;
    }

    setRows(normalizeGroupReportRows((data ?? []) as GroupReportRow[]));
  }

  async function loadDejeunerReportRows(
    sessionId: string,
    setRows: React.Dispatch<React.SetStateAction<GroupReportRow[]>>
  ) {
    await loadGroupReportRowsWithFallback(sessionId, setRows, ["dejeuner"], "déjeuner");
  }
function normalizeGroupReportTheme(theme: string | null | undefined) {
  const cleanTheme = String(theme ?? "").trim();
  if (cleanTheme === "autres") return "autres_consommations";
  if (cleanTheme === "salle_de_cours") return "salle";
  return cleanTheme;
}

function normalizeGroupReportRows(rows: GroupReportRow[]) {
  return rows.map((row) => {
    const normalizedTheme = normalizeGroupReportTheme(row.theme);
    const distanceTotalKm =
      normalizedTheme === "transport"
        ? Number(row.quantity ?? 0)
        : Number((row as any).distanceTotalKm ?? row.quantity ?? 0);

    return {
      ...row,
      theme: normalizedTheme,
      group_number: Number(row.group_number),
      label:
        normalizedTheme === "transport"
          ? getTransportLabelFr(row.row_key, row.label)
          : row.label,
      quantity: row.quantity === null || row.quantity === undefined ? 0 : Number(row.quantity),
      persons: row.persons === null || row.persons === undefined ? 0 : Number(row.persons),
      factor: row.factor === null || row.factor === undefined ? 0 : Number(row.factor),
      distanceTotalKm: Number.isFinite(distanceTotalKm) ? distanceTotalKm : 0,
    } as GroupReportRow & { distanceTotalKm: number };
  }) as GroupReportRow[];
}

async function loadGroupReportRowsWithFallback(
  sessionId: string,
  setRows: React.Dispatch<React.SetStateAction<GroupReportRow[]>>,
  themes: string[],
  errorLabel: string
) {
  if (!sessionId) {
    setRows([]);
    return;
  }

  const { data, error } = await supabase
    .from("group_reports")
    .select("*")
    .eq("session_id", sessionId)
    .in("theme", themes)
    .order("group_number", { ascending: true })
    .order("row_key", { ascending: true });

  if (error) {
    setMessage(`Erreur chargement report ${errorLabel} : ${error.message}`);
    setRows([]);
    return;
  }

  // Lecture stricte : on ne va jamais chercher des données d'une ancienne session
  // avec le même code. Cela évite les reports fantômes et réduit l'egress.
  setRows(normalizeGroupReportRows((data ?? []) as GroupReportRow[]));
}

async function loadEquipementReportRows(
  sessionId: string,
  setRows: React.Dispatch<React.SetStateAction<GroupReportRow[]>>
) {
  await loadGroupReportRowsWithFallback(sessionId, setRows, ["equipement"], "équipement");
}

async function loadTransportReportableRows(
  sessionId: string,
  setRows: React.Dispatch<React.SetStateAction<ReportableRow[]>>
) {
  if (!sessionId) {
    setRows([]);
    return;
  }

  const normalizeReportableRows = (rows: ReportableRow[]) =>
    rows
      .map((row) => ({
        rowKey: String(row.rowKey ?? ""),
        label: getTransportLabelFr(row.rowKey, row.label),
        persons: Number(row.persons ?? 0),
        quantity: Number(row.quantity ?? 0),
      }))
      // Important : l'onglet "Données à reporter" ne doit afficher que les
      // moyens réellement présents dans les questionnaires, pas tout le template.
      .filter((row) => Number(row.persons ?? 0) > 0 || Number(row.quantity ?? 0) > 0);

  const buildRowsFromResponsesTransport = async () => {
    const { data, error } = await supabase
      .from("responses_transport")
      .select("respondent_email, mode, distance_km, car_type, car_passengers")
      .eq("session_id", sessionId);

    if (error) {
      setRows([]);
      setMessage(`Erreur chargement réponses transport : ${error.message}`);
      return;
    }

    const aggregates = new Map<
      string,
      { rowKey: string; label: string; persons: number; quantity: number; respondents: Set<string> }
    >();

    ((data ?? []) as Array<{
      respondent_email?: string | null;
      mode?: string | null;
      distance_km?: number | string | null;
      car_type?: string | null;
      car_passengers?: number | string | null;
    }>).forEach((trip) => {
      const rowKey = normalizeTransportResponseRowKey(trip.mode, trip.car_type);
      if (!rowKey) return;

      const distance = Math.max(0, Number(trip.distance_km ?? 0));
      if (!Number.isFinite(distance) || distance <= 0) return;

      const current = aggregates.get(rowKey) ?? {
        rowKey,
        label: getTransportFallbackLabel(rowKey),
        persons: 0,
        quantity: 0,
        respondents: new Set<string>(),
      };

      current.quantity += distance;

      if (String(trip.mode ?? "") === "car") {
        const passengers = Math.max(1, Number(trip.car_passengers ?? 1));
        current.persons += Number.isFinite(passengers) && passengers > 0 ? 1 / passengers : 1;
      } else {
        const email = String(trip.respondent_email ?? "").trim().toLowerCase();
        if (email) current.respondents.add(email);
        else current.persons += 1;
      }

      aggregates.set(rowKey, current);
    });

    const fallbackRows = Array.from(aggregates.values()).map((row) => ({
      rowKey: row.rowKey,
      label: getTransportLabelFr(row.rowKey, row.label),
      persons: row.respondents.size > 0 ? row.respondents.size : row.persons,
      quantity: row.quantity,
    }));

    setRows(normalizeReportableRows(fallbackRows));
  };

  const { data, error } = await supabase.rpc("get_transport_reportable_rows", {
    p_session_id: sessionId,
  });

  if (!error) {
    const rpcRows = normalizeReportableRows(
      ((data ?? []) as TransportReportableRowRpc[]).map((row) => ({
        rowKey: String(row.row_key ?? ""),
        label: getTransportLabelFr(row.row_key, row.label),
        persons: Number(row.persons ?? 0),
        quantity: Number(row.quantity ?? 0),
      }))
    );

    if (rpcRows.length > 0) {
      setRows(rpcRows);
      return;
    }
  }

  // Fallback ciblé transport : si la RPC renvoie seulement le template à 0
  // ou rien, on reconstruit les données à reporter depuis responses_transport.
  // Cela ne touche pas group_reports et ne crée aucun report automatique.
  await buildRowsFromResponsesTransport();
}


  async function loadDejeunerReportableRowsWithSetter(
    sessionId: string,
    setRows: React.Dispatch<React.SetStateAction<DejeunerReportableRowRpc[]>>
  ) {
    if (!sessionId) {
      setRows([]);
      return;
    }

    const { data, error } = await supabase.rpc("get_dejeuner_reportable_rows", {
      p_session_id: sessionId,
    });

    if (error) {
      setRows([]);
      setMessage(`Erreur chargement données à reporter déjeuner : ${error.message}`);
      return;
    }

    setRows((data ?? []) as DejeunerReportableRowRpc[]);
  }

  async function loadDejeunerReportableRows(sessionId: string) {
    await loadDejeunerReportableRowsWithSetter(sessionId, setStudentDejeunerReportableRows);
  }

  async function loadTeacherDejeunerReportableRows(sessionId: string) {
    await loadDejeunerReportableRowsWithSetter(sessionId, setTeacherDejeunerReportableRows);
  }
async function loadEquipementReportableRowsWithSetter(
  sessionId: string,
  setRows: React.Dispatch<React.SetStateAction<EquipementReportableRowRpc[]>>
) {
  if (!sessionId) {
    setRows([]);
    return;
  }

  const { data, error } = await supabase.rpc("get_equipement_reportable_rows", {
    p_session_id: sessionId,
  });

  if (error) {
    setRows([]);
    setMessage(`Erreur chargement données à reporter équipement : ${error.message}`);
    return;
  }

  setRows((data ?? []) as EquipementReportableRowRpc[]);
}

async function loadEquipementReportableRows(sessionId: string) {
  await loadEquipementReportableRowsWithSetter(sessionId, setStudentEquipementReportableRows);
}

async function loadTeacherEquipementReportableRows(sessionId: string) {
  await loadEquipementReportableRowsWithSetter(sessionId, setTeacherEquipementReportableRows);
}

async function loadAutresReportRows(
  sessionId: string,
  setRows: React.Dispatch<React.SetStateAction<GroupReportRow[]>>
) {
  await loadGroupReportRowsWithFallback(
    sessionId,
    setRows,
    ["autres_consommations", "autres"],
    "autres consommations"
  );
}

async function loadSalleReportRows(
  sessionId: string,
  setRows: React.Dispatch<React.SetStateAction<GroupReportRow[]>>
) {
  await loadGroupReportRowsWithFallback(
    sessionId,
    setRows,
    ["salle", "salle_de_cours"],
    "salle"
  );
}

async function loadAutresReportableRowsWithSetter(
  sessionId: string,
  setRows: React.Dispatch<React.SetStateAction<AutresReportableRowRpc[]>>
) {
  if (!sessionId) {
    setRows([]);
    return;
  }

  const { data, error } = await supabase.rpc("get_autres_consommations_reportable_rows", {
    p_session_id: sessionId,
  });

  if (error) {
    setRows([]);
    setMessage(`Erreur chargement données à reporter autres consommations : ${error.message}`);
    return;
  }

  setRows((data ?? []) as AutresReportableRowRpc[]);
}

async function loadAutresReportableRows(sessionId: string) {
  await loadAutresReportableRowsWithSetter(sessionId, setStudentAutresReportableRows);
}

async function loadTeacherAutresReportableRows(sessionId: string) {
  await loadAutresReportableRowsWithSetter(sessionId, setTeacherAutresReportableRows);
}

async function loadSessionAnalysisAccess(sessionId: string) {
  if (!sessionId) {
    setStudentAnalysisUnlocked(false);
    return false;
  }

  const { data, error } = await supabase.rpc("get_session_analysis_access", {
    p_session_id: sessionId,
  });

  if (error) {
    setStudentAnalysisUnlocked(false);
    return false;
  }

  const unlocked = Boolean(data);
  setStudentAnalysisUnlocked(unlocked);
  return unlocked;
}

async function loadSessionSyntheseAccess(sessionId: string) {
  if (!sessionId) {
    setStudentSyntheseUnlocked(false);
    return false;
  }

  const { data, error } = await supabase.rpc("get_session_synthese_access", {
    p_session_id: sessionId,
  });

  if (error) {
    setStudentSyntheseUnlocked(false);
    return false;
  }

  const unlocked = Boolean(data);
  setStudentSyntheseUnlocked(unlocked);
  return unlocked;
}

async function loadSessionVoteAccess(sessionId: string) {
  if (!sessionId) {
    setStudentVoteUnlocked(false);
    setConsolidatedProposals([]);
    setStudentVotes({});
    return false;
  }

  const { data, error } = await supabase.rpc("get_session_vote_access", {
    p_session_id: sessionId,
  });

  if (error) {
    setStudentVoteUnlocked(false);
    return false;
  }

  const unlocked = Boolean(data);
  setStudentVoteUnlocked(unlocked);
  return unlocked;
}

async function toggleStudentAnalysisAccess() {
  if (!selectedSessionId) return;

  const nextValue = !studentAnalysisUnlocked;

  const { error } = await supabase
    .from("sessions")
    .update({ student_analysis_unlocked: nextValue })
    .eq("id", selectedSessionId);

  if (error) {
    setMessage(`Erreur mise à jour accès analyse : ${error.message}`);
    return;
  }

  setStudentAnalysisUnlocked(nextValue);
  await loadSessionAnalysisAccess(selectedSessionId);
}

  async function toggleStudentSyntheseAccess() {
    if (!selectedSessionId) return;

    const nextValue = !studentSyntheseUnlocked;

    const { error } = await supabase
      .from("sessions")
      .update({ student_synthese_unlocked: nextValue })
      .eq("id", selectedSessionId);

    if (error) {
      setMessage(`Erreur mise à jour accès synthèse : ${error.message}`);
      return;
    }

    setStudentSyntheseUnlocked(nextValue);
    await loadSessionSyntheseAccess(selectedSessionId);
  }

  async function toggleStudentVoteAccess() {
    if (!selectedSessionId) return;

    const nextValue = !studentVoteUnlocked;

    const { error } = await supabase
      .from("sessions")
      .update({ student_vote_unlocked: nextValue })
      .eq("id", selectedSessionId);

    if (error) {
      setMessage(`Erreur mise à jour accès vote : ${error.message}`);
      return;
    }

    setStudentVoteUnlocked(nextValue);
    await loadSessionVoteAccess(selectedSessionId);
  }

  function notifyTransportReportChanged(sessionId: string) {
    if (!sessionId || typeof window === "undefined") return;

    const payload = {
      sessionId,
      theme: "transport",
      timestamp: Date.now(),
    };

    try {
      window.localStorage.setItem("group_reports_changed", JSON.stringify(payload));
    } catch {
      // localStorage peut être indisponible en navigation privée stricte.
    }

    window.dispatchEvent(
      new CustomEvent("group_reports_changed_local", { detail: payload })
    );
  }

  async function saveTransportReportRow(params: {
    sessionId: string;
    groupNumber: number;
    rowKey: string;
    label: string;
    persons: number;
    distanceTotalKm: number;
    factor: number;
    updatedBy: string | null;
  }) {
    if (studentAssignedGroup && params.sessionId === studentSelectedSessionId && params.groupNumber !== studentAssignedGroup) {
      setMessage(`Accès limité au groupe ${studentAssignedGroup}. Sauvegarde forcée sur votre groupe.`);
    }

    const { sessionId, rowKey, persons, distanceTotalKm, factor, updatedBy } = params;
    const groupNumber = studentAssignedGroup && sessionId === studentSelectedSessionId ? studentAssignedGroup : params.groupNumber;

    if (!sessionId || !groupNumber || !rowKey) return;

    const safePersons = Math.max(0, Number(persons || 0));
    const safeDistanceTotalKm = Math.max(0, Number(distanceTotalKm || 0));
    const safeFactor = Math.max(0, Number(factor || 0));
    const safeLabel = getTransportLabelFr(rowKey, params.label);

    const payload = {
      session_id: sessionId,
      group_number: groupNumber,
      theme: "transport",
      row_key: rowKey,
      label: safeLabel,
      persons: safePersons,
      quantity: safeDistanceTotalKm,
      factor: safeFactor,
      updated_by: updatedBy && /^[0-9a-fA-F-]{36}$/.test(updatedBy) ? updatedBy : null,
    };

    const optimisticRow = {
      ...payload,
      persons: safePersons,
      quantity: safeDistanceTotalKm,
      distanceTotalKm: safeDistanceTotalKm,
    } as unknown as GroupReportRow & { distanceTotalKm: number };

    const applyOptimisticUpdate = (
      rows: GroupReportRow[],
      targetSessionId: string,
      targetGroupNumber: number
    ) => {
      if (sessionId !== targetSessionId || groupNumber !== targetGroupNumber) return rows;

      const nextRows = normalizeGroupReportRows([...rows]);
      const existingIndex = nextRows.findIndex(
        (row) =>
          String(row.session_id) === sessionId &&
          Number(row.group_number) === groupNumber &&
          normalizeGroupReportTheme(row.theme) === "transport" &&
          String(row.row_key) === rowKey
      );

      if (existingIndex >= 0) {
        nextRows[existingIndex] = {
          ...nextRows[existingIndex],
          ...optimisticRow,
        } as GroupReportRow;
        return nextRows;
      }

      nextRows.push(optimisticRow as GroupReportRow);
      return nextRows;
    };

    setStudentTransportReportRowsDb((prev) =>
      applyOptimisticUpdate(prev, studentSelectedSessionId, effectiveStudentGroupNumber)
    );
    setTeacherTransportReportRowsDb((prev) =>
      applyOptimisticUpdate(prev, selectedSessionId, teacherGroupNumber)
    );

    const { error } = await supabase.from("group_reports").upsert(
      payload,
      { onConflict: "session_id,group_number,theme,row_key" }
    );

    if (error) {
      setMessage(`Erreur sauvegarde report transport : ${error.message}`);
      if (studentSelectedSessionId && sessionId === studentSelectedSessionId) {
        await loadTransportReportRows(sessionId, setStudentTransportReportRowsDb);
      }
      return;
    }

    notifyTransportReportChanged(sessionId);

    // Rechargement ciblé, uniquement transport, pour confirmer la valeur DB.
    // Pas de polling global : l'egress reste maîtrisé.
    if (studentSelectedSessionId && sessionId === studentSelectedSessionId) {
      await loadTransportReportRows(sessionId, setStudentTransportReportRowsDb);
    }

    if (selectedSessionId && sessionId === selectedSessionId) {
      await loadTransportReportRows(sessionId, setTeacherTransportReportRowsDb);
    }
  }

  async function saveDejeunerReportRow(params: {
    sessionId: string;
    groupNumber: number;
    rowKey: string;
    label: string;
    quantity: number;
    factor: number;
updatedBy: string | null;
  }) {
    if (studentAssignedGroup && params.sessionId === studentSelectedSessionId && params.groupNumber !== studentAssignedGroup) {
      setMessage(`Accès limité au groupe ${studentAssignedGroup}. Sauvegarde forcée sur votre groupe.`);
    }

    const { sessionId, rowKey, label, quantity, factor, updatedBy } = params;
    const groupNumber = studentAssignedGroup && sessionId === studentSelectedSessionId ? studentAssignedGroup : params.groupNumber;

    const safeQuantity = Math.max(0, Number(quantity || 0));
    const safeFactor = Math.max(0, Number(factor || 0));

    const payload = {
      session_id: sessionId,
      group_number: groupNumber,
      theme: "dejeuner",
      row_key: rowKey,
      label,
      persons: safeQuantity > 0 ? safeQuantity : null,
      quantity: safeQuantity > 0 ? safeQuantity : null,
      factor: safeFactor,
      updated_by: updatedBy,
    };

    const applyOptimisticUpdate = (
      rows: GroupReportRow[],
      targetSessionId: string,
      targetGroupNumber: number
    ) => {
      if (sessionId !== targetSessionId || groupNumber !== targetGroupNumber) return rows;

      const nextRows = [...rows];
      const existingIndex = nextRows.findIndex(
        (row) =>
          row.session_id === sessionId &&
          row.group_number === groupNumber &&
          row.theme === "dejeuner" &&
          String(row.row_key) === rowKey
      );

      if (existingIndex >= 0) {
        nextRows[existingIndex] = {
          ...nextRows[existingIndex],
          ...payload,
        } as GroupReportRow;
        return nextRows;
      }

      nextRows.push(payload as unknown as GroupReportRow);
      return nextRows;
    };

    setStudentDejeunerReportRowsDb((prev) =>
      applyOptimisticUpdate(prev, studentSelectedSessionId, effectiveStudentGroupNumber)
    );
    setTeacherDejeunerReportRowsDb((prev) =>
      applyOptimisticUpdate(prev, selectedSessionId, teacherGroupNumber)
    );

    const { error } = await supabase.from("group_reports").upsert(
      payload,
      { onConflict: "session_id,group_number,theme,row_key" }
    );
console.log("SAVE REPORT ERROR", error);
    if (error) {
      setMessage(`Erreur sauvegarde report déjeuner : ${error.message}`);
      return;
    }

    if (studentSelectedSessionId && sessionId === studentSelectedSessionId) {
      await loadDejeunerReportRows(sessionId, setStudentDejeunerReportRowsDb);
      await loadDejeunerReportableRows(sessionId);
    }
  }
async function saveEquipementReportRow(params: {
  sessionId: string;
  groupNumber: number;
  rowKey: string;
  label: string;
  quantity: number;
  factor: number;
  updatedBy: string | null;
}) {
  const { sessionId, rowKey, label, quantity, factor, updatedBy } = params;
  const groupNumber =
    studentAssignedGroup && sessionId === studentSelectedSessionId
      ? studentAssignedGroup
      : params.groupNumber;

  if (!sessionId || !groupNumber || !rowKey) return;

  const safeQuantity = Math.max(0, Number(quantity || 0));
  const safeFactor = Math.max(0, Number(factor || 0));

  const payload = {
    session_id: sessionId,
    group_number: groupNumber,
    theme: "equipement",
    row_key: rowKey,
    label,
    persons: safeQuantity > 0 ? safeQuantity : null,
    quantity: safeQuantity > 0 ? safeQuantity : 0,
    factor: safeFactor,
    updated_by: updatedBy && /^[0-9a-fA-F-]{36}$/.test(updatedBy) ? updatedBy : null,
  };

  const applyOptimisticUpdate = (rows: GroupReportRow[]) => {
    const nextRows = normalizeGroupReportRows(rows);
    const existingIndex = nextRows.findIndex(
      (row) =>
        row.session_id === sessionId &&
        Number(row.group_number) === groupNumber &&
        normalizeGroupReportTheme(row.theme) === "equipement" &&
        String(row.row_key) === rowKey
    );

    if (existingIndex >= 0) {
      nextRows[existingIndex] = { ...nextRows[existingIndex], ...payload } as GroupReportRow;
      return nextRows;
    }

    nextRows.push(payload as unknown as GroupReportRow);
    return nextRows;
  };

  if (studentSelectedSessionId === sessionId) {
    setStudentEquipementReportRowsDb((prev) => applyOptimisticUpdate(prev));
  }
  if (selectedSessionId === sessionId) {
    setTeacherEquipementReportRowsDb((prev) => applyOptimisticUpdate(prev));
  }

  const { error } = await supabase.from("group_reports").upsert(
    payload,
    { onConflict: "session_id,group_number,theme,row_key" }
  );

  if (error) {
    setMessage(`Erreur sauvegarde report équipement : ${error.message}`);
    return;
  }
}

async function saveAutresReportRow(params: {
  sessionId: string;
  groupNumber: number;
  rowKey: string;
  label: string;
  quantity: number;
  factor: number;
  updatedBy: string | null;
}) {
  const { sessionId, rowKey, label, quantity, factor, updatedBy } = params;
  const groupNumber =
    studentAssignedGroup && sessionId === studentSelectedSessionId
      ? studentAssignedGroup
      : params.groupNumber;

  if (!sessionId || !groupNumber || !rowKey) return;

  const safeQuantity = Math.max(0, Number(quantity || 0));
  const safeFactor = Math.max(0, Number(factor || 0));

  const payload = {
    session_id: sessionId,
    group_number: groupNumber,
    theme: "autres_consommations",
    row_key: rowKey,
    label,
    persons: safeQuantity > 0 ? safeQuantity : null,
    quantity: safeQuantity > 0 ? safeQuantity : 0,
    factor: safeFactor,
    updated_by: updatedBy && /^[0-9a-fA-F-]{36}$/.test(updatedBy) ? updatedBy : null,
  };

  const applyOptimisticUpdate = (rows: GroupReportRow[]) => {
    const nextRows = normalizeGroupReportRows(rows);
    const existingIndex = nextRows.findIndex(
      (row) =>
        row.session_id === sessionId &&
        Number(row.group_number) === groupNumber &&
        normalizeGroupReportTheme(row.theme) === "autres_consommations" &&
        String(row.row_key) === rowKey
    );

    if (existingIndex >= 0) {
      nextRows[existingIndex] = { ...nextRows[existingIndex], ...payload } as GroupReportRow;
      return nextRows;
    }

    nextRows.push(payload as unknown as GroupReportRow);
    return nextRows;
  };

  if (studentSelectedSessionId === sessionId) {
    setStudentAutresReportRowsDb((prev) => applyOptimisticUpdate(prev));
  }
  if (selectedSessionId === sessionId) {
    setTeacherAutresReportRowsDb((prev) => applyOptimisticUpdate(prev));
  }

  const { error } = await supabase.from("group_reports").upsert(
    payload,
    { onConflict: "session_id,group_number,theme,row_key" }
  );

  if (error) {
    setMessage(`Erreur sauvegarde report autres consommations : ${error.message}`);
    return;
  }
}

async function saveSalleReportRow(params: {
  sessionId: string;
  groupNumber: number;
  rowKey: string;
  label: string;
  quantity: number;
  factor: number;
  updatedBy: string | null;
}) {
  const { sessionId, rowKey, label, quantity, updatedBy } = params;
  const groupNumber =
    studentAssignedGroup && sessionId === studentSelectedSessionId
      ? studentAssignedGroup
      : params.groupNumber;

  if (!sessionId || !groupNumber || !rowKey) return;

  const safeQuantity = Math.max(0, Number(quantity || 0));
  const safeFactor = rowKey === "ampoules" ? 0.004 : Math.max(0, Number(params.factor || 0));

  const payload = {
    session_id: sessionId,
    group_number: groupNumber,
    theme: "salle",
    row_key: rowKey,
    label,
    persons: safeQuantity > 0 ? safeQuantity : null,
    quantity: safeQuantity > 0 ? safeQuantity : 0,
    factor: safeFactor,
    updated_by: updatedBy && /^[0-9a-fA-F-]{36}$/.test(updatedBy) ? updatedBy : null,
  };

  const applyOptimisticUpdate = (rows: GroupReportRow[]) => {
    const nextRows = normalizeGroupReportRows(rows);
    const existingIndex = nextRows.findIndex(
      (row) =>
        row.session_id === sessionId &&
        Number(row.group_number) === groupNumber &&
        normalizeGroupReportTheme(row.theme) === "salle" &&
        String(row.row_key) === rowKey
    );

    if (existingIndex >= 0) {
      nextRows[existingIndex] = { ...nextRows[existingIndex], ...payload } as GroupReportRow;
      return nextRows;
    }

    nextRows.push(payload as unknown as GroupReportRow);
    return nextRows;
  };

  if (studentSelectedSessionId === sessionId) {
    setStudentSalleReportRowsDb((prev) => applyOptimisticUpdate(prev));
  }
  if (selectedSessionId === sessionId) {
    setTeacherSalleReportRowsDb((prev) => applyOptimisticUpdate(prev));
  }

  const { error } = await supabase.from("group_reports").upsert(
    payload,
    { onConflict: "session_id,group_number,theme,row_key" }
  );

  if (error) {
    setMessage(`Erreur sauvegarde report salle : ${error.message}`);
    return;
  }
}

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user || !active) return;
      setTeacherUserId(user.id);
      setTeacherUserEmail(user.email ?? "");
      setTeacherEmail(user.email ?? "");
      await loadTeacherProfileName(user.id);
      const role = await loadCurrentUserRole(user.id);
      if (!active) return;
      if (role === "admin") {
        await loadAdminTeachers();
        await loadAdminSessions();
        if (!active) return;
        setScreen("admin_dashboard" as Screen);
      } else {
        setTeacherMenu("sessions");
    setTeacherVoteView("proposals");
        setScreen("teacher_dashboard");
        await loadTeacherSessions(user.id);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!studentSelectedSessionId) return;
    void loadTransportReportableRows(studentSelectedSessionId, setStudentTransportReportableRows);
    void loadTransportReportRows(studentSelectedSessionId, setStudentTransportReportRowsDb);
    void loadDejeunerReportableRows(studentSelectedSessionId);
    void loadDejeunerReportRows(studentSelectedSessionId, setStudentDejeunerReportRowsDb);
    void loadEquipementReportableRows(studentSelectedSessionId);
    void loadEquipementReportRows(studentSelectedSessionId, setStudentEquipementReportRowsDb);
    void loadAutresReportableRows(studentSelectedSessionId);
    void loadAutresReportRows(studentSelectedSessionId, setStudentAutresReportRowsDb);
    void loadSalleReportRows(studentSelectedSessionId, setStudentSalleReportRowsDb);
    void loadSessionAnalysisAccess(studentSelectedSessionId);
    void loadSessionSyntheseAccess(studentSelectedSessionId);
    void loadSessionVoteAccess(studentSelectedSessionId);
    void loadConsolidatedProposals(studentSelectedSessionId);
    void loadStudentVotes(studentSelectedSessionId, studentEmail);
  }, [studentSelectedSessionId, studentEmail]);

  useEffect(() => {
    if (teacherMenu !== "session_open") return;
    if (
      teacherSessionTab !== "counts" &&
      teacherSessionTab !== "analyses" &&
      teacherSessionTab !== "vote" &&
      teacherSessionTab !== "synthese"
    ) return;
    if (!selectedSessionId) return;

    const timeoutId = window.setTimeout(() => {
      void loadSessionCounts(selectedSessionId);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [teacherMenu, teacherSessionTab, selectedSessionId]);

  useEffect(() => {
    if (screen !== "teacher_dashboard" && screen !== "teacher_session_settings") return;
    if (teacherMenu !== "session_open") return;
    if (!selectedSessionId) return;

    const timeoutId = window.setTimeout(() => {
      void loadTransportReportRows(selectedSessionId, setTeacherTransportReportRowsDb);
      void loadTransportReportableRows(selectedSessionId, setTeacherTransportReportableRows);
      void loadTeacherDejeunerReportableRows(selectedSessionId);
      void loadDejeunerReportRows(selectedSessionId, setTeacherDejeunerReportRowsDb);
      void loadTeacherEquipementReportableRows(selectedSessionId);
      void loadEquipementReportRows(selectedSessionId, setTeacherEquipementReportRowsDb);
      void loadTeacherAutresReportableRows(selectedSessionId);
      void loadAutresReportRows(selectedSessionId, setTeacherAutresReportRowsDb);
      void loadSalleReportRows(selectedSessionId, setTeacherSalleReportRowsDb);
      void loadSessionAnalysisAccess(selectedSessionId);
      void loadSessionSyntheseAccess(selectedSessionId);
      void loadSessionVoteAccess(selectedSessionId);
      void loadTeacherGroupProposals(selectedSessionId);
      void loadConsolidatedProposals(selectedSessionId);
      void loadTeacherVoteRows(selectedSessionId);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [screen, selectedSessionId, teacherMenu]);

  useEffect(() => {
    if (!selectedSessionId) return;

    function reloadChangedTheme(theme: string | null | undefined) {
      const normalizedTheme = normalizeGroupReportTheme(theme);

      if (normalizedTheme === "transport") {
        void loadTransportReportRows(selectedSessionId, setTeacherTransportReportRowsDb);
        return;
      }

      if (normalizedTheme === "dejeuner") {
        void loadDejeunerReportRows(selectedSessionId, setTeacherDejeunerReportRowsDb);
        return;
      }

      if (normalizedTheme === "equipement") {
        void loadEquipementReportRows(selectedSessionId, setTeacherEquipementReportRowsDb);
        return;
      }

      if (normalizedTheme === "autres_consommations") {
        void loadAutresReportRows(selectedSessionId, setTeacherAutresReportRowsDb);
        return;
      }

      if (normalizedTheme === "salle") {
        void loadSalleReportRows(selectedSessionId, setTeacherSalleReportRowsDb);
      }
    }

    function handleLocalGroupReportChange(event: Event) {
      const customEvent = event as CustomEvent<{ sessionId?: string; theme?: string }>;
      const payload = customEvent.detail;
      if (!payload || payload.sessionId !== selectedSessionId) return;
      reloadChangedTheme(payload.theme);
    }

    function handleStorageGroupReportChange(event: StorageEvent) {
      if (event.key !== "group_reports_changed" || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as { sessionId?: string; theme?: string };
        if (payload.sessionId !== selectedSessionId) return;
        reloadChangedTheme(payload.theme);
      } catch {
        // Ignore les anciens formats ou valeurs invalides.
      }
    }

    const channel = supabase
      .channel(`teacher-group-reports-${selectedSessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_reports",
          filter: `session_id=eq.${selectedSessionId}`,
        },
        (payload) => {
          const nextRow = ((payload as any).new ?? (payload as any).old) as GroupReportRow | undefined;
          reloadChangedTheme(nextRow?.theme);
        }
      )
      .subscribe();

    window.addEventListener("group_reports_changed_local", handleLocalGroupReportChange as EventListener);
    window.addEventListener("storage", handleStorageGroupReportChange);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("group_reports_changed_local", handleLocalGroupReportChange as EventListener);
      window.removeEventListener("storage", handleStorageGroupReportChange);
    };
  }, [selectedSessionId]);

  useEffect(() => {
    if (screen !== "student_analyses" || !studentSelectedSessionId) return;

    const timeoutId = window.setTimeout(() => {
      void loadTransportReportableRows(studentSelectedSessionId, setStudentTransportReportableRows);
      void loadTransportReportRows(studentSelectedSessionId, setStudentTransportReportRowsDb);
      void loadDejeunerReportableRows(studentSelectedSessionId);
      void loadDejeunerReportRows(studentSelectedSessionId, setStudentDejeunerReportRowsDb);
      void loadEquipementReportableRows(studentSelectedSessionId);
      void loadEquipementReportRows(studentSelectedSessionId, setStudentEquipementReportRowsDb);
      void loadAutresReportableRows(studentSelectedSessionId);
      void loadAutresReportRows(studentSelectedSessionId, setStudentAutresReportRowsDb);
      void loadSalleReportRows(studentSelectedSessionId, setStudentSalleReportRowsDb);
      void loadSessionAnalysisAccess(studentSelectedSessionId);
      void loadSessionSyntheseAccess(studentSelectedSessionId);
      void loadSessionVoteAccess(studentSelectedSessionId);
      void loadTeacherGroupProposals(studentSelectedSessionId);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [screen, studentSelectedSessionId]);

  useEffect(() => {
    if (screen !== "student_vote") return;
    if (!studentSelectedSessionId || !studentEmail) return;

    void loadConsolidatedProposals(studentSelectedSessionId);
    void loadStudentVotes(studentSelectedSessionId, studentEmail);
  }, [screen, studentSelectedSessionId, studentEmail]);



  useEffect(() => {
    if (studentTheme === "salle" && studentAnalysesTab === "donnees_a_reporter") {
      setStudentAnalysesTab("report_des_donnees");
      setStudentShowCarbonChart(false);
    }
  }, [studentTheme, studentAnalysesTab]);

  useEffect(() => {
    if (teacherTheme === "salle" && teacherAnalysesTab === "donnees_a_reporter") {
      setTeacherAnalysesTab("report_des_donnees");
      setTeacherShowCarbonChart(false);
    }
  }, [teacherTheme, teacherAnalysesTab]);

  useEffect(() => {
    if (screen === "student_bilans") {
      setScreen("student_synthese");
    }
  }, [screen]);

  useEffect(() => {
    if (teacherSessionTab === "bilans") {
      setTeacherSessionTab("synthese");
    }
  }, [teacherSessionTab]);


  useEffect(() => {
    if (!studentEmail.trim() || !studentCodeSession.trim()) return;
    if (![
      "student_mise_en_oeuvre", "student_transport", "student_dejeuner",
      "student_equipement", "student_autres", "student_analyses",
      "student_synthese", "student_vote",
    ].includes(screen)) return;
    saveStudentDraft();
  }, [saveStudentDraft, screen, studentCodeSession, studentEmail]);

  useEffect(() => {
    if (!teacherUserEmail.trim() || !selectedSessionCode.trim()) return;
    saveTeacherDraft();
  }, [saveTeacherDraft, selectedSessionCode, teacherUserEmail]);

  useEffect(() => {
    if (screen !== "teacher_dashboard") return;
    if (teacherMenu !== "sessions") return;
    if (!teacherUserId) return;
    void loadTeacherSessions(teacherUserId);
  }, [screen, teacherMenu, teacherUserId]);

async function handleTeacherLogin() {
  setMessage("");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(teacherEmail),
    password: teacherPassword,
  });

  if (error || !data.user) {
    setMessage(error?.message || "Connexion refusée.");
    return;
  }


  setTeacherUserId(data.user.id);
  setTeacherUserEmail(data.user.email ?? "");
  await loadTeacherProfileName(data.user.id);

  const role = await loadCurrentUserRole(data.user.id);

  if (authPortal === "admin") {
    if (role !== "admin") {
      setMessage("Ce compte n'a pas les droits administrateur.");
      await supabase.auth.signOut();
      return;
    }
    await loadAdminTeachers();
    await loadAdminSessions();
    setScreen("admin_dashboard" as Screen);
    setMessage("Connexion administrateur réussie.");
    return;
  }

  await loadTeacherSessions(data.user.id);
  setTeacherMenu("sessions");
  setScreen("teacher_dashboard");
  setMessage(
    role === "admin"
      ? "Connexion professeur (admin) réussie."
      : "Connexion professeur réussie."
  );
}

  async function handleTeacherLogout() {
    await supabase.auth.signOut();
    setTeacherEmail("");
    setTeacherPassword("");
    setTeacherUserId("");
    setTeacherUserEmail("");
    setTeacherDisplayName("");
    setOpenTeacherActionsId(null);
    setEditingTeacherId(null);
    setEditingTeacherName("");
    setEditingTeacherEmail("");
    setTeacherSessions([]);
    setSelectedSessionId("");
    setSelectedSessionCode("");
setQuickSessionCampus("");
setQuickSessionProgramme("");
setQuickSessionLevel("");
setQuickSessionSuffix("");
    setSettingsTitle("");
    setSettingsCampus("");
    setSettingsAllowedEmailsText("");
    setCounts(EMPTY_COUNTS);
    setTeacherTransportReportRowsDb([]);
    setStudentTransportReportRowsDb([]);
    setTeacherTransportReportableRows([]);
    setStudentTransportReportableRows([]);
    setTeacherDejeunerReportableRows([]);
    setStudentDejeunerReportableRows([]);
    setTeacherDejeunerReportRowsDb([]);
    setStudentDejeunerReportRowsDb([]);
    setTeacherEquipementReportableRows([]);
    setStudentEquipementReportableRows([]);
    setTeacherEquipementReportRowsDb([]);
    setStudentEquipementReportRowsDb([]);
    setTeacherAutresReportableRows([]);
    setStudentAutresReportableRows([]);
    setTeacherVoteRows([]);
    setTeacherAutresReportRowsDb([]);
    setStudentAutresReportRowsDb([]);
    setTeacherSalleReportRowsDb([]);
    setStudentSalleReportRowsDb([]);
    setTeacherMenu("sessions");
    setTeacherSessionTab("counts");
    setTeacherAnalysesTab("donnees_a_reporter");
    setTeacherShowCarbonChart(false);
    setOpenProposalGroup(null);
    setTeacherGroupProposals({});
    setConsolidatedProposals([]);
    setStudentShowCarbonChart(false);
    setStudentAnalysisUnlocked(false);
    setStudentSyntheseUnlocked(false);
    setStudentVoteUnlocked(false);
    setConsolidatedProposals([]);
    setCurrentUserRole("");
    setAdminTab("teachers");
    setAdminTeachers([]);
    setAdminSessions([]);
    setNewTeacherName("");
    setNewTeacherEmail("");
    setNewTeacherPassword("");
    setTeacherSearch("");
    setSessionSearch("");
    setIsCreatingTeacher(false);
    setAuthPortal("teacher");
    setMessage("");
    setScreen("home");
  }

async function handleCreateSessionQuick() {
  setMessage("");
  if (!teacherUserId) {
    setMessage("Professeur non connecté.");
    return;
  }

  if (
    !quickSessionCampus ||
    !quickSessionProgramme ||
    !quickSessionLevel ||
    !quickSessionSuffix.trim()
  ) {
    setMessage("Tous les champs sont obligatoires pour créer une session.");
    return;
  }

  const normalizedCode =
    `${quickSessionCampus}-${quickSessionProgramme}${quickSessionLevel}-${quickSessionSuffix}`
      .trim()
      .toUpperCase();

  const { data, error } = await supabase.rpc("create_session_quick", {
    p_session_code: normalizedCode,
    p_teacher_id: teacherUserId,
  });

  if (error) {
    setMessage(error.message);
    return;
  }

  setSelectedSessionId(String(data));
  setSelectedSessionCode(normalizedCode);
  setSettingsTitle(normalizedCode);
  setSettingsCampus("");

  if (assignmentMode === "emails") {
    setSettingsAllowedEmailsText(teacherUserEmail || "");
  } else {
    setSettingsAllowedEmailsText("");
  }

  setAssignmentMethod("import");
  setAssignmentRawText("");
  setQuickSessionCampus("");
  setQuickSessionProgramme("");
  setQuickSessionLevel("");
  setQuickSessionSuffix("");

  await loadTeacherSessions(teacherUserId);
  setScreen("teacher_session_settings");
  setMessage(`Session créée : ${normalizedCode}`);
}
async function handleOpenSession(session: SessionRow) {
  setMessage("");
  setSelectedSessionId(session.id);
  setSelectedSessionCode(session.session_code || "");
  const draft = loadTeacherDraft(teacherUserEmail, session.session_code || "");
  setSettingsTitle(session.title || "");
  setSettingsCampus(session.campus || "");

  const { data: emailData } = await supabase
    .from("session_allowed_emails")
    .select("email")
    .eq("session_id", session.id);

  const allowedEmailText = (emailData ?? []).map((row: { email: string }) => row.email).join("\n");
  setSettingsAllowedEmailsText(allowedEmailText);

  const { data: assignmentData } = await supabase
    .from("session_student_assignments")
    .select("email, first_name, last_name, group_number")
    .eq("session_id", session.id)
    .order("group_number", { ascending: true })
    .order("last_name", { ascending: true });

  if (assignmentData && assignmentData.length > 0) {
    const loadedAssignmentsText = assignmentData
      .map((student: any) =>
        [
          student.email ?? "",
          student.first_name ?? "",
          student.last_name ?? "",
          student.group_number ?? "",
        ].join(";")
      )
      .join("\n");

    setAssignmentMode("groups");
    setAssignmentMethod("import");
    setAssignmentRawText(loadedAssignmentsText);
    setSettingsAllowedEmailsText(
      assignmentData.map((student: any) => normalizeEmail(String(student.email ?? ""))).join("\n")
    );
  } else {
    const recoveredAssignments = parseStudentAssignments(allowedEmailText);

    if (recoveredAssignments.length > 0) {
      setAssignmentMode("groups");
      setAssignmentMethod("import");
      setAssignmentRawText(serializeStudentAssignments(recoveredAssignments));
      setSettingsAllowedEmailsText(recoveredAssignments.map((student) => student.email).join("\n"));
    } else {
      setAssignmentMode("emails");
      setAssignmentMethod("import");
      setAssignmentRawText("");
    }
  }


  setTeacherMenu("session_open");
  setTeacherSessionTab(draft?.teacherSessionTab ?? "counts");
  setTeacherAnalysesTab(draft?.teacherAnalysesTab ?? "donnees_a_reporter");
  setTeacherShowCarbonChart(false);
  setTeacherGroupNumber(draft?.teacherGroupNumber ?? 1);
  setScreen("teacher_dashboard");
  await loadSessionAnalysisAccess(session.id);
  await loadSessionVoteAccess(session.id);
  await loadSessionSyntheseAccess(session.id);
  await loadTeacherGroupProposals(session.id);
  await loadConsolidatedProposals(session.id);
  setMessage(`Session ouverte : ${formatSessionCode(session.session_code)}`);
}

  async function handleDeleteSession(session: SessionRow) {
    const ok = window.confirm(
      `Voulez-vous supprimer la session ${session.session_code || session.id} ?`
    );
    if (!ok) return;

    const { error } = await supabase.rpc("delete_session_secure", {
      p_session_id: session.id,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    if (selectedSessionId === session.id) {
      setSelectedSessionId("");
      setSelectedSessionCode("");
      setSettingsTitle("");
      setSettingsCampus("");
setAssignmentMode("emails");
setAssignmentMethod("import");
setAssignmentRawText("");
      setSettingsAllowedEmailsText("");
      setCounts(EMPTY_COUNTS);
      setTeacherTransportReportRowsDb([]);
      setTeacherTransportReportableRows([]);
      setTeacherDejeunerReportableRows([]);
      setTeacherDejeunerReportRowsDb([]);
      setTeacherEquipementReportableRows([]);
      setTeacherEquipementReportRowsDb([]);
      setTeacherAutresReportableRows([]);
      setTeacherAutresReportRowsDb([]);
      setTeacherSalleReportRowsDb([]);
      setConsolidatedProposals([]);
      setTeacherMenu("sessions");
      setTeacherSessionTab("counts");
      setTeacherAnalysesTab("donnees_a_reporter");
    }

    await loadTeacherSessions(teacherUserId);
    setMessage(`Session supprimée : ${formatSessionCode(session.session_code)}`);
  }


  function getNextAutoGroupNumber(assignments: StudentAssignmentDraft[]) {
    const countsByGroup = Array.from({ length: 10 }, (_, index) => ({
      groupNumber: index + 1,
      count: assignments.filter((student) => student.group_number === index + 1).length,
    }));

    countsByGroup.sort((a, b) => {
      if (a.count !== b.count) return a.count - b.count;
      return a.groupNumber - b.groupNumber;
    });

    return countsByGroup[0]?.groupNumber ?? 1;
  }

  function resetNewStudentForm() {
    setNewStudentEmail("");
    setNewStudentFirstName("");
    setNewStudentLastName("");
    setNewStudentGroupNumber(1);
    setAutoAssignNewStudentGroup(true);
  }

  function handleAddStudentToSessionDraft() {
    const normalizedNewEmail = normalizeEmail(newStudentEmail);

    if (!normalizedNewEmail || !normalizedNewEmail.includes("@")) {
      setMessage("Ajout impossible : l'email de l'étudiant est obligatoire.");
      return;
    }

    if (assignmentMode === "emails") {
      const emails = settingsAllowedEmailsText
        .split("\n")
        .map((value) => normalizeEmail(value))
        .filter(Boolean);

      if (emails.includes(normalizedNewEmail)) {
        setMessage("Cet étudiant est déjà présent dans la liste des emails autorisés.");
        return;
      }

      setSettingsAllowedEmailsText([...emails, normalizedNewEmail].join("\n"));
      resetNewStudentForm();
      setMessage("Étudiant ajouté à la liste. Pensez à enregistrer les paramètres.");
      return;
    }

    const firstName = newStudentFirstName.trim();
    const lastName = newStudentLastName.trim();

    if (!firstName || !lastName) {
      setMessage("Ajout impossible : prénom et nom sont obligatoires pour une session avec assignation.");
      return;
    }

    const currentAssignments = activeStudentAssignments;

    if (currentAssignments.some((student) => student.email === normalizedNewEmail)) {
      setMessage("Cet étudiant est déjà présent dans l'assignation.");
      return;
    }

    const groupNumber = autoAssignNewStudentGroup
      ? getNextAutoGroupNumber(currentAssignments)
      : Number(newStudentGroupNumber);

    if (!Number.isInteger(groupNumber) || groupNumber < 1 || groupNumber > 10) {
      setMessage("Ajout impossible : le groupe doit être compris entre 1 et 10.");
      return;
    }

    const nextAssignments = [
      ...currentAssignments,
      {
        email: normalizedNewEmail,
        first_name: firstName,
        last_name: lastName,
        group_number: groupNumber,
      },
    ];

    setAssignmentMode("groups");
    setAssignmentMethod("import");
    setAssignmentRawText(serializeStudentAssignments(nextAssignments));
    setSettingsAllowedEmailsText(nextAssignments.map((student) => student.email).join("\n"));
    resetNewStudentForm();
    setMessage(`Étudiant ajouté au groupe ${groupNumber}. Pensez à enregistrer les paramètres.`);
  }

  function downloadAssignmentExport() {
    const sourceAssignments =
      displayedStudentAssignments.length > 0 ? displayedStudentAssignments : activeStudentAssignments;

    const assignments = [...sourceAssignments].sort((a, b) => {
      if (a.group_number !== b.group_number) return a.group_number - b.group_number;
      const lastNameCompare = formatAssignmentLastName(a).localeCompare(formatAssignmentLastName(b));
      if (lastNameCompare !== 0) return lastNameCompare;
      return formatAssignmentFirstName(a).localeCompare(formatAssignmentFirstName(b));
    });

    if (!assignments.length) {
      setMessage("Aucune assignation à exporter.");
      return;
    }

    const content = [
      "Nom;Prénom;Groupe;Email",
      ...assignments.map((student) => [
        formatAssignmentLastName(student),
        formatAssignmentFirstName(student),
        String(student.group_number),
        student.email,
      ].join(";")),
    ].join("\n");

    downloadTextFile(`assignation_groupes_${formatSessionCode(selectedSessionCode || "session")}.csv`, content);
  }


  async function handleSaveSessionSettings() {
    setMessage("");

    if (!selectedSessionId) {
      setMessage("Aucune session sélectionnée.");
      return;
    }

const assignmentsToSave = assignmentMode === "groups" ? activeStudentAssignments : [];

const allowedEmails =
  assignmentMode === "groups"
    ? assignmentsToSave.map((student) => student.email)
    : settingsAllowedEmailsText
        .split("\n")
        .map((v) => normalizeEmail(v))
        .filter(Boolean);

            const { error } = await supabase.rpc("update_session_settings", {
      p_session_id: selectedSessionId,
      p_title: settingsTitle,
      p_campus: settingsCampus,
      p_allowed_emails: allowedEmails,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const { error: deleteAssignmentsError } = await supabase
  .from("session_student_assignments")
  .delete()
  .eq("session_id", selectedSessionId);

if (deleteAssignmentsError) {
  setMessage(`Paramètres emails enregistrés, mais erreur suppression assignations : ${deleteAssignmentsError.message}`);
  return;
}

if (assignmentMode === "groups") {
  if (assignmentsToSave.length === 0) {
    setMessage("Aucune assignation valide détectée. Vérifiez le format : email;prenom;nom;groupe.");
    return;
  }

  const { error: insertAssignmentsError } = await supabase
    .from("session_student_assignments")
    .insert(
      assignmentsToSave.map((student) => ({
        session_id: selectedSessionId,
        email: student.email,
        first_name: student.first_name,
        last_name: student.last_name,
        group_number: student.group_number,
      }))
    );

  if (insertAssignmentsError) {
    setMessage(`Paramètres emails enregistrés, mais erreur assignations : ${insertAssignmentsError.message}`);
    return;
  }

  setAssignmentMode("groups");
  setAssignmentMethod("import");
  setAssignmentRawText(serializeStudentAssignments(assignmentsToSave));
  setSettingsAllowedEmailsText(assignmentsToSave.map((student) => student.email).join("\n"));
}

    await loadTeacherSessions(teacherUserId);
   setMessage(`Paramètres enregistrés pour ${formatSessionCode(selectedSessionCode)}`);
    setScreen("teacher_dashboard");
    setTeacherMenu("sessions");
  }

async function handleStudentEnter() {
  setMessage("");

  if (!studentEmail.trim()) {
    setMessage("L'adresse mail est obligatoire.");
    return;
  }

  if (!studentCodeSession.trim()) {
    setMessage("Le code session est obligatoire.");
    return;
  }

  const normalizedStudentEmail = normalizeEmail(studentEmail);
  const normalizedSessionCode = studentCodeSession.trim().toLowerCase();

  // Sécurité groupe étudiant : cette fonction SQL SECURITY DEFINER est la source de vérité.
  // Elle renvoie une ligne uniquement si :
  // - la session existe ;
  // - l'email est autorisé ;
  // - et, si la session a des assignations, l'email appartient bien à un groupe.
  // On ne lit plus directement session_student_assignments côté étudiant, car une policy/RLS
  // ou un fallback peut faire croire à tort qu'il n'y a pas d'assignation.
  const { data: accessRows, error: accessError } = await supabase.rpc(
    "get_student_session_access",
    {
      p_session_code: normalizedSessionCode,
      p_email: normalizedStudentEmail,
    }
  );

  if (accessError) {
    setMessage(`Erreur vérification accès étudiant : ${accessError.message}`);
    return;
  }

  const accessRow = Array.isArray(accessRows) ? accessRows[0] : accessRows;

  if (!accessRow?.session_id) {
    setMessage("Code session invalide, email non autorisé ou email non assigné à un groupe pour cette session.");
    return;
  }

  // IMPORTANT : get_student_session_access peut renvoyer un ancien session_id si une session
  // portant le même code a existé. Pour que l étudiant et le professeur lisent/écrivent
  // exactement dans la même session, on recale toujours l id sur la session ouverte
  // correspondant au code saisi. C est cette même source qui est utilisée côté professeur.
  const { data: openSessionRows, error: openSessionError } = await supabase.rpc(
    "get_open_session_by_code",
    { p_session_code: normalizedSessionCode }
  );

  if (openSessionError) {
    setMessage(`Erreur chargement session ouverte : `);
    return;
  }

  const openSessionRow = Array.isArray(openSessionRows) ? openSessionRows[0] : openSessionRows;

  if (!openSessionRow?.id) {
    setMessage("Session introuvable ou fermée pour ce code.");
    return;
  }

  const nextSessionId = String(openSessionRow.id);
  const nextSessionCode = String(openSessionRow.session_code ?? accessRow.session_code ?? normalizedSessionCode);

  if (String(accessRow.session_id) !== nextSessionId) {
    console.warn("Session étudiant recalée sur la session ouverte", {
      accessSessionId: String(accessRow.session_id),
      openSessionId: nextSessionId,
      code: normalizedSessionCode,
    });
  }

  const assignedGroupNumber = Number(accessRow.assigned_group_number ?? 0);
  const hasAssignments = Boolean(accessRow.has_assignments);

  if (hasAssignments) {
    if (!Number.isInteger(assignedGroupNumber) || assignedGroupNumber < 1 || assignedGroupNumber > 10) {
      setMessage("Email non assigné à un groupe pour cette session.");
      return;
    }

    setStudentAssignedGroup(assignedGroupNumber);
    setStudentAssignedFirstName(String(accessRow.first_name ?? ""));
    setStudentAssignedLastName(String(accessRow.last_name ?? ""));
    setStudentGroupNumber(assignedGroupNumber);
    setOpenProposalGroup(null);
  } else {
    setStudentAssignedGroup(null);
    setStudentAssignedFirstName("");
    setStudentAssignedLastName("");
  }

  setStudentEmail(normalizedStudentEmail);
  setStudentCodeSession(normalizedSessionCode);
  setStudentSelectedSessionId(nextSessionId);
  setStudentSelectedSessionCode(nextSessionCode);

  await restoreStudentStateFromDraft(normalizedStudentEmail, normalizedSessionCode);

  // Après restauration d'un brouillon, on force à nouveau le groupe assigné.
  // Cela évite qu'un brouillon local réactive un ancien studentGroupNumber.
  if (hasAssignments) {
    setStudentAssignedGroup(assignedGroupNumber);
    setStudentGroupNumber(assignedGroupNumber);
    setOpenProposalGroup(null);
  }

  await loadTransportReportableRows(nextSessionId, setStudentTransportReportableRows);
  await loadTransportReportRows(nextSessionId, setStudentTransportReportRowsDb);
  await loadDejeunerReportableRows(nextSessionId);
  await loadDejeunerReportRows(nextSessionId, setStudentDejeunerReportRowsDb);
  await loadEquipementReportableRows(nextSessionId);
  await loadEquipementReportRows(nextSessionId, setStudentEquipementReportRowsDb);
  await loadAutresReportableRows(nextSessionId);
  await loadAutresReportRows(nextSessionId, setStudentAutresReportRowsDb);
  await loadSalleReportRows(nextSessionId, setStudentSalleReportRowsDb);
  await loadSessionAnalysisAccess(nextSessionId);
  await loadSessionSyntheseAccess(nextSessionId);
  await loadSessionVoteAccess(nextSessionId);
  await loadTeacherGroupProposals(nextSessionId);

  setScreen("student_mise_en_oeuvre");
}

  function updateTrip(index: number, patch: Partial<TransportTrip>) {
    setTransportTrips((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function addTrip() {
    setTransportTrips((prev) => [
      ...prev,
      { mode: "", distanceKm: "", carType: "", carPassengers: "1" },
    ]);
  }

function removeTrip(index: number) {
  const confirmed = window.confirm("Voulez-vous vraiment supprimer ce trajet ?");
  if (!confirmed) return;

  setTransportTrips((prev) => prev.filter((_, i) => i !== index));
}

  async function refreshStudentTransportData(sessionId: string) {
    if (!sessionId) return;
    await loadTransportReportableRows(sessionId, setStudentTransportReportableRows);
    await loadTransportReportRows(sessionId, setStudentTransportReportRowsDb);
    await loadDejeunerReportableRows(sessionId);
    await loadDejeunerReportRows(sessionId, setStudentDejeunerReportRowsDb);
    await loadEquipementReportableRows(sessionId);
    await loadEquipementReportRows(sessionId, setStudentEquipementReportRowsDb);
    await loadAutresReportableRows(sessionId);
    await loadAutresReportRows(sessionId, setStudentAutresReportRowsDb);
  }

async function refreshStudentAnalysisData() {
  if (!studentSelectedSessionId) return false;
  return await loadSessionAnalysisAccess(studentSelectedSessionId);
}

  async function refreshStudentSyntheseData() {
    if (!studentSelectedSessionId) return false;
    return await loadSessionSyntheseAccess(studentSelectedSessionId);
  }

  async function handleSaveTransport() {
    setTransportMessage("");

    if (!studentEmail.trim() || !studentCodeSession.trim()) {
      setTransportMessage("Mail et code session requis.");
      return;
    }

    const normalizedStudentEmail = normalizeEmail(studentEmail);
    const normalizedSessionCode = (studentSelectedSessionCode || studentCodeSession).trim().toLowerCase();

    if (studentCompletion.transport) {
      setTransportMessage("Le questionnaire transport a déjà été validé.");
      return;
    }

    const invalidDistance = transportTrips.some(
      (trip) => trip.mode && (!trip.distanceKm || Number(trip.distanceKm) <= 0)
    );
    if (invalidDistance) {
      setTransportMessage("Indiquer la distance parcourue pour ce moyen de transport.");
      return;
    }

    const invalidCarType = transportTrips.some((trip) => trip.mode === "car" && !trip.carType);
    if (invalidCarType) {
      setTransportMessage("Indiquer le type de voiture pour ce moyen de transport.");
      return;
    }

    const payload = transportTrips
      .filter((trip) => trip.mode && trip.distanceKm)
      .map((trip) => ({
        mode: trip.mode,
        distance_km: Number(trip.distanceKm),
        car_type: trip.mode === "car" ? trip.carType || "" : "",
        car_passengers: trip.mode === "car" ? trip.carPassengers || "" : "",
      }));

    if (!payload.length) {
      setTransportMessage("Ajoute au moins un trajet valide.");
      return;
    }

    // IMPORTANT : la fonction SQL submit_transport_response_student
    // ne doit écrire que dans responses_transport.
    // Aucun INSERT / UPSERT vers group_reports ne doit être fait côté Supabase ici.
    const { error } = await supabase.rpc("submit_transport_response_student", {
      p_session_code: normalizedSessionCode,
      p_email: normalizedStudentEmail,
      p_trips: payload,
    });

    if (error) {
      setTransportMessage(error.message);
      return;
    }

    const { data: sessionData } = await supabase.rpc("get_open_session_by_code", {
      p_session_code: normalizedSessionCode,
    });

    const sessionId = sessionData?.[0]?.id;
    if (sessionId) {
      await refreshStudentTransportData(sessionId);
    }

const nextCompletion = { ...studentCompletion, transport: true };
setStudentCompletion(nextCompletion);
saveStudentDraftSnapshot({ completion: { transport: true } });
setTransportMessage("Questionnaire transport enregistré.");
  }

  async function handleSaveDejeuner() {
    setDejeunerMessage("");

    if (!studentEmail.trim() || !studentCodeSession.trim()) {
      setDejeunerMessage("Mail et code session requis.");
      return;
    }

    const normalizedStudentEmail = normalizeEmail(studentEmail);
    const normalizedSessionCode = (studentSelectedSessionCode || studentCodeSession).trim().toLowerCase();

    if (studentCompletion.dejeuner) {
      setDejeunerMessage("Le questionnaire déjeuner a déjà été validé.");
      return;
    }

    const payload = {
      sandwich: dejeuner.sandwich,
      quiche_pizza: dejeuner.quiche_pizza,
      frites_chips: dejeuner.frites_chips,
      oeufs: dejeuner.oeufs,
      viande_rouge: dejeuner.viande_rouge,
      autre_viande: dejeuner.autre_viande,
      poisson: dejeuner.poisson,
      accompagnement: dejeuner.accompagnement,
      plat_pates: dejeuner.plat_pates,
      salade_composee: dejeuner.salade_composee,
      fruit_local: dejeuner.fruit_local,
      fruit_importe: dejeuner.fruit_importe,
      laitage: dejeuner.laitage,
      dessert: dejeuner.dessert,
      boissons: dejeuner.boissons,
    };

    const { error } = await supabase.rpc("submit_dejeuner_response_student", {
      p_session_code: normalizedSessionCode,
      p_email: normalizedStudentEmail,
      p_payload: payload,
    });

    if (error) {
      setDejeunerMessage(error.message);
      return;
    }

    if (studentSelectedSessionId) {
      await loadDejeunerReportableRows(studentSelectedSessionId);
      await loadDejeunerReportRows(studentSelectedSessionId, setStudentDejeunerReportRowsDb);
    }

const nextCompletion = { ...studentCompletion, dejeuner: true };
setStudentCompletion(nextCompletion);
saveStudentDraftSnapshot({ completion: { dejeuner: true } });
setDejeunerMessage("Questionnaire déjeuner enregistré.");
  }

  async function handleSaveEquipement() {
    setEquipementMessage("");

    if (!studentEmail.trim() || !studentCodeSession.trim()) {
      setEquipementMessage("Mail et code session requis.");
      return;
    }

    const normalizedStudentEmail = normalizeEmail(studentEmail);
    const normalizedSessionCode = (studentSelectedSessionCode || studentCodeSession).trim().toLowerCase();

    if (studentCompletion.equipement) {
      setEquipementMessage("Le questionnaire équipement a déjà été validé.");
      return;
    }

    const payload = {
      used_equipment: equipement.used_equipment,
      emails_with_attachment: Number(equipement.emails_with_attachment || 0),
      emails_without_attachment: Number(equipement.emails_without_attachment || 0),
      social_prep_minutes: Number(equipement.social_prep_minutes || 0),
      social_during_class_minutes: Number(equipement.social_during_class_minutes || 0),
      ai_prep_minutes: Number(equipement.ai_prep_minutes || 0),
      ai_during_class_minutes: Number(equipement.ai_during_class_minutes || 0),
    };

    console.log("DEBUG EQUIPEMENT", {
  normalizedStudentEmail,
  normalizedSessionCode,
  studentSelectedSessionId,
  equipement,
});

    const { error } = await supabase.rpc("submit_equipement_response_student", {
      p_session_code: normalizedSessionCode,
      p_email: normalizedStudentEmail,
      p_payload: payload,
    });

    if (error) {
      setEquipementMessage(error.message);
      return;
    }

    if (studentSelectedSessionId) {
      await loadEquipementReportableRows(studentSelectedSessionId);
      await loadEquipementReportRows(studentSelectedSessionId, setStudentEquipementReportRowsDb);
    }

const nextCompletion = { ...studentCompletion, equipement: true };
setStudentCompletion(nextCompletion);
saveStudentDraftSnapshot({ completion: { equipement: true } });
setEquipementMessage("Questionnaire équipement enregistré.");
  }

  async function handleSaveAutres() {
    setAutresMessage("");

    if (!studentEmail.trim() || !studentCodeSession.trim()) {
      setAutresMessage("Mail et code session requis.");
      return;
    }

    const normalizedStudentEmail = normalizeEmail(studentEmail);
    const normalizedSessionCode = (studentSelectedSessionCode || studentCodeSession).trim().toLowerCase();

    if (studentCompletion.autres) {
      setAutresMessage("Le questionnaire autres consommations a déjà été validé.");
      return;
    }

    const payload = {
      boissons: autres.hot_drinks,
      grignotage: autres.snacks,
      fruits_locaux: autres.local_fruits,
      fruits_importes: autres.imported_fruits,
    };

    const { error } = await supabase.rpc("submit_autres_consommations_response_student", {
      p_session_code: normalizedSessionCode,
      p_email: normalizedStudentEmail,
      p_payload: payload,
    });

    if (error) {
      setAutresMessage(error.message);
      return;
    }

    if (studentSelectedSessionId) {
      await loadAutresReportableRows(studentSelectedSessionId);
      await loadAutresReportRows(studentSelectedSessionId, setStudentAutresReportRowsDb);
    }

const nextCompletion = { ...studentCompletion, autres: true };
setStudentCompletion(nextCompletion);
saveStudentDraftSnapshot({ completion: { autres: true } });
setAutresMessage("Questionnaire autres consommations enregistré.");
    window.alert(
      "Questionnaires terminés. Vous pouvez passer à l'analyse si le professeur l'a autorisée."
    );
  }

  function toggleBoisson(value: string) {
    setDejeuner((prev) => ({
      ...prev,
      boissons: prev.boissons.includes(value)
        ? prev.boissons.filter((v) => v !== value)
        : [...prev.boissons, value],
    }));
  }

  function toggleEquipement(value: string) {
    setEquipement((prev) => ({
      ...prev,
      used_equipment: prev.used_equipment.includes(value)
        ? prev.used_equipment.filter((v) => v !== value)
        : [...prev.used_equipment, value],
    }));
  }

  function toggleAutres(
    key: "snacks" | "local_fruits" | "imported_fruits" | "hot_drinks",
    value: string
  ) {
    setAutres((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  }

  function renderTransportReportableBlock(rows: ReportableRow[], emptyText: string) {
    return (
      <div style={styles.innerCardFull}>
        <h3 style={styles.innerTitle}>Données à reporter</h3>

        <div
          style={{
            background: "#f3eadf",
            color: "#c2410c",
            padding: 12,
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          Pour la voiture, la comptabilisation du nombre de personnes se fait au prorata : 0,5 si
          un passager en plus du conducteur, 0,33 si deux passagers, etc.
        </div>

        {!rows.length ? (
          <div style={styles.infoMessage}>{emptyText}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.reportTable}>
              <thead>
                <tr>
                  <th style={styles.reportTh}>Élément</th>
                  <th style={styles.reportTh}>Nombre de répondants</th>
                  <th style={styles.reportTh}>Distance cumulée (km)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowKey}>
                    <td style={styles.reportTd}>{row.label}</td>
                    <td style={styles.reportTd}>{formatReportNumber(row.persons)}</td>
                    <td style={styles.reportTd}>{formatReportNumber(row.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }


function renderDejeunerReportableBlock(rows: DejeunerReportableRowRpc[], emptyText: string) {
  const quantityByLabel = rows.reduce<Record<string, number>>((acc, row) => {
    const label = normalizeDejeunerLookupValue(row.label);
    if (!label) return acc;

    acc[label] = (acc[label] ?? 0) + Number(row.quantity ?? 0);
    return acc;
  }, {});

  const quantityByKey = rows.reduce<Record<string, number>>((acc, row) => {
    const rowKey = normalizeDejeunerLookupValue(String((row as { row_key?: string | null }).row_key ?? ""));
    if (!rowKey) return acc;

    acc[rowKey] = (acc[rowKey] ?? 0) + Number(row.quantity ?? 0);
    return acc;
  }, {});

  const getQuantity = (item: DejeunerStructureItem) => {
    const labelKeys = [item.label, ...(item.aliases ?? [])].map(normalizeDejeunerLookupValue);
    const keyQuantity = Number(quantityByKey[normalizeDejeunerLookupValue(item.rowKey)] ?? 0);
    const labelQuantity = labelKeys.reduce((sum, key) => sum + Number(quantityByLabel[key] ?? 0), 0);

    return keyQuantity || labelQuantity;
  };

  return (
    <div style={styles.innerCardFull}>
      <h3 style={styles.innerTitle}>Données à reporter</h3>

      {!rows.length ? (
        <div style={styles.infoMessage}>{emptyText}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 18 }}>
          {DEJEUNER_REPORT_STRUCTURE.map((section) => (
            <div
              key={section.title}
              style={{
                background: "#f8fafc",
                borderRadius: 18,
                overflow: "hidden",
                border: "1px solid #d7dee8",
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
              }}
            >
              <div
                style={{
                  background: "#dbe7f3",
                  color: "#123b64",
                  fontWeight: 900,
                  fontSize: 18,
                  padding: "14px 18px",
                  borderBottom: "1px solid #c7d4e3",
                  textAlign: "left",
                }}
              >
                {section.title}
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ ...styles.reportTable, marginTop: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.reportTh, textAlign: "left", width: "30%" }}>
                        Sous-catégorie
                      </th>
                      <th style={{ ...styles.reportTh, textAlign: "left", width: "45%" }}>
                        Élément
                      </th>
                      <th style={{ ...styles.reportTh, textAlign: "center", width: "25%" }}>
                        Nombre de répondants
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.groups.flatMap((group) =>
                      group.items.map((item, itemIndex) => (
                        <tr key={`${section.title}-${group.title}-${item.rowKey}`}>
                          {itemIndex === 0 && (
                            <td
                              rowSpan={group.items.length}
                              style={{
                                ...styles.reportTd,
                                textAlign: "left",
                                paddingLeft: 18,
                                fontWeight: 800,
                                color: "#123b64",
                                verticalAlign: "top",
                              }}
                            >
                              {group.title}
                            </td>
                          )}
                          <td style={{ ...styles.reportTd, textAlign: "left", paddingLeft: 18 }}>
                            {item.label}
                          </td>
                          <td style={{ ...styles.reportTd, textAlign: "center", fontWeight: 700 }}>
                            {getQuantity(item)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderEquipementReportableBlock(rows: EquipementReportableRowRpc[], emptyText: string) {
  const equipmentLabelMap: Record<string, string> = {
    ordinateur_portable: "Ordinateur portable",
    desktop_computer: "Ordinateur de bureau",
    ordinateur_bureau: "Ordinateur de bureau",
    ecran: "Écran",
    tablette: "Tablette",
    smartphone: "Smartphone",
    papeterie: "Papeterie",
    ordinateur_portable_desktop_tablette: "Ordinateur portable et ordinateur de bureau et/ou tablette",
    ordinateur_portable_et_ordinateur_de_bureau_et_ou_tablette: "Ordinateur portable et ordinateur de bureau et/ou tablette",
    emails_without_attachment: "Email sans PJ",
    emails_with_attachment: "Email avec PJ",
    social_minutes: "Réseaux sociaux",
    social_prep_minutes: "Réseaux sociaux",
    social_during_class_minutes: "Réseaux sociaux",
    ai_minutes: "IA",
    ai_prep_minutes: "IA",
    ai_during_class_minutes: "IA",
  };

  const groupedRows = rows.reduce<Record<string, EquipementReportableRowRpc[]>>((acc, row) => {
    const category = String(row.category ?? "Autres");
    if (!acc[category]) acc[category] = [];
    acc[category].push({
      ...row,
      label: equipmentLabelMap[String(row.row_key ?? "")] || String(row.label ?? row.row_key ?? ""),
    });
    return acc;
  }, {});

  const categoryOrder = ["Matériel", "Équipements utilisés", "Activité", "Emails", "Réseaux sociaux", "IA"];

  const orderedCategories = Object.keys(groupedRows).sort((a, b) => {
    const ia = categoryOrder.indexOf(a);
    const ib = categoryOrder.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return (
    <div style={styles.innerCardFull}>
      <h3 style={styles.innerTitle}>Données à reporter</h3>

      {!rows.length ? (
        <div style={styles.infoMessage}>{emptyText}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 18 }}>
          {orderedCategories.map((category) => (
            <div
              key={category}
              style={{
                background: "#f8fafc",
                borderRadius: 18,
                overflow: "hidden",
                border: "1px solid #d7dee8",
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
              }}
            >
              <div
                style={{
                  background: "#dbe7f3",
                  color: "#123b64",
                  fontWeight: 800,
                  fontSize: 18,
                  padding: "14px 18px",
                  borderBottom: "1px solid #c7d4e3",
                  textAlign: "left",
                }}
              >
                {category === "Équipements utilisés" ? "Matériel" : category}
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ ...styles.reportTable, marginTop: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.reportTh, textAlign: "left", width: "70%" }}>Équipement</th>
                      <th style={{ ...styles.reportTh, textAlign: "center", width: "30%" }}>Quantité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...groupedRows[category]].sort(compareAutresReportableRows).map((row, index) => (
                      <tr key={`${String(row.row_key ?? "")}-${index}`}>
                        <td style={{ ...styles.reportTd, textAlign: "left", paddingLeft: 18 }}>
                          {String(row.label ?? "")}
                        </td>
                        <td style={{ ...styles.reportTd, textAlign: "center", fontWeight: 700 }}>
                          {formatReportNumber(row.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderEquipementAnalysisTable(params: {
  rows: EquipementAnalysisRow[];
  groupNumber: number;
  sessionId: string;
  updatedBy: string | null;
  readOnly?: boolean;
  onSave?: (params: {
    sessionId: string;
    groupNumber: number;
    rowKey: string;
    label: string;
    quantity: number;
    factor: number;
    updatedBy: string | null;
  }) => Promise<void>;
}) {
  const { rows, groupNumber, sessionId, updatedBy, onSave, readOnly = false } = params;

  const categoryOrder = ["Matériel", "Équipements utilisés", "Activité", "Emails", "Réseaux sociaux", "IA"];

  const orderedRows = [...rows].sort((a, b) => {
    const ia = categoryOrder.indexOf(a.category);
    const ib = categoryOrder.indexOf(b.category);
    if (ia === -1 && ib === -1) return a.label.localeCompare(b.label);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    if (ia !== ib) return ia - ib;
    return a.label.localeCompare(b.label);
  });

  const tableTotal = orderedRows.reduce(
    (sum, row) => sum + Number(row.quantity || 0) * Number(row.factor || 0),
    0
  );

  return (
    <div style={styles.innerCardFull}>
      <h3 style={styles.innerTitle}>Analyse - Groupe {groupNumber}</h3>
      {readOnly ? (
        <div style={styles.bodyText}>Consultation en lecture seule du report saisi par les étudiants.</div>
      ) : null}

      <div
        style={{
          marginTop: 12,
          marginBottom: 12,
          padding: 12,
          borderRadius: 12,
          background: "#eff6ff",
          color: "#123b64",
          fontWeight: 800,
          textAlign: "right",
        }}
      >
        Total émissions : {formatReportNumber(tableTotal)}
      </div>

      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <table style={styles.reportTable}>
          <thead>
            <tr>
              <th style={{ ...styles.reportTh, textAlign: "left" }}>Équipement</th>
              <th style={{ ...styles.reportTh, textAlign: "center" }}>Quantité</th>
              <th style={{ ...styles.reportTh, textAlign: "center" }}>Facteur</th>
              <th style={{ ...styles.reportTh, textAlign: "center" }}>Total émissions</th>
            </tr>
          </thead>
          <tbody>
            {orderedRows.map((row, index) => {
              const showCategory = index === 0 || orderedRows[index - 1].category !== row.category;
              const total = Number(row.quantity || 0) * Number(row.factor || 0);

              return (
                <React.Fragment key={row.rowKey}>
                  {showCategory && (
                    <tr>
                      <td colSpan={4} style={{ ...styles.reportTd, background: "#dbe7f3", color: "#123b64", fontWeight: 800, textAlign: "left" }}>
                        {row.category === "Équipements utilisés" ? "Matériel" : row.category}
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td style={{ ...styles.reportTd, textAlign: "left" }}>{row.label}</td>
                    <td style={styles.reportTd}>
                      {readOnly ? (
                        <span>{formatReportNumber(row.quantity)}</span>
                      ) : (
                        <DraftNumberInput
                          value={row.quantity}
                          style={styles.input}
                          onCommit={async (value) => {
                            await onSave?.({
                              sessionId,
                              groupNumber,
                              rowKey: row.rowKey,
                              label: row.label,
                              quantity: value,
                              factor: row.factor,
                              updatedBy,
                            });
                          }}
                        />
                      )}
                    </td>
                    <td style={{ ...styles.reportTd, textAlign: "center", fontWeight: 700 }}>{formatFactorNumber(row.factor)}</td>
                    <td style={{ ...styles.reportTd, textAlign: "center", fontWeight: 700 }}>{formatReportNumber(total)}</td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderDejeunerAnalysisTable(params: {
  rows: DejeunerAnalysisRow[];
  groupNumber: number;
  sessionId: string;
  updatedBy: string | null;
  readOnly?: boolean;
  onSave?: (params: {
    sessionId: string;
    groupNumber: number;
    rowKey: string;
    label: string;
    quantity: number;
    factor: number;
    updatedBy: string | null;
  }) => Promise<void>;
})
{
  const { rows, groupNumber, sessionId, updatedBy, onSave, readOnly = false } = params;

  const rowsByKey = new Map(rows.map((row) => [row.rowKey, row]));
  const orderedRows = DEJEUNER_REPORT_STRUCTURE.flatMap((section) =>
    section.groups.flatMap((group) =>
      group.items.map((item) => {
        const existingRow = rowsByKey.get(item.rowKey);

        return {
          section: section.title,
          subcategory: group.title,
          row: {
            rowKey: item.rowKey,
            category: section.title,
            label: item.label,
            factor: Number(existingRow?.factor ?? 0),
            quantity: Number(existingRow?.quantity ?? 0),
          } as DejeunerAnalysisRow,
        };
      })
    )
  );

  const tableTotal = orderedRows.reduce(
    (sum, item) => sum + Number(item.row.quantity || 0) * Number(item.row.factor || 0),
    0
  );

  let previousSection = "";
  let previousSubcategory = "";

  return (
    <div style={styles.innerCardFull}>
      <h3 style={styles.innerTitle}>Analyse - Groupe {groupNumber}</h3>
      {readOnly ? (
        <div style={styles.bodyText}>
          Consultation en lecture seule du report saisi par les étudiants.
        </div>
      ) : null}

      <div
        style={{
          marginTop: 12,
          marginBottom: 12,
          padding: 12,
          borderRadius: 12,
          background: "#eef6ff",
          border: "1px solid #bfdbfe",
          color: "#1e3a8a",
          fontWeight: 700,
        }}
      >
        Total du tableau : {formatReportNumber(tableTotal)} gCO2
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={styles.reportTable}>
          <thead>
            <tr>
              <th style={styles.reportTh}>Élément</th>
              <th style={styles.reportTh}>Quantité</th>
              <th style={styles.reportTh}>Facteur</th>
              <th style={styles.reportTh}>Total</th>
            </tr>
          </thead>
          <tbody>
            {orderedRows.map(({ section, subcategory, row }) => {
              const showSection = section !== previousSection;
              const showSubcategory = showSection || subcategory !== previousSubcategory;
              previousSection = section;
              previousSubcategory = subcategory;

              const total = Number(row.quantity || 0) * Number(row.factor || 0);

              return (
                <React.Fragment key={row.rowKey}>
                  {showSection && (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...styles.reportTd,
                          background: "#dbe7f3",
                          color: "#123b64",
                          fontWeight: 900,
                          textAlign: "left",
                        }}
                      >
                        {section}
                      </td>
                    </tr>
                  )}

                  {showSubcategory && (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...styles.reportTd,
                          background: "#eef3f8",
                          color: "#123b64",
                          fontWeight: 800,
                          textAlign: "left",
                          paddingLeft: 28,
                        }}
                      >
                        {subcategory}
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td style={{ ...styles.reportTd, textAlign: "left" }}>{row.label}</td>
                    <td style={styles.reportTd}>
                      {readOnly ? (
                        <span>{formatReportNumber(row.quantity)}</span>
                      ) : (
                        <DraftNumberInput
                          value={row.quantity}
                          style={styles.input}
                          onCommit={async (value) => {
                            await onSave?.({
                              sessionId,
                              groupNumber,
                              rowKey: row.rowKey,
                              label: row.label,
                              quantity: value,
                              factor: row.factor,
                              updatedBy,
                            });
                          }}
                        />
                      )}
                    </td>
                    <td style={{ ...styles.reportTd, textAlign: "center", fontWeight: 700 }}>{formatFactorNumber(row.factor)}</td>
                    <td style={{ ...styles.reportTd, textAlign: "center", fontWeight: 700 }}>{formatReportNumber(total)}</td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderAutresReportableBlock(rows: AutresReportableRowRpc[], emptyText: string) {
  const labels: Record<string, string> = {
    biscuits: "Biscuits",
    chips: "Chips",
    chocolat: "Chocolat",
    chocolate_bar: "Barre chocolatée",
    chocolat_bar: "Barre chocolatée",
    bonbons: "Bonbons",
    viennoiserie: "Viennoiserie",
    pomme: "Pomme",
    poire: "Poire",
    raisin: "Raisin",
    banana: "Banane",
    banane: "Banane",
    mango: "Mangue",
    mangue: "Mangue",
    ananas: "Ananas",
    cafe: "Café",
    coffee: "Café",
    the: "Thé",
    tea: "Thé",
    milk_chocolate: "Chocolat au lait",
    chocolat_chaud: "Chocolat chaud",
    hot_chocolate: "Chocolat chaud",
  };

  const groupedRows = rows.reduce<Record<string, AutresReportableRowRpc[]>>((acc, row) => {
    const category = String(row.category ?? "Autres");
    if (!acc[category]) acc[category] = [];
    acc[category].push({
      ...row,
      label: labels[String(row.row_key ?? "")] || String(row.label ?? row.row_key ?? ""),
    });
    return acc;
  }, {});

  const orderedCategories = Object.keys(groupedRows).sort((a, b) => {
    const ia = AUTRES_CATEGORY_ORDER.indexOf(a);
    const ib = AUTRES_CATEGORY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return (
    <div style={styles.innerCardFull}>
      <h3 style={styles.innerTitle}>Données à reporter</h3>

      {!rows.length ? (
        <div style={styles.infoMessage}>{emptyText}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 18 }}>
          {orderedCategories.map((category) => (
            <div
              key={category}
              style={{
                background: "#f8fafc",
                borderRadius: 18,
                overflow: "hidden",
                border: "1px solid #d7dee8",
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
              }}
            >
              <div
                style={{
                  background: "#dbe7f3",
                  color: "#123b64",
                  fontWeight: 800,
                  fontSize: 18,
                  padding: "14px 18px",
                  borderBottom: "1px solid #c7d4e3",
                  textAlign: "left",
                }}
              >
                {category}
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ ...styles.reportTable, marginTop: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.reportTh, textAlign: "left", width: "70%" }}>Élément</th>
                      <th style={{ ...styles.reportTh, textAlign: "center", width: "30%" }}>Nombre de répondants</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...groupedRows[category]].sort(compareAutresReportableRows).map((row, index) => (
                      <tr key={`${String(row.row_key ?? "")}-${index}`}>
                        <td style={{ ...styles.reportTd, textAlign: "left", paddingLeft: 18 }}>
                          {String(row.label ?? "")}
                        </td>
                        <td style={{ ...styles.reportTd, textAlign: "center", fontWeight: 700 }}>
                          {formatReportNumber(row.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderAutresAnalysisTable(params: {
  rows: AutresAnalysisRow[];
  groupNumber: number;
  sessionId: string;
  updatedBy: string | null;
  readOnly?: boolean;
  onSave?: (params: {
    sessionId: string;
    groupNumber: number;
    rowKey: string;
    label: string;
    quantity: number;
    factor: number;
    updatedBy: string | null;
  }) => Promise<void>;
}) {
  const { rows, groupNumber, sessionId, updatedBy, onSave, readOnly = false } = params;

  const orderedRows = orderAutresAnalysisRows(rows);

  const tableTotal = orderedRows.reduce(
    (sum, row) => sum + Number(row.quantity || 0) * Number(row.factor || 0),
    0
  );

  return (
    <div style={styles.innerCardFull}>
      <h3 style={styles.innerTitle}>Analyse - Groupe {groupNumber}</h3>

      {readOnly ? (
        <div style={styles.bodyText}>
          Consultation en lecture seule du report saisi par les étudiants.
        </div>
      ) : null}

      <div
        style={{
          marginTop: 12,
          marginBottom: 12,
          padding: 12,
          borderRadius: 12,
          background: "#eff6ff",
          color: "#123b64",
          fontWeight: 800,
          textAlign: "right",
        }}
      >
        Total émissions : {formatReportNumber(tableTotal)}
      </div>

      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <table style={styles.reportTable}>
          <thead>
            <tr>
              <th style={{ ...styles.reportTh, textAlign: "left" }}>Autres consommations</th>
              <th style={{ ...styles.reportTh, textAlign: "center" }}>Nombre de personnes</th>
              <th style={{ ...styles.reportTh, textAlign: "center" }}>Facteur</th>
              <th style={{ ...styles.reportTh, textAlign: "center" }}>Total émissions</th>
            </tr>
          </thead>
          <tbody>
            {orderedRows.map((row, index) => {
              const showCategory = index === 0 || orderedRows[index - 1].category !== row.category;
              const total = Number(row.quantity || 0) * Number(row.factor || 0);

              return (
                <React.Fragment key={row.rowKey}>
                  {showCategory && (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          ...styles.reportTd,
                          background: "#dbe7f3",
                          color: "#123b64",
                          fontWeight: 800,
                          textAlign: "left",
                        }}
                      >
                        {row.category}
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td style={{ ...styles.reportTd, textAlign: "left" }}>{row.label}</td>

                    <td style={styles.reportTd}>
                      {readOnly ? (
                        <span>{formatReportNumber(row.quantity)}</span>
                      ) : (
                        <DraftNumberInput
                          value={row.quantity}
                          style={styles.input}
                          onCommit={async (value) => {
                            await onSave?.({
                              sessionId,
                              groupNumber,
                              rowKey: row.rowKey,
                              label: row.label,
                              quantity: value,
                              factor: row.factor,
                              updatedBy,
                            });
                          }}
                        />
                      )}
                    </td>

                    <td style={{ ...styles.reportTd, textAlign: "center", fontWeight: 700 }}>
                      {formatFactorNumber(row.factor)}
                    </td>

                    <td style={{ ...styles.reportTd, textAlign: "center", fontWeight: 700 }}>
                      {formatReportNumber(total)}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderTransportAnalysisTable(params: {
  rows: {
    rowKey: string;
    label: string;
    persons: number;
    distanceTotalKm: number;
    factor: number;
  }[];
  groupNumber: number;
  sessionId: string;
  updatedBy: string | null;
  readOnly?: boolean;
  onSave?: (params: {
    sessionId: string;
    groupNumber: number;
    rowKey: string;
    label: string;
    persons: number;
    distanceTotalKm: number;
    factor: number;
    updatedBy: string | null;
  }) => Promise<void>;
})
{
  const { rows, groupNumber, sessionId, updatedBy, onSave, readOnly = false } = params;

  const tableTotal = rows.reduce(
    (sum, row) => sum + Number(row.distanceTotalKm || 0) * Number(row.factor || 0),
    0
  );

  return (
    <div style={styles.innerCardFull}>
      <h3 style={styles.innerTitle}>Analyse - Groupe {groupNumber}</h3>
      {readOnly ? (
        <div style={styles.bodyText}>
          Consultation en lecture seule du report saisi par les étudiants.
        </div>
      ) : null}

      <div
        style={{
          marginTop: 12,
          marginBottom: 12,
          padding: 12,
          borderRadius: 12,
          background: "#eff6ff",
          color: "#123b64",
          fontWeight: 800,
          textAlign: "right",
        }}
      >
        Total émissions : {formatReportNumber(tableTotal)}
      </div>

      <div
        style={{
          background: "#f3eadf",
          color: "#c2410c",
          padding: 12,
          borderRadius: 12,
          marginBottom: 12,
        }}
      >
        Pour la voiture, si plusieurs passagers sont présents, la comptabilisation se fait au prorata : 0,5 personne si un passager en plus du conducteur, 0,33 si deux passagers, etc.
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={styles.reportTable}>
          <thead>
            <tr>
              <th style={styles.reportTh}>Moyen de transport</th>
              <th style={styles.reportTh}>Nombre de personnes</th>
              <th style={styles.reportTh}>Distance totale (km)</th>
              <th style={styles.reportTh}>Facteur</th>
              <th style={styles.reportTh}>Total émissions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const total = Number(row.distanceTotalKm || 0) * Number(row.factor || 0);
              return (
                <tr key={row.rowKey}>
                  <td style={styles.reportTd}>{row.label}</td>
                  <td style={styles.reportTd}>
                    {readOnly ? (
                      <span>{formatReportNumber(row.persons)}</span>
                    ) : (
                      <DraftNumberInput
                        value={row.persons}
                        style={styles.input}
                        onCommit={async (value) => {
                          await onSave?.({
                            sessionId,
                            groupNumber,
                            rowKey: row.rowKey,
                            label: row.label,
                            persons: value,
                            distanceTotalKm: row.distanceTotalKm,
                            factor: row.factor,
                            updatedBy,
                          });
                        }}
                      />
                    )}
                  </td>
                  <td style={styles.reportTd}>
                    {readOnly ? (
                      <span>{formatReportNumber(row.distanceTotalKm)}</span>
                    ) : (
                      <DraftNumberInput
                        value={row.distanceTotalKm}
                        style={styles.input}
                        onCommit={async (value) => {
                          await onSave?.({
                            sessionId,
                            groupNumber,
                            rowKey: row.rowKey,
                            label: row.label,
                            persons: row.persons,
                            distanceTotalKm: value,
                            factor: row.factor,
                            updatedBy,
                          });
                        }}
                      />
                    )}
                  </td>
                  <td style={styles.reportTd}>{formatFactorNumber(row.factor)}</td>
                  <td style={styles.reportTd}>{formatReportNumber(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function renderSalleAnalysisTable(params: {
  rows: SalleAnalysisRow[];
  groupNumber: number;
  sessionId: string;
  updatedBy: string | null;
  readOnly?: boolean;
  onSave?: (params: {
    sessionId: string;
    groupNumber: number;
    rowKey: string;
    label: string;
    quantity: number;
    factor: number;
    updatedBy: string | null;
  }) => Promise<void>;
}) {
  const { rows, groupNumber, sessionId, updatedBy, onSave, readOnly = false } = params;

  const tableTotal = rows.reduce(
    (sum, row) => sum + Number(row.quantity || 0) * Number(row.factor || 0),
    0
  );

  return (
    <div style={styles.innerCardFull}>
      <h3 style={styles.innerTitle}>Analyse - Groupe {groupNumber}</h3>

      {readOnly ? (
        <div style={styles.bodyText}>
          Consultation en lecture seule du report saisi par les étudiants.
        </div>
      ) : null}

      <div
        style={{
          marginTop: 12,
          marginBottom: 12,
          padding: 12,
          borderRadius: 12,
          background: "#eff6ff",
          color: "#123b64",
          fontWeight: 800,
          textAlign: "right",
        }}
      >
        Total émissions : {formatReportNumber(tableTotal)}
      </div>

      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <table style={styles.reportTable}>
          <thead>
            <tr>
              <th style={{ ...styles.reportTh, textAlign: "left" }}>Salle de cours</th>
              <th style={{ ...styles.reportTh, textAlign: "center" }}>Quantité</th>
              <th style={{ ...styles.reportTh, textAlign: "center" }}>Facteur</th>
              <th style={{ ...styles.reportTh, textAlign: "center" }}>Total émissions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const total = Number(row.quantity || 0) * Number(row.factor || 0);

              return (
                <tr key={row.rowKey}>
                  <td style={{ ...styles.reportTd, textAlign: "left" }}>{row.label}</td>

                  <td style={styles.reportTd}>
                    {readOnly ? (
                      row.rowKey === "chauffage" || row.rowKey === "climatisation" ? (
                        <span>{Number(row.quantity || 0) > 0 ? "Oui" : "Non"}</span>
                      ) : (
                        <span>{formatReportNumber(row.quantity)}</span>
                      )
                    ) : row.rowKey === "chauffage" || row.rowKey === "climatisation" ? (
                      <select
                        value={Number(row.quantity || 0) > 0 ? 1 : 0}
                        style={styles.input}
                        onChange={async (e) => {
                          await onSave?.({
                            sessionId,
                            groupNumber,
                            rowKey: row.rowKey,
                            label: row.label,
                            quantity: Number(e.target.value),
                            factor: row.factor,
                            updatedBy,
                          });
                        }}
                      >
                        <option value={0}>Non</option>
                        <option value={1}>Oui</option>
                      </select>
                    ) : (
                      <DraftNumberInput
                        value={row.quantity}
                        style={styles.input}
                        onCommit={async (value) => {
                          await onSave?.({
                            sessionId,
                            groupNumber,
                            rowKey: row.rowKey,
                            label: row.label,
                            quantity: value,
                            factor: row.factor,
                            updatedBy,
                          });
                        }}
                      />
                    )}
                  </td>

                  <td style={{ ...styles.reportTd, textAlign: "center", fontWeight: 700 }}>
                    {formatFactorNumber(row.factor)}
                  </td>
                  <td style={{ ...styles.reportTd, textAlign: "center", fontWeight: 700 }}>
                    {formatReportNumber(total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


  if (screen === "student_mise_en_oeuvre") {
    return (
      <div style={styles.appShell}>
        <StudentSidebar
          active="mise_en_oeuvre"
          onGo={goToScreen}
          analysisUnlocked={studentAnalysisUnlocked}
          syntheseUnlocked={studentSyntheseUnlocked}
          onBeforeOpenAnalysis={refreshStudentAnalysisData}
          onBeforeOpenSynthese={refreshStudentSyntheseData}
          sessionCode={studentSelectedSessionCode}
          sessionId={studentSelectedSessionId}
          voteUnlocked={studentVoteUnlocked}
onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
        />
        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
<div style={styles.topHeader}>
  <div style={styles.topHeaderTitle}>BILAN CARBONE DE LA SÉANCE DE COURS</div>
  <div style={styles.topHeaderSub}>
    Activité pédagogique développée par G. Lesur-Irchabeau &amp; J. Hanoteau
  </div>
</div>
          </header>
          <section style={styles.bigPanel}>
            <h2 style={styles.panelTitle}>Mise en œuvre</h2>
<div style={styles.infoCard}>
  <div style={styles.sectionIconWrap}>
    <span style={styles.sectionIcon}>📊</span>
  </div>
  <p style={styles.infoCardText}>
    Chaque étudiant d'une même classe répond individuellement aux questionnaires.
  </p>
</div>

<div style={styles.infoCard}>
  <div style={styles.sectionIconWrap}>
    <span style={styles.sectionIcon}>👥</span>
  </div>
  <p style={styles.infoCardText}>
    Chaque groupe se voit attribuer une thématique. Vous accédez ensuite aux données à reporter.
  </p>
</div>

<div style={styles.infoCard}>
  <div style={styles.sectionIconWrap}>
    <span style={styles.sectionIcon}>💡</span>
  </div>
  <p style={styles.infoCardText}>
    Une fois le bilan établi, vous proposerez des pistes d'amélioration discutées en classe.
  </p>
</div>

<div style={styles.infoCard}>
  <div style={styles.sectionIconWrap}>
    <span style={styles.sectionIcon}>🗳️</span>
  </div>
  <p style={styles.infoCardText}>
    Ces pistes d'amélioration seront ensuite résumées et soumises au vote.
  </p>
</div>

<div style={styles.infoCard}>
  <div style={styles.sectionIconWrap}>
    <span style={styles.sectionIcon}>📈</span>
  </div>
  <p style={styles.infoCardText}>
    Une synthèse permettra de comparer les résultats entre les thématiques.
  </p>
</div>
            <div style={styles.row}>
              <button style={styles.primaryButton} onClick={() => goToScreen("student_transport")}>
                Commencer la collecte
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

if (screen === "home") {
  return (
    <div style={styles.landingPage}>
      <div style={styles.landingShell}>
        <div style={styles.landingImageWrap}>
          <img
            src={homeIllustration}
            alt="Illustration bilan carbone"
            style={styles.landingImage}
          />
        </div>

        <div style={styles.landingPanel}>
          <div style={styles.landingPanelInner}>
            <img src={kedgeLogo} alt="KEDGE Business School" style={styles.landingLogo} />

            <h1 style={styles.landingTitle}>Bilan carbone de la séance de cours</h1>

            <p style={styles.landingIntro}>
              Choisissez votre profil pour accéder à l&apos;application.
            </p>

<div style={styles.landingButtons}>
  <button
    type="button"
    style={{ ...styles.landingProfileButton, ...styles.landingStudentButton }}
    onClick={() => {
      setMessage("");
      setScreen("student_login");
    }}
  >
    Étudiant
  </button>

  <button
    type="button"
    style={{ ...styles.landingProfileButton, ...styles.landingTeacherButton }}
    onClick={() => {
      setAuthPortal("teacher");
      setMessage("");
      setScreen("teacher_login");
    }}
  >
    Professeur
  </button>

  <button
    type="button"
    style={{ ...styles.landingProfileButton, ...styles.landingAdminButton }}
    onClick={() => {
      setAuthPortal("admin");
      setMessage("");
      setScreen("teacher_login");
    }}
  >
    Administrateur
  </button>
</div>
          </div>
        </div>
      </div>
    </div>
  );
}

if (screen === "teacher_login") {
  return (
    <div style={styles.authPage}>
      <div style={styles.authCard}>
        <img src={kedgeLogo} alt="KEDGE Business School" style={styles.authLogo} />

        <h1 style={styles.authTitle}>
          {authPortal === "admin" ? "Connexion administrateur" : "Connexion professeur"}
        </h1>

<form
  onSubmit={(e) => {
    e.preventDefault();
    void handleTeacherLogin();
  }}
>
  <div style={styles.formGroup}>
    <input
      style={styles.input}
      placeholder="Adresse e-mail"
      value={teacherEmail}
      onChange={(e) => setTeacherEmail(e.target.value)}
    />
    <input
      style={styles.input}
      type="password"
      placeholder="Mot de passe"
      value={teacherPassword}
      onChange={(e) => setTeacherPassword(e.target.value)}
    />
  </div>

  <div style={styles.formActions}>
    <button type="submit" style={styles.primaryButton}>
      Se connecter
    </button>
    <button
      type="button"
      style={styles.secondaryButton}
      onClick={() => setScreen("home")}
    >
      Retour
    </button>
  </div>
</form>
        {!!message && <div style={styles.infoMessage}>{message}</div>}
      </div>
    </div>
  );
}

if (screen === "student_login") {
  return (
    <div style={styles.authPage}>
      <div style={styles.authCard}>
        <img src={kedgeLogo} alt="KEDGE Business School" style={styles.authLogo} />

        <h1 style={styles.authTitle}>Connexion étudiant</h1>

        <div style={styles.column}>
          <input
            style={styles.input}
            placeholder="Adresse e-mail"
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Code session"
            value={studentCodeSession}
            onChange={(e) => setStudentCodeSession(e.target.value)}
          />
        </div>

        <div style={styles.row}>
          <button style={styles.primaryButton} onClick={handleStudentEnter}>
            Entrer
          </button>
          <button style={styles.secondaryButton} onClick={() => setScreen("home")}>
            Retour
          </button>
        </div>

        {!!message && <div style={styles.infoMessage}>{message}</div>}
      </div>
    </div>
  );
}

  if (screen === "student_transport") {
    return (
      <div style={styles.appShell}>
        <StudentSidebar
          active="collecte"
          onGo={goToScreen}
          analysisUnlocked={studentAnalysisUnlocked}
          syntheseUnlocked={studentSyntheseUnlocked}
          onBeforeOpenAnalysis={refreshStudentAnalysisData}
          onBeforeOpenSynthese={refreshStudentSyntheseData}
          sessionCode={studentSelectedSessionCode}
          sessionId={studentSelectedSessionId}
          voteUnlocked={studentVoteUnlocked}
onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
        />
        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
<div style={styles.topHeader}>
  <div style={styles.topHeaderTitle}>BILAN CARBONE DE LA SÉANCE DE COURS</div>
  <div style={styles.topHeaderSub}>
    Activité pédagogique développée par G. Lesur-Irchabeau &amp; J. Hanoteau
  </div>
</div>
          </header>
          <section style={styles.bigPanel}>
            <h2 style={styles.panelTitle}>Collecte des données</h2>
            <div style={styles.innerCardFull}>
              <StudentQuestionnaireTabs
                active="transport"
                completion={studentCompletion}
                onNavigate={goToStudentQuestionnaire}
                canAccess={canAccessStudentQuestionnaire}
              />
            </div>
            <div style={{ ...styles.homeCard, width: "100%", padding: 0, background: "transparent", boxShadow: "none" }}>
              <div style={styles.subtleText}>Mail : {studentEmail}</div>
              <div style={styles.subtleText}>
  Code session : {formatSessionCode(studentSelectedSessionCode || studentCodeSession)}
</div>
              {transportTrips.map((trip, index) => (
                <div key={index} style={styles.sectionCard}>
                  <div style={styles.sectionHeader}>
                    <div style={styles.sectionIcon}>🚌</div>
                    <h3 style={styles.sectionTitle}>Trajet {index + 1}</h3>
                  </div>
                  <div style={styles.questionBlock}>
                    <label style={styles.questionLabel}>Moyen de transport</label>
                    <select
                      style={styles.input}
                      value={trip.mode}
                      onChange={(e) => {
                        const nextMode = e.target.value;
                        updateTrip(index, {
                          mode: nextMode,
                          ...(nextMode === "car"
                            ? { carType: trip.carType || "", carPassengers: trip.carPassengers || "1" }
                            : { carType: "", carPassengers: "" }),
                        });
                      }}
                    >
                      <option value="">Sélectionner</option>
                      {transportModes.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.questionBlock}>
                    <label style={styles.questionLabel}>Distance parcourue (km)</label>
                    <input
                      style={styles.input}
                      type="number"
                      min="0"
                      step="0.1"
                      value={trip.distanceKm}
                      onChange={(e) => updateTrip(index, { distanceKm: e.target.value })}
                    />
                  </div>
                  {trip.mode === "car" && (
                    <>
                      <div style={styles.questionBlock}>
                        <label style={styles.questionLabel}>Type de voiture</label>
                        <select
                          style={styles.input}
                          value={trip.carType}
                          onChange={(e) => updateTrip(index, { carType: e.target.value })}
                        >
                          <option value="">Sélectionner</option>
                          {carTypes.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div style={styles.questionBlock}>
                        <label style={styles.questionLabel}>Nombre de personnes dans la voiture</label>
                        <input
                          style={styles.input}
                          type="number"
                          min="1"
                          step="1"
                          value={trip.carPassengers}
                          onChange={(e) => updateTrip(index, { carPassengers: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                  {transportTrips.length > 1 && (
                    <div style={styles.row}>
                      <button style={styles.smallDangerButton} onClick={() => removeTrip(index)}>
                        Supprimer ce trajet
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div style={styles.row}>
                <button style={styles.secondaryButton} onClick={addTrip}>
                  Ajouter un trajet
                </button>
              </div>

              <div style={styles.row}>
                <button
                  style={studentCompletion.transport ? styles.secondaryButton : styles.primaryButton}
                  onClick={handleSaveTransport}
                  disabled={studentCompletion.transport}
                >
                  {studentCompletion.transport ? "Transport validé ✓" : "Valider transport"}
                </button>
                <button style={styles.secondaryButton} onClick={() => setScreen("student_login")}>
                  Retour
                </button>
                <button
                  style={studentCompletion.transport ? styles.primaryButton : styles.secondaryButton}
                  onClick={() => goToStudentQuestionnaire("dejeuner")}
                >
                  Questionnaire suivant
                </button>
              </div>

              <button
                style={styles.secondaryButton}
                onClick={() => resetStudentQuestionnaire("transport")}
              >
                Réinitialiser ce questionnaire
              </button>

              {transportMessage ? (
                <div style={styles.infoMessage}>{transportMessage}</div>
              ) : null}
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (screen === "student_dejeuner") {
    return (
      <div style={styles.appShell}>
        <StudentSidebar
          active="collecte"
          onGo={goToScreen}
         analysisUnlocked={studentAnalysisUnlocked}
         syntheseUnlocked={studentSyntheseUnlocked}
         onBeforeOpenAnalysis={refreshStudentAnalysisData}
         onBeforeOpenSynthese={refreshStudentSyntheseData}
         sessionCode={studentSelectedSessionCode}
         sessionId={studentSelectedSessionId}
         voteUnlocked={studentVoteUnlocked}
onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
        />
        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
            <div style={styles.topHeaderTitle}>BILAN CARBONE DE LA SÉANCE DE COURS</div>
            <div style={styles.topHeaderSub}>
              Activité pédagogique développée par G. Lesur-Irichabeau &amp; J. Hanoteau
            </div>
          </header>
          <section style={styles.bigPanel}>
            <h2 style={styles.panelTitle}>Collecte des données</h2>
            <div style={styles.innerCardFull}>
              <StudentQuestionnaireTabs
                active="dejeuner"
                completion={studentCompletion}
                onNavigate={goToStudentQuestionnaire}
                canAccess={canAccessStudentQuestionnaire}
              />
            </div>
            <div style={{ ...styles.homeCard, width: "100%", padding: 0, background: "transparent", boxShadow: "none" }}>
              <div style={styles.subtleText}>Mail : {studentEmail}</div>
              <div style={styles.subtleText}>
  Code session : {formatSessionCode(studentSelectedSessionCode || studentCodeSession)}
</div>
              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>🍽️</div>
                  <h3 style={styles.sectionTitle}>Plat principal</h3>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Sandwich</label>
                  <select style={styles.input} value={dejeuner.sandwich} onChange={(e) => setDejeuner((s) => ({ ...s, sandwich: e.target.value }))}>
                    {sandwichOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Quiche / pizza</label>
                  <select style={styles.input} value={dejeuner.quiche_pizza} onChange={(e) => setDejeuner((s) => ({ ...s, quiche_pizza: e.target.value }))}>
                    {quichePizzaOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Plat de pâtes</label>
                  <select style={styles.input} value={dejeuner.plat_pates} onChange={(e) => setDejeuner((s) => ({ ...s, plat_pates: e.target.value }))}>
                    {platPatesOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>🥩</div>
                  <h3 style={styles.sectionTitle}>Protéines</h3>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Viande rouge</label>
                  <select style={styles.input} value={dejeuner.viande_rouge} onChange={(e) => setDejeuner((s) => ({ ...s, viande_rouge: e.target.value }))}>
                    {viandeRougeOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Viande blanche</label>
                  <select style={styles.input} value={dejeuner.autre_viande} onChange={(e) => setDejeuner((s) => ({ ...s, autre_viande: e.target.value }))}>
                    {autreViandeOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Poisson</label>
                  <select style={styles.input} value={dejeuner.poisson} onChange={(e) => setDejeuner((s) => ({ ...s, poisson: e.target.value }))}>
                    {poissonOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Œufs</label>
                  <select style={styles.input} value={dejeuner.oeufs} onChange={(e) => setDejeuner((s) => ({ ...s, oeufs: e.target.value }))}>
                    {oeufsOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>🥗</div>
                  <h3 style={styles.sectionTitle}>Accompagnements</h3>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Accompagnement</label>
                  <select style={styles.input} value={dejeuner.accompagnement} onChange={(e) => setDejeuner((s) => ({ ...s, accompagnement: e.target.value }))}>
                    {accompagnementOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Frites / chips</label>
                  <select style={styles.input} value={dejeuner.frites_chips} onChange={(e) => setDejeuner((s) => ({ ...s, frites_chips: e.target.value }))}>
                    {fritesChipsOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Salade composée</label>
                  <select style={styles.input} value={dejeuner.salade_composee} onChange={(e) => setDejeuner((s) => ({ ...s, salade_composee: e.target.value }))}>
                    {saladeComposeeOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>🍎</div>
                  <h3 style={styles.sectionTitle}>Desserts et fruits</h3>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Fruit local</label>
                  <select style={styles.input} value={dejeuner.fruit_local} onChange={(e) => setDejeuner((s) => ({ ...s, fruit_local: e.target.value }))}>
                    {fruitLocalOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Fruit importé</label>
                  <select style={styles.input} value={dejeuner.fruit_importe} onChange={(e) => setDejeuner((s) => ({ ...s, fruit_importe: e.target.value }))}>
                    {fruitImporteOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Laitage</label>
                  <select style={styles.input} value={dejeuner.laitage} onChange={(e) => setDejeuner((s) => ({ ...s, laitage: e.target.value }))}>
                    {laitageOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Dessert</label>
                  <select style={styles.input} value={dejeuner.dessert} onChange={(e) => setDejeuner((s) => ({ ...s, dessert: e.target.value }))}>
                    {dessertOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>🥤</div>
                  <h3 style={styles.sectionTitle}>Boissons</h3>
                </div>

                <div style={styles.checkboxGrid}>
                  {boissonOptions.map(([value, label]) => (
                    <label key={value} style={styles.checkboxItem}>
                      <input type="checkbox" checked={dejeuner.boissons.includes(value)} onChange={() => toggleBoisson(value)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={styles.row}>
<button
  style={studentCompletion.dejeuner ? styles.secondaryButton : styles.primaryButton}
  onClick={handleSaveDejeuner}
  disabled={studentCompletion.dejeuner}
>
  {studentCompletion.dejeuner ? "Déjeuner validé ✓" : "Valider déjeuner"}
</button>
                <button style={styles.secondaryButton} onClick={() => goToStudentQuestionnaire("transport")}>
                  Retour transport
                </button>
                <button style={styles.secondaryButton} onClick={() => resetStudentQuestionnaire("dejeuner")}>
                  Réinitialiser ce questionnaire
                </button>
                <button
                  style={studentCompletion.dejeuner ? styles.primaryButton : styles.secondaryButton}
                  onClick={() => goToStudentQuestionnaire("equipement")}
                >
                  Questionnaire suivant
                </button>
              </div>

              {dejeunerMessage ? <div style={styles.infoMessage}>{dejeunerMessage}</div> : null}
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (screen === "student_equipement") {
    return (
      <div style={styles.appShell}>
<StudentSidebar
  active="collecte"
  onGo={goToScreen}
  analysisUnlocked={studentAnalysisUnlocked}
  syntheseUnlocked={studentSyntheseUnlocked}
  onBeforeOpenAnalysis={refreshStudentAnalysisData}
  onBeforeOpenSynthese={refreshStudentSyntheseData}
  sessionCode={studentSelectedSessionCode}
  sessionId={studentSelectedSessionId}
  voteUnlocked={studentVoteUnlocked}
onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
/>

        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
            <div style={styles.topHeaderTitle}>BILAN CARBONE DE LA SÉANCE DE COURS</div>
            <div style={styles.topHeaderSub}>
              Activité pédagogique développée par G. Lesur-Irichabeau &amp; J. Hanoteau
            </div>
          </header>

          <section style={styles.bigPanel}>
            <h2 style={styles.panelTitle}>Collecte des données</h2>

            <div style={styles.innerCardFull}>
              <StudentQuestionnaireTabs
                active="equipement"
                completion={studentCompletion}
                onNavigate={goToStudentQuestionnaire}
                canAccess={canAccessStudentQuestionnaire}
              />
            </div>

            <div style={{ ...styles.homeCard, width: "100%", padding: 0, background: "transparent", boxShadow: "none" }}>
              <div style={styles.subtleText}>Mail : {studentEmail}</div>
              <div style={styles.subtleText}>
  Code session : {formatSessionCode(studentSelectedSessionCode || studentCodeSession)}
</div>

              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>💻</div>
                  <h3 style={styles.sectionTitle}>Équipements utilisés</h3>
                </div>

                <div style={styles.checkboxGrid}>
                  {equipementChoices.map(([value, label]) => (
                    <label key={value} style={styles.checkboxItem}>
                      <input type="checkbox" checked={equipement.used_equipment.includes(value)} onChange={() => toggleEquipement(value)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>📧</div>
                  <h3 style={styles.sectionTitle}>Emails</h3>
                </div>

<div style={styles.questionBlock}>
  <label style={styles.questionLabel}>Nombre d'emails envoyés avec pièce jointe</label>
  <input
    style={styles.input}
    type="number"
    min="0"
    value={equipement.emails_with_attachment}
    onChange={(e) => setEquipement((s) => ({ ...s, emails_with_attachment: e.target.value }))}
  />
</div>

<div style={styles.questionBlock}>
  <label style={styles.questionLabel}>Nombre d'emails envoyés sans pièce jointe</label>
  <input
    style={styles.input}
    type="number"
    min="0"
    value={equipement.emails_without_attachment}
    onChange={(e) => setEquipement((s) => ({ ...s, emails_without_attachment: e.target.value }))}
  />
</div>
              </div>

              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>📱</div>
                  <h3 style={styles.sectionTitle}>Réseaux sociaux</h3>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Temps pour préparer le cours</label>
                  <select style={styles.input} value={equipement.social_prep_minutes} onChange={(e) => setEquipement((s) => ({ ...s, social_prep_minutes: e.target.value }))}>
                    <option value="">Sélectionner</option>
                    {minuteOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Temps pendant le cours</label>
                  <select style={styles.input} value={equipement.social_during_class_minutes} onChange={(e) => setEquipement((s) => ({ ...s, social_during_class_minutes: e.target.value }))}>
                    <option value="">Sélectionner</option>
                    {minuteOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>🤖</div>
                  <h3 style={styles.sectionTitle}>Utilisation de l’IA</h3>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Temps pour préparer le cours</label>
                  <select style={styles.input} value={equipement.ai_prep_minutes} onChange={(e) => setEquipement((s) => ({ ...s, ai_prep_minutes: e.target.value }))}>
                    <option value="">Sélectionner</option>
                    {minuteOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.questionBlock}>
                  <label style={styles.questionLabel}>Temps pendant le cours</label>
                  <select style={styles.input} value={equipement.ai_during_class_minutes} onChange={(e) => setEquipement((s) => ({ ...s, ai_during_class_minutes: e.target.value }))}>
                    <option value="">Sélectionner</option>
                    {minuteOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.row}>
<button
  style={studentCompletion.equipement ? styles.secondaryButton : styles.primaryButton}
  onClick={handleSaveEquipement}
  disabled={studentCompletion.equipement}
>
  {studentCompletion.equipement ? "Équipement validé ✓" : "Valider équipement"}
</button>
                <button style={styles.secondaryButton} onClick={() => goToStudentQuestionnaire("dejeuner")}>
                  Retour déjeuner
                </button>
                <button style={styles.secondaryButton} onClick={() => resetStudentQuestionnaire("equipement")}>
                  Réinitialiser ce questionnaire
                </button>
                <button
                  style={studentCompletion.equipement ? styles.primaryButton : styles.secondaryButton}
                  onClick={() => goToStudentQuestionnaire("autres")}
                >
                  Questionnaire suivant
                </button>
              </div>

              {equipementMessage ? <div style={styles.infoMessage}>{equipementMessage}</div> : null}
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (screen === "student_autres") {
    return (
      <div style={styles.appShell}>
<StudentSidebar
  active="collecte"
  onGo={goToScreen}
  analysisUnlocked={studentAnalysisUnlocked}
  syntheseUnlocked={studentSyntheseUnlocked}
  onBeforeOpenAnalysis={refreshStudentAnalysisData}
  onBeforeOpenSynthese={refreshStudentSyntheseData}
  sessionCode={studentSelectedSessionCode}
  sessionId={studentSelectedSessionId}
  voteUnlocked={studentVoteUnlocked}
onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
/>

        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
            <div style={styles.topHeaderTitle}>BILAN CARBONE DE LA SÉANCE DE COURS</div>
            <div style={styles.topHeaderSub}>
              Activité pédagogique développée par G. Lesur-Irichabeau &amp; J. Hanoteau
            </div>
          </header>

          <section style={styles.bigPanel}>
            <h2 style={styles.panelTitle}>Collecte des données</h2>

            <div style={styles.innerCardFull}>
              <StudentQuestionnaireTabs
                active="autres"
                completion={studentCompletion}
                onNavigate={goToStudentQuestionnaire}
                canAccess={canAccessStudentQuestionnaire}
              />
            </div>

            <div style={{ ...styles.homeCard, width: "100%", padding: 0, background: "transparent", boxShadow: "none" }}>
              <div style={styles.subtleText}>Mail : {studentEmail}</div>
              <div style={styles.subtleText}>
  Code session : {formatSessionCode(studentSelectedSessionCode || studentCodeSession)}
</div>

              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>🍪</div>
                  <h3 style={styles.sectionTitle}>Grignotage</h3>
                </div>

                <div style={styles.checkboxGrid}>
                  {snackOptions.map(([value, label]) => (
                    <label key={value} style={styles.checkboxItem}>
                      <input type="checkbox" checked={autres.snacks.includes(value)} onChange={() => toggleAutres("snacks", value)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>🍎</div>
                  <h3 style={styles.sectionTitle}>Fruits locaux</h3>
                </div>

                <div style={styles.checkboxGrid}>
                  {localFruitSnackOptions.map(([value, label]) => (
                    <label key={value} style={styles.checkboxItem}>
                      <input type="checkbox" checked={autres.local_fruits.includes(value)} onChange={() => toggleAutres("local_fruits", value)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>🥭</div>
                  <h3 style={styles.sectionTitle}>Fruits importés</h3>
                </div>

                <div style={styles.checkboxGrid}>
                  {importedFruitSnackOptions.map(([value, label]) => (
                    <label key={value} style={styles.checkboxItem}>
                      <input type="checkbox" checked={autres.imported_fruits.includes(value)} onChange={() => toggleAutres("imported_fruits", value)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={styles.sectionCard}>
                <div style={styles.sectionHeader}>
                  <div style={styles.sectionIcon}>☕</div>
                  <h3 style={styles.sectionTitle}>Boissons</h3>
                </div>

                <div style={styles.checkboxGrid}>
                  {hotDrinkOptions.map(([value, label]) => (
                    <label key={value} style={styles.checkboxItem}>
                      <input type="checkbox" checked={autres.hot_drinks.includes(value)} onChange={() => toggleAutres("hot_drinks", value)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={styles.row}>
                <button
                  style={studentCompletion.autres ? styles.secondaryButton : styles.primaryButton}
                  onClick={handleSaveAutres}
                  disabled={studentCompletion.autres}
                >
                  {studentCompletion.autres ? "Autres consommations validé ✓" : "Valider autres consommations"}
                </button>
                <button style={styles.secondaryButton} onClick={() => goToStudentQuestionnaire("equipement")}>
                  Retour équipement
                </button>
              </div>

              <button style={styles.secondaryButton} onClick={() => resetStudentQuestionnaire("autres")}>
                Réinitialiser ce questionnaire
              </button>

              {autresMessage ? <div style={styles.infoMessage}>{autresMessage}</div> : null}
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (screen === ("admin_dashboard" as Screen)) {
    return (
      <div style={styles.appShell}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarBrand}>
            <img src={kedgeLogo} alt="KEDGE Business School" style={styles.sidebarLogo} />
          </div>

          <button
            style={adminTab === "teachers" ? styles.sidebarButtonActive : styles.sidebarButton}
            onClick={() => setAdminTab("teachers")}
          >
            Professeurs
          </button>

          <button
            style={adminTab === "sessions" ? styles.sidebarButtonActive : styles.sidebarButton}
            onClick={() => setAdminTab("sessions")}
          >
            Sessions
          </button>

          <button
            style={styles.sidebarButton}
            onClick={async () => {
              await loadTeacherSessions(teacherUserId);
              setTeacherMenu("sessions");
              setScreen("teacher_dashboard");
              setMessage("Accès professeur ouvert.");
            }}
          >
            Accès professeur
          </button>

          <div style={styles.sidebarFooter}>
            <button style={styles.sidebarSmallButton} onClick={handleTeacherLogout}>
              Déconnexion
            </button>
          </div>
        </aside>

        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
            <div style={styles.topHeaderTitle}>ADMINISTRATION</div>
            <div style={styles.topHeaderSub}>
              Gestion des professeurs et des sessions · connecté en {currentUserRole || "admin"}
            </div>
          </header>

          <section style={styles.bigPanel}>
            {adminTab === "teachers" && (
              <>
                <h2 style={styles.panelTitle}>Professeurs</h2>

                <div
                  style={{
                    ...styles.innerCardFull,
                    display: "grid",
                    gridTemplateColumns: "minmax(320px, 420px) 1fr",
                    gap: 20,
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      background: "#eef4fb",
                      border: "1px solid #d2dbe8",
                      borderRadius: 20,
                      padding: 18,
                    }}
                  >
                    <h3 style={{ ...styles.innerTitle, marginBottom: 8 }}>Créer un professeur</h3>
                    <div style={styles.bodyText}>
                      Créez directement un compte professeur avec nom, email et mot de passe.
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                      <input style={styles.input} placeholder="Nom du professeur" value={newTeacherName} onChange={(e) => setNewTeacherName(e.target.value)} />
                      <input style={styles.input} placeholder="Email du professeur" value={newTeacherEmail} onChange={(e) => setNewTeacherEmail(e.target.value)} />
                      <input style={styles.input} type="password" placeholder="Mot de passe temporaire" value={newTeacherPassword} onChange={(e) => setNewTeacherPassword(e.target.value)} />

                      <button type="button" style={isCreatingTeacher ? styles.secondaryButton : styles.primaryButton} disabled={isCreatingTeacher} onClick={() => { void handleCreateTeacher(newTeacherName, newTeacherEmail, newTeacherPassword); }}>
                        {isCreatingTeacher ? "Création en cours..." : "Ajouter un professeur"}
                      </button>
                    </div>
                  </div>

                  <div style={{ background: "#eef4fb", border: "1px solid #d2dbe8", borderRadius: 20, padding: 18, minHeight: 180 }}>
                    <h3 style={{ ...styles.innerTitle, marginBottom: 8 }}>Recherche</h3>
                    <div style={styles.bodyText}>Rechercher un professeur par nom ou par email.</div>
                    <input style={{ ...styles.input, marginTop: 16 }} placeholder="Rechercher par nom ou email" value={teacherSearch} onChange={(e) => setTeacherSearch(e.target.value)} />
                  </div>
                </div>

                {editingTeacherId ? (
                  <div style={styles.innerCardFull}>
                    <h3 style={styles.innerTitle}>Modifier un professeur</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                      <input style={styles.input} placeholder="Nom du professeur" value={editingTeacherName} onChange={(e) => setEditingTeacherName(e.target.value)} />
                      <input style={styles.input} placeholder="Email du professeur" value={editingTeacherEmail} onChange={(e) => setEditingTeacherEmail(e.target.value)} />
                    </div>
                    <div style={{ ...styles.row, marginTop: 12 }}>
                      <button style={styles.primaryButton} onClick={() => { void handleSaveTeacherEdit(); }}>Enregistrer les modifications</button>
                      <button style={styles.secondaryButton} onClick={() => { setEditingTeacherId(null); setEditingTeacherName(""); setEditingTeacherEmail(""); }}>Annuler</button>
                    </div>
                  </div>
                ) : null}

                <div style={styles.innerCardFull}>
                  {!filteredAdminTeachers.length ? (
                    <div style={styles.emptyText}>Aucun professeur trouvé.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={styles.reportTable}>
                        <thead>
                          <tr>
                            <th style={styles.reportTh}>Professeur</th>
                            <th style={styles.reportTh}>Rôle</th>
                            <th style={styles.reportTh}>Statut</th>
                            <th style={{ ...styles.reportTh, width: 160 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAdminTeachers.map((teacher) => (
                            <tr key={teacher.user_id}>
                              <td style={{ ...styles.reportTd, minWidth: 280 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                  <span style={{ fontWeight: 800, color: "#102a43" }}>{teacher.name || teacher.full_name || "Nom non renseigné"}</span>
                                  <span style={{ color: "#486581", fontSize: 14, wordBreak: "break-word" }}>{teacher.email}</span>
                                </div>
                              </td>
                              <td style={styles.reportTd}>
                                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 86, padding: "8px 12px", borderRadius: 999, background: teacher.role === "admin" ? "#ede9fe" : "#eff6ff", color: teacher.role === "admin" ? "#6d28d9" : "#1d4ed8", fontWeight: 800, textTransform: "capitalize" }}>{teacher.role}</span>
                              </td>
                              <td style={styles.reportTd}>
                                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 92, padding: "8px 12px", borderRadius: 999, background: teacher.is_active ? "#dcfce7" : "#fee2e2", color: teacher.is_active ? "#166534" : "#991b1b", fontWeight: 800 }}>{teacher.is_active ? "Actif" : "Inactif"}</span>
                              </td>
                              <td style={{ ...styles.reportTd, position: "relative", overflow: "visible" }}>
                                <div ref={openTeacherActionsId === teacher.user_id ? actionsMenuRef : null}>
                                  <button
                                    type="button"
                                    style={styles.adminActionButton}
                                    onClick={() =>
                                      setOpenTeacherActionsId((prev) =>
                                        prev === teacher.user_id ? null : teacher.user_id
                                      )
                                    }
                                  >
                                    Actions ▾
                                  </button>

                                  {openTeacherActionsId === teacher.user_id ? (
                                    <div style={styles.adminActionMenu}>
                                      {teacher.is_active ? (
                                        <button
                                          type="button"
                                          style={styles.adminActionMenuItem}
                                          onClick={() => {
                                            setOpenTeacherActionsId(null);
                                            void handleAdminDeactivateTeacher(teacher.user_id);
                                          }}
                                        >
                                          Désactiver
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          style={styles.adminActionMenuItem}
                                          onClick={() => {
                                            setOpenTeacherActionsId(null);
                                            void handleAdminReactivateTeacher(teacher.user_id);
                                          }}
                                        >
                                          Réactiver
                                        </button>
                                      )}

                                      {teacher.role === "teacher" ? (
                                        <button
                                          type="button"
                                          style={styles.adminActionMenuItem}
                                          onClick={() => {
                                            setOpenTeacherActionsId(null);
                                            void handleAdminPromote(teacher.user_id);
                                          }}
                                        >
                                          Passer admin
                                        </button>
                                      ) : teacher.user_id !== teacherUserId ? (
                                        <button
                                          type="button"
                                          style={styles.adminActionMenuItem}
                                          onClick={() => {
                                            setOpenTeacherActionsId(null);
                                            void handleAdminDemote(teacher.user_id);
                                          }}
                                        >
                                          Repasser prof
                                        </button>
                                      ) : null}

                                      <button
                                        type="button"
                                        style={styles.adminActionMenuItem}
                                        onClick={() => {
                                          setOpenTeacherActionsId(null);
                                          handleStartTeacherEdit(teacher);
                                        }}
                                      >
                                        Modifier
                                      </button>

                                      {teacher.role === "teacher" ? (
                                        <button
                                          type="button"
                                          style={styles.adminActionMenuItemDanger}
                                          onClick={() => {
                                            setOpenTeacherActionsId(null);
                                            void handleAdminDeleteTeacher(teacher.user_id);
                                          }}
                                        >
                                          Supprimer
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {adminTab === "sessions" && (
              <>
                <h2 style={styles.panelTitle}>Toutes les sessions</h2>

                <div
                  style={{
                    ...styles.innerCardFull,
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: 14,
                  }}
                >
                  <h3 style={styles.innerTitle}>Filtrer les sessions</h3>
                  <input
                    style={styles.input}
                    placeholder="Filtrer par nom ou email professeur"
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                  />
                </div>

                <div style={styles.innerCardFull}>
                  {!filteredAdminSessions.length ? (
                    <div style={styles.emptyText}>Aucune session trouvée.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={styles.reportTable}>
                        <thead>
                          <tr>
                            <th style={styles.reportTh}>Code session</th>
                            <th style={styles.reportTh}>Nom professeur</th>
                            <th style={styles.reportTh}>Email professeur</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAdminSessions.map((session) => (
                            <tr key={session.id}>
                              <td style={styles.reportTd}>{session.session_code}</td>
                              <td style={styles.reportTd}>{session.teacher_name || "—"}</td>
                              <td style={styles.reportTd}>{session.teacher_email || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {message ? <div style={styles.infoMessage}>{message}</div> : null}
          </section>
        </main>
      </div>
    );
  }

  if (screen === "teacher_session_settings") {
    return (
      <div style={styles.appShell}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarBrand}>
            <img src={kedgeLogo} alt="KEDGE Business School" style={styles.sidebarLogo} />
          </div>

          <button
            style={styles.sidebarButtonActive}
            onClick={() => {
              setTeacherMenu("sessions");
              setScreen("teacher_dashboard");
            }}
          >
            Sessions
          </button>

          <button
            style={{
              ...(currentUserRole === "admin" ? styles.sidebarButton : styles.secondaryButton),
              opacity: currentUserRole === "admin" ? 1 : 0.55,
              cursor: currentUserRole === "admin" ? "pointer" : "not-allowed",
            }}
            disabled={currentUserRole !== "admin"}
            onClick={() => {
              if (currentUserRole !== "admin") return;
              void handleGoToAdminFromTeacher();
            }}
          >
            Administration
          </button>

          <div style={styles.sidebarFooter}>
            <button style={styles.sidebarSmallButton} onClick={handleTeacherLogout}>
              Déconnexion
            </button>
          </div>
        </aside>

        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
            <div style={styles.topHeaderTitle}>PARAMÉTRER LA SESSION</div>
            <div style={styles.topHeaderSub}>
              Professeur : {teacherDisplayName || teacherUserEmail || "—"} · Code session : {selectedSessionCode ? formatSessionCode(selectedSessionCode) : "—"}
            </div>
          </header>

          <section style={styles.bigPanel}>
            <h2 style={styles.panelTitle}>Paramètres de la session</h2>

            <div style={styles.innerCardFull}>
              <label style={styles.label}>Code de session</label>
              <input style={styles.input} value={settingsTitle} onChange={(e) => setSettingsTitle(e.target.value)} />

              <label style={styles.label}>Mode d'accès étudiant</label>
              <div style={{ ...styles.emptyText, marginBottom: 16 }}>
                {assignmentMode === "groups"
                  ? "Assignation des étudiants à un groupe"
                  : "Liste simple d'emails autorisés"}
              </div>

              {assignmentMode === "groups" && (
                <div style={{ ...styles.innerCardFull, marginTop: 16, marginBottom: 16 }}>
                  <h3 style={styles.innerTitle}>Ajouter un étudiant</h3>

                <label style={styles.label}>Email</label>
                <input
                  style={styles.input}
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  placeholder="email@exemple.com"
                />

                {assignmentMode === "groups" && (
                  <>
                    <label style={styles.label}>Nom</label>
                    <input
                      style={styles.input}
                      value={newStudentLastName}
                      onChange={(e) => setNewStudentLastName(e.target.value)}
                      placeholder="Nom"
                    />

                    <label style={styles.label}>Prénom</label>
                    <input
                      style={styles.input}
                      value={newStudentFirstName}
                      onChange={(e) => setNewStudentFirstName(e.target.value)}
                      placeholder="Prénom"
                    />

                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, marginBottom: 10 }}>
                      <input
                        type="checkbox"
                        checked={autoAssignNewStudentGroup}
                        onChange={(e) => setAutoAssignNewStudentGroup(e.target.checked)}
                      />
                      <span style={styles.emptyText}>Assigner automatiquement le groupe</span>
                    </div>

                    {!autoAssignNewStudentGroup && (
                      <>
                        <label style={styles.label}>Groupe</label>
                        <select
                          style={styles.input}
                          value={newStudentGroupNumber}
                          onChange={(e) => setNewStudentGroupNumber(Number(e.target.value))}
                        >
                          {studentGroups.map((group) => (
                            <option key={group} value={group}>
                              Groupe {group}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </>
                )}

                  <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                    <button type="button" style={styles.primaryButton} onClick={handleAddStudentToSessionDraft}>
                      Ajouter l'étudiant
                    </button>
                  </div>
                </div>
              )}

              {assignmentMode === "emails" ? (
                <>
                  <label style={styles.label}>Emails autorisés (un par ligne)</label>
                  <textarea
                    style={{ ...styles.input, minHeight: 180 } as React.CSSProperties}
                    value={settingsAllowedEmailsText}
                    onChange={(e) => setSettingsAllowedEmailsText(e.target.value)}
                    placeholder="Un email par ligne"
                  />

                  <div style={{ ...styles.emptyText, marginTop: 10 }}>
                    {
                      settingsAllowedEmailsText
                        .split("\n")
                        .map((value) => normalizeEmail(value))
                        .filter(Boolean).length
                    } email(s) autorisé(s).
                  </div>
                </>
              ) : (
                <>
                  <label style={{ ...styles.label, display: "block", marginBottom: 10 }}>
                    Liste avec assignation
                  </label>

                  <textarea
                    style={{ ...styles.input, minHeight: 170 } as React.CSSProperties}
                    value={assignmentRawText}
                    onChange={(e) => setAssignmentRawText(e.target.value)}
                    placeholder={"email;prenom;nom;groupe\netudiant1@exemple.com;Marie;Durand;1"}
                  />

                  <div style={{ ...styles.emptyText, marginTop: 10 }}>
                    {activeStudentAssignments.length} assignation(s) valide(s) détectée(s).
                  </div>

                  <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                    <button
                      type="button"
                      style={styles.primaryButton}
                      onClick={downloadAssignmentExport}
                    >
                      Exporter l'assignation
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Rechercher par nom, prénom, groupe ou email..."
                    value={assignmentSearch}
                    onChange={(e) => setAssignmentSearch(e.target.value)}
                    style={{ ...styles.input, marginTop: 14 }}
                  />

                  {activeStudentAssignments.length > 0 ? (
                    renderAssignmentsTable(activeStudentAssignments, assignmentSearch)
                  ) : (
                    <div style={{ ...styles.emptyText, marginTop: 12 }}>
                      Aucune assignation valide détectée.
                    </div>
                  )}
                </>
              )}

              <div style={styles.row}>
                <button style={styles.primaryButton} onClick={handleSaveSessionSettings}>
                  Enregistrer
                </button>
                <button
                  style={styles.secondaryButton}
                  onClick={() => {
                    setTeacherMenu("sessions");
                    setScreen("teacher_dashboard");
                  }}
                >
                  Retour
                </button>
              </div>
            </div>

            {message ? <div style={styles.infoMessage}>{message}</div> : null}
          </section>
        </main>
      </div>
    );
  }

  if (screen === "student_analyses") {
      return (
      <div style={styles.appShell}>
        <StudentSidebar
          active="analyses"
          onGo={goToScreen}
          analysisUnlocked={studentAnalysisUnlocked}
          syntheseUnlocked={studentSyntheseUnlocked}
          onBeforeOpenAnalysis={refreshStudentAnalysisData}
          onBeforeOpenSynthese={refreshStudentSyntheseData}
          sessionCode={studentSelectedSessionCode}
          sessionId={studentSelectedSessionId}
          voteUnlocked={studentVoteUnlocked}
onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
        />

        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
<div style={styles.topHeader}>
  <div style={styles.topHeaderTitle}>BILAN CARBONE DE LA SÉANCE DE COURS</div>
  <div style={styles.topHeaderSub}>
    Activité pédagogique développée par G. Lesur-Irchabeau &amp; J. Hanoteau
  </div>
</div>
          </header>

          <section style={styles.bigPanel}>
            <h2 style={styles.panelTitle}>Analyses</h2>

            {studentAssignedGroup && studentGroupNumber !== studentAssignedGroup && (
              <div style={styles.infoMessage}>
                Accès limité au groupe {studentAssignedGroup}. Redirection automatique vers votre groupe.
              </div>
            )}

            <div style={styles.innerCardFull}>
<div style={styles.groupTabsRow}>
  {(studentAssignedGroup ? [studentAssignedGroup] : studentGroups).map((groupNumber) => (
    <button
      key={groupNumber}
      type="button"
      disabled={Boolean(studentAssignedGroup && groupNumber !== studentAssignedGroup)}
      style={effectiveStudentGroupNumber === groupNumber ? styles.groupTabButtonActive : styles.groupTabButton}
      onClick={() => {
        if (studentAssignedGroup) {
          setStudentGroupNumber(studentAssignedGroup);
          setOpenProposalGroup(null);
          return;
        }

        setStudentGroupNumber(groupNumber);
        setOpenProposalGroup(null);
      }}
    >
      Groupe {groupNumber}
    </button>
  ))}
</div>
            </div>
{studentAssignedGroup && (
  <div style={styles.innerCardFull}>
    <div style={styles.emptyText}>
      Étudiant :{" "}
      <strong>
        {[studentAssignedFirstName, studentAssignedLastName].filter(Boolean).join(" ") ||
          studentEmail}
      </strong>{" "}
      — Groupe assigné : <strong>{studentAssignedGroup}</strong>
    </div>
  </div>
)}
            <div style={styles.innerCardFull}>
              <h3 style={styles.innerTitle}>Groupe {effectiveStudentGroupNumber}</h3>
              <p style={styles.bodyText}>
                <strong>Thématique attribuée :</strong> {getThemeLabel(studentTheme)}
              </p>
              <p style={styles.bodyText}>
                 Consultez les données utiles à votre thématique puis renseignez le tableau de report correspondant.
              </p>

              <div style={styles.analysisActionRow}>
                {studentTheme !== "salle" && (
                  <button
                    type="button"
style={
  studentAnalysesTab === "donnees_a_reporter" && openProposalGroup === null
    ? styles.sidebarButtonActive
    : styles.sidebarButton
}
onClick={() => {
  setStudentAnalysesTab("donnees_a_reporter");
  setStudentShowCarbonChart(false);
  setOpenProposalGroup(null);
}}
                  >
                    Données à reporter
                  </button>
                )}

                <button
                  type="button"
style={
  studentAnalysesTab === "report_des_donnees" &&
  !studentShowCarbonChart &&
  openProposalGroup === null
    ? styles.sidebarButtonActive
    : styles.sidebarButton
}
onClick={() => {
  setStudentAnalysesTab("report_des_donnees");
  setStudentShowCarbonChart(false);
  setOpenProposalGroup(null);
}}
                >
                  Report des données
                </button>

                <button
                  type="button"
style={
  studentShowCarbonChart && openProposalGroup === null
    ? styles.sidebarButtonActive
    : styles.sidebarButton
}
onClick={() => {
  setStudentAnalysesTab("report_des_donnees");
  setStudentShowCarbonChart(true);
  setOpenProposalGroup(null);
}}
                >
                  Visualiser le bilan carbone
                </button>

                <button
                  type="button"
                  style={openProposalGroup === effectiveStudentGroupNumber ? styles.sidebarButtonActive : styles.sidebarButton}
                  onClick={() => {
  setOpenProposalGroup((prev) => (prev === effectiveStudentGroupNumber ? null : effectiveStudentGroupNumber));
  setStudentShowCarbonChart(false);
}}
                >
                  Propositions
                </button>
              </div>

              {openProposalGroup === effectiveStudentGroupNumber && (
                <div style={styles.proposalsCard}>
                  <h3 style={styles.innerTitle}>Propositions du groupe {effectiveStudentGroupNumber}</h3>

                  <div style={styles.column}>
                    <textarea
                      style={styles.proposalTextarea}
                      placeholder="Proposition 1"
                      value={teacherGroupProposals[effectiveStudentGroupNumber]?.proposal_1 ?? ""}
                      onChange={(e) =>
                        updateTeacherGroupProposalField(effectiveStudentGroupNumber, "proposal_1", e.target.value)
                      }
                      readOnly={Boolean(teacherGroupProposals[effectiveStudentGroupNumber]?.is_validated)}
                      maxLength={220}
                    />

                    <textarea
                      style={styles.proposalTextarea}
                      placeholder="Proposition 2"
                      value={teacherGroupProposals[effectiveStudentGroupNumber]?.proposal_2 ?? ""}
                      onChange={(e) =>
                        updateTeacherGroupProposalField(effectiveStudentGroupNumber, "proposal_2", e.target.value)
                      }
                      readOnly={Boolean(teacherGroupProposals[effectiveStudentGroupNumber]?.is_validated)}
                      maxLength={220}
                    />

                    <textarea
                      style={styles.proposalTextarea}
                      placeholder="Proposition 3"
                      value={teacherGroupProposals[effectiveStudentGroupNumber]?.proposal_3 ?? ""}
                      onChange={(e) =>
                        updateTeacherGroupProposalField(effectiveStudentGroupNumber, "proposal_3", e.target.value)
                      }
                      readOnly={Boolean(teacherGroupProposals[effectiveStudentGroupNumber]?.is_validated)}
                      maxLength={220}
                    />
                  </div>

                  <div style={{ ...styles.row, marginTop: 16 }}>
                    {!teacherGroupProposals[effectiveStudentGroupNumber]?.is_validated ? (
                      <button
                        type="button"
                        style={styles.primaryButton}
                        onClick={() => handleValidateGroupProposals(effectiveStudentGroupNumber, "student")}
                      >
                        Valider les propositions
                      </button>
                    ) : (
                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() => handleUnlockGroupProposals(effectiveStudentGroupNumber, "student")}
                      >
                        Modifier les propositions
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

{studentAnalysesTab === "donnees_a_reporter" && openProposalGroup === null &&
  (studentTheme === "transport" ? (
    renderTransportReportableBlock(
      studentDisplayedTransportReportableRows,
      "Aucune donnée à reporter pour le moment. Les réponses transport validées apparaîtront ici automatiquement."
    )
  ) : studentTheme === "dejeuner" ? (
    renderDejeunerReportableBlock(
      studentDejeunerReportableRows,
      "Aucune donnée déjeuner à reporter pour le moment. Les réponses déjeuner validées apparaîtront ici automatiquement."
    )
  ) : studentTheme === "equipement" ? (
    renderEquipementReportableBlock(
      studentEquipementReportableRows,
      "Aucune donnée équipement à reporter pour le moment. Les réponses équipement validées apparaîtront ici automatiquement."
    )
  ) : studentTheme === "autres" ? (
    renderAutresReportableBlock(
      studentAutresReportableRows,
      "Aucune donnée autres consommations à reporter pour le moment. Les réponses validées apparaîtront ici automatiquement."
    )
  ) : null)}

{studentAnalysesTab === "report_des_donnees" && studentShowCarbonChart && openProposalGroup === null && studentTheme === "transport" && (
  renderCarbonHistogram(
    `Bilan carbone ${getThemeLabelForButton(studentTheme)}`,
    studentTransportChartRows
  )
)}

{studentAnalysesTab === "report_des_donnees" && studentShowCarbonChart && openProposalGroup === null && studentTheme === "dejeuner" && (
  renderCarbonHistogram(
    `Bilan carbone ${getThemeLabelForButton(studentTheme)}`,
    studentDejeunerChartRows
  )
)}

{studentAnalysesTab === "report_des_donnees" && studentShowCarbonChart && openProposalGroup === null && studentTheme === "equipement" && (
  renderCarbonHistogram(
    `Bilan carbone ${getThemeLabelForButton(studentTheme)}`,
    studentEquipementChartRows
  )
)}

{studentAnalysesTab === "report_des_donnees" && studentShowCarbonChart && openProposalGroup === null && studentTheme === "autres" && (
  renderCarbonHistogram(
    `Bilan carbone ${getThemeLabelForButton(studentTheme)}`,
    studentAutresChartRows
  )
)}

{studentAnalysesTab === "report_des_donnees" && studentShowCarbonChart && openProposalGroup === null && studentTheme === "salle" && (
  renderCarbonHistogram(
    `Bilan carbone ${getThemeLabelForButton(studentTheme)}`,
    studentSalleChartRows
  )
)}

{studentAnalysesTab === "report_des_donnees" && !studentShowCarbonChart && openProposalGroup === null && studentTheme === "transport" && (
  renderTransportAnalysisTable({
    rows: studentTransportRows,
    groupNumber: effectiveStudentGroupNumber,
    sessionId: studentSelectedSessionId,
    updatedBy: null,
    readOnly: false,
    onSave: saveTransportReportRow,
  })
)}

{studentAnalysesTab === "report_des_donnees" && !studentShowCarbonChart && openProposalGroup === null && studentTheme === "dejeuner" && (
  renderDejeunerAnalysisTable({
    rows: studentDejeunerRows,
    groupNumber: effectiveStudentGroupNumber,
    sessionId: studentSelectedSessionId,
    updatedBy: null,
    readOnly: false,
    onSave: saveDejeunerReportRow,
  })
)}

{studentAnalysesTab === "report_des_donnees" && !studentShowCarbonChart && openProposalGroup === null && studentTheme === "equipement" && (
  renderEquipementAnalysisTable({
    rows: studentEquipementRows,
    groupNumber: effectiveStudentGroupNumber,
    sessionId: studentSelectedSessionId,
    updatedBy: null,
    readOnly: false,
    onSave: saveEquipementReportRow,
  })
)}

{studentAnalysesTab === "report_des_donnees" && !studentShowCarbonChart && openProposalGroup === null && studentTheme === "autres" &&
  renderAutresAnalysisTable({
    rows: studentAutresRows,
    groupNumber: effectiveStudentGroupNumber,
    sessionId: studentSelectedSessionId,
    updatedBy: null,
    readOnly: false,
    onSave: saveAutresReportRow,
  })}

{studentAnalysesTab === "report_des_donnees" && !studentShowCarbonChart && openProposalGroup === null && studentTheme === "salle" && (
  renderSalleAnalysisTable({
    rows: studentSalleRows,
    groupNumber: effectiveStudentGroupNumber,
    sessionId: studentSelectedSessionId,
    updatedBy: null,
    readOnly: false,
    onSave: saveSalleReportRow,
  })
)}

            {studentAnalysesTab === "report_des_donnees" && !studentShowCarbonChart && openProposalGroup === null && studentTheme !== "transport" && studentTheme !== "dejeuner" && studentTheme !== "equipement" && studentTheme !== "autres" && studentTheme !== "salle" && (
              <div style={styles.infoMessage}>
                Le tableau de calcul de cette thématique reste à implémenter.
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  if (screen === "student_bilans") {
    return (
      <div style={styles.appShell}>
        <StudentSidebar
          active="bilans"
          onGo={goToScreen}
          analysisUnlocked={studentAnalysisUnlocked}
          syntheseUnlocked={studentSyntheseUnlocked}
          onBeforeOpenAnalysis={refreshStudentAnalysisData}
          onBeforeOpenSynthese={refreshStudentSyntheseData}
          sessionCode={studentSelectedSessionCode}
          sessionId={studentSelectedSessionId}
          voteUnlocked={studentVoteUnlocked}
onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
        />
        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
<div style={styles.topHeader}>
  <div style={styles.topHeaderTitle}>BILAN CARBONE DE LA SÉANCE DE COURS</div>
  <div style={styles.topHeaderSub}>
    Activité pédagogique développée par G. Lesur-Irchabeau &amp; J. Hanoteau
  </div>
</div>
          </header>

          <section style={styles.bigPanel}>
            <h2 style={styles.panelTitle}>Bilans</h2>
            <div style={styles.innerCardFull}>
              <p style={styles.bodyText}>Le menu Bilans a été retiré. Utilisez le menu Synthèse.</p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (screen === "student_synthese") {
    return (
      <div style={styles.appShell}>
        <StudentSidebar
          active="synthese"
          onGo={goToScreen}
          analysisUnlocked={studentAnalysisUnlocked}
          syntheseUnlocked={studentSyntheseUnlocked}
          onBeforeOpenAnalysis={refreshStudentAnalysisData}
          onBeforeOpenSynthese={refreshStudentSyntheseData}
          sessionCode={studentSelectedSessionCode}
          sessionId={studentSelectedSessionId}
          voteUnlocked={studentVoteUnlocked}
onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
        />
        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
<div style={styles.topHeader}>
  <div style={styles.topHeaderTitle}>BILAN CARBONE DE LA SÉANCE DE COURS</div>
  <div style={styles.topHeaderSub}>
    Activité pédagogique développée par G. Lesur-Irchabeau &amp; J. Hanoteau
  </div>
</div>
          </header>

          <section style={styles.bigPanel}>
            <h2 style={styles.panelTitle}>Synthèse</h2>

            {studentSyntheseData.length === 0 ? (
              <div style={styles.innerCardFull}>
                <h3 style={styles.innerTitle}>Synthèse étudiante</h3>
                <p style={styles.bodyText}>Aucune donnée disponible pour la synthèse.</p>
              </div>
            ) : (
              renderSyntheseDashboard(studentSyntheseData)
            )}
          </section>
        </main>
      </div>
    );
  }
if (screen === "student_vote") {
  return (
    <div style={styles.appShell}>
      <StudentSidebar
        active="vote"
        onGo={goToScreen}
        analysisUnlocked={studentAnalysisUnlocked}
        syntheseUnlocked={studentSyntheseUnlocked}
        voteUnlocked={studentVoteUnlocked}
        onBeforeOpenAnalysis={refreshStudentAnalysisData}
        onBeforeOpenSynthese={refreshStudentSyntheseData}
        onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
        sessionCode={studentSelectedSessionCode}
        sessionId={studentSelectedSessionId}
      />

      <main style={styles.mainArea}>
<header style={styles.topHeader}>
  <div style={styles.topHeaderTitle}>BILAN CARBONE DE LA SÉANCE DE COURS</div>
  <div style={styles.topHeaderSub}>
    Activité pédagogique développée par G. Lesur-Irchabeau &amp; J. Hanoteau
  </div>
</header>

        <section style={styles.bigPanel}>
          <h2 style={styles.panelTitle}>Vote étudiant</h2>

          {!studentVoteUnlocked ? (
            <div style={styles.innerCardFull}>
              <p style={styles.bodyText}>
                Le vote n'est pas encore accessible. Attendez l'autorisation du professeur.
              </p>
            </div>
          ) : consolidatedProposals.length === 0 ? (
            <div style={styles.innerCardFull}>
              <p style={styles.bodyText}>
                Aucune proposition consolidée n'est encore disponible.
              </p>
            </div>
          ) : (
            <>
              <div style={styles.innerCardFull}>
                <h3 style={styles.innerTitle}>Mes choix</h3>
                <p style={styles.bodyText}>Sélectionnez jusqu’à 3 propositions par ordre de priorité.</p>

<div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
  <div style={styles.bodyText}>
    <strong>Choix 1 :</strong> {getProposalTextById(studentVotes.rank1)}
  </div>

  <div style={styles.bodyText}>
    <strong>Choix 2 :</strong> {getProposalTextById(studentVotes.rank2)}
  </div>

  <div style={styles.bodyText}>
    <strong>Choix 3 :</strong> {getProposalTextById(studentVotes.rank3)}
  </div>

  <div
    style={{
      marginTop: 8,
      padding: "10px 14px",
      borderRadius: 12,
      background: studentVoteSubmitted ? "#ecfdf3" : "#fff7ed",
      color: studentVoteSubmitted ? "#166534" : "#9a3412",
      fontWeight: 700,
      textAlign: "center",
    }}
  >
    {studentVoteSubmitted ? "Vote soumis" : "Modifications non soumises"}
  </div>
</div>

                <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                  <button style={styles.secondaryButton} type="button" onClick={() => clearVote(1)}>
                    Effacer choix 1
                  </button>
                  <button style={styles.secondaryButton} type="button" onClick={() => clearVote(2)}>
                    Effacer choix 2
                  </button>
                  <button style={styles.secondaryButton} type="button" onClick={() => clearVote(3)}>
                    Effacer choix 3
                  </button>
<button style={styles.primaryButton} onClick={saveStudentVotes}>
  {studentVoteSubmitted ? "Mettre à jour mon vote" : "Valider mon vote"}
</button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {consolidatedProposals.map((proposal, index) => (
                  <div
                    key={proposal.id}
                    style={{
                      ...styles.innerCardFull,
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) 180px",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    <div style={styles.sessionItemTitle}>
                      {index + 1}. {proposal.text}
                    </div>

                    <select
                      style={styles.input}
                      value={
                        studentVotes.rank1 === proposal.id
                          ? "1"
                          : studentVotes.rank2 === proposal.id
                          ? "2"
                          : studentVotes.rank3 === proposal.id
                          ? "3"
                          : ""
                      }
                      onChange={(e) => {
                        const value = e.target.value;

                        if (value === "") {
                          if (studentVotes.rank1 === proposal.id) clearVote(1);
                          if (studentVotes.rank2 === proposal.id) clearVote(2);
                          if (studentVotes.rank3 === proposal.id) clearVote(3);
                          return;
                        }

                        selectVote(Number(value) as 1 | 2 | 3, proposal.id);
                      }}
                    >
                      <option value="">—</option>
                      <option value="1">Choix 1</option>
                      <option value="2">Choix 2</option>
                      <option value="3">Choix 3</option>
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

  return (
    <div style={styles.appShell}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarBrand}>
          <img src={kedgeLogo} alt="KEDGE Business School" style={styles.sidebarLogo} />
        </div>

        <button
          style={teacherMenu === "sessions" ? styles.sidebarButtonActive : styles.sidebarButton}
          onClick={() => setTeacherMenu("sessions")}
        >
          Sessions
        </button>

        <button
          style={teacherMenu === "session_open" ? styles.sidebarButtonActive : styles.sidebarButton}
          onClick={() => {
            if (!selectedSessionId) {
              setMessage("Ouvre d'abord une session.");
              return;
            }
            setTeacherMenu("session_open");
            setTeacherSessionTab("counts");
          }}
        >
          Session ouverte
        </button>


        <button
            style={{
              ...(currentUserRole === "admin" ? styles.sidebarButton : styles.secondaryButton),
              opacity: currentUserRole === "admin" ? 1 : 0.55,
              cursor: currentUserRole === "admin" ? "pointer" : "not-allowed",
            }}
            disabled={currentUserRole !== "admin"}
            onClick={() => {
              if (currentUserRole !== "admin") return;
              void handleGoToAdminFromTeacher();
            }}
          >
            Administration
          </button>

        <div style={styles.sidebarFooter}>
          <button style={styles.sidebarSmallButton} onClick={handleTeacherLogout}>
            Déconnexion
          </button>
        </div>
      </aside>

      <main style={styles.mainArea}>
        <header style={styles.topHeader}>
          <div style={styles.topHeaderTitle}>BILAN CARBONE DE LA SÉANCE DE COURS</div>
          <div style={styles.topHeaderSub}>
            Activité pédagogique développée par G. Lesur-Irichabeau &amp; J. Hanoteau · Professeur : {teacherDisplayName || teacherUserEmail || "—"}
          </div>
        </header>

        <section style={styles.bigPanel}>
          {teacherMenu === "sessions" && (
            <>
              <h2 style={styles.panelTitle}>Gestion des sessions</h2>

              <div style={styles.twoCols}>
                <div style={styles.innerCard}>
<h3 style={styles.innerTitle}>Créer une session</h3>

<label style={styles.label}>Campus</label>
<select
  style={styles.input}
  value={quickSessionCampus}
  onChange={(e) => setQuickSessionCampus(e.target.value)}
>
  <option value="">Sélectionner un campus</option>
  <option value="BOD">Bordeaux</option>
  <option value="MRS">Marseille</option>
  <option value="PAR">Paris</option>
  <option value="TLN">Toulon</option>
  <option value="BIA">Bastia</option>
  <option value="AVN">Avignon</option>
  <option value="DKR">Dakar</option>
  <option value="BYO">Bayonne</option>
  <option value="MDM">Mont-de-Marsan</option>
</select>

<label style={styles.label}>Programme</label>
<select
  style={styles.input}
  value={quickSessionProgramme}
  onChange={(e) => setQuickSessionProgramme(e.target.value)}
>
  <option value="">Sélectionner un programme</option>
  <option value="KBA">KEDGE Bachelor</option>
  <option value="PGE">Programme Grande École</option>
  <option value="EBP">EBP</option>
  <option value="IBBA">IBBA</option>
  <option value="OTH">Autre programme</option>
</select>

<label style={styles.label}>Niveau</label>
<input
  style={styles.input}
  placeholder="Ex. 1, 2, 3..."
  value={quickSessionLevel}
  onChange={(e) => setQuickSessionLevel(e.target.value)}
/>

<label style={styles.label}>Nom de la session</label>
<input
  style={styles.input}
  placeholder="Ex. SECTION 1 ou 210426"
  value={quickSessionSuffix}
  onChange={(e) => setQuickSessionSuffix(e.target.value)}
/>

<div style={styles.emptyText}>
  Code généré :{" "}
  <strong>
    {quickSessionCampus && quickSessionProgramme && quickSessionLevel && quickSessionSuffix
      ? `${quickSessionCampus}-${quickSessionProgramme}${quickSessionLevel}-${quickSessionSuffix}`.toUpperCase()
      : "—"}
  </strong>
</div>

<div style={{ marginTop: 16 }}>
  <label style={styles.label}>Mode d'accès étudiant</label>

  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <label>
      <input
        type="radio"
        checked={assignmentMode === "emails"}
        onChange={() => setAssignmentMode("emails")}
      />{" "}
      Liste simple d'emails autorisés
    </label>

    <label>
      <input
        type="radio"
        checked={assignmentMode === "groups"}
        onChange={() => setAssignmentMode("groups")}
      />{" "}
      Assignation des étudiants à un groupe
    </label>
  </div>
</div>

<button style={styles.primaryButton} onClick={handleCreateSessionQuick}>
  Créer la session
</button>
                </div>

                <div style={styles.innerCard}>
                  <h3 style={styles.innerTitle}>Mes sessions</h3>

                  {!teacherSessions.length ? (
                    <div style={styles.emptyText}>Aucune session créée pour le moment.</div>
                  ) : (
                    <div style={styles.sessionList}>
                      {teacherSessions.map((session) => (
                        <div key={session.id} style={styles.sessionItem}>
                          <div>
                            <div style={styles.sessionItemMeta}>
                              Code : <strong>{formatSessionCode(session.session_code)}</strong>
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 10,
                              alignItems: "stretch",
                              minWidth: 112,
                            }}
                          >
                            <button style={{ ...styles.secondaryButton, width: "100%" }} onClick={() => handleOpenSession(session)}>
                              Ouvrir
                            </button>
                            <button style={{ ...styles.deleteButton, width: "100%" }} onClick={() => handleDeleteSession(session)}>
                              Supprimer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.innerCardFull}>
                <h3 style={styles.innerTitle}>Session sélectionnée</h3>
                <div style={styles.emptyText}>
                  {selectedSessionCode
                    ? `Code session actif : ${formatSessionCode(selectedSessionCode)} — ID : ${selectedSessionId}`
                    : "Aucune session sélectionnée"}
                </div>
              </div>

              {message ? <div style={styles.infoMessage}>{message}</div> : null}
            </>
          )}

          {teacherMenu === "session_open" && (
            <>
              <h2 style={styles.panelTitle}>Session ouverte</h2>

              <div style={styles.innerCardFull}>
                <div style={styles.row}>
                  <button
                    style={teacherSessionTab === "counts" ? styles.sidebarButtonActive : styles.sidebarButton}
                    onClick={() => setTeacherSessionTab("counts")}
                  >
                    Compteur de réponses
                  </button>

                  <button
                    style={teacherSessionTab === "users" ? styles.sidebarButtonActive : styles.sidebarButton}
                    onClick={() => setTeacherSessionTab("users")}
                  >
                    Utilisateurs
                  </button>

                  <button
                    style={teacherSessionTab === "analyses" ? styles.sidebarButtonActive : styles.sidebarButton}
                    onClick={() => setTeacherSessionTab("analyses")}
                  >
                    Analyses {studentAnalysisUnlocked ? "🔓" : "🔒"}
                  </button>

                  <button
                    style={teacherSessionTab === "vote" ? styles.sidebarButtonActive : styles.sidebarButton}
                    onClick={() => setTeacherSessionTab("vote")}
                  >
                    Vote {studentVoteUnlocked ? "🔓" : "🔒"}
                  </button>

                  <button
                    style={teacherSessionTab === "synthese" ? styles.sidebarButtonActive : styles.sidebarButton}
                    onClick={() => setTeacherSessionTab("synthese")}
                  >
                    Synthèse {studentSyntheseUnlocked ? "🔓" : "🔒"}
                  </button>
                </div>
              </div>

              <div style={styles.innerCardFull}>
                <h3 style={styles.innerTitle}>Session active</h3>
                <div style={styles.emptyText}>
                  {selectedSessionCode
                    ? `Code session actif : ${formatSessionCode(selectedSessionCode)} — ID : ${selectedSessionId}`
                    : "Aucune session sélectionnée"}
                </div>
              </div>

              {teacherSessionTab === "counts" && (
                <>
                  <div style={styles.statsGrid}>
                    <div style={styles.statCard}>
                      <div style={styles.statLabel}>Transport</div>
                      <div style={styles.statValue}>{counts.transport_count}</div>
                    </div>
                    <div style={styles.statCard}>
                      <div style={styles.statLabel}>Déjeuner</div>
                      <div style={styles.statValue}>{counts.dejeuner_count}</div>
                    </div>
                    <div style={styles.statCard}>
                      <div style={styles.statLabel}>Équipement</div>
                      <div style={styles.statValue}>{counts.equipement_count}</div>
                    </div>
                    <div style={styles.statCard}>
                      <div style={styles.statLabel}>Autres consommations</div>
                      <div style={styles.statValue}>{counts.autres_count}</div>
                    </div>
                  </div>
                </>
              )}


              {teacherSessionTab === "users" && (
                <div style={styles.innerCardFull}>
                  <h3 style={styles.innerTitle}>Utilisateurs autorisés</h3>

                  <div style={styles.sessionItemMeta}>
                    Session : <strong>{formatSessionCode(selectedSessionCode) || "—"}</strong>
                  </div>

                  <input
                    type="text"
                    placeholder="Rechercher par nom, prénom, groupe ou email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    style={{ ...styles.input, marginTop: 10 }}
                  />

                  {displayedStudentAssignments.length > 0 ? (
                    renderAssignmentsTable(displayedStudentAssignments, userSearch)
                  ) : !sortedFilteredEmails.length ? (
                    <div style={{ ...styles.emptyText, marginTop: 12 }}>
                      Aucun email trouvé.
                    </div>
                  ) : (
                    <div
                      style={{
                        maxHeight: 360,
                        overflowY: "auto",
                        overflowX: "auto",
                        marginTop: 12,
                        border: "1px solid #d8e0ec",
                        borderRadius: 14,
                        background: "#fff",
                      }}
                    >
                      <table style={{ ...styles.reportTable, marginTop: 0 }}>
                        <thead>
                          <tr>
                            <th style={{ ...styles.reportTh, position: "sticky", top: 0, zIndex: 2 }}>Email</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedFilteredEmails.map((email) => (
                            <tr key={email}>
                              <td style={styles.reportTd}>{email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ ...styles.row, marginTop: 16 }}>
                    {displayedStudentAssignments.length > 0 && (
                      <button
                        style={styles.primaryButton}
                        onClick={downloadAssignmentExport}
                      >
                        Exporter l'assignation
                      </button>
                    )}

                    <button
                      style={styles.secondaryButton}
                      onClick={() => setScreen("teacher_session_settings")}
                    >
                      Modifier les paramètres
                    </button>
                  </div>
                </div>
              )}

              {teacherSessionTab === "analyses" && (
                <>
                  <div style={styles.innerCardFull}>
                    <div style={styles.row}>
                      <button style={styles.primaryButton} onClick={toggleStudentAnalysisAccess}>
                        {studentAnalysisUnlocked
                          ? "🔓 Analyse accessible aux étudiants"
                          : "🔒 Analyse non accessible aux étudiants"}
                      </button>
                    </div>
                  </div>

                  <div style={styles.innerCardFull}>
<div style={styles.groupTabsRow}>
  {studentGroups.map((groupNumber) => (
    <button
      key={groupNumber}
      type="button"
      style={teacherGroupNumber === groupNumber ? styles.groupTabButtonActive : styles.groupTabButton}
onClick={() => {
  setTeacherGroupNumber(groupNumber);
  setOpenProposalGroup(null);
}}
    >
      Groupe {groupNumber}
    </button>
  ))}
</div>
                  </div>

                  <div style={styles.innerCardFull}>
                    <h3 style={styles.innerTitle}>Groupe {teacherGroupNumber}</h3>
                    <p style={styles.bodyText}>
                      <strong>Thématique attribuée :</strong> {getThemeLabel(teacherTheme)}
                    </p>
                    <p style={styles.bodyText}>
                      Consultez les données utiles à votre thématique puis renseignez le tableau de report correspondant.
                    </p>

<div style={styles.analysisActionRow}>
  {teacherTheme !== "salle" && (
    <button
      type="button"
      style={
  teacherAnalysesTab === "donnees_a_reporter" && openProposalGroup === null
    ? styles.sidebarButtonActive
    : styles.sidebarButton
}
onClick={() => {
  setOpenProposalGroup(null);
  setTeacherAnalysesTab("donnees_a_reporter");
  setTeacherShowCarbonChart(false);
}}
    >
      Données à reporter
    </button>
  )}

<button
  type="button"
  style={
    teacherAnalysesTab === "report_des_donnees" &&
    !teacherShowCarbonChart &&
    openProposalGroup === null
      ? styles.sidebarButtonActive
      : styles.sidebarButton
  }
  onClick={() => {
    setTeacherAnalysesTab("report_des_donnees");
    setTeacherShowCarbonChart(false);
    setOpenProposalGroup(null);
  }}
>
  Report des données
</button>

  <button
    type="button"
style={
  teacherShowCarbonChart && openProposalGroup === null
    ? styles.sidebarButtonActive
    : styles.sidebarButton
}
onClick={() => {
  setTeacherAnalysesTab("report_des_donnees");
  setTeacherShowCarbonChart(true);
  setOpenProposalGroup(null);
}}
  >
    Visualiser le bilan carbone
  </button>

<button
  type="button"
style={
  openProposalGroup === teacherGroupNumber && !teacherShowCarbonChart
    ? styles.sidebarButtonActive
    : styles.sidebarButton
}
  onClick={() => {
    setOpenProposalGroup((prev) => (prev === teacherGroupNumber ? null : teacherGroupNumber));
    setTeacherShowCarbonChart(false);
  }}
>
  Propositions
</button>
</div>

{openProposalGroup === teacherGroupNumber && !teacherShowCarbonChart && (
  <div style={styles.proposalsCard}>
    <h3 style={styles.innerTitle}>Propositions du groupe {teacherGroupNumber}</h3>

    <div style={styles.column}>
      <textarea
        style={styles.proposalTextarea}
        value={teacherGroupProposals[teacherGroupNumber]?.proposal_1 ?? ""}
        readOnly
      />
      <textarea
        style={styles.proposalTextarea}
        value={teacherGroupProposals[teacherGroupNumber]?.proposal_2 ?? ""}
        readOnly
      />
      <textarea
        style={styles.proposalTextarea}
        value={teacherGroupProposals[teacherGroupNumber]?.proposal_3 ?? ""}
        readOnly
      />
    </div>
  </div>
)}
                  </div>

{teacherAnalysesTab === "donnees_a_reporter" && openProposalGroup === null && (
  teacherTheme === "transport" ? (
    <div>
      {renderTransportReportableBlock(
        teacherDisplayedTransportReportableRows,
        "Aucune donnée à reporter pour le moment. Les réponses transport validées apparaîtront ici automatiquement."
      )}
    </div>
  ) : teacherTheme === "dejeuner" ? (
    renderDejeunerReportableBlock(
      teacherDejeunerReportableRows,
      "Aucune donnée déjeuner à reporter pour le moment. Les réponses déjeuner validées apparaîtront ici automatiquement."
    )
  ) : teacherTheme === "equipement" ? (
    renderEquipementReportableBlock(
      teacherEquipementReportableRows,
      "Aucune donnée équipement à reporter pour le moment. Les réponses équipement validées apparaîtront ici automatiquement."
    )
  ) : teacherTheme === "autres" ? (
    renderAutresReportableBlock(
      teacherAutresReportableRows,
      "Aucune donnée autres consommations à reporter pour le moment. Les réponses validées apparaîtront ici automatiquement."
    )
  ) : null
)}

{teacherAnalysesTab === "report_des_donnees" && teacherShowCarbonChart && openProposalGroup === null && teacherTheme === "transport" && (
  renderCarbonHistogram(
    `Bilan carbone ${getThemeLabelForButton(teacherTheme)}`,
    teacherTransportChartRows
  )
)}

{teacherAnalysesTab === "report_des_donnees" && teacherShowCarbonChart && openProposalGroup === null && teacherTheme === "dejeuner" && (
  renderCarbonHistogram(
    `Bilan carbone ${getThemeLabelForButton(teacherTheme)}`,
    teacherDejeunerChartRows
  )
)}

{teacherAnalysesTab === "report_des_donnees" && teacherShowCarbonChart && openProposalGroup === null && teacherTheme === "equipement" && (
  renderCarbonHistogram(
    `Bilan carbone ${getThemeLabelForButton(teacherTheme)}`,
    teacherEquipementChartRows
  )
)}

{teacherAnalysesTab === "report_des_donnees" && teacherShowCarbonChart && openProposalGroup === null && teacherTheme === "autres" && (
  renderCarbonHistogram(
    `Bilan carbone ${getThemeLabelForButton(teacherTheme)}`,
    teacherAutresChartRows
  )
)}

{teacherAnalysesTab === "report_des_donnees" && teacherShowCarbonChart && openProposalGroup === null && teacherTheme === "salle" && (
    renderCarbonHistogram(
    `Bilan carbone ${getThemeLabelForButton(teacherTheme)}`,
    teacherSalleChartRows
  )
)}

{teacherAnalysesTab === "report_des_donnees" && !teacherShowCarbonChart && openProposalGroup === null && teacherTheme === "transport" && (
    renderTransportAnalysisTable({
    rows: teacherTransportRows,
    groupNumber: teacherGroupNumber,
    sessionId: selectedSessionId,
    updatedBy: teacherUserId,
    readOnly: true,
  })
)}

{teacherAnalysesTab === "report_des_donnees" && !teacherShowCarbonChart && openProposalGroup === null && teacherTheme === "dejeuner" && (
    renderDejeunerAnalysisTable({
    rows: teacherDejeunerRows,
    groupNumber: teacherGroupNumber,
    sessionId: selectedSessionId,
    updatedBy: teacherUserId,
    readOnly: true,
  })
)}

{teacherAnalysesTab === "report_des_donnees" && !teacherShowCarbonChart && openProposalGroup === null && teacherTheme === "equipement" && (
    renderEquipementAnalysisTable({
    rows: teacherEquipementRows,
    groupNumber: teacherGroupNumber,
    sessionId: selectedSessionId,
    updatedBy: teacherUserId,
    readOnly: true,
  })
)}

{teacherAnalysesTab === "report_des_donnees" && !teacherShowCarbonChart && openProposalGroup === null && teacherTheme === "autres" && (
    renderAutresAnalysisTable({
    rows: teacherAutresRows,
    groupNumber: teacherGroupNumber,
    sessionId: selectedSessionId,
    updatedBy: teacherUserId,
    readOnly: true,
  })
)}

{teacherAnalysesTab === "report_des_donnees" && !teacherShowCarbonChart && openProposalGroup === null && teacherTheme === "salle" && (
    renderSalleAnalysisTable({
    rows: teacherSalleRows,
    groupNumber: teacherGroupNumber,
    sessionId: selectedSessionId,
    updatedBy: teacherUserId,
    readOnly: true,
  })
)}

{teacherAnalysesTab === "report_des_donnees" && !teacherShowCarbonChart && openProposalGroup === null && teacherTheme !== "transport" && teacherTheme !== "dejeuner" && teacherTheme !== "equipement" && teacherTheme !== "autres" && teacherTheme !== "salle" && (
                      <div style={styles.infoMessage}>
                      Le tableau de calcul de cette thématique reste à implémenter.
                    </div>
                  )}

                  {message ? <div style={styles.infoMessage}>{message}</div> : null}
                </>
              )}

              {teacherSessionTab === "vote" && (
                <>
                  <div style={styles.innerCardFull}>
                    <div style={{ ...styles.row, flexWrap: "wrap", gap: 12 }}>
                      <button
                        style={styles.primaryButton}
                        onClick={async () => {
                          await exportConsolidationTxt();
                          setTeacherVoteView("proposals");
                        }}
                      >
                        Télécharger le fichier .txt à soumettre à l’IA
                      </button>

                      <button style={styles.primaryButton} onClick={toggleStudentVoteAccess}>
                        {studentVoteUnlocked
                          ? "🔓 Vote accessible aux étudiants"
                          : "🔒 Vote non accessible aux étudiants"}
                      </button>

                      <button
                        style={
                          teacherVoteView === "results"
                            ? styles.primaryButton
                            : styles.secondaryButton
                        }
                        onClick={() => setTeacherVoteView("results")}
                      >
                        Résultats des votes
                      </button>
                    </div>
                  </div>

{teacherVoteView === "proposals" && (
  <div style={styles.innerCardFull}>
    <h3 style={styles.innerTitle}>Propositions à soumettre au vote</h3>

    <div style={{ marginBottom: 16 }}>
      <p style={styles.bodyText}>
        1. Téléchargez le fichier .txt à soumettre à l’IA. 2. Faites générer
        par l’IA une liste numérotée, avec une seule proposition par ligne.
        3. Copiez-collez la réponse de l’IA dans la zone ci-dessous.
        4. Prévisualisez les propositions puis soumettez-les au vote.
      </p>
    </div>

    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: "100%",
        marginBottom: 20,
      }}
    >
      <textarea
        value={importedProposalRawText}
        onChange={(e) => setImportedProposalRawText(e.target.value)}
        placeholder={`Collez ici la réponse de l’IA, par exemple :

1. Réduire l’usage de la voiture individuelle
2. Installer plus d’options végétariennes
3. Encourager le covoiturage entre étudiants`}
        style={{
          width: "100%",
          minHeight: 220,
          resize: "vertical",
          boxSizing: "border-box",
          padding: "14px 16px",
          borderRadius: 14,
          border: "1px solid #c3d0df",
          background: "#ffffff",
          color: "#0f172a",
          fontSize: 15,
          lineHeight: 1.5,
          outline: "none",
        }}
      />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          style={styles.secondaryButton}
          onClick={previewImportedProposalsFromText}
          type="button"
        >
          Prévisualiser les propositions collées
        </button>

        <button
          style={styles.primaryButton}
          onClick={submitImportedProposalsToVote}
          disabled={importedProposalDrafts.length === 0 || isSubmittingImportedProposals}
          type="button"
        >
          {isSubmittingImportedProposals
            ? "Soumission en cours..."
            : "Soumettre ces propositions au vote"}
        </button>
      </div>
    </div>

    {importedProposalDrafts.length > 0 && (
      <div style={{ marginBottom: 28 }}>
        <h4 style={{ ...styles.innerTitle, fontSize: 20, marginBottom: 18 }}>
          Aperçu avant soumission
        </h4>

        <div style={styles.proposalCard}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {importedProposalDrafts.map((proposal, index) => (
              <div
                key={`draft-${index}`}
                style={{
                  fontSize: 15,
                  lineHeight: 1.35,
                  color: "#0f172a",
                  textAlign: "left",
                }}
              >
                <span style={{ fontWeight: 700, marginRight: 6 }}>
                  {index + 1}.
                </span>
                {proposal}
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    <h4 style={{ ...styles.innerTitle, fontSize: 20, marginBottom: 18 }}>
      Propositions actuellement soumises au vote
    </h4>

    {!consolidatedProposals.length ? (
      <p style={styles.bodyText}>
        Aucune proposition n’a encore été soumise au vote.
      </p>
    ) : (
      <div style={styles.proposalCard}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {consolidatedProposals.map((proposal, index) => (
            <div
              key={`${proposal.text}-${index}`}
              style={{
                fontSize: 15,
                lineHeight: 1.35,
                color: "#0f172a",
                textAlign: "left",
              }}
            >
              <span style={{ fontWeight: 700, marginRight: 6 }}>
                {index + 1}.
              </span>
              {proposal.text}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
)}

{teacherVoteView === "results" && (
  <div style={styles.innerCardFull}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <h3 style={styles.innerTitle}>Résultats des votes</h3>

      <button
        style={styles.secondaryButton}
        onClick={() => setTeacherVoteView("proposals")}
      >
        Retour aux propositions
      </button>
    </div>

    {!consolidatedProposals.length ? (
      <p style={styles.bodyText}>
        Soumettez d’abord les propositions au vote pour voir les résultats.
      </p>
    ) : teacherVoteResults.every((item) => item.totalVotes === 0) ? (
      <p style={styles.bodyText}>Aucun vote enregistré pour le moment.</p>
    ) : (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          marginTop: 20,
          width: "100%",
        }}
      >
        {teacherVoteResults.slice(0, 3).map((row, index) => (
          <div
            key={row.proposalId}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 24,
              borderRadius: 24,
              background:
                index === 0
                  ? "linear-gradient(180deg, #f8fbff 0%, #e8f6ee 100%)"
                  : index === 1
                  ? "linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)"
                  : "linear-gradient(180deg, #fffaf4 0%, #fff1df 100%)",
              border:
                index === 0
                  ? "1px solid #b7e0c2"
                  : index === 1
                  ? "1px solid #c8d7f2"
                  : "1px solid #f2d0a8",
              borderLeft:
                index === 0
                  ? "10px solid #4CAF50"
                  : index === 1
                  ? "10px solid #2196F3"
                  : "10px solid #FF9800",
              boxShadow: "0 14px 32px rgba(15,23,42,0.12)",
              transform: "perspective(900px) rotateX(2deg)",
              transformOrigin: "bottom center",
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                marginBottom: 14,
                color: "#10213f",
              }}
            >
              {index === 0 ? "🥇 Résultat 1" : index === 1 ? "🥈 Résultat 2" : "🥉 Résultat 3"}
            </div>

            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                lineHeight: 1.45,
                color: "#0f172a",
                wordBreak: "break-word",
                overflowWrap: "anywhere",
              }}
            >
              {row.text}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}
</>
  )}

{teacherSessionTab === "synthese" && (
  <>
    <div style={styles.innerCardFull}>
            <div style={styles.row}>
        <button style={styles.primaryButton} onClick={toggleStudentSyntheseAccess}>
          {studentSyntheseUnlocked
            ? "🔓 Synthèse accessible aux étudiants"
            : "🔒 Synthèse non accessible aux étudiants"}
        </button>
      </div>
    </div>

    <h3 style={styles.innerTitle}>Synthèse finale de la session</h3>

    {teacherSyntheseData.length === 0 ? (
      <div style={styles.innerCardFull}>
        <p style={styles.bodyText}>Aucune donnée disponible pour la synthèse.</p>
      </div>
    ) : (
      renderSyntheseDashboard(teacherSyntheseData)
    )}
  </>
)}
            </>
          )}

          {teacherMenu === "mise_en_oeuvre" && (
            <>
              <h2 style={styles.panelTitle}>Mise en œuvre</h2>
              <div style={styles.innerCardFull}>
                <p style={styles.bodyText}>
                  Cette zone servira à afficher la mise en œuvre pédagogique, avec une présentation proche du SCORM mais dans une application web multi-utilisateur.
                </p>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  homePage: {
    minHeight: "100vh",
    background: "#e5e5e5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },
  homeCard: {
    width: 900,
    maxWidth: "100%",
    background: "#d3d3d3",
    borderRadius: 36,
    padding: 32,
    boxShadow: "0 14px 34px rgba(0,0,0,0.12)",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  homeTitle: {
    fontSize: 40,
    color: "#111827",
    fontWeight: 700,
    textAlign: "center",
  },
  homeSubtitle: {
    color: "#64748b",
    textAlign: "center",
    fontSize: 18,
  },
  homeButtons: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 8,
  },
  appShell: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    background: "#e5e5e5",
    fontFamily: "Arial, sans-serif",
  },
  sidebar: {
    background: "linear-gradient(180deg, #12203a 0%, #243754 100%)",
    color: "#fff",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  sidebarBrand: {
    fontSize: 28,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: 1,
    lineHeight: 1.1,
  },
  sidebarLogo: {
    width: "100%",
    maxWidth: 110,
    height: "auto",
    display: "block",
    marginTop: 0,
    marginRight: "auto",
    marginBottom: 0,
    marginLeft: "auto",
  },
  sidebarButton: {
    background: "#e6e6e6",
    color: "#123b64",
    border: "none",
    borderRadius: 999,
    padding: "12px 14px",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "left",
    lineHeight: 1.1,
  },
  sidebarButtonActive: {
    background: "#ef7d32",
    color: "#123b64",
    border: "none",
    borderRadius: 999,
    padding: "12px 14px",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "left",
    lineHeight: 1.1,
  },
  sidebarFooter: {
    marginTop: "auto",
  },
  sidebarSmallButton: {
    width: "100%",
    background: "rgba(255,255,255,0.15)",
    color: "#fff",
    border: "none",
    borderRadius: 999,
    padding: "10px 12px",
    fontSize: 14,
    cursor: "pointer",
  },
  mainArea: {
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
  },
topHeader: {
  background: "#000000",
  color: "#ffffff",
  borderRadius: 0,
  padding: "14px 20px 10px 20px",
  boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
  minHeight: 96,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
},
topHeaderTitle: {
  fontSize: 34,
  fontWeight: 900,
  letterSpacing: 1,
  textAlign: "center",
  color: "#f4f8ff",
  lineHeight: 1.05,
  marginTop: 0,
  marginRight: 0,
  marginBottom: 0,
  marginLeft: 0,
  whiteSpace: "normal",
},
  topHeaderSub: {
    marginTop: 6,
    fontSize: 10,
    textAlign: "center",
    color: "#bfe3ff",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  bigPanel: {
    background: "#cfcfcf",
    borderRadius: 40,
    padding: 24,
    boxShadow: "0 12px 26px rgba(0,0,0,0.12)",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    minHeight: "calc(100vh - 150px)",
  },
panelTitle: {
  marginTop: 0,
  marginRight: 0,
  marginBottom: 0,
  marginLeft: 0,
  textAlign: "center",
  fontSize: 34,
  color: "#76427a",
  fontWeight: 800,
},
  twoCols: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
  },
  innerCard: {
    background: "#f2f2f2",
    borderRadius: 24,
    padding: 22,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    border: "none",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)",
  },
  innerCardFull: {
    background: "#f2f2f2",
    borderRadius: 24,
    padding: 22,
    border: "none",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)",
  },
  innerTitle: {
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    fontSize: 22,
    color: "#123b64",
    fontWeight: 800,
  },
  label: {
    marginTop: 4,
    marginBottom: 4,
    fontWeight: 700,
    color: "#334155",
  },

  primaryButton: {
    padding: "12px 18px",
    borderRadius: 999,
    border: "none",
    background: "#17243d",
    color: "#fff",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 800,
  },
  secondaryButton: {
    padding: "12px 18px",
    borderRadius: 999,
    border: "none",
    background: "#ececec",
    color: "#123b64",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 800,
  },
  deleteButton: {
    padding: "12px 18px",
    borderRadius: 999,
    border: "none",
    background: "#b42318",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 800,
  },

  sessionList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 4,
  },
  sessionItem: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    border: "1px solid #e2e8f0",
  },
  sessionItemTitle: {
    fontWeight: 700,
    fontSize: 16,
    color: "#0f172a",
    marginBottom: 4,
  },
  sessionItemMeta: {
    fontSize: 14,
    color: "#475569",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 16,
  },
  subtleText: {
    color: "#64748b",
    fontSize: 16,
  },
  bodyText: {
    marginTop: 0,
    marginRight: 0,
    marginBottom: 12,
    marginLeft: 0,
    fontSize: 18,
    lineHeight: 1.6,
    color: "#1f2937",
  },
  infoMessage: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 14,
    color: "#334155",
    fontSize: 17,
    border: "1px solid #e2e8f0",
  },
  smallDangerButton: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "none",
    background: "#991b1b",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
  },
  checkboxGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  checkboxItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 10,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
  },
  statCard: {
    background: "#eef3f8",
    borderRadius: 20,
    padding: 20,
    textAlign: "left",
    border: "none",
  },
  statLabel: {
    color: "#123b64",
    fontSize: 18,
    marginBottom: 8,
    fontWeight: 700,
  },
  statValue: {
    fontSize: 42,
    fontWeight: 800,
    color: "#0f1f3d",
  },
  sectionCard: {
    background: "#f2f2f2",
    borderRadius: 22,
    padding: 22,
    marginBottom: 18,
    border: "none",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)",
  },
  infoCard: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    background: "#f7f7f8",
    borderRadius: 22,
    padding: "14px 22px",
    minHeight: 74,
    marginBottom: 18,
  },

  sectionIconWrap: {
    width: 42,
    height: 42,
    minWidth: 42,
    minHeight: 42,
    borderRadius: "50%",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 10px rgba(15,23,42,0.08)",
    flexShrink: 0,
  },
  groupTabsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    rowGap: 12,
    alignItems: "center",
  },

  groupTabButton: {
    minWidth: 74,
    padding: "10px 14px",
    borderRadius: 999,
    border: "none",
    background: "#e5e7eb",
    color: "#123b64",
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left" as const,
  },

  groupTabButtonActive: {
    minWidth: 74,
    padding: "10px 14px",
    borderRadius: 999,
    border: "none",
    background: "#f28a33",
    color: "#123b64",
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left" as const,
  },

  sectionIcon: {
    width: 20,
    height: 20,
    minWidth: 20,
    minHeight: 20,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    lineHeight: 1,
    flexShrink: 0,
  },

  infoCardText: {
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    fontSize: 16,
    lineHeight: 1.45,
    color: "#5b5876",
    fontWeight: 500,
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottom: "2px solid #d8dee8",
  },

  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: 16,
  },

  formActions: {
    display: "flex",
    gap: 12,
    marginTop: 14,
  },

  sectionTitle: {
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    fontSize: 20,
    color: "#123b64",
    fontWeight: 800,
  },
  questionBlock: {
    marginBottom: 14,
  },
  questionLabel: {
    display: "block",
    marginBottom: 6,
    fontWeight: 700,
    color: "#334155",
    fontSize: 15,
  },
  reportTable: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#ffffff",
  },

  reportTh: {
    background: "#edf3f8",
    color: "#123b64",
    fontWeight: 800,
    fontSize: 16,
    padding: "14px 16px",
    borderBottom: "1px solid #d7dee8",
  },

  reportTd: {
    padding: "14px 16px",
    borderBottom: "1px solid #e2e8f0",
    color: "#123b64",
    fontSize: 15,
  },
  adminActionButton: {
    border: "1px solid #d6deea",
    background: "#ffffff",
    color: "#123b64",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    minWidth: 110,
  },
  adminActionMenu: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    minWidth: 190,
    background: "#ffffff",
    border: "1px solid #d6deea",
    borderRadius: 16,
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.14)",
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    zIndex: 50,
  },
  adminActionMenuItem: {
    border: "none",
    background: "#f8fafc",
    color: "#123b64",
    borderRadius: 10,
    padding: "10px 12px",
    textAlign: "left",
    fontWeight: 700,
    cursor: "pointer",
  },
  adminActionMenuItemDanger: {
    border: "none",
    background: "#fff1f2",
    color: "#b42318",
    borderRadius: 10,
    padding: "10px 12px",
    textAlign: "left",
    fontWeight: 700,
    cursor: "pointer",
  },
  syntheseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },

  syntheseCard: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  syntheseCardHeader: {
    fontWeight: 800,
    color: "#123b64",
    fontSize: 22,
    lineHeight: 1.2,
  },

  syntheseCardMain: {
    fontSize: 34,
    fontWeight: 900,
    color: "#0f172a",
    textAlign: "center",
  },

  syntheseUnit: {
    fontSize: 14,
    fontWeight: 600,
    marginLeft: 4,
  },

  syntheseCardFooter: {
    fontSize: 13,
    color: "#64748b",
    display: "flex",
    justifyContent: "space-between",
  },

  syntheseTotalCard: {
    background: "#0f172a",
    color: "#fff",
    borderRadius: 16,
    padding: 20,
  },

  syntheseTotalLabel: {
    fontSize: 14,
    opacity: 0.8,
  },

  syntheseTotalValue: {
    fontSize: 30,
    fontWeight: 900,
  },

  syntheseBarHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 14,
    marginBottom: 6,
  },

  syntheseBarTrack: {
    height: 14,
    background: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
  },

  syntheseBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  landingPage: {
    minHeight: "100vh",
    background: "#e9edf3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box" as const,
  },

  landingShell: {
    width: "calc(100vw - 48px)",
    height: "calc(100vh - 48px)",
    display: "grid",
    gridTemplateColumns: "1.35fr 0.95fr",
    borderRadius: 24,
    overflow: "hidden",
    boxShadow: "0 24px 60px rgba(15,23,42,0.16)",
    background: "#2f323a",
  },

  landingImageWrap: {
    minHeight: 640,
    background: "#dfe6ee",
  },

  landingImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    display: "block",
  },

  landingPanel: {
    background: "#343741",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },

  landingPanelInner: {
    width: "100%",
    maxWidth: 520,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center" as const,
  },

  landingLogo: {
    height: 58,
    objectFit: "contain" as const,
    marginBottom: 34,
  },

  landingTitle: {
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    fontSize: 36,
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: 0.8,
    color: "#ffffff",
  },

  landingIntro: {
    marginTop: 14,
    marginBottom: 28,
    fontSize: 17,
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.82)",
  },

  landingButtons: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  landingProfileButton: {
    width: "100%",
    border: "none",
    borderRadius: 14,
    padding: "22px 20px",
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: 0.5,
    textAlign: "left" as const,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(0,0,0,0.14)",
  },

  landingTeacherButton: {
    background: "#e6a0af",
    color: "#1f2937",
  },

  landingStudentButton: {
    background: "#56c2c3",
    color: "#1f2937",
  },

  landingAdminButton: {
    background: "#6daee0",
    color: "#1f2937",
  },

  analysisActionRow: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 4,
  },

  authPage: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #eef2f7 0%, #dde5ef 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },

  authCard: {
    width: 680,
    maxWidth: "100%",
    background: "#ffffff",
    borderRadius: 24,
    padding: "40px 36px",
    boxShadow: "0 20px 40px rgba(15,23,42,0.12)",
    border: "1px solid #dbe4f0",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },

  authLogo: {
    height: 52,
    objectFit: "contain" as const,
    alignSelf: "center",
  },

  authTitle: {
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    textAlign: "center" as const,
    fontSize: 30,
    fontWeight: 700,
    color: "#1e293b",
  },

  column: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  input: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid #b8c7da",
    fontSize: 16,
    outline: "none",
  },

  row: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    marginTop: 4,
    flexWrap: "wrap",
  },

  portalPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  portalButton: {
    width: "100%",
    border: "none",
    borderRadius: 18,
    padding: "20px 22px",
    textAlign: "left" as const,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(15,23,42,0.10)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  },

  portalButtonTeacher: {
    background: "#cfe5ff",
    color: "#16324f",
  },

  portalButtonStudent: {
    background: "#cdeeed",
    color: "#153c3a",
  },

  portalButtonAdmin: {
    background: "#f6e3b3",
    color: "#4a3712",
  },

  portalButtonTitle: {
    fontSize: 22,
    fontWeight: 800,
    marginBottom: 0,
  },
proposalCard: {
  background: "#ffffff",
  borderRadius: 12,
  padding: "10px 14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
},

  proposalTextarea: {
    width: "100%",
    minHeight: 86,
    resize: "vertical" as const,
    boxSizing: "border-box" as const,
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid #c3d0df",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 1.5,
    outline: "none",
  },
};
