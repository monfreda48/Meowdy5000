import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AVAILABLE_METRICS = [
  { id: 'winRate', name: 'Win Rate', icon: '🏆', category: 'Core' },
  { id: 'kdRatio', name: 'K/D/A Ratio', icon: '⚔️', category: 'Core' },
  { id: 'topHeroes', name: 'Top Heroes', icon: '🦸', category: 'Core' },
  { id: 'heroDamage', name: 'Hero / 10m', icon: '💥', category: 'Combat' },
  { id: 'healing', name: 'Healing / 10m', icon: '💚', category: 'Combat' },
  { id: 'damageBlocked', name: 'Dmg Blocked / 10m', icon: '🛡️', category: 'Combat' },
  { id: 'accuracy', name: 'Shots Accuracy', icon: '🎯', category: 'Combat' },
  { id: 'timePlayed', name: 'Total Playtime', icon: '⏱️', category: 'Profile' },
  { id: 'matchesPlayed', name: 'Matches & Wins', icon: '🎮', category: 'Profile' },
];

export default function App() {
  const [query, setQuery] = useState('');
  const [season, setSeason] = useState('19');
  const [timeframe, setTimeframe] = useState('all');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState(() => {
    try {
      const saved = localStorage.getItem('tracked_metrics');
      return saved ? JSON.parse(saved) : AVAILABLE_METRICS.map(m => m.id);
    } catch (e) {
      return AVAILABLE_METRICS.map(m => m.id);
    }
  });

  const toggleMetric = (id) => {
    let updated;
    if (selectedMetrics.includes(id)) {
      if (selectedMetrics.length === 1) return;
      updated = selectedMetrics.filter(mId => mId !== id);
    } else {
      updated = [...selectedMetrics, id];
    }
    setSelectedMetrics(updated);
    localStorage.setItem('tracked_metrics', JSON.stringify(updated));
  };

  const isMetricTracked = (id) => selectedMetrics.includes(id);

  const selectAllMetrics = () => {
    const allIds = AVAILABLE_METRICS.map(m => m.id);
    setSelectedMetrics(allIds);
    localStorage.setItem('tracked_metrics', JSON.stringify(allIds));
  };

  const resetDefaultMetrics = () => {
    const allIds = AVAILABLE_METRICS.map(m => m.id);
    setSelectedMetrics(allIds);
    localStorage.setItem('tracked_metrics', JSON.stringify(allIds));
  };

  const checkForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const res = await fetch('/api/check-update');
      const data = await res.json();
      setUpdateInfo(data);
    } catch (err) {
      console.error('Failed to check for updates:', err);
    } finally {
      setCheckingUpdate(false);
    }
  };

  useEffect(() => {
    checkForUpdates();
  }, []);

  const fetchStats = async (e, overrideQuery = null, overrideSeason = null) => {
    if (e) e.preventDefault();
    const activeQuery = overrideQuery !== null ? overrideQuery : query;
    const activeSeason = overrideSeason !== null ? overrideSeason : season;
    if (!activeQuery) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/stats?query=${encodeURIComponent(activeQuery)}&season=${encodeURIComponent(activeSeason)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch player stats.');
      }

      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredHistory = () => {
    if (!stats?.history) return [];
    if (timeframe === 'all') return stats.history;
    
    const now = new Date();
    const cutoff = new Date();
    if (timeframe === '7d') cutoff.setDate(now.getDate() - 7);
    if (timeframe === '30d') cutoff.setDate(now.getDate() - 30);
    
    return stats.history.filter(entry => new Date(entry.date) >= cutoff);
  };

  return (
    <div className="min-h-screen bg-[#0b101e] text-slate-200 font-sans selection:bg-orange-500/30 transition-all duration-300">
      
      {/* Top Navigation Bar */}
      <nav className="border-b border-slate-800 bg-[#0f1526]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center font-black text-white shadow-md shadow-orange-500/20 text-xs">
              SP
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs sm:text-sm font-bold tracking-widest text-slate-400 uppercase hidden xs:inline">MEOWDY 5000'S</span>
              <span className="text-base sm:text-xl font-black tracking-widest text-white uppercase">STAT TRACKER</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* GitHub Update Check Button */}
            <button
              onClick={checkForUpdates}
              disabled={checkingUpdate}
              title="Check GitHub for App Updates"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#131b2f] border border-slate-700/60 text-xs font-bold text-slate-300 hover:text-white hover:border-orange-500/50 transition-all shadow-inner disabled:opacity-50"
            >
              <svg className={`h-4 w-4 text-orange-400 ${checkingUpdate ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span className="hidden md:inline">
                {checkingUpdate ? 'Checking...' : updateInfo?.hasUpdate ? 'Update Available!' : 'GitHub Sync'}
              </span>
              {updateInfo?.hasUpdate && (
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping"></span>
              )}
            </button>

            {/* View Mode Toggle Switch (Top Right) */}
            <div className="flex items-center gap-2 bg-[#131b2f] p-1 rounded-xl border border-slate-700/60 shadow-inner">
              <button
                onClick={() => setIsMobileView(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  !isMobileView 
                    ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Desktop</span>
              </button>

              <button
                onClick={() => setIsMobileView(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isMobileView 
                    ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Mobile</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* GitHub Update Notification Banner */}
      {updateInfo?.hasUpdate && (
        <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white py-2.5 px-4 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-3 shadow-lg">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            New update available on GitHub! ({updateInfo.latestVersion} - {updateInfo.latestMessage})
          </span>
          <a
            href={updateInfo.commitUrl || updateInfo.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-black/30 hover:bg-black/50 text-white rounded-lg transition-colors border border-white/20 uppercase text-[11px] tracking-wider"
          >
            View on GitHub
          </a>
        </div>
      )}

      {/* Main Layout Container */}
      <main className={`mx-auto transition-all duration-300 ${
        isMobileView 
          ? 'max-w-md px-4 py-6 my-4 bg-[#0d1324] border border-slate-700/80 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.6)] space-y-6' 
          : 'max-w-6xl px-6 py-12 space-y-12'
      }`}>
        
        {/* Mobile View Badge Indicator */}
        {isMobileView && (
          <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/30 px-3 py-2 rounded-xl text-xs text-orange-400 font-medium">
            <span className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Mobile Preview Active
            </span>
            <button 
              onClick={() => setIsMobileView(false)} 
              className="text-slate-400 hover:text-white underline text-[11px]"
            >
              Switch to Desktop
            </button>
          </div>
        )}

        {/* Header & Search Section */}
        <div className={`flex flex-col items-center text-center ${isMobileView ? 'space-y-4' : 'space-y-6'}`}>
          <h1 className={`font-black tracking-tight text-white uppercase w-full flex flex-col gap-1 ${
            isMobileView ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-5xl md:text-6xl lg:text-7xl'
          }`}>
            <span>SN4K PACK:</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">SNACK HARD, TRACK HARD</span>
          </h1>

          {/* Active Season & Upcoming Season 10 Status Pill */}
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold text-orange-400 shadow-md">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Season 9.5 Active</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300 font-medium">Season 10 Starts Sept 11, 2026</span>
          </div>

          <form onSubmit={fetchStats} className={`w-full ${isMobileView ? 'mt-2' : 'max-w-3xl mt-8'}`}>
            <div className={`flex bg-[#131b2f] p-3 rounded-2xl border border-slate-700/50 shadow-2xl ${
              isMobileView ? 'flex-col gap-2.5' : 'flex-col md:flex-row gap-3'
            }`}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter Username or UID..."
                className={`w-full bg-[#0b101e] border border-slate-700/50 rounded-xl px-4 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all text-white placeholder-slate-500 ${
                  isMobileView ? 'py-3 text-base' : 'py-4 text-lg flex-1'
                }`}
                required
              />
              <div className={`flex gap-2 ${isMobileView ? 'w-full' : ''}`}>
                <select 
                  value={season} 
                  onChange={(e) => {
                    const selectedSeason = e.target.value;
                    setSeason(selectedSeason);
                    if (query) {
                      fetchStats(null, query, selectedSeason);
                    }
                  }}
                  className={`bg-[#0b101e] border border-slate-700/50 rounded-xl px-3 focus:outline-none focus:border-orange-500 text-white cursor-pointer text-sm ${
                    isMobileView ? 'py-3 flex-1' : 'py-4'
                  }`}
                >
                  <option value="19">Season 9.5 (Active)</option>
                  <option value="18">Season 9.0</option>
                  <option value="17">Season 8.5</option>
                  <option value="16">Season 8.0</option>
                  <option value="20">Season 10 (Sep 11)</option>
                  <option value="">Current Season</option>
                </select>
                <button 
                  type="submit"
                  disabled={loading}
                  className={`bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(249,115,22,0.3)] uppercase tracking-wider text-xs sm:text-sm ${
                    isMobileView ? 'py-3 px-5 flex-1' : 'py-4 px-8'
                  }`}
                >
                  {loading ? 'Scanning...' : 'Search'}
                </button>
              </div>
            </div>
          </form>

          {/* Customize What You Track Selection Box */}
          <div className={`w-full ${isMobileView ? '' : 'max-w-3xl'} text-left`}>
            <details className="group bg-[#131b2f] border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl transition-all duration-300" open>
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-bold text-slate-300 hover:text-orange-400 transition-colors list-none">
                <span className="flex items-center gap-2 uppercase tracking-widest text-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  ⚙️ Select Metrics to Track ({selectedMetrics.length}/{AVAILABLE_METRICS.length} Active)
                </span>
                <svg className="w-4 h-4 text-slate-500 transition-transform duration-300 group-open:-rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              
              <div className="p-4 bg-[#0f1526] border-t border-slate-700/50 space-y-3">
                <p className="text-xs text-slate-400">
                  Toggle what stats to display on your dashboard. Preferences save automatically:
                </p>

                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_METRICS.map((m) => {
                    const active = isMetricTracked(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMetric(m.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          active
                            ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500/60 text-white shadow-sm'
                            : 'bg-[#0b101e] border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <span>{m.icon}</span>
                        <span>{m.name}</span>
                        <span className={`w-2 h-2 rounded-full ${active ? 'bg-orange-400 shadow-[0_0_6px_rgba(249,115,22,0.8)]' : 'bg-slate-700'}`}></span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-slate-800/80 text-[11px]">
                  <button type="button" onClick={selectAllMetrics} className="text-orange-400 hover:text-orange-300 font-bold">Select All</button>
                  <span className="text-slate-600">•</span>
                  <button type="button" onClick={resetDefaultMetrics} className="text-slate-400 hover:text-white font-medium">Reset Defaults</button>
                </div>
              </div>
            </details>
          </div>

          {/* Expandable "How Tracking Works" Box */}
          <div className={`w-full ${isMobileView ? '' : 'max-w-3xl'} text-left`}>
            <details className="group bg-[#131b2f] border border-slate-700/50 rounded-xl overflow-hidden shadow-lg transition-all duration-300">
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-bold text-slate-400 hover:text-orange-400 transition-colors list-none">
                <span className="flex items-center gap-2 uppercase tracking-widest text-[11px]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  How does tracking work?
                </span>
                <svg className="w-4 h-4 transition-transform duration-300 group-open:-rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-4 pb-4 text-slate-300 text-xs sm:text-sm leading-relaxed border-t border-slate-700/50 pt-3 bg-[#0f1526]">
                Every time you hit <strong>Search</strong>, this app takes a live snapshot of your stats and securely saves it to a local database. Over time, these daily snapshots connect together to build your performance charts—revealing exactly how your Win Rate and KDA trend day by day!
              </div>
            </details>
          </div>

          {/* Error Message */}
          {error && (
            <div className="w-full max-w-3xl bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}
        </div>

        {/* Dashboard Results */}
        {stats && !loading && (
          <div className={`animate-in fade-in slide-in-from-bottom-8 duration-700 ${isMobileView ? 'space-y-5' : 'space-y-8'}`}>
            
            {/* Player Header Banner */}
            <div className={`bg-[#131b2f] rounded-2xl border border-slate-700/50 shadow-2xl flex flex-col items-center text-center gap-3 ${
              isMobileView ? 'p-4' : 'p-6 md:p-8 md:flex-row md:justify-between md:text-left'
            }`}>
              <div>
                <h2 className={`font-black text-white ${isMobileView ? 'text-2xl' : 'text-4xl'}`}>{stats.current.username}</h2>
                <p className="text-slate-400 uppercase tracking-widest text-xs mt-0.5 font-bold">
                  {stats.current.rank}
                </p>
              </div>
            </div>

            {/* Primary Tracked Metrics Grid */}
            <div className={`grid gap-4 ${
              isMobileView ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 md:gap-6'
            }`}>
              {/* Win Rate */}
              {isMetricTracked('winRate') && (
                <div className="bg-[#131b2f] p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Win Rate</p>
                  <p className={`font-black text-white ${isMobileView ? 'text-4xl' : 'text-5xl'}`}>{stats.current.winRate}%</p>
                </div>
              )}

              {/* KDA Ratio */}
              {isMetricTracked('kdRatio') && (
                <div className="bg-[#131b2f] p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">KDA Ratio</p>
                  <p className={`font-black text-white ${isMobileView ? 'text-4xl' : 'text-5xl'}`}>{stats.current.kdRatio}</p>
                </div>
              )}

              {/* Hero Damage */}
              {isMetricTracked('heroDamage') && (
                <div className="bg-[#131b2f] p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Hero / 10m</p>
                  <p className={`font-black text-orange-400 truncate ${isMobileView ? 'text-3xl' : 'text-4xl'}`}>
                    {typeof stats.current.heroDamage === 'number' ? stats.current.heroDamage.toLocaleString() : (stats.current.heroDamage || 'N/A')}
                  </p>
                </div>
              )}

              {/* Healing Output */}
              {isMetricTracked('healing') && (
                <div className="bg-[#131b2f] p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Healing / 10m</p>
                  <p className={`font-black text-emerald-400 truncate ${isMobileView ? 'text-3xl' : 'text-4xl'}`}>
                    {stats.current.healing || 'N/A'}
                  </p>
                </div>
              )}

              {/* Damage Blocked */}
              {isMetricTracked('damageBlocked') && (
                <div className="bg-[#131b2f] p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Dmg Blocked / 10m</p>
                  <p className={`font-black text-purple-400 truncate ${isMobileView ? 'text-3xl' : 'text-4xl'}`}>
                    {stats.current.damageBlocked || 'N/A'}
                  </p>
                </div>
              )}

              {/* Accuracy */}
              {isMetricTracked('accuracy') && (
                <div className="bg-[#131b2f] p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Accuracy</p>
                  <p className={`font-black text-yellow-400 ${isMobileView ? 'text-4xl' : 'text-5xl'}`}>
                    {stats.current.accuracy || 'N/A'}
                  </p>
                </div>
              )}

              {/* Total Playtime */}
              {isMetricTracked('timePlayed') && (
                <div className="bg-[#131b2f] p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total Playtime</p>
                  <p className={`font-black text-sky-400 ${isMobileView ? 'text-3xl' : 'text-4xl'}`}>
                    {stats.current.timePlayed || 'N/A'}
                  </p>
                </div>
              )}

              {/* Top Heroes */}
              {isMetricTracked('topHeroes') && (
                <div className="bg-[#131b2f] p-5 rounded-2xl border border-slate-700/50 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">Top Heroes</p>
                  
                  <div className="flex flex-col gap-2 relative z-10">
                    {stats.current.topHeroesDetailed && stats.current.topHeroesDetailed.length > 0 ? (
                      stats.current.topHeroesDetailed.map((hero, index) => (
                        <details key={index} className="group bg-[#0f1526] rounded-xl border border-slate-700/50 overflow-hidden shadow-sm">
                          <summary className="cursor-pointer flex items-center justify-between p-2.5 hover:bg-slate-800/50 transition-colors list-none">
                            <div className="flex items-center gap-2.5">
                              <div className="w-5 h-5 rounded bg-slate-800 border border-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-400 shadow-inner">
                                {index + 1}
                              </div>
                              <span className="text-base font-black text-emerald-400 truncate">{hero.name}</span>
                            </div>
                            <svg className="w-4 h-4 text-slate-500 transition-transform duration-300 group-open:-rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </summary>
                          <div className="p-3 border-t border-slate-700/50 bg-[#0b101e] grid grid-cols-2 gap-y-2.5 gap-x-3 text-left">
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Win Rate</p>
                              <p className="text-sm font-black text-orange-400">{hero.winRate}%</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">KDA Ratio</p>
                              <p className="text-sm font-black text-blue-400">{hero.kda}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Matches</p>
                              <p className="text-xs font-bold text-slate-200">{hero.matches}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Playtime</p>
                              <p className="text-xs font-bold text-slate-200">{hero.timePlayed}</p>
                            </div>
                          </div>
                        </details>
                      ))
                    ) : (
                      <div className="flex flex-col gap-2">
                        {stats.current.topHero.split(', ').map((hero, index) => (
                          <div key={index} className="flex items-center gap-2.5">
                            <div className="w-5 h-5 rounded bg-slate-800 border border-slate-600 flex items-center justify-center text-[10px] font-bold text-slate-400">
                              {index + 1}
                            </div>
                            <span className="text-lg font-black text-emerald-400 truncate">{hero}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Detailed Combat Telemetry Grid */}
            <div className={`grid gap-3 bg-[#131b2f] p-4 sm:p-5 rounded-2xl border border-slate-700/50 shadow-xl ${
              isMobileView ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }`}>
              {/* Card 1: Matches & Wins */}
              <div className="p-3.5 bg-[#0b101e] rounded-xl border border-slate-800/80 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  Matches & Wins
                  <span className="text-[10px] text-orange-400 font-semibold bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                    {stats.current.winRate}% WR
                  </span>
                </span>
                <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black text-white">{stats.current.matchesWon || 0}</span>
                  <span className="text-xs text-emerald-400 font-bold">Wins</span>
                  <span className="text-slate-600 text-xs font-bold">•</span>
                  <span className="text-xs text-slate-400 font-medium">{stats.current.matchesPlayed || 0} Total</span>
                </div>
              </div>

              {/* Card 2: KDA Breakdown */}
              <div className="p-3.5 bg-[#0b101e] rounded-xl border border-slate-800/80 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  Combat K / D / A
                  <span className="text-[10px] text-blue-400 font-semibold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                    {stats.current.kdRatio} KDA
                  </span>
                </span>
                <div className="mt-2 flex items-center gap-1.5 text-xs sm:text-sm font-black flex-wrap">
                  <span className="text-emerald-400 font-black">{stats.current.kills?.toLocaleString() || 0} <span className="text-[10px] text-slate-500 font-normal">K</span></span>
                  <span className="text-slate-600 font-normal">/</span>
                  <span className="text-red-400 font-black">{stats.current.deaths?.toLocaleString() || 0} <span className="text-[10px] text-slate-500 font-normal">D</span></span>
                  <span className="text-slate-600 font-normal">/</span>
                  <span className="text-blue-400 font-black">{stats.current.assists?.toLocaleString() || 0} <span className="text-[10px] text-slate-500 font-normal">A</span></span>
                </div>
              </div>

              {/* Card 3: Hero Damage */}
              <div className="p-3.5 bg-[#0b101e] rounded-xl border border-slate-800/80 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Damage</span>
                <div className="mt-2 flex items-baseline gap-1 truncate">
                  <span className="text-lg sm:text-xl md:text-2xl font-black text-orange-400 truncate">
                    {typeof stats.current.heroDamage === 'number' 
                      ? stats.current.heroDamage.toLocaleString() 
                      : (stats.current.heroDamage || 'N/A')}
                  </span>
                </div>
              </div>

              {/* Card 4: Total Playtime */}
              <div className="p-3.5 bg-[#0b101e] rounded-xl border border-slate-800/80 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Playtime</span>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-lg sm:text-xl md:text-2xl font-black text-blue-400">
                    {stats.current.timePlayed || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Trends Charts */}
            {stats.history && stats.history.length > 0 && (
              <div className="pt-4">
                
                <div className={`flex justify-between items-center mb-4 gap-3 ${
                  isMobileView ? 'flex-col items-start' : 'flex-col md:flex-row md:items-center'
                }`}>
                  <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider">Performance Trends</h2>
                  
                  <select 
                    value={timeframe} 
                    onChange={(e) => setTimeframe(e.target.value)}
                    className={`bg-[#131b2f] border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-orange-500 text-white text-xs font-bold cursor-pointer shadow-lg ${
                      isMobileView ? 'w-full' : ''
                    }`}
                  >
                    <option value="all">All-Time History</option>
                    <option value="30d">Past 30 Days</option>
                    <option value="7d">Past 7 Days</option>
                  </select>
                </div>

                <div className={`grid gap-4 ${isMobileView ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2 lg:gap-6'}`}>
                  
                  <div className="bg-[#131b2f] p-4 sm:p-6 rounded-2xl border border-slate-700/50 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Win Rate Progression</h3>
                      <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]"></div>
                    </div>
                    <div className={isMobileView ? 'h-48' : 'h-72'}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={getFilteredHistory()} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 10}} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" domain={['auto', 'auto']} tick={{fill: '#64748b', fontSize: 10}} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f1526', border: '1px solid #334155', borderRadius: '12px', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)', fontSize: '12px' }}
                            itemStyle={{ color: '#fb923c', fontWeight: 'bold' }}
                          />
                          <Line type="monotone" dataKey="winRate" stroke="#fb923c" strokeWidth={3} dot={{ fill: '#0f1526', stroke: '#fb923c', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#fb923c' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-[#131b2f] p-4 sm:p-6 rounded-2xl border border-slate-700/50 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">KDA Ratio Progression</h3>
                      <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                    </div>
                    <div className={isMobileView ? 'h-48' : 'h-72'}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={getFilteredHistory()} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b', fontSize: 10}} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" domain={['auto', 'auto']} tick={{fill: '#64748b', fontSize: 10}} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f1526', border: '1px solid #334155', borderRadius: '12px', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)', fontSize: '12px' }}
                            itemStyle={{ color: '#60a5fa', fontWeight: 'bold' }}
                          />
                          <Line type="monotone" dataKey="kdRatio" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#0f1526', stroke: '#3b82f6', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#3b82f6' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>
        )}

      </main>
    </div>
  );
}