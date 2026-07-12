import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
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


type Lang = "fr" | "en";
type ProjectionStage = "qr" | "bilans" | "propositions" | "vote" | "synthese";

function getUrlParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function getInitialSessionCodeFromUrl() {
  return String(getUrlParams().get("session") ?? "").trim().toUpperCase();
}

function getInitialProjectionStage(): ProjectionStage {
  const value = String(getUrlParams().get("stage") ?? getUrlParams().get("screen") ?? "qr").trim();
  if (["qr", "bilans", "propositions", "vote", "synthese"].includes(value)) {
    return value as ProjectionStage;
  }
  return "qr";
}

function shouldOpenProjectionFromUrl() {
  return String(getUrlParams().get("view") ?? "") === "projection";
}

function shouldOpenStudentLoginFromUrl() {
  const params = getUrlParams();
  return params.get("student") === "1" || params.get("role") === "student";
}

function getInitialStudentTargetFromUrl(): "home" | "vote" {
  const value = String(getUrlParams().get("target") ?? getUrlParams().get("go") ?? "home").trim().toLowerCase();
  return value === "vote" ? "vote" : "home";
}

function getAppBaseUrl() {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}

function buildStudentJoinUrl(sessionCode: string, target: "home" | "vote" = "home") {
  const cleanCode = formatSessionCode(sessionCode);
  const params = new URLSearchParams();
  params.set("student", "1");
  params.set("session", cleanCode);
  if (target === "vote") {
    params.set("target", "vote");
  }
  return `${getAppBaseUrl()}?${params.toString()}`;
}

function buildProjectionUrl(sessionCode: string, stage: ProjectionStage = "qr") {
  const cleanCode = formatSessionCode(sessionCode);
  const params = new URLSearchParams();
  params.set("view", "projection");
  params.set("session", cleanCode);
  params.set("stage", stage);
  return `${getAppBaseUrl()}?${params.toString()}`;
}

const LANGUAGE_STORAGE_KEY = "bilan-carbone:language";
const TEACHER_SIDEBAR_CSS = `
.teacher-sidebar-organized details.teacher-sidebar-section > summary::-webkit-details-marker { display: none !important; }
.teacher-sidebar-organized details.teacher-sidebar-section > summary::marker { content: "" !important; font-size: 0 !important; }
.teacher-sidebar-organized details.teacher-sidebar-section > summary {
  list-style: none !important;
  background: transparent !important;
  min-height: 44px !important;
  height: 44px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  padding-left: 10px !important;
  padding-right: 10px !important;
  text-align: left !important;
  font-family: Arial, sans-serif !important;
  font-size: 12px !important;
  font-weight: 950 !important;
  letter-spacing: 0.45px !important;
  text-transform: uppercase !important;
}
.teacher-sidebar-organized .teacher-sidebar-chevron {
  transform: rotate(0deg);
  transform-origin: center;
  transition: transform 0.16s ease;
  font-size: 17px !important;
  font-family: Arial, sans-serif !important;
  font-weight: 700 !important;
  line-height: 1 !important;
}
.teacher-sidebar-organized details.teacher-sidebar-section[open] > summary .teacher-sidebar-chevron {
  transform: rotate(90deg);
}
`;

const PROJECTION_CONTROL_STORAGE_KEY = "bilan-carbone:projection-control";

const I18N = {
  fr: {
    appTitle: "Bilan carbone de la séance de cours",
    appTitleUpper: "BILAN CARBONE DE LA SÉANCE DE COURS",
    chooseProfile: "Choisissez votre profil pour accéder à l'application.",
    student: "Étudiant",
    teacher: "Professeur",
    admin: "Administrateur",
    miseEnOeuvre: "Mise en œuvre",
    dataCollection: "Collecte des données",
    analyses: "Analyses",
    vote: "Vote",
    synthese: "Synthèse",
    sessions: "Sessions",
    openSession: "Session ouverte",
    administration: "Administration",
    logout: "Déconnexion",
    code: "Code",
    activeSessionCode: "Code session actif",
    developedBy: "Activité pédagogique développée par G. Lesur-Irichabeau & J. Hanoteau",
    lockAnalysis: "L'accès à l'analyse n'a pas encore été autorisé par le professeur.",
    lockVote: "L'accès au vote n'a pas encore été autorisé par le professeur.",
    lockSynthese: "L'accès à la synthèse n'a pas encore été autorisé par le professeur.",
    studentImplementationTitle: "Mise en œuvre",
    implementationInfo1: "Chaque étudiant d'une même classe répond individuellement aux questionnaires.",
    implementationInfo2: "Chaque groupe se voit attribuer une thématique. Vous accédez ensuite aux données à reporter.",
    implementationInfo3: "Une fois le bilan établi, vous proposerez des pistes d'amélioration discutées en classe.",
    implementationInfo4: "Ces pistes d'amélioration seront ensuite résumées et soumises au vote.",
    implementationInfo5: "Une synthèse permettra de comparer les résultats entre les thématiques.",
    startDataCollection: "Commencer la collecte",
    teacherLogin: "Connexion professeur",
    adminLogin: "Connexion administrateur",
    studentLogin: "Connexion étudiant",
    emailAddress: "Adresse e-mail",
    password: "Mot de passe",
    sessionCode: "Code session",
    signIn: "Se connecter",
    enter: "Entrer",
    back: "Retour",
    teachers: "Professeurs",
    teacherAccess: "Accès professeur",
    qrStudentAccess: "Accès étudiant par QR code",
    scanQrInstruction: "Scannez ce QR code pour accéder directement à la session. Le code session sera prérempli ; il restera seulement à saisir l’adresse e-mail.",
    copyQr: "Copier le QR code",
    copyLink: "Copier le lien étudiant",
    downloadQr: "Télécharger le QR code",
    openProjection: "Ouvrir l’écran de projection",
    projectionScreen: "Écran de projection",
    projectionQr: "QR code",
    projectionBilans: "Bilans",
    projectionProposals: "Propositions",
    projectionVote: "Résultat des votes",
    projectionSynthesis: "Synthèse",
    votePreferenceInstruction: "Classez jusqu’à 3 propositions selon votre préférence. Le choix 1 correspond à votre proposition préférée.",
    voteSameOrderNotice: "Les propositions sont affichées dans le même ordre que sur l’écran projeté.",
    voteChoice1Weighted: "Choix 1 — proposition préférée (3 points)",
    voteChoice2Weighted: "Choix 2 — deuxième préférence (2 points)",
    voteChoice3Weighted: "Choix 3 — troisième préférence (1 point)",
    weightedScore: "Score pondéré",
    privacyTitle: "Protection des données personnelles",
    privacyButton: "Données personnelles / RGPD",
    close: "Fermer",
    privacyStudentNotice: "Les informations saisies (adresse e-mail, code session et réponses aux questionnaires) sont utilisées uniquement pour l’activité pédagogique, le calcul de résultats collectifs et l’analyse en classe. Les résultats affichés aux étudiants sont agrégés.",
    privacyTeacherNotice: "Accès réservé à la gestion pédagogique de l’activité. Les données étudiantes doivent être utilisées uniquement pour créer les sessions, suivre la collecte et analyser les résultats collectifs.",
    privacyRights: "Les données ne sont pas utilisées à des fins commerciales. Pour toute demande d’accès, de rectification ou de suppression, contactez l’enseignant responsable ou le DPO de l’établissement.",
  },
  en: {
    appTitle: "Carbon footprint of the class session",
    appTitleUpper: "CARBON FOOTPRINT OF THE CLASS SESSION",
    chooseProfile: "Choose your profile to access the application.",
    student: "Student",
    teacher: "Teacher",
    admin: "Administrator",
    miseEnOeuvre: "Setup",
    dataCollection: "Data collection",
    analyses: "Analysis",
    vote: "Vote",
    synthese: "Summary",
    sessions: "Sessions",
    openSession: "Open session",
    administration: "Administration",
    logout: "Log out",
    code: "Code",
    activeSessionCode: "Active session code",
    developedBy: "Educational activity developed by G. Lesur-Irichabeau & J. Hanoteau",
    lockAnalysis: "Access to the analysis has not yet been authorized by the teacher.",
    lockVote: "Access to the vote has not yet been authorized by the teacher.",
    lockSynthese: "Access to the summary has not yet been authorized by the teacher.",
    studentImplementationTitle: "Implementation",
    implementationInfo1: "Each student in the class answers the questionnaires individually.",
    implementationInfo2: "Each group is assigned a theme. You then access the data to report.",
    implementationInfo3: "Once the carbon footprint is established, you will suggest improvement ideas discussed in class.",
    implementationInfo4: "These ideas will then be summarized and submitted to a vote.",
    implementationInfo5: "A summary will allow you to compare results across themes.",
    startDataCollection: "Start data collection",
    teacherLogin: "Teacher login",
    adminLogin: "Administrator login",
    studentLogin: "Student login",
    emailAddress: "Email address",
    password: "Password",
    sessionCode: "Session code",
    signIn: "Sign in",
    enter: "Enter",
    back: "Back",
    teachers: "Teachers",
    teacherAccess: "Teacher access",
    qrStudentAccess: "Student access by QR code",
    scanQrInstruction: "Scan this QR code to access the session directly. The session code will be pre-filled; students only need to enter their email address.",
    copyQr: "Copy QR code",
    copyLink: "Copy student link",
    downloadQr: "Download QR code",
    openProjection: "Open projection screen",
    projectionScreen: "Projection screen",
    projectionQr: "QR code",
    projectionBilans: "Reports",
    projectionProposals: "Proposals",
    projectionVote: "Vote results",
    projectionSynthesis: "Summary",
    votePreferenceInstruction: "Rank up to 3 proposals according to your preference. Choice 1 must be your preferred proposal.",
    voteSameOrderNotice: "The proposals are displayed in the same order as on the projection screen.",
    voteChoice1Weighted: "Choice 1 — preferred proposal (3 points)",
    voteChoice2Weighted: "Choice 2 — second preference (2 points)",
    voteChoice3Weighted: "Choice 3 — third preference (1 point)",
    weightedScore: "Weighted score",
    privacyTitle: "Personal data protection",
    privacyButton: "Personal data / GDPR",
    close: "Close",
    privacyStudentNotice: "The information entered (email address, session code and questionnaire answers) is used only for the educational activity, the calculation of collective results and in-class analysis. Results shown to students are aggregated.",
    privacyTeacherNotice: "Access is restricted to the educational management of the activity. Student data must be used only to create sessions, monitor data collection and analyze collective results.",
    privacyRights: "The data is not used for commercial purposes. For any request for access, rectification or deletion, contact the teacher in charge or the institution’s DPO.",
  },
} as const;

type TranslationKey = keyof typeof I18N.fr;

function t(lang: Lang, key: TranslationKey) {
  return I18N[lang]?.[key] ?? I18N.fr[key];
}


