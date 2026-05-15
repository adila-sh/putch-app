import { useState, useEffect } from "react";
import {
  RequestService,
  type Request,
  type RequestConfig,
  type ResponseData,
  type CreateRequestData,
} from "../services/request.service";

export function useRequests(collectionId?: string) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = async () => {
    if (!collectionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await RequestService.findByCollectionId(collectionId);
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const createRequest = async (data: CreateRequestData) => {
    setError(null);
    try {
      const newRequest = await RequestService.create(data);
      setRequests((prev) => [...prev, newRequest]);
      return newRequest;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create request");
      throw err;
    }
  };

  const deleteRequest = async (id: string) => {
    setError(null);
    try {
      await RequestService.delete(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete request");
      throw err;
    }
  };

  const updateRequest = async (id: string, data: Partial<Request>) => {
    setError(null);
    try {
      await RequestService.update(id, data);
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...data } : r))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update request");
      throw err;
    }
  };

  useEffect(() => {
    loadRequests();
  }, [collectionId]);

  return {
    requests,
    loading,
    error,
    loadRequests,
    createRequest,
    deleteRequest,
    updateRequest,
  };
}

export function useRequestSender() {
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendRequest = async (config: RequestConfig) => {
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const data = await RequestService.send(config);
      setResponse(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send request";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    response,
    loading,
    error,
    sendRequest,
  };
}

