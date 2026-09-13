import { App } from '@capacitor/app';

export const checkForAppUpdate = async (baseUrl = '') => {
  try {
    let localVersion = '1.0.32';
    let localBuild = 32;

    if (window.Capacitor?.isNativePlatform?.()) {
      const info = await App.getInfo();
      localVersion = info.version || localVersion;
      localBuild = parseInt(info.build, 10) || localBuild;
    }

    const apiUrl = `${baseUrl}/api/app/version`.replace(/([^:]\/)\/+/g, '$1');
    const res = await fetch(apiUrl, { cache: 'no-store' });
    
    if (!res.ok) {
      return { updateAvailable: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    const serverVersion = data.version_name || '1.0.32';
    const serverBuild = parseInt(data.version_code, 10) || 32;
    const downloadUrl = data.download_url || 'https://meowdy5000.synology.me/download/m5-tracker-latest.apk';
    const releaseNotes = Array.isArray(data.release_notes) ? data.release_notes : [data.changelog || 'Performance improvements and bug fixes.'];

    // Check build number or semver string
    const updateAvailable = serverBuild > localBuild || compareSemver(serverVersion, localVersion) > 0;

    return {
      updateAvailable,
      currentVersion: localVersion,
      serverVersion,
      serverBuild,
      downloadUrl,
      releaseNotes,
      minSupportedVersion: data.min_supported_version || '1.0.0'
    };
  } catch (err) {
    console.warn('[Updater] Error checking for app update:', err);
    return { updateAvailable: false, error: str(err) };
  }
};

function compareSemver(v1, v2) {
  const p1 = (v1 || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = (v2 || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}
