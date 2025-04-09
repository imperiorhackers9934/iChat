import React, { useState, useEffect } from 'react';
import { View,Text,TextInput,FlatList,TouchableOpacity,StyleSheet,ActivityIndicator,Image} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/utils/supabase'; // Import your existing Supabase client
import { useRouter } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';

// Define types
type User = {
  userid: string;
  username: string;
  avatar_url?: string;
  full_name?: string;
  last_seen?: string;
};

interface UserSearchChatProps {
  currentUserId: string;
}

const Search: React.FC<UserSearchChatProps> = () => {
  const { currentUserId } = useLocalSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  // Fetch all users when component mounts
  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(
        user => 
          user.username?.toLowerCase().includes(query) || 
          user.full_name?.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  // Fetch all users except current user
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('userid', currentUserId);

      if (error) {
        console.error('Error fetching users:', error);
        return;
      }

      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };


  // Navigate to chat screen with selected user
  const startChat = (userId: string, username: string) => {
    // @ts-ignore - Suppressing type error since we're using a dynamic route
    router.push({ pathname: "/chat/[chats]", params: { 
      username: username,
      receiverId: userId,
      currentUserId: currentUserId
    } });
  };

  // Render a single user item
  const renderUserItem = ({ item }: { item: User }) => {
    
    return (
      <TouchableOpacity 
        style={styles.userItem}
        onPress={() => startChat(item.userid , item.username)}
      >
        <View style={styles.avatarContainer}>
          {item.avatar_url ? (
            <Image 
              source={{ uri: item.avatar_url }} 
              style={styles.avatar} 
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {item.username?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.username}>{item.username}</Text>
          {item.full_name && (
            <Text style={styles.fullName}>{item.full_name}</Text>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.chatButton}
          onPress={() => startChat(item.userid, item.username)}
        >
          <Ionicons name="chatbubble-outline" size={24} color="#0084ff" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0084ff" />
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people" size={50} color="#ccc" />
          <Text style={styles.emptyText}>
            {searchQuery ? "No users found" : "No users available"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.userid}
          contentContainerStyle={styles.listContainer}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 10,
    paddingHorizontal: 15,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: 10,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
  },
  avatarContainer: {
    marginRight: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0084ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  fullName: {
    fontSize: 14,
    color: '#666',
  },
  lastChat: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  chatButton: {
    padding: 10,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 5,
  },
});

export default Search;