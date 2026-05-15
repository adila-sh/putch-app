import { useState, useEffect } from "react";
import { EnvironmentService, Environment } from "../services/enviroments";

export function useEnvironments(collectionId?: string) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEnvironments = async () => {
    if (!collectionId) {
      setEnvironments([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await EnvironmentService.findAll(collectionId);
      setEnvironments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load environments");
    } finally {
      setLoading(false);
    }
  };

  const createEnvironment = async (name: string, variables: Record<string, string>) => {
    if (!collectionId) throw new Error("Collection ID is required");
    setError(null);
    try {
      const newEnvironment = await EnvironmentService.create(collectionId, name, variables);
      setEnvironments((prev) => [...prev, newEnvironment]);
      return newEnvironment;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create environment");
      throw err;
    }
  };

  const deleteEnvironment = async (id: string) => {
    setError(null);
    try {
      await EnvironmentService.delete(id);
      setEnvironments((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete environment");
      throw err;
    }
  };

  const updateEnvironment = async (id: string, name: string, variables: Record<string, string>) => {
    setError(null);
    try {
      await EnvironmentService.update(id, name, variables);
      setEnvironments((prev) =>
        prev.map((e) => (e.id === id ? { ...e, name, variables } : e))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update environment");
      throw err;
    }
  };

  useEffect(() => {
    loadEnvironments();
  }, [collectionId]);

  return {
    environments,
    loading,
    error,
    loadEnvironments,
    createEnvironment,
    deleteEnvironment,
    updateEnvironment,
  };
}

