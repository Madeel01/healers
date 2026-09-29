import React, {
  useContext,
  useEffect,
  useState,
} from 'react';

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
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';

import { getChildVideos } from '../../api/child/api';
import ChildBottomBar from '../../components/ChildBottomBar';
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

export default function ChildVideoScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const selectedChildId = user?.id;
  const [videos, setVideos] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [demoVideoModal, setDemoVideoModal] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [videoPage, setVideoPage] = useState(1);
  const [videoLoading, setVideoLoading] = useState(false);
  const [loadingMoreVideos, setLoadingMoreVideos] = useState(false);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);

  const fetchVideos = async (childId, page = 1, append = false) => {
    if (!childId) {
      return;
    }
    try {
      if (append) {
        setLoadingMoreVideos(true);
      } else {
        setVideoLoading(true);
      }

      const response = await getChildVideos(childId, page, 5);

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

  const onRefresh = async () => {
    try {
      setRefreshing(true);

      if (selectedChildId) {
        setVideos([]);
        setVideoPage(1);
        setHasMoreVideos(true);

        await fetchVideos(selectedChildId, 1, false);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleVideoScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;

    const paddingToBottom = 100;

    const isNearBottom = layoutMeasurement.height
        + contentOffset.y
      >= contentSize.height
        - paddingToBottom;

    if (isNearBottom && !loadingMoreVideos && hasMoreVideos && selectedChildId) {
      fetchVideos(selectedChildId, videoPage + 1, true);
    }
  };

  const handleOpenDemoVideo = (video = null) => {
    const targetVideo = video
      || videos?.[0];

    if (!targetVideo?.videoUrl) {
      Alert.alert(
        "No Video",
        "There is no uploaded video available.",
      );

      return;
    }

    setActiveVideo(targetVideo);
    setDemoVideoModal(true);
  };

  useEffect(() => {
    if (selectedChildId) {
      setVideos([]);
      setVideoPage(1);
      setHasMoreVideos(true);
      fetchVideos(selectedChildId, 1, false);
    }
  }, [selectedChildId]);

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
          />
        }
        onScroll={handleVideoScroll}
      >
        <View style={styles.headerBanner}>
          <Text style={styles.bannerTitle}>
            Weekly Video Updates
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.childChipsRow}
        >
          <TouchableOpacity
            style={[
              styles.childChip,
              styles.childChipSelected,
            ]}
          >
            <Text
              style={[
                styles.childChipText,
                styles.childChipTextSelected,
              ]}
            >
              {user?.fullName || "Child"}
            </Text>
          </TouchableOpacity>
        </ScrollView>

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

      <ChildBottomBar
        activeTab="ChildVideo"
      />

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
                {activeVideo?.childId?.name || activeVideo?.childId?.fullName
                  || "Video Session"} - {activeVideo?.tag || "Video"}
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

            <View style={styles.youtubeWrapper}>
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

  childChipText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    lineHeight: 24,
    color: "#004E9F",
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
});
