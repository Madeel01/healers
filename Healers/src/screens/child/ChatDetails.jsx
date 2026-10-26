import React, {
  useCallback,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Feather,
  Ionicons,
} from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import {
  getConversationsLastSeen,
  getMessagesApi,
  markAsSeenApi,
  sendMessageApi,
} from '../../api/child/api';
import {
  commonStyles,
  fonts,
} from '../../styles/theme';
import {
  fontSize,
  hp,
  wp,
} from '../../utils/responsive';

export default function ChatDetailsScreen({ route, navigation }) {
  const {
    conversationId: initialConvId,
    receiverId,
    partnerName,
    partnerImage,
    isOnline,
    lastSeen,
    currentUserId,
  } = route.params || {};
  const [conversationId, setConversationId] = useState(initialConvId);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [partnerStatus, setPartnerStatus] = useState({
    isOnline: isOnline ?? false,
    lastActive: lastSeen ?? null,
  });
  const formatLastSeenStatus = () => {
    if (partnerStatus.isOnline) return "Active now";
    if (!partnerStatus.lastActive) return "Offline";

    const date = new Date(partnerStatus.lastActive);
    if (isNaN(date.getTime())) return "Offline";

    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeString = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    if (isToday) {
      return `Last seen today at ${timeString}`;
    }

    if (isYesterday) {
      return `Last seen yesterday at ${timeString}`;
    }

    const dateString = date.toLocaleDateString("en-US", {
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

      const interval = setInterval(fetchMessages, 3000);
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

  const formatMessageDate = (createdAt) => {
    if (!createdAt) return "";

    const date = new Date(createdAt);
    if (isNaN(date.getTime())) return "";

    const now = new Date();

    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const messageDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

    if (messageDay.getTime() === today.getTime()) {
      return "Today";
    }

    if (messageDay.getTime() === yesterday.getTime()) {
      return "Yesterday";
    }

    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      ...(date.getFullYear() !== now.getFullYear()
        ? { year: "numeric" }
        : {}),
    });
  };

  const renderBubble = ({ item, index }) => {
    const isMe = item.sender === currentUserId;

    const currentDate = formatMessageDate(item.createdAt);

    const previousMessage = messages[index - 1];

    const previousDate = previousMessage
      ? formatMessageDate(previousMessage.createdAt)
      : null;

    const showDateHeader = currentDate !== previousDate;

    const timeStr = new Date(item.createdAt).toLocaleTimeString(
      "en-US",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      },
    );

    return (
      <View>
        {showDateHeader && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>
              {currentDate}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.bubbleWrapper,
            isMe
              ? styles.myBubbleWrapper
              : styles.theirBubbleWrapper,
          ]}
        >
          <View
            style={[
              styles.bubble,
              isMe ? styles.myBubble : styles.theirBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isMe
                  ? styles.myMessageText
                  : styles.theirMessageText,
              ]}
            >
              {item.text}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.timeText}>{timeStr}</Text>

            {isMe && (
              <Ionicons
                name={item.isSeen ? "checkmark-done" : "checkmark"}
                size={fontSize(14)}
                color={item.isSeen ? "#3B82F6" : "#94A3B8"}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  useEffect(() => {
    const fetchConversationId = async () => {
      if (conversationId || !currentUserId || !receiverId) return;

      try {
        const res = await getConversationId(currentUserId, receiverId);

        if (res?.success && res?.conversationId) {
          setConversationId(res.conversationId);
        }
      } catch (err) {
        console.log("fetchConversationId error:", err);
      }
    };

    fetchConversationId();
  }, [conversationId, currentUserId, receiverId]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      "keyboardDidShow",
      () => setKeyboardVisible(true),
    );

    const hideSubscription = Keyboard.addListener(
      "keyboardDidHide",
      () => setKeyboardVisible(false),
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let fetching = false;

      const fetchLastSeen = async () => {
        if (!receiverId || fetching) return;

        fetching = true;

        try {
          const res = await getConversationsLastSeen(receiverId);

          if (active && res?.success && res?.data) {
            setPartnerStatus({
              isOnline: res.data.isOnline ?? false,
              lastActive: res.data.lastActive ?? null,
            });
          }
        } catch (error) {
          console.log("Last seen API error:", error);
        } finally {
          fetching = false;
        }
      };

      fetchLastSeen();

      const interval = setInterval(fetchLastSeen, 3000);

      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [receiverId]),
  );

  return (
    <View style={[styles.container, commonStyles.container]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={fontSize(20)} color="#0F172A" />
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
            {partnerStatus.isOnline && <View style={styles.onlineDot} />}
          </View>

          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.partnerName} numberOfLines={1}>
              {partnerName || "User"}
            </Text>
            <Text
              style={[
                styles.statusText,
                {
                  color: partnerStatus.isOnline ? "#22C55E" : "#64748B",
                },
              ]}
              numberOfLines={1}
            >
              {formatLastSeenStatus()}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.infoButton}>
          <Feather name="info" size={fontSize(20)} color="#0284C7" />
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

            <View
              style={[
                styles.inputContainerSafeArea,
                {
                  paddingBottom: keyboardVisible ? insets.bottom : 0,
                },
              ]}
            >
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
                  <Ionicons name="send" size={fontSize(18)} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: wp(16),
    paddingVertical: hp(12),
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: wp(36),
    height: hp(36),
    borderRadius: wp(18),
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  partnerInfo: { flexDirection: "row", alignItems: "center", flex: 1, marginLeft: 12 },
  avatar: { width: wp(40), height: hp(40), borderRadius: wp(20) },
  fallbackAvatar: { backgroundColor: "#D1E9FF", justifyContent: "center", alignItems: "center" },
  fallbackText: { color: "#00528A", fontFamily: fonts.semiBold, fontSize: fontSize(16) },
  avatarWrapper: { position: "relative" },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: wp(5),
    backgroundColor: "#22C55E",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  partnerName: { fontSize: fontSize(16), fontFamily: fonts.medium, color: "#0F172A", lineHeight: 20 },
  statusText: { fontSize: fontSize(11), marginTop: 1, lineHeight: 16 },
  infoButton: {
    width: wp(36),
    height: hp(36),
    borderRadius: wp(18),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: { padding: 16, paddingBottom: 10 },
  bubbleWrapper: { marginBottom: 14, maxWidth: "80%" },
  myBubbleWrapper: { alignSelf: "flex-end", alignItems: "flex-end" },
  theirBubbleWrapper: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { borderRadius: wp(16), paddingHorizontal: wp(14), paddingVertical: hp(10) },
  myBubble: { backgroundColor: "#00528A", borderBottomRightRadius: 2 },
  theirBubble: { backgroundColor: "#FFFFFF", borderBottomLeftRadius: 2, borderWidth: 1, borderColor: "#F1F5F9" },
  messageText: { fontSize: fontSize(14), lineHeight: 20 },
  myMessageText: { color: "#FFFFFF" },
  theirMessageText: { color: "#1E293B" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  timeText: { fontSize: fontSize(11), color: "#94A3B8" },
  inputContainerSafeArea: { backgroundColor: "#fff" },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: wp(12),
    paddingVertical: hp(8),
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
  },
  textInput: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: wp(99),
    paddingHorizontal: wp(16),
    paddingVertical: hp(8),
    minHeight: hp(44),
    maxHeight: hp(44),
    fontSize: fontSize(14),
    color: "#0F172A",
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: "#00528A",
    width: wp(44),
    height: hp(44),
    borderRadius: wp(99),
    justifyContent: "center",
    alignItems: "center",
  },

  dateSeparator: {
    alignSelf: "center",
    marginTop: hp(5),
    marginBottom: hp(5),
  },

  dateSeparatorText: {
    fontSize: fontSize(10),
    fontFamily: fonts.medium,
    color: "#475569",
    textAlign: "center",
  },
});
