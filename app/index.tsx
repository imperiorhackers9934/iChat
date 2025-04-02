import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { View, Text } from 'react-native';

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View>
        <Text>Loading...</Text>
      </View>
    ); //Completely Resolve Auth then Redirect it
  }

  if (!isSignedIn) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)" />;
}