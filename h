[1mdiff --git a/src/App.tsx b/src/App.tsx[m
[1mindex b81a97f..5d63ebe 100644[m
[1m--- a/src/App.tsx[m
[1m+++ b/src/App.tsx[m
[36m@@ -3124,82 +3124,23 @@[m [masync function loadGroupReportRowsWithFallback([m
     return;[m
   }[m
 [m
[31m-  const fetchRowsForSessionIds = async (sessionIds: string[]) => {[m
[31m-    let query = supabase[m
[31m-      .from("group_reports")[m
[31m-      .select("*")[m
[31m-      .in("theme", themes)[m
[31m-      .order("group_number", { ascending: true })[m
[31m-      .order("row_key", { ascending: true });[m
[31m-[m
[31m-    if (sessionIds.length === 1) {[m
[31m-      query = query.eq("session_id", sessionIds[0]);[m
[31m-    } else {[m
[31m-      query = query.in("session_id", sessionIds);[m
[31m-    }[m
[31m-[m
[31m-    return await query;[m
[31m-  };[m
[31m-[m
[31m-  const direct = await fetchRowsForSessionIds([sessionId]);[m
[31m-[m
[31m-  if (direct.error) {[m
[31m-    setMessage(`Erreur chargement report ${errorLabel} : ${direct.error.message}`);[m
[31m-    setRows([]);[m
[31m-    return;[m
[31m-  }[m
[31m-[m
[31m-  const directRows = normalizeGroupReportRows((direct.data ?? []) as GroupReportRow[]);[m
[31m-[m
[31m-  if (directRows.length > 0) {[m
[31m-    setRows(directRows);[m
[31m-    return;[m
[31m-  }[m
[31m-[m
[31m-  const candidateCode = String(selectedSessionCode || studentSelectedSessionCode || studentCodeSession || "").trim();[m
[31m-  if (!candidateCode) {[m
[31m-    setRows([]);[m
[31m-    return;[m
[31m-  }[m
[31m-[m
[31m-  const { data: matchingSessions, error: sessionError } = await supabase[m
[31m-    .from("sessions")[m
[31m-    .select("id, session_code")[m
[31m-    .ilike("session_code", candidateCode)[m
[31m-    .limit(20);[m
[31m-[m
[31m-  if (sessionError) {[m
[31m-    console.warn(`Fallback session_code impossible pour ${errorLabel}`, sessionError.message);[m
[31m-    setRows([]);[m
[31m-    return;[m
[31m-  }[m
[31m-[m
[31m-  const matchingSessionIds = Array.from([m
[31m-    new Set((matchingSessions ?? []).map((session: any) => String(session.id)).filter(Boolean))[m
[31m-  );[m
[31m-[m
[31m-  if (!matchingSessionIds.length || (matchingSessionIds.length === 1 && matchingSessionIds[0] === sessionId)) {[m
[31m-    setRows([]);[m
[31m-    return;[m
[31m-  }[m
[31m-[m
[31m-  const fallback = await fetchRowsForSessionIds(matchingSessionIds);[m
[32m+[m[32m  const { data, error } = await supabase[m
[32m+[m[32m    .from("group_reports")[m
[32m+[m[32m    .select("*")[m
[32m+[m[32m    .eq("session_id", sessionId)[m
[32m+[m[32m    .in("theme", themes)[m
[32m+[m[32m    .order("group_number", { ascending: true })[m
[32m+[m[32m    .order("row_key", { ascending: true });[m
 [m
[31m-  if (fallback.error) {[m
[31m-    setMessage(`Erreur chargement report ${errorLabel} : ${fallback.error.message}`);[m
[32m+[m[32m  if (error) {[m
[32m+[m[32m    setMessage(`Erreur chargement report ${errorLabel} : ${error.message}`);[m
     setRows([]);[m
     return;[m
   }[m
 [m
[31m-  const fallbackRows = normalizeGroupReportRows((fallback.data ?? []) as GroupReportRow[]);[m
[31m-  if (fallbackRows.length > 0) {[m
[31m-    console.warn([m
[31m-      `[DEBUG] Reports ${errorLabel} chargés via fallback session_code`,[m
[31m-      { requestedSessionId: sessionId, candidateCode, matchingSessionIds, rows: fallbackRows.length }[m
[31m-    );[m
[31m-  }[m
[31m-[m
[31m-  setRows(fallbackRows);[m
[32m+[m[32m  // Lecture stricte : on ne va jamais chercher des données d'une ancienne session[m
[32m+[m[32m  // avec le même code. Cela évite les reports fantômes et réduit l'egress.[m
[32m+[m[32m  setRows(normalizeGroupReportRows((data ?? []) as GroupReportRow[]));[m
 }[m
 [m
 async function loadEquipementReportRows([m
[36m@@ -3470,6 +3411,26 @@[m [masync function toggleStudentAnalysisAccess() {[m
     await loadSessionVoteAccess(selectedSessionId);[m
   }[m
 [m
[32m+[m[32m  function notifyTransportReportChanged(sessionId: string) {[m
[32m+[m[32m    if (!sessionId || typeof window === "undefined") return;[m
[32m+[m
[32m+[m[32m    const payload = {[m
[32m+[m[32m      sessionId,[m
[32m+[m[32m      theme: "transport",[m
[32m+[m[32m      timestamp: Date.now(),[m
[32m+[m[32m    };[m
[32m+[m
[32m+[m[32m    try {[m
[32m+[m[32m      window.localStorage.setItem("group_reports_changed", JSON.stringify(payload));[m
[32m+[m[32m    } catch {[m
[32m+[m[32m      // localStorage peut être indisponible en navigation privée stricte.[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    window.dispatchEvent([m
[32m+[m[32m      new CustomEvent("group_reports_changed_local", { detail: payload })[m
[32m+[m[32m    );[m
[32m+[m[32m  }[m
[32m+[m
   async function saveTransportReportRow(params: {[m
     sessionId: string;[m
     groupNumber: number;[m
[36m@@ -3553,8 +3514,11 @@[m [masync function toggleStudentAnalysisAccess() {[m
       return;[m
     }[m
 [m
[32m+[m[32m    notifyTransportReportChanged(sessionId);[m
[32m+[m
     // Pas de reload immédiat côté étudiant : cela évite qu'une réponse réseau plus ancienne[m
[31m-    // remette l'ancienne valeur pendant la frappe. Le prof est rafraîchi par polling/realtime.[m
[32m+[m[32m    // remette l'ancienne valeur pendant la frappe. Le prof est rafraîchi par Realtime[m
[32m+[m[32m    // ou par l'événement localStorage entre fenêtres du même navigateur.[m
     if (selectedSessionId === sessionId) {[m
       window.setTimeout(() => {[m
         void loadTransportReportRows(sessionId, setTeacherTransportReportRowsDb);[m
[36m@@ -3907,12 +3871,9 @@[m [masync function saveSalleReportRow(params: {[m
     const timeoutId = window.setTimeout(() => {[m
       void loadSessionCounts(selectedSessionId);[m
     }, 0);[m
[31m-    const intervalId = window.setInterval(() => {[m
[31m-    }, 2000);[m
 [m
     return () => {[m
       window.clearTimeout(timeoutId);[m
[31m-      window.clearInterval(intervalId);[m
     };[m
   }, [teacherMenu, teacherSessionTab, selectedSessionId]);[m
 [m
[36m@@ -3938,35 +3899,63 @@[m [masync function saveSalleReportRow(params: {[m
       void loadConsolidatedProposals(selectedSessionId);[m
       void loadTeacherVoteRows(selectedSessionId);[m
     }, 0);[m
[31m-    const intervalId = window.setInterval(() => {[m
[31m-      void loadTransportReportRows(selectedSessionId, setTeacherTransportReportRowsDb);[m
[31m-      void loadTransportReportableRows(selectedSessionId, setTeacherTransportReportableRows);[m
[31m-      void loadTeacherDejeunerReportableRows(selectedSessionId);[m
[31m-      void loadDejeunerReportRows(selectedSessionId, setTeacherDejeunerReportRowsDb);[m
[31m-      void loadTeacherEquipementReportableRows(selectedSessionId);[m
[31m-      void loadEquipementReportRows(selectedSessionId, setTeacherEquipementReportRowsDb);[m
[31m-      void loadTeacherAutresReportableRows(selectedSessionId);[m
[31m-      void loadAutresReportRows(selectedSessionId, setTeacherAutresReportRowsDb);[m
[31m-      void loadSalleReportRows(selectedSessionId, setTeacherSalleReportRowsDb);[m
[31m-      void loadSessionAnalysisAccess(selectedSessionId);[m
[31m-      void loadSessionSyntheseAccess(selectedSessionId);[m
[31m-      void loadSessionVoteAccess(selectedSessionId);[m
[31m-      void loadTeacherGroupProposals(selectedSessionId);[m
[31m-      void loadConsolidatedProposals(selectedSessionId);[m
[31m-      void loadTeacherVoteRows(selectedSessionId);[m
[31m-    }, 2000);[m
[31m-[m
     return () => {[m
       window.clearTimeout(timeoutId);[m
[31m-      window.clearInterval(intervalId);[m
     };[m
   }, [screen, selectedSessionId, teacherMenu]);[m
 [m
   useEffect(() => {[m
     if (!selectedSessionId) return;[m
 [m
[32m+[m[32m    function reloadChangedTheme(theme: string | null | undefined) {[m
[32m+[m[32m      const normalizedTheme = normalizeGroupReportTheme(theme);[m
[32m+[m
[32m+[m[32m      if (normalizedTheme === "transport") {[m
[32m+[m[32m        void loadTransportReportRows(selectedSessionId, setTeacherTransportReportRowsDb);[m
[32m+[m[32m        return;[m
[32m+[m[32m      }[m
[32m+[m
[32m+[m[32m      if (normalizedTheme === "dejeuner") {[m
[32m+[m[32m        void loadDejeunerReportRows(selectedSessionId, setTeacherDejeunerReportRowsDb);[m
[32m+[m[32m        return;[m
[32m+[m[32m      }[m
[32m+[m
[32m+[m[32m      if (normalizedTheme === "equipement") {[m
[32m+[m[32m        void loadEquipementReportRows(selectedSessionId, setTeacherEquipementReportRowsDb);[m
[32m+[m[32m        return;[m
[32m+[m[32m      }[m
[32m+[m
[32m+[m[32m      if (normalizedTheme === "autres_consommations") {[m
[32m+[m[32m        void loadAutresReportRows(selectedSessionId, setTeacherAutresReportRowsDb);[m
[32m+[m[32m        return;[m
[32m+[m[32m      }[m
[32m+[m
[32m+[m[32m      if (normalizedTheme === "salle") {[m
[32m+[m[32m        void loadSalleReportRows(selectedSessionId, setTeacherSalleReportRowsDb);[m
[32m+[m[32m      }[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    function handleLocalGroupReportChange(event: Event) {[m
[32m+[m[32m      const customEvent = event as CustomEvent<{ sessionId?: string; theme?: string }>;[m
[32m+[m[32m      const payload = customEvent.detail;[m
[32m+[m[32m      if (!payload || payload.sessionId !== selectedSessionId) return;[m
[32m+[m[32m      reloadChangedTheme(payload.theme);[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    function handleStorageGroupReportChange(event: StorageEvent) {[m
[32m+[m[32m      if (event.key !== "group_reports_changed" || !event.newValue) return;[m
[32m+[m
[32m+[m[32m      try {[m
[32m+[m[32m        const payload = JSON.parse(event.newValue) as { sessionId?: string; theme?: string };[m
[32m+[m[32m        if (payload.sessionId !== selectedSessionId) return;[m
[32m+[m[32m        reloadChangedTheme(payload.theme);[m
[32m+[m[32m      } catch {[m
[32m+[m[32m        // Ignore les anciens formats ou valeurs invalides.[m
[32m+[m[32m      }[m
[32m+[m[32m    }[m
[32m+[m
     const channel = supabase[m
[31m-      .channel(`teacher-transport-report-${selectedSessionId}`)[m
[32m+[m[32m      .channel(`teacher-group-reports-${selectedSessionId}`)[m
       .on([m
         "postgres_changes",[m
         {[m
[36m@@ -3977,14 +3966,18 @@[m [masync function saveSalleReportRow(params: {[m
         },[m
         (payload) => {[m
           const nextRow = ((payload as any).new ?? (payload as any).old) as GroupReportRow | undefined;[m
[31m-          if (normalizeGroupReportTheme(nextRow?.theme) !== "transport") return;[m
[31m-          void loadTransportReportRows(selectedSessionId, setTeacherTransportReportRowsDb);[m
[32m+[m[32m          reloadChangedTheme(nextRow?.theme);[m
         }[m
       )[m
       .subscribe();[m
 [m
[32m+[m[32m    window.addEventListener("group_reports_changed_local", handleLocalGroupReportChange as EventListener);[m
[32m+[m[32m    window.addEventListener("storage", handleStorageGroupReportChange);[m
[32m+[m
     return () => {[m
       void supabase.removeChannel(channel);[m
[32m+[m[32m      window.removeEventListener("group_reports_changed_local", handleLocalGroupReportChange as EventListener);[m
[32m+[m[32m      window.removeEventListener("storage", handleStorageGroupReportChange);[m
     };[m
   }, [selectedSessionId]);[m
 [m
