import { useState, useEffect } from "react";
import { CollectionsService, Collection } from "../services/collections.service";

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCollections = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await CollectionsService.findAll();
      setCollections(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load collections");
    } finally {
      setLoading(false);
    }
  };

  const createCollection = async (name: string) => {
    setError(null);
    try {
      const newCollection = await CollectionsService.create(name);
      setCollections((prev) => [...prev, newCollection]);
      return newCollection;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create collection");
      throw err;
    }
  };

  const deleteCollection = async (id: string) => {
    setError(null);
    try {
      await CollectionsService.delete(id);
      setCollections((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete collection");
      throw err;
    }
  };

  const updateCollection = async (id: string, name: string) => {
    setError(null);
    try {
      await CollectionsService.update(id, name);
      setCollections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name } : c))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update collection");
      throw err;
    }
  };

  useEffect(() => {
    loadCollections();
  }, []);

  return {
    collections,
    loading,
    error,
    loadCollections,
    createCollection,
    deleteCollection,
    updateCollection,
  };
}

