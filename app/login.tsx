import { useSignIn, useAuth } from '@clerk/clerk-expo'
import { Link, useRouter } from 'expo-router'
import { Text, TextInput, TouchableOpacity, View, StyleSheet, Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Dimensions, Alert,Modal,ActivityIndicator} from 'react-native'
import React, { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { MaterialIcons } from '@expo/vector-icons'

const { width } = Dimensions.get('window')

export default function Login() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const router = useRouter()
  const { isSignedIn } = useAuth()
  const [emailAddress, setEmailAddress] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Password reset states
  const [forgotPasswordModalVisible, setForgotPasswordModalVisible] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetEmailLoading, setResetEmailLoading] = useState(false)
  const [resetEmailError, setResetEmailError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  
  // Reset password flow state
  const [resetPasswordStep, setResetPasswordStep] = useState('email') // email -> otp -> newPassword
  const [otpCode, setOtpCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verifyOtpLoading, setVerifyOtpLoading] = useState(false)
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false)
  const [resetPasswordAttempt, setResetPasswordAttempt] = useState(null)

  // Redirect if signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/(tabs)')
    }
  }, [isLoaded, isSignedIn])

  // Handle the submission of the sign-in form
  const onSignInPress = async () => {
    if (!isLoaded) return

    setLoading(true)
    setError('')

    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      })

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId })
        router.replace('/(tabs)')
      } else {
        setError('Sign in could not be completed. Please try again.')
      }
    } catch (err) {
      console.error("Sign in error:", err)
      if (err instanceof Error && 'errors' in err) {
        setError((err as any).errors?.[0]?.message || 'Failed to sign in. Please check your credentials.')
      } else {
        setError('Failed to sign in. Please check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Initialize forgot password flow - send OTP to email
  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      setResetEmailError('Please enter your email address')
      return
    }

    setResetEmailLoading(true)
    setResetEmailError('')

    try {
      // Start the reset password flow using the email code strategy
      const attempt = await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: resetEmail,
      })
      
      // Store the attempt for later use in verification
      setResetPasswordAttempt(attempt)
      
      // Move to OTP verification step
      setResetPasswordStep('otp')
    } catch (err) {
      console.error("Password reset error:", err)
      if (err instanceof Error && 'errors' in err) {
        setResetEmailError((err as any).errors?.[0]?.message || 'Failed to send reset code. Please try again.')
      } else {
        setResetEmailError('Failed to send reset code. Please try again.')
      }
    } finally {
      setResetEmailLoading(false)
    }
  }

  // Verify OTP code
  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code')
      return
    }

    setVerifyOtpLoading(true)

    try {
      // Attempt to verify the code
      const result = await resetPasswordAttempt.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: otpCode,
      })

      if (result.status === 'needs_new_password') {
        // If verification successful, move to new password step
        setResetPasswordStep('newPassword')
      } else {
        Alert.alert('Error', 'Something went wrong during verification.')
      }
    } catch (err) {
      console.error("OTP verification error:", err)
      Alert.alert('Invalid OTP', 'The verification code you entered is incorrect. Please try again.')
    } finally {
      setVerifyOtpLoading(false)
    }
  }

  // Reset password with new password
  const handleResetPassword = async () => {
    // Basic validation
    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password')
      return
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }
    
    setResetPasswordLoading(true)
    
    try {
      // Complete the reset password process with the new password
      const result = await resetPasswordAttempt.resetPassword({
        password: newPassword,
      })
      
      if (result.status === 'complete') {
        Alert.alert(
          'Success',
          'Your password has been reset successfully. You can now sign in with your new password.',
          [{ text: 'OK', onPress: closeForgotPasswordModal }]
        )
      } else {
        Alert.alert('Error', 'Password reset failed. Please try again.')
      }
    } catch (err) {
      console.error("Password reset error:", err)
      if (err instanceof Error && 'errors' in err) {
        Alert.alert('Error', (err as any).errors?.[0]?.message || 'Failed to reset password. Please try again.')
      } else {
        Alert.alert('Error', 'Failed to reset password. Please try again.')
      }
    } finally {
      setResetPasswordLoading(false)
    }
  }

  // Close and reset the forgot password modal
  const closeForgotPasswordModal = () => {
    setForgotPasswordModalVisible(false)
    // Reset all states after modal is closed
    setTimeout(() => {
      setResetEmail('')
      setOtpCode('')
      setNewPassword('')
      setConfirmPassword('')
      setResetEmailError('')
      setResetPasswordStep('email')
      setResetPasswordAttempt(null)
    }, 300)
  }

  // Function to go back to previous step in the password reset flow
  const goToPreviousStep = () => {
    if (resetPasswordStep === 'otp') {
      setResetPasswordStep('email')
    } else if (resetPasswordStep === 'newPassword') {
      setResetPasswordStep('otp')
    }
  }

  // Render different content based on the current step of password reset flow
  const renderPasswordResetContent = () => {
    switch (resetPasswordStep) {
      case 'email':
        return (
          <>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalDescription}>
              Enter your email address and we'll send you a verification code to reset your password.
            </Text>
            
            <View style={styles.modalInputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={resetEmail}
                onChangeText={setResetEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoFocus
              />
            </View>
            
            {resetEmailError ? (
              <Text style={styles.errorText}>{resetEmailError}</Text>
            ) : null}
            
            <TouchableOpacity
              style={[styles.button, resetEmailLoading && styles.buttonDisabled]}
              onPress={handleForgotPassword}
              disabled={resetEmailLoading}
            >
              {resetEmailLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Send Verification Code</Text>
              )}
            </TouchableOpacity>
          </>
        );
        
      case 'otp':
        return (
          <>
            <Text style={styles.modalTitle}>Enter Verification Code</Text>
            <Text style={styles.modalDescription}>
              We've sent a verification code to {resetEmail}. Please enter it below.
            </Text>
            
            <View style={styles.modalInputContainer}>
              <Text style={styles.inputLabel}>Verification Code</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter verification code"
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                autoFocus
              />
            </View>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.backButton]}
                onPress={goToPreviousStep}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.primaryButton, verifyOtpLoading && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={verifyOtpLoading}
              >
                {verifyOtpLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Verify</Text>
                )}
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.resendContainer}
              onPress={handleForgotPassword}
            >
              <Text style={styles.resendText}>Didn't receive a code? </Text>
              <Text style={styles.resendButton}>Resend</Text>
            </TouchableOpacity>
          </>
        );
        
      case 'newPassword':
        return (
          <>
            <Text style={styles.modalTitle}>Set New Password</Text>
            <Text style={styles.modalDescription}>
              Create a new password for your account.
            </Text>
            
            <View style={styles.modalInputContainer}>
              <Text style={styles.inputLabel}>New Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity 
                  style={styles.eyeIcon} 
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <MaterialIcons 
                    name={showPassword ? "visibility-off" : "visibility"} 
                    size={24} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.modalInputContainer}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>
            </View>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.backButton]}
                onPress={goToPreviousStep}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.primaryButton, resetPasswordLoading && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={resetPasswordLoading}
              >
                {resetPasswordLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Reset Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        );
        
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Illustration Section */}
          <View style={styles.illustrationContainer}>
            <Image
              source={require('../assets/images/social.png')}
              style={styles.illustration}
              resizeMode="contain"
            />
            <Text style={styles.welcomeTitle}>Welcome Back!</Text>
            <Text style={styles.welcomeSubtitle}>
              Connect with friends and share moments
            </Text>
          </View>

          {/* Form Section */}
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Sign In</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter email"
                value={emailAddress}
                onChangeText={setEmailAddress}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity 
                  style={styles.eyeIcon} 
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <MaterialIcons 
                    name={showPassword ? "visibility-off" : "visibility"} 
                    size={24} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.forgotButton}
              onPress={() => {
                setResetEmail(emailAddress); // Pre-fill with login email
                setForgotPasswordModalVisible(true);
              }}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
            
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={onSignInPress}
              disabled={loading || !isLoaded}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.switchAuthContainer}>
              <Text style={styles.switchAuthText}>Don't have an account?</Text>
              <Link href="/signup" style={styles.switchAuthButton}>
                <Text style={styles.switchAuthButtonText}>Sign up</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Password Reset Modal with multiple steps */}
      <Modal
        visible={forgotPasswordModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeForgotPasswordModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={closeForgotPasswordModal}
            >
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
            
            {renderPasswordResetContent()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7ff',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  illustrationContainer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  illustration: {
    width: width * 0.8,
    height: width * 0.6,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#4267B2',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 10,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 10,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotText: {
    color: '#4267B2',
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: '#ef4444',
    marginBottom: 10,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#4267B2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    paddingHorizontal: 16,
    color: '#666',
    fontWeight: '500',
  },
  switchAuthContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
    alignItems: 'center',
  },
  switchAuthText: {
    color: '#666',
    fontSize: 14,
  },
  switchAuthButton: {
    marginLeft: 5,
  },
  switchAuthButtonText: {
    color: '#4267B2',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '85%',
    paddingHorizontal: 24,
    paddingVertical: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalInputContainer: {
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 10,
  },
  backButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 2,
    backgroundColor: '#4267B2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    color: '#666',
    fontSize: 14,
  },
  resendButton: {
    color: '#4267B2',
    fontSize: 14,
    fontWeight: '600',
  }
});