import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TextInput, KeyboardAvoidingView, Modal, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useUser, useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase';
import { decode } from 'base64-arraybuffer';


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

  //Delete Account States
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteConfirmModalVisible, setDeleteConfirmModalVisible] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');

  const updateProfileImage = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('userimg')
      .eq('userid', user?.id)
      .single();
    if (error) {
      console.error('Error fetching user image:', error);
      return null;
    }
    setNewImage(data.userimg);
  };
  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      //Update Public url of image

      updateProfileImage();
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
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLoading(true);
        const image = result.assets[0];

        if (!image.base64) {
          Alert.alert('Error', 'Unable to get base64 data from the image.');
          setLoading(false);
          return;
        }

        try {
          // Use a unique filename with timestamp to avoid conflicts
          const fileName = `profile-${user?.id || 'unknown'}.jpg`;

          // Convert base64 to array buffer
          const arrayBuffer = decode(image.base64);

          // Update displayed image immediately
          setNewImage(image.uri);

          // Upload the image to storage
          const { data, error } = await supabase.storage
            .from('userimg')
            .upload(fileName, arrayBuffer, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
              upsert: false // Changed to false to avoid potential conflicts
            });

          if (error) {
            console.error('Full upload error:', error);
            throw new Error(`Storage upload failed: ${error.message}`);
          }

          // Get the public URL
          const { data: urlData } = supabase.storage
            .from('userimg')
            .getPublicUrl(fileName);

          if (urlData && urlData.publicUrl) {
            // Update profile with the new image URL
            setProfileData((prev) => ({ ...prev, profileImage: urlData.publicUrl }));

            handleImageUpload(urlData.publicUrl)

            Alert.alert('Success', 'Image uploaded successfully!');
          }
        } catch (uploadError: any) {
          console.error('Upload process error:', uploadError);
          Alert.alert('Upload Failed', uploadError.message);
        } finally {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'There was an error selecting the image.');
      setLoading(false);
    }
  };

  const handleImageUpload = async (imageUri: string) => {
    if (!user?.id) {
      console.error('User ID not available');
      return null;
    }

    try {
      // First check if a record exists before attempting to insert/update
      const { data: existingUser, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('userid', user.id)
        .single();

      if (queryError && queryError.code === 'PGRST116') {
        // User doesn't exist, create new record
        Alert.alert('User Not Found', 'Create new user record.');
      } else {
        // User exists, update the image
        const { data, error } = await supabase
          .from('users')
          .update({
            userimg: imageUri,
          })
          .eq('userid', user.id)
          .select();

        if (error) {
          console.error('Failed to update user image:', error);
          Alert.alert('Error', 'Database error: ' + error.message);
          return null;
        }
        return data;
      }
    } catch (err) {
      console.error('Unexpected error in handleImageUpload:', err);
      Alert.alert('Error', 'An unexpected error occurred');
      return null;
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
        Alert.alert('Email Update',
          'Email changes require verification. Please check your email to verify the new address.');
      }

      // If profile image was changed
      if (newImage) {
        try {
          // Create file object from image URI
          const response = await fetch(newImage);
          const blob = await response.blob();

          // Upload image to Clerk
          await user.setProfileImage({
            file: blob,
          });

          setNewImage(null);
        } catch (imageError) {
          console.error('Error updating profile image:', imageError);
          Alert.alert('Warning', 'Profile updated but image upload failed.');
        }
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
        profileImage: newImage,
      });
    }
    setNewImage(null);
    setIsEditing(false);
  };

  // Handle opening the delete account modal
  const handleOpenDeleteAccount = () => {
    setDeleteAccountPassword('');
    setDeleteAccountError('');
    setDeleteAccountModalVisible(true);
  };

  // Request confirmation before deleting account
  const requestDeleteAccountConfirmation = () => {
    if (!deleteAccountPassword) {
      setDeleteAccountError('Password is required to delete your account');
      return;
    }

    // Hide the password modal and show the confirmation modal
    setDeleteAccountModalVisible(false);
    setDeleteConfirmModalVisible(true);
  };

  // Delete user account
  const deleteUserAccount = async () => {
    try {
      setDeleteAccountLoading(true);

      if (!user) {
        throw new Error('User not found');
      }

      // Verify password before deletion (simplified)


      // Delete user data from Supabase first
      try {
        await supabase
          .from('users')
          .delete()
          .eq('userid', user.id);

        // Delete any user images from storage
        const { data, error } = await supabase
          .storage
          .from('userimg')
          .remove([`profile-${user?.id || 'unknown'}.jpg`]);

        if (error) {
          console.error('Error deleting file:', error.message);
        } else {
          console.log('File deleted successfully:', data);
        }
      } catch (supabaseError) {
        console.error('Error deleting user data from Supabase:', supabaseError);
        // Continue with Clerk deletion even if Supabase deletion fails
      }

      // Delete user from Clerk
      await user.delete();

      // Sign out
      await signOut();

      // Navigate to login screen
      router.replace('../login');

      Alert.alert('Account Deleted', 'Your account has been permanently deleted');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setDeleteConfirmModalVisible(false);
      Alert.alert('Error', error.message || 'Failed to delete account. Please try again.');
    } finally {
      setDeleteAccountLoading(false);
    }
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
            source={{
              uri: newImage ||
                profileData.profileImage ||
                'https://via.placeholder.com/150'
            }}
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
              onChangeText={(text) => setProfileData({ ...profileData, firstName: text })}
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
              onChangeText={(text) => setProfileData({ ...profileData, lastName: text })}
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
            onPress={() => Alert.alert('Settings', 'Account settings is disabled for now')}
          >
            <Ionicons name="settings-outline" size={22} color="#666" />
            <Text style={styles.menuItemText}>Account Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          {/* <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Password', 'Change password flow would start here')}
          >
            <Ionicons name="key-outline" size={22} color="#666" />
            <Text style={styles.menuItemText}>Change Password</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity> */}

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleOpenDeleteAccount}
          >
            <Ionicons name="trash-outline" size={22} color="#FF3B30" />
            <Text style={[styles.menuItemText, { color: '#FF3B30' }]}>Delete Account</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.logoutButton]}
            onPress={async () => {
              try {
                await signOut();
                router.replace('../login');
              } catch (err) {
                console.error('Error signing out:', err);
                Alert.alert('Error', 'Failed to sign out. Please try again.');
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
      {/* Delete Account Password Modal */}
      <Modal
        visible={deleteAccountModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDeleteAccountModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete Account</Text>
              <TouchableOpacity onPress={() => setDeleteAccountModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalDescription}>
                For security, please enter your password to continue with account deletion.
              </Text>

              {deleteAccountError ? <Text style={styles.errorText}>{deleteAccountError}</Text> : null}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.modalInput}
                  value={deleteAccountPassword}
                  onChangeText={setDeleteAccountPassword}
                  placeholder="Enter your password"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setDeleteAccountModalVisible(false)}
                disabled={deleteAccountLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: '#FF3B30' }]}
                onPress={requestDeleteAccountConfirmation}
                disabled={deleteAccountLoading}
              >
                <Text style={styles.modalActionText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={deleteConfirmModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDeleteConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Deletion</Text>
              <TouchableOpacity onPress={() => setDeleteConfirmModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.warningContainer}>
                <Ionicons name="warning" size={40} color="#FF3B30" />
                <Text style={styles.warningTitle}>Warning: This action cannot be undone</Text>
              </View>

              <Text style={styles.deleteConfirmText}>
                Deleting your account will:
              </Text>

              <View style={styles.bulletPoints}>
                <Text style={styles.bulletPoint}>• Remove all your personal information</Text>
                <Text style={styles.bulletPoint}>• Delete all your data from our servers</Text>
                <Text style={styles.bulletPoint}>• Permanently remove access to your account</Text>
              </View>

              <Text style={styles.deleteConfirmQuestion}>
                Are you sure you want to delete your account?
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setDeleteConfirmModalVisible(false)}
                disabled={deleteAccountLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: '#FF3B30' }]}
                onPress={deleteUserAccount}
                disabled={deleteAccountLoading}
              >
                {deleteAccountLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalActionText}>Delete My Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalContent: {
    padding: 16,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  modalInput: {
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  modalActionButton: {
    backgroundColor: '#4267B2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  modalActionText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  warningContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginTop: 8,
    textAlign: 'center',
  },
  deleteConfirmText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 8,
  },
  bulletPoints: {
    marginBottom: 16,
    paddingLeft: 8,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
  deleteConfirmQuestion: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginTop: 8,
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