const DISPLAY_TRANSLATIONS_EN: Record<string, string> = {
  "Bilan carbone de la séance de cours": "Carbon footprint of the class session",
  "BILAN CARBONE DE LA SÉANCE DE COURS": "CARBON FOOTPRINT OF THE CLASS SESSION",
  "Activité pédagogique développée par G. Lesur-Irichabeau & J. Hanoteau": "Educational activity developed by G. Lesur-Irichabeau & J. Hanoteau",
  "Choisissez votre profil pour accéder à l'application.": "Choose your profile to access the application.",
  "Étudiant": "Student",
  "Professeur": "Teacher",
  "Administrateur": "Administrator",
  "Administration": "Administration",
  "Connexion étudiant": "Student login",
  "Connexion professeur": "Teacher login",
  "Connexion administrateur": "Administrator login",
  "Adresse e-mail": "Email address",
  "Mot de passe": "Password",
  "Code session": "Session code",
  "Se connecter": "Sign in",
  "Entrer": "Enter",
  "Retour": "Back",
  "Déconnexion": "Log out",
  "Mise en œuvre": "Implementation",
  "Collecte des données": "Data collection",
  "Analyses": "Analysis",
  "Analyse": "Analysis",
  "Vote": "Vote",
  "Synthèse": "Summary",
  "Bilans": "Reports",
  "Session ouverte": "Open session",
  "Sessions": "Sessions",
  "Professeurs": "Teachers",
  "Accès professeur": "Teacher access",
  "Code": "Code",
  "Code session actif": "Active session code",
  "Code session actif :": "Active session code:",
  "Code session :": "Session code:",
  "Code généré :": "Generated code:",
  "Code :": "Code:",
  "ID :": "ID:",
  "Mail :": "Email:",
  "Email professeur": "Teacher email",
  "Nom professeur": "Teacher name",
  "Chaque étudiant d'une même classe répond individuellement aux questionnaires.": "Each student in the class answers the questionnaires individually.",
  "Chaque groupe se voit attribuer une thématique. Vous accédez ensuite aux données à reporter.": "Each group is assigned a theme. You then access the data to report.",
  "Une fois le bilan établi, vous proposerez des pistes d'amélioration discutées en classe.": "Once the carbon footprint has been calculated, you will suggest improvement ideas to discuss in class.",
  "Ces pistes d'amélioration seront ensuite résumées et soumises au vote.": "These improvement ideas will then be summarized and submitted to a vote.",
  "Une synthèse permettra de comparer les résultats entre les thématiques.": "A summary will allow you to compare results across themes.",
  "Commencer la collecte": "Start data collection",
  "Enregistrement...": "Saving...",
  "Enregistrement en cours...": "Saving in progress...",
  "Actualisation...": "Updating...",
  "Actualisation automatique toutes les 3 secondes": "Automatic refresh every 3 seconds",
  "Actualiser": "Refresh",
  "L'accès à l'analyse n'a pas encore été autorisé par le professeur.": "Access to the analysis has not yet been authorized by the teacher.",
  "L'accès au vote n'a pas encore été autorisé par le professeur.": "Access to the vote has not yet been authorized by the teacher.",
  "L'accès à la synthèse n'a pas encore été autorisé par le professeur.": "Access to the summary has not yet been authorized by the teacher.",
  "Questionnaire suivant": "Next questionnaire",
  "Réinitialiser ce questionnaire": "Reset this questionnaire",
  "Retour transport": "Back to transport",
  "Retour déjeuner": "Back to lunch",
  "Retour équipement": "Back to equipment",
  "Transport validé ✓": "Transport validated ✓",
  "Déjeuner validé ✓": "Lunch validated ✓",
  "Équipement validé ✓": "Equipment validated ✓",
  "Autres consommations validé ✓": "Other consumption validated ✓",
  "Valider transport": "Validate transport",
  "Valider déjeuner": "Validate lunch",
  "Valider équipement": "Validate equipment",
  "Valider autres consommations": "Validate other consumption",
  "Transport": "Transport",
  "Déjeuner": "Lunch",
  "Équipement": "Equipment",
  "Autres consommations": "Other consumption",
  "Salle de cours": "Classroom",
  "salle de cours": "classroom",
  "autres consommations": "other consumption",
  "déjeuner": "lunch",
  "équipement": "equipment",
  "transport": "transport",
  "Trajet": "Trip",
  "Trajet ": "Trip ",
  "Moyen de transport": "Mode of transport",
  "Sélectionner": "Select",
  "Distance parcourue (km)": "Distance travelled (km)",
  "Distance cumulée (km)": "Cumulative distance (km)",
  "Distance totale (km)": "Total distance (km)",
  "Type de voiture": "Car type",
  "Nombre de personnes dans la voiture": "Number of people in the car",
  "Nombre de personnes": "Number of people",
  "Supprimer ce trajet": "Delete this trip",
  "Ajouter un trajet": "Add a trip",
  "Pour la voiture, la comptabilisation du nombre de personnes se fait au prorata : 0,5 si un passager en plus du conducteur, 0,33 si deux passagers, etc.": "For cars, the number of people is counted proportionally: 0.5 if there is one passenger in addition to the driver, 0.33 if there are two passengers, and so on.",
  "Pour la voiture, si plusieurs passagers sont présents, la comptabilisation se fait au prorata : 0,5 personne si un passager en plus du conducteur, 0,33 si deux passagers, etc.": "For cars, when several passengers are present, the count is proportional: 0.5 person with one passenger in addition to the driver, 0.33 with two passengers, and so on.",
  "Plat principal": "Main dish",
  "Sandwich": "Sandwich",
  "Quiche / pizza": "Quiche / pizza",
  "Quiche/Pizza": "Quiche/Pizza",
  "Plat de pâtes": "Pasta dish",
  "Salade composée": "Mixed salad",
  "Protéines": "Proteins",
  "Viande rouge": "Red meat",
  "Viande blanche": "White meat",
  "Poisson": "Fish",
  "Œufs": "Eggs",
  "Oeufs": "Eggs",
  "Accompagnements": "Side dishes",
  "Accompagnement": "Side dish",
  "Desserts et fruits": "Desserts and fruit",
  "Fruit local": "Local fruit",
  "Fruit importé": "Imported fruit",
  "Fruits locaux": "Local fruit",
  "Fruits importés": "Imported fruit",
  "Laitage": "Dairy product",
  "Dessert": "Dessert",
  "Boissons": "Drinks",
  "Grignotage": "Snacks",
  "Kebab": "Kebab",
  "Hamburger": "Hamburger",
  "Sandwich Jambon-beurre": "Ham and butter sandwich",
  "Sandwich Fromage": "Cheese sandwich",
  "Sandwich poisson crudités": "Fish and raw vegetables sandwich",
  "Sandwich Poisson crudités": "Fish and raw vegetables sandwich",
  "Sandwich Thon crudités": "Tuna and raw vegetables sandwich",
  "Sandwich Crudités": "Raw vegetables sandwich",
  "Panini": "Panini",
  "Quiche": "Quiche",
  "Pizza": "Pizza",
  "Spaghetti bolognaise": "Spaghetti Bolognese",
  "Lasagnes": "Lasagna",
  "Tagliatelles carbonara": "Tagliatelle carbonara",
  "Salade de pommes de terre": "Potato salad",
  "Salade niçoise": "Niçoise salad",
  "Salade Thon crudités": "Tuna and raw vegetables salad",
  "Salade de riz": "Rice salad",
  "Salade de pâtes": "Pasta salad",
  "Bœuf": "Beef",
  "Boeuf": "Beef",
  "Agneau": "Lamb",
  "Porc": "Pork",
  "Volaille": "Poultry",
  "Poulet": "Chicken",
  "Œufs (omelette)": "Eggs (omelet)",
  "Oeufs (omelette)": "Eggs (omelet)",
  "Frites / chips": "Fries / crisps",
  "Légumes": "Vegetables",
  "Salade": "Salad",
  "Pâtes": "Pasta",
  "Riz": "Rice",
  "Eau du robinet": "Tap water",
  "Eau bouteille": "Bottled water",
  "Soda": "Soda",
  "Café": "Coffee",
  "café": "coffee",
  "Thé": "Tea",
  "thé": "tea",
  "Chocolat au lait (boisson)": "Milk chocolate drink",
  "Chocolat au lait": "Milk chocolate",
  "Chocolat chaud": "Hot chocolate",
  "Glace": "Ice cream",
  "Pâtisserie": "Pastry",
  "Pomme": "Apple",
  "Raisin": "Grapes",
  "Poire": "Pear",
  "Banane": "Banana",
  "Ananas": "Pineapple",
  "Mangue": "Mango",
  "Barre chocolatée": "Chocolate bar",
  "Barres chocolatées": "Chocolate bars",
  "Viennoiseries": "Pastries",
  "Biscuits": "Biscuits",
  "Bonbons": "Sweets",
  "Chips": "Crisps",
  "Équipements utilisés": "Equipment used",
  "Matériel": "Equipment",
  "Activité": "Activity",
  "Ordinateur portable": "Laptop",
  "Ordinateur de bureau": "Desktop computer",
  "Ordinateur portable et ordinateur de bureau et/ou tablette": "Laptop and desktop computer and/or tablet",
  "Tablette": "Tablet",
  "Smartphone": "Smartphone",
  "Papeterie": "Stationery",
  "Nombre d'emails envoyés sans pièce jointe": "Number of emails sent without attachment",
  "Nombre d'emails envoyés avec pièce jointe": "Number of emails sent with attachment",
  "Email sans PJ": "Email without attachment",
  "Email avec PJ": "Email with attachment",
  "Réseaux sociaux": "Social media",
  "Utilisation de l’IA": "Use of AI",
  "Temps pour préparer le cours": "Time to prepare the class",
  "Temps pendant le cours": "Time during class",
  "Marche à pied": "Walking",
  "Bus": "Bus",
  "Métro, tramway, train": "Metro, tramway, train",
  "Trottinette électrique": "Electric scooter",
  "Vélo": "Bike",
  "Vélo électrique": "Electric bike",
  "2 roues thermique": "Petrol two-wheeler",
  "Voiture électrique": "Electric car",
  "Voiture hybride": "Hybrid car",
  "Voiture diesel": "Diesel car",
  "Voiture essence": "Petrol car",
  "Données à reporter": "Data to report",
  "Report des données": "Data report",
  "Visualiser le bilan carbone": "View carbon footprint",
  "Bilan carbone": "Carbon footprint",
  "Bilan carbone ": "Carbon footprint ",
  "Analyse - Groupe": "Analysis - Group",
  "Consultation en lecture seule du report saisi par les étudiants.": "Read-only view of the report entered by students.",
  "Consultez les données utiles à votre thématique puis renseignez le tableau de report correspondant.": "Review the data relevant to your theme, then fill in the corresponding reporting table.",
  "Thématique attribuée :": "Assigned theme:",
  "Accès limité au groupe": "Access limited to group",
  "Groupe assigné :": "Assigned group:",
  "Étudiant :": "Student:",
  "Élément": "Item",
  "Sous-catégorie": "Subcategory",
  "Quantité": "Quantity",
  "Facteur": "Factor",
  "Total": "Total",
  "Total émissions": "Total emissions",
  "Total émissions :": "Total emissions:",
  "Total du tableau :": "Table total:",
  "Nombre de répondants": "Number of respondents",
  "Moyenne par thématique": "Average by theme",
  "Aucune donnée carbone à visualiser pour le moment.": "No carbon data to visualize yet.",
  "Aucune donnée disponible.": "No data available.",
  "Aucune donnée disponible pour la synthèse.": "No data available for the summary.",
  "Le tableau de calcul de cette thématique reste à implémenter.": "The calculation table for this theme still needs to be implemented.",
  "Aucune donnée à reporter pour le moment. Les réponses transport validées apparaîtront ici automatiquement.": "No data to report yet. Validated transport responses will appear here automatically.",
  "Aucune donnée déjeuner à reporter pour le moment. Les réponses déjeuner validées apparaîtront ici automatiquement.": "No lunch data to report yet. Validated lunch responses will appear here automatically.",
  "Aucune donnée équipement à reporter pour le moment. Les réponses équipement validées apparaîtront ici automatiquement.": "No equipment data to report yet. Validated equipment responses will appear here automatically.",
  "Aucune donnée autres consommations à reporter pour le moment. Les réponses validées apparaîtront ici automatiquement.": "No other-consumption data to report yet. Validated responses will appear here automatically.",
  "Propositions": "Proposals",
  "Modifier les propositions": "Edit proposals",
  "Valider les propositions": "Validate proposals",
  "Propositions du groupe": "Group proposals",
  "Proposition 1": "Proposal 1",
  "Proposition 2": "Proposal 2",
  "Proposition 3": "Proposal 3",
  "Aucun choix": "No choice",
  "Proposition introuvable": "Proposal not found",
  "Propositions à soumettre au vote": "Proposals to submit to the vote",
  "Propositions actuellement soumises au vote": "Proposals currently submitted to the vote",
  "Soumettre ces propositions au vote": "Submit these proposals to the vote",
  "Soumission en cours...": "Submitting...",
  "Résultats des votes": "Vote results",
  "Retour aux propositions": "Back to proposals",
  "Soumettez d’abord les propositions au vote pour voir les résultats.": "Submit the proposals to the vote first to see the results.",
  "Aucune proposition n’a encore été soumise au vote.": "No proposal has been submitted to the vote yet.",
  "Aucune proposition consolidée n'est encore disponible.": "No consolidated proposal is available yet.",
  "Aucun vote enregistré pour le moment.": "No vote recorded yet.",
  "Vote étudiant": "Student vote",
  "Mes choix": "My choices",
  "Choix 1": "Choice 1",
  "Choix 2": "Choice 2",
  "Choix 3": "Choice 3",
  "Choix 1 :": "Choice 1:",
  "Choix 2 :": "Choice 2:",
  "Choix 3 :": "Choice 3:",
  "Effacer choix 1": "Clear choice 1",
  "Effacer choix 2": "Clear choice 2",
  "Effacer choix 3": "Clear choice 3",
  "Valider mon vote": "Submit my vote",
  "Mettre à jour mon vote": "Update my vote",
  "Vote soumis": "Vote submitted",
  "Modifications non soumises": "Changes not submitted",
  "Le vote n'est pas encore accessible. Attendez l'autorisation du professeur.": "The vote is not yet available. Wait for the teacher's authorization.",
  "Sélectionnez jusqu’à 3 propositions par ordre de priorité.": "Select up to 3 proposals in order of priority.",
  "Télécharger le fichier .txt à soumettre à l’IA": "Download the .txt file to submit to the AI",
  "Soumission en cours.": "Submitting.",
  "1. Téléchargez le fichier .txt à soumettre à l’IA. 2. Faites générer par l’IA une liste numérotée, avec une seule proposition par ligne. 3. Copiez-collez la réponse de l’IA dans la zone ci-dessous. 4. Soumettez directement les propositions au vote.": "1. Download the .txt file to submit to the AI. 2. Ask the AI to generate a numbered list, with one proposal per line. 3. Copy and paste the AI response into the area below. 4. Submit the proposals directly to the vote.",
  "Collez ici la réponse de l’IA, par exemple : 1. Réduire l’usage de la voiture individuelle 2. Installer plus d’options végétariennes 3. Encourager le covoiturage entre étudiants": "Paste the AI response here, for example: 1. Reduce the use of private cars 2. Install more vegetarian options 3. Encourage carpooling between students",
  "Compteur de réponses": "Response counter",
  "Utilisateurs": "Users",
  "Utilisateurs autorisés": "Authorized users",
  "Gestion des sessions": "Session management",
  "Paramètres de la session": "Session settings",
  "PARAMÉTRER LA SESSION": "SET UP THE SESSION",
  "Session active": "Active session",
  "Session sélectionnée": "Selected session",
  "Aucune session sélectionnée": "No session selected",
  "Aucune session sélectionnée.": "No session selected.",
  "Toutes les sessions": "All sessions",
  "Filtrer les sessions": "Filter sessions",
  "Filtrer par nom ou email professeur": "Filter by teacher name or email",
  "Mes sessions": "My sessions",
  "Aucune session créée pour le moment.": "No session created yet.",
  "Aucune session trouvée.": "No session found.",
  "Ouvrir": "Open",
  "Supprimer": "Delete",
  "Créer une session": "Create a session",
  "Créer la session": "Create session",
  "Nom de la session": "Session name",
  "Campus": "Campus",
  "Programme": "Program",
  "Niveau": "Level",
  "Autre programme": "Other program",
  "Sélectionner un campus": "Select a campus",
  "Sélectionner un programme": "Select a program",
  "Ex. 1, 2, 3...": "E.g. 1, 2, 3...",
  "Ex. SECTION 1 ou 210426": "E.g. SECTION 1 or 210426",
  "Méthode d'assignation": "Assignment method",
  "Assignation prédéfinie": "Predefined assignment",
  "Assignation aléatoire": "Random assignment",
  "Étudiants à répartir aléatoirement": "Students to assign randomly",
  "Liste avec assignation prédéfinie": "List with predefined assignment",
  "Aperçu de l'assignation validée :": "Validated assignment preview:",
  "Valider l'assignation aléatoire": "Validate random assignment",
  "Exporter l'assignation": "Export assignment",
  "Enregistrer": "Save",
  "Modifier les paramètres": "Edit settings",
  "Aucune assignation trouvée pour cette session.": "No assignment found for this session.",
  "Aucune assignation valide détectée.": "No valid assignment detected.",
  "Validez l'assignation aléatoire pour afficher le tableau avant export.": "Validate the random assignment to display the table before export.",
  "assignation(s) valide(s) détectée(s).": "valid assignment(s) detected.",
  "étudiant(s) valide(s) détecté(s) avant répartition.": "valid student(s) detected before assignment.",
  "étudiant(s) réparti(s).": "student(s) assigned.",
  "Ajouter un étudiant": "Add a student",
  "Ajouter l'étudiant": "Add student",
  "Rechercher par nom, prénom, groupe ou email...": "Search by last name, first name, group or email...",
  "email;prenom;nom;groupe etudiant1@exemple.com;Marie;Durand;1": "email;first_name;last_name;group student1@example.com;Marie;Durand;1",
  "email;prenom;nom etudiant1@exemple.com;Marie;Durand etudiant2@exemple.com;Lucas;Martin": "email;first_name;last_name student1@example.com;Marie;Durand student2@example.com;Lucas;Martin",
  "Gestion des professeurs et des sessions · connecté en": "Teacher and session management · connected as",
  "Créer un professeur": "Create a teacher",
  "Créer directement un compte professeur avec nom, email et mot de passe.": "Create a teacher account directly with name, email and password.",
  "Créez directement un compte professeur avec nom, email et mot de passe.": "Create a teacher account directly with name, email and password.",
  "Ajouter un professeur": "Add a teacher",
  "Création en cours...": "Creating...",
  "Modifier un professeur": "Edit a teacher",
  "Nom du professeur": "Teacher name",
  "Email du professeur": "Teacher email",
  "Mot de passe temporaire": "Temporary password",
  "Recherche": "Search",
  "Rechercher un professeur par nom ou par email.": "Search for a teacher by name or email.",
  "Rechercher par nom ou email": "Search by name or email",
  "Aucun professeur trouvé.": "No teacher found.",
  "Actions": "Actions",
  "Actions ▾": "Actions ▾",
  "Statut": "Status",
  "Rôle": "Role",
  "Modifier": "Edit",
  "Annuler": "Cancel",
  "Enregistrer les modifications": "Save changes",
  "Désactiver": "Deactivate",
  "Réactiver": "Reactivate",
  "Passer admin": "Make admin",
  "Repasser prof": "Switch back to teacher",
  "Nom non renseigné": "Name not provided",
  "L'adresse mail est obligatoire.": "Email address is required.",
  "Le code session est obligatoire.": "Session code is required.",
  "Mail et code session requis.": "Email and session code are required.",
  "Code session invalide, email non autorisé ou email non assigné à un groupe pour cette session.": "Invalid session code, unauthorized email, or email not assigned to a group for this session.",
  "Session introuvable ou fermée pour ce code.": "Session not found or closed for this code.",
  "Email non assigné à un groupe pour cette session.": "Email not assigned to a group for this session.",
  "Accès limité au groupe ": "Access limited to group ",
  "Redirection automatique vers votre groupe.": "Automatic redirection to your group.",
  "Redirection automatique vers votre groupe": "Automatic redirection to your group",
  ". Redirection automatique vers votre groupe.": ". Automatic redirection to your group.",
  "Ouvre d'abord une session.": "Open a session first.",
  "Session ou email étudiant manquant.": "Session or student email missing.",
  "Sélectionnez au moins une proposition avant de valider.": "Select at least one proposal before validating.",
  "Vous ne pouvez pas voter deux fois pour la même proposition.": "You cannot vote twice for the same proposal.",
  "Cette proposition est déjà sélectionnée pour un autre rang.": "This proposal is already selected for another rank.",
  "Vote enregistré.": "Vote saved.",
  "Ajoutez au moins une proposition avant de valider.": "Add at least one proposal before validating.",
  "Évitez les propositions en doublon.": "Avoid duplicate proposals.",
  "Propositions soumises au vote avec succès.": "Proposals successfully submitted to the vote.",
  "Aucune proposition importée à soumettre.": "No imported proposal to submit.",
  "Aucune proposition valide détectée dans le texte collé.": "No valid proposal detected in the pasted text.",
  "Aucune proposition validée à exporter.": "No validated proposal to export.",
  "Des propositions consolidées existent déjà. Les remplacer ?": "Consolidated proposals already exist. Replace them?",
  "Des propositions ou des votes existent déjà. Soumettre ces nouvelles propositions peut écraser l'existant et rendre les votes incohérents. Continuer ?": "Some proposals or votes already exist. Submitting these new proposals may overwrite existing data and make votes inconsistent. Continue?",
  "Voulez-vous réactiver la modification des propositions du groupe": "Do you want to reactivate proposal editing for group",
  "Voulez-vous supprimer la session": "Do you want to delete session",
  "Voulez-vous vraiment supprimer ce trajet ?": "Do you really want to delete this trip?",
  "⚠️ Voulez-vous vraiment réinitialiser ce questionnaire ?": "⚠️ Do you really want to reset this questionnaire?",
  "Supprimer définitivement ce professeur ?": "Permanently delete this teacher?",
  "Vous devez d'abord valider le questionnaire précédent.": "You must validate the previous questionnaire first.",
  "Vous devez être connecté en admin.": "You must be logged in as admin.",
  "Ce compte n'a pas les droits administrateur.": "This account does not have administrator rights.",
  "Accès refusé : vous n'avez pas les droits administrateur.": "Access denied: you do not have administrator rights.",
  "Interface administrateur ouverte.": "Administrator interface opened.",
  "Connexion refusée.": "Login refused.",
  "Connexion administrateur réussie.": "Administrator login successful.",
  "Connexion professeur réussie.": "Teacher login successful.",
  "Connexion professeur (admin) réussie.": "Teacher login (admin) successful.",
  "Professeur non connecté.": "Teacher not connected.",
  "Tous les champs sont obligatoires pour créer une session.": "All fields are required to create a session.",
  "Session créée :": "Session created:",
  "Session ouverte :": "Open session:",
  "Session supprimée :": "Session deleted:",
  "Paramètres enregistrés pour": "Settings saved for",
  "Paramètres enregistrés, mais erreur assignations :": "Settings saved, but assignment error:",
  "Paramètres enregistrés, mais erreur suppression assignations :": "Settings saved, but assignment deletion error:",
  "Aucune assignation à exporter.": "No assignment to export.",
  "Validez d'abord l'assignation aléatoire avant d'enregistrer.": "Validate the random assignment before saving.",
  "Aucune assignation valide détectée. Vérifiez le format : email;prenom;nom;groupe.": "No valid assignment detected. Check the format: email;first_name;last_name;group.",
  "Aucun étudiant valide à répartir. Format attendu : email;prenom;nom.": "No valid student to assign. Expected format: email;first_name;last_name.",
  "Assignation aléatoire validée. Vous pouvez maintenant l'exporter ou l'enregistrer.": "Random assignment validated. You can now export or save it.",
  "Ajout impossible : l'email de l'étudiant est obligatoire.": "Cannot add: student email is required.",
  "Ajout impossible : prénom et nom sont obligatoires.": "Cannot add: first name and last name are required.",
  "Cet étudiant est déjà présent dans l'assignation.": "This student is already present in the assignment.",
  "Ajout impossible : le groupe doit être compris entre 1 et 10.": "Cannot add: group must be between 1 and 10.",
  "Étudiant ajouté au groupe": "Student added to group",
  "Pensez à enregistrer les paramètres.": "Remember to save the settings.",
  "Nom, email et mot de passe obligatoires.": "Name, email and password are required.",
  "Nom et email obligatoires pour la modification.": "Name and email are required to edit.",
  "Professeur créé avec succès :": "Teacher successfully created:",
  "Professeur modifié.": "Teacher updated.",
  "Professeur supprimé.": "Teacher deleted.",
  "Erreur réseau": "Network error",
  "Erreur": "Error",
  "Erreur chargement": "Loading error",
  "Erreur sauvegarde": "Save error",
  "Erreur création professeur :": "Teacher creation error:",
  "Erreur modification professeur :": "Teacher update error:",
  "Erreur suppression professeur :": "Teacher deletion error:",
  "Erreur désactivation professeur :": "Teacher deactivation error:",
  "Erreur réactivation professeur :": "Teacher reactivation error:",
  "Erreur promotion admin :": "Admin promotion error:",
  "Erreur retour au rôle professeur :": "Error switching back to teacher role:",
  "Erreur enregistrement votes :": "Vote saving error:",
  "Erreur soumission propositions :": "Proposal submission error:",
  "Erreur sauvegarde propositions :": "Proposal saving error:",
  "Erreur chargement propositions :": "Proposal loading error:",
  "Erreur chargement résultats vote :": "Vote results loading error:",
  "Erreur chargement votes étudiant :": "Student votes loading error:",
  "Erreur mise à jour accès analyse :": "Analysis access update error:",
  "Erreur mise à jour accès synthèse :": "Summary access update error:",
  "Erreur mise à jour accès vote :": "Vote access update error:",
  "Erreur suivi des réponses :": "Response tracking error:",
  "Realtime Supabase indisponible pour group_reports. Vérifiez que la table est activée dans la publication supabase_realtime.": "Supabase Realtime unavailable for group_reports. Check that the table is enabled in the supabase_realtime publication.",
  "Realtime Supabase indisponible pour responses_transport. Vérifiez que la table est activée dans la publication supabase_realtime.": "Supabase Realtime unavailable for responses_transport. Check that the table is enabled in the supabase_realtime publication.",
  "Le questionnaire transport a déjà été validé.": "The transport questionnaire has already been validated.",
  "Le questionnaire déjeuner a déjà été validé.": "The lunch questionnaire has already been validated.",
  "Le questionnaire équipement a déjà été validé.": "The equipment questionnaire has already been validated.",
  "Le questionnaire autres consommations a déjà été validé.": "The other-consumption questionnaire has already been validated.",
  "Ajoute au moins un trajet valide.": "Add at least one valid trip.",
  "Indiquer la distance parcourue pour ce moyen de transport.": "Enter the distance travelled for this mode of transport.",
  "Indiquer le type de voiture pour ce moyen de transport.": "Enter the car type for this mode of transport.",
  "Questionnaire transport enregistré.": "Transport questionnaire saved.",
  "Questionnaire déjeuner enregistré.": "Lunch questionnaire saved.",
  "Questionnaire équipement enregistré.": "Equipment questionnaire saved.",
  "Questionnaire autres consommations enregistré.": "Other-consumption questionnaire saved.",
  "Questionnaires terminés. Vous pouvez passer à l'analyse si le professeur l'a autorisée.": "Questionnaires completed. You can move on to the analysis if the teacher has authorized it.",
  "🔓 Analyse accessible aux étudiants": "🔓 Analysis accessible to students",
  "🔒 Analyse non accessible aux étudiants": "🔒 Analysis not accessible to students",
  "🔓 Synthèse accessible aux étudiants": "🔓 Summary accessible to students",
  "🔒 Synthèse non accessible aux étudiants": "🔒 Summary not accessible to students",
  "🔓 Vote accessible aux étudiants": "🔓 Vote accessible to students",
  "🔒 Vote non accessible aux étudiants": "🔒 Vote not accessible to students",
  "🥇 Résultat 1": "🥇 Result 1",
  "🥈 Résultat 2": "🥈 Result 2",
  "🥉 Résultat 3": "🥉 Result 3",
  "Tu reçois une liste de propositions étudiantes classées par groupe.": "You receive a list of student proposals grouped by group.",
  "Consignes impératives :": "Mandatory instructions:",
  "- Conserver 1 idée = 1 proposition": "- Keep 1 idea = 1 proposal",
  "- Proposer seulement 10 propositions": "- Propose only 10 proposals",
  "- Ne jamais fusionner deux propositions différentes": "- Never merge two different proposals",
  "- Ne jamais mettre plusieurs idées dans une seule ligne": "- Never put several ideas on a single line",
  "- Regrouper des propositions si elles semblent proches ou sont du même type": "- Group proposals if they seem similar or are of the same type",
  "- Ne pas inventer d'idée nouvelle": "- Do not invent any new idea",
  "- Reformuler uniquement si nécessaire pour clarifier": "- Rephrase only if needed for clarity",
  "- Si deux propositions sont vraiment identiques, tu peux n'en garder qu'une seule": "- If two proposals are truly identical, you may keep only one",
  "- Produire une liste finale simple, claire, directement exploitable pour un vote": "- Produce a simple, clear final list that can be used directly for a vote",
  "Format de sortie STRICT :": "STRICT output format:",
  "- Texte brut uniquement": "- Plain text only",
  "- Une seule proposition par ligne": "- One proposal per line",
  "- Chaque ligne doit commencer par un numéro": "- Each line must start with a number",
  "Exemple attendu :": "Expected example:",
  "1. Réduire l'usage de la voiture individuelle": "1. Reduce the use of private cars",
  "2. Installer plus d'options végétariennes": "2. Install more vegetarian options",
  "3. Encourager le covoiturage entre étudiants": "3. Encourage carpooling between students",
  "Interdictions :": "Forbidden:",
  "- Pas de sous-points": "- No sub-points",
  "- Pas de paragraphes": "- No paragraphs",
  "- Pas de titres": "- No titles",
  "- Pas de commentaire": "- No comments",
  "- Pas de ligne du type '1. Proposition A / Proposition B / Proposition C'": "- No line such as '1. Proposal A / Proposal B / Proposal C'",
  "Réponds uniquement avec la liste finale numérotée.": "Reply only with the final numbered list.",
  "Réponds sous forme de texte brut compatible import.": "Reply as plain text compatible with import.",
  "Une proposition par ligne numérotée.": "One numbered proposal per line.",
  "# CONSOLIDATION DES PROPOSITIONS ÉTUDIANTES": "# CONSOLIDATION OF STUDENT PROPOSALS",
  "## INSTRUCTIONS": "## INSTRUCTIONS",
  "## DONNÉES DES GROUPES": "## GROUP DATA",
  "## RAPPEL": "## REMINDER",
  "Session créée": "Session created",
  "Session supprimée": "Session deleted",
  "Paramètres enregistrés": "Settings saved",
  "Fichier de consolidation exporté": "Consolidation file exported",
  "proposition(s) détectée(s)": "proposal(s) detected",
  "Vérifiez-les puis cliquez sur": "Check them, then click",
  "Modification réactivée pour le groupe": "Editing reactivated for group",
  "validées": "validated",
  "Groupe": "Group",
  "Prénom": "First name",
  "Nom": "Last name",
  "Email": "Email",
  "Session": "Session",
  "Paris": "Paris",
  "Marseille": "Marseille",
  "Toulon": "Toulon",
  "Bastia": "Bastia",
  "Avignon": "Avignon",
  "Dakar": "Dakar",
  "Bayonne": "Bayonne",
  "Bordeaux": "Bordeaux",
  "Mont-de-Marsan": "Mont-de-Marsan",
  "KEDGE Bachelor": "KEDGE Bachelor",
  "Programme Grande École": "Programme Grande École",
  "Code de session": "Session code",
  "Session :": "Session:",
  "Synthèse finale de la session": "Final session summary",
  "synthèse finale de la session": "final session summary",
  "Synthèse étudiante": "Student summary",
  "Cette zone servira à afficher la mise en œuvre pédagogique, avec une présentation proche du SCORM mais dans une application web multi-utilisateur.": "This area will display the pedagogical setup, with a SCORM-like presentation inside a multi-user web application.",
  "Aucun étudiant ne correspond à la recherche.": "No student matches the search.",
  "Accès professeur ouvert.": "Teacher access opened.",
  "Erreur chargement rôle utilisateur :": "User role loading error:",
  "Erreur chargement réponses transport :": "Transport responses loading error:",
  "Erreur chargement données à reporter déjeuner :": "Lunch data-to-report loading error:",
  "Erreur chargement données à reporter équipement :": "Equipment data-to-report loading error:",
  "Erreur chargement données à reporter autres consommations :": "Other-consumption data-to-report loading error:",
  "Erreur suppression anciens votes :": "Old votes deletion error:",
  "Sauvegarde forcée sur votre groupe.": "Forced save to your group.",
  "Erreur vérification accès étudiant :": "Student access verification error:",
  "Erreur chargement session ouverte :": "Open session loading error:",
  "Session étudiant recalée sur la session ouverte": "Student session reset to the open session",
  "proposition(s) détectée(s).": "proposal(s) detected.",
  "validées.": "validated.",
  "validée.": "validated.",
  "Erreur suppression anciens votes": "Old votes deletion error",
  "Vidéoprojecteur": "Projector",
  "Écran fixe": "Fixed screen",
  "Ampoules": "Light bulbs",
  "Chauffage": "Heating",
  "Climatisation": "Air conditioning",
  "Écran": "Screen",
  "Le menu Bilans a été retiré. Utilisez le menu Synthèse.": "The Reports menu has been removed. Use the Summary menu.",
  "Le menu Bilans a été retiré.": "The Reports menu has been removed.",
  "Utilisez le menu Synthèse.": "Use the Summary menu.",
  "finale de la session": "final session",
  "étudiante": "student",
  "session ouverte": "open session",
  "rôle utilisateur": "user role",
  "réponses transport": "transport responses",
  "données à reporter": "data to report",
  "réponse de l’IA": "AI response",
  "Réduire l’usage de la voiture individuelle": "Reduce the use of private cars",
  "Installer plus d’options végétariennes": "Offer more vegetarian options",
  "Encourager le covoiturage entre étudiants": "Encourage student carpooling",
  "Faites générer": "Ask the AI to generate",
  "Copiez-collez": "Copy and paste",
  "zone ci-dessous": "area below",
  "une seule proposition par ligne": "one proposal per line",
  "liste numérotée": "numbered list",
  "collées": "pasted",
  "soumettre à l’IA": "submit to the AI",
  "Téléchargez": "Download",
  "soumettez-les au vote": "submit them to the vote"
};

const DISPLAY_TRANSLATION_ENTRIES = Object.entries(DISPLAY_TRANSLATIONS_EN).sort(
  ([a], [b]) => b.length - a.length
);

let ACTIVE_DISPLAY_LANG: Lang = "fr";

function normalizeDisplayText(value: string) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function preserveDisplaySpacing(original: string, translated: string) {
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

function translateDisplayText(value: string) {
  if (ACTIVE_DISPLAY_LANG !== "en") return value;

  const normalized = normalizeDisplayText(value);
  if (!normalized) return value;

  const exact = DISPLAY_TRANSLATIONS_EN[normalized];
  if (exact) return preserveDisplaySpacing(value, exact);

  let translated = normalized;

  for (const [fr, en] of DISPLAY_TRANSLATION_ENTRIES) {
    if (fr.length < 4) continue;
    if (translated.includes(fr)) {
      translated = translated.split(fr).join(en);
    }
  }

  return preserveDisplaySpacing(value, translated);
}

function translateReactTree(node: React.ReactNode): React.ReactNode {
  if (typeof node === "string") return translateDisplayText(node);
  if (typeof node === "number" || typeof node === "boolean" || node == null) return node;

  if (Array.isArray(node)) {
    return node.map((child, index) => (
      <React.Fragment key={index}>{translateReactTree(child)}</React.Fragment>
    ));
  }

  if (!React.isValidElement(node)) return node;

  const props = node.props as Record<string, unknown>;
  const nextProps: Record<string, unknown> = {};

  (["placeholder", "title", "aria-label", "alt"] as const).forEach((propName) => {
    const propValue = props[propName];
    if (typeof propValue === "string") {
      nextProps[propName] = translateDisplayText(propValue);
    }
  });

  if (typeof props.children === "undefined") {
    return React.cloneElement(node, nextProps);
  }

  return React.cloneElement(node, nextProps, translateReactTree(props.children as React.ReactNode));
}

function Translated({ children }: { children: React.ReactNode }) {
  return <>{translateReactTree(children)}</>;
}

function getStoredLanguage(): Lang {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === "en" ? "en" : "fr";
  } catch {
    return "fr";
  }
}

