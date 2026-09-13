import React from 'react';

export default function ProfileAvatar({ avatarUrl, level = 1, username = "Player" }) {
  return (
    <div className="relative inline-block mt-2 shrink-0 select-none">
      {/* Overlapping Player Level Badge */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded bg-[#0b0e1b] border-2 border-[#f6c344] shadow-md flex items-center justify-center min-w-[32px]">
        <span className="text-xs font-black text-white font-mono tracking-tight leading-none">
          {level || 1}
        </span>
      </div>

      {/* Avatar Image Frame */}
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 border-[#f6c344] overflow-hidden bg-slate-900 shadow-lg flex items-center justify-center relative">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={username}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : null}
        <div className="w-full h-full flex items-center justify-center font-black text-xl text-white bg-gradient-to-br from-emerald-500 to-teal-600">
          {username ? username.slice(0, 2).toUpperCase() : 'P'}
        </div>
      </div>
    </div>
  );
}
