import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { SwipeScreen } from './components/SwipeScreen';
import { WinnerScreen } from './components/WinnerScreen';
import { PageTransition } from './components/PageTransition';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'welcome' | 'lobby' | 'swipe' | 'winner'>('welcome');
  const [sessionCode, setSessionCode] = useState('');

  const handleStartSession = (code: string) => {
    setSessionCode(code);
    setCurrentScreen('lobby');
  };

  return (
    <div className="min-h-screen bg-black overflow-hidden">
      <AnimatePresence mode="wait">
        {currentScreen === 'welcome' && (
          <PageTransition key="welcome">
            <WelcomeScreen onNavigate={handleStartSession} />
          </PageTransition>
        )}
        {currentScreen === 'lobby' && (
          <PageTransition key="lobby">
            <LobbyScreen sessionCode={sessionCode} onNavigate={() => setCurrentScreen('swipe')} />
          </PageTransition>
        )}
        {currentScreen === 'swipe' && (
          <PageTransition key="swipe">
            <SwipeScreen onNavigate={() => setCurrentScreen('winner')} />
          </PageTransition>
        )}
        {currentScreen === 'winner' && (
          <PageTransition key="winner">
            <WinnerScreen onNavigate={() => setCurrentScreen('welcome')} />
          </PageTransition>
        )}
      </AnimatePresence>
    </div>
  );
}
