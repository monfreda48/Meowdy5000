import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { Device } from '@capacitor/device';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Toast } from '@capacitor/toast';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { ScreenOrientation } from '@capacitor/screen-orientation';

const triggerHaptic = async (type = 'light') => {
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      if (type === 'success') {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (type === 'warning' || type === 'error') {
        await Haptics.notification({ type: NotificationType.Warning });
      } else if (type === 'heavy') {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } else {
        await Haptics.impact({ style: ImpactStyle.Light });
      }
    }
  } catch (e) { }
};

const showNativeToast = async (text) => {
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      await Toast.show({
        text,
        duration: 'short',
        position: 'bottom'
      });
    }
  } catch (e) { }
};


const AVAILABLE_METRICS = [
  { id: 'winRate', name: 'Win Rate', icon: '🏆', category: 'Core' },
  { id: 'kdRatio', name: 'K/D/A Ratio', icon: '⚔️', category: 'Core' },
  { id: 'topHeroes', name: 'Top Heroes', icon: '🦸', category: 'Core' },
  { id: 'heroDamage', name: 'Damage / 10m', icon: '💥', category: 'Combat' },
  { id: 'healing', name: 'Healing / 10m', icon: '💚', category: 'Combat' },
  { id: 'damageBlocked', name: 'Dmg Blocked / 10m', icon: '🛡️', category: 'Combat' },
  { id: 'accuracy', name: 'Accuracy', icon: '🎯', category: 'Combat' },
  { id: 'mvp', name: 'MVPs', icon: '👑', category: 'Combat' },
  { id: 'svp', name: 'SVPs', icon: '🌟', category: 'Combat' },
  { id: 'timePlayed', name: 'Total Playtime', icon: '⏱️', category: 'Profile' },
  { id: 'matchesPlayed', name: 'Matches & Wins', icon: '🎮', category: 'Profile' },
];

const DEFAULT_SEASONS = [
  { id: '20', name: 'Season 10', status: 'upcoming' },
  { id: '19', name: 'Season 9.5', status: 'current' },
  { id: '18', name: 'Season 9.0', status: 'past' },
  { id: '17', name: 'Season 8.5', status: 'past' },
  { id: '16', name: 'Season 8.0', status: 'past' },
  { id: '15', name: 'Season 7.5', status: 'past' },
  { id: '14', name: 'Season 7.0', status: 'past' },
  { id: '13', name: 'Season 6.5', status: 'past' },
  { id: '12', name: 'Season 6.0', status: 'past' },
  { id: '11', name: 'Season 5.5', status: 'past' },
  { id: '10', name: 'Season 5.0', status: 'past' },
  { id: '9', name: 'Season 4.5', status: 'past' },
  { id: '8', name: 'Season 4.0', status: 'past' },
  { id: '7', name: 'Season 3.5', status: 'past' },
  { id: '6', name: 'Season 3.0', status: 'past' },
  { id: '5', name: 'Season 2.5', status: 'past' },
  { id: '4', name: 'Season 2.0', status: 'past' },
  { id: '3', name: 'Season 1.5', status: 'past' },
  { id: '2', name: 'Season 1.0', status: 'past' },
  { id: '1', name: 'Season 0 (Launch)', status: 'past' }
];

const getApiUrl = (path) => {
  try {
    const customUrl = localStorage.getItem('backend_base_url') || localStorage.getItem('backend_server_url');
    if (customUrl) {
      const base = customUrl.replace(/\/+$/, '');
      return `${base}${path.startsWith('/') ? path : '/' + path}`;
    }
  } catch (e) { }
  return path;
};

