import React, { useState } from 'react';
import { WelcomeScreen } from '../screens/WelcomeScreen.js';
import { InitScreen } from '../screens/InitScreen.js';
import { CreateScreen } from '../screens/CreateScreen.js';
import { LoginScreen } from '../screens/LoginScreen.js';
import { WhoamiScreen } from '../screens/WhoamiScreen.js';
import { LogoutScreen } from '../screens/LogoutScreen.js';
import { ValidateScreen } from '../screens/ValidateScreen.js';
import { PushScreen } from '../screens/PushScreen.js';

type Screen =
  | { type: 'welcome' }
  | { type: 'init'; projectName?: string }
  | { type: 'create'; componentName?: string; projectPath?: string }
  | { type: 'login' }
  | { type: 'status' }
  | { type: 'logout' }
  | { type: 'validate'; projectPath?: string; dryRun?: boolean }
  | { type: 'push'; projectPath?: string };

export interface HistoryEntry {
  type: 'prompt' | 'response' | 'info' | 'success' | 'error' | 'progress' | 'spinner';
  content: string;
  timestamp?: number;
  color?: 'green' | 'cyan' | 'yellow' | 'red' | 'dim';
  spinnerId?: string; // Unique ID for managing spinner state
}

interface AppProps {
  initialScreen?: Screen;
  onExit: () => void;
}

/**
 * App Component
 * Main router for the CLI application
 * Manages navigation between different screens and persistent history
 */
export const App: React.FC<AppProps> = ({ initialScreen, onExit }) => {
  const [currentScreen, setCurrentScreen] = useState<Screen>(
    initialScreen || { type: 'welcome' }
  );

  // Persistent session history across all screens
  const [sessionHistory, setSessionHistory] = useState<HistoryEntry[]>([]);

  // Add entry to session history
  const addToHistory = (entry: HistoryEntry | HistoryEntry[]) => {
    if (Array.isArray(entry)) {
      setSessionHistory(prev => [...prev, ...entry]);
    } else {
      setSessionHistory(prev => [...prev, entry]);
    }
  };

  // Remove entry from session history by spinner ID
  const removeFromHistory = (spinnerId: string) => {
    setSessionHistory(prev => prev.filter(entry => entry.spinnerId !== spinnerId));
  };

  // Navigate to a specific screen
  const navigateTo = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  // Return to welcome screen
  const returnToWelcome = () => {
    setCurrentScreen({ type: 'welcome' });
  };

  // Render the current screen
  switch (currentScreen.type) {
    case 'welcome':
      return (
        <WelcomeScreen
          onNavigate={navigateTo}
          onExit={onExit}
          sessionHistory={sessionHistory}
          addToHistory={addToHistory}
        />
      );

    case 'init':
      return (
        <InitScreen
          projectName={currentScreen.projectName}
          onExit={returnToWelcome}
          sessionHistory={sessionHistory}
          addToHistory={addToHistory}
        />
      );

    case 'create':
      return (
        <CreateScreen
          componentName={currentScreen.componentName}
          projectPath={currentScreen.projectPath || '.'}
          onExit={returnToWelcome}
          sessionHistory={sessionHistory}
          addToHistory={addToHistory}
        />
      );

    case 'login':
      return (
        <LoginScreen
          onExit={returnToWelcome}
          sessionHistory={sessionHistory}
          addToHistory={addToHistory}
          removeFromHistory={removeFromHistory}
        />
      );

    case 'status':
      return (
        <WhoamiScreen
          onExit={returnToWelcome}
          sessionHistory={sessionHistory}
          addToHistory={addToHistory}
        />
      );

    case 'logout':
      return (
        <LogoutScreen
          onExit={returnToWelcome}
          sessionHistory={sessionHistory}
          addToHistory={addToHistory}
          removeFromHistory={removeFromHistory}
        />
      );

    case 'validate':
      return (
        <ValidateScreen
          projectPath={currentScreen.projectPath || '.'}
          dryRun={currentScreen.dryRun || false}
          onExit={returnToWelcome}
          sessionHistory={sessionHistory}
          addToHistory={addToHistory}
        />
      );

    case 'push':
      return (
        <PushScreen
          projectPath={currentScreen.projectPath || '.'}
          onExit={returnToWelcome}
          sessionHistory={sessionHistory}
          addToHistory={addToHistory}
          removeFromHistory={removeFromHistory}
        />
      );

    default:
      return (
        <WelcomeScreen
          onNavigate={navigateTo}
          onExit={onExit}
        />
      );
  }
};

export default App;
