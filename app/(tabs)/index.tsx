import React, { useEffect, useState } from 'react';
import {View,Text,FlatList,Image,TouchableOpacity,StyleSheet,SafeAreaView,StatusBar,TextInput,ActivityIndicator, Alert} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '@/utils/supabase';

// Define interfaces for our data
interface ChatUser {
  id: string;
  userid: string;
  username: string;
  isactive: boolean;
  userimg?: string;
  lastMessage?: string;
  timestamp?: string;
  unread?: number;
  online?: boolean;
}

interface ChatMessage {
  id: string;
  created_at: string;
  chats: string;
  sender: string;
  receiver: string;
}

export default function Index() {
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const defaultAvatar = require('@/assets/images/avatar.png');
  
  // Add Data to Supabase Database
  const addData = async (userId: string, username: string) => {
    const muser = { 
      userid: userId,
      username: username,
      userimg:'https://hximboiknruyncrgrqjk.supabase.co/storage/v1/object/public/userimg//avatar.png',
      isactive: true
    };
    
    const { data, error } = await supabase
      .from('users')
      .insert([muser])
      .select();
    
    if (error) {
      console.error('Error inserting data:', error);
    } else {
      console.log('Data added successfully:', data);
    }
  };

  // Check if User Exists or not in Supabase Database
  useEffect(() => {
    if (isSignedIn) {
      const checkAndAddUser = async () => {
        const { data: existingUser, error } = await supabase
          .from('users')
          .select('userid')
          .eq('userid', user.id)
          .single();

        if (error || !existingUser) {
          await addData(user.id, user.username || user.id);
        }
      };
      checkAndAddUser();
    }
  }, [isSignedIn, user]);

  // Fetch chat users that the current user has interacted with
  useEffect(() => {
    if (isSignedIn) {
      fetchChatUsers();
      
      // Set up real-time subscription for new messages
      const channel = supabase
        .channel('chats-changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'chats',
          filter: `sender=eq.${user.id}` 
        }, () => {
          // Refresh the chat users when there are changes
          fetchChatUsers();
        })
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'chats',
          filter: `receiver=eq.${user.id}` 
        }, () => {
          // Refresh the chat users when there are changes
          fetchChatUsers();
        })
        .subscribe();

      // Clean up subscription on component unmount
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isSignedIn, user]);

  // Fetch users that the current user has chatted with
  const fetchChatUsers = async () => {
    if (!isSignedIn) return;
    
    setLoading(true);
    try {
      // Get all chats where current user is either sender or receiver
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .or(`sender.eq.${user.id},receiver.eq.${user.id}`)
        .order('created_at', { ascending: false });
      
      if (chatError) {
        Alert.alert('Error fetching chats:', `${chatError}`);
        setLoading(false);
        return;
      }
      
      if (!chatData || chatData.length === 0) {
        setChatUsers([]);
        setLoading(false);
        return;
      }
      
      // Extract unique user IDs from chat data (excluding the current user)
      const uniqueUserIds = new Set<string>();
      chatData.forEach((chat: ChatMessage) => {
        if (chat.sender === user.id) {
          uniqueUserIds.add(chat.receiver);
        } else if (chat.receiver === user.id) {
          uniqueUserIds.add(chat.sender);
        }
      });
      
      // Fetch user details for all users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .in('userid', Array.from(uniqueUserIds));
      
      if (userError) {
        Alert.alert('Error fetching users:', `${userError}`);
        setLoading(false);
        return;
      }
      
      // Process the user data and add chat information
      const processedUsers = await Promise.all(userData.map(async (user: ChatUser) => {
        // Find the latest message for this user
        const latestChat = chatData.find((chat: ChatMessage) => 
          (chat.sender === user.userid && chat.receiver === user.id) || 
          (chat.sender === user.id && chat.receiver === user.userid)
        );
        
        // Count unread messages
        const { data: unreadData, error: unreadError } = await supabase
          .from('chats')
          .select('*')
          .eq('sender', user.userid)
          .eq('receiver', user.id)
          
        const unreadCount = unreadError ? 0 : (unreadData?.length || 0);
        
        return {
          ...user,
          lastMessage: latestChat ? latestChat.chats : '',
          timestamp: latestChat ? formatTimestamp(latestChat.created_at) : '',
          unread: unreadCount,
          online: user.isactive
        };
      }));
      
      setChatUsers(processedUsers);
    } catch (error) {
      console.error('Error in fetchChatUsers:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Format timestamp to a user-friendly string
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      // Today - show time
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays === 1) {
      // Yesterday
      return 'Yesterday';
    } else if (diffInDays < 7) {
      // Within last week - show day name
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      // Older - show date
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Filter users based on search query
  const filteredUsers = chatUsers.filter((chatUser) => 
    chatUser.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Navigate to chat detail
  const navigateToChatDetail = (userId: string, username: string) => {
    if (!isSignedIn) return;
    
    router.push({
      pathname: '/chat/[chats]',
      params: {
        chats: userId,
        currentUserId: user.id,
        receiverId: userId,
        username: username
      }
    });
  };

  // Render item for FlatList
  const renderChatUser = ({ item }: { item: ChatUser }) => (
    <TouchableOpacity 
      style={styles.userItem}
      onPress={() => navigateToChatDetail(item.userid, item.username)}
    >
      <View style={styles.avatarContainer}>
        <Image 
          source={item.userimg ? { uri: item.userimg } : defaultAvatar} 
          style={styles.avatar} 
          defaultSource={defaultAvatar}
        />
        {item.online && <View style={styles.onlineIndicator} />}
      </View>
      
      <View style={styles.userInfo}>
        <View style={styles.nameTimeRow}>
          <Text style={styles.userName}>{item.username}</Text>
          <Text style={styles.timeStamp}>{item.timestamp || ''}</Text>
        </View>
        
        <View style={styles.messageRow}>
          <Text 
            style={[
              styles.lastMessage, 
              (item.unread || 0) > 0 && styles.unreadMessage
            ]}
            numberOfLines={1}
          >
            {item.lastMessage || 'Start a conversation'}
          </Text>
          
          {(item.unread || 0) > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // ListEmptyComponent for FlatList
  const EmptyListComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubble-ellipses-outline" size={60} color="#d1d5db" />
      <Text style={styles.emptyText}>No chats found</Text>
      <Text style={styles.emptySubText}>
        {searchQuery 
          ? 'Try a different search term' 
          : loading 
            ? 'Loading your conversations...' 
            : 'Start a conversation with friends'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>iChat</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton}>
              <Text style={styles.version}>v1.0.0</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>
      
      {/* Chat List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4267B2" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.userid}
          renderItem={renderChatUser}
          contentContainerStyle={filteredUsers.length === 0 ? {flex: 1} : {paddingBottom: 80}}
          ListEmptyComponent={EmptyListComponent}
          showsVerticalScrollIndicator={false}
          onRefresh={fetchChatUsers}
          refreshing={loading}
        />
      )}
      
      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => router.push({
          pathname: '/search', 
          params: {currentUserId: isSignedIn ? user.id : null}
        })}
      >
        <Ionicons name="chatbubbles" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7ff',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4267B2',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 20,
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  userItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e5e7eb',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  timeStamp: {
    fontSize: 12,
    color: '#6b7280',
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280',
  },
  unreadMessage: {
    fontWeight: '500',
    color: '#374151',
  },
  unreadBadge: {
    backgroundColor: '#4267B2',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4b5563',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  version: {
    color: '#4267B2',
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4267B2',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4267B2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
});