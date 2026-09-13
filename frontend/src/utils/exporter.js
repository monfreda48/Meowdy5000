import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { registerPlugin } from '@capacitor/core';

export const FileViewer = registerPlugin('FileViewer');

export const saveExportToCache = async (jsonData) => {
  if (typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: 'tracker.json',
      data: JSON.stringify(jsonData, null, 2),
      directory: Directory.Cache,
      encoding: Encoding.UTF8
    });
    const result = await Filesystem.getUri({
      path: 'tracker.json',
      directory: Directory.Cache
    });
    return result.uri;
  } else {
    // Standard browser blob download fallback
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tracker.json';
    a.click();
    URL.revokeObjectURL(url);
    return null;
  }
};

export const openExportCacheFolder = async () => {
  if (typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
    try {
      await FileViewer.openCacheFolder();
      return { success: true };
    } catch (e) {
      console.warn('Failed to open cache folder via FileViewer plugin:', e);
      return { success: false, error: e.message };
    }
  } else {
    return { success: false, isWeb: true };
  }
};
