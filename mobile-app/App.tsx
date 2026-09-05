import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from './src/theme/ThemeContext';
import { DashboardScreen } from './src/screens/DashboardScreen';

export default function App() {
  return (
    <ThemeProvider>
      <StatusBar style="light" />
      <DashboardScreen />
    </ThemeProvider>
  );
}
