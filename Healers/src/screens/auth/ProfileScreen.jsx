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

import Feather from '@expo/vector-icons/Feather';

import {
  deleteChildProfileImage,
  updateChildProfile,
} from '../../api/authApi';
import { AuthContext } from '../../context/AuthContext';
import {
  colors,
  fonts,
} from '../../styles/theme';
import {
  fontSize,
  hp,
  wp,
} from '../../utils/responsive';

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
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios"
          ? "padding"
          : "height"}
      >
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
        </ScrollView>
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (loading || uploadingImage) && styles.saveButtonDisabled,
            ]}
            disabled={loading || uploadingImage}
            onPress={handleUpdateProfile}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <Feather
                  name="check"
                  size={wp(19)}
                  color="#FFFFFF"
                />

                <Text style={styles.saveButtonText}>
                  Save Changes
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
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

  content: {
    flexGrow: 1,
    paddingHorizontal: wp(18),
    paddingTop: hp(18),
    paddingBottom: hp(25),
  },

  profileSection: {
    alignItems: "center",
    paddingVertical: hp(20),
  },

  imageWrapper: {
    position: "relative",
  },

  profileImage: {
    width: wp(100),
    height: wp(100),
    borderRadius: wp(50),
  },

  profileImageFallback: {
    width: wp(100),
    height: wp(100),
    borderRadius: wp(50),
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },

  profileImageFallbackText: {
    fontSize: fontSize(38),
    fontFamily: fonts.bold,
    color: "#2563EB",
  },

  cameraIcon: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: wp(30),
    height: wp(30),
    borderRadius: wp(15),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: wp(3),
    borderColor: "#FFFFFF",
  },

  changePhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(6),
    marginTop: hp(12),
    paddingHorizontal: wp(12),
    paddingVertical: hp(7),
    borderRadius: wp(20),
    backgroundColor: "#EFF6FF",
  },

  changePhotoText: {
    fontSize: fontSize(13),
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },

  profileName: {
    marginTop: hp(10),
    fontSize: fontSize(21),
    fontFamily: fonts.bold,
    color: "#0F172A",
  },

  profileRole: {
    marginTop: hp(3),
    fontSize: fontSize(13),
    fontFamily: fonts.regular,
    color: "#64748B",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(18),
    padding: wp(18),
    marginBottom: hp(16),
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  sectionTitle: {
    fontSize: fontSize(16),
    fontFamily: fonts.bold,
    color: "#0F172A",
    marginBottom: hp(18),
  },

  inputGroup: {
    marginBottom: hp(16),
  },

  label: {
    fontSize: fontSize(13),
    fontFamily: fonts.semiBold,
    color: "#334155",
    marginBottom: hp(7),
  },

  inputWrapper: {
    minHeight: hp(50),
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: wp(14),
    borderRadius: wp(12),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },

  input: {
    flex: 1,
    marginLeft: wp(10),
    fontSize: fontSize(14),
    fontFamily: fonts.regular,
    color: "#0F172A",
    paddingVertical: hp(6),
  },

  passwordHint: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    lineHeight: hp(18),
    color: "#64748B",
    marginTop: -hp(8),
    marginBottom: hp(17),
  },

  // FIXED BOTTOM AREA
  bottomContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: wp(18),
    paddingTop: hp(12),
    paddingBottom: Platform.OS === "ios" ? hp(20) : hp(12),
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },

  saveButton: {
    height: hp(52),
    borderRadius: wp(14),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: wp(8),
  },

  saveButtonDisabled: {
    opacity: 0.7,
  },

  saveButtonText: {
    fontSize: fontSize(14),
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    lineHeight:20
  },
});
