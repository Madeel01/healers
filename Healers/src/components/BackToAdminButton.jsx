import React, {
  useContext,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Ionicons from '@expo/vector-icons/Ionicons';

import { AuthContext } from '../context/AuthContext';
import { fonts } from '../styles/theme';
import {
  fontSize,
  hp,
  wp,
} from '../utils/responsive';

export default function BackToAdminButton({ currentScreen }) {
  const { isImpersonating, returnToAdmin, userRole } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const role = String(userRole || "").trim().toLowerCase();
  const insets = useSafeAreaInsets();

  if (!isImpersonating || !["child", "therapist"].includes(role)) {
    return null;
  }

  const switchBack = () => {
    if (loading) return;

    Alert.alert(
      "Back to Admin",
      "Do you want to return to your Admin account?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Switch",
          onPress: async () => {
            try {
              setLoading(true);
              await returnToAdmin();
            } catch (error) {
              Alert.alert(
                "Error",
                error?.message || "Unable to return to Admin",
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View
      style={[
        styles.floatingContainer,
        {
          bottom:
            insets.bottom +
            hp(currentScreen === "ComplaintDetails" ? 150 : 80),
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.button}
        onPress={switchBack}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
          <Ionicons
            name="arrow-undo-outline"
            size={fontSize(20)}
            color="#FFFFFF"
          />
        )}

        <Text style={styles.text}>
          {loading ? "Switching..." : "Back to Admin"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: "absolute",
    // bottom: 85,
    right: 16,
    zIndex: 9999,
    elevation: 20,
  },
  button: {
    backgroundColor: "#004E9F",
    borderRadius: 30,
    paddingHorizontal:wp(12),
    paddingVertical:hp(9),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    elevation: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  text: {
    color: "#FFFFFF",
    fontSize: fontSize(12),
    fontFamily: fonts.semiBold,
    lineHeight: 16,
  },
});
