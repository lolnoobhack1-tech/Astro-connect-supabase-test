import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (cache time)
      retry: 2,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Query keys
export const QUERY_KEYS = {
  PROFILE: 'profile',
  PROFILES: 'profiles',
  COMPATIBILITY: 'compatibility',
  KUNDLI: 'kundli',
  MATCHES: 'matches',
} as const;