function LanguageToggle({
  lang,
  setLang,
  compact = false,
  mini = false,
}: {
  lang: Lang;
  setLang: React.Dispatch<React.SetStateAction<Lang>>;
  compact?: boolean;
  mini?: boolean;
}) {
  const containerStyle = mini
    ? styles.languageToggleMini
    : compact
      ? styles.languageToggleCompact
      : styles.languageToggle;

  const inactiveButtonStyle = mini ? styles.languageFlagButtonMini : styles.languageFlagButton;
  const activeButtonStyle = mini ? styles.languageFlagButtonMiniActive : styles.languageFlagButtonActive;

  return (<Translated>{(
    <div style={containerStyle}>
      <button
        type="button"
        aria-label="Français"
        title="Français"
        style={lang === "fr" ? activeButtonStyle : inactiveButtonStyle}
        onClick={() => setLang("fr")}
      >
        🇫🇷
      </button>
      <button
        type="button"
        aria-label="English"
        title="English"
        style={lang === "en" ? activeButtonStyle : inactiveButtonStyle}
        onClick={() => setLang("en")}
      >
        🇬🇧
      </button>
    </div>
  )}</Translated>);
}


function SessionQrAccess({
  sessionCode,
  lang,
  compact = false,
}: {
  sessionCode: string;
  lang: Lang;
  compact?: boolean;
}) {
  const [qrStatus, setQrStatus] = useState("");
  const cleanCode = formatSessionCode(sessionCode);
  const studentJoinUrl = useMemo(() => buildStudentJoinUrl(cleanCode), [cleanCode]);
  const canvasId = useMemo(
    () => `student-session-qr-${cleanCode.replace(/[^A-Z0-9]/gi, "-") || "session"}-${compact ? "mini" : "full"}`,
    [cleanCode, compact]
  );

  function flashStatus(nextStatus: string) {
    setQrStatus(nextStatus);
    window.setTimeout(() => setQrStatus(""), 2200);
  }

  async function copyStudentLink() {
    try {
      await navigator.clipboard.writeText(studentJoinUrl);
      flashStatus(lang === "en" ? "Link copied." : "Lien copié.");
    } catch {
      window.prompt(lang === "en" ? "Copy this link:" : "Copiez ce lien :", studentJoinUrl);
    }
  }

  async function copyQrCode() {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;

    if (!canvas || !navigator.clipboard) {
      await copyStudentLink();
      return;
    }

    const ClipboardItemCtor = (window as any).ClipboardItem;
    if (!ClipboardItemCtor) {
      await copyStudentLink();
      return;
    }

    canvas.toBlob(async (blob) => {
      if (!blob) {
        void copyStudentLink();
        return;
      }

      try {
        await navigator.clipboard.write([
          new ClipboardItemCtor({ "image/png": blob }),
        ]);
        flashStatus(lang === "en" ? "QR code copied." : "QR code copié.");
      } catch {
        void copyStudentLink();
      }
    });
  }

  function downloadQrCode() {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) return;

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `qr-session-${cleanCode || "bilan-carbone"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (!cleanCode) return null;

  return (<Translated>{(
    <div style={compact ? styles.qrAccessCardCompact : styles.qrAccessCard} className="qr-access-card">
      <div style={styles.qrAccessTextBlock}>
        <h3 style={compact ? styles.qrAccessTitleCompact : styles.qrAccessTitle}>
          {t(lang, "qrStudentAccess")}
        </h3>
        <p style={styles.qrAccessDescription}>{t(lang, "scanQrInstruction")}</p>
        <div style={styles.qrAccessCode}>{cleanCode}</div>
      </div>

      <div style={styles.qrCanvasWrap}>
        <QRCodeCanvas
          id={canvasId}
          value={studentJoinUrl}
          size={compact ? 136 : 190}
          includeMargin
          level="M"
        />
      </div>

      <div style={styles.qrActionRow}>
        <button type="button" style={styles.secondaryButton} onClick={copyQrCode}>
          {t(lang, "copyQr")}
        </button>
        <button type="button" style={styles.secondaryButton} onClick={copyStudentLink}>
          {t(lang, "copyLink")}
        </button>
        <button type="button" style={styles.secondaryButton} onClick={downloadQrCode}>
          {t(lang, "downloadQr")}
        </button>
      </div>

      {qrStatus ? <div style={styles.qrStatus}>{qrStatus}</div> : null}
    </div>
  )}</Translated>);
}

function useStudentMobileLayout() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 820px), (pointer: coarse) and (max-width: 1024px)");
    const update = () => setIsMobile(mediaQuery.matches);

    update();
    mediaQuery.addEventListener?.("change", update);

    return () => {
      mediaQuery.removeEventListener?.("change", update);
    };
  }, []);

  return isMobile;
}


function LoadingSpinner({
  label,
  tone = "light",
}: {
  label?: React.ReactNode;
  tone?: "light" | "dark";
}) {
  const spinnerStyle =
    tone === "dark"
      ? {
          ...styles.spinnerIcon,
          border: "2px solid rgba(15,23,42,0.18)",
          borderTopColor: "#ed7d31",
        }
      : styles.spinnerIcon;

  return (
    <span style={styles.loadingInline} role="status" aria-live="polite">
      <style>{`@keyframes carbon-app-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <span style={spinnerStyle} aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}

