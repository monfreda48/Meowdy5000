import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useTheme, ThemePreset } from '../theme/ThemeContext';
import { SeasonBanner } from '../components/SeasonBanner';
import { ExpandableStatCard } from '../components/ExpandableStatCard';
import {
  fetchCurrentSeason,
  searchPlayer,
  claimProfile,
  SeasonInfo,
  PlayerProfile
} from '../services/api';
import { loadLatestProfile, saveSnapshot } from '../services/snapshotManager';
import { scheduleDailyReminder } from '../services/notificationService';

export const DashboardScreen: React.FC = () => {
  const { currentTheme, themeColors, setTheme } = useTheme();

  const [seasonData, setSeasonData] = useState<SeasonInfo | undefined>();
  const [profileData, setProfileData] = useState<PlayerProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);

  useEffect(() => {
    loadLatestProfile().then(cachedJson => {
      if (cachedJson) {
        try {
          const parsed = JSON.parse(cachedJson);
          setProfileData(parsed);
        } catch (e) {
          console.error('Failed to parse offline profile json:', e);
        }
      }
    });

    fetchCurrentSeason()
      .then(data => setSeasonData(data))
      .catch(err => console.warn('Could not fetch season data:', err));
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await searchPlayer(searchQuery.trim());
      setIsClaimed(res.claimed);
      if (res.data) {
        setProfileData(res.data);
        await saveSnapshot(JSON.stringify(res.data), searchQuery.trim(), '19');
      }
    } catch (err: any) {
      Alert.alert('Search Error', err.message || 'Could not fetch stats');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!profileData?.player_name) return;
    setLoading(true);
    try {
      const targetUrl = profileData.profile_url || `https://tracker.gg/marvel-rivals/profile/ign/${encodeURIComponent(profileData.player_name)}/overview?season=19`;
      const claimedData = await claimProfile(profileData.player_name, targetUrl);
      setIsClaimed(true);
      setProfileData(claimedData);
      await saveSnapshot(JSON.stringify(claimedData), profileData.player_name, '19');
      Alert.alert('Profile Claimed!', `Claimed ${profileData.player_name} for automated tracking.`);
    } catch (err: any) {
      Alert.alert('Claim Error', err.message || 'Could not claim profile');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleReminder = () => {
    scheduleDailyReminder(20, 0);
    Alert.alert('Daily Reminder Set', 'Scheduled daily stats reminder at 8:00 PM!');
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Top Navigation Bar */}
      <View style={[styles.topBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.cardBorder }]}>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>M5 Stat Tracker</Text>
        
        <TouchableOpacity onPress={() => setShowThemePicker(!showThemePicker)} style={[styles.themeBtn, { backgroundColor: themeColors.primary }]}>
          <Text style={styles.themeBtnText}>🎨 Menu</Text>
        </TouchableOpacity>
      </View>

      {/* Theme Presets Drawer */}
      {showThemePicker && (
        <View style={[styles.themePicker, { backgroundColor: themeColors.surface, borderColor: themeColors.primary }]}>
          <Text style={[styles.pickerTitle, { color: themeColors.primary }]}>Select M3 Theme Preset:</Text>
          <View style={styles.presetRow}>
            {(['DEFAULT_DARK', 'GAMBIT_PURPLE', 'CYBERPUNK'] as ThemePreset[]).map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => { setTheme(t); setShowThemePicker(false); }}
                style={[
                  styles.presetBtn,
                  { backgroundColor: currentTheme === t ? themeColors.primary : 'rgba(255,255,255,0.1)' }
                ]}
              >
                <Text style={[styles.presetText, { color: currentTheme === t ? '#000' : themeColors.text }]}>
                  {t.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 1. Season Banner at Very Top */}
        <SeasonBanner info={seasonData} />

        {/* 2. Search Bar below Season Banner */}
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.surface, color: themeColors.text, borderColor: themeColors.cardBorder }]}
            placeholder="Search IGN (e.g. Meowdy 5000)"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity onPress={handleSearch} style={[styles.searchBtn, { backgroundColor: themeColors.primary }]}>
            <Text style={styles.searchBtnText}>🔍</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator size="large" color={themeColors.primary} style={{ marginVertical: 12 }} />}

        {/* Claim Profile Banner */}
        {profileData && !isClaimed && (
          <TouchableOpacity onPress={handleClaim} style={[styles.claimBanner, { backgroundColor: themeColors.secondary }]}>
            <Text style={styles.claimText}>👑 Claim Profile ({profileData.player_name}) for Auto-Tracking</Text>
          </TouchableOpacity>
        )}

        {/* Conditional Rendering: No stats if profile is not bound or searched yet */}
        {!profileData ? (
          <View style={[styles.unboundCard, { backgroundColor: themeColors.surface, borderColor: themeColors.cardBorder }]}>
            <Text style={[styles.unboundTitle, { color: themeColors.primary }]}>👑 No Bound Account</Text>
            <Text style={[styles.unboundSub, { color: themeColors.text }]}>
              Search for your player username above (e.g. Meowdy 5000) to inspect stats and claim your profile.
            </Text>
          </View>
        ) : (
          <>
            {/* Combat Overview Card */}
            <ExpandableStatCard title="⚔️ Combat Overview" initiallyExpanded={true}>
              <View style={styles.statRow}>
                <Text style={[styles.statLabel, { color: themeColors.text }]}>Win Rate / Matches:</Text>
                <Text style={[styles.statValue, { color: themeColors.primary }]}>
                  {profileData.overview.win_rate}% ({profileData.overview.matches_played} games)
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={[styles.statLabel, { color: themeColors.text }]}>KDA Ratio:</Text>
                <Text style={[styles.statValue, { color: themeColors.secondary }]}>{profileData.overview.kda}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={[styles.statLabel, { color: themeColors.text }]}>Damage / Min:</Text>
                <Text style={[styles.statValue, { color: themeColors.text }]}>{profileData.overview.damage_per_min}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={[styles.statLabel, { color: themeColors.text }]}>Healing / Min:</Text>
                <Text style={[styles.statValue, { color: themeColors.text }]}>{profileData.overview.healing_per_min}</Text>
              </View>
            </ExpandableStatCard>

            {/* Hero Mastery Card */}
            <ExpandableStatCard title="🦸 Hero Mastery Breakdown" initiallyExpanded={true}>
              {profileData.heroes.map((h, idx) => (
                <View key={idx} style={styles.heroRow}>
                  <Text style={[styles.heroName, { color: themeColors.primary }]}>{h.hero_name}</Text>
                  <Text style={[styles.heroDetails, { color: themeColors.text }]}>
                    {h.matches} Matches • {h.win_rate}% WR • {h.kda} KDA
                  </Text>
                </View>
              ))}
            </ExpandableStatCard>
          </>
        )}

        {/* Reminder Action */}
        <TouchableOpacity onPress={handleScheduleReminder} style={[styles.reminderBtn, { borderColor: themeColors.primary }]}>
          <Text style={[styles.reminderBtnText, { color: themeColors.primary }]}>⏰ Schedule Daily 8:00 PM Reminder</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  themeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  themeBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },
  themePicker: {
    padding: 12,
    borderBottomWidth: 1,
  },
  pickerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  presetText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
  },
  searchRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    fontSize: 18,
  },
  claimBanner: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  claimText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  unboundCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 16,
    alignItems: 'center',
  },
  unboundTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  unboundSub: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  heroName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  heroDetails: {
    fontSize: 12,
  },
  reminderBtn: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  reminderBtnText: {
    fontWeight: 'bold',
    fontSize: 13,
  },
});
