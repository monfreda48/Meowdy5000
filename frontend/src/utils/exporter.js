export const FileViewer = {
  openCacheFolder: async () => ({ success: false, isWeb: true })
};

export const saveExportToCache = async (jsonData) => {
  const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tracker.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return null;
};

export const openExportCacheFolder = async () => {
  return { success: false, isWeb: true };
};
