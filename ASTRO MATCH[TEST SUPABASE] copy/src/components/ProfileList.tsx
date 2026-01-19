import React, { useState, useEffect } from 'react';
import { useProfiles, usePrefetchNextPage } from '@/hooks/useProfiles';
import { ErrorBoundary } from './ErrorBoundary';

const ProfileCard: React.FC<{ profile: any }> = ({ profile }) => (
  <div className="bg-white rounded-lg shadow-md p-6 mb-4">
    <div className="flex items-center space-x-4">
      {profile.photoUrl ? (
        <img
          src={profile.photoUrl}
          alt={profile.name}
          className="w-16 h-16 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
          <span className="text-gray-500">
            {profile.name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div>
        <h3 className="text-lg font-semibold">{profile.name}</h3>
        <p className="text-gray-600 text-sm">
          {new Date(profile.birthDate).toLocaleDateString()}
        </p>
        <p className="text-gray-600 text-sm">{profile.birthPlace}</p>
      </div>
    </div>
  </div>
);

const ProfileList: React.FC = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useProfiles(page);
  const prefetchNextPage = usePrefetchNextPage(page);

  // Prefetch next page when current page data is loaded
  useEffect(() => {
    if (data?.hasMore) {
      prefetchNextPage();
    }
  }, [data, prefetchNextPage]);

  if (isLoading && page === 1) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-lg p-6 h-24" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center p-4 text-red-600">
        {error?.message || 'Failed to load profiles'}
      </div>
    );
  }

  if (!data?.data?.length) {
    return <div className="text-center p-4 text-gray-500">No profiles found</div>;
  }

  return (
    <div className="space-y-4">
      <ErrorBoundary>
        {data.data.map((profile) => (
          <ProfileCard key={profile.id} profile={profile} />
        ))}
      </ErrorBoundary>

      <div className="flex justify-between items-center mt-6">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-600">
          Page {page} {data.hasMore ? '' : '(Last Page)'}
        </span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={!data.hasMore}
          className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default ProfileList;
