import React, { useState } from 'react';

import { Audio } from 'expo-av';
import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import {
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import YoutubePlayer from 'react-native-youtube-iframe';

import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';

import TherapistBottomBar from '../../components/TherapistBottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const getYoutubeId = (urlOrId) => {
  if (!urlOrId) return "L_LUpnjgPso"; // default fallback video ID
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = urlOrId.match(regExp);
  return match && match[2].length === 11 ? match[2] : urlOrId;
};

const ALL_CHILDREN = [
  { id: "1", name: "Ali Raza" },
  { id: "2", name: "Fatima Noor" },
  { id: "3", name: "Hassan Khan" },
  { id: "4", name: "Zainab Ali" },
  { id: "5", name: "Bilal Ahmed" },
  { id: "6", name: "Ayesha Omer" },
];

const INITIAL_VIDEOS = [
  {
    id: "v1",
    childId: "1",
    childName: "Ali Raza",
    date: "Jul 24, 2026",
    tag: "Speech Evaluation",
    duration: "03:15",
    youtubeUrl: "https://www.youtube.com/watch?v=L_LUpnjgPso",
  },
  {
    id: "v2",
    childId: "1",
    childName: "Ali Raza",
    date: "Jul 24, 2026",
    tag: "Therapy Session",
    duration: "04:20",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
];

export default function WeeklyVideoScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [selectedChildId, setSelectedChildId] = useState("1");
  const [videos, setVideos] = useState(INITIAL_VIDEOS);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [demoVideoModal, setDemoVideoModal] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [audioPermissionResponse, requestAudioPermission] = Audio.usePermissions();
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("back");

  const visibleChildrenChips = ALL_CHILDREN.slice(0, 4);

  const filteredModalChildren = ALL_CHILDREN.filter((child) =>
    child.name.toLowerCase().includes(modalSearch.toLowerCase())
  );

  const handleDeleteVideo = (videoId) => {
    setVideos((prev) => prev.filter((item) => item.id !== videoId));
  };

  const handleOpenDemoVideo = (video = null) => {
    const targetVideo = video || videos[0];
    setActiveVideo(targetVideo);
    setDemoVideoModal(true);
  };

  const handleOpenRecordModal = async () => {
    if (!cameraPermission?.granted) {
      await requestCameraPermission();
    }
    if (!audioPermissionResponse?.granted) {
      await requestAudioPermission();
    }
    setRecordModalVisible(true);
  };

  const handleToggleRecord = () => {
    setIsRecording((prev) => !prev);
  };

  const handleFlipCamera = () => {
    setCameraFacing((prev) => (prev === "back" ? "front" : "back"));
  };

  const handleSaveRecording = () => {
    setIsRecording(false);
    setRecordModalVisible(false);

    const currentChild = ALL_CHILDREN.find((c) => c.id === selectedChildId);
    const newVideo = {
      id: `v_${Date.now()}`,
      childId: selectedChildId,
      childName: currentChild ? currentChild.name : "Ali Raza",
      date: "Sep 02, 2026",
      tag: "Live Session",
      duration: "02:45",
      youtubeUrl: "https://www.youtube.com/watch?v=L_LUpnjgPso",
    };
    setVideos((prev) => [newVideo, ...prev]);
  };

  return (
    <SafeAreaView
      style={[
        styles.mainContainer,
        commonStyles.container,
        { paddingTop: insets.top },
      ]}
    >
      <TopBar navigation={navigation} headerTitle="Weekly Video" />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBanner}>
          <Text style={styles.bannerTitle}>Weekly Video Updates</Text>
        </View>

        <View style={styles.childHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Enter Child</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.childChipsRow}
        >
          {visibleChildrenChips.map((child) => {
            const isSelected = child.id === selectedChildId;
            return (
              <TouchableOpacity
                key={child.id}
                style={[
                  styles.childChip,
                  isSelected
                    ? styles.childChipSelected
                    : styles.childChipUnselected,
                ]}
                activeOpacity={0.8}
                onPress={() => setSelectedChildId(child.id)}
              >
                <Text
                  style={[
                    styles.childChipText,
                    isSelected
                      ? styles.childChipTextSelected
                      : styles.childChipTextUnselected,
                  ]}
                >
                  {child.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.mediaActionCard}>
          <TouchableOpacity
            style={styles.playPreviewCircle}
            activeOpacity={0.8}
            onPress={() => handleOpenDemoVideo()}
          >
            <Ionicons name="play" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.uploadBtn}
              activeOpacity={0.85}
              onPress={() => handleOpenDemoVideo()}
            >
              <View style={styles.btnIconBadge}>
              <AntDesign name="cloud-upload" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.btnTitle}>Upload</Text>
                <Text style={styles.btnSubtitle}>Existing media</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.recordBtn}
              activeOpacity={0.85}
              onPress={handleOpenRecordModal}
            >
              <View style={styles.recordIconBadge}>
                <Ionicons name="disc-outline" size={20} color="#BA1A1A" />
              </View>
              <View>
                <Text style={styles.btnTitle}>Live Record</Text>
                <Text style={styles.btnSubtitle}>New session</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.videoList}>
          {videos.map((video) => (
            <View key={video.id} style={styles.videoCard}>
              <TouchableOpacity
                style={styles.videoThumbnail}
                activeOpacity={0.9}
                onPress={() => handleOpenDemoVideo(video)}
              >
                <View style={styles.centerPlayBtn}>
                  <Ionicons name="play" size={28} color="#035388" />
                </View>

                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{video.duration}</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.videoFooter}>
                <View style={styles.videoMetaColumn}>
                  <Text style={styles.videoChildName}>{video.childName}</Text>
                  <Text style={styles.videoSubDetails}>
                    {video.date}
                    <Text style={styles.bulletSeparator}>•</Text>
                    {video.tag}
                  </Text>
                </View>

                <View style={styles.videoActionGroup}>
                  <TouchableOpacity
                    style={styles.iconActionBtn}
                    activeOpacity={0.7}
                    onPress={() => handleOpenDemoVideo(video)}
                  >
                    <Feather name="download" size={18} color="#475569" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.iconActionBtn}
                    activeOpacity={0.7}
                    onPress={() => handleDeleteVideo(video.id)}
                  >
                    <Feather name="trash-2" size={18} color="#475569" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={demoVideoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDemoVideoModal(false)}
      >
        <View style={styles.fullModalOverlay}>
          <View style={styles.demoPlayerContainer}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.demoModalTitle}>
                {activeVideo?.childName} - {activeVideo?.tag}
              </Text>
              <TouchableOpacity onPress={() => setDemoVideoModal(false)}>
                <Feather name="x" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* YouTube Player Component */}
            <View style={styles.youtubeWrapper}>
              <YoutubePlayer
                height={220}
                play={true}
                videoId={getYoutubeId(activeVideo?.youtubeUrl)}
              />
            </View>

            <TouchableOpacity
              style={styles.closeDemoBtn}
              onPress={() => setDemoVideoModal(false)}
            >
              <Text style={styles.closeDemoText}>Close Player</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={recordModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRecordModalVisible(false)}
      >
        <View style={styles.fullModalOverlay}>
          <View style={styles.recorderContainer}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.recordingStatusBadge}>
                <View
                  style={[
                    styles.redDot,
                    isRecording && styles.redDotActive,
                  ]}
                />
                <Text style={styles.recordingStatusText}>
                  {isRecording
                    ? "RECORDING AUDIO & VIDEO..."
                    : "READY TO RECORD"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsRecording(false);
                  setRecordModalVisible(false);
                }}
              >
                <Feather name="x" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.viewfinderContainer}>
              {cameraPermission?.granted
                ? (
                  <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing={cameraFacing}
                    mode="video"
                  />
                )
                : (
                  <View style={styles.cameraFallbackBox}>
                    <Ionicons
                      name={cameraFacing === "front"
                        ? "person-circle-outline"
                        : "camera-outline"}
                      size={64}
                      color="#94A3B8"
                    />
                    <Text style={styles.fallbackTitle}>
                      Camera & Mic Access Required
                    </Text>
                    <Text style={styles.fallbackSubText}>
                      Grant permissions to enable live video and voice recording
                    </Text>
                    <TouchableOpacity
                      style={styles.grantPermissionBtn}
                      onPress={handleOpenRecordModal}
                    >
                      <Text style={styles.grantPermissionText}>
                        Grant Access
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
            </View>

            <View style={styles.recorderControls}>
              <View style={styles.controlButtonsRow}>
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
                  <Text style={styles.flipCameraText}>
                    {cameraFacing === "back" ? "Front" : "Back"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.recordToggleButton,
                    isRecording && styles.recordingActiveBtn,
                  ]}
                  onPress={handleToggleRecord}
                >
                  <Ionicons
                    name={isRecording ? "stop" : "disc"}
                    size={32}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                <View style={styles.flipCameraSpacer} />
              </View>

              {isRecording && (
                <TouchableOpacity
                  style={styles.saveRecordBtn}
                  onPress={handleSaveRecording}
                >
                  <Text style={styles.saveRecordText}>Save Recording</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Child</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Feather name="x" size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalSearchContainer}>
                  <Feather
                    name="search"
                    size={16}
                    color="#94A3B8"
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Search child..."
                    placeholderTextColor="#94A3B8"
                    value={modalSearch}
                    onChangeText={setModalSearch}
                  />
                </View>

                <ScrollView style={{ maxHeight: 260 }}>
                  {filteredModalChildren.map((child) => {
                    const isSelected = child.id === selectedChildId;
                    return (
                      <TouchableOpacity
                        key={child.id}
                        style={[
                          styles.modalOption,
                          isSelected && styles.modalOptionSelected,
                        ]}
                        onPress={() => {
                          setSelectedChildId(child.id);
                          setModalVisible(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.modalOptionText,
                            isSelected && styles.modalOptionTextSelected,
                          ]}
                        >
                          {child.name}
                        </Text>
                        {isSelected && <Feather name="check" size={18} color="#0B598F" />}
                      </TouchableOpacity>
                    );
                  })}
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
    color:'#004E9F',
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
