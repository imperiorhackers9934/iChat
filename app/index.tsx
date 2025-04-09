import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import {  ActivityIndicator } from 'react-native';

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
        <ActivityIndicator size="large" color="#0084ff" />
    ); //Completely Resolve Auth then Redirect it
  }

  if (!isSignedIn) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)" />;
}