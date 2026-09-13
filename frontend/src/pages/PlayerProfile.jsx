import React from 'react';
import PrivateProfileBanner from '../components/PrivateProfileBanner';

export default function PlayerProfile({
  stats,
  loading = false,
  onRecheck,
  onOpenUidGuide,
  children
}) {
  const isPrivate = Boolean(
    stats?.is_private === true ||
    stats?.error_code === 'PROFILE_PRIVATE' ||
    stats?.current?.is_private === true ||
    stats?.current?.error_code === 'PROFILE_PRIVATE'
  );

  const activeUsername = stats?.username || stats?.current?.username || 'Player';

  if (isPrivate) {
    return (
      <div className="w-full space-y-6">
        <PrivateProfileBanner
          username={activeUsername}
          loading={loading}
          onRecheck={onRecheck}
          onOpenUidGuide={onOpenUidGuide}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      {children}
    </div>
  );
}
