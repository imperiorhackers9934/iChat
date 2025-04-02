import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

export default function Profile() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    profileImage: null as string | null,
  });
  const [newImage, setNewImage] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      // Initialize with user data from Clerk
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.primaryEmailAddress?.emailAddress || '',
        profileImage: user.imageUrl,
      });
    } else if (isLoaded && !isSignedIn) {
      // Redirect to login if not signed in
      router.replace('../login');
    }
  }, [isLoaded, isSignedIn, user]);

  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to make this work!');
        return;
      }
      
      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setNewImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'There was an error selecting the image.');
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Validate inputs
      if (!profileData.firstName.trim() || !profileData.lastName.trim()) {
        Alert.alert('Error', 'First name and last name are required.');
        setLoading(false);
        return;
      }

      if (!user) {
        Alert.alert('Error', 'User not found.');
        setLoading(false);
        return;
      }
      
      // Update user profile in Clerk
      await user.update({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
      });
      
      // If email was changed, update primary email
      if (profileData.email !== user.primaryEmailAddress?.emailAddress) {
        // Note: This is simplified. Clerk requires email verification
        // for changing primary email address
        Alert.alert('Email Update', 
          'Email changes require verification. Please check your email to verify the new address.');
      }
      
      // If profile image was changed
      if (newImage) {
        // Create file object from image URI
        const response = await fetch(newImage);
        const blob = await response.blob();
        
        // Upload image to Clerk
        await user.setProfileImage({
          file: blob,
        });
        
        setNewImage(null);
      }
      
      // Exit edit mode
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
      
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Reset to original data
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.primaryEmailAddress?.emailAddress || '',
        profileImage: user.imageUrl,
      });
    }
    setNewImage(null);
    setIsEditing(false);
  };

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4267B2" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        {!isEditing ? (
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => setIsEditing(true)}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.invisiblePlaceholder} />
        )}
      </View>
      
      {/* Profile Image Section */}
      <View style={styles.profileImageContainer}>
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: newImage || profileData.profileImage || 'https://placeholder.com/avatar.png' }}
            style={styles.profileImage}
          />
          {isEditing && (
            <TouchableOpacity 
              style={styles.cameraButton}
              onPress={pickImage}
            >
              <Ionicons name="camera" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.userName}>
          {profileData.firstName} {profileData.lastName}
        </Text>
      </View>
      
      {/* Profile Details Section */}
      <View style={styles.detailsCard}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>First Name</Text>
          {!isEditing ? (
            <Text style={styles.fieldValue}>{profileData.firstName}</Text>
          ) : (
            <TextInput
              style={styles.input}
              value={profileData.firstName}
              onChangeText={(text) => setProfileData({...profileData, firstName: text})}
              placeholder="First Name"
            />
          )}
        </View>
        
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Last Name</Text>
          {!isEditing ? (
            <Text style={styles.fieldValue}>{profileData.lastName}</Text>
          ) : (
            <TextInput
              style={styles.input}
              value={profileData.lastName}
              onChangeText={(text) => setProfileData({...profileData, lastName: text})}
              placeholder="Last Name"
            />
          )}
        </View>
        
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Email</Text>
          <Text style={styles.fieldValue}>{profileData.email}</Text>
          {isEditing && (
            <Text style={styles.emailNote}>
              Email can only be changed in account settings
            </Text>
          )}
        </View>
        
        {/* Account Management Section */}
        <View style={styles.accountSection}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => Alert.alert('Settings', 'Account settings would open here')}
          >
            <Ionicons name="settings-outline" size={22} color="#666" />
            <Text style={styles.menuItemText}>Account Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => Alert.alert('Password', 'Change password flow would start here')}
          >
            <Ionicons name="key-outline" size={22} color="#666" />
            <Text style={styles.menuItemText}>Change Password</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.menuItem, styles.logoutButton]}
            onPress={async () => {
              try {
                if (!user) {
                  router.replace('../login');
                  return;
                }
                await signOut();
                router.replace('../login');
              } catch (err) {
                console.error('Error signing out:', err);
              }
            }}
          >
            <Ionicons name="log-out-outline" size={22} color="#f44336" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Action Buttons */}
      {isEditing && (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
      
      {/* Extra space at bottom */}
      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7ff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  editButton: {
    padding: 8,
  },
  editButtonText: {
    color: '#4267B2',
    fontWeight: '600',
    fontSize: 16,
  },
  invisiblePlaceholder: {
    width: 40,
  },
  profileImageContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  imageWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e1e1e1',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4267B2',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    color: '#333',
  },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fafafa',
  },
  emailNote: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  accountSection: {
    marginTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  logoutButton: {
    borderBottomWidth: 0,
    marginTop: 8,
  },
  logoutText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#f44336',
    fontWeight: '500',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#4267B2',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  bottomSpace: {
    height: 40,
  },
});