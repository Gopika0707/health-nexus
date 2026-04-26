// =============================================
// HEALTH NEXUS — Vitals Data Hook
// =============================================

import { useState, useEffect } from "react";
import { patientService } from "@/services/api";
import type { VitalReading } from "@/types";

export function useVitals(patientId: string) {
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    patientService
      .getVitals(patientId)
      .then(setVitals)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  return { vitals, loading, error };
}
