export default function PlatformIcon({ platform, className = "w-4 h-4", size = 16 }) {
  const norm = (platform || 'pc').toString().toLowerCase().trim();

  let iconSvg = null;
  let titleText = 'PC (Steam / Windows)';
  let colorClass = 'text-slate-300';

  if (norm.includes('ps') || norm.includes('playstation') || norm.includes('sony')) {
    titleText = 'PlayStation 5';
    colorClass = 'text-blue-400';
    iconSvg = (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${className} ${colorClass}`}
      >
        <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm-1.8 14.7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm0-4.7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3.6 4.7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm0-4.7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm2.4-2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />
        <path d="M8.5 7.5L12 4l3.5 3.5L12 11z" />
      </svg>
    );
  } else if (norm.includes('xbox') || norm.includes('microsoft') || norm.includes('xb')) {
    titleText = 'Xbox';
    colorClass = 'text-emerald-400';
    iconSvg = (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${className} ${colorClass}`}
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-3.71 4.54c1.19.89 2.53 2.19 3.71 3.58 1.18-1.39 2.52-2.69 3.71-3.58 1.83 1.34 3.09 3.39 3.48 5.75-.43.51-1.78 1.83-3.8 2.76.01.07.01.14.01.21 0 2.65-1.52 4.94-3.4 5.74-1.88-.8-3.4-3.09-3.4-5.74 0-.07 0-.14.01-.21-2.02-.93-3.37-2.25-3.8-2.76.39-2.36 1.65-4.41 3.48-5.75z" />
      </svg>
    );
  } else {
    // Default PC / Steam / Desktop
    titleText = 'PC (Steam / Windows)';
    colorClass = 'text-slate-300';
    iconSvg = (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${className} ${colorClass}`}
      >
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  }

  return (
    <span
      title={`Platform: ${titleText}`}
      className="inline-flex items-center justify-center transition-colors cursor-help shrink-0"
    >
      {iconSvg}
    </span>
  );
}
