import * as FileSystem from 'expo-file-system';

const BASE_DIR = `${FileSystem.documentDirectory}player_records/`;
const SNAPSHOTS_DIR = `${BASE_DIR}snapshots/`;

const ensureDirectoryExists = async (dirPath: string) => {
  const dirInfo = await FileSystem.getInfoAsync(dirPath);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
  }
};

export const saveSnapshot = async (rawJson: string, username: string, season: string): Promise<void> => {
  try {
    await ensureDirectoryExists(BASE_DIR);
    await ensureDirectoryExists(SNAPSHOTS_DIR);

    // Overwrite current_profile.json for instant offline startup
    const currentPath = `${BASE_DIR}current_profile.json`;
    await FileSystem.writeAsStringAsync(currentPath, rawJson, { encoding: FileSystem.EncodingType.UTF8 });

    // Save timestamped historical snapshot
    const safeUser = username.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeSeason = season.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const snapshotPath = `${SNAPSHOTS_DIR}${safeUser}_${safeSeason}_${timestamp}.json`;

    await FileSystem.writeAsStringAsync(snapshotPath, rawJson, { encoding: FileSystem.EncodingType.UTF8 });
  } catch (error) {
    console.error('Error saving snapshot:', error);
  }
};

export const loadLatestProfile = async (): Promise<string | null> => {
  try {
    const currentPath = `${BASE_DIR}current_profile.json`;
    const info = await FileSystem.getInfoAsync(currentPath);
    if (info.exists) {
      return await FileSystem.readAsStringAsync(currentPath, { encoding: FileSystem.EncodingType.UTF8 });
    }
    return null;
  } catch (error) {
    console.error('Error loading latest profile:', error);
    return null;
  }
};

export const getHistoricalSnapshots = async (): Promise<string[]> => {
  try {
    await ensureDirectoryExists(SNAPSHOTS_DIR);
    const files = await FileSystem.readDirectoryAsync(SNAPSHOTS_DIR);
    return files.filter(f => f.endsWith('.json')).map(f => `${SNAPSHOTS_DIR}${f}`);
  } catch (error) {
    console.error('Error reading historical snapshots:', error);
    return [];
  }
};
