import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Feather,
  Ionicons,
} from '@expo/vector-icons';

import {
  getMessagesApi,
  markAsSeenApi,
  sendMessageApi,
} from '../../api/child/api';

export default function ChatDetailsScreen({ route, navigation }) {
  const {
    conversationId: initialConvId,
    receiverId,
    partnerName,
    partnerImage,
    isOnline,
    lastSeen, 
    currentUserId
  } = route.params || {};

  const [conversationId, setConversationId] = useState(initialConvId);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);

  const formatLastSeenStatus = () => {
    if (isOnline) return "Active now";
    if (!lastSeen) return "Offline";

    const date = new Date(lastSeen);
    const now = new Date();

    const isToday = date.getDate() === now.getDate()
      && date.getMonth() === now.getMonth()
      && date.getFullYear() === now.getFullYear();

    const isYesterday = date.getDate() === now.getDate() - 1
      && date.getMonth() === now.getMonth()
      && date.getFullYear() === now.getFullYear();

    const timeString = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isToday) {
      return `Last seen today at ${timeString}`;
    }
    if (isYesterday) {
      return `Last seen yesterday at ${timeString}`;
    }

    const dateString = date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });

    return `Last seen ${dateString} at ${timeString}`;
  };

  const fetchMessages = async () => {
    if (!conversationId) return;

    try {
      const res = await getMessagesApi(conversationId);
      if (res?.success) {
        setMessages(res.data || []);
        markAsSeenApi({ conversationId, userId: currentUserId });
      }
    } catch (err) {
      console.log("fetchMessages error:", err);
    }
  };

  useEffect(() => {
    if (conversationId) {
      setLoading(true);
      fetchMessages().finally(() => setLoading(false));

      const interval = setInterval(fetchMessages, 30000);
      return () => clearInterval(interval);
    }
  }, [conversationId]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText("");

    try {
      const res = await sendMessageApi({
        senderId: currentUserId,
        receiverId,
        text: textToSend,
      });

      if (res?.success) {
        if (!conversationId && res.data?.conversationId) {
          setConversationId(res.data.conversationId);
        } else {
          fetchMessages();
        }
      }
    } catch (err) {
      console.log("handleSend error:", err);
    }
  };

  const renderBubble = ({ item }) => {
    const isMe = item.sender === currentUserId;
    const timeStr = new Date(item.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <View
        style={[
          styles.bubbleWrapper,
          isMe ? styles.myBubbleWrapper : styles.theirBubbleWrapper,
        ]}
      >
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
            {item.text}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.timeText}>{timeStr}</Text>
          {isMe && (
            <Ionicons
              name={item.isSeen ? "checkmark-done" : "checkmark"}
              size={14}
              color={item.isSeen ? "#3B82F6" : "#94A3B8"}
              style={{ marginLeft: 4 }}
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.partnerInfo}>
          <View style={styles.avatarWrapper}>
            {partnerImage
              ? <Image source={{ uri: partnerImage }} style={styles.avatar} />
              : (
                <View style={[styles.avatar, styles.fallbackAvatar]}>
                  <Text style={styles.fallbackText}>
                    {partnerName ? partnerName[0].toUpperCase() : "U"}
                  </Text>
                </View>
              )}
            {isOnline && <View style={styles.onlineDot} />}
          </View>

          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.partnerName} numberOfLines={1}>
              {partnerName || "User"}
            </Text>
            {/* Dynamic Online / Last Seen status */}
            <Text
              style={[
                styles.statusText,
                { color: isOnline ? "#22C55E" : "#64748B" },
              ]}
              numberOfLines={1}
            >
              {formatLastSeenStatus()}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.infoButton}>
          <Feather name="info" size={20} color="#0284C7" />
        </TouchableOpacity>
      </View>

      {/* Keyboard Avoiding Container */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            {loading ? <ActivityIndicator size="large" color="#00528A" style={{ flex: 1 }} /> : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item._id}
                renderItem={renderBubble}
                contentContainerStyle={styles.listContainer}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
              />
            )}

            {/* Bottom Input Bar glued to keyboard top */}
            <SafeAreaView edges={["bottom"]} style={styles.inputContainerSafeArea}>
              <View style={styles.inputBar}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Type a message..."
                  placeholderTextColor="#94A3B8"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                />
                <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  partnerInfo: { flexDirection: "row", alignItems: "center", flex: 1, marginLeft: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  fallbackAvatar: { backgroundColor: "#D1E9FF", justifyContent: "center", alignItems: "center" },
  fallbackText: { color: "#00528A", fontWeight: "700", fontSize: 16 },
  avatarWrapper: { position: "relative" },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  partnerName: { fontSize: 16, fontWeight: "600", color: "#0F172A" },
  statusText: { fontSize: 11, marginTop: 1 },
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: { padding: 16, paddingBottom: 10 },
  bubbleWrapper: { marginBottom: 14, maxWidth: "80%" },
  myBubbleWrapper: { alignSelf: "flex-end", alignItems: "flex-end" },
  theirBubbleWrapper: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  myBubble: { backgroundColor: "#00528A", borderBottomRightRadius: 2 },
  theirBubble: { backgroundColor: "#FFFFFF", borderBottomLeftRadius: 2, borderWidth: 1, borderColor: "#F1F5F9" },
  messageText: { fontSize: 14, lineHeight: 20 },
  myMessageText: { color: "#FFFFFF" },
  theirMessageText: { color: "#1E293B" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  timeText: { fontSize: 11, color: "#94A3B8" },
  inputContainerSafeArea: { backgroundColor: "#FFFFFF" },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
  },
  textInput: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
    color: "#0F172A",
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: "#00528A",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
