import React, { useState, useEffect, useRef } from 'react';
import {View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform,ActivityIndicator,Alert} from 'react-native';
import { supabase } from '@/utils/supabase';
import { useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

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
          setMessages((prevMessages) => 
            prevMessages.filter(msg => msg.id !== deletedMsg.id)
          );
        }
      })
      .subscribe();

    // Clean up subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, receiverId,MessageChannel]);

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
      
      // No need to call fetchMessages() as the real-time subscription will handle this
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  // Delete a message
  const deleteMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Error deleting message:', error);
        Alert.alert('Error', 'Failed to delete message. Please try again.');
        return;
      }
      
      // No need to update state manually as real-time subscription will handle this
    } catch (error) {
      console.error('Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message. Please try again.');
    }
  };

  // Edit a message
  const updateMessage = async (id: string, updatedText: string) => {
    if (!updatedText.trim()) return;
    
    try {
      const { error } = await supabase
        .from('chats')
        .update({ chats: updatedText.trim() })
        .eq('id', id);
        
      if (error) {
        console.error('Error updating message:', error);
        Alert.alert('Error', 'Failed to update message. Please try again.');
        return;
      }
      
      // No need to update state manually as real-time subscription will handle this
    } catch (error) {
      console.error('Error updating message:', error);
      Alert.alert('Error', 'Failed to update message. Please try again.');
    }
  };

  // Render a single message
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isCurrentUser = item.sender === currentUserId;
    
    return (
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
        
        {isCurrentUser && (
          <View style={styles.messageActions}>
            <TouchableOpacity 
              onPress={() => {
                Alert.prompt(
                  'Edit Message',
                  'Edit your message',
                  [
                    {text: 'Cancel', onPress: () => console.log('Cancel Pressed'), style: 'cancel'},
                    {text: 'OK', onPress: (newText) => updateMessage(item.id, newText || "")},
                  ],
                  'plain-text',
                  item.chats
                );
              }}
              style={styles.actionButton}
            >
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                Alert.alert(
                  'Delete Message',
                  'Are you sure you want to delete this message?',
                  [
                    {
                      text: 'Cancel',
                      style: 'cancel',
                    },
                    {
                      text: 'Delete', 
                      onPress: () => deleteMessage(item.id),
                      style: 'destructive'
                    }
                  ]
                );
              }}
              style={[styles.actionButton, styles.deleteButton]}
            >
              <Text style={styles.actionText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
            <Text style={{ color: 'white',justifyContent:'center' }}><MaterialCommunityIcons name="video" size={30} color="white" /></Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ padding: 10 }}
            onPress={() => Alert.alert('Voice Call', 'Video call feature coming soon!')}
          >
            <Text style={{ color: 'white', fontSize: 20 }}><MaterialIcons name="wifi-calling-3" size={24} color="white" /></Text>
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
          <Text style={styles.sendButtonText}><FontAwesome name="send" size={24} color="white" /></Text>
        </TouchableOpacity>
      </View>
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
  messageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 5,
  },
  actionButton: {
    padding: 5,
    marginLeft: 5,
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    borderRadius: 5,
  },
  actionText: {
    fontSize: 12,
    color: 'white',
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
    paddingHorizontal: 15,
    marginLeft: 10,
  },
  disabledButton: {
    backgroundColor: '#c0c0c0',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default Chats;