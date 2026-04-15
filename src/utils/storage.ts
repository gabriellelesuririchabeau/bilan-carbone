export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getStudentDraftKey(email: string, sessionCode: string) {
  return `bilan-carbone:student:${normalizeEmail(email)}:${sessionCode.trim().toLowerCase()}`;
}

export function getTeacherDraftKey(email: string, sessionCode: string) {
  return `bilan-carbone:teacher:${normalizeEmail(email)}:${sessionCode.trim().toLowerCase()}`;
}
