import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Filesystem } from '@capacitor/filesystem';
import { Browser } from '@capacitor/browser';

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

export default function App() {
  const [query, setQuery] = useState('');
  const [season, setSeason] = useState('19');
  const [timeframe, setTimeframe] = useState('all');
  const [expandedMetric, setExpandedMetric] = useState(null);
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
    { id: '9',  name: 'Season 4.5', status: 'past' },
    { id: '8',  name: 'Season 4.0', status: 'past' },
    { id: '7',  name: 'Season 3.5', status: 'past' },
    { id: '6',  name: 'Season 3.0', status: 'past' },
    { id: '5',  name: 'Season 2.5', status: 'past' },
    { id: '4',  name: 'Season 2.0', status: 'past' },
    { id: '3',  name: 'Season 1.5', status: 'past' },
    { id: '2',  name: 'Season 1.0', status: 'past' },
    { id: '1',  name: 'Season 0 (Launch)', status: 'past' }
  ];

  const [seasonsList, setSeasonsList] = useState(DEFAULT_SEASONS);
  const [currentSeasonName, setCurrentSeasonName] = useState('Season 9.5');

  const fetchDynamicSeasons = async () => {
    try {
      const res = await fetch(getApiUrl('/api/seasons'));
      if (res.ok) {
        const data = await res.json();
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
      try { localStorage.setItem('recent_player_searches', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
  };

  const clearRecentSearches = (e) => {
    if (e) e.stopPropagation();
    setRecentSearches([]);
    try { localStorage.removeItem('recent_player_searches'); } catch (e) {}
  };

  const selectRecentSearch = (searchQuery) => {
    setQuery(searchQuery);
    setIsSearchFocused(false);
    fetchStats(null, searchQuery, season);
  };
  
  const toggleExpandMetric = (id) => {
    setExpandedMetric(prev => prev === id ? null : id);
  };
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
  const [isMobileView, setIsMobileView] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
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
    } catch (e) {}
  };

  const handleToggleTrackPlayer = (username) => {
    if (!username) return;
    const key = username.toLowerCase();
    const isNowTracked = !trackedPlayers[key];
    const updated = { ...trackedPlayers, [key]: isNowTracked };
    setTrackedPlayers(updated);
    try {
      localStorage.setItem('tracked_players_list', JSON.stringify(updated));
    } catch (e) {}

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

  const grantStoragePermission = async () => {
    try {
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
          const status = await Filesystem.checkPermissions();
          console.log('[NativePermission] Filesystem checkPermissions:', status);
          
          if (status.publicStorage !== 'granted') {
            const reqStatus = await Filesystem.requestPermissions();
            console.log('[NativePermission] Filesystem requestPermissions:', reqStatus);
            
            if (reqStatus.publicStorage === 'granted') {
              setUpdateToast({ type: 'success', message: '✅ Android OS Storage Permission Granted!' });
            } else {
              setUpdateToast({ type: 'error', message: '⚠️ Android Storage Permission Denied. Please allow storage access in Android App Info Settings.' });
            }
          } else {
            setUpdateToast({ type: 'success', message: '✅ Android OS Storage Permission is Active!' });
          }
        } catch (err) {
          console.warn('[NativePermission] Filesystem requestPermissions error:', err);
        }
      } else {
        if (navigator.storage && navigator.storage.persist) {
          try {
            await navigator.storage.persist();
          } catch (e) {}
        }
        setUpdateToast({ type: 'success', message: '✅ Storage Write Permission Granted!' });
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
    try {
      const saved = localStorage.getItem('tracked_metrics');
      return saved ? JSON.parse(saved) : AVAILABLE_METRICS.map(m => m.id);
    } catch (e) {
      return AVAILABLE_METRICS.map(m => m.id);
    }
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

    try { localStorage.setItem('tracked_metrics', JSON.stringify(updated)); } catch (err) {}
  };

  const moveMetricUp = (id, e) => {
    if (e) e.stopPropagation();
    const index = selectedMetrics.indexOf(id);
    if (index <= 0) return;
    const updated = [...selectedMetrics];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setSelectedMetrics(updated);
    try { localStorage.setItem('tracked_metrics', JSON.stringify(updated)); } catch (err) {}
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
    try { localStorage.setItem('tracked_metrics', JSON.stringify(updated)); } catch (err) {}
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
      try { localStorage.setItem('tracked_metrics', JSON.stringify(updated)); } catch (e) {}
    }
  };

  const isMetricTracked = (id) => selectedMetrics.includes(id);

  const selectAllMetrics = () => {
    const allIds = AVAILABLE_METRICS.map(m => m.id);
    setSelectedMetrics(allIds);
    if (hasStoragePermission) {
      try { localStorage.setItem('tracked_metrics', JSON.stringify(allIds)); } catch (e) {}
    }
  };

  const resetDefaultMetrics = () => {
    const allIds = AVAILABLE_METRICS.map(m => m.id);
    setSelectedMetrics(allIds);
    if (hasStoragePermission) {
      try { localStorage.setItem('tracked_metrics', JSON.stringify(allIds)); } catch (e) {}
    }
  };

  const [autoUpdatePref, setAutoUpdatePref] = useState(() => {
    try {
      return localStorage.getItem('auto_update_preference') || null;
    } catch (e) {
      return null;
    }
  });
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [updateStatusMsg, setUpdateStatusMsg] = useState('');
  const [showAutoUpdateModal, setShowAutoUpdateModal] = useState(false);

  const [backendBaseUrl, setBackendBaseUrl] = useState(() => {
    try {
      return localStorage.getItem('backend_server_url') || '';
    } catch (e) {
      return '';
    }
  });

  const getApiUrl = (endpoint) => {
    if (!backendBaseUrl) return endpoint;
    const base = backendBaseUrl.replace(/\/+$/, '');
    return `${base}${endpoint}`;
  };

  const applyUpdateNow = async (targetSha = null) => {
    const attemptedSha = targetSha || updateInfo?.latestVersion;
    if (attemptedSha) {
      try { sessionStorage.setItem('last_attempted_update_sha', attemptedSha); } catch (e) {}
    }
    setIsApplyingUpdate(true);

    // Native Mobile Android APK Self-Update
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      setUpdateStatusMsg('📱 Launching Android APK Package Installer...');
      try {
        const apkUrl = updateInfo?.apkUrl || 'https://github.com/monfreda48/Meowdy5000/releases/download/v1.0.0/app-debug.apk';
        await Browser.open({ url: apkUrl });
        setUpdateStatusMsg('✅ Package installer launched! Confirm installation to complete update.');
      } catch (e) {
        window.open('https://github.com/monfreda48/Meowdy5000/releases', '_system');
      } finally {
        setTimeout(() => setIsApplyingUpdate(false), 2000);
      }
      return;
    }

    // Web / Local Server Self-Update
    setUpdateStatusMsg('⚡ Fetching and installing latest update from GitHub...');
    try {
      const res = await fetch(getApiUrl('/api/apply-update'), { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUpdateStatusMsg('✅ Web update installed successfully! Reloading app...');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
          return;
        }
      }
      setUpdateStatusMsg('🔄 Reloading application assets...');
      setTimeout(() => {
        window.location.reload(true);
      }, 1000);
    } catch (err) {
      setUpdateStatusMsg('🔄 Reloading application...');
      setTimeout(() => {
        window.location.reload(true);
      }, 1000);
    } finally {
      setTimeout(() => setIsApplyingUpdate(false), 2000);
    }
  };

  const handleOneClickUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateToast({ type: 'update', message: '🔍 Checking GitHub for latest app updates...' });

    try {
      let latestSha = '';
      let latestMessage = '';
      let commitUrl = '';

      // 1. Fetch directly from GitHub REST API
      try {
        const ghRes = await fetch('https://api.github.com/repos/monfreda48/Meowdy5000/commits/main', {
          headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          latestSha = (ghData.sha || '').slice(0, 7);
          latestMessage = ghData.commit?.message?.split('\n')[0] || '';
          commitUrl = ghData.html_url || 'https://github.com/monfreda48/Meowdy5000';
        }
      } catch (ghErr) {
        console.warn('Direct GitHub API check error:', ghErr);
      }

      // 2. Local commit check
      let localSha = import.meta.env.VITE_APP_COMMIT_SHA || '98ac9c9';
      try {
        const backendRes = await fetch(getApiUrl('/api/check-update'));
        if (backendRes.ok) {
          const backendData = await backendRes.json();
          if (backendData.localVersion) localSha = backendData.localVersion;
          if (!latestSha && backendData.latestVersion) latestSha = backendData.latestVersion;
        }
      } catch (e) {}

      const hasUpdate = Boolean(latestSha && localSha && localSha.toLowerCase().slice(0, 7) !== latestSha.toLowerCase().slice(0, 7));

      if (hasUpdate) {
        setUpdateToast({ type: 'update', message: `⚡ Update found (${latestSha})! Starting one-click installation...` });
        await applyUpdateNow(latestSha);
      } else {
        setUpdateToast({ type: 'success', message: `✅ App is up to date! (Current Commit: ${localSha})` });
        setTimeout(() => setUpdateToast(null), 4000);
      }
    } catch (err) {
      console.error('One-click update error:', err);
      setUpdateToast({ type: 'error', message: '❌ Error connecting to update service.' });
      setTimeout(() => setUpdateToast(null), 4000);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const setAutoUpdatePermission = (preference) => {
    try {
      localStorage.setItem('auto_update_preference', preference);
    } catch (e) {}
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

  const checkForUpdates = async (isManual = false) => {
    setCheckingUpdate(true);
    setUpdateToast(null);
    try {
      let latestSha = '';
      let latestMessage = '';
      let commitUrl = '';

      // 1. Fetch directly from GitHub REST API (CORS enabled, works everywhere on web & APK)
      try {
        const ghRes = await fetch('https://api.github.com/repos/monfreda48/Meowdy5000/commits/main', {
          headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          latestSha = (ghData.sha || '').slice(0, 7);
          latestMessage = ghData.commit?.message?.split('\n')[0] || '';
          commitUrl = ghData.html_url || 'https://github.com/monfreda48/Meowdy5000';
        }
      } catch (ghErr) {
        console.warn('Direct GitHub API check error:', ghErr);
      }

      // 2. Query Flask backend endpoint if available
      let localSha = import.meta.env.VITE_APP_COMMIT_SHA || '98ac9c9';
      try {
        const backendRes = await fetch(getApiUrl('/api/check-update'));
        if (backendRes.ok) {
          const backendData = await backendRes.json();
          if (backendData.localVersion) localSha = backendData.localVersion;
          if (!latestSha && backendData.latestVersion) latestSha = backendData.latestVersion;
        }
      } catch (backendErr) {
        console.warn('Backend update check error:', backendErr);
      }

      const hasUpdate = Boolean(latestSha && localSha && localSha.toLowerCase().slice(0, 7) !== latestSha.toLowerCase().slice(0, 7));

      const updateData = {
        hasUpdate,
        localVersion: localSha,
        latestVersion: latestSha || localSha,
        latestMessage: latestMessage || 'Latest enhancements and bug fixes available on GitHub.',
        commitUrl: commitUrl || 'https://github.com/monfreda48/Meowdy5000',
        apkUrl: 'https://github.com/monfreda48/Meowdy5000/releases/download/v1.0.0/app-debug.apk',
        repoUrl: 'https://github.com/monfreda48/Meowdy5000'
      };

      setUpdateInfo(updateData);

      if (isManual) {
        if (hasUpdate) {
          setUpdateToast({ type: 'update', message: `⚡ Update available (${latestSha})! Click "Check for update" in menu to install.` });
        } else {
          setUpdateToast({ type: 'success', message: `✅ Your app is up to date! (Current Commit: ${localSha})` });
          setTimeout(() => setUpdateToast(null), 4500);
        }
      }
    } catch (err) {
      console.error('Failed to check for updates:', err);
      if (isManual) {
        setUpdateToast({ type: 'error', message: '❌ Could not connect to update server.' });
        setTimeout(() => setUpdateToast(null), 4500);
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  // Error Telemetry & Reporting State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportNotes, setReportNotes] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [lastCapturedError, setLastCapturedError] = useState(null);

  const sendErrorReport = async (payload) => {
    try {
      const fullPayload = {
        error: payload.error || 'Unknown Client Error',
        stack: payload.stack || '',
        notes: payload.notes || '',
        platform: window.Capacitor && window.Capacitor.isNativePlatform() ? 'Android Native APK' : 'Web Browser',
        userAgent: navigator.userAgent
      };

      await fetch(getApiUrl('/api/report-error'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload)
      });
      console.log('✅ Error report successfully sent to developer telemetry server.');
      return true;
    } catch (err) {
      console.warn('Could not send error report to backend telemetry endpoint:', err);
      return false;
    }
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

  const handleManualSubmitReport = async (e) => {
    if (e) e.preventDefault();
    setIsSubmittingReport(true);
    const payload = {
      error: lastCapturedError?.error || error || 'User Submitted Issue Report',
      stack: lastCapturedError?.stack || '',
      notes: reportNotes || 'User submitted feedback/error report via UI.'
    };

    const sent = await sendErrorReport(payload);
    setIsSubmittingReport(false);
    setShowReportModal(false);
    setReportNotes('');

    if (sent) {
      setUpdateToast({ type: 'success', message: '✅ Error report sent! Thank you for helping us fix it.' });
    } else {
      setUpdateToast({ type: 'success', message: '✅ Report logged locally. Thank you!' });
    }
    setTimeout(() => setUpdateToast(null), 4000);
  };

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

  useEffect(() => {
    checkForUpdates();
  }, []);

  const fetchStats = async (e, overrideQuery = null, overrideSeason = null) => {
    if (e) e.preventDefault();
    const activeQuery = overrideQuery !== null ? overrideQuery : query;
    const activeSeason = overrideSeason !== null ? overrideSeason : season;
    if (!activeQuery) return;
    
    addRecentSearch(activeQuery);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl(`/api/stats?query=${encodeURIComponent(activeQuery)}&season=${encodeURIComponent(activeSeason)}`));
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch player stats.');
      }

      setStats(data);
      if (data?.current?.username) {
        const uKey = data.current.username.toLowerCase();
        if (trackedPlayers[uKey]) {
          saveTrackedStatSnapshot(data);
        }
      }
    } catch (err) {
      setError(err.message);
      setLastCapturedError({
        error: err.message,
        stack: err.stack || 'Fetch Stats Exception',
        timestamp: new Date().toISOString()
      });
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
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-[100dvh] mobile-safe-area bg-[#0b101e] text-slate-200 font-sans selection:bg-emerald-500/30 transition-all duration-300 relative"
    >
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
            className={`w-4 h-4 text-emerald-500 transition-transform duration-200 ${
              isRefreshing ? 'animate-spin' : ''
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
          className={`fixed inset-0 z-[9999] bg-[#0b101e] flex flex-col items-center justify-center p-6 text-center transition-all duration-700 cursor-pointer select-none ${
            splashFading ? 'opacity-0 pointer-events-none scale-105' : 'opacity-100'
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
              <span className="sm:hidden">MEOWDY 5000</span>
              <span className="hidden sm:inline">MEOWDY 5000'S STAT TRACKER</span>
            </span>
          </div>

          {/* Right Hamburger Menu Icon Button */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-[#131b2f] hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white hover:border-emerald-500/50 transition-all flex items-center gap-2 cursor-pointer shadow-sm relative group"
            title="Open Settings & Menu"
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
      </nav>

      {/* Main Layout Container */}
      <main className={`mx-auto px-2.5 sm:px-6 py-3 sm:py-10 transition-all duration-300 w-full ${
        isMobileView ? 'max-w-full sm:max-w-md py-2' : 'max-w-6xl'
      }`}>

        {/* Update Feedback Toast Banner */}
        {updateToast && (
          <div className={`w-full p-3.5 rounded-2xl mb-4 text-xs sm:text-sm font-bold flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 shadow-lg ${
            updateToast.type === 'success'
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
          <h1 className={`font-black tracking-tight text-white uppercase w-full ${
            isMobileView ? 'text-xl sm:text-3xl' : 'text-2xl sm:text-5xl md:text-6xl lg:text-7xl'
          }`}>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">SNACK HARD, TRACK HARD</span>
          </h1>

          {/* Active Season & Upcoming Season 10 Status Pill */}
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-xs sm:text-sm font-bold text-emerald-400 shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{currentSeasonName} Current</span>
          </div>

          <form onSubmit={fetchStats} className={`w-full ${isMobileView ? 'mt-1' : 'max-w-3xl mt-3 sm:mt-8'}`}>
            <div className={`flex bg-[#131b2f] p-2.5 sm:p-3 rounded-2xl border border-slate-700/50 shadow-2xl ${
              isMobileView ? 'flex-col gap-2' : 'flex-col md:flex-row gap-3'
            }`}>
              <div className="flex-1 relative w-full">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onClick={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  placeholder="Enter Username or UID..."
                  className={`w-full bg-[#0b101e] border border-slate-700/50 rounded-xl px-3.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-white placeholder-slate-500 ${
                    isMobileView ? 'py-2.5 text-sm' : 'py-3.5 sm:py-4 text-base sm:text-lg'
                  }`}
                  required
                />

                {/* Recent Searches Quick Access Bar */}
                {isSearchFocused && recentSearches.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#0f1526] border border-emerald-500/40 rounded-xl p-2.5 shadow-2xl shadow-emerald-500/10 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                        <span>🕒</span> Recent Searches
                      </span>
                      <button
                        type="button"
                        onMouseDown={clearRecentSearches}
                        className="text-[10px] text-slate-500 hover:text-red-400 font-bold uppercase transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {recentSearches.slice(0, 3).map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onMouseDown={() => selectRecentSearch(item)}
                          className="bg-[#131b2f] hover:bg-emerald-500/20 border border-slate-700 hover:border-emerald-500/60 text-slate-200 hover:text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <span className="text-emerald-400 text-[10px]">🔍</span>
                          <span>{item}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                  className={`bg-[#0b101e] border border-slate-700/50 rounded-xl px-3 focus:outline-none focus:border-emerald-500 text-white cursor-pointer text-xs sm:text-sm ${
                    isMobileView ? 'py-2.5 flex-1' : 'py-3.5 sm:py-4'
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
                  className={`bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.3)] uppercase tracking-wider text-xs sm:text-sm ${
                    isMobileView ? 'py-2.5 px-4 flex-1' : 'py-3.5 sm:py-4 px-6 sm:px-8'
                  }`}
                >
                  {loading ? 'Scanning...' : 'Search'}
                </button>
              </div>
            </div>
          </form>

          {/* Customize What You Track Selection Box */}
          <div className={`w-full ${isMobileView ? '' : 'max-w-3xl'} text-left`}>
            <details className="group bg-[#131b2f] border border-slate-700/50 rounded-2xl overflow-hidden shadow-xl transition-all duration-300">
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-bold text-slate-300 hover:text-emerald-400 transition-colors list-none">
                <span className="flex items-center gap-2 uppercase tracking-widest text-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  ⚙️ Select Metrics to Track ({selectedMetrics.length}/{AVAILABLE_METRICS.length} Active)
                </span>
                <svg className="w-4 h-4 text-slate-500 transition-transform duration-300 group-open:-rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              
              <div className="p-4 bg-[#0f1526] border-t border-slate-700/50 space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <p className="text-xs text-slate-400">
                    Toggle stats & rearrange display order. Changes persist automatically:
                  </p>
                  <button 
                    type="button" 
                    onClick={() => setIsEditOrderMode(!isEditOrderMode)} 
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      isEditOrderMode 
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-400 shadow-sm' 
                        : 'bg-[#0b101e] border-slate-700/60 text-slate-300 hover:text-white hover:border-emerald-500/50'
                    }`}
                  >
                    {isEditOrderMode ? '🔒 Done Reordering' : '✏️ Rearrange Order'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(isEditOrderMode 
                    ? [...selectedMetrics.map(id => AVAILABLE_METRICS.find(m => m.id === id)).filter(Boolean), ...AVAILABLE_METRICS.filter(m => !selectedMetrics.includes(m.id))]
                    : AVAILABLE_METRICS
                  ).map((m) => {
                    const active = isMetricTracked(m.id);
                    const orderIndex = selectedMetrics.indexOf(m.id);

                    return (
                      <div key={m.id} className="flex items-center gap-1.5 bg-[#0f1526] p-1 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => toggleMetric(m.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            active
                              ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500/60 text-white shadow-sm'
                              : 'bg-[#0b101e] border-slate-800 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <span>{m.icon}</span>
                          <span>{m.name}</span>
                          <span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-slate-700'}`}></span>
                        </button>

                        {isEditOrderMode && active && (
                          <div 
                            onClick={(e) => e.stopPropagation()} 
                            className="flex items-center gap-1 bg-[#0b101e] border border-slate-700/80 rounded-xl px-1.5 py-1"
                          >
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Order:</span>
                            <select
                              value={orderIndex + 1}
                              onChange={(e) => {
                                e.stopPropagation();
                                changeMetricOrder(m.id, parseInt(e.target.value));
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-slate-800 border border-slate-700 text-emerald-400 font-black text-xs rounded px-1 py-0.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                            >
                              {selectedMetrics.map((_, idx) => (
                                <option key={idx + 1} value={idx + 1}>
                                  #{idx + 1}
                                </option>
                              ))}
                            </select>
                            <div className="flex items-center ml-0.5 border-l border-slate-700/80 pl-1">
                              <button
                                type="button"
                                onClick={(e) => moveMetricUp(m.id, e)}
                                disabled={orderIndex <= 0}
                                title="Move Up"
                                className="px-1 py-0.5 text-slate-400 hover:text-emerald-400 disabled:opacity-30 font-black text-[10px] cursor-pointer"
                              >
                                ◄
                              </button>
                              <button
                                type="button"
                                onClick={(e) => moveMetricDown(m.id, e)}
                                disabled={orderIndex >= selectedMetrics.length - 1}
                                title="Move Down"
                                className="px-1 py-0.5 text-slate-400 hover:text-emerald-400 disabled:opacity-30 font-black text-[10px] cursor-pointer"
                              >
                                ►
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-slate-800/80 text-[11px]">
                  <button type="button" onClick={selectAllMetrics} className="text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer">Select All</button>
                  <span className="text-slate-600">•</span>
                  <button type="button" onClick={resetDefaultMetrics} className="text-slate-400 hover:text-white font-medium cursor-pointer">Reset Defaults</button>
                </div>
              </div>
            </details>
          </div>

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
        </div>

        {/* Dashboard Results */}
        {stats && !loading && (
          <div className={`animate-in fade-in slide-in-from-bottom-8 duration-700 ${isMobileView ? 'space-y-5' : 'space-y-8'}`}>
            
            {/* Player Header Banner */}
            {/* Player Header Banner with Interactive Track Player Switch */}
            <div className={`bg-[#131b2f] rounded-2xl border border-slate-700/50 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 ${
              isMobileView ? 'p-4 text-center' : 'p-6 md:p-8 text-left'
            }`}>
              <div className="flex items-center gap-4">
                {stats.current.avatarUrl ? (
                  <img 
                    src={stats.current.avatarUrl} 
                    alt={stats.current.username} 
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 border-emerald-500/60 shadow-lg shadow-emerald-500/20 object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-emerald-500/20">
                    {stats.current.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className={`font-black text-white ${isMobileView ? 'text-2xl' : 'text-3xl'}`}>{stats.current.username}</h2>
                  <p className="text-slate-400 uppercase tracking-widest text-xs mt-0.5 font-bold">
                    {stats.current.rank}
                  </p>
                </div>
              </div>

              {/* Interactive Track Player Toggle Checkbox / Button */}
              <button
                onClick={() => handleToggleTrackPlayer(stats.current.username)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2.5 cursor-pointer shadow-lg border ${
                  trackedPlayers[stats.current.username?.toLowerCase()]
                    ? 'bg-emerald-500/20 border-emerald-500/80 text-emerald-400 shadow-emerald-500/20 hover:bg-emerald-500/30'
                    : 'bg-slate-800/90 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white'
                }`}
              >
                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black border transition-all ${
                  trackedPlayers[stats.current.username?.toLowerCase()]
                    ? 'bg-emerald-500 border-emerald-400 text-black'
                    : 'border-slate-600 bg-slate-900 text-transparent'
                }`}>
                  ✓
                </span>
                <span>
                  {trackedPlayers[stats.current.username?.toLowerCase()] ? 'Tracked • Snapshot Data Active' : 'Track Player Progress'}
                </span>
              </button>
            </div>

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

            {/* Primary Tracked Metrics Grid */}
            <div className={`grid gap-4 ${
              isMobileView ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 md:gap-6'
            }`}>
              {selectedMetrics.map((metricId, orderIndex) => {
                if (metricId === 'winRate') return (
                  <div 
                    key="winRate"
                    onClick={() => toggleExpandMetric('winRate')}
                    className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${
                      isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
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
                  </div>
                );

                if (metricId === 'kdRatio') return (
                  <div 
                    key="kdRatio"
                    onClick={() => toggleExpandMetric('kdRatio')}
                    className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${
                      isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
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
                  </div>
                );

                if (metricId === 'heroDamage') return (
                  <div 
                    key="heroDamage"
                    onClick={() => toggleExpandMetric('heroDamage')}
                    className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${
                      isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
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
                  </div>
                );

                if (metricId === 'healing') return (
                  <div 
                    key="healing"
                    onClick={() => toggleExpandMetric('healing')}
                    className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${
                      isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
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
                  </div>
                );

                if (metricId === 'damageBlocked') return (
                  <div 
                    key="damageBlocked"
                    onClick={() => toggleExpandMetric('damageBlocked')}
                    className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${
                      isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
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
                  </div>
                );

                if (metricId === 'accuracy') return (
                  <div 
                    key="accuracy"
                    onClick={() => toggleExpandMetric('accuracy')}
                    className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${
                      isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
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
                  </div>
                );

                if (metricId === 'mvp') return (
                  <div 
                    key="mvp"
                    onClick={() => toggleExpandMetric('mvp')}
                    className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${
                      isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
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
                  </div>
                );

                if (metricId === 'svp') return (
                  <div 
                    key="svp"
                    onClick={() => toggleExpandMetric('svp')}
                    className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${
                      isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
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
                  </div>
                );

                if (metricId === 'timePlayed') return (
                  <div 
                    key="timePlayed"
                    onClick={() => toggleExpandMetric('timePlayed')}
                    className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${
                      isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
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
                  </div>
                );

                if (metricId === 'matchesPlayed') return (
                  <div 
                    key="matchesPlayed"
                    onClick={() => toggleExpandMetric('matchesPlayed')}
                    className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group cursor-pointer transition-all duration-300 ${
                      isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50 hover:border-emerald-500/60 hover:shadow-lg hover:shadow-emerald-500/10'
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
                  </div>
                );

                if (metricId === 'topHeroes') return (
                  <div key="topHeroes" className={`bg-[#131b2f] p-5 rounded-2xl border relative overflow-hidden group transition-all duration-300 ${
                    isEditOrderMode ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-700/50'
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
            <div className={`grid gap-3 bg-[#131b2f] p-4 sm:p-5 rounded-2xl border border-slate-700/50 shadow-xl ${
              isMobileView ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }`}>
              {/* Card 1: Matches & Wins */}
              <div className="p-3.5 bg-[#0b101e] rounded-xl border border-slate-800/80 flex flex-col justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  Matches & Wins
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
                  <span className="text-lg sm:text-xl md:text-2xl font-black text-emerald-400 truncate">
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
                    className={`bg-[#131b2f] border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 text-white text-xs font-bold cursor-pointer shadow-lg ${
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
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
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

        {/* Auto-Update Permission Consent Modal */}
        {showAutoUpdateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#131b2f] border border-emerald-500/50 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl shadow-emerald-500/20 text-left space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <svg className="w-24 h-24 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-emerald-500/30">
                  ⚡
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-wider">Auto-Update Permission</h3>
                  <p className="text-xs text-emerald-400 font-bold">Meowdy 5000's Stat Tracker</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-slate-300">
                <p className="leading-relaxed">
                  Would you like Meowdy 5000's Stat Tracker to automatically check for and install updates from GitHub when you start the app?
                </p>
                <div className="bg-[#0b101e] p-3.5 rounded-xl border border-slate-700/60 space-y-2 text-xs">
                  <div className="flex items-start gap-2 text-emerald-400">
                    <span>✓</span>
                    <span>Instantly pulls latest telemetry features, stats fixes, and hero updates.</span>
                  </div>
                  <div className="flex items-start gap-2 text-emerald-400">
                    <span>✓</span>
                    <span>Automatic seamless app reloading on startup when updates are detected.</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setAutoUpdatePermission('enabled')}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/30 cursor-pointer text-center"
                >
                  ⚡ Enable Auto-Updates
                </button>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setAutoUpdatePermission('ask_each_time')}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#0b101e] hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer text-center"
                  >
                    🔔 Ask Me Each Time
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoUpdatePermission('never_ask')}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#0b101e] hover:bg-slate-800 border border-red-500/40 text-red-400 hover:text-red-300 hover:border-red-500/70 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer text-center"
                  >
                    🚫 Don't Ask Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Installing Update Overlay */}
        {isApplyingUpdate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-in fade-in duration-300">
            <div className="bg-[#131b2f] border-2 border-emerald-500 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl shadow-emerald-500/30">
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
            </div>
          </div>
        )}

        {/* Error Reporting Modal */}
        {showReportModal && (
          <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-[#0f1526] border border-slate-700/80 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
                    ⚠️
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wider">Report an Issue</h3>
                    <p className="text-[11px] text-slate-400">Error logs will be sent directly to the developer</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowReportModal(false)}
                  className="text-slate-400 hover:text-white text-lg font-bold px-2 py-0.5 rounded-lg hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              {lastCapturedError && (
                <div className="bg-[#0b101e] border border-red-500/30 rounded-xl p-3 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-red-400">Captured Error Log:</span>
                  <p className="text-xs font-mono text-slate-300 break-words line-clamp-3">
                    {lastCapturedError.error}
                  </p>
                </div>
              )}

              <form onSubmit={handleManualSubmitReport} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Describe what happened (Optional)
                  </label>
                  <textarea
                    value={reportNotes}
                    onChange={(e) => setReportNotes(e.target.value)}
                    placeholder="e.g. App froze when searching player name or metrics disappeared..."
                    rows="3"
                    className="w-full bg-[#0b101e] border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all resize-none"
                  ></textarea>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReport}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmittingReport ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Sending...</span>
                      </>
                    ) : (
                      <span>Send Error Report</span>
                    )}
                  </button>
                </div>
              </form>
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
            className="w-full max-w-sm bg-[#0f1526] border-l border-slate-700/80 h-full flex flex-col justify-between overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300 drawer-safe-area"
          >
            {/* Drawer Header */}
            <div className="space-y-6">
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

              {/* Drawer Group 1: App Updates */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  ⚡ App Updates & Maintenance
                </span>

                <button
                  onClick={() => { setIsMenuOpen(false); handleOneClickUpdate(); }}
                  disabled={checkingUpdate || isApplyingUpdate}
                  className="w-full bg-[#131b2f] hover:bg-emerald-500/10 border border-slate-700/80 hover:border-emerald-500/50 p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                      ⚡
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                        Check for update
                      </h4>
                      <p className="text-[10px] text-slate-400">Check, download & install latest release</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 group-hover:text-emerald-400 font-bold">→</span>
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
                      className={`px-3 py-3 rounded-xl border font-black text-xs transition-all flex items-center justify-center cursor-pointer shrink-0 shadow-sm ${
                        showWhyPermission 
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
                </div>
              </div>

              {/* Drawer Group 3: Diagnostics & Feedback */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  🛠️ Developer Tools & Issue Reporting
                </span>

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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                      isMobileView 
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400' 
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {isMobileView ? 'Mobile' : 'Desktop'}
                  </button>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="pt-6 border-t border-slate-800/80 text-center space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold text-slate-300">App Version</span>
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold text-[11px]">
                  v1.0.0 (ac332a4)
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

        {/* Subtle Non-Intrusive App Footer & Version Badge */}
        <footer className="mt-12 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center font-black text-[#00ff88] text-[9px] border border-[#00ff88] shadow-[0_0_10px_#00ff88]">
              M5
            </div>
            <span className="font-bold text-slate-400">Meowdy 5000's Stat Tracker</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
              v1.0.0 (91a57ab)
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

      </main>
    </div>
  );
}