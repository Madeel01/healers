import React, {
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';

import {
  createComplaintApi,
  getMyComplaintsApi,
} from '../../api/child/api';
import BottomBar from '../../components/BottomBar';
import ChildBottomBar from '../../components/ChildBottomBar';
import TopBar from '../../components/TopBar';
import { AuthContext } from '../../context/AuthContext';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const PAGE_LIMIT = 5;

const PRIORITIES = [
  {
    value: "Normal",
    label: "Normal",
  },
  {
    value: "High",
    label: "High",
  },
];

export default function ComplaintsScreen({
  navigation,
}) {
  const {
    user,
  } = useContext(AuthContext);

  const role = user?.role;

  const [
    complaints,
    setComplaints,
  ] = useState([]);

  const [
    total,
    setTotal,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(false);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    showCreateModal,
    setShowCreateModal,
  ] = useState(false);

  const [
    title,
    setTitle,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    priority,
    setPriority,
  ] = useState("Normal");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const pageRef =
    useRef(1);

  const hasMoreRef =
    useRef(true);

  const loadingMoreRef =
    useRef(false);

  const firstLoadRef =
    useRef(true);

  const endReachedRef =
    useRef(false);

  const fetchComplaints =
    useCallback(
      async (
        pageNumber = 1,
        loadMore = false,
        showLoader = true,
      ) => {
        if (loadMore) {
          if (
            loadingMoreRef.current
            || !hasMoreRef.current
          ) {
            return;
          }

          loadingMoreRef.current =
            true;

          setLoadingMore(true);
        } else if (showLoader) {
          setLoading(true);
        }

        try {
          const response =
            await getMyComplaintsApi(
              pageNumber,
              PAGE_LIMIT,
            );

          if (!response?.success) {
            return;
          }

          const newItems =
            response.data || [];

          if (pageNumber === 1) {
            setComplaints(
              newItems,
            );
          } else {
            setComplaints(
              (previous) => {
                const ids =
                  new Set(
                    previous.map(
                      (item) =>
                        String(
                          item._id,
                        ),
                    ),
                  );

                const unique =
                  newItems.filter(
                    (item) =>
                      !ids.has(
                        String(
                          item._id,
                        ),
                      ),
                  );

                return [
                  ...previous,
                  ...unique,
                ];
              },
            );
          }

          pageRef.current =
            pageNumber;

          hasMoreRef.current =
            Boolean(
              response.hasMore,
            );

          setTotal(
            response.total || 0,
          );
        } catch (error) {
          console.log(
            "get complaints:",
            error?.response?.data
              || error?.message,
          );

          Alert.alert(
            "Error",
            error?.response?.data
              ?.message
              || "Failed to load complaints.",
          );
        } finally {
          setLoading(false);

          setRefreshing(false);

          if (loadMore) {
            loadingMoreRef.current =
              false;

            setLoadingMore(false);
          }
        }
      },
      [],
    );

  useFocusEffect(
    useCallback(() => {
      pageRef.current = 1;

      hasMoreRef.current = true;

      loadingMoreRef.current =
        false;

      endReachedRef.current =
        false;

      fetchComplaints(
        1,
        false,
        firstLoadRef.current,
      );

      firstLoadRef.current =
        false;
    }, [fetchComplaints]),
  );

  const handleRefresh = () => {
    if (
      refreshing
      || loadingMoreRef.current
    ) {
      return;
    }

    setRefreshing(true);

    pageRef.current = 1;

    hasMoreRef.current = true;

    endReachedRef.current =
      false;

    fetchComplaints(
      1,
      false,
      false,
    );
  };

  const handleLoadMore = () => {
    if (
      loadingMoreRef.current
      || !hasMoreRef.current
    ) {
      return;
    }

    const nextPage =
      pageRef.current + 1;

    fetchComplaints(
      nextPage,
      true,
      false,
    );
  };

  const handleEndReached = () => {
    if (
      endReachedRef.current
    ) {
      return;
    }

    endReachedRef.current =
      true;

    handleLoadMore();
  };

  const handleMomentumBegin = () => {
    endReachedRef.current =
      false;
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("Normal");
  };

  const closeModal = () => {
    if (submitting) {
      return;
    }

    setShowCreateModal(false);

    resetForm();
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert(
        "Validation",
        "Please enter complaint title.",
      );

      return;
    }

    if (!description.trim()) {
      Alert.alert(
        "Validation",
        "Please enter complaint description.",
      );

      return;
    }

    try {
      setSubmitting(true);

      const response =
        await createComplaintApi({
          title:
            title.trim(),

          description:
            description.trim(),

          priority,
        });

      if (response?.success) {
        setShowCreateModal(false);

        resetForm();

        pageRef.current = 1;

        hasMoreRef.current = true;

        endReachedRef.current =
          false;

        await fetchComplaints(
          1,
          false,
          false,
        );

        Alert.alert(
          "Success",
          response.message
            || "Complaint submitted successfully.",
        );
      }
    } catch (error) {
      Alert.alert(
        "Error",
        error?.response?.data
          ?.message
          || "Failed to create complaint.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date) => {
    if (!date) {
      return "";
    }

    return new Date(
      date,
    ).toLocaleDateString(
      "en-US",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      },
    );
  };

  const renderComplaint = ({
    item,
  }) => {
    const resolved =
      item.status === "Resolved";

    const high =
      item.priority === "High";

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() =>
          navigation.navigate(
            "ComplaintDetails",
            {
              complaintId:
                item._id,
            },
          )}
      >
        <View
          style={styles.cardTop}
        >
          <View
            style={styles.iconBox}
          >
            <Feather
              name="message-square"
              size={19}
              color="#DC2626"
            />
          </View>

          <View
            style={
              styles.cardMain
            }
          >
            <Text
              style={
                styles.cardTitle
              }
              numberOfLines={1}
            >
              {item.title}
            </Text>

            <Text
              style={
                styles.date
              }
            >
              {formatDate(
                item.createdAt,
              )}
            </Text>
          </View>

          <Feather
            name="chevron-right"
            size={20}
            color="#94A3B8"
          />
        </View>

        <Text
          style={
            styles.description
          }
          numberOfLines={2}
        >
          {item.description}
        </Text>

        <View
          style={styles.divider}
        />

        <View
          style={
            styles.badgeRow
          }
        >
          <View
            style={[
              styles.badge,
              {
                backgroundColor:
                  resolved
                    ? "#ECFDF5"
                    : "#FFF7ED",
              },
            ]}
          >
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    resolved
                      ? "#10B981"
                      : "#F97316",
                },
              ]}
            />

            <Text
              style={[
                styles.badgeText,
                {
                  color:
                    resolved
                      ? "#047857"
                      : "#C2410C",
                },
              ]}
            >
              {item.status}
            </Text>
          </View>

          <View
            style={[
              styles.badge,
              {
                backgroundColor:
                  high
                    ? "#FEE2E2"
                    : "#F1F5F9",
              },
            ]}
          >
            <Feather
              name={
                high
                  ? "alert-circle"
                  : "flag"
              }
              size={12}
              color={
                high
                  ? "#DC2626"
                  : "#64748B"
              }
            />

            <Text
              style={[
                styles.badgeText,
                {
                  color:
                    high
                      ? "#DC2626"
                      : "#64748B",
                },
              ]}
            >
              {item.priority}
            </Text>
          </View>

          {item.messageCount > 0 && (
            <View
              style={
                styles.messageCount
              }
            >
              <Feather
                name="message-circle"
                size={13}
                color={
                  colors.primary
                }
              />

              <Text
                style={
                  styles.messageCountText
                }
              >
                {item.messageCount}
              </Text>
            </View>
          )}
        </View>

        {item.lastMessage && (
          <View
            style={
              styles.lastMessage
            }
          >
            <Text
              style={
                styles.lastMessageRole
              }
            >
              {item.lastMessage
                .senderRole
                === "Admin"
                ? "Admin"
                : "You"}
            </Text>

            <Text
              style={
                styles.lastMessageText
              }
              numberOfLines={1}
            >
              {
                item.lastMessage
                  .text
              }
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <>
      <View
        style={styles.header}
      >
        <View>
          <Text
            style={styles.title}
          >
            Complaints
          </Text>

          <Text
            style={styles.subtitle}
          >
            Submit and track your complaints.
          </Text>
        </View>

        <View
          style={
            styles.totalBadge
          }
        >
          <Text
            style={
              styles.totalText
            }
          >
            {total}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={
          styles.addButton
        }
        onPress={() =>
          setShowCreateModal(true)}
      >
        <Feather
          name="plus-circle"
          size={18}
          color="#FFFFFF"
        />

        <Text
          style={
            styles.addButtonText
          }
        >
          Add Complaint
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderEmpty = () => (
    <View
      style={styles.empty}
    >
      <Feather
        name="message-square"
        size={32}
        color="#CBD5E1"
      />

      <Text
        style={
          styles.emptyTitle
        }
      >
        No Complaints
      </Text>

      <Text
        style={
          styles.emptyText
        }
      >
        You haven't submitted any complaints yet.
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) {
      return (
        <View
          style={{
            height: 20,
          }}
        />
      );
    }

    return (
      <View
        style={
          styles.footerLoader
        }
      >
        <ActivityIndicator
          size="small"
          color={colors.primary}
        />

        <Text
          style={
            styles.footerText
          }
        >
          Loading more...
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        commonStyles.container,
      ]}
    >
      <TopBar
        navigation={navigation}
        headerTitle="Complaints"
      />

      {loading
        && complaints.length === 0
        ? (
          <View
            style={
              styles.loader
            }
          >
            <ActivityIndicator
              size="large"
              color={
                colors.primary
              }
            />
          </View>
        )
        : (
          <FlatList
            data={complaints}
            keyExtractor={(item) =>
              String(item._id)}
            renderItem={
              renderComplaint
            }
            ListHeaderComponent={
              renderHeader
            }
            ListEmptyComponent={
              renderEmpty
            }
            ListFooterComponent={
              renderFooter
            }
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: 12,
                }}
              />
            )}
            contentContainerStyle={
              styles.listContent
            }
            showsVerticalScrollIndicator={
              false
            }
            onEndReached={
              handleEndReached
            }
            onEndReachedThreshold={
              0.15
            }
            onMomentumScrollBegin={
              handleMomentumBegin
            }
            refreshControl={
              <RefreshControl
                refreshing={
                  refreshing
                }
                onRefresh={
                  handleRefresh
                }
                colors={[
                  colors.primary,
                ]}
              />
            }
          />
        )}

      <Modal
        visible={
          showCreateModal
        }
        transparent
        animationType="fade"
        onRequestClose={
          closeModal
        }
      >
        <TouchableWithoutFeedback
          onPress={closeModal}
        >
          <View
            style={
              styles.overlay
            }
          >
            <TouchableWithoutFeedback>
              <View
                style={
                  styles.modal
                }
              >
                <View
                  style={
                    styles.modalHeader
                  }
                >
                  <Text
                    style={
                      styles.modalTitle
                    }
                  >
                    Add Complaint
                  </Text>

                  <TouchableOpacity
                    onPress={
                      closeModal
                    }
                  >
                    <Feather
                      name="x"
                      size={22}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                <Text
                  style={
                    styles.label
                  }
                >
                  Title
                </Text>

                <TextInput
                  style={
                    styles.input
                  }
                  value={title}
                  onChangeText={
                    setTitle
                  }
                  placeholder="Complaint title"
                  placeholderTextColor="#94A3B8"
                  maxLength={120}
                />

                <Text
                  style={
                    styles.label
                  }
                >
                  Priority
                </Text>

                <View
                  style={
                    styles.priorityRow
                  }
                >
                  {PRIORITIES.map(
                    (item) => (
                      <TouchableOpacity
                        key={
                          item.value
                        }
                        style={[
                          styles.priorityButton,

                          priority
                            === item.value
                            && styles.priorityActive,
                        ]}
                        onPress={() =>
                          setPriority(
                            item.value,
                          )}
                      >
                        <Text
                          style={[
                            styles.priorityText,

                            priority
                              === item.value
                              && styles.priorityActiveText,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ),
                  )}
                </View>

                <Text
                  style={
                    styles.label
                  }
                >
                  Description
                </Text>

                <TextInput
                  style={[
                    styles.input,
                    styles.textArea,
                  ]}
                  value={
                    description
                  }
                  onChangeText={
                    setDescription
                  }
                  placeholder="Describe your complaint..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  textAlignVertical="top"
                  maxLength={2000}
                />

                <View
                  style={
                    styles.modalButtons
                  }
                >
                  <TouchableOpacity
                    style={
                      styles.cancel
                    }
                    disabled={
                      submitting
                    }
                    onPress={
                      closeModal
                    }
                  >
                    <Text
                      style={
                        styles.cancelText
                      }
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={
                      styles.submit
                    }
                    disabled={
                      submitting
                    }
                    onPress={
                      handleCreate
                    }
                  >
                    {submitting
                      ? (
                        <ActivityIndicator
                          size="small"
                          color="#FFFFFF"
                        />
                      )
                      : (
                        <>
                          <Feather
                            name="send"
                            size={16}
                            color="#FFFFFF"
                          />

                          <Text
                            style={
                              styles.submitText
                            }
                          >
                            Submit
                          </Text>
                        </>
                      )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {role === "Child"
        ? (
          <ChildBottomBar
            activeTab=""
          />
        )
        : (
          <BottomBar
            activeTab=""
          />
        )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  listContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 30,
  },

  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  title: {
    fontSize: 24,
    fontFamily: fonts.semiBold,
    color: "#191C20",
  },

  subtitle: {
    marginTop: 3,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#64748B",
  },

  totalBadge: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor:
      "rgba(0,80,134,0.10)",
  },

  totalText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },

  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 18,
  },

  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: fonts.semiBold,
  },

  card: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
  },

  cardMain: {
    flex: 1,
    marginLeft: 12,
  },

  cardTitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: "#191C20",
  },

  date: {
    marginTop: 3,
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "#94A3B8",
  },

  description: {
    marginTop: 13,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: "#64748B",
  },

  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 13,
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  badgeText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },

  messageCount: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  messageCountText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },

  lastMessage: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
  },

  lastMessageRole: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },

  lastMessageText: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#64748B",
  },

  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },

  footerText: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#64748B",
  },

  empty: {
    paddingVertical: 50,
    alignItems: "center",
  },

  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: "#334155",
  },

  emptyText: {
    marginTop: 5,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#94A3B8",
  },

  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor:
      "rgba(15,23,42,0.45)",
  },

  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  modalTitle: {
    fontSize: 20,
    fontFamily: fonts.semiBold,
    color: "#191C20",
  },

  label: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: "#334155",
    marginBottom: 6,
  },

  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 11,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 14,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#0F172A",
  },

  textArea: {
    height: 120,
  },

  priorityRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },

  priorityButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
  },

  priorityActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  priorityText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: "#64748B",
  },

  priorityActiveText: {
    color: "#FFFFFF",
  },

  modalButtons: {
    flexDirection: "row",
    gap: 10,
  },

  cancel: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 11,
  },

  cancelText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: "#475569",
  },

  submit: {
    flex: 1,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 11,
    backgroundColor: colors.primary,
  },

  submitText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
  },
});