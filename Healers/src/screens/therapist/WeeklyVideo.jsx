import React, {
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import {
  useVideoPlayer,
  VideoView,
} from 'expo-video';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  deleteWeeklyVideoApi,
  getChildVideosApi,
  therapistUsers,
} from '../../api/therapist/api';
import TherapistBottomBar from '../../components/TherapistBottomBar';
import TopBar from '../../components/TopBar';
import { AuthContext } from '../../context/AuthContext';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const CloudinaryVideoPlayer = ({ uri }) => {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={{
        width: "100%",
        height: 300,
        backgroundColor: "#000",
      }}
      nativeControls
      contentFit="contain"
    />
  );
};

export default function WeeklyVideoScreen({ navigation }) {
  const { user } = useContext(AuthContext);

  const cameraRef = useRef(null);
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [demoVideoModal, setDemoVideoModal] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [
    cameraPermission,
    requestCameraPermission,
  ] = useCameraPermissions();
  const [
    audioPermission,
    requestAudioPermission,
  ] = useMicrophonePermissions();
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("back");
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef(null);
  const MAX_VIDEO_SIZE = 30 * 1024 * 1024;
  useEffect(() => {
    fetchChildren();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      // fetchVideos(selectedChildId);
    }
  }, [selectedChildId]);

  const fetchChildren = async () => {
    try {
      setLoadingChildren(true);

      const ID = user?.id;

      const responseData = await therapistUsers({
        filter: ID,
      });

      const fetchedUsers = responseData?.data || [];

      setChildren(fetchedUsers);

      if (
        fetchedUsers.length > 0
        && !selectedChildId
      ) {
        const initialChildId = fetchedUsers[0]._id
          || fetchedUsers[0].id;

        setSelectedChildId(initialChildId);
      }
    } catch (error) {
      console.error(
        "Error fetching children:",
        error,
      );
    } finally {
      setLoadingChildren(false);
    }
  };

  const fetchVideos = async (childId) => {
    if (!childId) {
      return;
    }

    try {
      setLoading(true);

      const response = await getChildVideosApi(childId);

      console.log(
        "Videos response:",
        response,
      );

      if (response?.success) {
        setVideos(response.data || []);
      } else {
        setVideos([]);
      }
    } catch (error) {
      console.error(
        "Fetch videos error:",
        error,
      );

      Alert.alert(
        "Error",
        "Could not load videos for selected child.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVideo = async (videoId) => {
    if (!videoId) {
      return;
    }

    Alert.alert(
      "Delete Video",
      "Are you sure you want to delete this video?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await deleteWeeklyVideoApi(
                videoId,
              );

              if (response?.success) {
                setVideos((prev) =>
                  prev.filter(
                    (item) =>
                      item._id !== videoId
                      && item.id !== videoId,
                  )
                );

                Alert.alert(
                  "Success",
                  "Video deleted successfully.",
                );
              }
            } catch (error) {
              console.error(
                "Delete video error:",
                error,
              );

              Alert.alert(
                "Error",
                "Failed to delete video.",
              );
            }
          },
        },
      ],
    );
  };

  const handleOpenRecordModal = async () => {
    try {
      let cameraGranted = cameraPermission?.granted;

      let audioGranted = audioPermission?.granted;

      if (!cameraGranted) {
        const result = await requestCameraPermission();

        cameraGranted = result?.granted;
      }

      if (!audioGranted) {
        const result = await requestAudioPermission();

        audioGranted = result?.granted;
      }

      if (!cameraGranted) {
        Alert.alert(
          "Camera Permission",
          "Please allow camera access to record video.",
        );

        return;
      }

      if (!audioGranted) {
        Alert.alert(
          "Microphone Permission",
          "Please allow microphone access so your recorded video can contain audio.",
        );

        return;
      }

      setRecordModalVisible(true);
    } catch (error) {
      console.error(
        "Permission error:",
        error,
      );

      Alert.alert(
        "Permission Error",
        "Could not request camera/microphone permission.",
      );
    }
  };

  const handleStartRecording = async () => {
    if (!cameraRef.current) {
      return;
    }

    if (isRecording) {
      return;
    }

    try {
      setIsRecording(true);

      console.log(
        "Starting video recording...",
      );

      const recordedVideo = await cameraRef.current.recordAsync({
        maxDuration: 60,
      });

      console.log(
        "Recorded video:",
        recordedVideo,
      );

      setIsRecording(false);

      if (recordedVideo?.uri) {
        console.log(
          "Uploading recorded video:",
          recordedVideo.uri,
        );

        await handleUploadAndSave(
          recordedVideo.uri,
          "Live Session",
        );
      } else {
        Alert.alert(
          "Recording Error",
          "No video file was returned.",
        );
      }
    } catch (error) {
      console.error(
        "Recording Error:",
        error,
      );

      setIsRecording(false);

      Alert.alert(
        "Recording Error",
        error?.message
          || "Failed to record video.",
      );
    }
  };

  const handleStopRecording = () => {
    if (
      cameraRef.current
      && isRecording
    ) {
      cameraRef.current.stopRecording();
    }
  };
  const startRecordingTimer = () => {
    setRecordingSeconds(0);

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const checkVideoSize = async (fileUri) => {
    try {
      const file = new File(fileUri);

      if (!file.exists) {
        throw new Error("Video file does not exist.");
      }

      const size = file.size || 0;

      console.log("Video size:", size);
      console.log(
        "Video size MB:",
        (size / (1024 * 1024)).toFixed(2),
      );

      if (size > MAX_VIDEO_SIZE) {
        Alert.alert(
          "Video Too Large",
          `This video is ${
            (size / (1024 * 1024)).toFixed(
              2,
            )
          } MB.\n\nMaximum allowed size is 30 MB.`,
          [{ text: "OK" }],
        );

        return false;
      }

      return true;
    } catch (error) {
      console.error("Video size check error:", error);

      Alert.alert(
        "Error",
        "Unable to check the video size.",
      );

      return false;
    }
  };

  const formatRecordingTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${
      String(
        remainingSeconds,
      ).padStart(2, "0")
    }`;
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const formatDuration = (seconds) => {
    if (
      seconds === undefined
      || seconds === null
      || isNaN(seconds)
    ) {
      return "00:00";
    }

    const totalSeconds = Math.floor(Number(seconds));

    const minutes = Math.floor(totalSeconds / 60);

    const remainingSeconds = totalSeconds % 60;

    return `${
      String(minutes).padStart(
        2,
        "0",
      )
    }:${
      String(
        remainingSeconds,
      ).padStart(2, "0")
    }`;
  };

  // const handleUploadAndSave = async (
  //   localUri,
  //   tag = "Live Session",
  // ) => {
  //   if (!localUri) {
  //     Alert.alert(
  //       "Error",
  //       "Video file is missing.",
  //     );

  //     return;
  //   }

  //   if (!selectedChildId) {
  //     Alert.alert(
  //       "Select Child",
  //       "Please select a child first.",
  //     );

  //     return;
  //   }

  //   try {
  //     setUploading(true);

  //     console.log(
  //       "Uploading video:",
  //       localUri,
  //     );

  //     const result = await uploadToCloudinaryFileSystem(
  //       localUri,
  //       "video",
  //     );

  //     console.log(
  //       "Cloudinary result:",
  //       result,
  //     );

  //     if (!result?.secure_url) {
  //       throw new Error(
  //         "Cloudinary did not return a video URL.",
  //       );
  //     }

  //     const payload = {
  //       childId: selectedChildId,

  //       tag: tag,

  //       duration: formatDuration(
  //         result.duration,
  //       ),

  //       videoUrl: result.secure_url,

  //       cloudinaryPublicId: result.public_id,

  //       cloudinaryResourceType: result.resource_type,

  //       videoFormat: result.format,

  //       width: result.width,

  //       height: result.height,

  //       durationSeconds: result.duration,
  //     };

  //     console.log(
  //       "Video payload:",
  //       payload,
  //     );

  //     /*
  //     const response =
  //       await createWeeklyVideoApi(payload);

  //     console.log(
  //       "Create video response:",
  //       response
  //     );

  //     if (!response?.success) {
  //       throw new Error(
  //         response?.message ||
  //           "Failed to save video."
  //       );
  //     }
  //     */

  //     setRecordModalVisible(false);

  //     // await fetchVideos(
  //     //   selectedChildId,
  //     // );

  //     Alert.alert(
  //       "Success",
  //       "Video uploaded successfully.",
  //     );
  //   } catch (error) {
  //     console.error(
  //       "Upload/save error:",
  //       error,
  //     );

  //     Alert.alert(
  //       "Upload Failed",
  //       error?.message
  //         || "Cloudinary upload failed.",
  //     );
  //   } finally {
  //     setUploading(false);
  //     setIsRecording(false);
  //   }
  // };

  const handleUploadAndSave = async (
    videoUri,
    tag = "Live Session",
  ) => {
    try {
      if (!videoUri) {
        Alert.alert("Error", "Video file not found.");
        return false;
      }

      // --------------------------------
      // CHECK VIDEO SIZE BEFORE UPLOAD
      // --------------------------------
      const isValidSize = await checkVideoSize(videoUri);

      if (!isValidSize) {
        console.log("Video rejected because it is larger than 30 MB.");
        return false;
      }

      setUploading(true);

      console.log("Uploading video:", videoUri);

      // --------------------------------
      // CLOUDINARY UPLOAD
      // --------------------------------
      const result = await uploadToCloudinaryFileSystem(
        videoUri,
        "video",
      );

      if (!result?.secure_url) {
        throw new Error("Cloudinary upload failed.");
      }

      console.log(
        "Cloudinary upload successful:",
        result.secure_url,
      );

      // --------------------------------
      // CREATE PAYLOAD
      // --------------------------------
      const payload = {
        childId: selectedChildId,
        tag,
        duration: result.duration
          ? formatDuration(result.duration)
          : "00:00",

        videoUrl: result.secure_url,

        cloudinaryPublicId: result.public_id,
        cloudinaryResourceType: result.resource_type,

        videoFormat: result.format,

        width: result.width,
        height: result.height,

        fileSize: result.bytes,
      };

      console.log("Video payload:", payload);

      // --------------------------------
      // SAVE TO BACKEND
      // --------------------------------

      const response = await createWeeklyVideoApi(payload);

      if (!response?.success) {
        throw new Error("Failed to save video.");
      }

      // Refresh videos
      await fetchVideos(selectedChildId);

      Alert.alert(
        "Success",
        "Video uploaded successfully.",
      );

      return true;
    } catch (error) {
      console.error("Upload/save error:", error);

      Alert.alert(
        "Upload Failed",
        error?.message || "Unable to upload video.",
      );

      return false;
    } finally {
      setUploading(false);
    }
  };
  
  const handlePickVideo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow access to your videos.",
        );

        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync(
        {
          mediaTypes: ["videos"],
          allowsEditing: false,
          quality: 1,
        },
      );

      if (result.canceled) {
        return;
      }

      const selectedVideo = result.assets?.[0];

      if (!selectedVideo?.uri) {
        Alert.alert(
          "Error",
          "Could not get selected video.",
        );

        return;
      }

      console.log(
        "Selected video:",
        selectedVideo,
      );

      await handleUploadAndSave(
        selectedVideo.uri,
        "Uploaded Video",
      );
    } catch (error) {
      console.error(
        "Pick video error:",
        error,
      );

      Alert.alert(
        "Error",
        error?.message
          || "Could not select video.",
      );
    }
  };

  const handleOpenDemoVideo = (
    video = null,
  ) => {
    const targetVideo = video || videos[0];

    if (!targetVideo?.videoUrl) {
      Alert.alert(
        "No Video",
        "There is no uploaded video available.",
      );

      return;
    }

    setActiveVideo(
      targetVideo,
    );

    setDemoVideoModal(true);
  };

  const handleFlipCamera = () => {
    setCameraFacing(
      (prev) =>
        prev === "back"
          ? "front"
          : "back",
    );
  };

  const filteredModalChildren = children?.filter((child) => {
    const childName = child?.fullName
      ?? child?.name
      ?? "";

    return childName
      .toLowerCase()
      .includes(
        modalSearch
          .toLowerCase()
          .trim(),
      );
  });

  const onRefresh = async () => {
    try {
      setRefreshing(true);

      await fetchChildren();

      if (selectedChildId) {
        // await fetchVideos(
        //   selectedChildId,
        // );
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.mainContainer,
        commonStyles.container,
      ]}
    >
      <TopBar
        navigation={navigation}
        headerTitle="Weekly Video"
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#004E9F"]}
            tintColor="#004E9F"
          />
        }
      >
        {/* HEADER */}

        <View
          style={styles.headerBanner}
        >
          <Text
            style={styles.bannerTitle}
          >
            Weekly Video Updates
          </Text>
        </View>

        <View
          style={styles.childHeaderRow}
        >
          <Text
            style={styles.sectionHeaderTitle}
          >
            Select Child
          </Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setModalVisible(true)}
          >
            <Text
              style={styles.viewAllText}
            >
              View All
            </Text>
          </TouchableOpacity>
        </View>

        <View>
          {loadingChildren
            ? (
              <ActivityIndicator
                size="small"
                color="#004E9F"
                style={{
                  marginBottom: 20,
                }}
              />
            )
            : children.length > 0
            ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.childChipsRow}
              >
                {children.map(
                  (child) => {
                    const id = child._id
                      || child.id;

                    const isSelected = id
                      === selectedChildId;

                    return (
                      <TouchableOpacity
                        key={id}
                        style={[
                          styles.childChip,
                          isSelected
                            ? styles.childChipSelected
                            : styles.childChipUnselected,
                        ]}
                        activeOpacity={0.8}
                        onPress={() =>
                          setSelectedChildId(
                            id,
                          )}
                      >
                        <Text
                          style={[
                            styles.childChipText,
                            isSelected
                              ? styles.childChipTextSelected
                              : styles.childChipTextUnselected,
                          ]}
                        >
                          {child.fullName
                            || child.name
                            || "Child"}
                        </Text>
                      </TouchableOpacity>
                    );
                  },
                )}
              </ScrollView>
            )
            : (
              <View
                style={styles.noUserContainer}
              >
                <Text
                  style={styles.noUserText}
                >
                  No user found
                </Text>
              </View>
            )}
        </View>

        {/* ACTION CARD */}

        <View
          style={styles.mediaActionCard}
        >
          <TouchableOpacity
            style={styles.playPreviewCircle}
            activeOpacity={0.8}
            onPress={() => handleOpenDemoVideo()}
          >
            <Ionicons
              name="play"
              size={24}
              color="#fff"
            />
          </TouchableOpacity>

          <View
            style={styles.actionButtonsRow}
          >
            <TouchableOpacity
              style={styles.uploadBtn}
              activeOpacity={0.85}
              onPress={handlePickVideo}
              disabled={uploading}
            >
              <View
                style={styles.btnIconBadge}
              >
                <AntDesign
                  name="cloud-upload"
                  size={18}
                  color={colors.primary}
                />
              </View>

              <View>
                <Text
                  style={styles.btnTitle}
                >
                  Upload
                </Text>

                <Text
                  style={styles.btnSubtitle}
                >
                  Existing media
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.recordBtn}
              activeOpacity={0.85}
              onPress={handleOpenRecordModal}
              disabled={uploading}
            >
              <View
                style={styles.recordIconBadge}
              >
                <Ionicons
                  name="disc-outline"
                  size={20}
                  color="#BA1A1A"
                />
              </View>

              <View>
                <Text
                  style={styles.btnTitle}
                >
                  Live Record
                </Text>

                <Text
                  style={styles.btnSubtitle}
                >
                  New session
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {loading
          ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={{
                marginTop: 20,
              }}
            />
          )
          : (
            <View
              style={styles.videoList}
            >
              {videos.length === 0
                ? (
                  <View
                    style={{
                      padding: 30,
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="videocam-outline"
                      size={45}
                      color="#94A3B8"
                    />

                    <Text
                      style={{
                        marginTop: 10,
                        color: "#64748B",
                        fontFamily: fonts.regular,
                      }}
                    >
                      No videos found
                    </Text>
                  </View>
                )
                : (
                  videos.map(
                    (video) => (
                      <View
                        key={video._id
                          || video.id}
                        style={styles.videoCard}
                      >
                        <TouchableOpacity
                          style={styles.videoThumbnail}
                          activeOpacity={0.9}
                          onPress={() =>
                            handleOpenDemoVideo(
                              video,
                            )}
                        >
                          <View
                            style={styles.centerPlayBtn}
                          >
                            <Ionicons
                              name="play"
                              size={28}
                              color="#035388"
                            />
                          </View>

                          <View
                            style={styles.durationBadge}
                          >
                            <Text
                              style={styles.durationText}
                            >
                              {video.duration
                                || "00:00"}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        <View
                          style={styles.videoFooter}
                        >
                          <View
                            style={styles.videoMetaColumn}
                          >
                            <Text
                              style={styles.videoChildName}
                            >
                              {video.childId
                                ?.name
                                || video.childId
                                  ?.fullName
                                || "Child Session"}
                            </Text>

                            <Text
                              style={styles.videoSubDetails}
                            >
                              {video.createdAt
                                ? new Date(
                                  video.createdAt,
                                ).toLocaleDateString()
                                : ""}

                              <Text
                                style={styles.bulletSeparator}
                              >
                                {" "}
                                •{" "}
                              </Text>

                              {video.tag
                                || "Video"}
                            </Text>
                          </View>

                          <View
                            style={styles.videoActionGroup}
                          >
                            <TouchableOpacity
                              style={styles.iconActionBtn}
                              activeOpacity={0.7}
                              onPress={() =>
                                handleDeleteVideo(
                                  video._id
                                    || video.id,
                                )}
                            >
                              <Feather
                                name="trash-2"
                                size={18}
                                color="#475569"
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ),
                  )
                )}
            </View>
          )}
      </ScrollView>

      <Modal
        visible={demoVideoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDemoVideoModal(false)}
      >
        <View
          style={styles.fullModalOverlay}
        >
          <View
            style={styles.demoPlayerContainer}
          >
            <View
              style={styles.modalHeaderRow}
            >
              <Text
                style={styles.demoModalTitle}
              >
                {activeVideo
                  ?.childId
                  ?.name
                  || activeVideo
                    ?.childId
                    ?.fullName
                  || "Video Session"} - {activeVideo?.tag
                  || "Video"}
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setDemoVideoModal(
                    false,
                  )}
              >
                <Feather
                  name="x"
                  size={24}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            <View
              style={styles.youtubeWrapper}
            >
              {activeVideo?.videoUrl
                ? (
                  <CloudinaryVideoPlayer
                    uri={activeVideo.videoUrl}
                  />
                )
                : (
                  <View
                    style={{
                      height: 300,
                      justifyContent: "center",
                      alignItems: "center",
                      backgroundColor: "#000",
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                      }}
                    >
                      Video URL not found
                    </Text>
                  </View>
                )}
            </View>

            <TouchableOpacity
              style={styles.closeDemoBtn}
              onPress={() =>
                setDemoVideoModal(
                  false,
                )}
            >
              <Text
                style={styles.closeDemoText}
              >
                Close Player
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={recordModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!uploading) {
            setRecordModalVisible(
              false,
            );
          }
        }}
      >
        <View
          style={styles.fullModalOverlay}
        >
          <View
            style={styles.recorderContainer}
          >
            {/* HEADER */}

            <View
              style={styles.modalHeaderRow}
            >
              <View
                style={styles.recordingStatusBadge}
              >
                <View
                  style={[
                    styles.redDot,
                    isRecording
                    && styles.redDotActive,
                  ]}
                />

                <Text
                  style={styles.recordingStatusText}
                >
                  {uploading
                    ? "UPLOADING TO CLOUDINARY..."
                    : isRecording
                    ? "RECORDING..."
                    : "READY TO RECORD"}
                </Text>
              </View>
              {isRecording && (
                <View
                  style={{
                    position: "absolute",
                    top: 20,
                    alignSelf: "center",
                    backgroundColor: "rgba(0,0,0,0.7)",
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 20,
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 20,
                      fontWeight: "bold",
                    }}
                  >
                    🔴 {formatRecordingTime(recordingSeconds)}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                disabled={uploading}
                onPress={() =>
                  setRecordModalVisible(
                    false,
                  )}
              >
                <Feather
                  name="x"
                  size={24}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            <View
              style={styles.viewfinderContainer}
            >
              {uploading
                ? (
                  <View
                    style={styles.uploadingBox}
                  >
                    <ActivityIndicator
                      size="large"
                      color="#FFFFFF"
                    />

                    <Text
                      style={styles.uploadingText}
                    >
                      Uploading video to Cloudinary...
                    </Text>
                  </View>
                )
                : cameraPermission?.granted
                ? (
                  <CameraView
                    ref={cameraRef}
                    style={{
                      flex: 1,
                    }}
                    facing={cameraFacing}
                    mode="video"
                    videoQuality="720p"
                  />
                )
                : (
                  <View
                    style={styles.cameraFallbackBox}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={64}
                      color="#94A3B8"
                    />

                    <Text
                      style={styles.fallbackTitle}
                    >
                      Camera Access Required
                    </Text>

                    <TouchableOpacity
                      style={styles.grantPermissionBtn}
                      onPress={handleOpenRecordModal}
                    >
                      <Text
                        style={styles.grantPermissionText}
                      >
                        Grant Access
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
            </View>

            {!uploading && (
              <View
                style={styles.recorderControls}
              >
                <View
                  style={styles.controlButtonsRow}
                >
                  <TouchableOpacity
                    style={styles.flipCameraBtn}
                    activeOpacity={0.7}
                    onPress={handleFlipCamera}
                    disabled={isRecording}
                  >
                    <Ionicons
                      name="camera-reverse-outline"
                      size={26}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.recordToggleButton,
                      isRecording
                      && styles.recordingActiveBtn,
                    ]}
                    onPress={isRecording
                      ? handleStopRecording
                      : handleStartRecording}
                  >
                    <Ionicons
                      name={isRecording
                        ? "stop"
                        : "disc"}
                      size={32}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>

                  <View
                    style={styles.flipCameraSpacer}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setModalVisible(false)}
        >
          <View
            style={styles.modalOverlay}
          >
            <TouchableWithoutFeedback>
              <View
                style={styles.modalContent}
              >
                <View
                  style={styles.modalHeader}
                >
                  <Text
                    style={styles.modalTitle}
                  >
                    Select Child
                  </Text>

                  <TouchableOpacity
                    onPress={() =>
                      setModalVisible(
                        false,
                      )}
                  >
                    <Feather
                      name="x"
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                <View
                  style={styles.modalSearchContainer}
                >
                  <Feather
                    name="search"
                    size={16}
                    color="#94A3B8"
                    style={{
                      marginRight: 8,
                    }}
                  />

                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Search child..."
                    placeholderTextColor="#94A3B8"
                    value={modalSearch}
                    onChangeText={setModalSearch}
                  />
                </View>

                <ScrollView
                  style={{
                    maxHeight: 260,
                  }}
                >
                  {filteredModalChildren.map(
                    (child) => {
                      const id = child._id
                        || child.id;

                      const isSelected = id
                        === selectedChildId;

                      return (
                        <TouchableOpacity
                          key={id}
                          style={[
                            styles.modalOption,
                            isSelected
                            && styles.modalOptionSelected,
                          ]}
                          onPress={() => {
                            setSelectedChildId(
                              id,
                            );

                            setModalVisible(
                              false,
                            );
                          }}
                        >
                          <Text
                            style={[
                              styles.modalOptionText,
                              isSelected
                              && styles.modalOptionTextSelected,
                            ]}
                          >
                            {child.fullName
                              || child.name
                              || "Child"}
                          </Text>

                          {isSelected && (
                            <Feather
                              name="check"
                              size={18}
                              color="#0B598F"
                            />
                          )}
                        </TouchableOpacity>
                      );
                    },
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <TherapistBottomBar activeTab="Children" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  headerBanner: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 20,
  },
  bannerTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    lineHeight: 24,
  },
  childHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.blackFont,
    lineHeight: 24,
  },
  viewAllText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#004E9F",
    lineHeight: 24,
  },
  childChipsRow: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  childChip: {
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  childChipSelected: {
    backgroundColor: "#8BF6D9",
  },
  childChipUnselected: {
    backgroundColor: "#F1F4FA",
    borderWidth: 1,
    borderColor: "#D7E3FF",
  },
  childChipText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    lineHeight: 24,
    color: "#004E9F",
  },
  mediaActionCard: {
    backgroundColor: "rgba(121,255,231,.2)",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#c6c9cc",
    marginBottom: 24,
  },
  playPreviewCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#006B58",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  uploadBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  recordBtn: {
    flex: 1,
    backgroundColor: "#C65647",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  btnIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#8BF6D9",
    alignItems: "center",
    justifyContent: "center",
  },
  recordIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(255,218,214,.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnTitle: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: "#FFFFFF",
    lineHeight: 19,
  },
  btnSubtitle: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: "rgba(255, 255, 255, 0.8)",
    lineHeight: 15,
  },
  videoList: {
    paddingHorizontal: 20,
    gap: 20,
  },
  videoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(224,227,230.3)",
  },
  videoThumbnail: {
    height: 180,
    backgroundColor: "#035388",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  centerPlayBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 3,
  },
  durationBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  durationText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: "#FFFFFF",
    lineHeight: 14,
  },
  videoFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
  },
  videoMetaColumn: {
    flex: 1,
  },
  videoChildName: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: "#181C1E",
    lineHeight: 20,
    marginBottom: 2,
  },
  videoSubDetails: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    lineHeight: 19,
  },
  bulletSeparator: {
    color: "#94A3B8",
  },
  videoActionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconActionBtn: {
    padding: 6,
  },
  fullModalOverlay: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    padding: 20,
  },
  demoPlayerContainer: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 40,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  demoModalTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    lineHeight: 22,
  },
  youtubeWrapper: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  closeDemoBtn: {
    backgroundColor: "#046A58",
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  closeDemoText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    lineHeight: 20,
  },
  recorderContainer: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 40,
  },
  recordingStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#64748B",
  },
  redDotActive: {
    backgroundColor: "#DC2626",
  },
  recordingStatusText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    lineHeight: 16,
  },
  viewfinderContainer: {
    height: 340,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#1E293B",
    borderWidth: 2,
    borderColor: "#334155",
    justifyContent: "center",
  },
  cameraFallbackBox: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  fallbackTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    lineHeight: 22,
    marginTop: 12,
  },
  fallbackSubText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  grantPermissionBtn: {
    backgroundColor: "#035388",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  grantPermissionText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
  },
  recorderControls: {
    alignItems: "center",
    gap: 16,
  },
  controlButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 20,
  },
  flipCameraBtn: {
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  flipCameraText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: "#94A3B8",
    lineHeight: 14,
    marginTop: 2,
  },
  flipCameraSpacer: {
    width: 42,
  },
  recordToggleButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  recordingActiveBtn: {
    backgroundColor: "#991B1B",
  },
  saveRecordBtn: {
    backgroundColor: "#046A58",
    paddingHorizontal: 24,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  saveRecordText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#0F172A",
    lineHeight: 22,
  },
  modalSearchContainer: {
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#0F172A",
  },
  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  modalOptionSelected: {
    backgroundColor: "#F1F5F9",
  },
  modalOptionText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#334155",
    lineHeight: 20,
  },
  modalOptionTextSelected: {
    fontFamily: fonts.bold,
    color: "#0B598F",
    lineHeight: 20,
  },
});
