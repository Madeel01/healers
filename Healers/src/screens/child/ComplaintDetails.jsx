import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import {
  getComplaintByIdApi,
  replyComplaintApi,
} from '../../api/child/api';
import TopBar from '../../components/TopBar';
import { AuthContext } from '../../context/AuthContext';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

export default function ComplaintDetailsScreen({
  navigation,
  route,
}) {
  const {
    user,
  } = useContext(AuthContext);

  const complaintId = route?.params?.complaintId;

  const userId = String(
    user?._id
      || user?.id
      || "",
  );

  const [
    complaint,
    setComplaint,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    replyText,
    setReplyText,
  ] = useState("");

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    keyboardVisible,
    setKeyboardVisible,
  ] = useState(false);

  const listRef = useRef(null);

  const inputRef = useRef(null);

  const fetchComplaint = useCallback(async () => {
    if (!complaintId) {
      return;
    }

    try {
      const response = await getComplaintByIdApi(
        complaintId,
      );

      if (response?.success) {
        setComplaint(
          response.data,
        );
      }
    } catch (error) {
      console.log(
        "getComplaintById error:",
        error?.response?.data
          || error?.message,
      );

      Alert.alert(
        "Error",
        error?.response?.data
          ?.message
          || "Failed to load complaint.",
      );
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

  useEffect(() => {
    fetchComplaint();
  }, [fetchComplaint]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios"
        ? "keyboardWillShow"
        : "keyboardDidShow",
      () => {
        setKeyboardVisible(true);

        setTimeout(() => {
          listRef.current?.scrollToEnd({
            animated: true,
          });
        }, 150);
      },
    );

    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios"
        ? "keyboardWillHide"
        : "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
      },
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const getSenderId = (
    sender,
  ) => {
    if (!sender) {
      return "";
    }

    if (
      typeof sender === "string"
    ) {
      return sender;
    }

    return String(
      sender._id
        || sender.id
        || "",
    );
  };

  const isOwnMessage = (
    message,
  ) =>
    getSenderId(
      message.senderId,
    ) === userId;

  const handleInputFocus = () => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({
        animated: true,
      });
    }, 300);
  };

  const handleSendReply = async () => {
    const message = replyText.trim();

    if (!message) {
      return;
    }

    if (
      message.length > 1000
    ) {
      Alert.alert(
        "Validation",
        "Reply cannot exceed 1000 characters.",
      );

      return;
    }

    try {
      setSending(true);

      const response = await replyComplaintApi(
        complaintId,
        message,
      );

      if (response?.success) {
        setReplyText("");

        await fetchComplaint();

        setTimeout(() => {
          listRef.current
            ?.scrollToEnd({
              animated: true,
            });
        }, 200);
      }
    } catch (error) {
      console.log(
        "replyComplaint error:",
        error?.response?.data
          || error?.message,
      );

      Alert.alert(
        "Error",
        error?.response?.data
          ?.message
          || "Failed to send reply.",
      );
    } finally {
      setSending(false);
    }
  };

  const formatDate = (
    date,
  ) => {
    if (!date) {
      return "";
    }

    return new Date(
      date,
    ).toLocaleString(
      "en-US",
      {
        day: "2-digit",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      },
    );
  };

  const renderMessage = ({
    item,
  }) => {
    const own = isOwnMessage(item);

    const sender = item.senderId;

    const senderName = own
      ? "You"
      : sender?.fullName
        || item.senderRole
        || "Admin";

    const profileImage = typeof sender === "object"
      ? sender?.profileImage
      : null;

    return (
      <View
        style={[
          styles.messageRow,
          own
            ? styles.ownRow
            : styles.otherRow,
        ]}
      >
        {!own && (
          profileImage
            ? (
              <Image
                source={{
                  uri: profileImage,
                }}
                style={styles.avatar}
              />
            )
            : (
              <View
                style={styles.avatarFallback}
              >
                <Text
                  style={styles.avatarText}
                >
                  {senderName
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
            )
        )}

        <View
          style={[
            styles.messageBubble,
            own
              ? styles.ownBubble
              : styles.otherBubble,
          ]}
        >
          <Text
            style={[
              styles.sender,
              own
              && styles.ownSender,
            ]}
          >
            {senderName}
          </Text>

          <Text
            style={[
              styles.message,
              own
              && styles.ownMessage,
            ]}
          >
            {item.text}
          </Text>

          <Text
            style={[
              styles.time,
              own
              && styles.ownTime,
            ]}
          >
            {formatDate(
              item.createdAt,
            )}
          </Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View
      style={styles.complaintCard}
    >
      <View
        style={styles.complaintHeader}
      >
        <View
          style={styles.complaintIcon}
        >
          <Feather
            name="message-square"
            size={20}
            color="#DC2626"
          />
        </View>

        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={styles.complaintTitle}
          >
            {complaint?.title}
          </Text>

          <Text
            style={styles.created}
          >
            {formatDate(
              complaint?.createdAt,
            )}
          </Text>
        </View>
      </View>

      <View
        style={styles.statusRow}
      >
        <View
          style={[
            styles.statusBadge,
            complaint?.status
              === "Resolved"
            && styles.resolvedBadge,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              complaint?.status
                === "Resolved"
              && styles.resolvedText,
            ]}
          >
            {complaint?.status}
          </Text>
        </View>

        <View
          style={[
            styles.priorityBadge,
            complaint?.priority
              === "High"
            && styles.highPriorityBadge,
          ]}
        >
          <Text
            style={[
              styles.priorityText,
              complaint?.priority
                === "High"
              && styles.highPriorityText,
            ]}
          >
            {complaint?.priority}
          </Text>
        </View>
      </View>

      <Text
        style={styles.descriptionLabel}
      >
        Description
      </Text>

      <Text
        style={styles.description}
      >
        {complaint?.description}
      </Text>

      {complaint?.status
            === "Resolved"
          && complaint?.resolutionNote
        ? (
          <View
            style={styles.resolutionBox}
          >
            <View
              style={styles.resolutionHeader}
            >
              <Feather
                name="check-circle"
                size={16}
                color="#047857"
              />

              <Text
                style={styles.resolutionTitle}
              >
                Resolution
              </Text>
            </View>

            <Text
              style={styles.resolutionText}
            >
              {complaint
                ?.resolutionNote}
            </Text>
          </View>
        )
        : null}

      <View
        style={styles.conversationHeader}
      >
        <Feather
          name="message-circle"
          size={17}
          color={colors.primary}
        />

        <Text
          style={styles.conversationTitle}
        >
          Conversation
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          commonStyles.container,
        ]}
      >
        <TopBar
          navigation={navigation}
          headerTitle="Complaint Details"
        />

        <View
          style={styles.loader}
        >
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!complaint) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          commonStyles.container,
        ]}
      >
        <TopBar
          navigation={navigation}
          headerTitle="Complaint Details"
        />

        <View
          style={styles.emptyContainer}
        >
          <Feather
            name="alert-circle"
            size={42}
            color="#94A3B8"
          />

          <Text
            style={styles.emptyTitle}
          >
            Complaint not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        commonStyles.container,
      ]}
    >
      <TopBar
        navigation={navigation}
        headerTitle="Complaint Details"
      />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios"
          ? "padding"
          : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={complaint?.messages
            || []}
          keyExtractor={(
            item,
            index,
          ) =>
            String(
              item._id
                || index,
            )}
          renderItem={renderMessage}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={[
            styles.listContent,
            complaint?.messages
                ?.length === 0
            && styles.emptyListContent,
          ]}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: 10,
              }}
            />
          )}
          ListEmptyComponent={
            <View
              style={styles.noMessages}
            >
              <Feather
                name="message-circle"
                size={30}
                color="#CBD5E1"
              />

              <Text
                style={styles.noMessagesTitle}
              >
                No replies yet
              </Text>

              <Text
                style={styles.noMessagesText}
              >
                Send a message to start the conversation.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios"
            ? "interactive"
            : "on-drag"}
          onContentSizeChange={() => {
            if (keyboardVisible) {
              setTimeout(() => {
                listRef.current
                  ?.scrollToEnd({
                    animated: true,
                  });
              }, 100);
            }
          }}
        />

        <View
          style={styles.replyBar}
        >
          <TextInput
            ref={inputRef}
            style={styles.replyInput}
            value={replyText}
            onChangeText={setReplyText}
            onFocus={handleInputFocus}
            placeholder="Write a reply..."
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={1000}
            textAlignVertical="center"
            blurOnSubmit={false}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,

              (
                !replyText.trim()
                || sending
              )
              && styles.disabled,
            ]}
            disabled={!replyText.trim()
              || sending}
            activeOpacity={0.8}
            onPress={handleSendReply}
          >
            {sending
              ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                />
              )
              : (
                <Feather
                  name="send"
                  size={18}
                  color="#FFFFFF"
                />
              )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  keyboardContainer: {
    flex: 1,
  },

  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },

  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#64748B",
  },

  listContent: {
    padding: 16,
    paddingBottom: 20,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  complaintCard: {
    padding: 16,
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },

  complaintHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  complaintIcon: {
    width: 44,
    height: 44,
    marginRight: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
  },

  complaintTitle: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: "#191C20",
  },

  created: {
    marginTop: 3,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "#94A3B8",
  },

  statusRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 15,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#FFF7ED",
  },

  resolvedBadge: {
    backgroundColor: "#ECFDF5",
  },

  statusText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: "#C2410C",
  },

  resolvedText: {
    color: "#047857",
  },

  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },

  highPriorityBadge: {
    backgroundColor: "#FEE2E2",
  },

  priorityText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: "#64748B",
  },

  highPriorityText: {
    color: "#DC2626",
  },

  descriptionLabel: {
    marginTop: 16,
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: "#64748B",
  },

  description: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.regular,
    color: "#334155",
  },

  resolutionBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
  },

  resolutionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  resolutionTitle: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: "#047857",
  },

  resolutionText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: "#065F46",
  },

  conversationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 25,
  },

  conversationTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#191C20",
  },

  noMessages: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },

  noMessagesTitle: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: "#64748B",
  },

  noMessagesText: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#94A3B8",
    textAlign: "center",
  },

  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },

  ownRow: {
    justifyContent: "flex-end",
  },

  otherRow: {
    justifyContent: "flex-start",
  },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 7,
  },

  avatarFallback: {
    width: 32,
    height: 32,
    marginRight: 7,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E0F2FE",
  },

  avatarText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },

  messageBubble: {
    maxWidth: "78%",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 15,
  },

  ownBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },

  otherBubble: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    borderBottomLeftRadius: 4,
  },

  sender: {
    marginBottom: 3,
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },

  ownSender: {
    color: "rgba(255,255,255,0.75)",
  },

  message: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: "#334155",
  },

  ownMessage: {
    color: "#FFFFFF",
  },

  time: {
    marginTop: 4,
    fontSize: 9,
    fontFamily: fonts.regular,
    color: "#94A3B8",
  },

  ownTime: {
    textAlign: "right",
    color: "rgba(255,255,255,0.65)",
  },

  replyBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },

  replyInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    paddingHorizontal: 15,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: 22,
    backgroundColor: "#F1F5F9",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: "#0F172A",
  },

  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },

  disabled: {
    opacity: 0.4,
  },
});