function PrivacyModal({
  lang,
  audience,
  onClose,
}: {
  lang: Lang;
  audience: "student" | "teacher";
  onClose: () => void;
}) {
  return (
    <div
      style={styles.privacyModalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
      onClick={onClose}
    >
      <div style={styles.privacyModalCard} onClick={(event) => event.stopPropagation()}>
        <div style={styles.privacyModalHeader}>
          <h2 id="privacy-modal-title" style={styles.privacyModalTitle}>
            {t(lang, "privacyTitle")}
          </h2>
          <button
            type="button"
            aria-label={t(lang, "close")}
            title={t(lang, "close")}
            style={styles.privacyModalIconButton}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div style={styles.privacyModalBody}>
          <p style={styles.privacyModalParagraph}>
            {audience === "student"
              ? t(lang, "privacyStudentNotice")
              : t(lang, "privacyTeacherNotice")}
          </p>
          <p style={styles.privacyModalParagraph}>{t(lang, "privacyRights")}</p>
        </div>

        <div style={styles.privacyModalActions}>
          <button type="button" style={styles.primaryButton} onClick={onClose}>
            {t(lang, "close")}
          </button>
        </div>
      </div>
    </div>
  );
}

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

type AssignmentMode = "groups";
type AssignmentMethod = "import" | "random";

type StudentAssignmentDraft = {
  email: string;
  first_name: string;
  last_name: string;
  group_number: number;
};

type StudentProgressRow = {
  student_email: string;
  first_name: string;
  last_name: string;
  group_number: number;
  transport_done: boolean;
  dejeuner_done: boolean;
  equipement_done: boolean;
  autres_done: boolean;
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
  ebike: "Vélo électrique",
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

  return (<Translated>{(
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
  )}</Translated>);
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

function getDisplayLocale() {
  return ACTIVE_DISPLAY_LANG === "en" ? "en-US" : "fr-FR";
}

function formatInteger(value: number | string | null | undefined) {
  return new Intl.NumberFormat(getDisplayLocale()).format(Number(value ?? 0));
}

function formatDecimal(value: number | string | null | undefined, digits = 2) {
  const numericValue = Number(value ?? 0);

  if (digits === 2) {
    return new Intl.NumberFormat(getDisplayLocale(), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numericValue);
  }

  return new Intl.NumberFormat(getDisplayLocale(), {
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

  const formatted = new Intl.NumberFormat(getDisplayLocale(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(numericValue);

  return ACTIVE_DISPLAY_LANG === "en" ? formatted : formatted.replace(/\./g, ",");
}

function formatFactorNumber(value: number | string | null | undefined) {
  const numericValue =
    typeof value === "string"
      ? Number(value.replace(",", "."))
      : Number(value ?? 0);

  if (!Number.isFinite(numericValue)) {
    return "0";
  }

  const formatted = new Intl.NumberFormat(getDisplayLocale(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(numericValue);

  return ACTIVE_DISPLAY_LANG === "en" ? formatted : formatted.replace(/\./g, ",");
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
    return (<Translated>{(
      <div style={{ ...styles.emptyText, marginTop: 12 }}>
        Aucun étudiant ne correspond à la recherche.
      </div>
    )}</Translated>);
  }

  return (<Translated>{(
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
  )}</Translated>);
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

function countRandomAssignmentCandidates(rawText: string) {
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
      return {
        email: normalizeEmail(parts[0] ?? ""),
        firstName: parts[1] ?? "",
        lastName: parts[2] ?? "",
      };
    })
    .filter((student) => student.email && student.email.includes("@") && student.firstName && student.lastName)
    .length;
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

  return (<Translated>{(
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
  )}</Translated>);
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

  return (<Translated>{(
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
  )}</Translated>);
}

type StudentSidebarProps = {
  active: "mise_en_oeuvre" | "collecte" | "analyses" | "bilans" | "vote";
  onGo: (screen: Screen) => void;
  analysisUnlocked: boolean;
  voteUnlocked: boolean;
  onBeforeOpenAnalysis?: () => Promise<boolean> | boolean;
  onBeforeOpenVote?: () => Promise<boolean> | boolean;
  sessionCode?: string;
  sessionId?: string;
  lang: Lang;
  setLang: React.Dispatch<React.SetStateAction<Lang>>;
};

function StudentSidebar({
  active,
  onGo,
  analysisUnlocked,
  voteUnlocked,
  onBeforeOpenAnalysis,
  onBeforeOpenVote,
  sessionCode,
  sessionId,
  lang,
  setLang,
}: StudentSidebarProps) {
  const isStudentMobile = useStudentMobileLayout();

  if (isStudentMobile) {
    return (<Translated>{(
      <aside style={styles.studentMobileTopbar} className="student-mobile-topbar">
        <div style={styles.studentMobileNavScroller} className="student-mobile-nav-scroller">
          <button
            type="button"
            style={active === "mise_en_oeuvre" ? styles.studentMobileNavButtonActive : styles.studentMobileNavButton}
            onClick={() => onGo("student_mise_en_oeuvre")}
          >
            {t(lang, "miseEnOeuvre")}
          </button>

          <button
            type="button"
            style={active === "collecte" ? styles.studentMobileNavButtonActive : styles.studentMobileNavButton}
            onClick={() => onGo("student_transport")}
          >
            {t(lang, "dataCollection")}
          </button>

          <button
            type="button"
            style={active === "analyses" ? styles.studentMobileNavButtonActive : styles.studentMobileNavButton}
            onClick={async () => {
              const refreshedAccess = await onBeforeOpenAnalysis?.();
              const canOpenAnalysis =
                typeof refreshedAccess === "boolean" ? refreshedAccess : analysisUnlocked;

              if (!canOpenAnalysis) {
                window.alert(t(lang, "lockAnalysis"));
                return;
              }

              onGo("student_analyses");
            }}
          >
            {t(lang, "analyses")}
          </button>

          <button
            type="button"
            style={active === "vote" ? styles.studentMobileNavButtonActive : styles.studentMobileNavButton}
            onClick={async () => {
              const refreshedAccess = await onBeforeOpenVote?.();
              const canOpenVote =
                typeof refreshedAccess === "boolean" ? refreshedAccess : voteUnlocked;

              if (!canOpenVote) {
                window.alert(t(lang, "lockVote"));
                return;
              }

              onGo("student_vote");
            }}
          >
            {t(lang, "vote")}
          </button>

        </div>

        <div style={styles.studentMobileUtilityRow} className="student-mobile-utility-row">
          <div style={styles.studentMobileSessionPill} title={sessionId ?? ""}>
            {sessionCode ? `${t(lang, "code")} : ${formatSessionCode(sessionCode)}` : ""}
          </div>

          <button
            type="button"
            className="student-mobile-lang-button"
            style={styles.studentMobileLangButton}
            onClick={() => setLang((current) => (current === "fr" ? "en" : "fr"))}
            aria-label={lang === "fr" ? "Passer en anglais" : "Switch to French"}
            title={lang === "fr" ? "Passer en anglais" : "Switch to French"}
          >
            {lang === "fr" ? "🇫🇷 FR" : "🇬🇧 EN"}
          </button>

          <button
            type="button"
            style={styles.studentMobileLogoutButton}
            onClick={() => onGo("home" as Screen)}
            aria-label={t(lang, "logout")}
            title={t(lang, "logout")}
          >
            ⎋
          </button>
        </div>
      </aside>
    )}</Translated>);
  }

  return (<Translated>{(
    <aside style={styles.sidebar}>
      <div style={styles.sidebarBrand}>
        <img src={kedgeLogo} alt="KEDGE Business School" style={styles.sidebarLogo} />
      </div>

      <button
        type="button"
        style={active === "mise_en_oeuvre" ? styles.sidebarButtonActive : styles.sidebarButton}
        onClick={() => onGo("student_mise_en_oeuvre")}
      >
        {t(lang, "miseEnOeuvre")}
      </button>

      <button
        type="button"
        style={active === "collecte" ? styles.sidebarButtonActive : styles.sidebarButton}
        onClick={() => onGo("student_transport")}
      >
        {t(lang, "dataCollection")}
      </button>

      <button
        type="button"
        style={active === "analyses" ? styles.sidebarButtonActive : styles.sidebarButton}
        onClick={async () => {
          const refreshedAccess = await onBeforeOpenAnalysis?.();
          const canOpenAnalysis =
            typeof refreshedAccess === "boolean" ? refreshedAccess : analysisUnlocked;
          if (!canOpenAnalysis) {
            window.alert(t(lang, "lockAnalysis"));
            return;
          }
          onGo("student_analyses");
        }}
      >
        {t(lang, "analyses")} {analysisUnlocked ? "🔓" : "🔒"}
      </button>

      <button
        type="button"
        style={active === "vote" ? styles.sidebarButtonActive : styles.sidebarButton}
        onClick={async () => {
          const refreshedAccess = await onBeforeOpenVote?.();
          const canOpenVote =
            typeof refreshedAccess === "boolean" ? refreshedAccess : voteUnlocked;

          if (!canOpenVote) {
            window.alert(t(lang, "lockVote"));
            return;
          }

          onGo("student_vote");
        }}
      >
        {t(lang, "vote")} {voteUnlocked ? "🔓" : "🔒"}
      </button>


      {/* ✅ AJOUT : affichage debug session en bas de sidebar */}
      <div style={styles.sidebarFooter}>
        <LanguageToggle lang={lang} setLang={setLang} compact />
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
                <strong>{t(lang, "code")} :</strong> {formatSessionCode(sessionCode)}
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
          {t(lang, "logout")}
        </button>
      </div>
    </aside>
  )}</Translated>);
}

type StudentQuestionnaireTabsProps = {
  active: QuestionnaireKey;
  completion: StudentCompletion;
  onNavigate: (target: QuestionnaireKey) => void;
  canAccess: (target: QuestionnaireKey) => boolean;
  lang?: Lang;
};

function StudentQuestionnaireTabs({
  active,
  completion,
  onNavigate,
  canAccess,
  lang = "fr",
}: StudentQuestionnaireTabsProps) {
  const label = (text: string, done: boolean) => (done ? `${text} ✓` : text);

  const buttonStyle = (target: QuestionnaireKey) => {
    if (target === active) return styles.sidebarButtonActive;
    return canAccess(target) ? styles.sidebarButton : styles.secondaryButton;
  };

  return (<Translated>{(
    <div style={styles.row} className="student-questionnaire-tabs">
      <button style={buttonStyle("transport")} type="button" onClick={() => onNavigate("transport")}>
        {label("Transport", completion.transport)}
      </button>
      <button style={buttonStyle("dejeuner")} type="button" onClick={() => onNavigate("dejeuner")}>
        {label(lang === "en" ? "Lunch" : "Déjeuner", completion.dejeuner)}
      </button>
      <button style={buttonStyle("equipement")} type="button" onClick={() => onNavigate("equipement")}>
        {label(lang === "en" ? "Equipment" : "Équipement", completion.equipement)}
      </button>
      <button style={buttonStyle("autres")} type="button" onClick={() => onNavigate("autres")}>
        {label(lang === "en" ? "Other consumption" : "Autres consommations", completion.autres)}
      </button>
    </div>
  )}</Translated>);
}

export default function App() {
  const initialProjectionMode = shouldOpenProjectionFromUrl();
  const initialStudentDeepLink = shouldOpenStudentLoginFromUrl();
  const initialUrlSessionCode = getInitialSessionCodeFromUrl();
  const initialStudentTarget = getInitialStudentTargetFromUrl();
  const [screen, setScreen] = useState<Screen>(
    initialProjectionMode
      ? ("projection" as Screen)
      : initialStudentDeepLink
        ? "student_login"
        : "home"
  );
  const [projectionStage, setProjectionStage] = useState<ProjectionStage>(getInitialProjectionStage);
  const [projectionSessionCode, setProjectionSessionCode] = useState(initialUrlSessionCode);
  const [projectionLoading, setProjectionLoading] = useState(false);
  const [lang, setLang] = useState<Lang>(getStoredLanguage);
  const isStudentMobileMain = useStudentMobileLayout();
  const [privacyModalAudience, setPrivacyModalAudience] = useState<"student" | "teacher" | null>(null);
  ACTIVE_DISPLAY_LANG = lang;
  const [isInitialSessionSetup, setIsInitialSessionSetup] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {}
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    let viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!viewport) {
      viewport = document.createElement("meta");
      viewport.name = "viewport";
      document.head.appendChild(viewport);
    }
    viewport.content = "width=device-width, initial-scale=1, viewport-fit=cover";

    if (document.getElementById("student-mobile-responsive-css")) return;

    const style = document.createElement("style");
    style.id = "student-mobile-responsive-css";
    style.textContent = `
      @media (max-width: 1024px) {
        html,
        body,
        #root {
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: hidden !important;
        }

        .student-responsive-auth {
          align-items: stretch !important;
          justify-content: flex-start !important;
          min-height: 100dvh !important;
          padding: 12px !important;
          box-sizing: border-box !important;
        }

        .student-responsive-auth > div {
          width: 100% !important;
          max-width: none !important;
          border-radius: 22px !important;
          padding: 22px 16px !important;
          gap: 16px !important;
          box-sizing: border-box !important;
        }

        .student-responsive-auth h1 {
          font-size: clamp(23px, 7vw, 30px) !important;
          line-height: 1.12 !important;
        }

        .student-responsive-auth input,
        .student-responsive-auth select,
        .student-responsive-auth textarea {
          min-height: 48px !important;
          font-size: 16px !important;
          padding: 13px 14px !important;
          box-sizing: border-box !important;
        }

        .student-responsive-auth button {
          min-height: 46px !important;
          font-size: 15px !important;
        }

        .student-responsive-auth [style*="display: flex"] {
          width: 100% !important;
        }

        .student-responsive-shell {
          display: flex !important;
          flex-direction: column !important;
          grid-template-columns: none !important;
          min-height: 100dvh !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: hidden !important;
          background: #e5e5e5 !important;
        }

        .student-responsive-shell aside {
          position: sticky !important;
          top: 0 !important;
          z-index: 50 !important;
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 7px !important;
          width: 100% !important;
          max-width: 100% !important;
          padding: calc(8px + env(safe-area-inset-top, 0px)) 10px 8px !important;
          box-sizing: border-box !important;
          border-radius: 0 !important;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.22) !important;
        }

        .student-responsive-shell aside > div:first-child {
          display: none !important;
        }

        .student-responsive-shell aside button {
          width: 100% !important;
          min-width: 0 !important;
          min-height: 34px !important;
          padding: 7px 5px !important;
          font-size: 11px !important;
          line-height: 1.08 !important;
          border-radius: 999px !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
        }

        .student-responsive-shell aside > button:nth-of-type(4),
        .student-responsive-shell aside > button:nth-of-type(5) {
          grid-column: span 1 !important;
        }

        .student-responsive-shell aside > div:last-child {
          grid-column: 1 / -1 !important;
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: center !important;
          flex-wrap: wrap !important;
          gap: 6px !important;
          margin-top: 0 !important;
        }

        .student-responsive-shell aside > div:last-child > div:not(:first-child) {
          display: none !important;
        }

        .student-responsive-shell aside > div:last-child button {
          width: auto !important;
          min-width: 84px !important;
          min-height: 30px !important;
          padding: 6px 10px !important;
          font-size: 11px !important;
        }

        .student-responsive-shell main {
          padding: 8px !important;
          gap: 8px !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }

        .student-responsive-shell header {
          min-height: auto !important;
          padding: 9px 8px 7px !important;
          border-radius: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          box-shadow: 0 5px 12px rgba(0,0,0,0.12) !important;
        }

        .student-responsive-shell header > div {
          min-height: auto !important;
          padding: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
        }

        .student-responsive-shell header div:first-child {
          font-size: clamp(16px, 5.2vw, 23px) !important;
          line-height: 1.02 !important;
          letter-spacing: 0.2px !important;
          word-break: normal !important;
          overflow-wrap: normal !important;
          hyphens: none !important;
        }

        .student-responsive-shell header div:nth-child(2) {
          font-size: 8.5px !important;
          line-height: 1.15 !important;
          margin-top: 4px !important;
        }

        .student-responsive-shell section {
          border-radius: 22px !important;
          padding: 12px !important;
          min-height: auto !important;
          gap: 12px !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
        }

        .student-responsive-shell h2 {
          font-size: clamp(25px, 8vw, 36px) !important;
          line-height: 1.08 !important;
          margin-bottom: 4px !important;
        }

        .student-responsive-shell h3 {
          font-size: 18px !important;
          line-height: 1.2 !important;
        }

        .student-responsive-shell p,
        .student-responsive-shell label,
        .student-responsive-shell span,
        .student-responsive-shell div {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }

        .student-responsive-shell input,
        .student-responsive-shell select,
        .student-responsive-shell textarea {
          width: 100% !important;
          min-height: 48px !important;
          font-size: 16px !important;
          padding: 13px 14px !important;
          box-sizing: border-box !important;
        }

        .student-responsive-shell main button {
          max-width: 100% !important;
          min-height: 44px !important;
          font-size: 15px !important;
          justify-content: center !important;
          box-sizing: border-box !important;
        }

        .student-questionnaire-tabs {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 10px !important;
          width: 100% !important;
          padding: 0 !important;
        }

        .student-questionnaire-tabs button {
          width: 100% !important;
          min-width: 0 !important;
          min-height: 62px !important;
          padding: 10px 8px !important;
          font-size: 14px !important;
          line-height: 1.15 !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
        }

        .student-responsive-shell [style*="grid-template-columns"] {
          grid-template-columns: 1fr !important;
        }

        .student-responsive-shell table {
          min-width: 680px !important;
        }

        .student-responsive-shell td,
        .student-responsive-shell th {
          font-size: 14px !important;
          padding: 10px 12px !important;
        }
      }

      @media (max-width: 820px), (pointer: coarse) and (max-width: 1024px) {
        .student-responsive-shell {
          background: #d9d9d9 !important;
        }

        .student-responsive-shell aside.student-mobile-topbar {
          position: sticky !important;
          top: 0 !important;
          z-index: 90 !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 5px !important;
          width: 100% !important;
          max-width: 100% !important;
          padding: calc(5px + env(safe-area-inset-top, 0px)) 7px 6px !important;
          box-sizing: border-box !important;
          border-radius: 0 !important;
          box-shadow: 0 7px 16px rgba(15, 23, 42, 0.25) !important;
        }

        .student-mobile-nav-scroller {
          display: flex !important;
          flex-direction: row !important;
          gap: 6px !important;
          width: 100% !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          padding: 0 0 2px !important;
          -webkit-overflow-scrolling: touch !important;
          scrollbar-width: none !important;
        }

        .student-mobile-nav-scroller::-webkit-scrollbar {
          display: none !important;
        }

        .student-responsive-shell aside.student-mobile-topbar .student-mobile-nav-scroller button {
          flex: 0 0 auto !important;
          width: auto !important;
          min-width: 92px !important;
          max-width: 138px !important;
          min-height: 32px !important;
          padding: 7px 10px !important;
          font-size: 12px !important;
          line-height: 1.05 !important;
          white-space: normal !important;
          overflow-wrap: normal !important;
        }

        .student-mobile-utility-row {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 6px !important;
          width: 100% !important;
          min-height: 28px !important;
        }

        .student-mobile-language {
          flex: 0 0 auto !important;
        }

        .student-responsive-shell aside.student-mobile-topbar .student-mobile-language button {
          width: 34px !important;
          height: 26px !important;
          min-height: 26px !important;
          font-size: 15px !important;
          padding: 0 !important;
        }

        .student-responsive-shell aside.student-mobile-topbar .student-mobile-utility-row > button {
          width: 36px !important;
          min-width: 36px !important;
          height: 26px !important;
          min-height: 26px !important;
          padding: 0 !important;
          font-size: 15px !important;
        }

        .student-responsive-shell main {
          padding: 6px !important;
          gap: 8px !important;
        }

        .student-responsive-shell main > header {
          display: none !important;
        }

        .student-responsive-shell section {
          border-radius: 18px !important;
          padding: 10px !important;
          gap: 10px !important;
        }

        .student-responsive-shell h2 {
          font-size: clamp(22px, 6.4vw, 30px) !important;
          line-height: 1.05 !important;
          margin: 0 0 4px !important;
        }

        .student-responsive-shell h3 {
          font-size: 17px !important;
          line-height: 1.15 !important;
        }

        .student-responsive-shell p {
          font-size: 14px !important;
          line-height: 1.35 !important;
        }

        .student-responsive-shell table {
          width: 100% !important;
          min-width: 0 !important;
          table-layout: auto !important;
        }

        .student-responsive-shell th,
        .student-responsive-shell td {
          font-size: 13px !important;
          line-height: 1.2 !important;
          padding: 8px 7px !important;
          white-space: normal !important;
          overflow-wrap: break-word !important;
          word-break: normal !important;
        }

        .student-responsive-shell td input,
        .student-responsive-shell td select {
          min-height: 38px !important;
          padding: 8px 10px !important;
          font-size: 16px !important;
        }

        .student-responsive-shell input,
        .student-responsive-shell select,
        .student-responsive-shell textarea {
          min-height: 42px !important;
          font-size: 16px !important;
          padding: 10px 12px !important;
        }

        .student-questionnaire-tabs {
          grid-template-columns: 1fr 1fr !important;
          gap: 7px !important;
        }

        .student-questionnaire-tabs button {
          min-height: 44px !important;
          padding: 8px 6px !important;
          font-size: 13px !important;
        }


        /* Correctif v4 : la règle générique qui masquait le premier div de la sidebar
           cachait aussi la navigation mobile. On la réaffiche explicitement. */
        .student-responsive-shell aside.student-mobile-topbar > .student-mobile-nav-scroller {
          display: flex !important;
          visibility: visible !important;
          height: auto !important;
          opacity: 1 !important;
        }

        /* Sur mobile, le code est déjà affiché dans la barre compacte. */
        .student-responsive-shell .student-session-meta {
          display: none !important;
        }

        /* Correctif v4 : les règles globales donnaient width:100% aux checkboxes,
           ce qui repoussait le texte hors de l'écran. */
        .student-responsive-shell input[type="checkbox"] {
          width: 34px !important;
          min-width: 34px !important;
          max-width: 34px !important;
          height: 34px !important;
          min-height: 34px !important;
          max-height: 34px !important;
          padding: 0 !important;
          margin: 0 !important;
          flex: 0 0 34px !important;
          box-sizing: border-box !important;
          accent-color: #0b8ef3 !important;
        }

        .student-responsive-shell label:has(input[type="checkbox"]) {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 12px !important;
          width: 100% !important;
          min-width: 0 !important;
          min-height: 58px !important;
          padding: 11px 12px !important;
          box-sizing: border-box !important;
          text-align: left !important;
          white-space: normal !important;
          overflow: hidden !important;
          overflow-wrap: anywhere !important;
          word-break: normal !important;
        }

        .student-responsive-shell label:has(input[type="checkbox"]) * {
          max-width: 100% !important;
        }

        .student-mobile-utility-row {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto auto !important;
          align-items: center !important;
          gap: 6px !important;
        }

        .student-mobile-utility-row .student-mobile-lang-button {
          display: inline-flex !important;
          width: 58px !important;
          min-width: 58px !important;
          max-width: 58px !important;
          height: 26px !important;
          min-height: 26px !important;
          padding: 0 6px !important;
          font-size: 12px !important;
        }

        .student-mobile-session-pill {
          min-width: 0 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .student-responsive-shell .student-mobile-report-cards input,
        .student-responsive-shell .student-mobile-report-cards select {
          min-height: 42px !important;
          padding: 9px 10px !important;
          font-size: 16px !important;
        }

      }

      @media (max-width: 1024px) {
        .teacher-responsive-shell,
        .admin-responsive-shell {
          display: flex !important;
          flex-direction: column !important;
          grid-template-columns: none !important;
          width: 100% !important;
          max-width: 100% !important;
          min-height: 100dvh !important;
          overflow-x: hidden !important;
        }

        .teacher-responsive-shell aside,
        .admin-responsive-shell aside {
          position: sticky !important;
          top: 0 !important;
          z-index: 80 !important;
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 8px !important;
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: auto !important;
          padding: calc(8px + env(safe-area-inset-top, 0px)) 10px 8px !important;
          box-sizing: border-box !important;
          border-radius: 0 !important;
          -webkit-overflow-scrolling: touch !important;
        }

        .teacher-responsive-shell aside > div:first-child,
        .admin-responsive-shell aside > div:first-child {
          display: none !important;
        }

        .teacher-responsive-shell aside button,
        .admin-responsive-shell aside button {
          flex: 0 0 auto !important;
          width: auto !important;
          min-width: 112px !important;
          min-height: 38px !important;
          padding: 8px 12px !important;
          font-size: 12px !important;
          border-radius: 999px !important;
          white-space: nowrap !important;
        }

        .teacher-responsive-shell aside > div:last-child,
        .admin-responsive-shell aside > div:last-child {
          flex: 0 0 auto !important;
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 8px !important;
          margin-top: 0 !important;
        }

        .teacher-responsive-shell main,
        .admin-responsive-shell main {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          padding: 10px !important;
          box-sizing: border-box !important;
        }

        .teacher-responsive-shell header,
        .admin-responsive-shell header {
          min-height: auto !important;
          padding: 12px 10px !important;
        }

        .teacher-responsive-shell header div:first-child,
        .admin-responsive-shell header div:first-child {
          font-size: clamp(18px, 5vw, 28px) !important;
          line-height: 1.05 !important;
        }

        .teacher-responsive-shell section,
        .admin-responsive-shell section {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          padding: 14px !important;
          border-radius: 20px !important;
          box-sizing: border-box !important;
        }

        .teacher-responsive-shell table,
        .admin-responsive-shell table {
          min-width: 720px !important;
        }

        .teacher-responsive-shell .qr-access-card,
        .admin-responsive-shell .qr-access-card {
          grid-template-columns: 1fr !important;
          .teacher-responsive-shell .teacher-session-context {
          min-width: 170px !important;
          width: auto !important;
          margin-bottom: 0 !important;
        }

        .teacher-responsive-shell .teacher-access-panel {
          flex: 0 0 auto !important;
          width: auto !important;
          min-width: 360px !important;
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 8px !important;
          margin-top: 0 !important;
        }

        .teacher-responsive-shell .teacher-access-panel div {
          display: none !important;
        }

        .teacher-responsive-shell .teacher-access-panel button {
          min-width: 105px !important;
        }
      }
        .teacher-responsive-shell .teacher-session-context {
          min-width: 170px !important;
          width: auto !important;
          margin-bottom: 0 !important;
        }

        .teacher-responsive-shell .teacher-access-panel {
          flex: 0 0 auto !important;
          width: auto !important;
          min-width: 360px !important;
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 8px !important;
          margin-top: 0 !important;
        }

        .teacher-responsive-shell .teacher-access-panel div {
          display: none !important;
        }

        .teacher-responsive-shell .teacher-access-panel button {
          min-width: 105px !important;
        }
      }


      @media (max-width: 820px) {
        .qr-access-card {
          grid-template-columns: 1fr !important;
        }
      }

    `;

    document.head.appendChild(style);
  }, []);

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
  const [studentCodeSession, setStudentCodeSession] = useState(() => initialUrlSessionCode);
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

const [, setAssignmentMode] = useState<AssignmentMode>("groups");
const [assignmentMethod, setAssignmentMethod] = useState<AssignmentMethod>("import");
const [assignmentRawText, setAssignmentRawText] = useState("");
const [validatedRandomAssignments, setValidatedRandomAssignments] = useState<StudentAssignmentDraft[]>([]);
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
  const [countsLoading, setCountsLoading] = useState(false);
  const [studentProgressRows, setStudentProgressRows] = useState<StudentProgressRow[]>([]);
  const [studentProgressLoading, setStudentProgressLoading] = useState(false);
  const [studentSavingQuestionnaire, setStudentSavingQuestionnaire] = useState<QuestionnaireKey | null>(null);
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
  const [studentVoteUnlocked, setStudentVoteUnlocked] = useState(false);
const [consolidatedProposals, setConsolidatedProposals] = useState<ConsolidatedProposalOption[]>([]);
const [importedProposalRawText, setImportedProposalRawText] = useState("");
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

const studentVotedEmails = useMemo(() => {
  return new Set(
    teacherVoteRows
      .map((row) => normalizeEmail(row.student_email ?? ""))
      .filter(Boolean)
  );
}, [teacherVoteRows]);

const teacherVoteTotalExpressedScore = useMemo(
  () => teacherVoteResults.reduce((sum, row) => sum + Number(row.score ?? 0), 0),
  [teacherVoteResults]
);

function hasStudentVoted(email: string | null | undefined) {
  return studentVotedEmails.has(normalizeEmail(email ?? ""));
}

function getVoteScorePercent(score: number) {
  if (!teacherVoteTotalExpressedScore) return 0;
  return Math.round((Number(score ?? 0) / teacherVoteTotalExpressedScore) * 100);
}

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

const teacherSyntheseData = useMemo(
  () => computeSynthese(teacherSyntheseSourceRows),
  [teacherSyntheseSourceRows]
);

  const parsedStudentAssignments = useMemo(() => {
  return parseStudentAssignments(assignmentRawText);
}, [assignmentRawText]);

  const randomCandidateCount = useMemo(() => {
    if (assignmentMethod !== "random") return 0;
    return countRandomAssignmentCandidates(settingsAllowedEmailsText);
  }, [assignmentMethod, settingsAllowedEmailsText]);

  const activeStudentAssignments = useMemo(() => {
    return assignmentMethod === "random" ? validatedRandomAssignments : parsedStudentAssignments;
  }, [assignmentMethod, parsedStudentAssignments, validatedRandomAssignments]);

  const displayedStudentAssignments = useMemo(() => {
    return activeStudentAssignments;
  }, [activeStudentAssignments]);

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


  if (screen === "student_vote" && !studentVoteUnlocked) {
    setScreen("student_mise_en_oeuvre");
  }
}, [
  screen,
  studentAnalysisUnlocked,
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

  const nextState: Record<number, GroupProposalState> = {};

  for (let group = 1; group <= 10; group++) {
    nextState[group] = emptyGroupProposalState();
  }

  // Lecture directe de group_proposals : c'est la source utilisée par les étudiants
  // lorsqu'ils valident leurs propositions. On conserve un fallback RPC pour ne pas
  // casser les éventuelles règles RLS côté étudiant.
  const directResponse = await supabase
    .from("group_proposals")
    .select("group_number,proposal_1,proposal_2,proposal_3,is_validated")
    .eq("session_id", sessionId)
    .order("group_number", { ascending: true });

  let rows = (directResponse.data ?? []) as GroupProposalRow[];

  if (directResponse.error || rows.length === 0) {
    const rpcResponse = await supabase.rpc("get_group_proposals_for_session", {
      p_session_id: sessionId,
    });

    if (rpcResponse.error && directResponse.error) {
      setMessage(`Erreur chargement propositions : ${directResponse.error.message}`);
      setTeacherGroupProposals(nextState);
      return;
    }

    rows = (rpcResponse.data ?? rows) as GroupProposalRow[];
  }

  rows.forEach((row: GroupProposalRow) => {
    const groupNumber = Number(row.group_number);
    if (!Number.isInteger(groupNumber) || groupNumber < 1 || groupNumber > 10) return;

    nextState[groupNumber] = {
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
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

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

async function submitImportedProposalsToVote() {
  if (!selectedSessionId) {
    window.alert("Aucune session sélectionnée.");
    return;
  }

  const parsed = parseConsolidatedTxt(importedProposalRawText);
  const cleanedProposals = cleanProposals(parsed);

  if (cleanedProposals.length === 0) {
    window.alert("Aucune proposition valide détectée dans le texte collé.");
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

  const payload = cleanedProposals.map((text) => ({
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

  async function loadSessionCounts(
    sessionId: string,
    options: { showLoading?: boolean } = {}
  ) {
    if (!sessionId) {
      setCounts(EMPTY_COUNTS);
      return;
    }

    let loadingTimerId: number | undefined;

    if (options.showLoading) {
      loadingTimerId = window.setTimeout(() => {
        setCountsLoading(true);
      }, 350);
    }

    try {
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
    } finally {
      if (loadingTimerId !== undefined) {
        window.clearTimeout(loadingTimerId);
      }
      if (options.showLoading) {
        setCountsLoading(false);
      }
    }
  }


  async function loadStudentProgress(
    sessionId: string,
    options: { showLoading?: boolean } = {}
  ) {
    if (!sessionId) {
      setStudentProgressRows([]);
      return;
    }

    let loadingTimerId: number | undefined;

    if (options.showLoading) {
      loadingTimerId = window.setTimeout(() => {
        setStudentProgressLoading(true);
      }, 350);
    }

    try {
      const { data, error } = await supabase.rpc("get_session_student_progress", {
        p_session_id: sessionId,
      });

      if (error) {
        setStudentProgressRows([]);
        setMessage(`Erreur chargement suivi étudiant : ${error.message}`);
        return;
      }

      setStudentProgressRows(
        ((data ?? []) as any[]).map((row) => ({
          student_email: String(row.student_email ?? ""),
          first_name: String(row.first_name ?? ""),
          last_name: String(row.last_name ?? ""),
          group_number: Number(row.group_number ?? 0),
          transport_done: Boolean(row.transport_done),
          dejeuner_done: Boolean(row.dejeuner_done),
          equipement_done: Boolean(row.equipement_done),
          autres_done: Boolean(row.autres_done),
        }))
      );
    } finally {
      if (loadingTimerId !== undefined) {
        window.clearTimeout(loadingTimerId);
      }
      if (options.showLoading) {
        setStudentProgressLoading(false);
      }
    }
  }

  async function refreshSessionMonitoring(
    sessionId: string,
    options: { showLoading?: boolean } = {}
  ) {
    if (!sessionId) {
      setCounts(EMPTY_COUNTS);
      setStudentProgressRows([]);
      return;
    }

    await Promise.all([
      loadSessionCounts(sessionId, options),
      loadStudentProgress(sessionId, options),
      loadTeacherVoteRows(sessionId),
    ]);
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

    const positiveRows = ((data ?? []) as DejeunerReportableRowRpc[]).filter(
      (row) => Number(row.quantity ?? 0) > 0
    );

    setRows(positiveRows);
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
    if ((screen as string) === "projection" || shouldOpenStudentLoginFromUrl()) return;
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
    if ((screen as string) !== "projection") return;
    const cleanCode = formatSessionCode(projectionSessionCode || initialUrlSessionCode);
    if (!cleanCode) return;

    let active = true;

    async function loadProjectionSession() {
      setProjectionLoading(true);
      setMessage("");

      try {
        const { data, error } = await supabase.rpc("get_open_session_by_code", {
          p_session_code: cleanCode,
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        const session = Array.isArray(data) ? data[0] : data;
        if (!session?.id) {
          setMessage(lang === "en" ? "Session not found or closed." : "Session introuvable ou fermée.");
          return;
        }

        if (!active) return;

        const nextSessionId = String(session.id);
        const nextSessionCode = formatSessionCode(String(session.session_code ?? cleanCode));

        setSelectedSessionId(nextSessionId);
        setSelectedSessionCode(nextSessionCode);
        setProjectionSessionCode(nextSessionCode);

        await Promise.all([
          refreshSessionMonitoring(nextSessionId, { showLoading: false }),
          loadTransportReportRows(nextSessionId, setTeacherTransportReportRowsDb),
          loadTransportReportableRows(nextSessionId, setTeacherTransportReportableRows),
          loadTeacherDejeunerReportableRows(nextSessionId),
          loadDejeunerReportRows(nextSessionId, setTeacherDejeunerReportRowsDb),
          loadTeacherEquipementReportableRows(nextSessionId),
          loadEquipementReportRows(nextSessionId, setTeacherEquipementReportRowsDb),
          loadTeacherAutresReportableRows(nextSessionId),
          loadAutresReportRows(nextSessionId, setTeacherAutresReportRowsDb),
          loadSalleReportRows(nextSessionId, setTeacherSalleReportRowsDb),
          loadConsolidatedProposals(nextSessionId),
          loadTeacherVoteRows(nextSessionId),
        ]);
      } finally {
        if (active) setProjectionLoading(false);
      }
    }

    void loadProjectionSession();

    return () => {
      active = false;
    };
  }, [screen, projectionSessionCode, lang]);

  useEffect(() => {
    if ((screen as string) !== "projection") return;

    function applyProjectionControl() {
      try {
        const raw = localStorage.getItem(PROJECTION_CONTROL_STORAGE_KEY);
        if (!raw) return;
        const payload = JSON.parse(raw) as { sessionCode?: string; stage?: string };
        const nextStage = String(payload.stage ?? "");
        const nextSessionCode = formatSessionCode(payload.sessionCode ?? "");

        if (["qr", "bilans", "propositions", "vote", "synthese"].includes(nextStage)) {
          setProjectionStage(nextStage as ProjectionStage);
        }

        if (nextSessionCode) {
          setProjectionSessionCode(nextSessionCode);
        }
      } catch {
        // Ignore malformed projection control messages.
      }
    }

    applyProjectionControl();
    window.addEventListener("storage", applyProjectionControl);
    return () => window.removeEventListener("storage", applyProjectionControl);
  }, [screen]);

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

    void refreshSessionMonitoring(selectedSessionId, { showLoading: teacherSessionTab === "counts" });

    // Pas d'actualisation automatique agressive ici : le bouton "Actualiser"
    // permet de recharger les compteurs et le tableau de suivi à la demande.
    // Cela limite fortement la consommation Disk IO Supabase pendant les séances.
    return;
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
    if (screen !== "teacher_dashboard") return;
    if (teacherMenu !== "session_open") return;
    if (!selectedSessionId) return;

    const channel = supabase
      .channel(`teacher-group-proposals-${selectedSessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_proposals",
          filter: `session_id=eq.${selectedSessionId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as Partial<GroupProposalRow> | null;
          const groupNumber = Number(row?.group_number ?? 0);

          if (!Number.isInteger(groupNumber) || groupNumber < 1 || groupNumber > 10) return;

          setTeacherGroupProposals((prev) => ({
            ...prev,
            [groupNumber]:
              payload.eventType === "DELETE"
                ? emptyGroupProposalState()
                : {
                    proposal_1: String(row?.proposal_1 ?? ""),
                    proposal_2: String(row?.proposal_2 ?? ""),
                    proposal_3: String(row?.proposal_3 ?? ""),
                    is_validated: Boolean(row?.is_validated),
                  },
          }));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [screen, selectedSessionId, teacherMenu]);

  useEffect(() => {
    if (screen !== "teacher_dashboard") return;
    if (teacherMenu !== "session_open") return;
    if (!selectedSessionId) return;

    const channel = supabase
      .channel(`teacher-proposal-votes-${selectedSessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "proposal_votes",
          filter: `session_id=eq.${selectedSessionId}`,
        },
        (payload) => {
          const nextRow = payload.new as TeacherVoteRow | null;
          const oldRow = payload.old as TeacherVoteRow | null;
          const sourceRow = nextRow ?? oldRow;

          if (!sourceRow?.proposal_id) {
            void loadTeacherVoteRows(selectedSessionId);
            return;
          }

          setTeacherVoteRows((prev) => {
            const sameVote = (row: TeacherVoteRow) =>
              String(row.proposal_id) === String(sourceRow.proposal_id) &&
              Number(row.rank) === Number(sourceRow.rank) &&
              normalizeEmail(row.student_email ?? "") === normalizeEmail(sourceRow.student_email ?? "");

            if (payload.eventType === "DELETE") {
              return prev.filter((row) => !sameVote(row));
            }

            const cleanNextRow: TeacherVoteRow = {
              proposal_id: String(nextRow?.proposal_id ?? sourceRow.proposal_id),
              rank: Number(nextRow?.rank ?? sourceRow.rank),
              student_email: nextRow?.student_email ?? sourceRow.student_email ?? null,
            };

            return [...prev.filter((row) => !sameVote(row)), cleanNextRow];
          });
        }
      )
      .subscribe();

    void loadTeacherVoteRows(selectedSessionId);

    return () => {
      void supabase.removeChannel(channel);
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

    function applyRealtimeGroupReportPayload(payload: any) {
      const nextRow = payload?.new as GroupReportRow | undefined;
      const oldRow = payload?.old as GroupReportRow | undefined;
      const sourceRow = nextRow ?? oldRow;
      const normalizedTheme = normalizeGroupReportTheme(sourceRow?.theme);

      if (!sourceRow || normalizedTheme !== "transport") {
        reloadChangedTheme(sourceRow?.theme);
        return;
      }

      if (String(sourceRow.session_id) !== selectedSessionId) return;

      if (payload.eventType === "DELETE") {
        setTeacherTransportReportRowsDb((prev) =>
          prev.filter(
            (row) =>
              !(
                String(row.session_id) === selectedSessionId &&
                Number(row.group_number) === Number(sourceRow.group_number) &&
                normalizeGroupReportTheme(row.theme) === "transport" &&
                String(row.row_key) === String(sourceRow.row_key)
              )
          )
        );
        return;
      }

      if (!nextRow) return;

      const normalizedRow = normalizeGroupReportRows([nextRow])[0];

      setTeacherTransportReportRowsDb((prev) => {
        const nextRows = normalizeGroupReportRows(prev);
        const existingIndex = nextRows.findIndex(
          (row) =>
            String(row.session_id) === selectedSessionId &&
            Number(row.group_number) === Number(normalizedRow.group_number) &&
            normalizeGroupReportTheme(row.theme) === "transport" &&
            String(row.row_key) === String(normalizedRow.row_key)
        );

        if (existingIndex >= 0) {
          nextRows[existingIndex] = normalizedRow;
          return nextRows;
        }

        return [...nextRows, normalizedRow];
      });
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
        applyRealtimeGroupReportPayload
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          setMessage("Realtime Supabase indisponible pour group_reports. Vérifiez que la table est activée dans la publication supabase_realtime.");
        }
      });

    window.addEventListener("group_reports_changed_local", handleLocalGroupReportChange as EventListener);
    window.addEventListener("storage", handleStorageGroupReportChange);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("group_reports_changed_local", handleLocalGroupReportChange as EventListener);
      window.removeEventListener("storage", handleStorageGroupReportChange);
    };
  }, [selectedSessionId]);


  useEffect(() => {
    if (screen !== "teacher_dashboard" && screen !== "teacher_session_settings") return;
    if (teacherMenu !== "session_open") return;
    if (!selectedSessionId) return;

    let refreshTimeoutId: number | undefined;

    const scheduleTransportReportableRefresh = () => {
      if (refreshTimeoutId !== undefined) {
        window.clearTimeout(refreshTimeoutId);
      }

      // Rechargement ciblé et débounced : un questionnaire transport peut insérer
      // plusieurs trajets, on évite donc de relire Supabase à chaque ligne reçue.
      refreshTimeoutId = window.setTimeout(() => {
        void loadTransportReportableRows(selectedSessionId, setTeacherTransportReportableRows);
      }, 350);
    };

    const channel = supabase
      .channel(`teacher-responses-transport-${selectedSessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "responses_transport",
          filter: `session_id=eq.${selectedSessionId}`,
        },
        scheduleTransportReportableRefresh
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          setMessage(
            "Realtime Supabase indisponible pour responses_transport. Vérifiez que la table est activée dans la publication supabase_realtime."
          );
        }
      });

    return () => {
      if (refreshTimeoutId !== undefined) {
        window.clearTimeout(refreshTimeoutId);
      }
      void supabase.removeChannel(channel);
    };
  }, [screen, teacherMenu, selectedSessionId]);

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
    if (screen === "student_bilans" || screen === "student_synthese") {
      setScreen("student_mise_en_oeuvre");
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
      "student_vote",
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
    setValidatedRandomAssignments([]);
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
    setIsInitialSessionSetup(false);
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

  setAssignmentMode("groups");
  setSettingsAllowedEmailsText("");
  setAssignmentRawText("");
  setValidatedRandomAssignments([]);
  setQuickSessionCampus("");
  setQuickSessionProgramme("");
  setQuickSessionLevel("");
  setQuickSessionSuffix("");

  await loadTeacherSessions(teacherUserId);
  setIsInitialSessionSetup(true);
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
    // Version 2 : plus de session en liste simple.
    // Si une ancienne session sans assignation est ouverte, elle reste visible,
    // mais il faut enregistrer une assignation prédéfinie ou aléatoire avant usage étudiant.
    setAssignmentMode("groups");
    setAssignmentMethod("import");
    setAssignmentRawText("");
    setSettingsAllowedEmailsText(allowedEmailText);
    setValidatedRandomAssignments([]);
  }


  setIsInitialSessionSetup(false);
  setTeacherMenu("session_open");
  setTeacherSessionTab(draft?.teacherSessionTab ?? "counts");
  setTeacherAnalysesTab(draft?.teacherAnalysesTab ?? "donnees_a_reporter");
  setTeacherShowCarbonChart(false);
  setTeacherGroupNumber(draft?.teacherGroupNumber ?? 1);
  setScreen("teacher_dashboard");
  await loadSessionAnalysisAccess(session.id);
  await loadSessionVoteAccess(session.id);
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
setAssignmentMode("groups");
setAssignmentMethod("import");
setAssignmentRawText("");
      setSettingsAllowedEmailsText("");
      setValidatedRandomAssignments([]);
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

    const firstName = newStudentFirstName.trim();
    const lastName = newStudentLastName.trim();

    if (!firstName || !lastName) {
      setMessage("Ajout impossible : prénom et nom sont obligatoires.");
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

    setAssignmentMethod("import");
    setAssignmentRawText(serializeStudentAssignments(nextAssignments));
    setSettingsAllowedEmailsText(nextAssignments.map((student) => student.email).join("\n"));
    resetNewStudentForm();
    setMessage(`Étudiant ajouté au groupe ${groupNumber}. Pensez à enregistrer les paramètres.`);
  }

  function handleValidateRandomAssignment() {
    const nextAssignments = generateRandomAssignments(settingsAllowedEmailsText);

    if (!nextAssignments.length) {
      setValidatedRandomAssignments([]);
      setAssignmentRawText("");
      setMessage("Aucun étudiant valide à répartir. Format attendu : email;prenom;nom.");
      return;
    }

    setValidatedRandomAssignments(nextAssignments);
    setAssignmentRawText(serializeStudentAssignments(nextAssignments));
    setMessage("Assignation aléatoire validée. Vous pouvez maintenant l'exporter ou l'enregistrer.");
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

const assignmentsToSave = activeStudentAssignments;

if (assignmentsToSave.length === 0) {
  setMessage(
    assignmentMethod === "random"
      ? "Validez d'abord l'assignation aléatoire avant d'enregistrer."
      : "Aucune assignation valide détectée. Vérifiez le format : email;prenom;nom;groupe."
  );
  return;
}

const allowedEmails = assignmentsToSave.map((student) => student.email);

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
  setMessage(`Paramètres enregistrés, mais erreur suppression assignations : ${deleteAssignmentsError.message}`);
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
    setMessage(`Paramètres enregistrés, mais erreur assignations : ${insertAssignmentsError.message}`);
    return;
  }

  setAssignmentMode("groups");
  setAssignmentMethod("import");
  setAssignmentRawText(serializeStudentAssignments(assignmentsToSave));
  setSettingsAllowedEmailsText(assignmentsToSave.map((student) => student.email).join("\n"));

    await loadTeacherSessions(teacherUserId);
    setMessage(`Paramètres enregistrés pour ${formatSessionCode(selectedSessionCode)}`);
    setScreen("teacher_session_settings");
    setTeacherMenu("session_open");
    setIsInitialSessionSetup(false);
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
  const voteUnlockedForStudent = await loadSessionVoteAccess(nextSessionId);
  await loadTeacherGroupProposals(nextSessionId);

  if (initialStudentTarget === "vote") {
    setScreen(voteUnlockedForStudent ? "student_vote" : "student_mise_en_oeuvre");
    if (!voteUnlockedForStudent) {
      setMessage(lang === "en" ? "Vote is not open yet." : "Le vote n'est pas encore ouvert.");
    }
    return;
  }

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

    setStudentSavingQuestionnaire("transport");
    setTransportMessage("Enregistrement en cours...");

    try {
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
    } catch (err) {
      setTransportMessage(err instanceof Error ? err.message : "Erreur réseau pendant l'enregistrement.");
    } finally {
      setStudentSavingQuestionnaire(null);
    }
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

    setStudentSavingQuestionnaire("dejeuner");
    setDejeunerMessage("Enregistrement en cours...");

    try {
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
    } catch (err) {
      setDejeunerMessage(err instanceof Error ? err.message : "Erreur réseau pendant l'enregistrement.");
    } finally {
      setStudentSavingQuestionnaire(null);
    }
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

    setStudentSavingQuestionnaire("equipement");
    setEquipementMessage("Enregistrement en cours...");

    try {
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
    } catch (err) {
      setEquipementMessage(err instanceof Error ? err.message : "Erreur réseau pendant l'enregistrement.");
    } finally {
      setStudentSavingQuestionnaire(null);
    }
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

    setStudentSavingQuestionnaire("autres");
    setAutresMessage("Enregistrement en cours...");

    try {
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
    } catch (err) {
      setAutresMessage(err instanceof Error ? err.message : "Erreur réseau pendant l'enregistrement.");
    } finally {
      setStudentSavingQuestionnaire(null);
    }
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


  function renderMobileNumericReportCards(rows: Array<{
    key: string;
    label: string;
    value: number;
    factor: number;
    category?: string;
  }>, onSaveValue: (row: { key: string; label: string; value: number; factor: number; category?: string }, value: number) => Promise<void> | void, readOnly = false) {
    return (
      <div className="student-mobile-report-cards" style={styles.studentMobileReportCards}>
        {rows.map((row, index) => {
          const total = Number(row.value || 0) * Number(row.factor || 0);
          const showCategory = Boolean(row.category) && (index === 0 || rows[index - 1]?.category !== row.category);

          return (
            <React.Fragment key={row.key}>
              {showCategory ? (
                <div style={styles.studentMobileReportCategory}>{row.category}</div>
              ) : null}

              <div style={styles.studentMobileReportCard}>
                <div style={styles.studentMobileReportLabel}>{row.label}</div>
                <div style={styles.studentMobileReportGrid}>
                  <div style={styles.studentMobileReportFieldLabel}>Quantité</div>
                  <div style={styles.studentMobileReportFieldValue}>
                    {readOnly ? (
                      <span>{formatReportNumber(row.value)}</span>
                    ) : (
                      <DraftNumberInput
                        value={row.value}
                        style={styles.studentMobileReportInput}
                        onCommit={async (value) => {
                          await onSaveValue(row, value);
                        }}
                      />
                    )}
                  </div>
                </div>
                <div style={styles.studentMobileReportMeta}>
                  Facteur : {formatFactorNumber(row.factor)} · Total : {formatReportNumber(total)}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  function renderMobileTransportReportCards(rows: Array<{
    rowKey: string;
    label: string;
    persons: number;
    distanceTotalKm: number;
    factor: number;
  }>, params: {
    sessionId: string;
    groupNumber: number;
    updatedBy: string | null;
    readOnly: boolean;
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
  }) {
    return (
      <div className="student-mobile-report-cards" style={styles.studentMobileReportCards}>
        {rows.map((row) => {
          const total = Number(row.distanceTotalKm || 0) * Number(row.factor || 0);

          return (
            <div key={row.rowKey} style={styles.studentMobileReportCard}>
              <div style={styles.studentMobileReportLabel}>{row.label}</div>
              <div style={styles.studentMobileTransportGrid}>
                <div style={styles.studentMobileReportFieldLabel}>Personnes</div>
                <div style={styles.studentMobileReportFieldLabel}>Distance</div>
                <div style={styles.studentMobileReportFieldValue}>
                  {params.readOnly ? (
                    <span>{formatReportNumber(row.persons)}</span>
                  ) : (
                    <DraftNumberInput
                      value={row.persons}
                      style={styles.studentMobileReportInput}
                      onCommit={async (value) => {
                        await params.onSave?.({
                          sessionId: params.sessionId,
                          groupNumber: params.groupNumber,
                          rowKey: row.rowKey,
                          label: row.label,
                          persons: value,
                          distanceTotalKm: row.distanceTotalKm,
                          factor: row.factor,
                          updatedBy: params.updatedBy,
                        });
                      }}
                    />
                  )}
                </div>
                <div style={styles.studentMobileReportFieldValue}>
                  {params.readOnly ? (
                    <span>{formatReportNumber(row.distanceTotalKm)}</span>
                  ) : (
                    <DraftNumberInput
                      value={row.distanceTotalKm}
                      style={styles.studentMobileReportInput}
                      onCommit={async (value) => {
                        await params.onSave?.({
                          sessionId: params.sessionId,
                          groupNumber: params.groupNumber,
                          rowKey: row.rowKey,
                          label: row.label,
                          persons: row.persons,
                          distanceTotalKm: value,
                          factor: row.factor,
                          updatedBy: params.updatedBy,
                        });
                      }}
                    />
                  )}
                </div>
              </div>
              <div style={styles.studentMobileReportMeta}>
                Facteur : {formatFactorNumber(row.factor)} · Total : {formatReportNumber(total)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderTransportReportableBlock(rows: ReportableRow[], emptyText: string) {
    return (<Translated>{(
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
    )}</Translated>);
  }


function renderDejeunerReportableBlock(rows: DejeunerReportableRowRpc[], emptyText: string) {
  const positiveRows = rows.filter((row) => Number(row.quantity ?? 0) > 0);

  const quantityByLabel = positiveRows.reduce<Record<string, number>>((acc, row) => {
    const label = normalizeDejeunerLookupValue(row.label);
    if (!label) return acc;

    acc[label] = (acc[label] ?? 0) + Number(row.quantity ?? 0);
    return acc;
  }, {});

  const quantityByKey = positiveRows.reduce<Record<string, number>>((acc, row) => {
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

  const visibleSections = DEJEUNER_REPORT_STRUCTURE.map((section) => ({
    ...section,
    groups: section.groups
      .map((group) => ({
        ...group,
        items: group.items
          .map((item) => ({ ...item, quantity: getQuantity(item) }))
          .filter((item) => Number(item.quantity ?? 0) > 0),
      }))
      .filter((group) => group.items.length > 0),
  })).filter((section) => section.groups.length > 0);

  return (<Translated>{(
    <div style={styles.innerCardFull}>
      <h3 style={styles.innerTitle}>Données à reporter</h3>

      {!visibleSections.length ? (
        <div style={styles.infoMessage}>{emptyText}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 18 }}>
          {visibleSections.map((section) => (
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
                            {formatReportNumber(item.quantity, 0)}
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
  )}</Translated>);
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

  return (<Translated>{(
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
  )}</Translated>);
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

  return (<Translated>{(
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

      {isStudentMobileMain ? (
        renderMobileNumericReportCards(
          orderedRows.map((row) => ({
            key: row.rowKey,
            label: row.label,
            value: Number(row.quantity || 0),
            factor: Number(row.factor || 0),
            category: row.category === "Équipements utilisés" ? "Matériel" : row.category,
          })),
          async (row, value) => {
            await onSave?.({
              sessionId,
              groupNumber,
              rowKey: row.key,
              label: row.label,
              quantity: value,
              factor: row.factor,
              updatedBy,
            });
          },
          readOnly
        )
      ) : (
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
      )}
    </div>
  )}</Translated>);
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

  return (<Translated>{(
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

      {isStudentMobileMain ? (
        renderMobileNumericReportCards(
          orderedRows.map(({ section, subcategory, row }) => ({
            key: row.rowKey,
            label: row.label,
            value: Number(row.quantity || 0),
            factor: Number(row.factor || 0),
            category: `${section} · ${subcategory}`,
          })),
          async (row, value) => {
            await onSave?.({
              sessionId,
              groupNumber,
              rowKey: row.key,
              label: row.label,
              quantity: value,
              factor: row.factor,
              updatedBy,
            });
          },
          readOnly
        )
      ) : (
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
      )}
    </div>
  )}</Translated>);
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

  return (<Translated>{(
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
  )}</Translated>);
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

  return (<Translated>{(
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

      {isStudentMobileMain ? (
        renderMobileNumericReportCards(
          orderedRows.map((row) => ({
            key: row.rowKey,
            label: row.label,
            value: Number(row.quantity || 0),
            factor: Number(row.factor || 0),
            category: row.category,
          })),
          async (row, value) => {
            await onSave?.({
              sessionId,
              groupNumber,
              rowKey: row.key,
              label: row.label,
              quantity: value,
              factor: row.factor,
              updatedBy,
            });
          },
          readOnly
        )
      ) : (
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
      )}
    </div>
  )}</Translated>);
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

  return (<Translated>{(
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

      {isStudentMobileMain ? (
        renderMobileTransportReportCards(rows, {
          sessionId,
          groupNumber,
          updatedBy,
          readOnly,
          onSave,
        })
      ) : (
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
      )}
    </div>
  )}</Translated>);
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

  return (<Translated>{(
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

      {isStudentMobileMain ? (
        <div className="student-mobile-report-cards" style={styles.studentMobileReportCards}>
          {rows.map((row) => {
            const total = Number(row.quantity || 0) * Number(row.factor || 0);

            return (
              <div key={row.rowKey} style={styles.studentMobileReportCard}>
                <div style={styles.studentMobileReportLabel}>{row.label}</div>
                <div style={styles.studentMobileReportGrid}>
                  <div style={styles.studentMobileReportFieldLabel}>Quantité</div>
                  <div style={styles.studentMobileReportFieldValue}>
                    {readOnly ? (
                      row.rowKey === "chauffage" || row.rowKey === "climatisation" ? (
                        <span>{Number(row.quantity || 0) > 0 ? "Oui" : "Non"}</span>
                      ) : (
                        <span>{formatReportNumber(row.quantity)}</span>
                      )
                    ) : row.rowKey === "chauffage" || row.rowKey === "climatisation" ? (
                      <select
                        value={Number(row.quantity || 0) > 0 ? 1 : 0}
                        style={styles.studentMobileReportInput}
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
                        style={styles.studentMobileReportInput}
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
                  </div>
                </div>
                <div style={styles.studentMobileReportMeta}>
                  Facteur : {formatFactorNumber(row.factor)} · Total : {formatReportNumber(total)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
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
      )}
    </div>
  )}</Translated>);
}


  const projectionThemeDetails = useMemo(() => {
    const preferredOrder = ["transport", "dejeuner", "equipement", "autres_consommations", "salle"];
    const themeMap = new Map<string, {
      theme: string;
      label: string;
      total: number;
      activeGroups: Set<number>;
      rows: Map<string, { rowKey: string; label: string; total: number }>;
    }>();

    teacherSyntheseSourceRows.forEach((row) => {
      const theme = normalizeGroupReportTheme(row.theme);
      if (!theme) return;

      if (!themeMap.has(theme)) {
        themeMap.set(theme, {
          theme,
          label: getSyntheseThemeLabel(theme),
          total: 0,
          activeGroups: new Set<number>(),
          rows: new Map<string, { rowKey: string; label: string; total: number }>(),
        });
      }

      const currentTheme = themeMap.get(theme)!;
      const quantity = Number(row.quantity ?? 0);
      const factor = Number(row.factor ?? 0);
      const total = quantity * factor;
      const groupNumber = Number(row.group_number ?? 0);
      const rowKey = String(row.row_key ?? row.label ?? "");
      const label = String(row.label ?? rowKey);

      if (total > 0 && Number.isFinite(groupNumber) && groupNumber > 0) {
        currentTheme.activeGroups.add(groupNumber);
      }

      currentTheme.total += Number.isFinite(total) ? total : 0;

      if (!currentTheme.rows.has(rowKey)) {
        currentTheme.rows.set(rowKey, { rowKey, label, total: 0 });
      }
      currentTheme.rows.get(rowKey)!.total += Number.isFinite(total) ? total : 0;
    });

    return Array.from(themeMap.values())
      .map((theme) => {
        const divisor = Math.max(theme.activeGroups.size, 1);
        const rows = Array.from(theme.rows.values())
          .filter((row) => row.total > 0)
          .map((row) => ({ ...row, average: row.total / divisor }))
          .sort((a, b) => b.average - a.average);

        return {
          theme: theme.theme,
          label: theme.label,
          total: theme.total,
          activeGroups: theme.activeGroups.size,
          average: theme.total / divisor,
          rows,
        };
      })
      .filter((theme) => theme.average > 0 || theme.rows.length > 0)
      .sort((a, b) => {
        const ia = preferredOrder.indexOf(a.theme);
        const ib = preferredOrder.indexOf(b.theme);
        if (ia === -1 && ib === -1) return a.label.localeCompare(b.label);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
  }, [teacherSyntheseSourceRows]);


  if (screen === "student_mise_en_oeuvre") {
    return (<Translated>{(
      <div style={styles.appShell} className="student-responsive-shell">
        <StudentSidebar
          lang={lang}
          setLang={setLang}
          active="mise_en_oeuvre"
          onGo={goToScreen}
          analysisUnlocked={studentAnalysisUnlocked}
          onBeforeOpenAnalysis={refreshStudentAnalysisData}
          sessionCode={studentSelectedSessionCode}
          sessionId={studentSelectedSessionId}
          voteUnlocked={studentVoteUnlocked}
onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
        />
        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
<div style={styles.topHeader}>
  <div style={styles.topHeaderTitle}>{t(lang, "appTitleUpper")}</div>
  <div style={styles.topHeaderSub}>
    {t(lang, "developedBy")}
  </div>
</div>
          </header>
          <section style={styles.bigPanel}>
            <h2 style={styles.panelTitle}>{t(lang, "studentImplementationTitle")}</h2>
<div style={styles.infoCard}>
  <div style={styles.sectionIconWrap}>
    <span style={styles.sectionIcon}>📊</span>
  </div>
  <p style={styles.infoCardText}>
    {t(lang, "implementationInfo1")}
  </p>
</div>

<div style={styles.infoCard}>
  <div style={styles.sectionIconWrap}>
    <span style={styles.sectionIcon}>👥</span>
  </div>
  <p style={styles.infoCardText}>
    {t(lang, "implementationInfo2")}
  </p>
</div>

<div style={styles.infoCard}>
  <div style={styles.sectionIconWrap}>
    <span style={styles.sectionIcon}>💡</span>
  </div>
  <p style={styles.infoCardText}>
    {t(lang, "implementationInfo3")}
  </p>
</div>

<div style={styles.infoCard}>
  <div style={styles.sectionIconWrap}>
    <span style={styles.sectionIcon}>🗳️</span>
  </div>
  <p style={styles.infoCardText}>
    {t(lang, "implementationInfo4")}
  </p>
</div>

<div style={styles.infoCard}>
  <div style={styles.sectionIconWrap}>
    <span style={styles.sectionIcon}>📈</span>
  </div>
  <p style={styles.infoCardText}>
    {t(lang, "implementationInfo5")}
  </p>
</div>
            <div style={styles.row}>
              <button style={styles.primaryButton} onClick={() => goToScreen("student_transport")}>
                {t(lang, "startDataCollection")}
              </button>
            </div>
          </section>
        </main>
      </div>
    )}</Translated>);
  }



  function openProjectionStage(stage: ProjectionStage) {
    setProjectionStage(stage);
    const cleanCode = formatSessionCode(selectedSessionCode || projectionSessionCode || initialUrlSessionCode);
    if (!cleanCode) {
      setMessage(lang === "en" ? "Open a session before using projection." : "Ouvrez une session avant d'utiliser la projection.");
      return;
    }

    try {
      localStorage.setItem(
        PROJECTION_CONTROL_STORAGE_KEY,
        JSON.stringify({ sessionCode: cleanCode, stage, updatedAt: Date.now() })
      );
    } catch {
      // Projection still works by URL navigation if localStorage is unavailable.
    }

    window.open(buildProjectionUrl(cleanCode, stage), "bilan_carbone_projection");
  }

  function getProjectionMenuButtonStyle(stage: ProjectionStage) {
    return projectionStage === stage ? styles.sidebarButtonActive : styles.sidebarButton;
  }

  function getProjectionSectionTitleStyle() {
    return styles.sidebarSectionTitle;
  }

  function getSessionSectionTitleStyle() {
    return styles.sidebarSectionTitle;
  }

  function getMonitoringSectionTitleStyle() {
    return styles.sidebarSectionTitle;
  }

  function getDebriefSectionTitleStyle() {
    return styles.sidebarSectionTitle;
  }

if ((screen as string) === "projection") {
  const activeSessionCode = formatSessionCode(selectedSessionCode || projectionSessionCode || initialUrlSessionCode);
  const studentJoinUrl = buildStudentJoinUrl(activeSessionCode);

  return (<Translated>{(
    <div style={styles.projectionPage}>
      <header style={styles.projectionHeaderClean}>
        <h1 style={styles.projectionTitleClean}>{t(lang, "appTitleUpper")}</h1>
      </header>

      {projectionLoading ? (
        <div style={styles.projectionCard}>
          <LoadingSpinner tone="dark" label={lang === "en" ? "Loading projection..." : "Chargement de la projection..."} />
        </div>
      ) : message ? (
        <div style={styles.projectionCard}>
          <p style={styles.bodyText}>{message}</p>
        </div>
      ) : null}

      {projectionStage === "qr" && (
        <section style={styles.projectionQrStage}>
          <div style={styles.projectionQrMainCard}>
            <h2 style={styles.projectionQrTitle}>{lang === "en" ? "Join the activity" : "Rejoindre l’activité"}</h2>
            <p style={styles.projectionQrInstruction}>
              {lang === "en"
                ? "Scan the QR code, then enter your email address. The session code is already filled in."
                : "Scannez le QR code, puis renseignez votre adresse mail. Le code session sera déjà rempli."}
            </p>
            <div style={styles.projectionQrCode}>{activeSessionCode}</div>
            <p style={styles.projectionQrSmallText}>
              {lang === "en"
                ? "On a computer, use the LMS link and enter the code above."
                : "Sur ordinateur, utilisez le lien LMS et saisissez le code ci-dessus."}
            </p>
          </div>

          <div style={styles.projectionQrCanvasCard}>
            <h2 style={styles.projectionQrSideTitle}>{lang === "en" ? "Student access" : "Accès étudiant"}</h2>
            <div style={styles.projectionQrCanvasWrap}>
              <QRCodeCanvas value={studentJoinUrl} size={280} includeMargin level="M" />
            </div>
            <div style={styles.projectionQrSideCode}>{activeSessionCode}</div>
          </div>
        </section>
      )}

      {projectionStage === "bilans" && (
        <section style={styles.projectionSectionClean}>
          <h2 style={styles.projectionSectionTitle}>{lang === "en" ? "Thematic carbon reports" : "Bilans carbone thématiques"}</h2>
          {projectionThemeDetails.length === 0 ? (
            <div style={styles.projectionCard}><p style={styles.bodyText}>{lang === "en" ? "No data available yet." : "Aucune donnée disponible pour le moment."}</p></div>
          ) : (
            <div style={styles.projectionThemeGrid}>
              {projectionThemeDetails.map((theme, themeIndex) => {
                const maxAverage = Math.max(...theme.rows.map((row) => row.average), 0);
                return (
                  <article key={theme.theme} style={styles.projectionThemeCard}>
                    <div style={styles.projectionThemeHeader}>
                      <div>
                        <h3 style={styles.projectionThemeTitle}>{theme.label}</h3>
                        <div style={styles.projectionThemeMeta}>
                          {theme.activeGroups || 0} {lang === "en" ? "group(s)" : "groupe(s)"}
                        </div>
                      </div>
                      <div style={styles.projectionThemeTotal}>
                        {formatInteger(Math.round(theme.average))}
                        <span style={styles.projectionThemeUnit}> gCO2</span>
                      </div>
                    </div>

                    <div style={styles.projectionThemeRows}>
                      {theme.rows.slice(0, 8).map((row, rowIndex) => {
                        const width = maxAverage > 0 ? `${Math.max((row.average / maxAverage) * 100, 4)}%` : "0%";
                        return (
                          <div key={row.rowKey} style={styles.projectionThemeRow}>
                            <div style={styles.projectionThemeRowTop}>
                              <span>{row.label}</span>
                              <strong>{formatInteger(Math.round(row.average))}</strong>
                            </div>
                            <div style={styles.projectionThemeBarTrack}>
                              <div
                                style={{
                                  ...styles.projectionThemeBarFill,
                                  width,
                                  background: CHART_COLORS[(themeIndex + rowIndex) % CHART_COLORS.length],
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {projectionStage === "propositions" && (
        <section style={styles.projectionSectionClean}>
          <div style={styles.projectionProposalStageWrap}>
            <div style={styles.projectionProposalHeaderRow}>
              <h2 style={{ ...styles.projectionSectionTitle, textAlign: "left" }}>{lang === "en" ? "Proposals submitted to vote" : "Propositions soumises au vote"}</h2>
              <div style={styles.projectionProposalVoteQrCard}>
                <div style={styles.projectionProposalVoteQrTextWrap}>
                  <h3 style={styles.projectionProposalVoteQrTitle}>{lang === "en" ? "Vote QR code" : "QR code de vote"}</h3>
                  <p style={styles.projectionProposalVoteQrText}>
                    {lang === "en"
                      ? "Scan to access the vote directly after entering the student email address."
                      : "Scannez pour accéder directement au vote après saisie de l’adresse e-mail étudiante."}
                  </p>
                  <div style={styles.projectionProposalVoteQrCode}>{activeSessionCode}</div>
                </div>
                <div style={styles.projectionProposalVoteQrBox}>
                  <QRCodeCanvas value={buildStudentJoinUrl(activeSessionCode, "vote")} size={118} includeMargin level="M" />
                </div>
              </div>
            </div>

            {!consolidatedProposals.length ? (
              <div style={styles.projectionCard}><p style={styles.bodyText}>{lang === "en" ? "No proposal has been submitted yet." : "Aucune proposition n’a encore été soumise au vote."}</p></div>
            ) : (
              <div style={styles.projectionProposalGrid}>
                {consolidatedProposals.map((proposal, index) => (
                  <div key={proposal.id || index} style={styles.projectionProposalCard}>
                    <div style={styles.projectionProposalNumber}>{index + 1}</div>
                    <div style={styles.projectionProposalText}>{proposal.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {projectionStage === "vote" && (
        <section style={styles.projectionSectionClean}>
          <h2 style={styles.projectionSectionTitle}>{lang === "en" ? "Vote results" : "Résultats des votes"}</h2>
          {teacherVoteResults.every((item) => item.totalVotes === 0) ? (
            <div style={styles.projectionCard}><p style={styles.bodyText}>{lang === "en" ? "No vote has been recorded yet." : "Aucun vote enregistré pour le moment."}</p></div>
          ) : (
            <div style={styles.projectionVotePodium}>
              {teacherVoteResults.slice(0, 3).map((row, index) => (
                <div key={row.proposalId} style={styles.projectionVoteCard}>
                  <div style={styles.projectionVoteRank}>{index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}</div>
                  <div style={styles.projectionVoteText}>{row.text}</div>
                  <div style={styles.projectionVoteScore}>{getVoteScorePercent(row.score)} %</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {projectionStage === "synthese" && (
        <section style={styles.projectionSectionClean}>
          <h2 style={styles.projectionSectionTitle}>{lang === "en" ? "Final synthesis" : "Synthèse finale"}</h2>
          {teacherSyntheseData.length === 0 ? (
            <div style={styles.projectionCard}><p style={styles.bodyText}>{lang === "en" ? "No data available yet." : "Aucune donnée disponible pour la synthèse."}</p></div>
          ) : (
            <div style={styles.projectionDashboardWrap}>{renderSyntheseDashboard(teacherSyntheseData)}</div>
          )}
        </section>
      )}
    </div>
  )}</Translated>);
}

if (screen === "home") {
  return (<Translated>{(
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

            <h1 style={styles.landingTitle}>{t(lang, "appTitle")}</h1>

            <p style={styles.landingIntro}>
              {t(lang, "chooseProfile")}
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
    {t(lang, "student")}
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
    {t(lang, "teacher")}
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
    {t(lang, "admin")}
  </button>
</div>

          </div>
          <div style={styles.landingLanguageDock}>
            <LanguageToggle lang={lang} setLang={setLang} />
          </div>
        </div>
      </div>
    </div>
  )}</Translated>);
}

if (screen === "teacher_login") {
  return (<Translated>{(
    <div style={styles.authPage}>
      <div style={styles.authCard}>
        <img src={kedgeLogo} alt="KEDGE Business School" style={styles.authLogo} />

        <h1 style={styles.authTitle}>
          {authPortal === "admin" ? t(lang, "adminLogin") : t(lang, "teacherLogin")}
        </h1>

        <button
          type="button"
          style={styles.privacyButton}
          onClick={() => setPrivacyModalAudience("teacher")}
        >
          {t(lang, "privacyButton")}
        </button>

<form
  onSubmit={(e) => {
    e.preventDefault();
    void handleTeacherLogin();
  }}
>
  <div style={styles.formGroup}>
    <input
      style={styles.input}
      placeholder={t(lang, "emailAddress")}
      value={teacherEmail}
      onChange={(e) => setTeacherEmail(e.target.value)}
    />
    <input
      style={styles.input}
      type="password"
      placeholder={t(lang, "password")}
      value={teacherPassword}
      onChange={(e) => setTeacherPassword(e.target.value)}
    />
  </div>

  <div style={styles.formActions}>
    <button type="submit" style={styles.primaryButton}>
      {t(lang, "signIn")}
    </button>
    <button
      type="button"
      style={styles.secondaryButton}
      onClick={() => setScreen("home")}
    >
      {t(lang, "back")}
    </button>
  </div>
</form>
        {!!message && <div style={styles.infoMessage}>{message}</div>}

        <div style={styles.authLanguageDock}>
          <LanguageToggle lang={lang} setLang={setLang} />
        </div>
      </div>
      {privacyModalAudience && (
        <PrivacyModal
          lang={lang}
          audience={privacyModalAudience}
          onClose={() => setPrivacyModalAudience(null)}
        />
      )}
    </div>
  )}</Translated>);
}

if (screen === "student_login") {
  return (<Translated>{(
    <div style={styles.authPage} className="student-responsive-auth">
      <div style={styles.authCard}>
        <img src={kedgeLogo} alt="KEDGE Business School" style={styles.authLogo} />

        <h1 style={styles.authTitle}>{t(lang, "studentLogin")}</h1>

        <button
          type="button"
          style={styles.privacyButton}
          onClick={() => setPrivacyModalAudience("student")}
        >
          {t(lang, "privacyButton")}
        </button>

        <div style={styles.column}>
          <input
            style={styles.input}
            placeholder={t(lang, "emailAddress")}
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder={t(lang, "sessionCode")}
            value={studentCodeSession}
            onChange={(e) => setStudentCodeSession(e.target.value)}
          />
        </div>

        <div style={styles.row}>
          <button style={styles.primaryButton} onClick={handleStudentEnter}>
            {t(lang, "enter")}
          </button>
          <button style={styles.secondaryButton} onClick={() => setScreen("home")}>
            {t(lang, "back")}
          </button>
        </div>

        {!!message && <div style={styles.infoMessage}>{message}</div>}

        <div style={styles.authLanguageDock}>
          <LanguageToggle lang={lang} setLang={setLang} />
        </div>
      </div>
      {privacyModalAudience && (
        <PrivacyModal
          lang={lang}
          audience={privacyModalAudience}
          onClose={() => setPrivacyModalAudience(null)}
        />
      )}
    </div>
  )}</Translated>);
}

  if (screen === "student_transport") {
    return (<Translated>{(
      <div style={styles.appShell} className="student-responsive-shell">
        <StudentSidebar
          lang={lang}
          setLang={setLang}
          active="collecte"
          onGo={goToScreen}
          analysisUnlocked={studentAnalysisUnlocked}
          onBeforeOpenAnalysis={refreshStudentAnalysisData}
          sessionCode={studentSelectedSessionCode}
          sessionId={studentSelectedSessionId}
          voteUnlocked={studentVoteUnlocked}
onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
        />
        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
<div style={styles.topHeader}>
  <div style={styles.topHeaderTitle}>{t(lang, "appTitleUpper")}</div>
  <div style={styles.topHeaderSub}>
    {t(lang, "developedBy")}
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
                lang={lang}
              />
            </div>
            <div style={{ ...styles.homeCard, width: "100%", padding: 0, background: "transparent", boxShadow: "none" }}>
              <div style={styles.subtleText} className="student-session-meta">Mail : {studentEmail}</div>
              <div style={styles.subtleText} className="student-session-meta">
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
                  disabled={studentCompletion.transport || studentSavingQuestionnaire === "transport"}
                >
                  {studentSavingQuestionnaire === "transport" ? (
                    <LoadingSpinner label={lang === "en" ? "Saving..." : "Enregistrement..."} />
                  ) : studentCompletion.transport ? "Transport validé ✓" : "Valider transport"}
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
    )}</Translated>);
  }

  if (screen === "student_dejeuner") {
    return (<Translated>{(
      <div style={styles.appShell} className="student-responsive-shell">
        <StudentSidebar
          lang={lang}
          setLang={setLang}
          active="collecte"
          onGo={goToScreen}
         analysisUnlocked={studentAnalysisUnlocked}
         onBeforeOpenAnalysis={refreshStudentAnalysisData}
         sessionCode={studentSelectedSessionCode}
         sessionId={studentSelectedSessionId}
         voteUnlocked={studentVoteUnlocked}
onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
        />
        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
            <div style={styles.topHeaderTitle}>{t(lang, "appTitleUpper")}</div>
            <div style={styles.topHeaderSub}>
              {t(lang, "developedBy")}
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
                lang={lang}
              />
            </div>
            <div style={{ ...styles.homeCard, width: "100%", padding: 0, background: "transparent", boxShadow: "none" }}>
              <div style={styles.subtleText} className="student-session-meta">Mail : {studentEmail}</div>
              <div style={styles.subtleText} className="student-session-meta">
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
  disabled={studentCompletion.dejeuner || studentSavingQuestionnaire === "dejeuner"}
>
  {studentSavingQuestionnaire === "dejeuner" ? (
    <LoadingSpinner label={lang === "en" ? "Saving..." : "Enregistrement..."} />
  ) : studentCompletion.dejeuner ? "Déjeuner validé ✓" : "Valider déjeuner"}
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
    )}</Translated>);
  }

  if (screen === "student_equipement") {
    return (<Translated>{(
      <div style={styles.appShell} className="student-responsive-shell">
<StudentSidebar
          lang={lang}
          setLang={setLang}
  active="collecte"
  onGo={goToScreen}
  analysisUnlocked={studentAnalysisUnlocked}
  onBeforeOpenAnalysis={refreshStudentAnalysisData}
  sessionCode={studentSelectedSessionCode}
  sessionId={studentSelectedSessionId}
  voteUnlocked={studentVoteUnlocked}
onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
/>

        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
            <div style={styles.topHeaderTitle}>{t(lang, "appTitleUpper")}</div>
            <div style={styles.topHeaderSub}>
              {t(lang, "developedBy")}
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
                lang={lang}
              />
            </div>

            <div style={{ ...styles.homeCard, width: "100%", padding: 0, background: "transparent", boxShadow: "none" }}>
              <div style={styles.subtleText} className="student-session-meta">Mail : {studentEmail}</div>
              <div style={styles.subtleText} className="student-session-meta">
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
  disabled={studentCompletion.equipement || studentSavingQuestionnaire === "equipement"}
>
  {studentSavingQuestionnaire === "equipement" ? (
    <LoadingSpinner label={lang === "en" ? "Saving..." : "Enregistrement..."} />
  ) : studentCompletion.equipement ? "Équipement validé ✓" : "Valider équipement"}
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
    )}</Translated>);
  }

  if (screen === "student_autres") {
    return (<Translated>{(
      <div style={styles.appShell} className="student-responsive-shell">
<StudentSidebar
          lang={lang}
          setLang={setLang}
  active="collecte"
  onGo={goToScreen}
  analysisUnlocked={studentAnalysisUnlocked}
  onBeforeOpenAnalysis={refreshStudentAnalysisData}
  sessionCode={studentSelectedSessionCode}
  sessionId={studentSelectedSessionId}
  voteUnlocked={studentVoteUnlocked}
onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
/>

        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
            <div style={styles.topHeaderTitle}>{t(lang, "appTitleUpper")}</div>
            <div style={styles.topHeaderSub}>
              {t(lang, "developedBy")}
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
                lang={lang}
              />
            </div>

            <div style={{ ...styles.homeCard, width: "100%", padding: 0, background: "transparent", boxShadow: "none" }}>
              <div style={styles.subtleText} className="student-session-meta">Mail : {studentEmail}</div>
              <div style={styles.subtleText} className="student-session-meta">
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
                  disabled={studentCompletion.autres || studentSavingQuestionnaire === "autres"}
                >
                  {studentSavingQuestionnaire === "autres" ? (
                    <LoadingSpinner label={lang === "en" ? "Saving..." : "Enregistrement..."} />
                  ) : studentCompletion.autres ? "Autres consommations validé ✓" : "Valider autres consommations"}
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
    )}</Translated>);
  }

  if (screen === ("admin_dashboard" as Screen)) {
    return (<Translated>{(
      <div style={styles.appShell} className="admin-responsive-shell">
        <aside style={styles.sidebar}>
          <div style={styles.sidebarBrand}>
            <img src={kedgeLogo} alt="KEDGE Business School" style={styles.sidebarLogo} />
          </div>

          <button
            style={adminTab === "teachers" ? styles.sidebarButtonActive : styles.sidebarButton}
            onClick={() => setAdminTab("teachers")}
          >
            {t(lang, "teachers")}
          </button>

          <button
            style={adminTab === "sessions" ? styles.sidebarButtonActive : styles.sidebarButton}
            onClick={() => setAdminTab("sessions")}
          >
            {t(lang, "sessions")}
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
            {t(lang, "teacherAccess")}
          </button>

          <div style={styles.sidebarFooter}>
            <LanguageToggle lang={lang} setLang={setLang} compact />
            <button style={styles.sidebarSmallButton} onClick={handleTeacherLogout}>
              {t(lang, "logout")}
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
    )}</Translated>);
  }

  if (screen === "teacher_session_settings") {
    return (<Translated>{(
      <div style={styles.appShell} className="teacher-responsive-shell">
        <aside style={styles.sidebar} className="teacher-sidebar-organized">
          <style>{TEACHER_SIDEBAR_CSS}</style>
          <div style={styles.sidebarBrand}>
            <img src={kedgeLogo} alt="KEDGE Business School" style={styles.sidebarLogo} />
          </div>

          <div style={styles.teacherSidebarContext} className="teacher-session-context">
            <div style={styles.teacherSidebarContextLabel}>{lang === "en" ? "Active session" : "Session active"}</div>
            <div style={styles.teacherSidebarCode}>{formatSessionCode(selectedSessionCode || settingsTitle)}</div>
          </div>

          <details className="teacher-sidebar-section" style={styles.sidebarSection}>
            <summary style={getMonitoringSectionTitleStyle()}><span className="teacher-sidebar-chevron" style={styles.sidebarChevron}>›</span><span style={styles.sidebarSectionIcon}>🟢</span><span>{lang === "en" ? "LIVE COLLECTION" : "COLLECTE EN DIRECT"}</span></summary>
            <button
              style={styles.sidebarButton}
              onClick={() => {
                setScreen("teacher_dashboard");
                setTeacherMenu("session_open");
                setTeacherSessionTab("counts");
              }}
            >
              📊 {lang === "en" ? "Responses" : "Réponses"}
            </button>
            <button
              style={styles.sidebarButton}
              onClick={() => {
                setScreen("teacher_dashboard");
                setTeacherMenu("session_open");
                setTeacherSessionTab("users");
              }}
            >
              👥 {lang === "en" ? "Students" : "Étudiants"}
            </button>
          </details>

          <details className="teacher-sidebar-section" open style={styles.sidebarSection}>
            <summary style={styles.sidebarSectionTitle}><span className="teacher-sidebar-chevron" style={styles.sidebarChevron}>›</span><span style={styles.sidebarSectionIcon}>🔓</span><span>{lang === "en" ? "STUDENT ACCESS" : "ACCÈS ÉTUDIANTS"}</span></summary>
            <button type="button" style={studentAnalysisUnlocked ? styles.teacherAccessToggleOn : styles.teacherAccessToggleOff} onClick={toggleStudentAnalysisAccess}>{studentAnalysisUnlocked ? "🔓" : "🔒"} {t(lang, "analyses")}</button>
            <button type="button" style={studentVoteUnlocked ? styles.teacherAccessToggleOn : styles.teacherAccessToggleOff} onClick={toggleStudentVoteAccess}>{studentVoteUnlocked ? "🔓" : "🔒"} {t(lang, "vote")}</button>
          </details>

          <details className="teacher-sidebar-section" style={styles.sidebarSection}>
            <summary style={getDebriefSectionTitleStyle()}><span className="teacher-sidebar-chevron" style={styles.sidebarChevron}>›</span><span style={styles.sidebarSectionIcon}>🎬</span><span>{lang === "en" ? "ACTIVITY MONITORING" : "SUIVI DE L’ACTIVITÉ"}</span></summary>
            <button style={styles.sidebarButton} onClick={() => { setScreen("teacher_dashboard"); setTeacherMenu("session_open"); setTeacherSessionTab("analyses"); }}>📑 {t(lang, "analyses")}</button>
            <button style={styles.sidebarButton} onClick={() => { setScreen("teacher_dashboard"); setTeacherMenu("session_open"); setTeacherSessionTab("vote"); }}>🗳️ {t(lang, "vote")}</button>
            <button style={styles.sidebarButton} onClick={() => { setScreen("teacher_dashboard"); setTeacherMenu("session_open"); setTeacherSessionTab("synthese"); }}>🧩 {t(lang, "synthese")}</button>
          </details>

          <details className="teacher-sidebar-section" style={styles.sidebarSection}>
            <summary style={getProjectionSectionTitleStyle()}><span className="teacher-sidebar-chevron" style={styles.sidebarChevron}>›</span><span style={styles.sidebarSectionIcon}>🖥️</span><span>{lang === "en" ? "PROJECTION" : "PROJECTION"}</span></summary>
            <button style={getProjectionMenuButtonStyle("qr")} onClick={() => openProjectionStage("qr")}>📱 {t(lang, "projectionQr")}</button>
            <button style={getProjectionMenuButtonStyle("bilans")} onClick={() => openProjectionStage("bilans")}>📊 {t(lang, "projectionBilans")}</button>
            <button style={getProjectionMenuButtonStyle("propositions")} onClick={() => openProjectionStage("propositions")}>💡 {t(lang, "projectionProposals")}</button>
            <button style={getProjectionMenuButtonStyle("vote")} onClick={() => openProjectionStage("vote")}>🗳️ {t(lang, "projectionVote")}</button>
            <button style={getProjectionMenuButtonStyle("synthese")} onClick={() => openProjectionStage("synthese")}>🧩 {t(lang, "projectionSynthesis")}</button>
          </details>

          <details className="teacher-sidebar-section" open style={styles.sidebarSection}>
            <summary style={getSessionSectionTitleStyle()}><span className="teacher-sidebar-chevron" style={styles.sidebarChevron}>›</span><span style={styles.sidebarSectionIcon}>⚙️</span><span>{lang === "en" ? "SESSION" : "SESSION"}</span></summary>
            <button style={styles.sidebarButtonActive}>🛠️ {lang === "en" ? "Session settings" : "Gestion de la session"}</button>
            <button
              style={styles.sidebarButton}
              onClick={() => {
                setMessage("");
                setTeacherMenu("sessions");
                setIsInitialSessionSetup(true);
                setScreen("teacher_dashboard");
              }}
            >
              ➕ {lang === "en" ? "New session" : "Nouvelle session"}
            </button>
            <button style={styles.sidebarButton} onClick={() => { setTeacherMenu("sessions"); setIsInitialSessionSetup(false); setScreen("teacher_dashboard"); }}>📂 {lang === "en" ? "Other sessions" : "Autres sessions"}</button>
          </details>

          <div style={styles.sidebarFooter}>
            <LanguageToggle lang={lang} setLang={setLang} compact />
            {currentUserRole === "admin" && (
              <button style={styles.sidebarSmallButton} onClick={() => void handleGoToAdminFromTeacher()}>
                {t(lang, "administration")}
              </button>
            )}
            <button style={styles.sidebarSmallButton} onClick={handleTeacherLogout}>
              {t(lang, "logout")}
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

            {selectedSessionCode ? (
              <div style={styles.innerCardFull}>
                <h3 style={styles.innerTitle}>{lang === "en" ? "Student QR access" : "Accès étudiant par QR code"}</h3>
                <SessionQrAccess sessionCode={selectedSessionCode} lang={lang} compact />
              </div>
            ) : null}

            <div style={styles.innerCardFull}>
              <label style={styles.label}>Code de session</label>
              <input style={styles.input} value={settingsTitle} onChange={(e) => setSettingsTitle(e.target.value)} />

              {isInitialSessionSetup ? (
                <>
                  {assignmentMethod === "random" ? (
                    <>
                      <label style={{ ...styles.label, display: "block", marginBottom: 10 }}>
                        Étudiants à répartir aléatoirement
                      </label>

                      <textarea
                        style={{ ...styles.input, minHeight: 170 } as React.CSSProperties}
                        value={settingsAllowedEmailsText}
                        onChange={(e) => {
                          setSettingsAllowedEmailsText(e.target.value);
                          setValidatedRandomAssignments([]);
                          setAssignmentRawText("");
                        }}
                        placeholder={"email;prenom;nom\netudiant1@exemple.com;Marie;Durand\netudiant2@exemple.com;Lucas;Martin"}
                      />

                      <div style={{ ...styles.emptyText, marginTop: 10 }}>
                        {randomCandidateCount} étudiant(s) valide(s) détecté(s) avant répartition.
                      </div>

                      <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                        <button
                          type="button"
                          style={styles.primaryButton}
                          onClick={handleValidateRandomAssignment}
                        >
                          Valider l'assignation aléatoire
                        </button>
                      </div>

                      <div style={{ marginTop: 14, marginBottom: 14 }}>
                        {validatedRandomAssignments.length > 0 ? (
                          <>
                            <div style={{ ...styles.emptyText, marginBottom: 10 }}>
                              Aperçu de l'assignation validée : {validatedRandomAssignments.length} étudiant(s) réparti(s).
                            </div>
                            {renderAssignmentsTable(validatedRandomAssignments)}
                          </>
                        ) : (
                          <div style={{ ...styles.emptyText, marginTop: 10 }}>
                            Validez l'assignation aléatoire pour afficher le tableau avant export.
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <label style={{ ...styles.label, display: "block", marginBottom: 10 }}>
                        Liste avec assignation prédéfinie
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
                    </>
                  )}

                  <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                    <button
                      type="button"
                      style={
                        assignmentMethod === "random" && validatedRandomAssignments.length === 0
                          ? styles.secondaryButton
                          : styles.primaryButton
                      }
                      disabled={assignmentMethod === "random" && validatedRandomAssignments.length === 0}
                      onClick={downloadAssignmentExport}
                    >
                      Exporter l'assignation
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ ...styles.innerCardFull, marginTop: 16, marginBottom: 16 }}>
                    <h3 style={styles.innerTitle}>Ajouter un étudiant</h3>

                    <label style={styles.label}>Email</label>
                    <input
                      style={styles.input}
                      value={newStudentEmail}
                      onChange={(e) => setNewStudentEmail(e.target.value)}
                      placeholder="email@exemple.com"
                    />

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

                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "end", marginTop: 10 }}>
                      <div>
                        <label style={styles.label}>Groupe</label>
                        <select
                          style={styles.input}
                          value={newStudentGroupNumber}
                          disabled={autoAssignNewStudentGroup}
                          onChange={(e) => setNewStudentGroupNumber(Number(e.target.value))}
                        >
                          {studentGroups.map((group) => (
                            <option key={group} value={group}>
                              Groupe {group}
                            </option>
                          ))}
                        </select>
                      </div>

                      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: "#40577a", fontSize: 14 }}>
                        <input
                          type="checkbox"
                          checked={autoAssignNewStudentGroup}
                          onChange={(e) => setAutoAssignNewStudentGroup(e.target.checked)}
                        />
                        Assignation aléatoire
                      </label>
                    </div>

                    <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
                      <button type="button" style={styles.primaryButton} onClick={handleAddStudentToSessionDraft}>
                        Ajouter l'étudiant
                      </button>
                      <button
                        type="button"
                        style={styles.primaryButton}
                        onClick={downloadAssignmentExport}
                      >
                        Exporter l'assignation
                      </button>
                    </div>
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
    )}</Translated>);
  }

  if (screen === "student_analyses") {
      return (<Translated>{(
      <div style={styles.appShell} className="student-responsive-shell">
        <StudentSidebar
          lang={lang}
          setLang={setLang}
          active="analyses"
          onGo={goToScreen}
          analysisUnlocked={studentAnalysisUnlocked}
          onBeforeOpenAnalysis={refreshStudentAnalysisData}
          sessionCode={studentSelectedSessionCode}
          sessionId={studentSelectedSessionId}
          voteUnlocked={studentVoteUnlocked}
onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
        />

        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
<div style={styles.topHeader}>
  <div style={styles.topHeaderTitle}>{t(lang, "appTitleUpper")}</div>
  <div style={styles.topHeaderSub}>
    {t(lang, "developedBy")}
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
    )}</Translated>);
  }

  if (screen === "student_bilans") {
    return (<Translated>{(
      <div style={styles.appShell}>
        <StudentSidebar
          lang={lang}
          setLang={setLang}
          active="bilans"
          onGo={goToScreen}
          analysisUnlocked={studentAnalysisUnlocked}
          onBeforeOpenAnalysis={refreshStudentAnalysisData}
          sessionCode={studentSelectedSessionCode}
          sessionId={studentSelectedSessionId}
          voteUnlocked={studentVoteUnlocked}
onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
        />
        <main style={styles.mainArea}>
          <header style={styles.topHeader}>
<div style={styles.topHeader}>
  <div style={styles.topHeaderTitle}>{t(lang, "appTitleUpper")}</div>
  <div style={styles.topHeaderSub}>
    {t(lang, "developedBy")}
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
    )}</Translated>);
  }

if (screen === "student_vote") {
  return (<Translated>{(
    <div style={styles.appShell} className="student-responsive-shell">
      <StudentSidebar
          lang={lang}
          setLang={setLang}
        active="vote"
        onGo={goToScreen}
        analysisUnlocked={studentAnalysisUnlocked}
              voteUnlocked={studentVoteUnlocked}
        onBeforeOpenAnalysis={refreshStudentAnalysisData}
              onBeforeOpenVote={() => loadSessionVoteAccess(studentSelectedSessionId)}
        sessionCode={studentSelectedSessionCode}
        sessionId={studentSelectedSessionId}
      />

      <main style={styles.mainArea}>
<header style={styles.topHeader}>
  <div style={styles.topHeaderTitle}>{t(lang, "appTitleUpper")}</div>
  <div style={styles.topHeaderSub}>
    {t(lang, "developedBy")}
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
                <h3 style={styles.innerTitle}>{lang === "en" ? "My choices" : "Mes choix"}</h3>
                <p style={styles.bodyText}>{t(lang, "votePreferenceInstruction")}</p>
                <p style={{ ...styles.bodyText, marginTop: 6, color: "#64748b", fontWeight: 700 }}>
                  {t(lang, "voteSameOrderNotice")}
                </p>

<div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
  <div style={styles.bodyText}>
    <strong>{t(lang, "voteChoice1Weighted")} :</strong> {getProposalTextById(studentVotes.rank1)}
  </div>

  <div style={styles.bodyText}>
    <strong>{t(lang, "voteChoice2Weighted")} :</strong> {getProposalTextById(studentVotes.rank2)}
  </div>

  <div style={styles.bodyText}>
    <strong>{t(lang, "voteChoice3Weighted")} :</strong> {getProposalTextById(studentVotes.rank3)}
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
                      <option value="1">{t(lang, "voteChoice1Weighted")}</option>
                      <option value="2">{t(lang, "voteChoice2Weighted")}</option>
                      <option value="3">{t(lang, "voteChoice3Weighted")}</option>
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )}</Translated>);
}

  return (<Translated>{(
    <div style={styles.appShell} className="teacher-responsive-shell">
      <aside style={styles.sidebar} className="teacher-sidebar-organized">
          <style>{TEACHER_SIDEBAR_CSS}</style>
        <div style={styles.sidebarBrand}>
          <img src={kedgeLogo} alt="KEDGE Business School" style={styles.sidebarLogo} />
        </div>

        {selectedSessionId ? (
          <>
            <div style={styles.teacherSidebarContext} className="teacher-session-context">
              <div style={styles.teacherSidebarContextLabel}>
                {lang === "en" ? "Active session" : "Session active"}
              </div>
              <div style={styles.teacherSidebarCode}>{formatSessionCode(selectedSessionCode)}</div>
            </div>

            <details className="teacher-sidebar-section" open={teacherMenu === "session_open" && (teacherSessionTab === "counts" || teacherSessionTab === "users")} style={styles.sidebarSection}>
              <summary style={getMonitoringSectionTitleStyle()}><span className="teacher-sidebar-chevron" style={styles.sidebarChevron}>›</span><span style={styles.sidebarSectionIcon}>🟢</span><span>{lang === "en" ? "LIVE COLLECTION" : "COLLECTE EN DIRECT"}</span></summary>
              <button
                style={teacherMenu === "session_open" && teacherSessionTab === "counts" ? styles.sidebarButtonActive : styles.sidebarButton}
                onClick={() => {
                  setTeacherMenu("session_open");
                  setTeacherSessionTab("counts");
                }}
              >
                📈 {lang === "en" ? "Response counter" : "Compteur de réponses"}
              </button>

              <button
                style={teacherMenu === "session_open" && teacherSessionTab === "users" ? styles.sidebarButtonActive : styles.sidebarButton}
                onClick={() => {
                  setTeacherMenu("session_open");
                  setTeacherSessionTab("users");
                }}
              >
                👥 {lang === "en" ? "Students" : "Étudiants"}
              </button>
            </details>

            <details className="teacher-sidebar-section" open style={styles.sidebarSection}>
              <summary style={styles.sidebarSectionTitle}><span className="teacher-sidebar-chevron" style={styles.sidebarChevron}>›</span><span style={styles.sidebarSectionIcon}>🔓</span><span>{lang === "en" ? "STUDENT ACCESS" : "ACCÈS ÉTUDIANTS"}</span></summary>
              <button
                type="button"
                style={studentAnalysisUnlocked ? styles.teacherAccessToggleOn : styles.teacherAccessToggleOff}
                onClick={toggleStudentAnalysisAccess}
              >
                {studentAnalysisUnlocked ? "🔓" : "🔒"} {t(lang, "analyses")}
              </button>
              <button
                type="button"
                style={studentVoteUnlocked ? styles.teacherAccessToggleOn : styles.teacherAccessToggleOff}
                onClick={toggleStudentVoteAccess}
              >
                {studentVoteUnlocked ? "🔓" : "🔒"} {t(lang, "vote")}
              </button>
            </details>

            <details className="teacher-sidebar-section" open={teacherMenu === "session_open" && (teacherSessionTab === "analyses" || teacherSessionTab === "vote" || teacherSessionTab === "synthese")} style={styles.sidebarSection}>
              <summary style={getDebriefSectionTitleStyle()}><span className="teacher-sidebar-chevron" style={styles.sidebarChevron}>›</span><span style={styles.sidebarSectionIcon}>🎬</span><span>{lang === "en" ? "ACTIVITY MONITORING" : "SUIVI DE L’ACTIVITÉ"}</span></summary>
              <button
                style={teacherMenu === "session_open" && teacherSessionTab === "analyses" ? styles.sidebarButtonActive : styles.sidebarButton}
                onClick={() => {
                  setTeacherMenu("session_open");
                  setTeacherSessionTab("analyses");
                }}
              >
                📑 {t(lang, "analyses")}
              </button>

              <button
                style={teacherMenu === "session_open" && teacherSessionTab === "vote" ? styles.sidebarButtonActive : styles.sidebarButton}
                onClick={() => {
                  setTeacherMenu("session_open");
                  setTeacherSessionTab("vote");
                }}
              >
                🗳️ {t(lang, "vote")}
              </button>

              <button
                style={teacherMenu === "session_open" && teacherSessionTab === "synthese" ? styles.sidebarButtonActive : styles.sidebarButton}
                onClick={() => {
                  setTeacherMenu("session_open");
                  setTeacherSessionTab("synthese");
                }}
              >
                🧩 {t(lang, "synthese")}
              </button>
            </details>

            <details className="teacher-sidebar-section" style={styles.sidebarSection}>
              <summary style={getProjectionSectionTitleStyle()}><span className="teacher-sidebar-chevron" style={styles.sidebarChevron}>›</span><span style={styles.sidebarSectionIcon}>🖥️</span><span>{lang === "en" ? "PROJECTION" : "PROJECTION"}</span></summary>
              <button
                style={getProjectionMenuButtonStyle("qr")}
                onClick={() => openProjectionStage("qr")}
              >
                📱 {t(lang, "projectionQr")}
              </button>
              <button
                style={getProjectionMenuButtonStyle("bilans")}
                onClick={() => openProjectionStage("bilans")}
              >
                📊 {t(lang, "projectionBilans")}
              </button>
              <button
                style={getProjectionMenuButtonStyle("propositions")}
                onClick={() => openProjectionStage("propositions")}
              >
                💡 {t(lang, "projectionProposals")}
              </button>
              <button
                style={getProjectionMenuButtonStyle("vote")}
                onClick={() => openProjectionStage("vote")}
              >
                🗳️ {t(lang, "projectionVote")}
              </button>
              <button
                style={getProjectionMenuButtonStyle("synthese")}
                onClick={() => openProjectionStage("synthese")}
              >
                🧩 {t(lang, "projectionSynthesis")}
              </button>
            </details>

            <details className="teacher-sidebar-section" open={teacherMenu === "sessions" || screen === "teacher_session_settings"} style={styles.sidebarSection}>
              <summary style={getSessionSectionTitleStyle()}><span className="teacher-sidebar-chevron" style={styles.sidebarChevron}>›</span><span style={styles.sidebarSectionIcon}>⚙️</span><span>{lang === "en" ? "SESSION" : "SESSION"}</span></summary>
              <button
                style={(screen as string) === "teacher_session_settings" && !isInitialSessionSetup ? styles.sidebarButtonActive : styles.sidebarButton}
                onClick={() => {
                  setIsInitialSessionSetup(false);
                  setScreen("teacher_session_settings");
                }}
              >
                🛠️ {lang === "en" ? "Session settings" : "Gestion de la session"}
              </button>

              <button
                style={teacherMenu === "sessions" && isInitialSessionSetup ? styles.sidebarButtonActive : styles.sidebarButton}
                onClick={() => {
                  setMessage("");
                  setTeacherMenu("sessions");
                  setIsInitialSessionSetup(true);
                  setScreen("teacher_dashboard");
                }}
              >
                ➕ {lang === "en" ? "New session" : "Nouvelle session"}
              </button>

              <button
                style={teacherMenu === "sessions" && !isInitialSessionSetup ? styles.sidebarButtonActive : styles.sidebarButton}
                onClick={() => {
                  setTeacherMenu("sessions");
                  setIsInitialSessionSetup(false);
                  setScreen("teacher_dashboard");
                }}
              >
                📂 {lang === "en" ? "Other sessions" : "Autres sessions"}
              </button>
            </details>
          </>
        ) : (
          <>
            <button
              style={teacherMenu === "sessions" ? styles.sidebarButtonActive : styles.sidebarButton}
              onClick={() => { setTeacherMenu("sessions"); setIsInitialSessionSetup(true); }}
            >
              {lang === "en" ? "Create / open session" : "Créer / ouvrir une session"}
            </button>
          </>
        )}

        <div style={styles.sidebarFooter}>
          <LanguageToggle lang={lang} setLang={setLang} compact />
          {currentUserRole === "admin" && (
            <button style={styles.sidebarSmallButton} onClick={() => void handleGoToAdminFromTeacher()}>
              {t(lang, "administration")}
            </button>
          )}
          <button style={styles.sidebarSmallButton} onClick={handleTeacherLogout}>
            {t(lang, "logout")}
          </button>
        </div>
      </aside>

      <main style={styles.mainArea}>
        <header style={styles.topHeader}>
          <div style={styles.topHeaderTitle}>{t(lang, "appTitleUpper")}</div>
          <div style={styles.topHeaderSub}>
            {t(lang, "developedBy")} · Professeur : {teacherDisplayName || teacherUserEmail || "—"}
          </div>
        </header>

        <section style={styles.bigPanel}>
          {teacherMenu === "sessions" && (
            <>
              <h2 style={styles.panelTitle}>
                {isInitialSessionSetup
                  ? (lang === "en" ? "Create a new session" : "Créer une nouvelle session")
                  : (lang === "en" ? "My sessions" : "Mes sessions")}
              </h2>

              <div style={styles.twoCols}>
                <div
                  style={
                    isInitialSessionSetup
                      ? {
                          ...styles.innerCard,
                          border: "3px solid #ed7d31",
                          boxShadow: "0 16px 34px rgba(237,125,49,0.20)",
                        }
                      : styles.innerCard
                  }
                >
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
  <label style={styles.label}>Méthode d'assignation</label>
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <label>
      <input
        type="radio"
        checked={assignmentMethod === "import"}
        onChange={() => {
          setAssignmentMethod("import");
          setValidatedRandomAssignments([]);
        }}
      />{" "}
      Assignation prédéfinie
    </label>

    <label>
      <input
        type="radio"
        checked={assignmentMethod === "random"}
        onChange={() => {
          setAssignmentMethod("random");
          setValidatedRandomAssignments([]);
          setAssignmentRawText("");
        }}
      />{" "}
      Assignation aléatoire
    </label>
  </div>
</div>

<button style={styles.primaryButton} onClick={handleCreateSessionQuick}>
  Créer la session
</button>
                </div>

                <div
                  style={
                    !isInitialSessionSetup
                      ? {
                          ...styles.innerCard,
                          border: "3px solid #ed7d31",
                          boxShadow: "0 16px 34px rgba(237,125,49,0.20)",
                        }
                      : styles.innerCard
                  }
                >
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
              <h2 style={styles.panelTitle}>
                {selectedSessionCode
                  ? `${lang === "en" ? "Open session" : "Session ouverte"} · ${formatSessionCode(selectedSessionCode)}`
                  : (lang === "en" ? "Open session" : "Session ouverte")}
              </h2>

              {teacherSessionTab === "counts" && (
                <>
                  <div style={styles.countsToolbar}>
                    <button
                      type="button"
                      style={styles.secondaryButton}
                      disabled={countsLoading || studentProgressLoading}
                      onClick={() => {
                        if (selectedSessionId) {
                          void refreshSessionMonitoring(selectedSessionId, { showLoading: true });
                        }
                      }}
                    >
                      {countsLoading || studentProgressLoading ? (
                        <LoadingSpinner tone="dark" label={lang === "en" ? "Refreshing..." : "Actualisation..."} />
                      ) : (
                        lang === "en" ? "Refresh" : "Actualiser"
                      )}
                    </button>
                  </div>

                  <div style={styles.statsGrid}>
                    <div style={styles.statCard}>
                      <div style={styles.statLabel}>Transport</div>
                      <div style={styles.statValue}>{counts.transport_count}</div>
                    </div>
                    <div style={styles.statCard}>
                      <div style={styles.statLabel}>{lang === "en" ? "Lunch" : "Déjeuner"}</div>
                      <div style={styles.statValue}>{counts.dejeuner_count}</div>
                    </div>
                    <div style={styles.statCard}>
                      <div style={styles.statLabel}>{lang === "en" ? "Equipment" : "Équipement"}</div>
                      <div style={styles.statValue}>{counts.equipement_count}</div>
                    </div>
                    <div style={styles.statCard}>
                      <div style={styles.statLabel}>{lang === "en" ? "Other consumption" : "Autres consommations"}</div>
                      <div style={styles.statValue}>{counts.autres_count}</div>
                    </div>
                  </div>

                  <div style={{ ...styles.innerCardFull, marginTop: 18 }}>
                    <h3 style={styles.innerTitle}>
                      {lang === "en" ? "Student progress: questionnaires and vote" : "Suivi étudiant : questionnaires et vote"}
                    </h3>

                    {studentProgressRows.length === 0 ? (
                      <div style={styles.emptyText}>
                        {lang === "en"
                          ? "No student assignment found for this session."
                          : "Aucune assignation étudiant trouvée pour cette session."}
                      </div>
                    ) : (
                      <div style={styles.progressTableWrap}>
                        <table style={{ ...styles.reportTable, ...styles.progressReportTable, marginTop: 0 }}>
                          <colgroup>
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "12%" }} />
                            <col style={{ width: "6%" }} />
                            <col style={{ width: "14%" }} />
                            <col style={{ width: "11%" }} />
                            <col style={{ width: "14%" }} />
                            <col style={{ width: "18%" }} />
                            <col style={{ width: "13%" }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th style={styles.progressTh}>{lang === "en" ? "Last" : "Nom"}</th>
                              <th style={styles.progressTh}>{lang === "en" ? "First" : "Prénom"}</th>
                              <th title={lang === "en" ? "Group" : "Groupe"} style={{ ...styles.progressTh, textAlign: "center" }}>{lang === "en" ? "Grp." : "Gr."}</th>
                              <th title="Transport" style={{ ...styles.progressTh, textAlign: "center" }}>Transport</th>
                              <th title={lang === "en" ? "Lunch" : "Déjeuner"} style={{ ...styles.progressTh, textAlign: "center" }}>{lang === "en" ? "Lunch" : "Déj."}</th>
                              <th title={lang === "en" ? "Equipment" : "Équipement"} style={{ ...styles.progressTh, textAlign: "center" }}>{lang === "en" ? "Equip." : "Équip."}</th>
                              <th title={lang === "en" ? "Other consumption" : "Autres consommations"} style={{ ...styles.progressTh, textAlign: "center" }}>{lang === "en" ? "Other" : "Autres"}</th>
                              <th title="Vote" style={{ ...styles.progressTh, textAlign: "center" }}>Vote</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentProgressRows.map((student) => {
                              const key = `${student.student_email}-${student.group_number}`;
                              const renderCheck = (done: boolean) => (
                                <span style={done ? styles.progressCheckDone : styles.progressCheckEmpty}>
                                  {done ? "✓" : ""}
                                </span>
                              );

                              return (
                                <tr key={key}>
                                  <td style={styles.progressTd}>{student.last_name || "—"}</td>
                                  <td style={styles.progressTd}>{student.first_name || "—"}</td>
                                  <td style={{ ...styles.progressTd, textAlign: "center", fontWeight: 800 }}>{student.group_number || "—"}</td>
                                  <td style={{ ...styles.progressTd, textAlign: "center" }}>{renderCheck(student.transport_done)}</td>
                                  <td style={{ ...styles.progressTd, textAlign: "center" }}>{renderCheck(student.dejeuner_done)}</td>
                                  <td style={{ ...styles.progressTd, textAlign: "center" }}>{renderCheck(student.equipement_done)}</td>
                                  <td style={{ ...styles.progressTd, textAlign: "center" }}>{renderCheck(student.autres_done)}</td>
                                  <td style={{ ...styles.progressTd, textAlign: "center" }}>{renderCheck(hasStudentVoted(student.student_email))}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
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
                  ) : (
                    <div style={{ ...styles.emptyText, marginTop: 12 }}>
                      Aucune assignation trouvée pour cette session.
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
                      onClick={() => {
                        setIsInitialSessionSetup(false);
                        setScreen("teacher_session_settings");
                      }}
                    >
                      Modifier les paramètres
                    </button>
                  </div>
                </div>
              )}

              {teacherSessionTab === "analyses" && (
                <>
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

                      <button
                        style={
                          teacherVoteView === "results"
                            ? styles.primaryButton
                            : styles.secondaryButton
                        }
                        onClick={() => {
                          void loadTeacherVoteRows(selectedSessionId);
                          setTeacherVoteView("results");
                        }}
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
        4. Soumettez directement les propositions au vote.
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
          style={styles.primaryButton}
          onClick={submitImportedProposalsToVote}
          disabled={!importedProposalRawText.trim() || isSubmittingImportedProposals}
          type="button"
        >
          {isSubmittingImportedProposals
            ? "Soumission en cours..."
            : "Soumettre ces propositions au vote"}
        </button>
      </div>
    </div>

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

            <div
              style={{
                marginTop: 14,
                color: "#ef7d32",
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              {t(lang, "weightedScore")} : {getVoteScorePercent(row.score)} %
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
  )}</Translated>);
}

const styles: Record<string, React.CSSProperties> = {
  qrAccessCard: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "1.1fr auto",
    gap: 20,
    alignItems: "center",
    padding: 24,
    borderRadius: 28,
    background: "#f8fafc",
    border: "1px solid #d8e0ec",
    boxShadow: "0 14px 30px rgba(15,23,42,0.12)",
    boxSizing: "border-box",
  },
  qrAccessCardCompact: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 16,
    alignItems: "center",
    marginTop: 18,
    padding: 18,
    borderRadius: 24,
    background: "#f8fafc",
    border: "1px solid #d8e0ec",
    boxSizing: "border-box",
  },
  qrAccessTextBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
  },
  qrAccessTitle: {
    margin: 0,
    color: "#12355b",
    fontSize: 28,
    fontWeight: 900,
    lineHeight: 1.1,
  },
  qrAccessTitleCompact: {
    margin: 0,
    color: "#12355b",
    fontSize: 20,
    fontWeight: 900,
    lineHeight: 1.15,
  },
  qrAccessDescription: {
    margin: 0,
    color: "#53657f",
    fontSize: 14,
    lineHeight: 1.35,
  },
  qrAccessCode: {
    display: "inline-flex",
    alignSelf: "flex-start",
    marginTop: 4,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#17243b",
    color: "#fff",
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: 0.5,
  },
  qrCanvasWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 22,
    background: "#ffffff",
    boxShadow: "inset 0 0 0 1px #e2e8f0",
  },
  qrActionRow: {
    gridColumn: "1 / -1",
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  qrStatus: {
    gridColumn: "1 / -1",
    textAlign: "center",
    color: "#12355b",
    fontSize: 13,
    fontWeight: 800,
  },
  projectionControlBox: {
    marginTop: 18,
    padding: 18,
    borderRadius: 22,
    background: "#eef4fb",
    border: "1px solid #d4e2f0",
  },
  projectionControlTitle: {
    margin: "0 0 12px",
    color: "#12355b",
    fontSize: 18,
    fontWeight: 900,
  },
  projectionControlRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  projectionPage: {
    height: "100vh",
    width: "100%",
    maxWidth: 1280,
    margin: "0 auto",
    boxSizing: "border-box" as const,
    padding: 18,
    background: "linear-gradient(180deg, #eef3f8 0%, #d7dee8 100%)",
    color: "#10213f",
    overflow: "hidden" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  projectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    padding: "22px 28px",
    borderRadius: 28,
    background: "#17243b",
    color: "#fff",
    boxShadow: "0 14px 35px rgba(15,23,42,0.22)",
  },

  projectionHeaderClean: {
    flex: "0 0 auto",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    padding: "20px 28px",
    borderRadius: 26,
    background: "#17243b",
    color: "#fff",
    boxShadow: "0 14px 35px rgba(15,23,42,0.22)",
    marginBottom: 0,
  },

  projectionTitleClean: {
    margin: 0,
    textAlign: "center" as const,
    fontSize: "clamp(30px, 4vw, 56px)",
    lineHeight: 0.98,
    letterSpacing: 1.1,
    fontWeight: 950,
    color: "#ffffff",
    textShadow: "0 2px 8px rgba(0,0,0,0.22)",
    maxWidth: 800,
  },

  projectionSessionCodeClean: {
    flex: "0 0 auto",
    padding: "12px 22px",
    borderRadius: 999,
    background: "#ed7d31",
    color: "#10213f",
    fontSize: "clamp(24px, 2.6vw, 38px)",
    fontWeight: 950,
    letterSpacing: 1,
    boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
  },
  projectionKicker: {
    fontSize: 16,
    fontWeight: 800,
    opacity: 0.76,
    marginBottom: 6,
  },
  projectionTitle: {
    margin: 0,
    fontSize: "clamp(30px, 3.9vw, 54px)",
    lineHeight: 0.98,
    letterSpacing: 1,
    fontWeight: 950,
    color: "#ffffff",
    textShadow: "0 2px 8px rgba(0,0,0,0.22)",
    maxWidth: 980,
  },
  projectionSessionCode: {
    display: "inline-flex",
    marginTop: 14,
    padding: "12px 18px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    fontSize: "clamp(18px, 2vw, 30px)",
    fontWeight: 950,
    letterSpacing: 0.8,
  },
  projectionNav: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    margin: "22px 0",
  },
  projectionNavButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
    padding: "13px 18px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#12355b",
    fontWeight: 900,
    textDecoration: "none",
    boxShadow: "0 8px 18px rgba(15,23,42,0.10)",
  },
  projectionNavButtonActive: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
    padding: "13px 18px",
    borderRadius: 999,
    background: "#ed7d31",
    color: "#12355b",
    fontWeight: 950,
    textDecoration: "none",
    boxShadow: "0 8px 18px rgba(15,23,42,0.16)",
  },
  projectionHeroGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 0.9fr)",
    gap: 24,
    alignItems: "stretch",
  },

  projectionQrStage: {
    flex: "1 1 auto",
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(300px, 0.85fr)",
    gap: 18,
    alignItems: "stretch",
  },

  projectionQrMainCard: {
    minHeight: 0,
    padding: "28px 34px",
    borderRadius: 32,
    background: "#ffffff",
    boxShadow: "0 16px 36px rgba(15,23,42,0.13)",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center" as const,
    overflow: "hidden" as const,
  },

  projectionQrCanvasCard: {
    minHeight: 0,
    padding: "26px 28px",
    borderRadius: 32,
    background: "#ffffff",
    boxShadow: "0 16px 36px rgba(15,23,42,0.13)",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center" as const,
    overflow: "hidden" as const,
  },

  projectionQrTitle: {
    margin: 0,
    color: "#7b3f86",
    fontSize: "clamp(42px, 5.2vw, 72px)",
    fontWeight: 950,
    lineHeight: 0.94,
  },

  projectionQrInstruction: {
    maxWidth: 760,
    color: "#17243b",
    fontSize: "clamp(24px, 2.3vw, 34px)",
    lineHeight: 1.14,
    fontWeight: 900,
    margin: "18px 0 0",
  },

  projectionQrCode: {
    margin: "24px 0 16px",
    padding: "20px 32px",
    borderRadius: 26,
    background: "#ed7d31",
    color: "#10213f",
    fontSize: "clamp(40px, 5vw, 70px)",
    fontWeight: 950,
    letterSpacing: 1.2,
    maxWidth: "100%",
    boxSizing: "border-box" as const,
    overflowWrap: "anywhere" as const,
    lineHeight: 1.02,
  },

  projectionQrSmallText: {
    color: "#53657f",
    fontSize: "clamp(20px, 1.8vw, 28px)",
    lineHeight: 1.28,
    fontWeight: 800,
    margin: 0,
  },

  projectionQrSideTitle: {
    margin: "0 0 18px",
    color: "#12355b",
    fontSize: "clamp(26px, 2.6vw, 38px)",
    lineHeight: 1.05,
    fontWeight: 950,
  },

  projectionQrCanvasWrap: {
    padding: 18,
    borderRadius: 28,
    background: "#ffffff",
    boxShadow: "inset 0 0 0 1px #d8e2ee, 0 12px 30px rgba(15,23,42,0.12)",
  },

  projectionQrSideCode: {
    marginTop: 26,
    padding: "14px 22px",
    borderRadius: 999,
    background: "#17243b",
    color: "#ffffff",
    fontSize: "clamp(20px, 2vw, 30px)",
    fontWeight: 950,
    letterSpacing: 0.8,
  },
  projectionSection: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },

  projectionSectionClean: {
    flex: "1 1 auto",
    minHeight: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    overflow: "hidden" as const,
  },
  projectionCard: {
    padding: 28,
    borderRadius: 30,
    background: "#ffffff",
    boxShadow: "0 16px 36px rgba(15,23,42,0.13)",
  },
  projectionCardLarge: {
    padding: 38,
    borderRadius: 34,
    background: "#ffffff",
    boxShadow: "0 16px 36px rgba(15,23,42,0.13)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  },
  projectionSectionTitle: {
    margin: 0,
    color: "#7b3f86",
    fontSize: "clamp(28px, 3.4vw, 50px)",
    fontWeight: 950,
    lineHeight: 1,
    textAlign: "center",
  },
  projectionInstruction: {
    maxWidth: 820,
    color: "#17243b",
    fontSize: "clamp(22px, 2.3vw, 34px)",
    lineHeight: 1.25,
    fontWeight: 700,
  },
  projectionInstructionSmall: {
    color: "#53657f",
    fontSize: "clamp(16px, 1.6vw, 22px)",
    lineHeight: 1.3,
    fontWeight: 700,
  },
  projectionBigCode: {
    margin: "18px 0",
    padding: "22px 34px",
    borderRadius: 28,
    background: "#ed7d31",
    color: "#10213f",
    fontSize: "clamp(34px, 4.8vw, 66px)",
    fontWeight: 950,
    letterSpacing: 1.2,
    maxWidth: "100%",
    boxSizing: "border-box" as const,
    overflowWrap: "anywhere" as const,
    lineHeight: 1.05,
  },
  projectionDashboardWrap: {
    width: "100%",
  },
  projectionThemeGrid: {
    flex: "1 1 auto",
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
    gap: 18,
    overflowY: "auto" as const,
    paddingRight: 4,
  },
  projectionThemeCard: {
    minHeight: 0,
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    boxShadow: "0 12px 28px rgba(15,23,42,0.10)",
    border: "1px solid #d8e0ec",
    display: "flex",
    flexDirection: "column" as const,
    gap: 14,
  },
  projectionThemeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 18,
  },
  projectionThemeTitle: {
    margin: 0,
    color: "#12355b",
    fontSize: 30,
    lineHeight: 1.05,
    fontWeight: 950,
  },
  projectionThemeMeta: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 15,
    fontWeight: 800,
  },
  projectionThemeTotal: {
    flex: "0 0 auto",
    color: "#10213f",
    fontSize: 34,
    fontWeight: 950,
    lineHeight: 1,
    textAlign: "right" as const,
  },
  projectionThemeUnit: {
    fontSize: 15,
    fontWeight: 800,
    color: "#475569",
  },
  projectionThemeRows: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    minHeight: 0,
  },
  projectionThemeRow: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  projectionThemeRowTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    color: "#17243b",
    fontSize: 17,
    fontWeight: 800,
  },
  projectionThemeBarTrack: {
    height: 16,
    width: "100%",
    borderRadius: 999,
    background: "#edf2f7",
    overflow: "hidden" as const,
  },
  projectionThemeBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  projectionProposalStageWrap: {
    flex: "1 1 auto",
    minHeight: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    overflow: "hidden" as const,
  },
  projectionProposalHeaderRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 16,
  },
  projectionProposalVoteQrCard: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "12px 16px",
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #d8e0ec",
    boxShadow: "0 12px 24px rgba(15,23,42,0.08)",
    maxWidth: 430,
  },
  projectionProposalVoteQrTextWrap: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    minWidth: 0,
  },
  projectionProposalVoteQrTitle: {
    margin: 0,
    color: "#12355b",
    fontSize: 22,
    lineHeight: 1.05,
    fontWeight: 950,
  },
  projectionProposalVoteQrText: {
    margin: 0,
    color: "#334155",
    fontSize: 14,
    lineHeight: 1.22,
    fontWeight: 700,
  },
  projectionProposalVoteQrCode: {
    display: "inline-flex",
    alignSelf: "flex-start",
    marginTop: 4,
    padding: "4px 10px",
    borderRadius: 999,
    background: "#17243b",
    color: "#ffffff",
    fontSize: 13,
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: 0.5,
  },
  projectionProposalVoteQrBox: {
    flex: "0 0 auto",
    background: "#ffffff",
    padding: 8,
    borderRadius: 18,
    border: "1px solid #d8e0ec",
    boxShadow: "0 8px 18px rgba(15,23,42,0.08)",
  },
  projectionProposalGrid: {
    flex: "1 1 auto",
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gridTemplateRows: "repeat(2, minmax(0, 1fr))",
    gap: 14,
    alignContent: "stretch",
  },
  projectionProposalCard: {
    minHeight: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    padding: "14px 14px 12px",
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #d8e0ec",
    boxShadow: "0 10px 22px rgba(15,23,42,0.08)",
    overflow: "hidden" as const,
    boxSizing: "border-box" as const,
  },
  projectionProposalNumber: {
    width: 36,
    height: 36,
    flex: "0 0 36px",
    borderRadius: 999,
    background: "#ed7d31",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#10213f",
    fontSize: 17,
    fontWeight: 950,
  },
  projectionProposalText: {
    width: "100%",
    minWidth: 0,
    color: "#10213f",
    fontSize: "clamp(13px, 1.65vmin, 19px)",
    lineHeight: 1.12,
    fontWeight: 800,
    wordBreak: "normal" as const,
    overflowWrap: "normal" as const,
    whiteSpace: "normal" as const,
    hyphens: "none" as const,
    textAlign: "center" as const,
  },
  projectionVotePodium: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 22,
  },
  projectionVoteCard: {
    padding: 28,
    borderRadius: 30,
    background: "#ffffff",
    border: "1px solid #d8e0ec",
    boxShadow: "0 18px 36px rgba(15,23,42,0.15)",
    textAlign: "center",
  },
  projectionVoteRank: {
    fontSize: 58,
    marginBottom: 14,
  },
  projectionVoteText: {
    color: "#10213f",
    fontSize: "clamp(22px, 2.2vw, 34px)",
    lineHeight: 1.25,
    fontWeight: 900,
  },
  projectionVoteScore: {
    marginTop: 18,
    color: "#ed7d31",
    fontSize: "clamp(18px, 1.8vw, 26px)",
    fontWeight: 950,
  },
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
    gridTemplateColumns: "310px 1fr",
    background: "linear-gradient(90deg, #12203a 0 310px, #e5e5e5 310px 100%)",
    fontFamily: "Arial, sans-serif",
    alignItems: "stretch",
  },
  sidebar: {
    background: "linear-gradient(180deg, #12203a 0%, #243754 100%)",
    color: "#fff",
    padding: "18px 18px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    overflowY: "auto" as const,
    position: "sticky" as const,
    top: 0,
    height: "100vh",
    minHeight: "100vh",
    maxHeight: "100vh",
    alignSelf: "start",
    boxSizing: "border-box" as const,
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
    width: "100%",
    background: "#e6e6e6",
    color: "#123b64",
    border: "none",
    borderRadius: 999,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "center",
    lineHeight: 1.12,
    whiteSpace: "normal",
    overflowWrap: "break-word",
    margin: "4px 0",
    boxShadow: "0 1px 0 rgba(255,255,255,0.2)",
  },
  sidebarButtonActive: {
    width: "100%",
    background: "#ef7d32",
    color: "#123b64",
    border: "2px solid rgba(255,255,255,0.82)",
    borderRadius: 999,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "center",
    lineHeight: 1.12,
    whiteSpace: "normal",
    overflowWrap: "break-word",
    margin: "4px 0",
    boxShadow: "0 8px 18px rgba(239,125,50,0.16)",
  },
  sidebarFooter: {
    marginTop: "auto",
    paddingTop: 8,
    borderTop: "1px solid rgba(255,255,255,0.12)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
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
    position: "relative",
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
    position: "relative",
    background: "#343741",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 40px 104px",
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

  landingLanguageDock: {
    position: "absolute",
    left: "50%",
    bottom: 24,
    transform: "translateX(-50%)",
    zIndex: 20,
  },

  authLanguageDock: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },

  languageToggle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: "8px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.16)",
  },

  languageToggleCompact: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
    width: "100%",
  },

  languageFlagButton: {
    width: 52,
    height: 40,
    border: "1px solid rgba(15,23,42,0.12)",
    borderRadius: 999,
    background: "rgba(255,255,255,0.78)",
    cursor: "pointer",
    fontSize: 24,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },

  languageFlagButtonActive: {
    width: 52,
    height: 40,
    border: "2px solid #ef7d32",
    borderRadius: 999,
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 24,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    boxShadow: "0 0 0 3px rgba(239,125,50,0.18)",
  },

  languageToggleMini: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 0,
    margin: 0,
    width: "auto",
  },

  languageFlagButtonMini: {
    width: 34,
    height: 26,
    border: "1px solid rgba(15,23,42,0.16)",
    borderRadius: 999,
    background: "rgba(255,255,255,0.78)",
    cursor: "pointer",
    fontSize: 15,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },

  languageFlagButtonMiniActive: {
    width: 34,
    height: 26,
    border: "2px solid #ef7d32",
    borderRadius: 999,
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 15,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    boxShadow: "0 0 0 2px rgba(239,125,50,0.18)",
  },

  studentMobileTopbar: {
    background: "linear-gradient(180deg, #12203a 0%, #243754 100%)",
    color: "#fff",
    padding: "6px 7px",
    display: "flex",
    flexDirection: "column",
    gap: 5,
    width: "100%",
    boxSizing: "border-box",
    position: "sticky",
    top: 0,
    zIndex: 90,
    boxShadow: "0 7px 16px rgba(15,23,42,0.25)",
  },

  studentMobileNavScroller: {
    display: "flex",
    flexDirection: "row",
    gap: 6,
    width: "100%",
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: 2,
    WebkitOverflowScrolling: "touch",
  },

  studentMobileNavButton: {
    flex: "0 0 auto",
    minWidth: 92,
    maxWidth: 138,
    minHeight: 32,
    background: "#e6e6e6",
    color: "#123b64",
    border: "none",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "center",
    lineHeight: 1.05,
    whiteSpace: "normal",
  },

  studentMobileNavButtonActive: {
    flex: "0 0 auto",
    minWidth: 92,
    maxWidth: 138,
    minHeight: 32,
    background: "#ef7d32",
    color: "#123b64",
    border: "none",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "center",
    lineHeight: 1.05,
    whiteSpace: "normal",
  },

  studentMobileUtilityRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    width: "100%",
    minHeight: 28,
  },

  studentMobileSessionPill: {
    flex: "1 1 auto",
    minWidth: 0,
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    textAlign: "left",
  },

  studentMobileLogoutButton: {
    flex: "0 0 auto",
    width: 36,
    height: 26,
    minHeight: 26,
    background: "rgba(255,255,255,0.14)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 999,
    padding: 0,
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },


  studentMobileLangButton: {
    flex: "0 0 auto",
    width: 58,
    height: 26,
    minHeight: 26,
    background: "#ffffff",
    color: "#123b64",
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: 999,
    padding: "0 6px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 4px rgba(15,23,42,0.18)",
  },

  studentMobileReportCards: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 12,
  },

  studentMobileReportCategory: {
    marginTop: 8,
    padding: "8px 12px",
    borderRadius: 14,
    background: "#dbe7f3",
    color: "#123b64",
    fontWeight: 900,
    fontSize: 15,
    textAlign: "left",
  },

  studentMobileReportCard: {
    background: "#ffffff",
    border: "1px solid #d8e2ee",
    borderRadius: 18,
    padding: 12,
    boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
  },

  studentMobileReportLabel: {
    color: "#123b64",
    fontWeight: 900,
    fontSize: 16,
    lineHeight: 1.2,
    textAlign: "left",
    marginBottom: 10,
  },

  studentMobileReportGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 6,
  },

  studentMobileTransportGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },

  studentMobileReportFieldLabel: {
    color: "#64748b",
    fontWeight: 800,
    fontSize: 12,
    textAlign: "left",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  studentMobileReportFieldValue: {
    minWidth: 0,
  },

  studentMobileReportInput: {
    width: "100%",
    minHeight: 42,
    borderRadius: 14,
    border: "1px solid #c8d6e8",
    padding: "9px 10px",
    fontSize: 16,
    boxSizing: "border-box",
    background: "#fff",
  },

  studentMobileReportMeta: {
    marginTop: 10,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "left",
  },

  teacherSidebarContext: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "10px 12px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.10)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.14)",
    marginBottom: 6,
  },

  teacherSidebarContextLabel: {
    fontSize: 11,
    opacity: 0.74,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  teacherSidebarCode: {
    fontSize: 14,
    fontWeight: 950,
    overflowWrap: "anywhere" as const,
    lineHeight: 1.15,
  },

  teacherSidebarDivider: {
    width: "100%",
    height: 1,
    background: "rgba(255,255,255,0.18)",
    margin: "8px 0",
  },

  sidebarSection: {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "7px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.14)",
    display: "block",
    marginBottom: 10,
  },

  sidebarSectionTitle: {
    width: "100%",
    height: 44,
    minHeight: 44,
    boxSizing: "border-box" as const,
    color: "rgba(255,255,255,0.94)",
    fontSize: 12,
    fontWeight: 950,
    fontFamily: "Arial, sans-serif",
    textTransform: "uppercase" as const,
    letterSpacing: 0.45,
    cursor: "pointer",
    marginBottom: 7,
    userSelect: "none" as const,
    listStyle: "none",
    listStyleType: "none" as const,
    padding: "0 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    textAlign: "left" as const,
    gap: 7,
    borderRadius: 14,
    background: "transparent",
  },

  sidebarSectionTitleActive: {
    width: "100%",
    height: 44,
    minHeight: 44,
    boxSizing: "border-box" as const,
    color: "rgba(255,255,255,0.94)",
    fontSize: 12,
    fontWeight: 950,
    fontFamily: "Arial, sans-serif",
    textTransform: "uppercase" as const,
    letterSpacing: 0.45,
    cursor: "pointer",
    marginBottom: 7,
    userSelect: "none" as const,
    listStyle: "none",
    listStyleType: "none" as const,
    padding: "0 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    textAlign: "left" as const,
    gap: 7,
    borderRadius: 14,
    background: "transparent",
  },

  sidebarChevron: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 14,
    flex: "0 0 14px",
    color: "rgba(255,255,255,0.98)",
    fontSize: 17,
    fontWeight: 700,
    lineHeight: 1,
  },

  sidebarSectionIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    flex: "0 0 20px",
    marginRight: 0,
    fontSize: 15,
    lineHeight: 1,
  },

  teacherProjectionButton: {
    border: "none",
    borderRadius: 999,
    padding: "10px 14px",
    background: "#ed7d31",
    color: "#12355b",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
  },

  teacherAccessPanel: {
    width: "100%",
    boxSizing: "border-box" as const,
    marginTop: 8,
    padding: 10,
    borderRadius: 16,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },

  teacherAccessPanelTitle: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  },

  teacherAccessToggleOn: {
    width: "100%",
    border: "none",
    borderRadius: 999,
    padding: "8px 10px",
    background: "#d1fae5",
    color: "#065f46",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    textAlign: "center" as const,
    margin: "4px 0",
  },

  teacherAccessToggleOff: {
    width: "100%",
    border: "none",
    borderRadius: 999,
    padding: "8px 10px",
    background: "#fee2e2",
    color: "#991b1b",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    textAlign: "center" as const,
    margin: "4px 0",
  },

  teacherLaunchGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: 18,
    marginBottom: 18,
  },

  teacherLaunchCard: {
    background: "#f8fbff",
    border: "1px solid #cfe0f2",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 8px 18px rgba(15,23,42,0.06)",
  },

  teacherProjectionActions: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 10,
    marginTop: 14,
    justifyContent: "center",
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
    position: "relative",
    background: "linear-gradient(135deg, #eef2f7 0%, #dde5ef 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },

  authCard: {
    position: "relative",
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

  privacyNotice: {
    width: "100%",
    boxSizing: "border-box" as const,
    background: "#f8fafc",
    border: "1px solid #d8e0ec",
    borderRadius: 16,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.45,
  },

  privacyNoticeTitle: {
    display: "block",
    color: "#1e293b",
    fontSize: 13,
    fontWeight: 800,
  },

  privacyNoticeText: {
    display: "block",
  },

  privacyButton: {
    alignSelf: "center",
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "10px 18px",
    background: "#f8fafc",
    color: "#1e293b",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
  },

  privacyModalBackdrop: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 1000,
    background: "rgba(15,23,42,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  privacyModalCard: {
    width: 560,
    maxWidth: "100%",
    maxHeight: "85vh",
    overflowY: "auto" as const,
    background: "#ffffff",
    borderRadius: 24,
    padding: 28,
    boxShadow: "0 28px 80px rgba(15,23,42,0.35)",
    border: "1px solid #dbe4f0",
  },

  privacyModalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 18,
  },

  privacyModalTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 900,
    color: "#1e293b",
  },

  privacyModalIconButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#1e293b",
    fontSize: 28,
    lineHeight: 1,
    cursor: "pointer",
  },

  privacyModalBody: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },

  privacyModalParagraph: {
    margin: 0,
    color: "#334155",
    fontSize: 15,
    lineHeight: 1.6,
  },

  privacyModalActions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 24,
  },

  loadingInline: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    lineHeight: 1,
    whiteSpace: "nowrap" as const,
  },

  spinnerIcon: {
    width: 16,
    height: 16,
    borderRadius: 999,
    border: "2px solid rgba(255,255,255,0.55)",
    borderTopColor: "#ffffff",
    animation: "carbon-app-spin 0.75s linear infinite",
    display: "inline-block",
    flex: "0 0 auto",
  },

  countsToolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap" as const,
  },

  countsRefreshInfo: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 38,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#e2e8f0",
    border: "1px solid #cbd5e1",
    color: "#334155",
    fontSize: 13,
    fontWeight: 800,
  },

  progressReportTable: {
    width: "100%",
    tableLayout: "fixed" as const,
    fontSize: 11,
  },

  progressTableWrap: {
    maxHeight: 420,
    overflowY: "auto" as const,
    overflowX: "auto" as const,
    marginTop: 14,
    border: "1px solid #d8e0ec",
    borderRadius: 16,
    background: "#ffffff",
  },

  progressTh: {
    background: "#edf3f8",
    color: "#123b64",
    fontWeight: 900,
    fontSize: 10,
    padding: "7px 1px",
    borderBottom: "1px solid #d7dee8",
    whiteSpace: "normal" as const,
    lineHeight: 1.1,
    overflow: "visible" as const,
    textOverflow: "clip",
  },

  progressTd: {
    padding: "7px 2px",
    borderBottom: "1px solid #e2e8f0",
    color: "#123b64",
    fontSize: 10.5,
    overflow: "hidden" as const,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },

  progressCheckDone: {
    width: 18,
    height: 18,
    borderRadius: 6,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#dcfce7",
    border: "2px solid #22c55e",
    color: "#166534",
    fontWeight: 900,
    fontSize: 15,
    lineHeight: 1,
  },

  progressCheckEmpty: {
    width: 18,
    height: 18,
    borderRadius: 6,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#ffffff",
    border: "2px solid #cbd5e1",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 15,
    lineHeight: 1,
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
