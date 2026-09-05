import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { SeasonInfo } from '../services/api';

interface SeasonBannerProps {
  info?: SeasonInfo;
}

export const SeasonBanner: React.FC<SeasonBannerProps> = ({ info }) => {
  const { themeColors } = useTheme();

  const seasonNumber = info?.season_number || '9.5';
  const seasonTitle = info?.season_title || 'THE MYSTERY OF THEBES';
  const daysLeft = info?.days_left ?? 6;
  const progressPct = info?.progress_percentage ? Math.min(100, info.progress_percentage) : 78;
  const newHero = info?.new_hero_name || 'The Hood';

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.cardBorder }]}>
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: themeColors.primary }]}>
          <Text style={styles.badgeText}>SEASON {seasonNumber}</Text>
        </View>

        <View style={[styles.heroPill, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
          <Text style={[styles.heroPillText, { color: themeColors.secondary }]}>NEW HERO: {newHero}</Text>
        </View>
      </View>

      <Text style={[styles.title, { color: themeColors.text }]}>{seasonTitle}</Text>

      <View style={styles.metaRow}>
        <Text style={[styles.metaText, { color: themeColors.text }]}>{daysLeft} Days Remaining</Text>
        <Text style={[styles.metaTextBold, { color: themeColors.primary }]}>{progressPct}% Complete</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressBar, { width: `${progressPct}%`, backgroundColor: themeColors.primary }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 10,
    elevation: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
  },
  heroPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    marginVertical: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 13,
    opacity: 0.8,
  },
  metaTextBold: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
});
