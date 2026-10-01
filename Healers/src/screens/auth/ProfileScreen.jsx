import React, {
  useContext,
  useRef,
  useState,
} from 'react';

import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import {
  deleteChildProfileImage,
  updateChildProfile,
} from '../../api/authApi';
import { AuthContext } from '../../context/AuthContext';
import { colors } from '../../styles/theme';

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export default function ChildProfileScreen({ navigation }) {
  const { user, updateUser } = useContext(AuthContext);
  const scrollViewRef = useRef(null);

  const [fullName, setFullName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [profileImage, setProfileImage] = useState(
    user?.profileImage || "",
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleInputFocus = (event) => {
    const input = event?.target;

    setTimeout(() => {
      if (!input || !scrollViewRef.current) {
        return;
      }

      input.measureInWindow((x, y, width, height) => {
        const targetY = Math.max(y - 120, 0);

        scrollViewRef.current.scrollTo({
          y: targetY,
          animated: true,
        });
      });
    }, 300);
  };

  const uploadToCloudinary = async (uri) => {
    try {
      setUploadingImage(true);

      if (!uri) {
        throw new Error("Image URI is required.");
      }

      const file = new File(uri);

      console.log("Image exists:", file.exists);
      console.log("Image type:", file.type);
      console.log(
        "Image size MB:",
        (file.size / (1024 * 1024)).toFixed(2),
      );

      if (!file.exists) {
        throw new Error("Image file does not exist.");
      }
      console.log("CLOUDINARY_CLOUD_NAME", CLOUDINARY_CLOUD_NAME);
      const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

      const formData = new FormData();

      formData.append("file", file);
      formData.append(
        "upload_preset",
        CLOUDINARY_UPLOAD_PRESET,
      );

      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      console.log("Cloudinary image status:", response.status);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message || "Image upload failed.",
        );
      }

      if (!data?.secure_url) {
        throw new Error("Cloudinary did not return image URL.");
      }

      console.log(
        "Cloudinary image upload successful:",
        data.secure_url,
      );

      setProfileImage(data.secure_url);

      return data.secure_url;
    } catch (error) {
      console.log(
        "Cloudinary upload error:",
        error?.message || error,
      );

      Alert.alert(
        "Upload Failed",
        error?.message || "Unable to upload profile image.",
      );

      return null;
    } finally {
      setUploadingImage(false);
    }
  };
  const handleDeleteProfileImage = () => {
    if (!profileImage) {
      return;
    }

    Alert.alert(
      "Delete Profile Photo",
      "Are you sure you want to remove your profile photo?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: deleteProfileImage,
        },
      ],
    );
  };
  const deleteProfileImage = async () => {
    try {
      setUploadingImage(true);

      const response = await deleteChildProfileImage();

      if (!response?.success) {
        throw new Error(
          response?.message || "Failed to delete profile image",
        );
      }

      setProfileImage("");

      if (response.user) {
        await updateUser(response.user);
      }

      Alert.alert(
        "Success",
        "Profile photo removed successfully.",
      );
    } catch (error) {
      console.log(
        "Delete profile image error:",
        error?.response?.data || error?.message,
      );

      Alert.alert(
        "Error",
        error?.response?.data?.message
          || error?.message
          || "Failed to remove profile photo.",
      );
    } finally {
      setUploadingImage(false);
    }
  };
  const openImageOptions = () => {
    const options = [
      {
        text: "Take Photo",
        onPress: takePhoto,
      },
      {
        text: "Choose from Gallery",
        onPress: chooseFromGallery,
      },
    ];

    if (profileImage) {
      options.push({
        text: "Remove Photo",
        onPress: handleDeleteProfileImage,
        style: "destructive",
      });
    }

    options.push({
      text: "Cancel",
      style: "cancel",
    });

    Alert.alert(
      "Profile Photo",
      "Choose an option",
      options,
    );
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Camera permission is required to take a profile photo.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    await uploadToCloudinary(result.assets[0].uri);
  };

  const chooseFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Gallery permission is required to select a profile photo.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    await uploadToCloudinary(result.assets[0].uri);
  };

  const handleUpdateProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert("Error", "Full name is required");
      return;
    }

    const trimmedEmail = email.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert(
        "Validation Error",
        "Please enter a valid email address.",
      );
      return;
    }

    const trimmedPhone = phone.trim();

    const phoneRegex = /^(030\d{8}|\+923\d{9})$/;

    if (!phoneRegex.test(trimmedPhone)) {
      Alert.alert(
        "Validation Error",
        "Phone number must be in 03011234567 or +923011234567 format.",
      );
      return;
    }

    const normalizedPhone = trimmedPhone.startsWith("+92")
      ? `0${trimmedPhone.slice(3)}`
      : trimmedPhone;

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

    if (password.trim() && !passwordRegex.test(password.trim())) {
      Alert.alert(
        "Validation Error",
        "Password must be at least 8 characters and contain 1 lowercase, 1 uppercase, and 1 special character.",
      );
      return;
    }

    try {
      setLoading(true);

      const response = await updateChildProfile({
        fullName: fullName.trim(),
        email: trimmedEmail,
        phone: normalizedPhone,
        profileImage: profileImage.trim(),
        password: password.trim(),
      });

      if (!response?.success) {
        Alert.alert(
          "Error",
          response?.message || "Failed to update profile",
        );
        return;
      }

      await updateUser(response.user);

      Alert.alert(
        "Success",
        "Profile updated successfully",
        [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (error) {
      console.log(
        "update profile error:",
        error?.response?.data || error?.message,
      );

      Alert.alert(
        "Error",
        error?.response?.data?.message
          || "Failed to update profile",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios"
          ? "padding"
          : "height"}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather
              name="arrow-left"
              size={22}
              color="#0F172A"
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            My Profile
          </Text>

          <View
            style={styles.headerSpacer}
          />
        </View>

        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* PROFILE */}
          <View
            style={styles.profileSection}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={openImageOptions}
              disabled={uploadingImage}
            >
              <View
                style={styles.imageWrapper}
              >
                {profileImage
                  ? (
                    <Image
                      source={{
                        uri: profileImage,
                      }}
                      style={styles.profileImage}
                    />
                  )
                  : (
                    <View
                      style={styles.profileImageFallback}
                    >
                      <Text
                        style={styles.profileImageFallbackText}
                      >
                        {(fullName || "User")
                          .trim()
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                  )}

                <View
                  style={styles.cameraIcon}
                >
                  {uploadingImage
                    ? (
                      <ActivityIndicator
                        size="small"
                        color="#FFFFFF"
                      />
                    )
                    : (
                      <Feather
                        name="camera"
                        size={15}
                        color="#FFFFFF"
                      />
                    )}
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.changePhotoButton}
              onPress={openImageOptions}
              disabled={uploadingImage}
            >
              <Feather
                name="camera"
                size={15}
                color={colors.primary}
              />

              <Text
                style={styles.changePhotoText}
              >
                {uploadingImage
                  ? "Uploading..."
                  : "Change Profile Photo"}
              </Text>
            </TouchableOpacity>

            <Text
              style={styles.profileName}
            >
              {fullName || "Your Name"}
            </Text>

            <Text
              style={styles.profileRole}
            >
              {user?.role || "Child"}
            </Text>
          </View>

          {/* PERSONAL INFORMATION */}
          <View style={styles.card}>
            <Text
              style={styles.sectionTitle}
            >
              Personal Information
            </Text>

            {/* FULL NAME */}
            <View
              style={styles.inputGroup}
            >
              <Text style={styles.label}>
                Full Name
              </Text>

              <View
                style={styles.inputWrapper}
              >
                <Feather
                  name="user"
                  size={18}
                  color="#94A3B8"
                />

                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter full name"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                  onFocus={handleInputFocus}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* EMAIL */}
            <View
              style={styles.inputGroup}
            >
              <Text style={styles.label}>
                Email
              </Text>

              <View
                style={styles.inputWrapper}
              >
                <Feather
                  name="mail"
                  size={18}
                  color="#94A3B8"
                />

                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter email"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                  onFocus={handleInputFocus}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* PHONE */}
            <View
              style={styles.inputGroup}
            >
              <Text style={styles.label}>
                Phone
              </Text>

              <View
                style={styles.inputWrapper}
              >
                <Feather
                  name="phone"
                  size={18}
                  color="#94A3B8"
                />

                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter phone"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  style={styles.input}
                  onFocus={handleInputFocus}
                  returnKeyType="next"
                />
              </View>
            </View>
          </View>

          {/* CHANGE PASSWORD */}
          <View style={styles.card}>
            <Text
              style={styles.sectionTitle}
            >
              Change Password
            </Text>

            <Text
              style={styles.passwordHint}
            >
              Leave this empty if you don't want to change your password.
            </Text>

            <View
              style={styles.inputGroup}
            >
              <Text style={styles.label}>
                New Password
              </Text>

              <View
                style={styles.inputWrapper}
              >
                <Feather
                  name="lock"
                  size={18}
                  color="#94A3B8"
                />

                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter new password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  onFocus={handleInputFocus}
                  returnKeyType="done"
                />

                <TouchableOpacity
                  onPress={() =>
                    setShowPassword(
                      value => !value,
                    )}
                >
                  <Feather
                    name={showPassword
                      ? "eye-off"
                      : "eye"}
                    size={19}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* SAVE */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              (loading
                || uploadingImage)
              && styles.saveButtonDisabled,
            ]}
            disabled={loading || uploadingImage}
            onPress={handleUpdateProfile}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <Feather
                  name="check"
                  size={19}
                  color="#FFFFFF"
                />

                <Text
                  style={styles.saveButtonText}
                >
                  Save Changes
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  header: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },

  headerSpacer: {
    width: 40,
  },

  content: {
    padding: 18,
    paddingBottom: 35,
  },

  profileSection: {
    alignItems: "center",
    paddingVertical: 20,
  },

  imageWrapper: {
    position: "relative",
  },

  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },

  profileImageFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },

  profileImageFallbackText: {
    fontSize: 38,
    fontWeight: "700",
    color: "#2563EB",
  },

  cameraIcon: {
    position: "absolute",
    right: 0,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },

  changePhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
  },

  changePhotoText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },

  profileName: {
    marginTop: 10,
    fontSize: 21,
    fontWeight: "700",
    color: "#0F172A",
  },

  profileRole: {
    marginTop: 3,
    fontSize: 13,
    color: "#64748B",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 18,
  },

  inputGroup: {
    marginBottom: 16,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 7,
  },

  inputWrapper: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },

  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: "#0F172A",
  },

  passwordHint: {
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
    marginTop: -8,
    marginBottom: 17,
  },

  saveButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  saveButtonDisabled: {
    opacity: 0.7,
  },

  saveButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
