import { Redirect } from 'expo-router';
import { useAppSelector } from '@/redux/hooks';

export default function Index() {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(main)/(drawer)/(tabs)" />;
}

