import React, { useState, useEffect, useRef } from 'react';
import {View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform,ActivityIndicator,Alert,Pressable,Modal} from 'react-native';
import { supabase } from '@/utils/supabase';
import { useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

// Define types for our chat data
type ChatMessage = {
  id: string;
  created_at: string;
  chats: string;
  sender: string;
  receiver: string;
};

interface ChatsProps {
  currentUserId: string;
  receiverId: string;
  username?: string;
}

const Chats: React.FC<ChatsProps> = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editText, setEditText] = useState('');
  const [optionsVisible, setOptionsVisible] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const params = useLocalSearchParams();
  const currentUserId = params.currentUserId as string;
  const receiverId = params.receiverId as string;
  const username = (params.username as string) || 'User';

  // Fetch messages when component mounts or when users change
  useEffect(() => {
    fetchMessages();
    
    // Set up real-time subscription for new messages
    const channel = supabase
      .channel('chats-channel')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chats'
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        
        // Ensure the new message belongs to this conversation
        if (
          (newMsg.sender === currentUserId && newMsg.receiver === receiverId) ||
          (newMsg.sender === receiverId && newMsg.receiver === currentUserId)
        ) {
          setMessages((prevMessages) => [...prevMessages, newMsg]);
          // Scroll to bottom when new message arrives
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chats'
      }, (payload) => {
        const updatedMsg = payload.new as ChatMessage;
        
        // Update the message in our state if it belongs to this conversation
        if (
          (updatedMsg.sender === currentUserId && updatedMsg.receiver === receiverId) ||
          (updatedMsg.sender === receiverId && updatedMsg.receiver === currentUserId)
        ) {
          setMessages((prevMessages) => 
            prevMessages.map(msg => msg.id === updatedMsg.id ? updatedMsg : msg)
          );
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'chats'
      }, (payload) => {
        // For delete events, payload.old contains the deleted record
        const deletedMsg = payload.old as ChatMessage;
        
        if (
          (deletedMsg.sender === currentUserId && deletedMsg.receiver === receiverId) ||
          (deletedMsg.sender === receiverId && deletedMsg.receiver === currentUserId)
        ) {
          // Use strict equality operator for reliable filtering
          setMessages((prevMessages) => 
            prevMessages.filter(msg => msg.id !== deletedMsg.id)
          );
          
          // If the deleted message was selected, clear the selection
          if (selectedMessage && selectedMessage.id === deletedMsg.id) {
            setSelectedMessage(null);
            setOptionsVisible(false);
          }
        }
      })
      .subscribe();

    // Clean up subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, receiverId, selectedMessage]);

  // Fetch all messages between the two users
  const fetchMessages = async () => {
    setLoading(true);
    try {
      // Query messages where current user is sender and other user is receiver OR vice versa
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .or(`and(sender.eq.${currentUserId},receiver.eq.${receiverId}),and(sender.eq.${receiverId},receiver.eq.${currentUserId})`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      setMessages(data || []);
      
      // Scroll to bottom after messages load
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Send a new message
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    try {
      const newMsg = {
        chats: newMessage.trim(),
        sender: currentUserId,
        receiver: receiverId,
      };
      
      const { error } = await supabase
        .from('chats')
        .insert([newMsg]);
        
      if (error) {
        console.error('Error sending message:', error);
        Alert.alert('Error', 'Failed to send message. Please try again.');
        return;
      }
      
      // Clear input field after sending
      setNewMessage('');
      
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  // Delete a message
  const deleteMessage = async (message: ChatMessage) => {
    try {
      // Update UI immediately before the server responds
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg.id !== message.id)
      );
      
      const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', message.id);
        
      if (error) {
        console.error('Error deleting message:', error);
        // Revert the optimistic update if there was an error
        fetchMessages();
        Alert.alert('Error', 'Failed to delete message. Please try again.');
        return;
      }
      
      // Close message options after action
      setSelectedMessage(null);
      setOptionsVisible(false);
      
    } catch (error) {
      console.error('Error deleting message:', error);
      // Revert the optimistic update if there was an error
      fetchMessages();
      Alert.alert('Error', 'Failed to delete message. Please try again.');
    }
  };

  // Update a message
  const updateMessage = async () => {
    if (!editText.trim() || !selectedMessage) return;
    
    try {
      // Apply optimistic update
      const updatedMessage = {...selectedMessage, chats: editText.trim()};
      setMessages(prevMessages => 
        prevMessages.map(msg => msg.id === selectedMessage.id ? updatedMessage : msg)
      );
      
      const { error } = await supabase
        .from('chats')
        .update({ chats: editText.trim() })
        .eq('id', selectedMessage.id);
        
      if (error) {
        console.error('Error updating message:', error);
        // Revert the optimistic update
        fetchMessages();
        Alert.alert('Error', 'Failed to update message. Please try again.');
        return;
      }
      
      // Close modals after successful update
      setEditModalVisible(false);
      setOptionsVisible(false);
      setSelectedMessage(null);
      
    } catch (error) {
      console.error('Error updating message:', error);
      // Revert the optimistic update
      fetchMessages();
      Alert.alert('Error', 'Failed to update message. Please try again.');
    }
  };

  // Handle long press on a message
  const handleLongPress = (message: ChatMessage) => {
    // Only allow actions on messages sent by current user
    if (message.sender === currentUserId) {
      setSelectedMessage(message);
      setEditText(message.chats);
      setOptionsVisible(true);
    }
  };

  // Show the edit modal
  const handleEditPress = () => {
    setOptionsVisible(false);
    setEditModalVisible(true);
  };

  // Confirm deletion with dialog
  const handleDeletePress = () => {
    setOptionsVisible(false);
    
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete', 
          onPress: () => {selectedMessage && deleteMessage(selectedMessage)},
          style: 'destructive'
        }
      ]
    );
  };

  // Close all modals
  const closeAllModals = () => {
    setOptionsVisible(false);
    setEditModalVisible(false);
    setSelectedMessage(null);
  };

  // Render a single message
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isCurrentUser = item.sender === currentUserId;
    
    return (
      <Pressable
        onLongPress={() => handleLongPress(item)}
        delayLongPress={300}
        style={({ pressed }) => [
          { opacity: pressed ? 0.8 : 1 }
        ]}
      >
        <View style={[
          styles.messageContainer,
          isCurrentUser ? styles.sentMessage : styles.receivedMessage
        ]}>
          <View style={styles.messageContent}>
            <Text style={styles.messageText}>{item.chats}</Text>
            <Text style={styles.timeText}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>Chat with {username}</Text>
        <View style={{ flexDirection: 'row', position: 'absolute', right: 10 }}>
          <TouchableOpacity 
            style={{ padding: 10 }}
            onPress={() => Alert.alert('Video Call', 'Video call feature coming soon!')}
          >
            <MaterialCommunityIcons name="video" size={30} color="white" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ padding: 10 }}
            onPress={() => Alert.alert('Voice Call', 'Voice call feature coming soon!')}
          >
            <MaterialIcons name="wifi-calling-3" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0084ff" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesListContent}
        />
      )}
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          multiline
        />
        <TouchableOpacity 
          style={[
            styles.sendButton,
            !newMessage.trim() && styles.disabledButton
          ]} 
          onPress={sendMessage}
          disabled={!newMessage.trim()}
        >
          <FontAwesome name="send" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Message Options Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={optionsVisible}
        onRequestClose={closeAllModals}
      >
        <Pressable style={styles.modalOverlay} onPress={closeAllModals}>
          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.optionButton} onPress={handleEditPress}>
              <Ionicons name="pencil" size={24} color="#0084ff" />
              <Text style={styles.optionText}>Edit Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionButton} onPress={handleDeletePress}>
              <Ionicons name="trash" size={24} color="#ff3b30" />
              <Text style={[styles.optionText, styles.deleteText]}>Delete Message</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Edit Message Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.editModalContainer}>
          <View style={styles.editModalContent}>
            <Text style={styles.editModalTitle}>Edit Message</Text>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
            />
            <View style={styles.editModalButtons}>
              <TouchableOpacity 
                style={[styles.editModalButton, styles.cancelButton]} 
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.editModalButton, styles.saveButton]} 
                onPress={updateMessage}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 15,
    backgroundColor: '#0084ff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    flex: 1,
  },
  messagesListContent: {
    padding: 10,
    flexGrow: 1,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 5,
    borderRadius: 15,
    padding: 10,
  },
  sentMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#0084ff',
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1e90ff',
  },
  messageContent: {
    flexDirection: 'column',
  },
  messageText: {
    color: 'white',
    fontSize: 16,
  },
  timeText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0084ff',
    borderRadius: 25,
    width: 50,
    height: 50,
    marginLeft: 10,
  },
  disabledButton: {
    backgroundColor: '#c0c0c0',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  optionsContainer: {
    width: '70%',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionText: {
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
  },
  deleteText: {
    color: '#ff3b30',
  },
  editModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  editModalContent: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  editInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  editModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#0084ff',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default Chats;