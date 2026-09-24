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
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import {
  useVideoPlayer,
  VideoView,
} from 'expo-video';
import {
  ActivityIndicator,
  Alert,
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
  createWeeklyVideoApi,
  deleteWeeklyVideoApi,
  getChildVideosApi,
  therapistUsers,
  uploadToCloudinaryFileSystem,
} from '../../api/therapist/api';
import TherapistBottomBar from '../../components/TherapistBottomBar';
import TopBar from '../../components/TopBar';
import { AuthContext } from '../../context/AuthContext';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const CloudinaryVideoPlayer = ({ uri }) => {
  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = false;
    playerInstance.play();
  });

  return (
    <View style={{ width: "100%", height: 300 }}>
      <VideoView
        player={player}
        nativeControls
        contentFit="contain"
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </View>
  );
};

export default function WeeklyVideoScreen({
  navigation,
}) {
  const { user } = useContext(AuthContext);

  const cameraRef = useRef(null);

  const recordingTimerRef = useRef(null);
  const discardRecordingRef = useRef(false);
  const recordingActionRef = useRef(false);
  const flipAfterStopRef = useRef(false);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [demoVideoModal, setDemoVideoModal] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("back");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [cameraZoom, setCameraZoom] = useState(0);
  const [videoPage, setVideoPage] = useState(1);
  const [videoLoading, setVideoLoading] = useState(false);
  const [loadingMoreVideos, setLoadingMoreVideos] = useState(false);
  const [loadingUploadVideos, setLoadingUploadVideos] = useState(false);
  const [deletingVideoId, setDeletingVideoId] = useState(null);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);
  const [
    cameraPermission,
    requestCameraPermission,
  ] = useCameraPermissions();
  const [
    audioPermission,
    requestAudioPermission,
  ] = useMicrophonePermissions();

  const MAX_VIDEO_SIZE = 80 * 1024 * 1024;

  useEffect(() => {
    fetchChildren();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      setVideos([]);
      setVideoPage(1);
      setHasMoreVideos(true);

      fetchVideos(
        selectedChildId,
        1,
        false,
      );
    }
  }, [selectedChildId]);

  useEffect(() => {
    return () => {
      stopRecordingTimer();
    };
  }, []);

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
        const initialChildId = fetchedUsers[0]?._id
          || fetchedUsers[0]?.id;

        setSelectedChildId(
          initialChildId,
        );
      }
    } catch (error) {
      console.error(
        "Error fetching children:",
        error,
      );

      Alert.alert(
        "Error",
        "Could not load children.",
      );
    } finally {
      setLoadingChildren(false);
    }
  };
  const handleZoomIn = () => {
    setCameraZoom((previous) => Math.min(previous + 0.1, 1));
  };

  const handleZoomOut = () => {
    setCameraZoom((previous) => Math.max(previous - 0.1, 0));
  };
  const fetchVideos = async (
    childId,
    page = 1,
    append = false,
  ) => {
    if (!childId) {
      return;
    }

    try {
      if (append) {
        setLoadingMoreVideos(true);
      } else {
        setVideoLoading(true);
      }

      const response = await getChildVideosApi(
        childId,
        page,
        5,
      );

      console.log(
        "Videos response:",
        response,
      );

      if (response?.success) {
        const newVideos = response?.data || [];

        if (append) {
          setVideos((previousVideos) => [
            ...previousVideos,
            ...newVideos,
          ]);
        } else {
          setVideos(newVideos);
        }

        setVideoPage(page);

        setHasMoreVideos(
          response?.pagination?.hasMore === true,
        );
      } else {
        if (!append) {
          setVideos([]);
        }

        setHasMoreVideos(false);
      }
    } catch (error) {
      console.error(
        "Fetch videos error:",
        error,
      );

      if (!append) {
        setVideos([]);
      }

      Alert.alert(
        "Error",
        "Could not load videos for selected child.",
      );
    } finally {
      setVideoLoading(false);
      setLoadingMoreVideos(false);
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
              // Start loader only after user confirms
              setDeletingVideoId(videoId);

              const response = await deleteWeeklyVideoApi(
                videoId,
              );

              if (response?.success) {
                setVideos((previousVideos) =>
                  previousVideos.filter(
                    (item) =>
                      item?._id !== videoId
                      && item?.id !== videoId,
                  )
                );

                Alert.alert(
                  "Success",
                  "Video deleted successfully.",
                );
              } else {
                Alert.alert(
                  "Error",
                  response?.message
                    || "Failed to delete video.",
                );
              }
            } catch (error) {
              console.error(
                "Delete video error:",
                error,
              );

              Alert.alert(
                "Error",
                error?.message
                  || "Failed to delete video.",
              );
            } finally {
              // Stop loader
              setDeletingVideoId(null);
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

      setRecordingSeconds(0);
      setCameraFacing("front");
      setTimeout(() => {
        handleFlipCamera();
      }, 200);
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

  const startRecordingTimer = () => {
    setRecordingSeconds(0);

    stopRecordingTimer();

    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds(
        (previous) => previous + 1,
      );
    }, 1000);
  };

  const stopRecordingTimer = () => {
    if (
      recordingTimerRef.current
    ) {
      clearInterval(
        recordingTimerRef.current,
      );

      recordingTimerRef.current = null;
    }
  };

  const formatRecordingTime = (
    seconds,
  ) => {
    const minutes = Math.floor(
      seconds / 60,
    );

    const remainingSeconds = seconds % 60;

    return (
      `${
        String(minutes).padStart(
          2,
          "0",
        )
      }:`
      + `${
        String(
          remainingSeconds,
        ).padStart(2, "0")
      }`
    );
  };

  const handleStartRecording = async () => {
    if (!cameraRef.current) {
      Alert.alert(
        "Camera Error",
        "Camera is not ready.",
      );
      return;
    }

    if (isRecording) {
      return;
    }

    try {
      discardRecordingRef.current = false;
      flipAfterStopRef.current = false;
      recordingActionRef.current = false;

      setRecordingSeconds(0);
      setIsRecording(true);

      startRecordingTimer();

      console.log("Starting video recording...");

      const recordedVideo = await cameraRef.current.recordAsync({
        maxDuration: 60 * 60, // 1 hour
        maxFileSize: 80 * 1024 * 1024, // 80 MB
      });

      console.log(
        "Recording finished:",
        recordedVideo,
      );

      stopRecordingTimer();

      setIsRecording(false);

      if (discardRecordingRef.current) {
        console.log(
          "Recording discarded - NOT uploading.",
        );

        if (flipAfterStopRef.current) {
          flipAfterStopRef.current = false;

          setCameraFacing((previous) =>
            previous === "back"
              ? "front"
              : "back"
          );

          setTimeout(() => {
            handleStartRecording();
          }, 500);

          return;
        }

        setRecordingSeconds(0);

        return;
      }

      if (!recordedVideo?.uri) {
        Alert.alert(
          "Recording Error",
          "No video file was returned.",
        );

        return;
      }

      const validSize = await checkVideoSize(
        recordedVideo.uri,
      );

      if (!validSize) {
        console.log(
          "Recording rejected because it is larger than 30 MB.",
        );

        return;
      }

      await handleUploadAndSave(
        recordedVideo.uri,
        "Live Session",
      );
    } catch (error) {
      console.error(
        "Recording Error:",
        error,
      );

      stopRecordingTimer();

      setIsRecording(false);

      if (
        !discardRecordingRef.current
      ) {
        Alert.alert(
          "Recording Error",
          error?.message
            || "Failed to record video.",
        );
      }
    } finally {
      recordingActionRef.current = false;
    }
  };

  const handleStopRecording = () => {
    if (
      !cameraRef.current
      || !isRecording
      || recordingActionRef.current
    ) {
      return;
    }

    recordingActionRef.current = true;

    discardRecordingRef.current = false;
    flipAfterStopRef.current = false;

    stopRecordingTimer();

    cameraRef.current.stopRecording();
  };

  const handleCancelRecording = () => {
    if (uploading) {
      return;
    }

    if (isRecording) {
      console.log(
        "Cancelling recording - video will NOT be saved.",
      );

      discardRecordingRef.current = true;
      flipAfterStopRef.current = false;

      stopRecordingTimer();

      cameraRef.current?.stopRecording();

      setIsRecording(false);

      setRecordingSeconds(0);

      setRecordModalVisible(false);

      return;
    }

    stopRecordingTimer();

    setRecordingSeconds(0);

    setRecordModalVisible(false);
  };

  const checkVideoSize = async (fileUri) => {
    try {
      const file = new File(fileUri);

      if (!file.exists) {
        throw new Error(
          "Video file does not exist.",
        );
      }

      const size = file.size || 0;

      const sizeMB = size
        / (1024 * 1024);

      console.log(
        "Video size:",
        sizeMB.toFixed(2),
        "MB",
      );

      if (
        size
          > MAX_VIDEO_SIZE
      ) {
        Alert.alert(
          "Video Too Large",
          `This video is ${
            sizeMB.toFixed(
              2,
            )
          } MB.\n\nMaximum allowed size is 30 MB.`,
        );

        return false;
      }

      return true;
    } catch (error) {
      console.error(
        "Video size check error:",
        error,
      );

      Alert.alert(
        "Error",
        "Unable to check the video size.",
      );

      return false;
    }
  };

  const formatDuration = (
    seconds,
  ) => {
    if (
      seconds === undefined
      || seconds === null
      || isNaN(seconds)
    ) {
      return "00:00";
    }

    const totalSeconds = Math.floor(
      Number(seconds),
    );

    const minutes = Math.floor(
      totalSeconds / 60,
    );

    const remainingSeconds = totalSeconds % 60;

    return (
      `${
        String(minutes).padStart(
          2,
          "0",
        )
      }:`
      + `${
        String(
          remainingSeconds,
        ).padStart(2, "0")
      }`
    );
  };

  const handleUploadAndSave = async (
    videoUri,
    tag = "Live Session",
  ) => {
    try {
      if (!videoUri) {
        Alert.alert(
          "Error",
          "Video file not found.",
        );

        return false;
      }

      if (!selectedChildId) {
        Alert.alert(
          "Select Child",
          "Please select a child first.",
        );

        return false;
      }

      const isValidSize = await checkVideoSize(
        videoUri,
      );

      if (!isValidSize) {
        console.log(
          "Video rejected because it is larger than 30 MB.",
        );

        return false;
      }

      setUploading(true);

      console.log(
        "Uploading video:",
        videoUri,
      );

      const result = await uploadToCloudinaryFileSystem(
        videoUri,
        "video",
      );

      // console.log(
      //   "Cloudinary result:",
      //   result,
      // );

      if (!result?.secure_url) {
        throw new Error(
          "Cloudinary did not return a video URL.",
        );
      }
      //  Alert.alert(
      //   "Success",
      //   "Video uploaded successfully.",
      // );
      // return true;

      const payload = {
        childId: selectedChildId,
        tag: tag,
        duration: result?.duration
          ? formatDuration(
            result.duration,
          )
          : formatDuration(
            recordingSeconds,
          ),

        videoUrl: result.secure_url,
        cloudinaryPublicId: result.public_id,
        cloudinaryResourceType: result.resource_type,
        videoFormat: result.format,
        width: result.width,
        height: result.height,
        fileSize: result.bytes,
        durationSeconds: result.duration
          || recordingSeconds,
      };

      console.log(
        "Video payload:",
        payload,
      );

      const response = await createWeeklyVideoApi(
        payload,
      );

      console.log(
        "Create video response:",
        response,
      );

      if (!response?.success) {
        throw new Error(
          response?.message
            || "Failed to save video.",
        );
      }

      // Close recorder
      setRecordModalVisible(
        false,
      );

      await fetchVideos(
        selectedChildId,
      );

      Alert.alert(
        "Success",
        "Video uploaded successfully.",
      );

      return true;
    } catch (error) {
      console.error(
        "Upload/save error:",
        error,
      );

      Alert.alert(
        "Upload Failed",
        error?.message
          || "Unable to upload video.",
      );

      return false;
    } finally {
      setUploading(false);
      setIsRecording(false);
      stopRecordingTimer();
    }
  };

  const handlePickVideo = async () => {
    try {
      if (!selectedChildId) {
        Alert.alert(
          "Select Child",
          "Please select a child first.",
        );

        return;
      }

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
          mediaTypes: [
            "videos",
          ],

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
      setLoadingUploadVideos(true);
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
    } finally {
      setLoadingUploadVideos(false);
    }
  };

  const handleOpenDemoVideo = (video = null) => {
    const targetVideo = video
      || videos?.[0];

    if (
      !targetVideo?.videoUrl
    ) {
      Alert.alert(
        "No Video",
        "There is no uploaded video available.",
      );

      return;
    }

    setActiveVideo(
      targetVideo,
    );

    setDemoVideoModal(
      true,
    );
  };
  const handleFlipCamera = () => {
    if (uploading) {
      return null;
    }

    if (isRecording) {
      Alert.alert(
        "Cannot Flip Camera",
        "You cannot flip the camera while recording is in progress.",
      );

      return null;
    }

    setCameraFacing((previous) =>
      previous === "back"
        ? "front"
        : "back"
    );

    return null;
  };
  const filteredModalChildren = children?.filter(
    (child) => {
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
    },
  );

  const onRefresh = async () => {
    try {
      setRefreshing(true);

      await fetchChildren();

      if (selectedChildId) {
        setVideos([]);
        setVideoPage(1);
        setHasMoreVideos(true);

        await fetchVideos(
          selectedChildId,
          1,
          false,
        );
      }
    } finally {
      setRefreshing(false);
    }
  };

  const zoomPercentage = Math.round(
    cameraZoom * 100,
  );
  const handleVideoScroll = ({
    nativeEvent,
  }) => {
    const {
      layoutMeasurement,
      contentOffset,
      contentSize,
    } = nativeEvent;

    const paddingToBottom = 100;

    const isNearBottom = layoutMeasurement.height
        + contentOffset.y
      >= contentSize.height
        - paddingToBottom;

    if (
      isNearBottom
      && !loadingMoreVideos
      && hasMoreVideos
      && selectedChildId
    ) {
      fetchVideos(
        selectedChildId,
        videoPage + 1,
        true,
      );
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
      {loadingUploadVideos
        ? <ActivityIndicator size="small" color="#004E9F" style={[styles.scrollArea, { marginBottom: 20 }]} />
        : (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
              />
            }
            onScroll={handleVideoScroll}
          >
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
                    style={styles.childChipsRow}
                  >
                    <Text
                      style={{
                        marginTop: 10,
                        color: "#64748B",
                        fontFamily: fonts.regular,
                      }}
                    >
                      No user found
                    </Text>
                  </View>
                )}
            </View>

            <View
              style={styles.mediaActionCard}
            >
              <TouchableOpacity
                style={styles.playPreviewCircle}
                activeOpacity={0.8}
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

            {videoLoading
              ? (
                <View
                  style={{
                    paddingVertical: 40,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ActivityIndicator
                    size="large"
                    color={colors.primary}
                  />

                  <Text
                    style={{
                      marginTop: 10,
                      color: "#64748B",
                      fontFamily: fonts.regular,
                    }}
                  >
                    Loading videos...
                  </Text>
                </View>
              )
              : (
                <View style={styles.videoList}>
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
                      videos.map((video) => (
                        <View
                          key={video._id || video.id}
                          style={styles.videoCard}
                        >
                          <TouchableOpacity
                            style={styles.videoThumbnail}
                            activeOpacity={0.9}
                            onPress={() => handleOpenDemoVideo(video)}
                          >
                            <View style={styles.centerPlayBtn}>
                              <Ionicons
                                name="play"
                                size={28}
                                color="#035388"
                              />
                            </View>

                            <View style={styles.durationBadge}>
                              <Text style={styles.durationText}>
                                {video.duration || "00:00"}
                              </Text>
                            </View>
                          </TouchableOpacity>

                          <View style={styles.videoFooter}>
                            <View style={styles.videoMetaColumn}>
                              <Text style={styles.videoChildName}>
                                {video.childId?.name
                                  || video.childId?.fullName
                                  || "Child Session"}
                              </Text>

                              <Text style={styles.videoSubDetails}>
                                {video.createdAt
                                  ? new Date(
                                    video.createdAt,
                                  ).toLocaleDateString()
                                  : ""}

                                <Text
                                  style={styles.bulletSeparator}
                                >
                                  {" "}•{" "}
                                </Text>

                                {video.tag || "Video"}
                              </Text>
                            </View>

                            <View style={styles.videoActionGroup}>
                              <TouchableOpacity
                                style={styles.iconActionBtn}
                                activeOpacity={0.7}
                                disabled={deletingVideoId === (video._id || video.id)}
                                onPress={() => handleDeleteVideo(video._id || video.id)}
                              >
                                {deletingVideoId === (video._id || video.id)
                                  ? <ActivityIndicator size="small" color="#475569" />
                                  : <Feather name="trash-2" size={18} color="#475569" />}
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      ))
                    )}

                  {loadingMoreVideos && (
                    <View
                      style={{
                        paddingVertical: 20,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ActivityIndicator
                        size="small"
                        color={colors.primary}
                      />

                      <Text
                        style={{
                          marginTop: 8,
                          color: "#64748B",
                          fontFamily: fonts.regular,
                        }}
                      >
                        Loading more videos...
                      </Text>
                    </View>
                  )}

                  {!loadingMoreVideos
                    && videos.length > 0
                    && !hasMoreVideos && (
                    <Text
                      style={{
                        textAlign: "center",
                        paddingVertical: 15,
                        color: "#94A3B8",
                        fontFamily: fonts.regular,
                      }}
                    >
                      No more videos
                    </Text>
                  )}
                </View>
              )}
          </ScrollView>
        )}
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
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!uploading) {
            if (isRecording) {
              handleStopRecording();
            }

            stopRecordingTimer();

            setRecordModalVisible(
              false,
            );
          }
        }}
      >
        <View style={styles.fullModalOverlay}>
          <View style={styles.recorderContainer}>
            <View style={styles.modalHeaderRow}>
              <View style={[commonStyles.flexClass, { gap: 5 }]}>
                <View
                  style={[
                    styles.redDot,
                    isRecording
                    && styles.redDotActive,
                  ]}
                />
                <Text style={styles.recordingStatusText}>
                  {uploading
                    ? "UPLOADING..."
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
                onPress={handleCancelRecording}
              >
                <Feather
                  name="x"
                  size={24}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.viewfinderContainer}>
              {uploading
                ? (
                  <View>
                    <ActivityIndicator size="large" color="#FFFFFF" />

                    <Text style={styles.uploadingText}>
                      Uploading video ...
                    </Text>
                  </View>
                )
                : cameraPermission?.granted
                ? (
                  <View
                    style={{
                      flex: 1,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        position: "absolute",
                        right: 15,
                        bottom: 30,
                        zIndex: 10,
                        gap: 10,
                      }}
                    >
                      <TouchableOpacity
                        onPress={handleZoomIn}
                        style={{
                          width: 45,
                          height: 45,
                          borderRadius: 25,
                          backgroundColor: "rgba(0,0,0,0.65)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name="add"
                          size={28}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleZoomOut}
                        style={{
                          width: 45,
                          height: 45,
                          borderRadius: 25,
                          backgroundColor: "rgba(0,0,0,0.65)",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons
                          name="remove"
                          size={28}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 16,
                          fontWeight: "bold",
                          textAlign: "center",
                        }}
                      >
                        {zoomPercentage}%
                      </Text>
                    </View>
                    <CameraView
                      ref={cameraRef}
                      facing={cameraFacing}
                      mode="video"
                      zoom={cameraZoom}
                      videoQuality="480p"
                      style={{
                        flex: 1,
                      }}
                      videoBitrate={200_000}
                    />
                  </View>
                )
                : (
                  <View style={styles.cameraFallbackBox}>
                    <Ionicons
                      name="camera-outline"
                      size={64}
                      color="#94A3B8"
                    />

                    <Text style={styles.fallbackTitle}>
                      Camera Access Required
                    </Text>

                    <TouchableOpacity
                      onPress={handleOpenRecordModal}
                      style={styles.grantPermissionBtn}
                    >
                      <Text style={styles.grantPermissionText}>
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
                <View style={styles.controlButtonsRow}>
                  <TouchableOpacity
                    onPress={handleFlipCamera}
                    disabled={uploading}
                    style={styles.flipCameraBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="camera-reverse-outline"
                      size={30}
                      color="#FFFFFF"
                    />

                    <Text style={styles.btnText}>
                      Flip
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={isRecording
                      ? handleStopRecording
                      : handleStartRecording}
                    style={[
                      styles.recordToggleButton,
                      isRecording
                      && styles.recordingActiveBtn,
                    ]}
                  >
                    <Ionicons
                      name={isRecording
                        ? "stop"
                        : "disc"}
                      size={32}
                      color="#FFFFFF"
                    />

                    <Text style={styles.btnText}>
                      {isRecording
                        ? "Stop"
                        : "Record"}
                    </Text>
                  </TouchableOpacity>
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
    width: 72,
    height: 72,
    borderRadius: 999,
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
  btnText: {
    color: "#fff",
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  uploadingText: {
    color: "#fff",
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlign: "center",
  },
});
