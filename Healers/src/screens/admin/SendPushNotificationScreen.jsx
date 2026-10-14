import React, { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';

import { sendPushNotificationApi } from '../../api/pushNotificationApi';

export default function SendPushNotificationScreen() {
  const [userId, setUserId] = useState("6acf86f959edf247e50d182c");
  const [title, setTitle] = useState("LOL");
  const [message, setMessage] = useState("Kaam sai kra kro");
  const [loading, setLoading] = useState(false);

  const handleSendNotification = async () => {
    if (!userId.trim()) {
      Alert.alert("Validation", "Please enter receiver user ID");
      return;
    }

    if (!title.trim()) {
      Alert.alert("Validation", "Please enter notification title");
      return;
    }

    if (!message.trim()) {
      Alert.alert("Validation", "Please enter notification message");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        userId: userId.trim(),
        title: title.trim(),
        body: message.trim(),
        data: {
          screen: "Notifications",
          type: "test",
        },
      };

      console.log("Sending Push Notification:", payload);

      const response = await sendPushNotificationApi(payload);

      console.log("Push API Response:", response);

      if (response?.data?.successCount > 0) {
        Alert.alert(
          "Success",
          "Push notification sent successfully!"
        );

        setTitle("");
        setMessage("");
      } else {
        Alert.alert(
          "Notification Not Sent",
          response?.data?.message ||
            "No device received the notification."
        );
      }
    } catch (error) {
      console.log(
        "Send Push Error:",
        error?.response?.data || error?.message
      );

      Alert.alert(
        "Error",
        error?.response?.data?.message ||
          "Failed to send push notification"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>
        Send Push Notification
      </Text>

      <Text style={styles.label}>
        Receiver User ID
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Enter MongoDB user ID"
        placeholderTextColor="#999"
        value={userId}
        onChangeText={setUserId}
        autoCapitalize="none"
      />

      <Text style={styles.label}>
        Notification Title
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Enter notification title"
        placeholderTextColor="#999"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>
        Notification Message
      </Text>

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Enter notification message"
        placeholderTextColor="#999"
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[
          styles.button,
          loading && styles.disabledButton,
        ]}
        onPress={handleSendNotification}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            Send Push Notification
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#F8F9FC",
  },

  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: "#222",
    marginBottom: 30,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },

  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 15,
    color: "#222",
    marginBottom: 20,
  },

  textArea: {
    height: 120,
  },

  button: {
    backgroundColor: "#2563EB",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
