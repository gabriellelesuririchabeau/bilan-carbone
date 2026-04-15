export type Screen =
  | "home"
  | "teacher_login"
  | "teacher_dashboard"
  | "teacher_session_settings"
  | "student_login"
  | "student_mise_en_oeuvre"
  | "student_transport"
  | "student_dejeuner"
  | "student_equipement"
  | "student_autres"
  | "student_analyses"
  | "student_bilans"
  | "student_synthese"
  | "student_vote"
  | "admin_dashboard";

export type TeacherMenu = "sessions" | "session_open" | "mise_en_oeuvre";

export type TeacherSessionTab =
  | "counts"
  | "users"
  | "analyses"
  | "vote"
  | "bilans"
  | "synthese";

export type TeacherAnalysesTab = "donnees_a_reporter" | "report_des_donnees";
export type StudentAnalysesTab = "donnees_a_reporter" | "report_des_donnees";

export type SessionRow = {
  id: string;
  title: string;
  campus: string | null;
  session_code: string | null;
  allowed_emails?: string[] | null;
  created_at?: string;
};

export type TransportTrip = {
  mode: string;
  distanceKm: string;
  carType: string;
  carPassengers: string;
};

export type DejeunerState = {
  sandwich: string;
  quiche_pizza: string;
  frites_chips: string;
  oeufs: string;
  viande_rouge: string;
  autre_viande: string;
  poisson: string;
  accompagnement: string;
  plat_pates: string;
  salade_composee: string;
  fruit_local: string;
  fruit_importe: string;
  laitage: string;
  dessert: string;
  boissons: string[];
};

export type EquipementState = {
  used_equipment: string[];
  emails_with_attachment: string;
  emails_without_attachment: string;
  social_prep_minutes: string;
  social_during_class_minutes: string;
  ai_prep_minutes: string;
  ai_during_class_minutes: string;
};

export type AutresState = {
  snacks: string[];
  local_fruits: string[];
  imported_fruits: string[];
  hot_drinks: string[];
};

export type ResponseCounts = {
  transport_count: number;
  dejeuner_count: number;
  equipement_count: number;
  autres_count: number;
};

export type GroupReportRow = {
  id: string;
  session_id: string;
  group_number: number | null;
  theme: string;
  row_key: string;
  label: string;
  quantity: number | null;
  persons: number | null;
  factor: number | null;
  updated_by: string | null;
  updated_at: string | null;
};

export type BuiltTransportRow = {
  id: string | null;
  rowKey: string;
  label: string;
  factor: number;
  persons: number;
  distanceTotalKm: number;
  updatedBy: string | null;
};

export type ReportableRow = {
  rowKey: string;
  label: string;
  persons: number;
  quantity: number;
};

export type StudentCompletion = {
  transport: boolean;
  dejeuner: boolean;
  equipement: boolean;
  autres: boolean;
};

export type QuestionnaireKey = keyof StudentCompletion;

export type StudentDraft = {
  transportTrips: TransportTrip[];
  dejeuner: DejeunerState;
  equipement: EquipementState;
  autres: AutresState;
  studentCompletion: StudentCompletion;
  screen:
    | "student_mise_en_oeuvre"
    | "student_transport"
    | "student_dejeuner"
    | "student_equipement"
    | "student_autres"
    | "student_analyses"
    | "student_bilans"
    | "student_synthese"
    | "student_vote";
  groupProposals?: Record<number, GroupProposalState>;
};

export type TeacherDraft = {
  teacherMenu: TeacherMenu;
  teacherSessionTab: TeacherSessionTab;
  teacherAnalysesTab: TeacherAnalysesTab;
  teacherGroupNumber: number;
};

export type AdminTab = "teachers" | "sessions";

export type GroupProposalRow = {
  session_id: string;
  group_number: number;
  proposal_1: string | null;
  proposal_2: string | null;
  proposal_3: string | null;
  is_validated: boolean | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

export type GroupProposalState = {
  proposal_1: string;
  proposal_2: string;
  proposal_3: string;
  is_validated: boolean;
};

export type ConsolidatedProposalRow = {
  id?: string;
  session_id: string;
  theme: string;
  text: string;
  source_group_numbers: number[];
  created_at?: string | null;
};

export type ConsolidatedProposalState = {
  text: string;
  theme: string;
  sourceGroupNumbers: number[];
};

export type ProposalVoteRow = {
  id?: string;
  session_id: string;
  proposal_id: string;
  student_email: string;
  rank: number;
  created_at?: string | null;
};