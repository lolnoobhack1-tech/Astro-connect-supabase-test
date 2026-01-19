import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { fetchWithRetry, handleApiError } from '@/lib/api';
import { QUERY_KEYS } from '@/lib/queryClient';

const PAGE_SIZE = 20;

export interface Profile {
  id: string;
  name: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  gender: string;
  photoUrl?: string;
  // Add other profile fields as needed
}

export interface PaginatedProfiles {
  data: Profile[];
  page: number;
  total: number;
  hasMore: boolean;
}

export function useProfiles(page: number, options: Partial<UseQueryOptions<PaginatedProfiles, Error>> = {}) {
  return useQuery<PaginatedProfiles, Error>({
    queryKey: [QUERY_KEYS.PROFILES, page],
    queryFn: async () => {
      try {
        return await fetchWithRetry<PaginatedProfiles>(
          `/api/profiles?page=${page}&limit=${PAGE_SIZE}`
        );
      } catch (error) {
        handleApiError(error, 'Failed to load profiles');
        throw error;
      }
    },
    placeholderData: (previousData) => previousData,
    ...options,
  });
}

export function usePrefetchNextPage(page: number) {
  const queryClient = useQueryClient();
  
  return () => {
    const nextPage = page + 1;
    queryClient.prefetchQuery({
      queryKey: [QUERY_KEYS.PROFILES, nextPage],
      queryFn: () => 
        fetchWithRetry<PaginatedProfiles>(
          `/api/profiles?page=${nextPage}&limit=${PAGE_SIZE}`
        ),
    });
  };
}

// Utility hook for profile details
export function useProfile(profileId: string) {
  return useQuery<Profile, Error>({
    queryKey: [QUERY_KEYS.PROFILE, profileId],
    queryFn: async () => {
      try {
        return await fetchWithRetry<Profile>(`/api/profiles/${profileId}`);
      } catch (error) {
        handleApiError(error, 'Failed to load profile');
        throw error;
      }
    },
    enabled: !!profileId,
  });
}