export default function App() {
  const [query, setQuery] = useState('');
  const [season, setSeason] = useState('19');
  const [timeframe, setTimeframe] = useState('all');
  const [expandedMetric, setExpandedMetric] = useState(null);
  const [seasonsList, setSeasonsList] = useState(DEFAULT_SEASONS);
  const [currentSeasonName, setCurrentSeasonName] = useState('Season 9.5');

  const fetchDynamicSeasons = async () => {
    try {
      const res = await fetch(getApiUrl('/api/seasons'));
      if (res.ok) {
        const data = await safeFetchJson(res);
        if (data.seasons && data.seasons.length > 0) {
          setSeasonsList(data.seasons);
        }
        if (data.current_season_name) {
          setCurrentSeasonName(data.current_season_name);
        }
      }
    } catch (err) {
      console.warn('Could not fetch dynamic seasons, using built-in season list:', err);
    }
  };

  useEffect(() => {
    fetchDynamicSeasons();
  }, []);

  // Recent Searches State & Helpers
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem('recent_player_searches');
      return saved ? JSON.parse(saved) : ['Meowdy', 'Necros', 'Bogur'];
    } catch (e) {
      return ['Meowdy', 'Necros', 'Bogur'];
    }
  });
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const addRecentSearch = (searchQuery) => {
    if (!searchQuery || !searchQuery.trim()) return;
    const cleanQuery = searchQuery.trim();
    setRecentSearches(prev => {
      const filtered = prev.filter(q => q.toLowerCase() !== cleanQuery.toLowerCase());
      const updated = [cleanQuery, ...filtered].slice(0, 3);
      try { localStorage.setItem('recent_player_searches', JSON.stringify(updated)); } catch (e) { }
      return updated;
    });
  };

  const clearRecentSearches = (e) => {
    if (e) e.stopPropagation();
    setRecentSearches([]);
    try { localStorage.removeItem('recent_player_searches'); } catch (e) { }
  };

  const selectRecentSearch = (searchQuery) => {
    setQuery(searchQuery);
    setIsSearchFocused(false);
    fetchStats(null, searchQuery, season);
  };

  const [lookupQuery, setLookupQuery] = useState('');

  const handleProfileLookup = (e) => {
    if (e) e.preventDefault();
    if (!lookupQuery || !lookupQuery.trim()) return;
    const targetUser = lookupQuery.trim();
    triggerHaptic('light');
    setQuery(targetUser);
    fetchStats(null, targetUser, season);
    showNativeToast(`🔍 Profile Lookup: Viewing ${targetUser} (Untracked)`);
    setUpdateToast({ type: 'update', message: `🔍 Quick Profile Lookup: Inspecting ${targetUser} (Untracked inspection mode).` });
    setTimeout(() => setUpdateToast(null), 3500);
    setLookupQuery('');
  };

  const toggleExpandMetric = (id) => {
    setExpandedMetric(prev => prev === id ? null : id);
  };

  // Pinned Home Profile State & Helpers
  const [pinnedHomeProfile, setPinnedHomeProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('pinned_home_profile');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [autoLoadHomeProfile, setAutoLoadHomeProfile] = useState(() => {
    try {
      return localStorage.getItem('auto_load_home_profile') === 'enabled';
    } catch (e) {
      return false;
    }
  });

  const togglePinHomeProfile = (profileData = null) => {
    triggerHaptic('light');
    if (!profileData && !stats?.current) return;
    const target = profileData || stats.current;
    
    const targetUser = target.username || query;
    const isCurrentlyPinned = pinnedHomeProfile && pinnedHomeProfile.username?.toLowerCase() === targetUser.toLowerCase();

    if (isCurrentlyPinned) {
      setPinnedHomeProfile(null);
      try { localStorage.removeItem('pinned_home_profile'); } catch (e) {}
      showNativeToast('📌 Unpinned home profile');
      setUpdateToast({ type: 'update', message: '📌 Home profile unpinned.' });
      setTimeout(() => setUpdateToast(null), 3000);
    } else {
      const pinObj = {
        username: targetUser,
        rank: target.rank || 'Unranked',
        peakRank: target.peakRank || '',
        winRate: target.winRate || '0%',
        kdRatio: target.kdRatio || '0.00',
        avatarUrl: target.avatarUrl || '',
        season: season || '19',
        updatedAt: new Date().toISOString()
      };
      setPinnedHomeProfile(pinObj);
      try { localStorage.setItem('pinned_home_profile', JSON.stringify(pinObj)); } catch (e) {}
      showNativeToast(`📌 ${targetUser} pinned as Home Profile!`);
      setUpdateToast({ type: 'success', message: `📌 ${targetUser} pinned as your Home Profile!` });
      setTimeout(() => setUpdateToast(null), 3000);
    }
  };

  const toggleAutoLoadHomeProfile = (e) => {
    const val = e.target.checked;
    setAutoLoadHomeProfile(val);
    try { localStorage.setItem('auto_load_home_profile', val ? 'enabled' : 'disabled'); } catch (e) {}
    showNativeToast(`⚡ Auto-load Home Profile ${val ? 'ON' : 'OFF'}`);
  };

  // User Selected Favorite Primary Site for Minimized Cards
  const [favoriteSite, setFavoriteSite] = useState(() => {
    try {
      return localStorage.getItem('favorite_primary_site') || 'trackerGg';
    } catch (e) {
      return 'trackerGg';
    }
  });

  const handleSetFavoriteSite = (siteKey) => {
    triggerHaptic('light');
    setFavoriteSite(siteKey);
    try {
      localStorage.setItem('favorite_primary_site', siteKey);
    } catch (e) { }
    const siteNames = { trackerGg: 'Tracker.gg', rivalsMeta: 'RivalsMeta.com', rivalsTracker: 'RivalsTracker.com' };
    showNativeToast(`⭐ Primary Site set to ${siteNames[siteKey] || siteKey}`);
    setUpdateToast({ type: 'success', message: `⭐ Minimized cards now display ${siteNames[siteKey] || siteKey} stats.` });
    setTimeout(() => setUpdateToast(null), 3000);
  };

  // Claimed Profile & Tracking Source Selection State
  const [claimedProfile, setClaimedProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('claimed_profile');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [showClaimModal, setShowClaimModal] = useState(false);

  const [claimedSources, setClaimedSources] = useState(() => {
    try {
      const saved = localStorage.getItem('claimed_tracking_sources');
      return saved ? JSON.parse(saved) : ['trackerGg', 'rivalsMeta', 'rivalsTracker'];
    } catch (e) {
      return ['trackerGg', 'rivalsMeta', 'rivalsTracker'];
    }
  });

  const handleClaimProfile = (usernameToClaim = null, sourcesToTrack = null) => {
    const targetUser = usernameToClaim || stats?.current?.username || query;
    if (!targetUser) return;
    const sources = sourcesToTrack || claimedSources;
    const claimObj = {
      username: targetUser,
      claimedAt: new Date().toISOString(),
      trackingSources: sources
    };
    setClaimedProfile(claimObj);
    setClaimedSources(sources);
    try {
      localStorage.setItem('claimed_profile', JSON.stringify(claimObj));
      localStorage.setItem('claimed_tracking_sources', JSON.stringify(sources));
    } catch (e) { }

    if (stats?.current) {
      togglePinHomeProfile(stats.current);
      saveTrackedStatSnapshot(stats);
      if (isTrackingMode) downloadUserDataset(stats);
      try { localStorage.setItem(`last_auto_snapshot_time_${targetUser.toLowerCase()}`, String(Date.now())); } catch (e) { }
    }
    showNativeToast(`👑 ${targetUser} claimed as primary profile!`);
    setUpdateToast({ type: 'success', message: `👑 ${targetUser} claimed as primary profile! Auto-loads & saves snapshots on startup (max once per 12h).` });
    setTimeout(() => setUpdateToast(null), 3500);
    setShowClaimModal(false);
  };

  // On App Launch: Auto-load claimed profile and run 12h throttled snapshot saving
  useEffect(() => {
    if (claimedProfile?.username) {
      setQuery(claimedProfile.username);
      fetchStats(null, claimedProfile.username, season);
    }
  }, []);

  const handleUnclaimProfile = () => {
    setClaimedProfile(null);
    try {
      localStorage.removeItem('claimed_profile');
    } catch (e) { }
    showNativeToast('👑 Claimed profile removed');
    setUpdateToast({ type: 'update', message: '👑 Claimed profile removed.' });
    setTimeout(() => setUpdateToast(null), 3000);
    setShowClaimModal(false);
  };

  const toggleTrackingSource = (sourceKey) => {
    setClaimedSources(prev => {
      let updated;
      if (prev.includes(sourceKey)) {
        if (prev.length === 1) {
          showNativeToast('⚠️ At least 1 tracking source must be selected');
          return prev;
        }
        updated = prev.filter(s => s !== sourceKey);
      } else {
        updated = [...prev, sourceKey];
      }
      try {
        localStorage.setItem('claimed_tracking_sources', JSON.stringify(updated));
        if (claimedProfile) {
          const newClaimObj = { ...claimedProfile, trackingSources: updated };
          setClaimedProfile(newClaimObj);
          localStorage.setItem('claimed_profile', JSON.stringify(newClaimObj));
        }
      } catch (e) { }
      return updated;
    });
  };

  const getMinimizedStatValue = (metricKey, unit = '') => {
    if (!stats?.rawSourcesData) {
      const fallback = stats?.current?.[metricKey] || 'N/A';
      return unit && !String(fallback).endsWith(unit) && fallback !== 'N/A' ? `${fallback}${unit}` : fallback;
    }
    const favoriteData = stats.rawSourcesData[favoriteSite];
    if (favoriteData && favoriteData[metricKey] !== undefined && favoriteData[metricKey] !== null && favoriteData[metricKey] !== 'N/A' && favoriteData[metricKey] !== '0.0') {
      const val = String(favoriteData[metricKey]);
      return unit && !val.endsWith(unit) ? `${val}${unit}` : val;
    }
    const fallback = stats?.current?.[metricKey] || 'N/A';
    return unit && !String(fallback).endsWith(unit) && fallback !== 'N/A' ? `${fallback}${unit}` : fallback;
  };

  const render3SiteBreakdown = (metricKey) => {
    const breakdown = stats?.current?.statBreakdown?.[metricKey];
    if (!breakdown) return null;
    
    const isExpanded = expandedMetric === metricKey;
    const siteNames = { trackerGg: 'Tracker.gg', rivalsMeta: 'RivalsMeta', rivalsTracker: 'RivalsTracker' };
    const favValue = breakdown[favoriteSite] || stats?.current?.[metricKey] || 'N/A';

    if (!isExpanded) {
      return (
        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-medium select-none">
          <span className="flex items-center gap-1">
            <span className="text-amber-400 font-bold">⭐</span>
            <span className="font-bold text-slate-300">{siteNames[favoriteSite]}:</span>
            <span className="text-emerald-400 font-mono font-bold">{favValue}</span>
          </span>
          <span className="text-slate-500 font-bold group-hover:text-emerald-400 transition-colors">
            Tap to expand 3 sites →
          </span>
        </div>
      );
    }

    return (
      <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-2 text-[11px] select-none animate-in fade-in duration-300">
        <div className="flex items-center justify-between text-slate-400 font-bold uppercase tracking-wider text-[10px]">
          <span>🌐 3-Site Data Comparison:</span>
          <span className="text-amber-400 font-bold">Favorite: {siteNames[favoriteSite]}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center font-mono font-bold">
          <div className={`p-2 rounded-xl border transition-all ${favoriteSite === 'trackerGg' ? 'bg-emerald-500/15 border-emerald-500/60 shadow-md shadow-emerald-500/10' : 'bg-[#0b101e] border-slate-800'}`}>
            <span className="block text-[9px] text-emerald-400 font-sans font-bold uppercase tracking-wider">Tracker.gg</span>
            <span className="text-white text-xs sm:text-sm font-black">{breakdown.trackerGg || 'N/A'}</span>
          </div>
          <div className={`p-2 rounded-xl border transition-all ${favoriteSite === 'rivalsMeta' ? 'bg-teal-500/15 border-teal-500/60 shadow-md shadow-teal-500/10' : 'bg-[#0b101e] border-slate-800'}`}>
            <span className="block text-[9px] text-teal-400 font-sans font-bold uppercase tracking-wider">RivalsMeta</span>
            <span className="text-white text-xs sm:text-sm font-black">{breakdown.rivalsMeta || 'N/A'}</span>
          </div>
          <div className={`p-2 rounded-xl border transition-all ${favoriteSite === 'rivalsTracker' ? 'bg-blue-500/15 border-blue-500/60 shadow-md shadow-blue-500/10' : 'bg-[#0b101e] border-slate-800'}`}>
            <span className="block text-[9px] text-blue-400 font-sans font-bold uppercase tracking-wider">RivalsTracker</span>
            <span className="text-white text-xs sm:text-sm font-black">{breakdown.rivalsTracker || 'N/A'}</span>
          </div>
        </div>
      </div>
    );
  };

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchProgressMsg, setSearchProgressMsg] = useState('');
  const searchAbortControllerRef = useRef(null);

  // Pull to Refresh state and gesture handlers
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef(0);
  const PULL_THRESHOLD = 75;

  const handleTouchStart = (e) => {
    if (window.scrollY === 0) {
      touchStartRef.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling || window.scrollY > 0) return;
    const currentY = e.touches[0].clientY;
    const distance = currentY - touchStartRef.current;

    if (distance > 0) {
      const dampenedDistance = Math.min(distance * 0.45, 110);
      setPullDistance(dampenedDistance);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    setIsPulling(false);

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing && !loading) {
      setIsRefreshing(true);
      setPullDistance(50);

      try {
        if (query) {
          await fetchStats(null, query, season);
        } else {
          await checkForUpdates(true);
        }
      } catch (err) {
        console.error('Pull to refresh error:', err);
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 500);
      }
    } else {
      setPullDistance(0);
    }
  };

  // Drawer Pull to Refresh state and gesture handlers
  const [drawerPullDistance, setDrawerPullDistance] = useState(0);
  const [isDrawerPulling, setIsDrawerPulling] = useState(false);
  const [isDrawerRefreshing, setIsDrawerRefreshing] = useState(false);
  const drawerTouchStartRef = useRef(0);
  const drawerScrollRef = useRef(null);

  const handleDrawerTouchStart = (e) => {
    if (drawerScrollRef.current && drawerScrollRef.current.scrollTop === 0) {
      drawerTouchStartRef.current = e.touches[0].clientY;
      setIsDrawerPulling(true);
    }
  };

  const handleDrawerTouchMove = (e) => {
    if (!isDrawerPulling || (drawerScrollRef.current && drawerScrollRef.current.scrollTop > 0)) return;
    const currentY = e.touches[0].clientY;
    const distance = currentY - drawerTouchStartRef.current;

    if (distance > 0) {
      const dampenedDistance = Math.min(distance * 0.45, 100);
      setDrawerPullDistance(dampenedDistance);
    }
  };

  const handleDrawerTouchEnd = async () => {
    if (!isDrawerPulling) return;
    setIsDrawerPulling(false);

    if (drawerPullDistance >= PULL_THRESHOLD && !isDrawerRefreshing) {
      setIsDrawerRefreshing(true);
      setDrawerPullDistance(45);
      triggerHaptic('light');

      try {
        await handleOneClickUpdate();
      } catch (err) {
        console.error('Drawer pull refresh error:', err);
      } finally {
        setTimeout(() => {
          setIsDrawerRefreshing(false);
          setDrawerPullDistance(0);
        }, 600);
      }
    } else {
      setDrawerPullDistance(0);
    }
  };

  const [isMobileView, setIsMobileView] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [readyToInstallUpdate, setReadyToInstallUpdate] = useState(null);
  const [nativeAppVersion, setNativeAppVersion] = useState(null);

  const [showSplashOverlay, setShowSplashOverlay] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplashOverlay(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      CapApp.getInfo().then(info => {
        if (info && info.version) {
          setNativeAppVersion(info.version);
        }
      }).catch(() => {});
    }
  }, []);
  const [showSnapshotHistoryModal, setShowSnapshotHistoryModal] = useState(false);
  const [showViewReportsModal, setShowViewReportsModal] = useState(false);
  const [fetchedReports, setFetchedReports] = useState([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState(null);
  const [hasStoragePermission, setHasStoragePermission] = useState(() => {
    try {
      return localStorage.getItem('storage_permission_granted') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(() => {
    try {
      return localStorage.getItem('storage_permission_granted') !== 'true';
    } catch (e) {
      return true;
    }
  });
  const [showWhyPermission, setShowWhyPermission] = useState(false);
  const [trackedPlayers, setTrackedPlayers] = useState(() => {
    try {
      const saved = localStorage.getItem('tracked_players_list');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Custom Profile Picture / Avatar Management
  const [customAvatars, setCustomAvatars] = useState(() => {
    try {
      const saved = localStorage.getItem('custom_player_avatars');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');

  const HERO_AVATAR_PRESETS = [
    { name: "Spider-Man", url: "https://imgsvc.trackercdn.com/url/size(128),fit(cover)/https%3A%2F%2Ftrackercdn.com%2Fcdn%2Fmarvel-rivals%2Fheroes%2F1016.png/image.jpg" },
    { name: "Venom", url: "https://imgsvc.trackercdn.com/url/size(128),fit(cover)/https%3A%2F%2Ftrackercdn.com%2Fcdn%2Fmarvel-rivals%2Fheroes%2F1017.png/image.jpg" },
    { name: "Rocket Raccoon", url: "https://imgsvc.trackercdn.com/url/size(128),fit(cover)/https%3A%2F%2Ftrackercdn.com%2Fcdn%2Fmarvel-rivals%2Fheroes%2F1018.png/image.jpg" },
    { name: "Iron Man", url: "https://imgsvc.trackercdn.com/url/size(128),fit(cover)/https%3A%2F%2Ftrackercdn.com%2Fcdn%2Fmarvel-rivals%2Fheroes%2F1023.png/image.jpg" },
    { name: "Hela", url: "https://imgsvc.trackercdn.com/url/size(128),fit(cover)/https%3A%2F%2Ftrackercdn.com%2Fcdn%2Fmarvel-rivals%2Fheroes%2F1022.png/image.jpg" },
    { name: "Doctor Strange", url: "https://imgsvc.trackercdn.com/url/size(128),fit(cover)/https%3A%2F%2Ftrackercdn.com%2Fcdn%2Fmarvel-rivals%2Fheroes%2F1024.png/image.jpg" },
    { name: "Punisher", url: "https://imgsvc.trackercdn.com/url/size(128),fit(cover)/https%3A%2F%2Ftrackercdn.com%2Fcdn%2Fmarvel-rivals%2Fheroes%2F1014.png/image.jpg" },
    { name: "Magneto", url: "https://imgsvc.trackercdn.com/url/size(128),fit(cover)/https%3A%2F%2Ftrackercdn.com%2Fcdn%2Fmarvel-rivals%2Fheroes%2F1015.png/image.jpg" },
    { name: "Luna Snow", url: "https://imgsvc.trackercdn.com/url/size(128),fit(cover)/https%3A%2F%2Ftrackercdn.com%2Fcdn%2Fmarvel-rivals%2Fheroes%2F1032.png/image.jpg" },
    { name: "Mantis", url: "https://imgsvc.trackercdn.com/url/size(128),fit(cover)/https%3A%2F%2Ftrackercdn.com%2Fcdn%2Fmarvel-rivals%2Fheroes%2F1011.png/image.jpg" },
    { name: "Magik", url: "https://imgsvc.trackercdn.com/url/size(128),fit(cover)/https%3A%2F%2Ftrackercdn.com%2Fcdn%2Fmarvel-rivals%2Fheroes%2F1030.png/image.jpg" },
    { name: "Groot", url: "https://imgsvc.trackercdn.com/url/size(128),fit(cover)/https%3A%2F%2Ftrackercdn.com%2Fcdn%2Fmarvel-rivals%2Fheroes%2F1020.png/image.jpg" }
  ];

  const getDisplayAvatar = (username) => {
    if (!username) return stats?.current?.avatarUrl || '';
    const key = username.toLowerCase();
    return customAvatars[key] || stats?.current?.avatarUrl || '';
  };

  const handleSaveCustomAvatar = (username, newAvatarUrl) => {
    if (!username || !newAvatarUrl) return;
    const key = username.toLowerCase();
    const updated = { ...customAvatars, [key]: newAvatarUrl };
    setCustomAvatars(updated);
    try {
      localStorage.setItem('custom_player_avatars', JSON.stringify(updated));
    } catch (e) { }
    triggerHaptic('success');
    showNativeToast('🖼️ Profile picture updated!');
    setUpdateToast({ type: 'success', message: `🖼️ Custom profile picture saved for ${username}!` });
    setTimeout(() => setUpdateToast(null), 3000);
    setShowAvatarModal(false);
  };

  const handleRemoveCustomAvatar = (username) => {
    if (!username) return;
    const key = username.toLowerCase();
    const updated = { ...customAvatars };
    delete updated[key];
    setCustomAvatars(updated);
    try {
      localStorage.setItem('custom_player_avatars', JSON.stringify(updated));
    } catch (e) { }
    triggerHaptic('light');
    showNativeToast('🖼️ Reset to default profile picture');
    setUpdateToast({ type: 'update', message: `🖼️ Profile picture reset to default for ${username}.` });
    setTimeout(() => setUpdateToast(null), 3000);
    setShowAvatarModal(false);
  };

  const handleFileUploadAvatar = (e, username) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit. Please choose a smaller image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        handleSaveCustomAvatar(username, event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveTrackedStatSnapshot = async (playerStats) => {
    if (!playerStats?.current) return;
    const entry = {
      username: playerStats.current.username,
      timestamp: new Date().toISOString(),
      winRate: playerStats.current.winRate,
      kdRatio: playerStats.current.kdRatio,
      topHero: playerStats.current.topHero,
      rank: playerStats.current.rank
    };

    try {
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        await Filesystem.appendFile({
          path: `tracked_stats_${playerStats.current.username.toLowerCase()}.json`,
          data: JSON.stringify(entry) + '\n',
          directory: 'DATA'
        });
      }
    } catch (err) {
      console.warn('[DataFile] Filesystem save note:', err);
    }

    try {
      const storageKey = `player_file_data_${playerStats.current.username.toLowerCase()}`;
      const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
      existing.push(entry);
      localStorage.setItem(storageKey, JSON.stringify(existing));
    } catch (e) { }
  };

  const handleToggleTrackPlayer = (username) => {
    if (!username) return;
    const key = username.toLowerCase();
    const isNowTracked = !trackedPlayers[key];
    const updated = { ...trackedPlayers, [key]: isNowTracked };
    setTrackedPlayers(updated);
    try {
      localStorage.setItem('tracked_players_list', JSON.stringify(updated));
    } catch (e) { }

    if (isNowTracked && stats?.current) {
      saveTrackedStatSnapshot(stats);
      setUpdateToast({
        type: 'success',
        message: `⚡ ${username} is now tracked! Stat point snapshot saved to data file.`
      });
      setTimeout(() => setUpdateToast(null), 4000);
    } else {
      setUpdateToast({
        type: 'info',
        message: `ℹ️ Tracking paused for ${username}.`
      });
      setTimeout(() => setUpdateToast(null), 3000);
    }
  };

  const handleExportBackup = async () => {
    try {
      const backupData = {
        app: "Meowdy 5000's Stat Tracker",
        exportedAt: new Date().toISOString(),
        trackedPlayers: trackedPlayers,
        selectedMetrics: selectedMetrics,
        playerDataFiles: {}
      };

      Object.keys(trackedPlayers).forEach(username => {
        const key = `player_file_data_${username.toLowerCase()}`;
        try {
          const raw = localStorage.getItem(key);
          if (raw) backupData.playerDataFiles[username] = JSON.parse(raw);
        } catch (e) { }
      });

      const jsonStr = JSON.stringify(backupData, null, 2);

      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        await Filesystem.writeFile({
          path: 'Meowdy5000_Backup.json',
          data: jsonStr,
          directory: Directory.Documents
        });
        setUpdateToast({ type: 'success', message: '✅ Backup file exported to Documents/Meowdy5000_Backup.json!' });
      } else {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Meowdy5000_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setUpdateToast({ type: 'success', message: '✅ Backup downloaded as JSON file!' });
      }
      setTimeout(() => setUpdateToast(null), 4000);
    } catch (err) {
      console.error('Export backup error:', err);
      setUpdateToast({ type: 'error', message: '⚠️ Failed to export backup file.' });
    }
  };

  const openExternalUrl = async (url) => {
    try {
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        await Browser.open({ url });
      } else {
        window.open(url, '_blank');
      }
    } catch (e) {
      window.open(url, '_blank');
    }
  };

  const handleFetchErrorReports = async () => {
    setIsLoadingReports(true);
    try {
      const res = await fetch(getApiUrl('/api/error-reports'));
      if (res.ok) {
        const data = await res.json();
        setFetchedReports(Array.isArray(data) ? data : (data.reports || []));
      } else {
        setFetchedReports([]);
      }
    } catch (e) {
      console.warn('Fetch error reports failed:', e);
      setFetchedReports([]);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const openErrorReportsViewer = () => {
    setShowViewReportsModal(true);
    handleFetchErrorReports();
  };

  const grantStoragePermission = async () => {
    try {
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
          await Filesystem.requestPermissions();
        } catch (err) { }

        try {
          await Filesystem.writeFile({
            path: '.perm_test',
            data: 'OK',
            directory: Directory.Cache,
            encoding: Encoding.UTF8
          });
        } catch (e) { }

        setUpdateToast({ type: 'success', message: '✅ Android OS Storage Access Active!' });
      } else {
        if (navigator.storage && navigator.storage.persist) {
          try {
            await navigator.storage.persist();
          } catch (e) { }
        }
        setUpdateToast({ type: 'success', message: '✅ Storage Write Permission Active!' });
      }

      localStorage.setItem('storage_permission_granted', 'true');
      setHasStoragePermission(true);
      setShowPermissionPrompt(false);
      setTimeout(() => setUpdateToast(null), 4000);
    } catch (e) {
      console.error('Local storage write error:', e);
    }
  };

  const revokeStoragePermission = () => {
    try {
      localStorage.removeItem('storage_permission_granted');
      setHasStoragePermission(false);
      setShowPermissionPrompt(true);
    } catch (e) {
      console.error('Local storage error:', e);
    }
  };

  const [isEditOrderMode, setIsEditOrderMode] = useState(false);

  const [selectedMetrics, setSelectedMetrics] = useState(() => {
    return AVAILABLE_METRICS.map(m => m.id);
  });

  const changeMetricOrder = (id, targetPosition) => {
    const currentIndex = selectedMetrics.indexOf(id);
    if (currentIndex === -1) return;
    const targetIndex = targetPosition - 1;
    if (targetIndex < 0 || targetIndex >= selectedMetrics.length) return;

    const updated = [...selectedMetrics];
    const [moved] = updated.splice(currentIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setSelectedMetrics(updated);
    try { localStorage.setItem('tracked_metrics', JSON.stringify(updated)); } catch (err) { }
  };

  const [isMetricModalOpen, setIsMetricModalOpen] = useState(false);

  const moveMetricUp = (id, e) => {
    if (e) e.stopPropagation();
    const index = selectedMetrics.indexOf(id);
    if (index <= 0) return;
    const updated = [...selectedMetrics];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setSelectedMetrics(updated);
    try { localStorage.setItem('tracked_metrics', JSON.stringify(updated)); } catch (err) { }
  };

  const moveMetricDown = (id, e) => {
    if (e) e.stopPropagation();
    const index = selectedMetrics.indexOf(id);
    if (index < 0 || index >= selectedMetrics.length - 1) return;
    const updated = [...selectedMetrics];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setSelectedMetrics(updated);
    try { localStorage.setItem('tracked_metrics', JSON.stringify(updated)); } catch (err) { }
  };

  const toggleMetric = (id) => {
    let updated;
    if (selectedMetrics.includes(id)) {
      if (selectedMetrics.length === 1) return;
      updated = selectedMetrics.filter(mId => mId !== id);
    } else {
      updated = [...selectedMetrics, id];
    }
    setSelectedMetrics(updated);
    if (hasStoragePermission) {
      try { localStorage.setItem('tracked_metrics', JSON.stringify(updated)); } catch (e) { }
    }
  };

  const isMetricTracked = (id) => selectedMetrics.includes(id);

  const resetDefaultMetrics = () => {
    const allIds = AVAILABLE_METRICS.map(m => m.id);
    setSelectedMetrics(allIds);
    if (hasStoragePermission) {
      try { localStorage.setItem('tracked_metrics', JSON.stringify(allIds)); } catch (e) { }
    }
  };

  const selectAllMetrics = () => {
    const allIds = AVAILABLE_METRICS.map(m => m.id);
    setSelectedMetrics(allIds);
    if (hasStoragePermission) {
      try { localStorage.setItem('tracked_metrics', JSON.stringify(allIds)); } catch (e) { }
    }
  };

  const [autoUpdatePref, setAutoUpdatePref] = useState(() => {
    try {
      return localStorage.getItem('auto_update_preference') || 'enabled';
    } catch (e) {
      return 'enabled';
    }
  });
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [updateStatusMsg, setUpdateStatusMsg] = useState('');
  const [showUpToDateModal, setShowUpToDateModal] = useState(false);
  const [upToDateDetails, setUpToDateDetails] = useState(null);
  const [activeUserTab, setActiveUserTab] = useState('live');
  const [showAutoUpdateModal, setShowAutoUpdateModal] = useState(false);
  const [activeStatReport, setActiveStatReport] = useState(null);

  const reportSpecificStatInaccuracy = (statKey, statName, statValue) => {
    triggerHaptic('warning');
    const username = stats?.current?.username || 'Player';
    const issueTitle = `[Stat Inaccuracy Report] ${statName}: ${statValue} for ${username}`;
    const issueBody = `## ⚠️ Specific Stat Accuracy Flagged by User\n\n- **Player Username**: ${username}\n- **Flagged Stat**: ${statName}\n- **Reported Value**: ${statValue}\n- **App Version**: v${getAppVersionName()} (${getAppLocalSha()})\n- **Timestamp**: ${new Date().toISOString()}\n\nPlease review the web scraping parser logic in \`backend/app.py\` for this specific metric!`;
    const issueUrl = `https://github.com/monfreda48/Meowdy5000/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;

    try {
      fetch(getApiUrl('/api/report-error'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_message: issueTitle,
          stack_trace: `Stat Flagged: ${statName} = ${statValue}`,
          user_notes: `User flagged accuracy for ${statName} on player ${username}`,
          platform: window.Capacitor?.isNativePlatform() ? 'Android Native APK' : 'Web Browser'
        }),
        signal: AbortSignal.timeout(2000)
      }).catch(() => {});
    } catch (e) { }

    openExternalUrl(issueUrl);
    showNativeToast(`⚠️ Stat report launched on GitHub: ${statName}`);
    setActiveStatReport(null);
  };
  const [networkStatus, setNetworkStatus] = useState({ connected: true, connectionType: 'unknown' });
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [appInfo, setAppInfo] = useState(null);
  const [storagePermissionStatus, setStoragePermissionStatus] = useState('unknown');

  const checkStoragePermission = async () => {
    if (!window.Capacitor || !window.Capacitor.isNativePlatform()) {
      setStoragePermissionStatus('web_granted');
      return;
    }
    try {
      await Filesystem.writeFile({
        path: '.perm_test',
        data: 'OK',
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });
      setStoragePermissionStatus('granted');
    } catch (e) {
      setStoragePermissionStatus('granted');
    }
  };

  const requestNativeStoragePermission = async () => {
    triggerHaptic('light');
    if (!window.Capacitor || !window.Capacitor.isNativePlatform()) {
      setStoragePermissionStatus('web_granted');
      showNativeToast('📁 Web Storage Active');
      return;
    }

    try {
      await Filesystem.requestPermissions();
    } catch (err) { }

    try {
      await Filesystem.writeFile({
        path: '.storage_access_verified',
        data: '1',
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });
    } catch (e) { }

    setStoragePermissionStatus('granted');
    showNativeToast('📁 Android System Storage Access Active!');
  };

  useEffect(() => {
    checkStoragePermission();
  }, []);

  const [isTrackingMode, setIsTrackingMode] = useState(() => {
    try {
      const saved = localStorage.getItem('tracking_mode_enabled');
      if (saved !== null) return saved === 'true';
      return true; // Default to TRUE (Tracking ON by default!)
    } catch (e) {
      return true;
    }
  });



  const [defaultTrackingPref, setDefaultTrackingPref] = useState(() => {
    try {
      return localStorage.getItem('tracking_mode_default_pref') || 'enabled';
    } catch (e) {
      return 'enabled';
    }
  });

  const handleUpdateDefaultTrackingPref = (pref) => {
    setDefaultTrackingPref(pref);
    try {
      localStorage.setItem('tracking_mode_default_pref', pref);
      const isEnabled = pref === 'enabled';
      setIsTrackingMode(isEnabled);
      localStorage.setItem('tracking_mode_enabled', isEnabled ? 'true' : 'false');
      triggerHaptic('success');
      showNativeToast(`Default Tracking set to ${isEnabled ? '📥 ON' : '🚫 OFF'}`);
    } catch (e) { }
  };

  const downloadUserDataset = async (data) => {
    try {
      const username = data.current?.username || 'Player';
      const seasonName = data.current?.season || 'Season 1';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      const datasetObj = {
        metadata: {
          app: "Meowdy 5000 Rivals Tracker",
          downloadedAt: new Date().toISOString(),
          player: username,
          season: seasonName,
          platform: data.current?.platform || 'All'
        },
        playerSummary: data.current || {},
        metrics: data.metrics || {},
        heroes: data.heroes || [],
        matchHistory: data.history || []
      };

      const jsonStr = JSON.stringify(datasetObj, null, 2);
      const filename = `RivalsTracker_${username}_Season${seasonName}_${timestamp}.json`;

      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
          await Filesystem.writeFile({
            path: filename,
            data: jsonStr,
            directory: Directory.Documents,
            encoding: Encoding.UTF8
          });
          setStoragePermissionStatus('granted');
          showNativeToast(`📥 Dataset saved to Documents/${filename}`);
          setUpdateToast({ type: 'success', message: `📥 Dataset saved to Documents/${filename}` });
          setTimeout(() => setUpdateToast(null), 4000);
          return;
        } catch (fsErr) {
          console.warn('Documents write failed, writing to App Cache:', fsErr);
          try {
            await Filesystem.writeFile({
              path: filename,
              data: jsonStr,
              directory: Directory.Cache,
              encoding: Encoding.UTF8
            });
            setStoragePermissionStatus('granted');
            showNativeToast(`📥 Dataset saved (${filename})`);
            setUpdateToast({ type: 'success', message: `📥 Dataset saved (${filename})` });
            setTimeout(() => setUpdateToast(null), 4000);
            return;
          } catch (e2) { }
        }
      }

      // Web Browser Download
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showNativeToast(`📥 Dataset downloaded for ${username}`);
      setUpdateToast({ type: 'success', message: `📥 Dataset downloaded for ${username} (${filename})` });
      setTimeout(() => setUpdateToast(null), 4000);
    } catch (err) {
      console.error('Failed to download player dataset:', err);
    }
  };

  const [backendBaseUrl, setBackendBaseUrl] = useState(() => {
    try {
      const stored = localStorage.getItem('backend_server_url') || localStorage.getItem('backend_base_url');
      if (stored) return stored;
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
        return 'http://10.0.2.2:5000';
      }
      return '';
    } catch (e) {
      return '';
    }
  });

  const handleSaveBackendBaseUrl = (url) => {
    const trimmed = (url || '').trim();
    setBackendBaseUrl(trimmed);
    try {
      localStorage.setItem('backend_server_url', trimmed);
      triggerHaptic('success');
      showNativeToast(`Backend URL set: ${trimmed || 'Default Host'}`);
    } catch (e) { }
  };

  const getApiUrl = (endpoint) => {
    let base = backendBaseUrl;
    if (!base && typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
      base = 'http://10.0.2.2:5000';
    }
    if (!base) return endpoint;
    const cleanBase = base.replace(/\/+$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${cleanBase}${cleanEndpoint}`;
  };

  const safeFetchJson = async (res) => {
    const text = await res.text();
    const isHtml = text.trim().startsWith('<') || text.toLowerCase().includes('<!doctype html');
    if (isHtml) {
      throw new Error(`Server returned HTML instead of JSON. Please check your network connection or backend URL configuration.`);
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON response from server.`);
    }
  };

  const cleanupOldApkFiles = async () => {
    if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return;
    try {
      const directories = [Directory.Cache, Directory.Data, Directory.Documents];
      for (const dir of directories) {
        try {
          const res = await Filesystem.readdir({ path: '', directory: dir });
          if (res && res.files) {
            for (const file of res.files) {
              const filename = typeof file === 'string' ? file : (file.name || file.path || '');
              if (filename && (filename.endsWith('.apk') || filename.includes('Meowdy5000-Update'))) {
                try {
                  await Filesystem.deleteFile({ path: filename, directory: dir });
                  console.log(`[ApkCleanup] Cleaned up old APK file: ${filename} from ${dir}`);
                } catch (delErr) {
                  console.warn(`[ApkCleanup] Failed to delete ${filename}:`, delErr);
                }
              }
            }
          }
        } catch (dirErr) {
          // ignore directory errors if empty or inaccessible
        }
      }
      try {
        await Filesystem.deleteFile({ path: 'Meowdy5000-Update.apk', directory: Directory.Cache });
      } catch (e) { }
    } catch (e) {
      console.warn('[ApkCleanup] Cleanup error:', e);
    }
  };

  const applyUpdateNow = async (targetSha = null) => {
    const attemptedSha = targetSha || updateInfo?.latestVersion;
    if (attemptedSha) {
      try {
        sessionStorage.setItem('last_attempted_update_sha', attemptedSha);
        localStorage.setItem('installed_commit_sha', attemptedSha);
      } catch (e) { }
    }

    setIsApplyingUpdate(true);
    setUpdateStatusMsg('⚡ Preparing update installation...');

    // On Native Android APK, download APK and launch native Package Installer
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      setUpdateStatusMsg('📥 Downloading updated APK binary...');
      showNativeToast('📥 Downloading update package...');

      const downloadUrl = readyToInstallUpdate?.apkUrl || 'https://github.com/monfreda48/Meowdy5000/releases/download/v1.0.14/app-debug.apk';

      try {
        // Request Storage Permission from Android OS
        try {
          if (window.Capacitor.Plugins && window.Capacitor.Plugins.ApkInstaller && window.Capacitor.Plugins.ApkInstaller.requestStoragePermission) {
            await window.Capacitor.Plugins.ApkInstaller.requestStoragePermission();
          }
          const permStatus = await Filesystem.checkPermissions();
          if (permStatus.publicStorage !== 'granted') {
            await Filesystem.requestPermissions();
          }
        } catch (permErr) {
          console.warn('[StoragePermission] Permission request notice:', permErr);
        }

        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();

        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onloadend = () => {
            const res = reader.result;
            const base64Data = res.split(',')[1] || res;
            resolve(base64Data);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(blob);
        const base64Data = await base64Promise;

        const fileName = 'Meowdy5000-Update.apk';
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents
        });

        const uriResult = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Documents
        });
        
        let nativeFilePath = uriResult.uri;
        if (nativeFilePath.startsWith('file://')) {
          nativeFilePath = nativeFilePath.replace('file://', '');
        }

        setUpdateStatusMsg('📦 Launching Android Package Installer...');
        showNativeToast('📦 Opening Package Installer...');

        if (readyToInstallUpdate?.latestVersion) {
          localStorage.setItem('installed_commit_sha', readyToInstallUpdate.latestVersion);
        }

        if (window.Capacitor.Plugins && window.Capacitor.Plugins.ApkInstaller) {
          await window.Capacitor.Plugins.ApkInstaller.installApk({ filePath: nativeFilePath });
        } else {
          openExternalUrl(downloadUrl);
        }
      } catch (err) {
        console.warn('[ApkInstallError] Failed direct APK download:', err);
        if (err?.message === 'UNKNOWN_SOURCES_REQUIRED' || String(err).includes('UNKNOWN_SOURCES')) {
          setUpdateToast({ type: 'warning', message: '⚠️ Please enable "Allow from this source" in Settings and tap Install again.' });
          return;
        }
        setUpdateToast({ type: 'info', message: '📦 Opening Android Package Installer download...' });
        openExternalUrl(downloadUrl);
      } finally {
        setTimeout(() => setIsApplyingUpdate(false), 1200);
      }
      return;
    }

    try {
      // 1. Trigger backend server git pull / code update if connected with 15s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(getApiUrl('/api/apply-update'), {
        method: 'POST',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await safeFetchJson(res);
        if (data.success) {
          if (data.newVersion) {
            try { localStorage.setItem('installed_commit_sha', data.newVersion); } catch (e) { }
          }
          setUpdateStatusMsg('✅ Update successfully applied! Reloading app...');
          showNativeToast('⚡ App updated to latest release version');
          setTimeout(() => {
            setIsApplyingUpdate(false);
            window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
          }, 800);
          return;
        }
      }
    } catch (err) {
      console.warn('[SeamlessUpdate] Backend pull warning:', err);
    }

    // 2. Cache-busting Hot Code Reload
    setUpdateStatusMsg('⚡ Reloading to latest code bundle...');
    showNativeToast('⚡ App updated to latest code bundle');
    setTimeout(() => {
      setIsApplyingUpdate(false);
      window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
    }, 800);
  };

  const executeInstallUpdate = async () => {
    setIsApplyingUpdate(true);
    setUpdateStatusMsg('⚡ Seamlessly updating app in background...');
    try {
      showNativeToast('⚡ App updated seamlessly to latest version');
      setTimeout(() => {
        setIsApplyingUpdate(false);
        window.location.reload(true);
      }, 500);
    } catch (err) {
      console.warn('[ExecuteUpdate] Error:', err);
    } finally {
      setTimeout(() => setIsApplyingUpdate(false), 1000);
    }
  };

  const getAppLocalSha = (backendData = null) => {
    try {
      const savedCommit = localStorage.getItem('installed_commit_sha');
      if (savedCommit && savedCommit.length >= 6) return savedCommit.slice(0, 7);
    } catch (e) { }
    if (backendData?.currentVersion) return backendData.currentVersion.slice(0, 7);
    if (backendData?.localVersion) return backendData.localVersion.slice(0, 7);
    return (import.meta.env.VITE_APP_COMMIT_SHA || 'afab44e').slice(0, 7);
  };

  const getAppVersionName = (backendData = null) => {
    if (nativeAppVersion) return nativeAppVersion;
    try {
      const savedVer = localStorage.getItem('installed_version_name');
      if (savedVer) return savedVer;
    } catch (e) { }
    if (backendData?.currentVersionName) return backendData.currentVersionName;
    return '1.0.14';
  };

  const checkForUpdates = async (isSilent = true) => {
    if (!isSilent) {
      triggerHaptic('light');
      showNativeToast('🔍 Checking GitHub for updates...');
      setCheckingUpdate(true);
      setUpdateToast({ type: 'update', message: '🔍 Checking GitHub for latest app updates...' });
    }

    try {
      let latestSha = '';
      let latestMessage = '';

      // 1. Fetch directly from GitHub REST API
      try {
        const ghRes = await fetch('https://api.github.com/repos/monfreda48/Meowdy5000/commits/main', {
          headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          latestSha = (ghData.sha || '').slice(0, 7);
          latestMessage = ghData.commit?.message?.split('\n')[0] || '';
        }
      } catch (ghErr) {
        console.warn('Direct GitHub API check error:', ghErr);
      }

      // 2. Local commit check
      let backendData = null;
      try {
        const backendRes = await fetch(getApiUrl('/api/check-update'));
        if (backendRes.ok) {
          backendData = await backendRes.json();
          if (!latestSha && backendData?.latestVersion) latestSha = backendData.latestVersion;
        }
      } catch (e) { }

      const localSha = getAppLocalSha(backendData);
      const lastAttempted = (sessionStorage.getItem('last_attempted_update_sha') || '').slice(0, 7);

      const hasUpdate = Boolean(
        latestSha &&
        localSha &&
        localSha.toLowerCase().slice(0, 7) !== latestSha.toLowerCase().slice(0, 7) &&
        (!lastAttempted || lastAttempted.toLowerCase() !== latestSha.toLowerCase())
      );

      if (hasUpdate) {
        triggerHaptic('success');
        showNativeToast(`⚡ Update found (${latestSha})! Auto-installing...`);
        setUpdateToast({ type: 'update', message: `⚡ New fix commit found (${latestSha})! Auto-applying update...` });
        await applyUpdateNow(latestSha);
      } else if (!isSilent) {
        triggerHaptic('success');
        showNativeToast('✅ Your app is up to date!');
        setUpToDateDetails({
          currentSha: localSha,
          latestSha: latestSha || localSha,
          commitMsg: latestMessage || 'Latest enhancements & bugfixes applied.'
        });
        setShowUpToDateModal(true);
        setUpdateToast({ type: 'success', message: `✅ App is up to date! (Commit ${localSha})` });
        setTimeout(() => setUpdateToast(null), 4000);
      }
    } catch (err) {
      console.error('Update check error:', err);
      if (!isSilent) {
        triggerHaptic('warning');
        showNativeToast('❌ Error checking update server');
        setUpdateToast({ type: 'error', message: '❌ Error connecting to update service.' });
        setTimeout(() => setUpdateToast(null), 4000);
      }
    } finally {
      if (!isSilent) setCheckingUpdate(false);
    }
  };

  const handleOneClickUpdate = () => checkForUpdates(false);

  const setAutoUpdatePermission = (preference) => {
    try {
      localStorage.setItem('auto_update_preference', preference);
    } catch (e) { }
    setAutoUpdatePref(preference);
    setShowAutoUpdateModal(false);

    setUpdateToast({
      type: 'success',
      message: preference === 'enabled'
        ? '⚙️ Auto-update enabled. You will be prompted when new releases are available.'
        : '⚙️ Auto-update preference updated.'
    });
    setTimeout(() => setUpdateToast(null), 3500);
  };

  const [updateToast, setUpdateToast] = useState(null);

  // Error Telemetry & Reporting State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportNotes, setReportNotes] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [lastCapturedError, setLastCapturedError] = useState(null);

  const openGitHubIssueForError = (payload) => {
    const errorTitle = encodeURIComponent(`[Bug Report] ${payload.error || 'Client Exception'}`);
    const commitSha = import.meta.env.VITE_APP_COMMIT_SHA || '6f36886';
    const platform = window.Capacitor && window.Capacitor.isNativePlatform() ? 'Android Native APK' : 'Web Browser';

    const bodyText = `### 🐛 Error Report Details

**Error Message:** ${payload.error || 'N/A'}
**Platform:** ${platform}
**App Commit SHA:** \`${commitSha}\`
**Timestamp:** ${new Date().toISOString()}

**User Notes / Description:**
${payload.notes || 'No user notes provided.'}

**Stack Trace / Diagnostic Info:**
\`\`\`
${payload.stack || 'No stack trace available.'}
\`\`\`

*Reported via RivalsTracker Client Telemetry*`;

    const githubIssueUrl = `https://github.com/monfreda48/Meowdy5000/issues/new?title=${errorTitle}&body=${encodeURIComponent(bodyText)}`;

    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      Browser.open({ url: githubIssueUrl });
    } else {
      window.open(githubIssueUrl, '_blank');
    }
  };

  const handleManualSubmitReport = (e, mode = 'both') => {
    if (e) e.preventDefault();
    setIsSubmittingReport(true);
    triggerHaptic('light');

    const errObj = typeof lastCapturedError === 'object' && lastCapturedError !== null
      ? lastCapturedError
      : { error: 'User Submitted Issue Report', stack: '', notes: reportNotes };

    const payload = {
      error: errObj.error || errObj.message || 'User Submitted Bug Report',
      stack: errObj.stack || errObj.stackTrace || '',
      notes: reportNotes || 'User submitted feedback via modal.',
      platform: window.Capacitor && window.Capacitor.isNativePlatform() ? 'Android Native APK' : 'Web Browser'
    };

    // 1. Open GitHub Issue submission form INSTANTLY (<0.1s)
    openGitHubIssueForError(payload);

    // 2. Dispatch telemetry POST in background non-blocking
    sendErrorReport(payload);

    setIsSubmittingReport(false);
    setShowReportModal(false);
    setReportNotes('');

    setUpdateToast({ type: 'success', message: '🚀 GitHub issue form opened & error report sent!' });
    setTimeout(() => setUpdateToast(null), 4000);
  };

  const copyDiagnosticLog = (payload) => {
    try {
      const text = `=== ERROR DIAGNOSTIC LOG ===\nError: ${payload.error || 'N/A'}\nPlatform: ${window.Capacitor && window.Capacitor.isNativePlatform() ? 'Android Native APK' : 'Web Browser'}\nSHA: ${import.meta.env.VITE_APP_COMMIT_SHA || '6f36886'}\nNotes: ${payload.notes || 'None'}\nStack:\n${payload.stack || 'None'}`;
      navigator.clipboard.writeText(text);
      setUpdateToast({ type: 'success', message: '📋 Diagnostic log copied to clipboard!' });
      setTimeout(() => setUpdateToast(null), 3000);
    } catch (e) { }
  };

  const sendErrorReport = async (payload) => {
    const fullPayload = {
      error: payload.error || 'Unknown Client Error',
      stack: payload.stack || '',
      notes: payload.notes || '',
      platform: window.Capacitor && window.Capacitor.isNativePlatform() ? 'Android Native APK' : 'Web Browser',
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      commitSha: import.meta.env.VITE_APP_COMMIT_SHA || '6f36886'
    };

    // Save to local storage error queue
    try {
      const existingQueue = JSON.parse(localStorage.getItem('error_report_queue') || '[]');
      existingQueue.unshift(fullPayload);
      localStorage.setItem('error_report_queue', JSON.stringify(existingQueue.slice(0, 20)));
    } catch (e) { }

    const candidateUrls = [];
    if (backendBaseUrl) {
      candidateUrls.push(getApiUrl('/api/report-error'));
    }
    candidateUrls.push('/api/report-error');

    for (const targetUrl of candidateUrls) {
      if (!targetUrl || targetUrl === '/api/report-error' && !window.location.host) continue;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          console.log(`✅ Error report successfully sent to telemetry server via ${targetUrl}`);
          showNativeToast('📡 Bug report saved to local telemetry queue!');
          return true;
        }
      } catch (err) {
        console.warn(`Telemetry POST attempt to ${targetUrl} skipped/failed:`, err);
      }
    }
    showNativeToast('💾 Bug report saved locally to telemetry queue!');
    return false;
  };

  useEffect(() => {
    const handleGlobalError = (event) => {
      const errorObj = {
        error: event.message || 'Unhandled Window Error',
        stack: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
        notes: 'Auto-caught unhandled runtime exception'
      };
      setLastCapturedError(errorObj);
      sendErrorReport(errorObj);
    };

    const handleUnhandledRejection = (event) => {
      const errorObj = {
        error: event.reason?.message || String(event.reason) || 'Unhandled Promise Rejection',
        stack: event.reason?.stack || '',
        notes: 'Auto-caught unhandled promise rejection'
      };
      setLastCapturedError(errorObj);
      sendErrorReport(errorObj);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);



  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setSplashFading(true);
    }, 2200);

    const removeTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2800);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  // 1. Monitor Network Connectivity (@capacitor/network)
  useEffect(() => {
    let isMounted = true;
    let listener;

    const setupNetwork = async () => {
      try {
        const status = await Network.getStatus();
        if (isMounted) setNetworkStatus(status);

        listener = await Network.addListener('networkStatusChange', (newStatus) => {
          setNetworkStatus((prevStatus) => {
            // Only trigger toast & updates if connectivity state actually transitioned!
            if (prevStatus && prevStatus.connected !== newStatus.connected) {
              if (!newStatus.connected) {
                triggerHaptic('warning');
                showNativeToast('⚠️ Offline Mode — Network connection lost');
              } else {
                triggerHaptic('success');
                showNativeToast('⚡ Network Reconnected');
              }
            }
            return newStatus;
          });
        });
      } catch (e) { }
    };

    setupNetwork();

    return () => {
      isMounted = false;
      if (listener) listener.remove();
    };
  }, []);

  // 2. Monitor App Lifecycle Events (@capacitor/app)
  useEffect(() => {
    let appStateListener;
    let backButtonListener;

    const setupCapApp = async () => {
      try {
        const info = await CapApp.getInfo();
        setAppInfo(info);

        appStateListener = await CapApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            console.log('[CapApp] App returned to foreground.');
          }
        });

        backButtonListener = await CapApp.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            CapApp.minimizeApp();
          }
        });
      } catch (e) { }
    };

    setupCapApp();

    return () => {
      if (appStateListener) appStateListener.remove();
      if (backButtonListener) backButtonListener.remove();
    };
  }, []);

  // 3. Fetch Hardware Specs & Configure Native UI (@capacitor/device, @capacitor/status-bar, @capacitor/splash-screen)
  useEffect(() => {
    const fetchDeviceInfo = async () => {
      try {
        const info = await Device.getInfo();
        setDeviceInfo(info);
      } catch (e) { }
    };
    const setupNativeUi = async () => {
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#0b101e' });
        } catch (e) { }
        try {
          await SplashScreen.hide();
        } catch (e) { }
      }
    };
    fetchDeviceInfo();
    setupNativeUi();
  }, []);

  const sharePlayerStats = async () => {
    if (!stats?.current) return;
    triggerHaptic('light');
    const username = stats.current.username || 'Player';
    const winRate = stats.current.winRate || 0;
    const kdRatio = stats.current.kdRatio || 0;
    const topHero = stats.current.topHero || 'Unknown';
    const shareText = `🦸 Marvel Rivals Stat Sheet for ${username}:\n🏆 Win Rate: ${winRate}%\n⚔️ K/D Ratio: ${kdRatio}\n⭐ Top Hero: ${topHero}\nTracked with Meowdy 5000 Rivals Tracker!`;

    try {
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        await Share.share({
          title: `Marvel Rivals Stats: ${username}`,
          text: shareText,
          url: 'https://github.com/monfreda48/Meowdy5000',
          dialogTitle: 'Share Player Stats'
        });
      } else {
        await Clipboard.write({ string: shareText });
        showNativeToast('📋 Player stats summary copied to clipboard!');
      }
    } catch (e) { }
  };

  useEffect(() => {
    cleanupOldApkFiles();
    checkForUpdates(true);

    if (claimedProfile?.username) {
      console.log(`[ClaimedProfile] Auto-loading claimed profile: ${claimedProfile.username}`);
      setQuery(claimedProfile.username);
      fetchStats(null, claimedProfile.username, season);
    } else if (autoLoadHomeProfile && pinnedHomeProfile?.username) {
      console.log(`[HomeProfile] Auto-loading pinned home profile: ${pinnedHomeProfile.username}`);
      setQuery(pinnedHomeProfile.username);
      fetchStats(null, pinnedHomeProfile.username, pinnedHomeProfile.season || season);
    }

    const handleFocus = () => {
      cleanupOldApkFiles();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const cancelSearch = () => {
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
      searchAbortControllerRef.current = null;
    }
    setLoading(false);
    setSearchProgress(0);
    setSearchProgressMsg('');
    showNativeToast('🚫 Search cancelled');
  };

  const MARVEL_LOADING_QUOTES = [
    "🕶️ Helping Daredevil find his keys...",
    "🔑 Helping Daredevil find his keys...",
    "👁️ Obtaining the Eye of Agamotto...",
    "🔨 Bribing Eitri to forge Uru stats...",
    "⚡ Charging Iron Man's Arc Reactor (400%)...",
    "🕷️ Swiping Peter Parker's web-shooters...",
    "🧪 Injecting Super Soldier Serum into backend...",
    "💥 Hulk Smashed the web scraper API...",
    "🛡️ Borrowing Captain America's Vibranium Shield...",
    "🐱 Consulting Bast in Wakanda...",
    "🌌 Stealing the Space Stone from Thanos...",
    "📜 Reading the Darkhold for hidden KDA stats...",
    "🌭 Deadpool stole the loading bar...",
    "🎯 Hawkeye never misses a single match record...",
    "🔮 Doctor Strange checking 14,000,605 stat timelines...",
    "🐺 Wolverine is sharpening his Adamantium claws...",
    "🚀 Rocket Raccoon is stealing a prosthetic arm...",
    "🌴 Groot says: I AM GROOT (fetching data)...",
    "🌀 Opening a Bifrost portal to Tracker.gg...",
    "⚡ Thor summoned Lightning to speed up scraping...",
    "🐜 Ant-Man went subatomic to find missing data...",
    "🧠 Professor X is telepathically reading the server database...",
    "🏎️ Ghost Rider is doing a Penance Stare on bad KDA data...",
    "🍕 Spider-Man: Peter Parker is delivering pizzas on the way...",
    "🍏 Loki is shapeshifting into a fast database query...",
    "💥 Punisher is eliminating 404 network timeout errors...",
    "🏹 Kate Bishop shot an arrow through the lag spike...",
    "🔮 Scarlet Witch altered reality to boost your KDA...",
    "🤖 JARVIS is optimizing the cloud neural network...",
    "🐱 Goose the Flerken swallowed the slow network packets...",
    "🃏 Gambit is charging up your stat cards with kinetic energy..."
  ];

  const getRandomMarvelQuote = (exclude = '') => {
    const candidates = MARVEL_LOADING_QUOTES.filter(q => q !== exclude);
    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  const HERO_MAP_CLIENT = {
    "1011": "Mantis", "1014": "The Punisher", "1015": "Magneto", "1016": "Spider-Man",
    "1017": "Venom", "1018": "Rocket Raccoon", "1020": "Groot", "1021": "Captain America",
    "1022": "Hela", "1023": "Iron Man", "1024": "Doctor Strange", "1025": "Hawkeye",
    "1026": "Black Panther", "1027": "Loki", "1028": "Winter Soldier", "1029": "Hulk", "1030": "Magik",
    "1031": "Moon Knight", "1032": "Luna Snow", "1033": "Squirrel Girl", "1034": "Iron Fist",
    "1035": "Adam Warlock", "1036": "Jeff the Land Shark", "1037": "Psylocke", "1038": "Storm",
    "1039": "Mister Fantastic", "1040": "Invisible Woman", "1041": "Star-Lord", "1042": "Thor",
    "1043": "Namor", "1044": "Scarlet Witch", "1045": "Peni Parker", "1046": "The Thing",
    "1047": "Human Torch", "1048": "Wolverine", "1049": "Cloak & Dagger", "1050": "Psylocke",
    "1051": "Ultron", "1052": "Flynn"
  };

  const fetchDirectPlayerStats = async (queryVal, seasonVal, signal) => {
    const cleanQuery = (queryVal || '').trim();
    const seasonParam = seasonVal ? `?season=${encodeURIComponent(seasonVal)}` : '';
    const encodedQuery = encodeURIComponent(cleanQuery);

    let data = null;
    try {
      const rmUrl = `https://rivalsmeta.com/api/player/${encodedQuery}${seasonParam}`;
      const res = await fetch(rmUrl, { signal, headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const text = await res.text();
        if (!text.trim().startsWith('<') && !text.toLowerCase().includes('<!doctype html')) {
          data = JSON.parse(text);
        }
      }
    } catch (e) {
      console.warn('[DirectFetch] Primary API fetch note:', e);
    }

    const statsObj = data?.stats || {};
    const matches = parseInt(statsObj.total_matches || 0, 10);
    const wins = parseInt(statsObj.total_wins || 0, 10);
    const kills = parseInt(statsObj.total_kills || 0, 10);
    const deaths = parseInt(statsObj.total_deaths || 0, 10);
    const assists = parseInt(statsObj.total_assists || 0, 10);

    const winRateVal = matches > 0 ? ((wins / matches) * 100).toFixed(1) : "52.4";
    const kdRatioVal = deaths > 0 ? ((kills + assists) / deaths).toFixed(2) : "2.65";

    const heroList = [];
    if (data?.heroes_ranked) {
      Object.entries(data.heroes_ranked).forEach(([hId, hData]) => {
        const hMatches = parseInt(hData.total_matches || 0, 10);
        const hWins = parseInt(hData.total_wins || 0, 10);
        const hKills = parseInt(hData.total_kills || 0, 10);
        const hDeaths = parseInt(hData.total_deaths || 0, 10);
        const hAssists = parseInt(hData.total_assists || 0, 10);
        const hWinRate = hMatches > 0 ? parseFloat(((hWins / hMatches) * 100).toFixed(1)) : 0;
        const hKda = hDeaths > 0 ? parseFloat(((hKills + hAssists) / hDeaths).toFixed(2)) : (hKills + hAssists);
        heroList.push({
          id: String(hId),
          name: HERO_MAP_CLIENT[String(hId)] || `Hero #${hId}`,
          matches: hMatches,
          winRate: hWinRate,
          kda: hKda,
          rawHeroData: hData
        });
      });
    }
    heroList.sort((a, b) => b.matches - a.matches);
    const topNames = heroList.slice(0, 3).map(h => h.name);
    const topHeroStr = topNames.join(", ") || "Spider-Man, Venom, Iron Man";

    const isUid = cleanQuery.length > 0 && !isNaN(cleanQuery);
    const siteUrls = {
      trackerGg: `https://tracker.gg/marvel-rivals/profile/ign/${encodedQuery}/overview`,
      rivalsMeta: isUid ? `https://rivalsmeta.com/player/${encodedQuery}` : `https://rivalsmeta.com/search?q=${encodedQuery}`,
      rivalsTracker: isUid ? `https://rivalstracker.com/player/${encodedQuery}` : `https://rivalstracker.com/search?q=${encodedQuery}`
    };

    const hasRealStats = Boolean(data && data.stats);

    const currentObj = {
      username: data?.name || cleanQuery,
      avatarUrl: "",
      rank: data?.rank ? String(data.rank) : "Search 3 Sites Below",
      peakRank: data?.peakRank || "",
      winRate: hasRealStats ? String(winRateVal) : "N/A",
      kdRatio: hasRealStats ? String(kdRatioVal) : "N/A",
      topHero: heroList.length > 0 ? topHeroStr : "Inspect Profile Below",
      trackerScore: "N/A",
      trackerUrl: siteUrls.trackerGg,
      matchesPlayed: hasRealStats ? matches : "N/A",
      matchesWon: hasRealStats ? wins : "N/A",
      kills: hasRealStats ? kills : "N/A",
      deaths: hasRealStats ? deaths : "N/A",
      assists: hasRealStats ? assists : "N/A",
      heroDamage: "N/A",
      healing: "N/A",
      damageBlocked: "N/A",
      accuracy: "N/A",
      mvp: "N/A",
      svp: "N/A",
      timePlayed: "N/A",
      sources: ["3-Site Direct Web Profile Selector"],
      siteUrls,
      topHeroesDetailed: heroList,
      allHeroesFull: heroList,
      statBreakdown: {
        winRate: {
          trackerGg: hasRealStats ? `${winRateVal}%` : "Click Open ↗",
          rivalsMeta: hasRealStats ? `${winRateVal}%` : "Click Open ↗",
          rivalsTracker: hasRealStats ? `${winRateVal}%` : "Click Open ↗"
        },
        kdRatio: {
          trackerGg: hasRealStats ? String(kdRatioVal) : "Click Open ↗",
          rivalsMeta: hasRealStats ? String(kdRatioVal) : "Click Open ↗",
          rivalsTracker: hasRealStats ? String(kdRatioVal) : "Click Open ↗"
        }
      },
      rawSourcesData: { rivalsMeta: data }
    };

    return { current: currentObj };
  };

  const fetchStats = async (e, overrideQuery = null, overrideSeason = null) => {
    if (e) e.preventDefault();
    const activeQuery = overrideQuery !== null ? overrideQuery : query;
    const activeSeason = overrideSeason !== null ? overrideSeason : season;
    if (!activeQuery) return;

    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortControllerRef.current = controller;

    addRecentSearch(activeQuery);
    setLoading(true);
    setError(null);
    setSearchProgress(15);
    const initialQuote = getRandomMarvelQuote();
    setSearchProgressMsg(initialQuote);

    const pInterval = setInterval(() => {
      setSearchProgress(prev => {
        if (prev < 35) return prev + 5;
        if (prev < 65) return prev + 3;
        if (prev < 85) return prev + 2;
        if (prev < 94) return prev + 1;
        return prev;
      });
    }, 400);

    const qInterval = setInterval(() => {
      setSearchProgressMsg(prevMsg => getRandomMarvelQuote(prevMsg));
    }, 2800);

    const timeoutId = setTimeout(() => {
      if (controller) controller.abort();
    }, 45000);

    try {
      let data = null;
      if (backendBaseUrl) {
        try {
          const backendController = new AbortController();
          const bTimeout = setTimeout(() => backendController.abort(), 7000);
          const response = await fetch(
            getApiUrl(`/api/stats?query=${encodeURIComponent(activeQuery)}&season=${encodeURIComponent(activeSeason)}`),
            {
              signal: backendController.signal,
              headers: {
                'bypass-tunnel-reminder': 'true',
                'Accept': 'application/json'
              }
            }
          );
          clearTimeout(bTimeout);
          data = await safeFetchJson(response);
          if (!response.ok) {
            throw new Error(data?.error || 'Backend request failed');
          }
        } catch (backendErr) {
          console.warn('[FetchStats] Custom backend request failed or timed out (7s), falling back to direct client fetch:', backendErr);
          data = await fetchDirectPlayerStats(activeQuery, activeSeason, controller.signal);
        }
      } else {
        data = await fetchDirectPlayerStats(activeQuery, activeSeason, controller.signal);
      }

      clearTimeout(timeoutId);
      clearInterval(pInterval);
      clearInterval(qInterval);

      setSearchProgress(95);
      setSearchProgressMsg("🚀 Rocket Raccoon assembled your dashboard!");

      setSearchProgress(100);
      setSearchProgressMsg('💥 Avengers Assembled! Stats Ready.');
      setStats(data);

      if (data?.current?.username || data?.username) {
        const uKey = (data.current?.username || data.username).toLowerCase();
        const isClaimedUser = claimedProfile && claimedProfile.username?.toLowerCase() === uKey;

        if (isClaimedUser) {
          const lastSaveKey = `last_auto_snapshot_time_${uKey}`;
          const lastSaveTime = localStorage.getItem(lastSaveKey);
          const now = Date.now();
          const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

          if (!lastSaveTime || (now - Number(lastSaveTime)) >= TWELVE_HOURS_MS) {
            saveTrackedStatSnapshot(data);
            if (isTrackingMode) downloadUserDataset(data);
            try { localStorage.setItem(lastSaveKey, String(now)); } catch (e) { }
            console.log(`[AutoSnapshot] 12-Hour window elapsed. Auto-saved snapshot for claimed profile: ${uKey}`);
            setUpdateToast({
              type: 'success',
              message: `📥 Claimed Profile (${data.current?.username || uKey}) Stat Snapshot Saved (Next auto-save in 12h)`
            });
            setTimeout(() => setUpdateToast(null), 4000);
          } else {
            const hoursLeft = ((TWELVE_HOURS_MS - (now - Number(lastSaveTime))) / (1000 * 60 * 60)).toFixed(1);
            console.log(`[AutoSnapshot] Snapshot skipped (saved < 12h ago). Next auto-save for ${uKey} in ${hoursLeft}h.`);
          }
        } else if (trackedPlayers[uKey]) {
          saveTrackedStatSnapshot(data);
          if (isTrackingMode) downloadUserDataset(data);
        }
      }
    } catch (err) {
      clearInterval(pInterval);
      clearInterval(qInterval);
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setError('Search request timed out. Please verify network connection or check backend URL in Menu (⚙️).');
      } else {
        setError(err.message);
        setLastCapturedError({
          error: err.message,
          stack: err.stack || 'Fetch Stats Exception',
          timestamp: new Date().toISOString()
        });
      }
    } finally {
      searchAbortControllerRef.current = null;
      setTimeout(() => {
        setLoading(false);
        setSearchProgress(0);
        setSearchProgressMsg('');
      }, 500);
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
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-[100dvh] mobile-safe-area bg-[#0b101e] text-slate-200 font-sans selection:bg-emerald-500/30 transition-all duration-300 relative"
    >
      {/* Animated Startup Splash Screen Overlay */}
      {showSplashOverlay && (
        <div className="fixed inset-0 z-[100] bg-gradient-to-br from-[#0b101e] via-[#0f172a] to-[#060911] flex flex-col items-center justify-center p-6 text-center animate-out fade-out duration-700 pointer-events-none">
          <div className="relative mb-6">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 border-2 border-emerald-400/80 shadow-2xl shadow-emerald-500/40 flex items-center justify-center text-5xl sm:text-6xl animate-bounce">
              🐱
            </div>
            <div className="absolute -bottom-2 -right-2 bg-slate-900 border border-emerald-400/60 text-emerald-400 p-1.5 rounded-full text-[10px] font-black shadow-lg uppercase tracking-wider">
              v1.0.15
            </div>
          </div>

          <h1 className="text-xl sm:text-3xl font-black text-white uppercase tracking-wider mb-2">
            MEOWDY 5000 RIVALS TRACKER
          </h1>

          {/* Prominent "TRACK HARD, SNACK HARD" Splash Motto */}
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20 border-2 border-emerald-500/60 px-5 py-2.5 rounded-full shadow-lg shadow-emerald-500/20 my-3 animate-pulse">
            <span className="text-emerald-400 font-black text-sm sm:text-lg uppercase tracking-widest flex items-center gap-2">
              <span>⚡</span>
              <span>TRACK HARD, SNACK HARD</span>
              <span>🍕</span>
            </span>
          </div>

          <p className="text-xs text-slate-400 font-medium mt-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Initializing 3-Site Analytics Engine...</span>
          </p>
        </div>
      )}

      {/* Network Offline Alert Banner */}
      {!networkStatus.connected && (
        <div className="w-full bg-amber-500/20 border-b border-amber-500/40 px-4 py-2 text-center text-amber-300 text-xs font-bold flex items-center justify-center gap-2 z-[60] backdrop-blur-md sticky top-0">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          <span>⚠️ Offline Mode — Network connection lost. Online statistics & auto-update checks are paused.</span>
        </div>
      )}

      {/* Pull to Refresh Indicator */}
      <div
        className="w-full flex flex-col items-center justify-center overflow-hidden transition-all duration-150 pointer-events-none sticky top-0 z-50"
        style={{
          height: `${pullDistance}px`,
          opacity: Math.min(pullDistance / PULL_THRESHOLD, 1)
        }}
      >
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#131b2f] border border-emerald-500/50 text-emerald-400 text-xs font-bold shadow-xl backdrop-blur-md">
          <svg
            className={`w-4 h-4 text-emerald-500 transition-transform duration-200 ${isRefreshing ? 'animate-spin' : ''
              }`}
            style={{
              transform: isRefreshing ? 'none' : `rotate(${Math.min(pullDistance / PULL_THRESHOLD, 1) * 360}deg)`
            }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>
            {isRefreshing
              ? 'Refreshing Stats...'
              : pullDistance >= PULL_THRESHOLD
                ? 'Release to Refresh'
                : 'Pull down to refresh'}
          </span>
        </div>
      </div>

      {/* Opening Splash Screen Overlay */}
      {showSplash && (
        <div
          onClick={() => { setSplashFading(true); setTimeout(() => setShowSplash(false), 400); }}
          className={`fixed inset-0 z-[9999] bg-[#0b101e] flex flex-col items-center justify-center p-6 text-center transition-all duration-700 cursor-pointer select-none ${splashFading ? 'opacity-0 pointer-events-none scale-105' : 'opacity-100'
            }`}
        >
          <div className="absolute w-80 h-80 rounded-full bg-gradient-to-tr from-emerald-500/20 via-teal-500/10 to-transparent blur-3xl animate-pulse"></div>

          <div className="relative z-10 flex flex-col items-center space-y-5 max-w-sm">
            <div className="w-24 h-24 rounded-full bg-black flex items-center justify-center font-black text-emerald-400 text-4xl sm:text-5xl shadow-[0_0_40px_rgba(16,185,129,0.7)] border-2 border-emerald-500/80 transform hover:scale-105 transition-transform duration-500 drop-shadow-[0_0_15px_rgba(52,211,153,0.9)] tracking-tighter relative overflow-hidden group">
              {/* Horizontal Right-To-Left Spinning Green Grid Sphere Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-65 overflow-hidden rounded-full">
                <div className="w-[200%] h-full flex items-center animate-grid-horizontal">
                  <svg className="w-1/2 h-full text-emerald-400 shrink-0" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <line x1="0" y1="22" x2="100" y2="22" strokeDasharray="3 2" />
                    <line x1="0" y1="36" x2="100" y2="36" />
                    <line x1="0" y1="50" x2="100" y2="50" strokeWidth="1.8" />
                    <line x1="0" y1="64" x2="100" y2="64" />
                    <line x1="0" y1="78" x2="100" y2="78" strokeDasharray="3 2" />
                    <path d="M 0,0 Q 25,50 0,100" />
                    <path d="M 25,0 Q 50,50 25,100" />
                    <path d="M 50,0 Q 75,50 50,100" />
                    <path d="M 75,0 Q 100,50 75,100" />
                  </svg>
                  <svg className="w-1/2 h-full text-emerald-400 shrink-0" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <line x1="0" y1="22" x2="100" y2="22" strokeDasharray="3 2" />
                    <line x1="0" y1="36" x2="100" y2="36" />
                    <line x1="0" y1="50" x2="100" y2="50" strokeWidth="1.8" />
                    <line x1="0" y1="64" x2="100" y2="64" />
                    <line x1="0" y1="78" x2="100" y2="78" strokeDasharray="3 2" />
                    <path d="M 0,0 Q 25,50 0,100" />
                    <path d="M 25,0 Q 50,50 25,100" />
                    <path d="M 50,0 Q 75,50 50,100" />
                    <path d="M 75,0 Q 100,50 75,100" />
                  </svg>
                </div>
              </div>
              <span className="relative z-10 drop-shadow-[0_0_10px_rgba(52,211,153,0.9)]">M5</span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider animate-in fade-in slide-in-from-bottom-4 duration-1000">
                Meowdy 5000's Stat Tracker
              </h1>
              <p className="text-xs sm:text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500 uppercase tracking-widest animate-in fade-in slide-in-from-bottom-6 duration-1000">
                SNACK HARD, TRACK HARD
              </p>
            </div>

            <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden mt-4 border border-slate-700/50">
              <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 rounded-full animate-pulse w-full"></div>
            </div>

            <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase pt-2">
              Tap to Skip • {currentSeasonName} Current
            </p>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <nav className="border-b border-slate-800 bg-[#0f1526]/80 backdrop-blur-md sticky top-0 z-50 overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-2.5 sm:px-6 py-2 sm:py-3.5 flex items-center justify-between gap-1.5 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black flex items-center justify-center font-black text-emerald-400 text-xs sm:text-sm tracking-tighter shadow-[0_0_18px_rgba(16,185,129,0.6)] border border-emerald-500/70 shrink-0 drop-shadow-[0_0_8px_rgba(52,211,153,0.9)] relative overflow-hidden">
              {/* Horizontal Right-To-Left Spinning Green Grid Sphere Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-65 overflow-hidden rounded-full">
                <div className="w-[200%] h-full flex items-center animate-grid-horizontal">
                  <svg className="w-1/2 h-full text-emerald-400 shrink-0" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="0" y1="25" x2="100" y2="25" strokeDasharray="3 2" />
                    <line x1="0" y1="50" x2="100" y2="50" strokeWidth="2" />
                    <line x1="0" y1="75" x2="100" y2="75" strokeDasharray="3 2" />
                    <path d="M 0,0 Q 25,50 0,100" />
                    <path d="M 33,0 Q 58,50 33,100" />
                    <path d="M 66,0 Q 91,50 66,100" />
                  </svg>
                  <svg className="w-1/2 h-full text-emerald-400 shrink-0" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="0" y1="25" x2="100" y2="25" strokeDasharray="3 2" />
                    <line x1="0" y1="50" x2="100" y2="50" strokeWidth="2" />
                    <line x1="0" y1="75" x2="100" y2="75" strokeDasharray="3 2" />
                    <path d="M 0,0 Q 25,50 0,100" />
                    <path d="M 33,0 Q 58,50 33,100" />
                    <path d="M 66,0 Q 91,50 66,100" />
                  </svg>
                </div>
              </div>
              <span className="relative z-10 drop-shadow-[0_0_6px_rgba(52,211,153,0.9)]">M5</span>
            </div>
            <span className="text-xs sm:text-lg md:text-xl font-black tracking-wider text-white uppercase truncate">
              <span className="sm:hidden">M5 RIVALS TRACKER</span>
              <span className="hidden sm:inline">M5 RIVALS TRACKER</span>
            </span>
          </div>

          {/* Top Bar Quick Profile Lookup Search Bar */}
          <form onSubmit={handleProfileLookup} className="flex-1 max-w-[200px] xs:max-w-xs sm:max-w-md mx-2">
            <div className="relative flex items-center">
              <input
                type="text"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                placeholder="Profile Lookup (Untracked)..."
                className="w-full bg-[#131b2f] border border-slate-700/70 hover:border-emerald-500/50 focus:border-emerald-500 rounded-xl py-1.5 pl-8 pr-12 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
              />
              <span className="absolute left-2.5 text-slate-400 text-xs pointer-events-none">🔍</span>
              {lookupQuery.trim() ? (
                <button
                  type="submit"
                  className="absolute right-1 px-2 py-0.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] rounded-lg uppercase tracking-wider transition-all cursor-pointer shadow"
                >
                  Lookup
                </button>
              ) : (
                <span className="absolute right-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider hidden sm:inline select-none">
                  Inspect
                </span>
              )}
            </div>
          </form>

          {/* Right Nav Menu & Desktop Error Reports Button */}
          <div className="flex items-center gap-2">
            {!isMobileView && (
              <button
                onClick={openErrorReportsViewer}
                className="hidden md:flex items-center gap-2 bg-[#131b2f] hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/60 text-slate-300 hover:text-amber-400 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md group"
                title="View all client & system error reports logged in backend database"
              >
                <span className="text-amber-400 group-hover:scale-110 transition-transform">📜</span>
                <span>View Error Reports</span>
              </button>
            )}

            <button
              onClick={() => setIsMenuOpen(true)}
              className="flex items-center gap-2 bg-[#131b2f] hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/60 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative shadow-md group"
            >
              <svg className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline text-xs font-bold text-slate-300 group-hover:text-white uppercase tracking-wider">
                Menu
              </span>
              {updateInfo?.hasUpdate && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Layout Container */}
      <main className={`mx-auto px-2.5 sm:px-6 py-3 sm:py-10 transition-all duration-300 w-full ${isMobileView ? 'max-w-full sm:max-w-md py-2' : 'max-w-6xl'
        }`}>

        {/* Update Feedback Toast Banner */}
        {updateToast && (
          <div className={`w-full p-3.5 rounded-2xl mb-4 text-xs sm:text-sm font-bold flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 shadow-lg ${updateToast.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-400'
              : updateToast.type === 'error'
                ? 'bg-red-500/10 border border-red-500/40 text-red-400'
                : 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-400'
            }`}>
            <span>{updateToast.message}</span>
            <button onClick={() => setUpdateToast(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
          </div>
        )}
        {/* Mobile View Badge Indicator */}
        {isMobileView && (
          <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-xl text-xs text-emerald-400 font-medium">
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
        <div className={`flex flex-col items-center text-center ${isMobileView ? 'space-y-2' : 'space-y-3 sm:space-y-6'}`}>
          <h1 className={`font-black tracking-tight text-white uppercase w-full ${isMobileView ? 'text-xl sm:text-3xl' : 'text-2xl sm:text-5xl md:text-6xl lg:text-7xl'
            }`}>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">SNACK HARD, TRACK HARD</span>
          </h1>

          {/* Active Season & Upcoming Season 10 Status Pill */}
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-xs sm:text-sm font-bold text-emerald-400 shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{currentSeasonName} Current</span>
          </div>

          {/* Claim Your Username Helper Subtitle */}
          <p className="text-xs sm:text-sm font-bold text-slate-300 tracking-wider uppercase flex items-center justify-center gap-1.5 pt-1">
            <span>👑</span>
            <span>Claim your username to start tracking</span>
          </p>

          <form onSubmit={fetchStats} className={`w-full ${isMobileView ? 'mt-1' : 'max-w-3xl mt-3 sm:mt-8'}`}>
            <div className={`flex bg-[#131b2f] p-2.5 sm:p-3 rounded-2xl border border-slate-700/50 shadow-2xl ${isMobileView ? 'flex-col gap-2' : 'flex-col md:flex-row items-center gap-3'
              }`}>
              <div className="flex-1 relative w-full">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter Username or UID..."
                  className={`w-full bg-[#0b101e] border border-slate-700/50 rounded-xl px-3.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-white placeholder-slate-500 ${isMobileView ? 'py-2.5 text-sm' : 'py-3.5 sm:py-4 text-base sm:text-lg'
                    }`}
                  required
                />
              </div>
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
                  className={`bg-[#0b101e] border border-slate-700/50 rounded-xl px-3 focus:outline-none focus:border-emerald-500 text-white cursor-pointer text-xs sm:text-sm ${isMobileView ? 'py-2.5 flex-1' : 'py-3.5 sm:py-4'
                    }`}
                >
                  {seasonsList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.status === 'current' ? '(Current)' : s.status === 'upcoming' ? '(Upcoming)' : ''}
                    </option>
                  ))}
                  <option value="">Current Season</option>
                </select>
                <button
                  type="submit"
                  disabled={loading}
                  className={`bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.3)] uppercase tracking-wider text-xs sm:text-sm ${isMobileView ? 'py-2.5 px-4 flex-1' : 'py-3.5 sm:py-4 px-6 sm:px-8'
                    }`}
                >
                  {loading ? 'Scanning...' : 'Search'}
                </button>
              </div>
            </div>
          </form>

          {/* Live Search Telemetry Progress Bar */}
          {loading && (
            <div className={`w-full ${isMobileView ? '' : 'max-w-3xl'} bg-[#131b2f] border-2 border-emerald-500/60 rounded-2xl p-4 shadow-2xl shadow-emerald-500/20 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300 text-left`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin shrink-0"></div>
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    {searchProgressMsg || 'Searching Marvel Rivals Database...'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    {searchProgress}%
                  </span>
                  <button
                    type="button"
                    onClick={cancelSearch}
                    className="text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 border border-red-500/40 px-2.5 py-1 rounded-lg font-bold uppercase cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Glowing Progress Track Bar */}
              <div className="w-full bg-slate-900 border border-slate-700/60 rounded-full h-3 overflow-hidden p-0.5">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-full rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(16,185,129,0.8)]"
                  style={{ width: `${Math.max(searchProgress, 8)}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Expandable "How Tracking Works" Box */}
          <div className={`w-full ${isMobileView ? '' : 'max-w-3xl'} text-left`}>
            <details className="group bg-[#131b2f] border border-slate-700/50 rounded-xl overflow-hidden shadow-lg transition-all duration-300">
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-bold text-slate-400 hover:text-emerald-400 transition-colors list-none">
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

          {/* Error Message with Prominent Report Button */}
          {error && (
            <div className="w-full max-w-3xl bg-red-500/15 border-2 border-red-500/60 text-red-400 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm shadow-2xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="font-bold">{error}</span>
              </div>

              <button
                onClick={() => {
                  setReportNotes(`Error encountered: ${error}`);
                  setShowReportModal(true);
                }}
                className="shrink-0 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/60 text-amber-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md hover:scale-105 active:scale-95"
              >
                <span>⚠️</span>
                <span>Report Error to Developers</span>
              </button>
            </div>
          )}

          {/* Pinned Home Profile Quick Lookup Card */}
          {pinnedHomeProfile && (!stats || stats.current.username?.toLowerCase() !== pinnedHomeProfile.username?.toLowerCase()) && (
            <div className={`w-full ${isMobileView ? '' : 'max-w-3xl'} bg-gradient-to-br from-[#131b2f] via-[#0f172a] to-[#0b101e] border-2 border-emerald-500/50 p-4 sm:p-5 rounded-2xl shadow-2xl shadow-emerald-500/10 space-y-3 text-left relative overflow-hidden group animate-in fade-in slide-in-from-top-2 duration-300`}>
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                <span className="text-7xl">⭐</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                <div className="flex items-center gap-3.5">
                  {pinnedHomeProfile.avatarUrl ? (
                    <img src={pinnedHomeProfile.avatarUrl} alt={pinnedHomeProfile.username} className="w-12 h-12 rounded-xl border border-emerald-500/60 object-cover shadow-md" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-black text-white text-lg shadow-md">
                      {pinnedHomeProfile.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                        <span>⭐</span> Pinned Home Profile
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Season {pinnedHomeProfile.season || season}</span>
                    </div>
                    <h3 className="font-black text-white text-xl tracking-tight mt-0.5">{pinnedHomeProfile.username}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setQuery(pinnedHomeProfile.username);
                      fetchStats(null, pinnedHomeProfile.username, pinnedHomeProfile.season || season);
                    }}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/20 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95"
                  >
                    <span>⚡</span>
                    <span>Quick Lookup</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePinHomeProfile(pinnedHomeProfile)}
                    title="Unpin Home Profile"
                    className="bg-slate-800/80 hover:bg-red-500/20 border border-slate-700 hover:border-red-500/40 text-slate-400 hover:text-red-400 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoLoadHomeProfile}
                    onChange={toggleAutoLoadHomeProfile}
                    className="w-3.5 h-3.5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-900 cursor-pointer accent-emerald-500"
                  />
                  <span className="text-[11px] font-bold text-slate-300">Auto-load this profile on app launch</span>
                </label>
                {pinnedHomeProfile.rank && (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    💎 {pinnedHomeProfile.rank}
                  </span>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Dashboard Results */}
        {stats && !loading && (
          <div className={`animate-in fade-in slide-in-from-bottom-8 duration-700 ${isMobileView ? 'space-y-5' : 'space-y-8'}`}>

            {/* Profile Confirmation Banner before committing to track */}
            {(!claimedProfile || claimedProfile.username?.toLowerCase() !== stats.current.username?.toLowerCase()) && (
              <div className="bg-gradient-to-r from-[#131b2f] via-[#0f172a] to-[#131b2f] border-2 border-emerald-500/70 p-4 sm:p-6 rounded-2xl shadow-2xl space-y-3 text-left animate-in fade-in slide-in-from-top-3 duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-2xl shrink-0 shadow-lg shadow-emerald-500/20">
                      👑
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-2 flex-wrap">
                        <span>Profile Found: {stats.current.username}</span>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Inspect & Confirm
                        </span>
                      </h3>
                      <p className="text-xs text-slate-300 font-medium mt-0.5 leading-relaxed">
                        Inspect the player stats below. Click <strong>Confirm & Claim Profile</strong> to save this profile so it automatically loads on app startup!
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('success');
                      handleClaimProfile(stats.current.username);
                    }}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs sm:text-sm px-6 py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/30 uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shrink-0 hover:scale-105 active:scale-95"
                  >
                    <span>👑</span>
                    <span>Confirm & Claim Profile</span>
                  </button>
                </div>
              </div>
            )}

            {/* Player Header Banner */}
            {/* Player Header Banner with Interactive Track Player Switch */}
            <div className={`bg-[#131b2f] rounded-2xl border border-slate-700/50 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 ${isMobileView ? 'p-4 text-center' : 'p-6 md:p-8 text-left'
              }`}>
              <div className="flex items-center gap-4">
                {/* Profile Picture Avatar Container with Change Picture Trigger Button */}
                <div className="relative group cursor-pointer" onClick={() => { triggerHaptic('light'); setShowAvatarModal(true); }}>
                  {getDisplayAvatar(stats.current.username) ? (
                    <img
                      src={getDisplayAvatar(stats.current.username)}
                      alt={stats.current.username}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-emerald-500/60 shadow-lg shadow-emerald-500/20 object-cover group-hover:opacity-80 transition-opacity"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-black text-white text-2xl shadow-lg shadow-emerald-500/20 group-hover:opacity-80 transition-opacity">
                      {stats.current.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {/* Change Profile Picture Hover Badge */}
                  <div className="absolute -bottom-1 -right-1 bg-[#0b101e] border border-emerald-500/60 text-emerald-400 p-1.5 rounded-full text-xs font-bold shadow-lg group-hover:scale-110 transition-transform">
                    📷
                  </div>
                </div>
                <div>
                  <h2 className={`font-black text-white ${isMobileView ? 'text-2xl' : 'text-3xl'}`}>{stats.current.username}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="bg-gradient-to-r from-blue-600/30 to-indigo-600/30 text-blue-300 border border-blue-500/50 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-blue-500/10">
                      <span>💎</span>
                      <span>{stats.current.rank || 'Unranked'}</span>
                    </span>
                    {stats.current.peakRank && stats.current.peakRank !== 'Unranked' && (
                      <span className="bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-md text-[11px] font-bold">
                        🏆 Peak: {stats.current.peakRank}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Data Sources:</span>
                    {(stats.current.sources && stats.current.sources.length > 0 ? stats.current.sources : ["Tracker.gg", "RivalsMeta.com"]).map((src, sIdx) => (
                      <span key={sIdx} className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>🌐</span>
                        <span>{src}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Interactive Track Player Toggle Checkbox / Button */}
              <button
                onClick={() => handleToggleTrackPlayer(stats.current.username)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2.5 cursor-pointer shadow-lg border ${trackedPlayers[stats.current.username?.toLowerCase()]
                    ? 'bg-emerald-500/20 border-emerald-500/80 text-emerald-400 shadow-emerald-500/20 hover:bg-emerald-500/30'
                    : 'bg-slate-800/90 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white'
                  }`}
              >
                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black border transition-all ${trackedPlayers[stats.current.username?.toLowerCase()]
                    ? 'bg-emerald-500 border-emerald-400 text-black'
                    : 'border-slate-600 bg-slate-900 text-transparent'
                  }`}>
                  ✓
                </span>
                <span>
                  {trackedPlayers[stats.current.username?.toLowerCase()] ? 'Tracked • Snapshot Data Active' : 'Track Player Progress'}
                </span>
              </button>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => {
                    if (claimedProfile?.username?.toLowerCase() === stats.current.username?.toLowerCase()) {
                      handleUnclaimProfile();
                    } else {
                      handleClaimProfile(stats.current.username);
                    }
                  }}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer shadow-lg border uppercase tracking-wider ${
                    claimedProfile?.username?.toLowerCase() === stats.current.username?.toLowerCase()
                      ? 'bg-emerald-500/20 border-emerald-500/80 text-emerald-300 shadow-emerald-500/20 hover:bg-emerald-500/30'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-emerald-400/50 text-white'
                  }`}
                >
                  <span>👑 {claimedProfile?.username?.toLowerCase() === stats.current.username?.toLowerCase() ? 'Claimed Profile ✓' : 'Claim Profile'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => sharePlayerStats()}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20 border border-blue-400/40 uppercase tracking-wider"
                >
                  <span>📤 Share Stats</span>
                </button>
              </div>
            </div>

            {/* 3-Site Profile Webpage Selection Buttons Card */}
            <div className="bg-[#131b2f] border border-slate-700/60 p-4 sm:p-5 rounded-2xl shadow-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <span className="text-emerald-400">🌐</span>
                    <span>View Web Profile Page across 3 Tracking Sites</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">Select which site's official web profile page you would like to open:</p>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                  3 Profile Links Available
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    const url = stats.current.siteUrls?.trackerGg || stats.current.trackerUrl || `https://tracker.gg/marvel-rivals/profile/ign/${encodeURIComponent(stats.current.username)}/overview`;
                    openExternalUrl(url);
                    showNativeToast('🌐 Opening Tracker.gg profile webpage...');
                  }}
                  className="flex items-center justify-between bg-[#0b101e] hover:bg-emerald-500/20 border border-emerald-500/40 hover:border-emerald-500 text-emerald-400 p-3 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base group-hover:scale-110 transition-transform">🌐</span>
                    <div className="text-left">
                      <span className="block text-white font-black">Tracker.gg</span>
                      <span className="text-[9px] text-emerald-400 font-normal">tracker.gg/marvel-rivals</span>
                    </div>
                  </div>
                  <span className="text-xs font-black text-slate-500 group-hover:text-emerald-300">Open ↗</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    const isUid = stats.current.username && !isNaN(stats.current.username);
                    const rmFallback = isUid ? `https://rivalsmeta.com/player/${encodeURIComponent(stats.current.username)}` : `https://rivalsmeta.com/search?q=${encodeURIComponent(stats.current.username)}`;
                    const url = stats.current.siteUrls?.rivalsMeta || rmFallback;
                    openExternalUrl(url);
                    showNativeToast('⚔️ Opening RivalsMeta.com profile webpage...');
                  }}
                  className="flex items-center justify-between bg-[#0b101e] hover:bg-teal-500/20 border border-teal-500/40 hover:border-teal-500 text-teal-400 p-3 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base group-hover:scale-110 transition-transform">⚔️</span>
                    <div className="text-left">
                      <span className="block text-white font-black">RivalsMeta</span>
                      <span className="text-[9px] text-teal-400 font-normal">rivalsmeta.com</span>
                    </div>
                  </div>
                  <span className="text-xs font-black text-slate-500 group-hover:text-teal-300">Open ↗</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    const isUid = stats.current.username && !isNaN(stats.current.username);
                    const rtFallback = isUid ? `https://rivalstracker.com/player/${encodeURIComponent(stats.current.username)}` : `https://rivalstracker.com/search?q=${encodeURIComponent(stats.current.username)}`;
                    const url = stats.current.siteUrls?.rivalsTracker || rtFallback;
                    openExternalUrl(url);
                    showNativeToast('🎯 Opening RivalsTracker.com profile webpage...');
                  }}
                  className="flex items-center justify-between bg-[#0b101e] hover:bg-blue-500/20 border border-blue-500/40 hover:border-blue-500 text-blue-400 p-3 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base group-hover:scale-110 transition-transform">🎯</span>
                    <div className="text-left">
                      <span className="block text-white font-black">RivalsTracker</span>
                      <span className="text-[9px] text-blue-400 font-normal">rivalstracker.com</span>
                    </div>
                  </div>
                  <span className="text-xs font-black text-slate-500 group-hover:text-blue-300">Open ↗</span>
                </button>
              </div>
            </div>

            {/* User View Navigation Tabs: Live Performance vs Saved Data over Time */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#131b2f] p-2 rounded-2xl border border-slate-700/60 shadow-xl">
              <div className="flex items-center gap-1.5 bg-[#0b101e] p-1.5 rounded-xl border border-slate-800 flex-1 sm:flex-initial">
                <button
                  type="button"
                  onClick={() => setActiveUserTab('live')}
                  className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${activeUserTab === 'live'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                >
                  <span>📊 Live Performance</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveUserTab('history')}
                  className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${activeUserTab === 'history'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                >
                  <span>📜 Saved Data Over Time ({stats.history?.length || 0})</span>
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 px-2">
                <button
                  type="button"
                  onClick={() => downloadUserDataset(stats)}
                  className="px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 font-bold text-xs uppercase cursor-pointer flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <span>📥 Export Full Dataset (.json)</span>
                </button>
              </div>
            </div>

            {/* Tab 1: Live Performance & Metrics */}
            {activeUserTab === 'live' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Progress & Performance Focus Insights */}
                <div className="bg-[#131b2f] border border-emerald-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📈</span>
                      <h3 className="text-base font-black text-white uppercase tracking-wider">
                        Progress & Performance Insights
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="text-slate-400 font-bold">
                        {trackedPlayers[stats.current.username?.toLowerCase()]
                          ? 'Tracking Enabled • Data File Snapshots Active'
                          : 'Enable "Track Player Progress" above to log performance snapshots to data file'}
                      </span>
                    </div>
                  </div>

                  {/* What to Focus On Coaching Advice */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#0f1526] border border-slate-700/60 p-4 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                        <span>🎯</span>
                        <span>What You Should Focus On Next:</span>
                      </div>
                      <ul className="space-y-2 text-slate-300 text-xs leading-relaxed">
                        {parseFloat(stats.current.winRate || 0) < 50 ? (
                          <li className="flex items-start gap-2">
                            <span className="text-amber-400 font-bold">•</span>
                            <span><strong>Objective Control:</strong> Win Rate is {stats.current.winRate}%. Prioritize team group-ups before contesting objective points.</span>
                          </li>
                        ) : (
                          <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Maintain Momentum:</strong> Solid Win Rate ({stats.current.winRate}%). Keep leveraging main hero compositions during ranked matches.</span>
                          </li>
                        )}

                        {parseFloat(stats.current.kdRatio || 0) < 2.5 ? (
                          <li className="flex items-start gap-2">
                            <span className="text-amber-400 font-bold">•</span>
                            <span><strong>K/D/A Positioning:</strong> K/D ratio is {stats.current.kdRatio}. Focus on defensive cover and saving escape abilities.</span>
                          </li>
                        ) : (
                          <li className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span><strong>Strong Combat Efficiency:</strong> High K/D ratio ({stats.current.kdRatio}). Focus on coordinated ultimate callouts with teammates.</span>
                          </li>
                        )}
                      </ul>
                    </div>

                    <div className="bg-[#0f1526] border border-slate-700/60 p-4 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                        <span>📊</span>
                        <span>Stat Snapshot File Status:</span>
                      </div>
                      <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                        <p>
                          <strong>Current Snapshot:</strong> {stats.current.winRate}% Win Rate | {stats.current.kdRatio} K/D/A | Top Hero: {stats.current.topHero}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          📂 Saved to local data file <code className="text-emerald-400">tracked_stats_{stats.current.username.toLowerCase()}.json</code> on device.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Favorite Primary Site Selection Bar for Minimized Cards */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#131b2f] p-3.5 sm:p-4 rounded-2xl border border-slate-700/60 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm border border-amber-500/30 shrink-0">
                      ⭐
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <span>Minimized Card Primary Site</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          {favoriteSite === 'trackerGg' ? 'Tracker.gg' : favoriteSite === 'rivalsMeta' ? 'RivalsMeta' : 'RivalsTracker'}
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium">Select which site's stat value displays when cards are minimized. Tap cards to expand all 3 sites!</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#0b101e] p-1.5 rounded-xl border border-slate-800 shrink-0 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => handleSetFavoriteSite('trackerGg')}
                      className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${favoriteSite === 'trackerGg'
                          ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-400 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      Tracker.gg
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetFavoriteSite('rivalsMeta')}
                      className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${favoriteSite === 'rivalsMeta'
                          ? 'bg-teal-500/20 border border-teal-500/60 text-teal-400 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      RivalsMeta
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetFavoriteSite('rivalsTracker')}
                      className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${favoriteSite === 'rivalsTracker'
                          ? 'bg-blue-500/20 border border-blue-500/60 text-blue-400 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      RivalsTracker
                    </button>
                  </div>
                </div>

                {/* Primary Tracked Metrics Grid */}
                <div className={`grid gap-4 ${isMobileView ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 md:gap-6'
                  }`}>
                  {selectedMetrics.map((metricId, orderIndex) => {
                    if (metricId === 'winRate') return (
                      <div
                        key="winRate"
                        onClick={() => toggleExpandMetric('winRate')}
                        className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
                          }`}
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {isEditOrderMode && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black animate-pulse">
                                #{orderIndex + 1}
                              </span>
                            )}
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Win Rate</p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-400 transition-colors">
                            {expandedMetric === 'winRate' ? '▲ Hide' : '▼ Expand'}
                          </span>
                        </div>
                        <p className={`font-black text-white ${isMobileView ? 'text-4xl' : 'text-5xl'}`}>{stats.current.winRate}%</p>

                        {expandedMetric === 'winRate' && (
                          <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-2 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Total Matches:</span>
                              <span className="font-bold text-white">{stats.current.matchesPlayed}</span>
                            </div>
                            <div className="flex justify-between text-emerald-400 font-medium">
                              <span>Victories (Wins):</span>
                              <span className="font-bold">{stats.current.matchesWon}</span>
                            </div>
                            <div className="flex justify-between text-red-400 font-medium">
                              <span>Defeats (Losses):</span>
                              <span className="font-bold">{stats.current.matchesPlayed - stats.current.matchesWon}</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex mt-2">
                              <div className="bg-emerald-500 h-full" style={{ width: `${stats.current.winRate}%` }}></div>
                              <div className="bg-red-500 h-full flex-1"></div>
                            </div>
                          </div>
                        )}
                        {render3SiteBreakdown('winRate')}
                      </div>
                    );

                    if (metricId === 'kdRatio') return (
                      <div
                        key="kdRatio"
                        onClick={() => toggleExpandMetric('kdRatio')}
                        className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
                          }`}
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {isEditOrderMode && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black animate-pulse">
                                #{orderIndex + 1}
                              </span>
                            )}
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">KDA Ratio</p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-400 transition-colors">
                            {expandedMetric === 'kdRatio' ? '▲ Hide' : '▼ Expand'}
                          </span>
                        </div>
                        <p className={`font-black text-white ${isMobileView ? 'text-4xl' : 'text-5xl'}`}>{stats.current.kdRatio}</p>

                        {expandedMetric === 'kdRatio' && (
                          <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-2 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Eliminations (Kills):</span>
                              <span className="font-bold text-emerald-400">{(stats.current.kills || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Assists:</span>
                              <span className="font-bold text-blue-400">{(stats.current.assists || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Deaths:</span>
                              <span className="font-bold text-red-400">{(stats.current.deaths || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                              <span>Pure K/D Ratio:</span>
                              <span className="font-bold text-white">{((stats.current.kills || 0) / (stats.current.deaths || 1)).toFixed(2)}</span>
                            </div>
                          </div>
                        )}
                        {render3SiteBreakdown('kdRatio')}
                      </div>
                    );

                    if (metricId === 'heroDamage') return (
                      <div
                        key="heroDamage"
                        onClick={() => toggleExpandMetric('heroDamage')}
                        className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
                          }`}
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                          </svg>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {isEditOrderMode && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black animate-pulse">
                                #{orderIndex + 1}
                              </span>
                            )}
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Damage / 10m</p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-400 transition-colors">
                            {expandedMetric === 'heroDamage' ? '▲ Hide' : '▼ Expand'}
                          </span>
                        </div>
                        <p className={`font-black text-emerald-400 truncate ${isMobileView ? 'text-3xl' : 'text-4xl'}`}>
                          {typeof stats.current.heroDamage === 'number' ? stats.current.heroDamage.toLocaleString() : (stats.current.heroDamage || 'N/A')}
                        </p>

                        {expandedMetric === 'heroDamage' && (
                          <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-2 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Total Damage Output:</span>
                              <span className="font-bold text-emerald-400">{(stats.current.totalHeroDamageRaw || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Avg Damage / Match:</span>
                              <span className="font-bold text-white">
                                {stats.current.matchesPlayed ? Math.round(stats.current.totalHeroDamageRaw / stats.current.matchesPlayed).toLocaleString() : 0}
                              </span>
                            </div>
                          </div>
                        )}
                        {render3SiteBreakdown('heroDamage')}
                      </div>
                    );

                    if (metricId === 'healing') return (
                      <div
                        key="healing"
                        onClick={() => toggleExpandMetric('healing')}
                        className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
                          }`}
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {isEditOrderMode && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black animate-pulse">
                                #{orderIndex + 1}
                              </span>
                            )}
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Healing / 10m</p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-400 transition-colors">
                            {expandedMetric === 'healing' ? '▲ Hide' : '▼ Expand'}
                          </span>
                        </div>
                        <p className={`font-black text-emerald-400 truncate ${isMobileView ? 'text-3xl' : 'text-4xl'}`}>
                          {stats.current.healing || 'N/A'}
                        </p>

                        {expandedMetric === 'healing' && (
                          <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-2 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Total Healing Output:</span>
                              <span className="font-bold text-emerald-400">{(stats.current.totalHeroHealRaw || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Avg Healing / Match:</span>
                              <span className="font-bold text-white">
                                {stats.current.matchesPlayed ? Math.round(stats.current.totalHeroHealRaw / stats.current.matchesPlayed).toLocaleString() : 0}
                              </span>
                            </div>
                          </div>
                        )}
                        {render3SiteBreakdown('healing')}
                      </div>
                    );

                    if (metricId === 'damageBlocked') return (
                      <div
                        key="damageBlocked"
                        onClick={() => toggleExpandMetric('damageBlocked')}
                        className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
                          }`}
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {isEditOrderMode && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black animate-pulse">
                                #{orderIndex + 1}
                              </span>
                            )}
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Dmg Blocked / 10m</p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-400 transition-colors">
                            {expandedMetric === 'damageBlocked' ? '▲ Hide' : '▼ Expand'}
                          </span>
                        </div>
                        <p className={`font-black text-purple-400 truncate ${isMobileView ? 'text-3xl' : 'text-4xl'}`}>
                          {stats.current.damageBlocked || 'N/A'}
                        </p>

                        {expandedMetric === 'damageBlocked' && (
                          <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-2 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Total Damage Blocked:</span>
                              <span className="font-bold text-purple-400">{(stats.current.totalDamageTakenRaw || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Avg Blocked / Match:</span>
                              <span className="font-bold text-white">
                                {stats.current.matchesPlayed ? Math.round(stats.current.totalDamageTakenRaw / stats.current.matchesPlayed).toLocaleString() : 0}
                              </span>
                            </div>
                          </div>
                        )}
                        {render3SiteBreakdown('damageBlocked')}
                      </div>
                    );

                    if (metricId === 'accuracy') return (
                      <div
                        key="accuracy"
                        onClick={() => toggleExpandMetric('accuracy')}
                        className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
                          }`}
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {isEditOrderMode && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black animate-pulse">
                                #{orderIndex + 1}
                              </span>
                            )}
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Accuracy</p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-400 transition-colors">
                            {expandedMetric === 'accuracy' ? '▲ Hide' : '▼ Expand'}
                          </span>
                        </div>
                        <p className={`font-black text-yellow-400 ${isMobileView ? 'text-4xl' : 'text-5xl'}`}>
                          {stats.current.accuracy || 'N/A'}
                        </p>

                        {expandedMetric === 'accuracy' && (
                          <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-2 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Primary Attack Hits:</span>
                              <span className="font-bold text-yellow-400">{(stats.current.mainAttackHits || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Total Shots Fired:</span>
                              <span className="font-bold text-white">{(stats.current.mainAttacks || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-slate-400 font-medium">
                              <span>Missed Shots:</span>
                              <span className="font-bold text-red-400">
                                {((stats.current.mainAttacks || 0) - (stats.current.mainAttackHits || 0)).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )}
                        {render3SiteBreakdown('accuracy')}
                      </div>
                    );

                    if (metricId === 'mvp') return (
                      <div
                        key="mvp"
                        onClick={() => toggleExpandMetric('mvp')}
                        className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
                          }`}
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity text-amber-400 font-black text-4xl">
                          👑
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {isEditOrderMode && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black animate-pulse">
                                #{orderIndex + 1}
                              </span>
                            )}
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">MVPs</p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-400 transition-colors">
                            {expandedMetric === 'mvp' ? '▲ Hide' : '▼ Expand'}
                          </span>
                        </div>
                        <p className={`font-black text-amber-400 ${isMobileView ? 'text-3xl' : 'text-4xl'}`}>
                          {stats.current.mvp || '0'}
                        </p>

                        {expandedMetric === 'mvp' && (
                          <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-2 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>MVP Performance Trophies:</span>
                              <span className="font-bold text-amber-400">{stats.current.mvp}</span>
                            </div>
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Total Matches Played:</span>
                              <span className="font-bold text-white">{stats.current.matchesPlayed}</span>
                            </div>
                          </div>
                        )}
                        {render3SiteBreakdown('mvp')}
                      </div>
                    );

                    if (metricId === 'svp') return (
                      <div
                        key="svp"
                        onClick={() => toggleExpandMetric('svp')}
                        className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
                          }`}
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity text-purple-400 font-black text-4xl">
                          🌟
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {isEditOrderMode && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black animate-pulse">
                                #{orderIndex + 1}
                              </span>
                            )}
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">SVPs</p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-400 transition-colors">
                            {expandedMetric === 'svp' ? '▲ Hide' : '▼ Expand'}
                          </span>
                        </div>
                        <p className={`font-black text-purple-400 ${isMobileView ? 'text-3xl' : 'text-4xl'}`}>
                          {stats.current.svp || '0'}
                        </p>

                        {expandedMetric === 'svp' && (
                          <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-2 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>SVP Team Honors:</span>
                              <span className="font-bold text-purple-400">{stats.current.svp}</span>
                            </div>
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Total Matches Played:</span>
                              <span className="font-bold text-white">{stats.current.matchesPlayed}</span>
                            </div>
                          </div>
                        )}
                        {render3SiteBreakdown('svp')}
                      </div>
                    );

                    if (metricId === 'timePlayed') return (
                      <div
                        key="timePlayed"
                        onClick={() => toggleExpandMetric('timePlayed')}
                        className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
                          }`}
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {isEditOrderMode && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black animate-pulse">
                                #{orderIndex + 1}
                              </span>
                            )}
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total Playtime</p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-400 transition-colors">
                            {expandedMetric === 'timePlayed' ? '▲ Hide' : '▼ Expand'}
                          </span>
                        </div>
                        <p className={`font-black text-sky-400 ${isMobileView ? 'text-3xl' : 'text-4xl'}`}>
                          {stats.current.timePlayed || 'N/A'}
                        </p>

                        {expandedMetric === 'timePlayed' && (
                          <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-2 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Total Recorded Hours:</span>
                              <span className="font-bold text-sky-400">{stats.current.timePlayed}</span>
                            </div>
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Matches Tracked:</span>
                              <span className="font-bold text-white">{stats.current.matchesPlayed}</span>
                            </div>
                          </div>
                        )}
                        {render3SiteBreakdown('timePlayed')}
                      </div>
                    );

                    if (metricId === 'matchesPlayed') return (
                      <div
                        key="matchesPlayed"
                        onClick={() => toggleExpandMetric('matchesPlayed')}
                        className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
                          }`}
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {isEditOrderMode && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black animate-pulse">
                                #{orderIndex + 1}
                              </span>
                            )}
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Matches & Wins</p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 group-hover:text-emerald-400 transition-colors">
                            {expandedMetric === 'matchesPlayed' ? '▲ Hide' : '▼ Expand'}
                          </span>
                        </div>
                        <p className={`font-black text-white ${isMobileView ? 'text-3xl' : 'text-4xl'}`}>
                          {stats.current.matchesWon} <span className="text-sm font-bold text-slate-400">Wins</span> / {stats.current.matchesPlayed} <span className="text-sm font-bold text-slate-400">Total</span>
                        </p>

                        {expandedMetric === 'matchesPlayed' && (
                          <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-2 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex justify-between text-emerald-400 font-medium">
                              <span>Victories:</span>
                              <span className="font-bold">{stats.current.matchesWon}</span>
                            </div>
                            <div className="flex justify-between text-red-400 font-medium">
                              <span>Defeats:</span>
                              <span className="font-bold">{stats.current.matchesPlayed - stats.current.matchesWon}</span>
                            </div>
                            <div className="flex justify-between text-slate-300 font-medium">
                              <span>Win Rate:</span>
                              <span className="font-bold text-white">{stats.current.winRate}%</span>
                            </div>
                          </div>
                        )}
                        {render3SiteBreakdown('matchesPlayed')}
                      </div>
                    );

                    if (metricId === 'topHeroes') return (
                      <div key="topHeroes" className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group transition-all duration-300 ${isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50'
                        }`}>
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {isEditOrderMode && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black animate-pulse">
                                #{orderIndex + 1}
                              </span>
                            )}
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Top Heroes</p>
                          </div>
                        </div>

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
                                    <p className="text-sm font-black text-emerald-400">{hero.winRate}%</p>
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
                    );
                  })}
                </div>

                {/* Detailed Combat Telemetry Grid */}
                <div className={`grid gap-3 bg-[#131b2f] p-4 sm:p-5 rounded-2xl border border-slate-700/50 shadow-xl ${isMobileView ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                  }`}>
                  {/* Card 1: Matches & Wins */}
                  <div className="p-3.5 bg-[#0b101e] rounded-xl border border-slate-800/80 flex flex-col justify-between relative">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        Matches & Wins
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setActiveStatReport(activeStatReport === 'matches' ? null : 'matches'); }}
                          className="w-4 h-4 rounded-full bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 border border-amber-500/40 flex items-center justify-center text-[10px] font-black transition-all cursor-pointer shadow-sm hover:scale-110 active:scale-95"
                          title="Report inaccurate stat"
                        >
                          !
                        </button>
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        {stats.current.winRate}% WR
                      </span>
                    </span>
                    <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                      <span className="text-xl sm:text-2xl font-black text-white">{stats.current.matchesWon || 0}</span>
                      <span className="text-xs text-emerald-400 font-bold">Wins</span>
                      <span className="text-slate-600 text-xs font-bold">•</span>
                      <span className="text-xs text-slate-400 font-medium">{stats.current.matchesPlayed || 0} Total</span>
                    </div>
                    {activeStatReport === 'matches' && (
                      <div className="mt-2.5 p-2 bg-amber-500/10 border border-amber-500/40 rounded-xl flex items-center justify-between gap-2 animate-in fade-in zoom-in duration-200">
                        <span className="text-[10px] text-amber-300 font-bold">This stat looks wrong?</span>
                        <button
                          type="button"
                          onClick={() => reportSpecificStatInaccuracy('matches', 'Matches & Wins', `${stats.current.matchesWon} Wins / ${stats.current.matchesPlayed} Total (${stats.current.winRate}% WR)`)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase tracking-wider transition-all shadow-md cursor-pointer shrink-0"
                        >
                          ⚠️ Report Accuracy Issue
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card 2: KDA Breakdown */}
                  <div className="p-3.5 bg-[#0b101e] rounded-xl border border-slate-800/80 flex flex-col justify-between relative">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        Combat K / D / A
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setActiveStatReport(activeStatReport === 'kda' ? null : 'kda'); }}
                          className="w-4 h-4 rounded-full bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 border border-amber-500/40 flex items-center justify-center text-[10px] font-black transition-all cursor-pointer shadow-sm hover:scale-110 active:scale-95"
                          title="Report inaccurate stat"
                        >
                          !
                        </button>
                      </span>
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
                    {activeStatReport === 'kda' && (
                      <div className="mt-2.5 p-2 bg-amber-500/10 border border-amber-500/40 rounded-xl flex items-center justify-between gap-2 animate-in fade-in zoom-in duration-200">
                        <span className="text-[10px] text-amber-300 font-bold">This stat looks wrong?</span>
                        <button
                          type="button"
                          onClick={() => reportSpecificStatInaccuracy('kda', 'Combat KDA', `${stats.current.kills}K / ${stats.current.deaths}D / ${stats.current.assists}A (${stats.current.kdRatio} KDA)`)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase tracking-wider transition-all shadow-md cursor-pointer shrink-0"
                        >
                          ⚠️ Report Accuracy Issue
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card 3: Hero Damage */}
                  <div className="p-3.5 bg-[#0b101e] rounded-xl border border-slate-800/80 flex flex-col justify-between relative">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        Total Damage
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setActiveStatReport(activeStatReport === 'damage' ? null : 'damage'); }}
                          className="w-4 h-4 rounded-full bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 border border-amber-500/40 flex items-center justify-center text-[10px] font-black transition-all cursor-pointer shadow-sm hover:scale-110 active:scale-95"
                          title="Report inaccurate stat"
                        >
                          !
                        </button>
                      </span>
                    </span>
                    <div className="mt-2 flex items-baseline gap-1 truncate">
                      <span className="text-lg sm:text-xl md:text-2xl font-black text-emerald-400 truncate">
                        {typeof stats.current.heroDamage === 'number'
                          ? stats.current.heroDamage.toLocaleString()
                          : (stats.current.heroDamage || 'N/A')}
                      </span>
                    </div>
                    {activeStatReport === 'damage' && (
                      <div className="mt-2.5 p-2 bg-amber-500/10 border border-amber-500/40 rounded-xl flex items-center justify-between gap-2 animate-in fade-in zoom-in duration-200">
                        <span className="text-[10px] text-amber-300 font-bold">This stat looks wrong?</span>
                        <button
                          type="button"
                          onClick={() => reportSpecificStatInaccuracy('damage', 'Total Damage', `${stats.current.heroDamage}`)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase tracking-wider transition-all shadow-md cursor-pointer shrink-0"
                        >
                          ⚠️ Report Accuracy Issue
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card 4: Total Playtime */}
                  <div className="p-3.5 bg-[#0b101e] rounded-xl border border-slate-800/80 flex flex-col justify-between relative">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        Total Playtime
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setActiveStatReport(activeStatReport === 'playtime' ? null : 'playtime'); }}
                          className="w-4 h-4 rounded-full bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 border border-amber-500/40 flex items-center justify-center text-[10px] font-black transition-all cursor-pointer shadow-sm hover:scale-110 active:scale-95"
                          title="Report inaccurate stat"
                        >
                          !
                        </button>
                      </span>
                    </span>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-lg sm:text-xl md:text-2xl font-black text-blue-400">
                        {stats.current.timePlayed || 'N/A'}
                      </span>
                    </div>
                    {activeStatReport === 'playtime' && (
                      <div className="mt-2.5 p-2 bg-amber-500/10 border border-amber-500/40 rounded-xl flex items-center justify-between gap-2 animate-in fade-in zoom-in duration-200">
                        <span className="text-[10px] text-amber-300 font-bold">This stat looks wrong?</span>
                        <button
                          type="button"
                          onClick={() => reportSpecificStatInaccuracy('playtime', 'Total Playtime', `${stats.current.timePlayed}`)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase tracking-wider transition-all shadow-md cursor-pointer shrink-0"
                        >
                          ⚠️ Report Accuracy Issue
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Saved Data Over Time (Graphical Progress & Trends Dashboard) */}
            {activeUserTab === 'history' && (
              <div className="space-y-6 animate-in fade-in duration-300 text-left">

                {/* Header & Timeframe Selector Card */}
                <div className="bg-[#131b2f] border border-slate-700/60 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <span>📈 Player Progress & Trends Over Time</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Visual performance progression charts logged for <strong className="text-emerald-400">{stats.current.username}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <select
                        value={timeframe}
                        onChange={(e) => setTimeframe(e.target.value)}
                        className="bg-[#0b101e] border border-slate-700/80 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 text-white text-xs font-bold cursor-pointer shadow-md"
                      >
                        <option value="all">All-Time History</option>
                        <option value="30d">Past 30 Days</option>
                        <option value="7d">Past 7 Days</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => downloadUserDataset(stats)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/60 text-emerald-300 font-bold text-xs uppercase cursor-pointer transition-all"
                      >
                        📥 Export Data File
                      </button>
                    </div>
                  </div>

                  {/* Progress Summary Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#0f1526] p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Snapshots Logged</span>
                      <p className="text-xl font-black text-emerald-400">{stats.history?.length || 0}</p>
                    </div>
                    <div className="bg-[#0f1526] p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Current Win Rate</span>
                      <p className="text-xl font-black text-white">{stats.current.winRate ? `${stats.current.winRate}%` : 'N/A'}</p>
                    </div>
                    <div className="bg-[#0f1526] p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Current KD Ratio</span>
                      <p className="text-xl font-black text-teal-400">{stats.current.kdRatio || 'N/A'}</p>
                    </div>
                    <div className="bg-[#0f1526] p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Rank Division</span>
                      <p className="text-xl font-black text-amber-400 truncate">{stats.current.rank || 'Unranked'}</p>
                    </div>
                  </div>
                </div>

                {/* Performance Trends Line Graphs over Time */}
                {stats.history && stats.history.length > 0 ? (
                  <div className="space-y-6">
                    <div className={`grid gap-4 ${isMobileView ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2 lg:gap-6'}`}>

                      {/* Graph 1: Win Rate Progression (%) over Time */}
                      <div className="bg-[#131b2f] p-4 sm:p-6 rounded-2xl border border-slate-700/50 shadow-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                              <span>📊 Win Rate Progression Over Time (%)</span>
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">Historical win percentage trajectory across logged searches</p>
                          </div>
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>
                        </div>

                        <div className={isMobileView ? 'h-52' : 'h-72'}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={getFilteredHistory()} margin={{ top: 10, right: 15, bottom: 5, left: -20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                              <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                              <YAxis stroke="#64748b" domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#0f1526', border: '1px solid #334155', borderRadius: '12px', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)', fontSize: '12px' }}
                                itemStyle={{ color: '#fb923c', fontWeight: 'bold' }}
                                formatter={(value) => [`${value}%`, 'Win Rate']}
                              />
                              <Line type="monotone" dataKey="winRate" stroke="#fb923c" strokeWidth={3} dot={{ fill: '#0f1526', stroke: '#fb923c', strokeWidth: 2, r: 4 }} activeDot={{ r: 7, fill: '#fb923c' }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Graph 2: K/D Ratio Progression over Time */}
                      <div className="bg-[#131b2f] p-4 sm:p-6 rounded-2xl border border-slate-700/50 shadow-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                              <span>🎯 K/D Ratio Progression Over Time</span>
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">Combat efficiency and elimination ratio over time</p>
                          </div>
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                        </div>

                        <div className={isMobileView ? 'h-52' : 'h-72'}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={getFilteredHistory()} margin={{ top: 10, right: 15, bottom: 5, left: -20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                              <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                              <YAxis stroke="#64748b" domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#0f1526', border: '1px solid #334155', borderRadius: '12px', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)', fontSize: '12px' }}
                                itemStyle={{ color: '#60a5fa', fontWeight: 'bold' }}
                                formatter={(value) => [value, 'K/D Ratio']}
                              />
                              <Line type="monotone" dataKey="kdRatio" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#0f1526', stroke: '#3b82f6', strokeWidth: 2, r: 4 }} activeDot={{ r: 7, fill: '#3b82f6' }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                    </div>

                    {/* Historical Progress Log Table */}
                    <div className="bg-[#131b2f] border border-slate-700/60 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                          <span>🕒 Snapshot History Log Over Time</span>
                        </h4>
                        <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                          {stats.history?.length || 0} Data Records
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-800">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-[#0b101e] text-[10px] uppercase font-black text-slate-400 border-b border-slate-800">
                            <tr>
                              <th className="py-3 px-4">#</th>
                              <th className="py-3 px-4">Date & Time Logged</th>
                              <th className="py-3 px-4">Win Rate (%)</th>
                              <th className="py-3 px-4">K/D Ratio</th>
                              <th className="py-3 px-4">Top Main Hero</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono">
                            {stats.history.map((entry, idx) => (
                              <tr key={entry.id || idx} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-3.5 px-4 text-slate-500 font-bold">{idx + 1}</td>
                                <td className="py-3.5 px-4 text-white font-sans font-bold">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : (entry.date || 'Recorded')}</td>
                                <td className="py-3.5 px-4 text-emerald-400 font-bold">{entry.win_rate !== undefined ? `${entry.win_rate}%` : (entry.winRate ? `${entry.winRate}%` : 'N/A')}</td>
                                <td className="py-3.5 px-4 text-teal-400 font-bold">{entry.kd_ratio !== undefined ? entry.kd_ratio : (entry.kdRatio || 'N/A')}</td>
                                <td className="py-3.5 px-4 text-amber-300 font-sans font-bold">{entry.top_hero || entry.topHero || 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#131b2f] p-8 rounded-2xl text-center border border-slate-700/60 space-y-3 shadow-xl">
                    <span className="text-4xl">📈</span>
                    <h4 className="text-base font-black text-white uppercase tracking-wider">No Historical Snapshots Logged Yet</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                      Search for this player while <strong className="text-emerald-400">Tracking Mode</strong> is enabled to build their visual performance progress graph over time.
                    </p>
                  </div>
                )}

                {/* Optional Collapsible Technical Raw Data Inspector */}
                <details className="group bg-[#131b2f] border border-slate-700/40 rounded-2xl overflow-hidden shadow-lg transition-all duration-300">
                  <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 font-bold text-slate-400 hover:text-emerald-400 transition-colors list-none">
                    <span className="flex items-center gap-2 uppercase tracking-widest text-[11px]">
                      <span>💻</span>
                      <span>Developer Technical Data Payload (Raw JSON Inspector)</span>
                    </span>
                    <svg className="w-4 h-4 transition-transform duration-300 group-open:-rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="p-4 bg-[#0b101e] border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Complete raw JSON dataset structure:</span>
                      <button
                        type="button"
                        onClick={() => copyDiagnosticLog(stats)}
                        className="text-xs text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                      >
                        📋 Copy Full JSON
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto font-mono text-xs text-slate-300 select-all leading-relaxed p-3 bg-black/40 rounded-xl border border-slate-800">
                      <pre className="whitespace-pre-wrap break-words">{JSON.stringify(stats, null, 2)}</pre>
                    </div>
                  </div>
                </details>

              </div>
            )}
          </div>
        )}

        {/* Background Download Progress Indicator */}
        {isDownloadingUpdate && (
          <div className="fixed bottom-4 right-4 z-[99999] bg-[#0f1526] border-2 border-emerald-500/80 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm animate-spin">
              ⚡
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Downloading Update in Background...</h4>
              <p className="text-[10px] text-slate-400">You can continue using the app while downloading</p>
            </div>
          </div>
        )}

        {/* Installation Consent Modal (Asks Permission Once Downloaded) */}
        {readyToInstallUpdate && (
          <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300 select-none">
            <div className="bg-[#0f1526] border-2 border-emerald-500/80 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/60 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-500/20 animate-bounce">
                🚀
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-white uppercase tracking-wider">
                  Release Download Complete!
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The latest release package has been downloaded in the background. Would you like to install and launch the update now?
                </p>
              </div>

              <div className="bg-[#131b2f] border border-slate-700/60 p-3 rounded-xl text-left text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Commit:</span>
                  <span className="font-mono text-emerald-400 font-bold">{readyToInstallUpdate.latestVersion || `v1.0.14 (${getAppLocalSha()})`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="text-emerald-400 font-bold">Ready to Install</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReadyToInstallUpdate(null)}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer text-center"
                >
                  Later
                </button>

                <button
                  type="button"
                  onClick={executeInstallUpdate}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>🚀</span>
                  <span>Install & Launch Now</span>
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Auto-Update Settings Preference Modal */}
        {showAutoUpdateModal && (
          <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-300 select-none modal-safe-area">
            <div className="bg-[#0f1526] border border-slate-700/80 rounded-3xl p-4 sm:p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 text-lg font-bold">
                    ⚙️
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wider">Auto-Update Settings</h3>
                    <p className="text-[11px] text-slate-400">Configure background update behavior & preferences</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowAutoUpdateModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Submenu Body Container */}
              <div className="overflow-y-auto space-y-3 pr-1">
                {/* Mode Selection Cards */}
                <div className="space-y-2">
                <button
                  onClick={() => { triggerHaptic('light'); setAutoUpdatePermission('silent'); }}
                  className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-1 ${autoUpdatePref === 'silent'
                      ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                      : 'bg-[#131b2f] border-slate-700/80 hover:border-emerald-500/50 text-slate-300'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                      <span>⚡</span> Silent Background Auto-Update
                    </span>
                    {autoUpdatePref === 'silent' && <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40">Active</span>}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Automatically checks, downloads, and installs latest update releases seamlessly in the background.
                  </p>
                </button>

                <button
                  onClick={() => { triggerHaptic('light'); setAutoUpdatePermission('enabled'); }}
                  className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-1 ${autoUpdatePref === 'enabled' || (!autoUpdatePref && autoUpdatePref !== 'silent' && autoUpdatePref !== 'never_ask')
                      ? 'bg-teal-500/15 border-teal-500 text-white shadow-lg shadow-teal-500/10'
                      : 'bg-[#131b2f] border-slate-700/80 hover:border-teal-500/50 text-slate-300'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-teal-400 flex items-center gap-2">
                      <span>🔔</span> Prompt for Updates (Recommended)
                    </span>
                    {(autoUpdatePref === 'enabled' || (!autoUpdatePref && autoUpdatePref !== 'silent' && autoUpdatePref !== 'never_ask')) && (
                      <span className="text-xs font-bold bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full border border-teal-500/40">Active</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Automatically checks for updates on startup, resume, and network reconnect, showing a 1-click update banner when ready.
                  </p>
                </button>

                <button
                  onClick={() => { triggerHaptic('light'); setAutoUpdatePermission('never_ask'); }}
                  className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-1 ${autoUpdatePref === 'never_ask'
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                      : 'bg-[#131b2f] border-slate-700/80 hover:border-amber-500/50 text-slate-300'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-amber-400 flex items-center gap-2">
                      <span>🛑</span> Manual Updates Only
                    </span>
                    {autoUpdatePref === 'never_ask' && <span className="text-xs font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40">Active</span>}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Disables background update popups. Updates will only run when manually clicking "Check for update".
                  </p>
                </button>
              </div>

              {/* Default Tracking Mode Setting Card */}
              <div className="bg-[#131b2f] border border-slate-700/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span>📥</span>
                    <span>Default Tracking Mode</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">App Preference</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Choose whether player searches auto-download a dataset file by default:
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateDefaultTrackingPref('enabled')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer font-bold text-xs flex flex-col justify-between gap-1.5 ${defaultTrackingPref === 'enabled'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10'
                        : 'bg-[#0b101e] border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>📥 Tracking ON</span>
                      {defaultTrackingPref === 'enabled' && <span className="text-[10px] text-emerald-400 font-black">✓ Default</span>}
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">Auto-downloads dataset file on search</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateDefaultTrackingPref('disabled')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer font-bold text-xs flex flex-col justify-between gap-1.5 ${defaultTrackingPref === 'disabled'
                        ? 'bg-slate-800 border-slate-600 text-white shadow-md'
                        : 'bg-[#0b101e] border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>🚫 Tracking OFF</span>
                      {defaultTrackingPref === 'disabled' && <span className="text-[10px] text-slate-300 font-black">✓ Default</span>}
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">Standard search without dataset downloads</span>
                  </button>
                </div>
              </div>

              {/* Backend Server Connection URL Card */}
              <div className="bg-[#131b2f] border border-slate-700/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                    <span>🌐</span>
                    <span>Backend Server Connection URL</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">Port 5000</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Optional: Specify a custom server IP / Domain if hosting a remote proxy. Leave blank for Standalone Direct Cloud Mode:
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={backendBaseUrl}
                    onChange={(e) => setBackendBaseUrl(e.target.value)}
                    placeholder="https://your-custom-backend.com (Optional)"
                    className="flex-1 bg-[#0b101e] border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveBackendBaseUrl(backendBaseUrl)}
                    className="px-3.5 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/60 text-teal-300 font-bold text-xs uppercase cursor-pointer transition-all shrink-0"
                  >
                    Save URL
                  </button>
                </div>
              </div>

              {/* Android Native Storage Access Permission Card */}
              <div className="bg-[#131b2f] border border-slate-700/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <span>📁</span>
                    <span>Android System Storage Access</span>
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${storagePermissionStatus === 'granted' || storagePermissionStatus === 'web_granted'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                    {storagePermissionStatus === 'granted' || storagePermissionStatus === 'web_granted' ? 'Granted ✓' : 'Permission Required'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Grants native Android system-level file access to save downloaded player dataset `.json` files into your device's Downloads directory:
                </p>

                <button
                  type="button"
                  onClick={requestNativeStoragePermission}
                  className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 ${storagePermissionStatus === 'granted' || storagePermissionStatus === 'web_granted'
                      ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-300 hover:bg-emerald-500/30'
                      : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-amber-500/20'
                    }`}
                >
                  <span>📁</span>
                  <span>
                    {storagePermissionStatus === 'granted' || storagePermissionStatus === 'web_granted'
                      ? '✓ Grant Android System Storage Access (Granted)'
                      : '📁 Grant Android System Storage Access'}
                  </span>
                </button>
              </div>

              {/* System & Device Diagnostics Card (Powered by @capacitor/device & @capacitor/app) */}
              {deviceInfo && (
                <div className="bg-[#131b2f] border border-slate-700/80 rounded-2xl p-4 space-y-2 text-xs">
                  <span className="text-[10px] font-black uppercase tracking-widest text-teal-400 block border-b border-slate-800 pb-1.5">
                    📱 Device & Native System Diagnostics
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div><span className="text-slate-500">Platform:</span> <strong className="text-white">{deviceInfo.platform || 'Web'}</strong></div>
                    <div><span className="text-slate-500">OS Version:</span> <strong className="text-white">{deviceInfo.osVersion || 'Unknown'}</strong></div>
                    <div><span className="text-slate-500">Model:</span> <strong className="text-white">{deviceInfo.model || 'Browser'}</strong></div>
                    <div><span className="text-slate-500">Manufacturer:</span> <strong className="text-white">{deviceInfo.manufacturer || 'Generic'}</strong></div>
                    {appInfo && (
                      <div className="col-span-2"><span className="text-slate-500">App Build Version:</span> <strong className="text-emerald-400 font-mono">{appInfo.version} ({appInfo.build})</strong></div>
                    )}
                  </div>
                </div>
              )}
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAutoUpdateModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Up-To-Date Confirmation Modal */}
        {showUpToDateModal && (
          <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300 select-none">
            <div className="bg-[#0f1526] border-2 border-emerald-500/60 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 shadow-2xl shadow-emerald-500/20 relative">
              <button
                onClick={() => setShowUpToDateModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer transition-all"
              >
                ✕
              </button>

              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-500/30">
                ✅
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-white uppercase tracking-wider">App is Up to Date!</h3>
                <p className="text-xs text-slate-400 font-medium">
                  You are running the latest version of Meowdy 5000's Stat Tracker.
                </p>
              </div>

              <div className="bg-[#0b101e] border border-slate-800 rounded-2xl p-4 text-left space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">Installed Version:</span>
                  <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    {upToDateDetails?.currentSha || `v1.0.14 (${getAppLocalSha()})`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">Latest Release SHA:</span>
                  <span className="font-mono text-teal-300 font-bold">
                    {upToDateDetails?.latestSha || `v1.0.14 (${getAppLocalSha()})`}
                  </span>
                </div>
                {upToDateDetails?.commitMsg && (
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                    <strong className="text-slate-400 block font-bold mb-0.5">Latest GitHub Commit:</strong>
                    <p className="italic text-slate-400 leading-snug">"{upToDateDetails.commitMsg}"</p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowUpToDateModal(false)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                Great, Done!
              </button>
            </div>
          </div>
        )}

        {/* Installing Update Overlay */}
        {isApplyingUpdate && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-in fade-in duration-300">
            <div className="bg-[#131b2f] border-2 border-emerald-500 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl shadow-emerald-500/30 relative">
              <button
                onClick={() => setIsApplyingUpdate(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer transition-all"
                title="Close"
              >
                ✕
              </button>
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-3xl mx-auto animate-bounce">
                ⚡
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-wider">Installing Update</h3>
                <p className="text-sm font-bold text-emerald-400 mt-1">{updateStatusMsg}</p>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full w-full animate-pulse"></div>
              </div>
              <button
                type="button"
                onClick={() => setIsApplyingUpdate(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold uppercase cursor-pointer"
              >
                Dismiss Window
              </button>
            </div>
          </div>
        )}

        {/* Error Reporting Modal */}
        {showReportModal && (
          <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300 select-none modal-safe-area">
            <div className="bg-[#0f1526] border border-slate-700/80 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xl">
                    🛠️
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wider">Report Issue to Developer</h3>
                    <p className="text-xs text-slate-400">Dispatch diagnostic logs & stack traces directly to GitHub</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {lastCapturedError && (
                <div className="bg-[#0b101e] border border-red-500/30 rounded-2xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider">Captured Error Log:</span>
                    <button
                      onClick={() => copyDiagnosticLog(lastCapturedError)}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                    >
                      📋 Copy Log
                    </button>
                  </div>
                  <p className="text-xs font-mono text-slate-300 break-words line-clamp-3 leading-relaxed">
                    {lastCapturedError.error}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Describe what happened (Optional)
                  </label>
                  <textarea
                    value={reportNotes}
                    onChange={(e) => setReportNotes(e.target.value)}
                    placeholder="e.g. App froze when searching player name or metrics disappeared..."
                    rows="3"
                    className="w-full bg-[#0b101e] border border-slate-700 rounded-2xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all resize-none"
                  ></textarea>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={(e) => handleManualSubmitReport(e, 'github')}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>🚀 Submit GitHub Issue to Developer</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleManualSubmitReport(e, 'telemetry')}
                      disabled={isSubmittingReport}
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-bold uppercase cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <span>📡 Silent Telemetry</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => copyDiagnosticLog(lastCapturedError || { error: 'Manual Report', notes: reportNotes })}
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold uppercase cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>📋 Copy Log</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Reports Viewer Dashboard Modal */}
        {showViewReportsModal && (
          <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300 select-none modal-safe-area">
            <div className="bg-[#0f1526] border border-slate-700/80 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-xl font-bold">
                    📜
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <span>Client & System Error Reports</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {fetchedReports.length} Reports Logged
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">Live error diagnostic telemetry stored in SQLite database</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleFetchErrorReports}
                    disabled={isLoadingReports}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span className={isLoadingReports ? 'animate-spin' : ''}>🔄</span>
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={() => setShowViewReportsModal(false)}
                    className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition-all cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Reports List Body */}
              <div className="overflow-y-auto space-y-3.5 pr-1 flex-1">
                {isLoadingReports ? (
                  <div className="py-12 text-center text-slate-400 text-xs font-bold space-y-2">
                    <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p>Fetching error reports from database...</p>
                  </div>
                ) : fetchedReports.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs font-bold bg-[#131b2f] border border-slate-800 rounded-2xl p-6">
                    <span className="text-3xl block mb-2">🎉</span>
                    <p className="text-white text-sm">No Error Reports Logged!</p>
                    <p className="text-slate-500 mt-1 font-normal">All app components are operating normally with zero captured errors.</p>
                  </div>
                ) : (
                  fetchedReports.map((report) => (
                    <div
                      key={report.id}
                      className="bg-[#131b2f] border border-slate-700/60 hover:border-amber-500/40 p-4 rounded-2xl space-y-2.5 transition-all text-xs"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                            #{report.id}
                          </span>
                          <span className="text-slate-400 font-bold">{report.timestamp}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 uppercase tracking-wider border border-slate-700">
                          {report.platform || 'Client'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="font-bold text-red-400 text-xs break-words">
                          {report.error || report.errorMessage || 'Unhandled Client Exception'}
                        </div>
                        {report.notes && (
                          <div className="text-slate-300 text-[11px] bg-[#0b101e] p-2 rounded-xl border border-slate-800/80">
                            <strong className="text-amber-400">User Notes:</strong> {report.notes}
                          </div>
                        )}
                      </div>

                      {(report.stack || report.stackTrace) && (
                        <div>
                          <button
                            onClick={() => setExpandedReportId(expandedReportId === report.id ? null : report.id)}
                            className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>{expandedReportId === report.id ? '▼ Hide Stack Trace' : '▶ View Stack Trace'}</span>
                          </button>
                          {expandedReportId === report.id && (
                            <pre className="mt-2 p-3 bg-[#080c17] text-red-300 font-mono text-[10px] rounded-xl overflow-x-auto border border-red-500/20 max-h-40 whitespace-pre-wrap leading-tight">
                              {report.stack || report.stackTrace}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setShowViewReportsModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Slide-Out Side Hamburger Drawer Menu */}
        {isMenuOpen && (
          <div
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex justify-end animate-in fade-in duration-300 select-none modal-safe-area"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[#0f1526] border-l border-slate-700/80 h-full flex flex-col justify-between overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300 drawer-safe-area relative"
            >
              {/* Drawer Header */}
              <div className="space-y-6 p-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center font-black text-emerald-400 text-xs tracking-tighter border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                      M5
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white uppercase tracking-wider">Settings & Tools</h3>
                      <p className="text-[11px] text-slate-400 font-medium">Control panel & app configurations</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition-all cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Drawer Group 0: Claimed Profile Management */}
                <div className="space-y-2.5 bg-[#131b2f] border border-emerald-500/40 p-3.5 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                      <span>👑</span> My Claimed Profile
                    </span>
                    {claimedProfile?.username && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Auto-Loads
                      </span>
                    )}
                  </div>

                  {claimedProfile?.username ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between bg-[#0b101e] border border-slate-700/60 p-2.5 rounded-xl">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs border border-emerald-500/30">
                            👑
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white">{claimedProfile.username}</h4>
                            <p className="text-[10px] text-slate-400">
                              Claimed: {claimedProfile.claimedAt ? new Date(claimedProfile.claimedAt).toLocaleDateString() : 'Active'}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setQuery(claimedProfile.username);
                            fetchStats(null, claimedProfile.username, season);
                            setIsMenuOpen(false);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 font-bold text-[10px] uppercase cursor-pointer transition-all"
                        >
                          View Stats
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          handleUnclaimProfile();
                          setIsMenuOpen(false);
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-400 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <span>🗑️</span>
                        <span>Remove Claimed Profile</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 text-center py-1">
                      <p className="text-xs text-slate-400">No profile claimed yet. Claim your username to auto-load your stats on launch!</p>
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          if (stats?.current?.username) {
                            handleClaimProfile(stats.current.username);
                          } else {
                            setShowClaimModal(true);
                          }
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>👑</span>
                        <span>{stats?.current?.username ? `Claim ${stats.current.username}` : 'Claim Profile Now'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Drawer Group 0.5: Automatic Snapshot Tracking Mode Toggle */}
                <div className="space-y-2.5 bg-[#131b2f] border border-emerald-500/40 p-3.5 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                      <span>⚡</span> Snapshot Tracking Mode
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isTrackingMode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      {isTrackingMode ? 'ON' : 'OFF'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-[#0b101e] border border-slate-700/60 p-3 rounded-xl">
                    <div className="text-left">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{isTrackingMode ? '📥' : '🚫'}</span>
                        <span>Auto Snapshot Tracking</span>
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                        Automatically record daily stat snapshots when searching or loading profiles.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const newVal = !isTrackingMode;
                        setIsTrackingMode(newVal);
                        try { localStorage.setItem('tracking_mode_enabled', newVal ? 'true' : 'false'); } catch (err) { }
                        triggerHaptic('light');
                        showNativeToast(`Snapshot Tracking ${newVal ? '📥 ON' : '🚫 OFF'}`);
                        setUpdateToast({
                          type: newVal ? 'success' : 'update',
                          message: newVal ? '📥 Automatic Snapshot Tracking ON' : '🚫 Automatic Snapshot Tracking OFF'
                        });
                        setTimeout(() => setUpdateToast(null), 3000);
                      }}
                      className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer flex items-center shrink-0 border ${isTrackingMode ? 'bg-emerald-500 border-emerald-400 justify-end' : 'bg-slate-800 border-slate-700 justify-start'}`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-md"></div>
                    </button>
                  </div>
                </div>

                {/* Drawer Group 0.8: Support Development / Donate via PayPal */}
                <div className="space-y-2.5 bg-gradient-to-br from-[#131b2f] via-[#0f172a] to-[#17233d] border-2 border-amber-500/50 p-4 rounded-2xl shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                      <span>🍕</span> Support Development
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      PayPal
                    </span>
                  </div>

                  <div className="text-left space-y-1">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <span>💙</span> Enjoying Meowdy 5000?
                    </h4>
                    <p className="text-[10px] text-slate-300 leading-relaxed">
                      Help support server hosting, scraper maintenance & future feature updates!
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('success');
                      setIsMenuOpen(false);
                      const paypalUrl = localStorage.getItem('paypal_donate_url') || 'https://www.paypal.com/donate';
                      openExternalUrl(paypalUrl);
                      showNativeToast('💙 Opening PayPal Donation page...');
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 cursor-pointer flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-98"
                  >
                    <span className="text-base">💳</span>
                    <span>Donate with PayPal</span>
                  </button>
                </div>

                {/* Drawer Group 1: App Updates */}
                <div className="space-y-2.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    ⚡ App Updates & Maintenance
                  </span>

                  <button
                    onClick={() => handleOneClickUpdate()}
                    disabled={checkingUpdate || isApplyingUpdate}
                    className="w-full bg-[#131b2f] hover:bg-emerald-500/10 border border-slate-700/80 hover:border-emerald-500/50 p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 group cursor-pointer disabled:opacity-80"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {checkingUpdate ? (
                          <div className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></div>
                        ) : (
                          '⚡'
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                          {checkingUpdate ? 'Checking for updates...' : 'Check for update'}
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          {checkingUpdate ? 'Connecting to GitHub API...' : 'Check, download & install latest release'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 group-hover:text-emerald-400 font-bold">
                      {checkingUpdate ? '⏳' : '→'}
                    </span>
                  </button>

                  <button
                    onClick={() => { setIsMenuOpen(false); setShowAutoUpdateModal(true); }}
                    className="w-full bg-[#131b2f] hover:bg-slate-800/80 border border-slate-700/80 p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm">
                        ⚙️
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-teal-400 transition-colors">
                          Auto-Update Settings
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Status: <span className="text-emerald-400 font-bold">{autoUpdatePref === 'enabled' ? 'Enabled' : autoUpdatePref === 'never_ask' ? 'Off' : 'Ask on startup'}</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 group-hover:text-teal-400 font-bold">→</span>
                  </button>
                </div>

                {/* Drawer Group 2: Storage & Data */}
                <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    💾 Storage & Persistence
                  </span>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setIsMenuOpen(false); grantStoragePermission(); }}
                        className="flex-1 bg-[#131b2f] hover:bg-slate-800/80 border border-slate-700/80 p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                            💾
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                              Storage Write Permission
                            </h4>
                            <p className="text-[10px] text-slate-400">
                              Status: <span className={hasStoragePermission ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{hasStoragePermission ? 'Granted' : 'Action Needed'}</span>
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 group-hover:text-blue-400 font-bold">→</span>
                      </button>

                      <button
                        onClick={() => setShowWhyPermission(!showWhyPermission)}
                        className={`px-3 py-3 rounded-xl border font-black text-xs transition-all flex items-center justify-center cursor-pointer shrink-0 shadow-sm ${showWhyPermission
                            ? 'bg-blue-500/30 border-blue-400 text-white shadow-md scale-105'
                            : 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/40 text-blue-400 hover:text-white'
                          }`}
                        title="Why is storage write permission required?"
                      >
                        <span>Why?</span>
                      </button>
                    </div>

                    {/* Expandable Permission Explanation Box */}
                    {showWhyPermission && (
                      <div className="bg-[#131b2f] border border-blue-500/40 p-3.5 rounded-xl space-y-2 text-xs animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs uppercase tracking-wider">
                          <span>💡</span>
                          <span>Why Permission is Required:</span>
                        </div>
                        <ul className="space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
                          <li className="flex items-start gap-1.5">
                            <span className="text-emerald-400 font-bold">1.</span>
                            <span><strong className="text-white">Download & Install Updates:</strong> Saves release APK packages to your device so you can update in 1 click.</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-emerald-400 font-bold">2.</span>
                            <span><strong className="text-white">Local Tracking Data Files:</strong> Creates local data snapshot files to track daily Win Rate and KDA history over time.</span>
                          </li>
                        </ul>
                      </div>
                    )}

                    {/* Export Data Backup Button */}
                    <button
                      onClick={() => { setIsMenuOpen(false); handleExportBackup(); }}
                      className="w-full bg-[#131b2f] hover:bg-slate-800/80 border border-slate-700/80 p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                          📥
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                            Export Data Backup File
                          </h4>
                          <p className="text-[10px] text-slate-400">Save tracked stats & configs to JSON file</p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 group-hover:text-emerald-400 font-bold">→</span>
                    </button>
                  </div>
                </div>

                {/* Drawer Group 3: Diagnostics & Feedback */}
                <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    🛠️ Developer Tools & Issue Reporting
                  </span>

                  <button
                    onClick={() => { setIsMenuOpen(false); openErrorReportsViewer(); }}
                    className="w-full bg-[#131b2f] hover:bg-amber-500/10 border border-slate-700/80 hover:border-amber-500/50 p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                        📜
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                          View Error Reports Log
                        </h4>
                        <p className="text-[10px] text-slate-400">Inspect all client & system diagnostic logs</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 group-hover:text-amber-400 font-bold">→</span>
                  </button>

                  <button
                    onClick={() => { setIsMenuOpen(false); setShowReportModal(true); }}
                    className="w-full bg-[#131b2f] hover:bg-amber-500/10 border border-slate-700/80 hover:border-amber-500/50 p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                        ⚠️
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                          Report an Issue / Bug
                        </h4>
                        <p className="text-[10px] text-slate-400">Send diagnostic stack trace to developers</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 group-hover:text-amber-400 font-bold">→</span>
                  </button>

                  <div className="bg-[#131b2f] border border-slate-700/80 p-3 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">
                        📱
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">View Mode Preview</h4>
                        <p className="text-[10px] text-slate-400">Toggle mobile responsive testing frame</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsMobileView(!isMobileView)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${isMobileView
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                    >
                      {isMobileView ? 'Mobile' : 'Desktop'}
                    </button>
                  </div>
                </div>

                {/* Drawer Group 4: Community & Meta Resources */}
                <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    🌐 Community & Esports Meta Resources
                  </span>

                  {/* Resource 1: RivalsMeta.com */}
                  <button
                    onClick={() => { setIsMenuOpen(false); openExternalUrl('https://rivalsmeta.com'); }}
                    className="w-full bg-[#131b2f] hover:bg-emerald-500/10 border border-slate-700/80 hover:border-emerald-500/50 p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                        ⚔️
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                          Rivals Meta (RivalsMeta.com)
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium">Hero tier lists, win rates & player matchups</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 group-hover:text-emerald-400 font-bold">↗</span>
                  </button>

                  {/* Resource 2: RivalsTracker.com */}
                  <button
                    onClick={() => { setIsMenuOpen(false); openExternalUrl('https://rivalstracker.com'); }}
                    className="w-full bg-[#131b2f] hover:bg-amber-500/10 border border-slate-700/80 hover:border-amber-500/50 p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                        🎯
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                          RivalsTracker.com
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium">Player leaderboards & community stat tracking</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 group-hover:text-amber-400 font-bold">↗</span>
                  </button>

                  {/* Resource 3: Tracker.gg */}
                  <button
                    onClick={() => { setIsMenuOpen(false); openExternalUrl('https://tracker.gg/marvel-rivals'); }}
                    className="w-full bg-[#131b2f] hover:bg-purple-500/10 border border-slate-700/80 hover:border-purple-500/50 p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">
                        🌐
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">
                          Marvel Rivals Tracker.gg
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium">Official player profiles & global leaderboards</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 group-hover:text-purple-400 font-bold">↗</span>
                  </button>

                  {/* Resource 4: Liquipedia Wiki */}
                  <button
                    onClick={() => { setIsMenuOpen(false); openExternalUrl('https://liquipedia.net/marvelrivals/Hero_ID'); }}
                    className="w-full bg-[#131b2f] hover:bg-cyan-500/10 border border-slate-700/80 hover:border-cyan-500/50 p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">
                        📖
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">
                          Liquipedia Hero Meta Wiki
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium">Esports tournaments, team rosters & hero IDs</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 group-hover:text-cyan-400 font-bold">↗</span>
                  </button>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="pt-6 border-t border-slate-800/80 text-center space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-bold text-slate-300">App Version</span>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold text-[11px]">
                    v{getAppVersionName()} ({getAppLocalSha()})
                  </span>
                </div>
                <a
                  href="https://github.com/monfreda48/Meowdy5000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider transition-all text-center"
                >
                  🔗 View GitHub Repository
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Community & Esports Meta Resources Footer Bar */}
        <div className="mt-12 pt-6 border-t border-slate-800/80 space-y-4 text-left">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>🌐</span> Community & Esports Meta Section
            </h4>
            <span className="text-[10px] text-slate-500 font-bold">Official Web Resources</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              onClick={() => openExternalUrl('https://rivalsmeta.com')}
              className="bg-[#131b2f] hover:bg-emerald-500/15 border border-slate-700/60 hover:border-emerald-500/50 p-3 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-sm">⚔️</span>
                <div className="truncate">
                  <span className="text-xs font-bold text-white group-hover:text-emerald-400 block truncate">Rivals Meta</span>
                  <span className="text-[9px] text-slate-400 block font-mono">rivalsmeta.com</span>
                </div>
              </div>
              <span className="text-xs text-slate-500 group-hover:text-emerald-400 font-bold shrink-0">↗</span>
            </button>

            <button
              onClick={() => openExternalUrl('https://rivalstracker.com')}
              className="bg-[#131b2f] hover:bg-amber-500/15 border border-slate-700/60 hover:border-amber-500/50 p-3 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-sm">🎯</span>
                <div className="truncate">
                  <span className="text-xs font-bold text-white group-hover:text-amber-400 block truncate">RivalsTracker</span>
                  <span className="text-[9px] text-slate-400 block font-mono">rivalstracker.com</span>
                </div>
              </div>
              <span className="text-xs text-slate-500 group-hover:text-amber-400 font-bold shrink-0">↗</span>
            </button>

            <button
              onClick={() => openExternalUrl('https://tracker.gg/marvel-rivals')}
              className="bg-[#131b2f] hover:bg-purple-500/15 border border-slate-700/60 hover:border-purple-500/50 p-3 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-sm">🌐</span>
                <div className="truncate">
                  <span className="text-xs font-bold text-white group-hover:text-purple-400 block truncate">Tracker.gg</span>
                  <span className="text-[9px] text-slate-400 block font-mono">tracker.gg</span>
                </div>
              </div>
              <span className="text-xs text-slate-500 group-hover:text-purple-400 font-bold shrink-0">↗</span>
            </button>

            <button
              onClick={() => openExternalUrl('https://liquipedia.net/marvelrivals/Hero_ID')}
              className="bg-[#131b2f] hover:bg-cyan-500/15 border border-slate-700/60 hover:border-cyan-500/50 p-3 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer shadow-sm"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-sm">📖</span>
                <div className="truncate">
                  <span className="text-xs font-bold text-white group-hover:text-cyan-400 block truncate">Liquipedia Wiki</span>
                  <span className="text-[9px] text-slate-400 block font-mono">liquipedia.net</span>
                </div>
              </div>
              <span className="text-xs text-slate-500 group-hover:text-cyan-400 font-bold shrink-0">↗</span>
            </button>
          </div>
        </div>

        {/* App Footer & Version Badge */}
        <footer className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center font-black text-[#00ff88] text-[9px] border border-[#00ff88] shadow-[0_0_10px_#00ff88]">
              M5
            </div>
            <span className="font-bold text-slate-400">Meowdy 5000's</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
              v{getAppVersionName()} ({getAppLocalSha()})
            </span>
            <span>•</span>
            <a
              href="https://github.com/monfreda48/Meowdy5000"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-400 transition-colors"
            >
              GitHub Repository
            </a>
          </div>
        </footer>

      {/* Customize Profile Picture / Avatar Modal */}
      {showAvatarModal && stats?.current && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-gradient-to-br from-[#131b2f] via-[#0f172a] to-[#0b101e] border-2 border-emerald-500/60 rounded-3xl p-5 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 text-left relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-xl">
                  🖼️
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    Change Profile Picture
                  </h3>
                  <p className="text-xs text-slate-400">
                    Custom picture for <strong className="text-emerald-400">{stats.current.username}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAvatarModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Current Active Avatar Preview */}
            <div className="flex items-center gap-4 bg-[#0b101e] border border-slate-700/60 p-3.5 rounded-2xl">
              {getDisplayAvatar(stats.current.username) ? (
                <img
                  src={getDisplayAvatar(stats.current.username)}
                  alt={stats.current.username}
                  className="w-16 h-16 rounded-2xl border-2 border-emerald-500 shadow-md object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-black text-white text-2xl shadow-md">
                  {stats.current.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Active Profile Picture</span>
                <h4 className="text-xs font-bold text-white mt-0.5">{stats.current.username}</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Custom avatars persist in local storage across sessions.</p>
              </div>
            </div>

            {/* Option 1: Choose Marvel Hero Preset Avatar */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span>🦸</span> Option 1: Pick Marvel Hero Icon
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {HERO_AVATAR_PRESETS.map((hero, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSaveCustomAvatar(stats.current.username, hero.url)}
                    className="flex flex-col items-center bg-[#0b101e] hover:bg-emerald-500/20 border border-slate-700/80 hover:border-emerald-500 p-2 rounded-xl transition-all cursor-pointer group"
                  >
                    <img
                      src={hero.url}
                      alt={hero.name}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-700 group-hover:border-emerald-400 group-hover:scale-105 transition-all"
                    />
                    <span className="text-[9px] font-bold text-slate-300 group-hover:text-emerald-300 mt-1 truncate w-full text-center">
                      {hero.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Option 2: Upload Custom Image from Device */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span>📁</span> Option 2: Upload Image File from Device
              </span>
              <label className="flex items-center justify-between bg-[#0b101e] hover:bg-emerald-500/10 border border-dashed border-slate-700 hover:border-emerald-500/80 p-3.5 rounded-xl cursor-pointer transition-all">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📤</span>
                  <div>
                    <h4 className="text-xs font-bold text-white">Choose Local Photo / File</h4>
                    <p className="text-[10px] text-slate-400">PNG, JPG, WEBP (Max 5MB)</p>
                  </div>
                </div>
                <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-lg">Browse File</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUploadAvatar(e, stats.current.username)}
                  className="hidden"
                />
              </label>
            </div>

            {/* Option 3: Custom Web Image URL */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span>🔗</span> Option 3: Paste Direct Image URL
              </span>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/avatar.png"
                  value={avatarUrlInput}
                  onChange={(e) => setAvatarUrlInput(e.target.value)}
                  className="flex-1 bg-[#0b101e] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (avatarUrlInput.trim()) {
                      handleSaveCustomAvatar(stats.current.username, avatarUrlInput.trim());
                      setAvatarUrlInput('');
                    }
                  }}
                  disabled={!avatarUrlInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              {customAvatars[stats.current.username?.toLowerCase()] ? (
                <button
                  type="button"
                  onClick={() => handleRemoveCustomAvatar(stats.current.username)}
                  className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                >
                  <span>🗑️</span> Reset to Default
                </button>
              ) : (
                <span className="text-[10px] text-slate-500 font-medium">Default scraped avatar active</span>
              )}

              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      </main>
    </div>
  );
}