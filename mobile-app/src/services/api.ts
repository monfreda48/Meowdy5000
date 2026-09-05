import axios from 'axios';
import { Platform } from 'react-native';

const BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export interface SeasonInfo {
  season_number: string;
  season_title: string;
  days_left: number;
  end_date: string;
  progress_percentage: number;
  new_hero_name: string;
  new_hero_icon: string;
}

export interface PlayerProfile {
  player_name: string;
  profile_url: string;
  overview: {
    kda: number;
    win_rate: number;
    matches_played: number;
    damage_per_min: number;
    healing_per_min: number;
    mvp_count: number;
    svp_count: number;
  };
  heroes: Array<{
    hero_name: string;
    matches: number;
    win_rate: number;
    kda: number;
    time_played: string;
  }>;
  scraped_at: string;
}

export const fetchCurrentSeason = async (): Promise<SeasonInfo> => {
  const res = await apiClient.get('/api/season/current');
  return res.data;
};

export const searchPlayer = async (username: string): Promise<{ claimed: boolean; profile_url: string; data: PlayerProfile }> => {
  const res = await apiClient.post('/api/search', { username });
  return res.data;
};

export const claimProfile = async (username: string, profile_url: string): Promise<PlayerProfile> => {
  const res = await apiClient.post('/api/claim', { username, profile_url });
  return res.data;
};

export const fetchProfile = async (username: string, refresh = false): Promise<PlayerProfile> => {
  const res = await apiClient.get(`/api/profile/${encodeURIComponent(username)}?refresh=${refresh}`);
  return res.data;
};
