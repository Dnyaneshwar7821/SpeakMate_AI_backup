/**
 * DrawerNavigator
 *
 * Official React Navigation Drawer Navigator.
 * Preserves Bottom Tabs (BottomNavigator) exactly as-is.
 *
 * Lessons are wrapped in LessonsStackNavigator so that
 * pressing Back on LessonDetail returns to LessonsScreen
 * instead of jumping to the Dashboard.
 */
import React from 'react';
import { Dimensions } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';

import BottomNavigator        from './BottomNavigator';
import LessonsStackNavigator  from './LessonsStackNavigator';

import VocabularyScreen    from '../screens/main/VocabularyScreen';
import GrammarScreen       from '../screens/main/GrammarScreen';
import ProgressScreen      from '../screens/main/ProgressScreen';
import AchievementsScreen  from '../screens/main/AchievementsScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import SettingsScreen      from '../screens/main/SettingsScreen';
import HelpScreen          from '../screens/main/HelpScreen';
import AboutScreen         from '../screens/main/AboutScreen';
import SubscriptionScreen  from '../screens/main/SubscriptionScreen';

import { useTheme } from '../context/ThemeContext';
import DrawerSidebar from '../components/drawer/DrawerSidebar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340);

const Drawer = createDrawerNavigator();

export default function DrawerNavigator() {
  const { isDark } = useTheme();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerSidebar {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: {
          width: DRAWER_WIDTH,
          backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
        },
        overlayColor: isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(15, 23, 42, 0.45)',
        swipeEnabled: true,
        swipeEdgeWidth: 80,
      }}
      detachInactiveScreens={false}
    >
      {/* Bottom tabs */}
      <Drawer.Screen name="BottomTabs" component={BottomNavigator} />

      {/* Lessons — wrapped in a stack so LessonDetail back goes to LessonsList */}
      <Drawer.Screen name="Lessons" component={LessonsStackNavigator} />

      {/* Other drawer pages */}
      <Drawer.Screen name="Vocabulary"     component={VocabularyScreen}    />
      <Drawer.Screen name="Grammar"        component={GrammarScreen}       />
      <Drawer.Screen name="Progress"       component={ProgressScreen}      />
      <Drawer.Screen name="Achievements"   component={AchievementsScreen}  />
      <Drawer.Screen name="Notifications"  component={NotificationsScreen} />
      <Drawer.Screen name="Settings"       component={SettingsScreen}      />
      <Drawer.Screen name="Subscription"   component={SubscriptionScreen}  />
      <Drawer.Screen name="Help"           component={HelpScreen}          />
      <Drawer.Screen name="About"          component={AboutScreen}         />
    </Drawer.Navigator>
  );
}
