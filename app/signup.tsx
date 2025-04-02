import * as React from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet, Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView } from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from 'react-native';

export default function SignUp() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  
  // Handle submission of sign-up form
  const onSignUpPress = async () => {
    if (!isLoaded) return;
    setIsLoading(true);
    
    // Start sign-up process using email and password provided
    try {
      await signUp.create({
        emailAddress,
        password,
        username,
      });
      // Send user an email with verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      // Set 'pendingVerification' to true to display second for and capture OTP code
      setPendingVerification(true);
    } catch (err) {
      //Pushes an alert to the user if sign-up fails
      Alert.alert('Failed to sign up. Please try again with different password.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

// Handle submission of verification form
  const onVerifyPress = async () => {
    if (!isLoaded) return;
    setIsLoading(true);
    
    try {
      // Use the code the user provided to attempt verification
      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code,
      });
      // If verification was completed, set the session to active and redirect the user
      if (signUpAttempt.status === 'complete') {
        await setActive({ session: signUpAttempt.createdSessionId });
        router.replace('/(tabs)');        
      } else {
        // If the status is not complete, check why. User may need to complete further steps.
        console.error(JSON.stringify(signUpAttempt, null, 2));
      }
    } catch (err) {
      Alert.alert('Failed to verify email. Please enter OTP again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView contentContainerStyle={styles.scrollView}>
            <View style={styles.content}>
              <Image
                source={{ uri: '/api/placeholder/400/300' }}
                style={styles.verificationImage}
                resizeMode="contain"
              />
              
              <Text style={styles.title}>Verify your email</Text>
              <Text style={styles.subtitle}>We've sent a verification code to {emailAddress}</Text>
              
              <View style={styles.inputContainer}>
                <TextInput
                  value={code}
                  placeholder="Enter verification code"
                  onChangeText={(code) => setCode(code)}
                  style={styles.input}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
              </View>
              
              <TouchableOpacity 
                style={styles.button}
                onPress={onVerifyPress}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>
                  {isLoading ? 'Verifying...' : 'Verify Email'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => setPendingVerification(false)}>
                <Text style={styles.linkText}>Back to sign up</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollView}>
          <View style={styles.content}>
            <Image
              source={require('../assets/images/signup.png')}
              style={styles.image}
              resizeMode="contain"
            />
            
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up to get started with our app</Text>
            
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
              value={username}
              placeholder="Username"
              onChangeText={(username) => setUsername(username)}
              style={styles.input}
              autoCapitalize="none"
              />
            </View>


            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                autoCapitalize="none"
                value={emailAddress}
                placeholder="Email address"
                onChangeText={(email) => setEmailAddress(email)}
                style={styles.input}
                keyboardType="email-address"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                value={password}
                placeholder="Password"
                secureTextEntry={!showPassword}
                onChangeText={(password) => setPassword(password)}
                style={styles.input}
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons 
                  name={showPassword ? "eye-off-outline" : "eye-outline"} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>

            
            <TouchableOpacity 
              style={styles.button}
              onPress={onSignUpPress}
              disabled={isLoading || !emailAddress || !password}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Creating Account...' : 'Sign Up'}
              </Text>
            </TouchableOpacity>
            
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Link href="/login" style={styles.link}>
                <Text style={styles.linkText}>Sign in</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '80%',
    height: 220,
    marginBottom: 30,
  },
  verificationImage: {
    width: '70%',
    height: 180,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 8,
  },
  button: {
    backgroundColor: '#4a6fef',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#4a6fef',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  link: {
    marginLeft: 4,
  },
  linkText: {
    color: '#4a6fef',
    fontSize: 14,
    fontWeight: '600',
  },
});