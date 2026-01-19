import { useState, useEffect } from 'react';
import { fetchWithRetry } from '@/lib/api';

interface CompatibilityScore {
  total_gunas: number;
  max_gunas: number;
  verdict: string;
  breakdown: {
    Varna: number;
    Vashya: number;
    Tara: number;
    Yoni: number;
    "Graha Maitri": number;
    Gana: number;
    Bhakoot: number;
    Nadi: number;
  };
}

export function useCompatibilityScore(profileId: string | null) {
  const [score, setScore] = useState<CompatibilityScore | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!profileId) return;

    let isMounted = true;
    const controller = new AbortController();

    const fetchScore = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await fetchWithRetry<CompatibilityScore>(
          `/api/compatibility/score?profileId=${profileId}`,
          { signal: controller.signal }
        );
        
        if (isMounted) {
          setScore(data);
        }
      } catch (err) {
        if (err.name !== 'AbortError' && isMounted) {
          console.error('Error fetching compatibility score:', err);
          setError(err instanceof Error ? err : new Error('Failed to load score'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Add a small delay to prevent flash of loading state for fast responses
    const timer = setTimeout(fetchScore, 300);

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [profileId]);

  return { score, isLoading, error };
}
