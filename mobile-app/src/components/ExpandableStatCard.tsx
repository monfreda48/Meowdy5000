import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ExpandableStatCardProps {
  title: string;
  initiallyExpanded?: boolean;
  children: React.ReactNode;
}

export const ExpandableStatCard: React.FC<ExpandableStatCardProps> = ({
  title,
  initiallyExpanded = true,
  children,
}) => {
  const { themeColors } = useTheme();
  const [expanded, setExpanded] = useState(initiallyExpanded);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.cardBorder }]}>
      <TouchableOpacity onPress={toggleExpand} style={styles.headerRow} activeOpacity={0.7}>
        <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
        <Text style={[styles.chevron, { color: themeColors.primary }]}>
          {expanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.contentContainer}>
          {children}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  chevron: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  contentContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
  },
});
