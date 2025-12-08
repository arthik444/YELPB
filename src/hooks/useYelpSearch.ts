import { useState, useCallback } from 'react';
import { apiService, Business, SearchRequest, ChatRequest, ChatResponse } from '../services/api';

export function useYelpSearch() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (request: SearchRequest) => {
    setLoading(true);
    setError(null);

    try {
      const results = await apiService.searchBusinesses(request);
      setBusinesses(results);
      return results;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to search restaurants';
      setError(errorMessage);
      console.error('Search error:', errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const chat = useCallback(async (request: ChatRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.chat(request);
      setBusinesses(response.businesses);
      return response;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to chat with Yelp AI';
      setError(errorMessage);
      console.error('Chat error:', errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setBusinesses([]);
    setError(null);
  }, []);

  return {
    businesses,
    loading,
    error,
    search,
    chat,
    reset,
  };
}
