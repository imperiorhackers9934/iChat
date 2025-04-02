import { Stack } from "expo-router";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { ClerkProvider } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import React from "react";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!

if (!publishableKey) {
    throw new Error(
      'Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env',
    )
  }
export default function RootLayout() {
  return(
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
    <SafeAreaProvider>
        <SafeAreaView style={{flex:1}}>
        <Stack screenOptions={{headerShown:false}}>
            <Stack.Screen name="index" options={{headerShown:false}} />
            <Stack.Screen name="login" options={{headerShown:false}} />
            <Stack.Screen name="signup" options={{headerShown:false}} />
        </Stack>
        </SafeAreaView>
    </SafeAreaProvider>
    </ClerkProvider>
)
}