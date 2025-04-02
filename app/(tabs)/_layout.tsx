import { Tabs } from "expo-router";
import { Entypo,Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
    return(
        <Tabs
        screenOptions={{tabBarShowLabel: false,
                headerShown:false}
        }
        >
            <Tabs.Screen name="index" options={{
            tabBarIcon: ({color,size}) => <Entypo name="chat" size={size+10} color={color} />
            }} />
            <Tabs.Screen name="search" options={{
            tabBarIcon: ({color,size}) => <Entypo name="chat" size={size+10} color={color} />,
            href: null
            }} />
            <Tabs.Screen name="chat/[chats]" options={{
            tabBarIcon: ({color,size}) => <Entypo name="chat" size={size+10} color={color} />,
            href: null
            }} />
            <Tabs.Screen name="Profile" options={{
            tabBarIcon: ({color,size}) => <Ionicons name="person-outline" size={size} color={color} />
            }}/>
        </Tabs>
    )
}