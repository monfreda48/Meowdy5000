import React from 'react';
import ProfileAvatar from './ProfileAvatar';

export default function ProfileIdentityBanner({ player }) {
  if (!player) return null;

  const username = player.username || player.current?.username || 'Player';
  const uid = player.uid || player.current?.uid || '--';
  const rankName = player.rank || player.current?.rank || 'Unranked';
  const level = player.level ?? player.player_level ?? player.playerLevel ?? 1;
  const avatarUrl = player.current?.avatarUrl || player.avatarUrl;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-left select-none">
      <ProfileAvatar avatarUrl={avatarUrl} level={level} username={username} />
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {username}
          </h1>
          {uid && uid !== username && uid !== '--' && (
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-bold tracking-wider select-all">
              UID: {uid}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-xs px-2.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-extrabold border border-emerald-500/30 uppercase tracking-wide">
            {rankName}
          </span>
          <span className="text-xs text-slate-400 font-semibold font-mono">
            Level {level}
          </span>
        </div>
      </div>
    </div>
  );
}
