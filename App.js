import './global.css';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { ApiProvider, useApi } from './src/contexts/ApiContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import PosApp from './src/PosApp';

function Root() {
  const { ready } = useApi();
  if (!ready) {
    return (
      <View className="flex-1 bg-pos-bg items-center justify-center">
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }
  return (
    <>
      <StatusBar style="light" />
      <PosApp />
    </>
  );
}

export default function App() {
  return (
    <ApiProvider>
      <LanguageProvider>
        <Root />
      </LanguageProvider>
    </ApiProvider>
  );
}
