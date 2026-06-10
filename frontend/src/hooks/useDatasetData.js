import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

/* Caricamento dei dati di un progetto (persone, turni, run) in un punto
   solo: stessa gestione di errori e refresh per tutti i componenti. */
export function useDatasetData(dsId, { withRuns = false } = {}) {
  const [resources, setResources] = useState([]);
  const [slots, setSlots] = useState([]);
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [r, s, ru] = await Promise.all([
        api.resources(dsId),
        api.slots(dsId),
        withRuns ? api.runs(dsId) : Promise.resolve([]),
      ]);
      setResources(r);
      setSlots(s);
      if (withRuns) setRuns(ru);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dsId, withRuns]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  return { resources, slots, runs, error, loading, refresh };
}
