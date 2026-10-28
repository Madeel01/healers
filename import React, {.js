import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { jwtDecode } from 'jwt-decode';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/poppins';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from '@react-navigation/native';

import {
  addInvoicePaymentApi,
  AssignTheraistChild,
  createInvoiceApi,
  getInvoiceChildrenApi,
  getInvoicesApi,
  getServices,
  updateInvoiceStatusApi,
} from '../../api/admin/api';
import {
  addGoalToProgramApi,
  AddPrograms,
  deleteGoalApi,
  deleteProgramApi,
  getChildPrograms,
} from '../../api/therapist/api';
import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';
import { sendInvoiceBroadcast } from '../../utils/invoiceBroadcast';
import {
  fontSize,
  hp,
  wp,
} from '../../utils/responsive';
import { updateOnlineStatusApi } from '../api/authApi';
import {
  clearAuthData,
  getAuthData,
  setAuthData,
} from '../utils/storage';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

const CHILD_LIMIT = 10;

const getTodayDate = () => {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getDefaultDueDate = () => {
  const date = new Date();

  date.setDate(
    date.getDate() + 7,
  );

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getInitials = (name = "") => {
  if (!name) {
    return "C";
  }

  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const formatMoney = (value) =>
  Number(value || 0).toLocaleString(
    "en-PK",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  );

const formatPackageType = (type = "") => {
  if (!type) {
    return "";
  }

  return type
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
};

const createEmptyItem = () => ({
  id: Date.now().toString(),
  packageId: null,
  package: "",
  packageType: "",
  sessions: "1",
  rate: "0",
  discount: "0",
});

export default function CreateNewInvoiceScreen({
  navigation,
}) {
  const [
    childSearch,
    setChildSearch,
  ] = useState("");

  const [
    children,
    setChildren,
  ] = useState([]);

  const [
    selectedChild,
    setSelectedChild,
  ] = useState(null);

  const [
    childrenLoading,
    setChildrenLoading,
  ] = useState(false);

  const [
    childrenLoadingMore,
    setChildrenLoadingMore,
  ] = useState(false);

  const [
    childPage,
    setChildPage,
  ] = useState(1);

  const [
    childHasMore,
    setChildHasMore,
  ] = useState(false);

  const [
    invoiceDate,
    setInvoiceDate,
  ] = useState(getTodayDate());

  const [
    dueDate,
    setDueDate,
  ] = useState(getDefaultDueDate());

  const [invoiceNumber] =
    useState("Auto generated");

  const [
    items,
    setItems,
  ] = useState([
    {
      id: "1",
      packageId: null,
      package: "",
      packageType: "",
      sessions: "1",
      rate: "0",
      discount: "0",
    },
  ]);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const searchTimerRef =
    useRef(null);

  const requestIdRef =
    useRef(0);

  const loadChildren = useCallback(
    async ({
      search = "",
      page = 1,
      append = false,
    } = {}) => {
      const requestId =
        ++requestIdRef.current;

      try {
        if (append) {
          setChildrenLoadingMore(
            true,
          );
        } else {
          setChildrenLoading(true);
        }

        const response =
          await getInvoiceChildrenApi({
            search: search.trim(),
            page,
            limit: CHILD_LIMIT,
          });

        if (
          requestId
          !== requestIdRef.current
        ) {
          return;
        }

        const result =
          response?.data
          || response;

        if (!result?.success) {
          if (!append) {
            setChildren([]);
          }

          setChildHasMore(false);

          return;
        }

        const newChildren =
          Array.isArray(result.data)
            ? result.data
            : [];

        if (append) {
          setChildren(
            (previous) => {
              const existingIds =
                new Set(
                  previous.map(
                    (child) =>
                      String(
                        child._id
                        || child.id,
                      ),
                  ),
                );

              const uniqueChildren =
                newChildren.filter(
                  (child) =>
                    !existingIds.has(
                      String(
                        child._id
                        || child.id,
                      ),
                    ),
                );

              return [
                ...previous,
                ...uniqueChildren,
              ];
            },
          );
        } else {
          setChildren(
            newChildren,
          );
        }

        setChildPage(
          Number(
            result
              ?.pagination
              ?.page,
          ) || page,
        );

        setChildHasMore(
          Boolean(
            result
              ?.pagination
              ?.hasMore,
          ),
        );
      } catch (error) {
        if (
          requestId
          !== requestIdRef.current
        ) {
          return;
        }

        console.log(
          "getInvoiceChildren error:",
          error?.response?.data
          || error?.message
          || error,
        );

        if (!append) {
          setChildren([]);
        }

        setChildHasMore(false);
      } finally {
        if (
          requestId
          === requestIdRef.current
        ) {
          setChildrenLoading(
            false,
          );

          setChildrenLoadingMore(
            false,
          );
        }
      }
    },
    [],
  );

  useEffect(() => {
    loadChildren({
      search: "",
      page: 1,
    });

    return () => {
      requestIdRef.current += 1;

      if (
        searchTimerRef.current
      ) {
        clearTimeout(
          searchTimerRef.current,
        );
      }
    };
  }, [loadChildren]);

  useEffect(() => {
    if (selectedChild) {
      return undefined;
    }

    if (
      searchTimerRef.current
    ) {
      clearTimeout(
        searchTimerRef.current,
      );
    }

    searchTimerRef.current =
      setTimeout(() => {
        setChildPage(1);

        loadChildren({
          search: childSearch,
          page: 1,
        });
      }, 500);

    return () => {
      if (
        searchTimerRef.current
      ) {
        clearTimeout(
          searchTimerRef.current,
        );
      }
    };
  }, [
    childSearch,
    selectedChild,
    loadChildren,
  ]);

  const handleLoadMoreChildren =
    () => {
      if (
        childrenLoading
        || childrenLoadingMore
        || !childHasMore
      ) {
        return;
      }

      loadChildren({
        search: childSearch,
        page: childPage + 1,
        append: true,
      });
    };

  const handleSelectChild = (
    child,
  ) => {
    requestIdRef.current += 1;

    if (
      searchTimerRef.current
    ) {
      clearTimeout(
        searchTimerRef.current,
      );
    }

    setSelectedChild(child);

    setChildSearch("");
    setChildren([]);
    setChildHasMore(false);
    setChildrenLoading(false);
    setChildrenLoadingMore(
      false,
    );

    if (child?.package) {
      const packagePrice =
        Number(
          child.package.price,
        ) || 0;

      const hasDiscountedPrice =
        child.discountedPrice
          !== null
        && child.discountedPrice
          !== undefined;

      const finalPrice =
        hasDiscountedPrice
          ? Number(
              child.discountedPrice,
            ) || 0
          : packagePrice;

      setItems([
        {
          id:
            Date.now()
              .toString(),

          packageId:
            child.package._id
            || null,

          package:
            child.package.name
            || "",

          packageType:
            child.package.type
            || "",

          sessions: "1",

          rate:
            String(finalPrice),

          discount: "0",
        },
      ]);
    } else {
      setItems([
        createEmptyItem(),
      ]);
    }
  };

  const handleChangeChild = () => {
    requestIdRef.current += 1;

    setSelectedChild(null);
    setChildSearch("");
    setChildPage(1);
    setChildHasMore(false);

    setItems([
      {
        id: "1",
        packageId: null,
        package: "",
        packageType: "",
        sessions: "1",
        rate: "0",
        discount: "0",
      },
    ]);

    loadChildren({
      search: "",
      page: 1,
    });
  };

  const handleAddItem = () => {
    setItems((previous) => [
      ...previous,
      {
        id:
          `${Date.now()}-${previous.length}`,

        packageId:
          selectedChild
            ?.package
            ?._id
          || null,

        package:
          selectedChild
            ?.package
            ?.name
          || "",

        packageType:
          selectedChild
            ?.package
            ?.type
          || "",

        sessions: "1",

        rate: selectedChild
          ?.package
          ? String(
              selectedChild
                .discountedPrice
                !== null
              && selectedChild
                .discountedPrice
                !== undefined
                ? selectedChild
                    .discountedPrice
                : selectedChild
                    .package
                    .price
                    || 0,
            )
          : "0",

        discount: "0",
      },
    ]);
  };

  const handleRemoveItem = (
    id,
  ) => {
    if (items.length <= 1) {
      Alert.alert(
        "Invoice Item",
        "Invoice must contain at least one item.",
      );

      return;
    }

    setItems((previous) =>
      previous.filter(
        (item) =>
          item.id !== id,
      ),
    );
  };

  const handleItemChange = (
    index,
    field,
    value,
  ) => {
    setItems((previous) =>
      previous.map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [field]: value,
              }
            : item,
      ),
    );
  };

  const subtotal =
    items.reduce(
      (sum, item) => {
        const sessions =
          Number(
            item.sessions,
          ) || 0;

        const rate =
          Number(
            item.rate,
          ) || 0;

        const discount =
          Math.min(
            Math.max(
              Number(
                item.discount,
              ) || 0,
              0,
            ),
            100,
          );

        const base =
          sessions * rate;

        const discountAmount =
          base
          * (discount / 100);

        return (
          sum
          + (
            base
            - discountAmount
          )
        );
      },
      0,
    );

  const taxPercentage = 5;

  const tax =
    subtotal
    * (
      taxPercentage
      / 100
    );

  const totalAmount =
    subtotal + tax;

  const validateForm = () => {
    if (!selectedChild) {
      Alert.alert(
        "Select Child",
        "Please select a child.",
      );

      return false;
    }

    if (
      !invoiceDate.trim()
    ) {
      Alert.alert(
        "Invoice Date",
        "Please enter the invoice date.",
      );

      return false;
    }

    if (!dueDate.trim()) {
      Alert.alert(
        "Due Date",
        "Please enter the due date.",
      );

      return false;
    }

    for (
      let index = 0;
      index < items.length;
      index += 1
    ) {
      const item =
        items[index];

      const sessions =
        Number(
          item.sessions,
        );

      const rate =
        Number(
          item.rate,
        );

      const discount =
        Number(
          item.discount,
        );

      if (!item.package) {
        Alert.alert(
          "Service Required",
          `No package is available for item ${index + 1}.`,
        );

        return false;
      }

      if (
        Number.isNaN(
          sessions,
        )
        || sessions <= 0
      ) {
        Alert.alert(
          "Invalid Sessions",
          `Enter valid sessions for item ${index + 1}.`,
        );

        return false;
      }

      if (
        Number.isNaN(rate)
        || rate < 0
      ) {
        Alert.alert(
          "Invalid Rate",
          `Enter a valid rate for item ${index + 1}.`,
        );

        return false;
      }

      if (
        Number.isNaN(
          discount,
        )
        || discount < 0
        || discount > 100
      ) {
        Alert.alert(
          "Invalid Discount",
          `Discount must be between 0 and 100 for item ${index + 1}.`,
        );

        return false;
      }
    }

    return true;
  };

  const buildInvoicePayload = (
    status = "Pending",
  ) => {
    const childId =
      selectedChild?._id
      || selectedChild?.id;

    return {
      childId,

      invoiceDate,

      dueDate,

      items: items.map(
        (item) => {
          const sessions =
            Number(
              item.sessions,
            ) || 0;

          const rate =
            Number(
              item.rate,
            ) || 0;

          const discount =
            Number(
              item.discount,
            ) || 0;

          const base =
            sessions
            * rate;

          const itemAmount =
            base
            - (
              base
              * (
                discount
                / 100
              )
            );

          return {
            packageId:
              item.packageId
              || undefined,

            serviceName:
              item.package,

            description:
              item.packageType
                ? formatPackageType(
                    item.packageType,
                  )
                : "",

            quantity:
              sessions,

            rate,

            discount,

            amount:
              Number(
                itemAmount
                  .toFixed(2),
              ),

            durationUnit:
              "session",
          };
        },
      ),

      discountType:
        "none",

      discountValue: 0,

      taxPercentage,

      clinicalSummary: "",

      notes:
        "Thanks for your business.",

      termsAndConditions:
        "",

      status,
    };
  };

  const handleSubmitInvoice =
    async (
      status = "Pending",
    ) => {
      if (!validateForm()) {
        return;
      }

      if (submitting) {
        return;
      }

      try {
        setSubmitting(true);

        const payload =
          buildInvoicePayload(
            status,
          );

        console.log(
          "invoice payload:",
          payload,
        );

        const response =
          await createInvoiceApi(
            payload,
          );

        const result =
          response?.data
          || response;

        if (!result?.success) {
          Alert.alert(
            "Error",
            result?.message
            || "Unable to create invoice.",
          );

          return;
        }

        const createdInvoice =
          result.data;

        Alert.alert(
          status === "Draft"
            ? "Draft Saved"
            : "Invoice Created",

          status === "Draft"
            ? "Invoice draft saved successfully."
            : "Invoice created successfully.",

          [
            {
              text:
                "View Invoice",

              onPress: () => {
                navigation.replace(
                  "InvoiceView",
                  {
                    invoiceId:
                      createdInvoice
                        ?._id,
                  },
                );
              },
            },

            {
              text: "Done",

              onPress: () =>
                navigation.goBack(),
            },
          ],
        );
      } catch (error) {
        console.log(
          "createInvoice error:",
          error?.response?.data
          || error?.message
          || error,
        );

        Alert.alert(
          "Error",
          error?.response
            ?.data
            ?.message
          || "Unable to create invoice.",
        );
      } finally {
        setSubmitting(false);
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
        headerTitle="Create New Invoice"
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View
            style={
              styles.cardHeader
            }
          >
            <Feather
              name="user-check"
              size={18}
              color={
                colors.primary
              }
            />

            <Text
              style={
                styles.cardHeaderTitle
              }
            >
              Client Selection
            </Text>
          </View>

          <Text
            style={
              styles.inputLabel
            }
          >
            Select Child
          </Text>

          {!selectedChild ? (
            <>
              <View
                style={
                  styles.searchContainer
                }
              >
                <Feather
                  name="search"
                  size={18}
                  color="#64748B"
                  style={
                    styles.searchIcon
                  }
                />

                <TextInput
                  style={
                    styles.searchInput
                  }
                  value={
                    childSearch
                  }
                  onChangeText={
                    setChildSearch
                  }
                  placeholder="Search child by name, email, phone or father..."
                  placeholderTextColor="#94A3B8"
                  autoCorrect={
                    false
                  }
                  autoCapitalize="none"
                />

                {childrenLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.primary
                    }
                  />
                ) : childSearch ? (
                  <TouchableOpacity
                    onPress={() =>
                      setChildSearch(
                        "",
                      )
                    }
                  >
                    <Feather
                      name="x"
                      size={18}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View
                style={
                  styles.childrenList
                }
              >
                {childrenLoading
                && children.length
                  === 0 ? (
                  <View
                    style={
                      styles.childLoadingContainer
                    }
                  >
                    <ActivityIndicator
                      size="small"
                      color={
                        colors.primary
                      }
                    />

                    <Text
                      style={
                        styles.childLoadingText
                      }
                    >
                      Loading children...
                    </Text>
                  </View>
                ) : children.length
                  === 0 ? (
                  <View
                    style={
                      styles.noChildrenContainer
                    }
                  >
                    <View
                      style={
                        styles.emptyIconCircle
                      }
                    >
                      <Feather
                        name="users"
                        size={24}
                        color="#94A3B8"
                      />
                    </View>

                    <Text
                      style={
                        styles.noChildrenTitle
                      }
                    >
                      No children found
                    </Text>

                    <Text
                      style={
                        styles.noChildrenText
                      }
                    >
                      Try another name,
                      email, phone,
                      father name or CNIC.
                    </Text>
                  </View>
                ) : (
                  <>
                    {children.map(
                      (child) => {
                        const childId =
                          child._id
                          || child.id;

                        return (
                          <TouchableOpacity
                            key={String(
                              childId,
                            )}
                            style={
                              styles.childSearchItem
                            }
                            activeOpacity={
                              0.7
                            }
                            onPress={() =>
                              handleSelectChild(
                                child,
                              )
                            }
                          >
                            {child.profileImage ? (
                              <Image
                                source={{
                                  uri:
                                    child.profileImage,
                                }}
                                style={
                                  styles.searchAvatar
                                }
                              />
                            ) : (
                              <View
                                style={
                                  styles.avatarFallback
                                }
                              >
                                <Text
                                  style={
                                    styles.avatarFallbackText
                                  }
                                >
                                  {getInitials(
                                    child.fullName,
                                  )}
                                </Text>
                              </View>
                            )}

                            <View
                              style={
                                styles.childSearchInfo
                              }
                            >
                              <Text
                                style={
                                  styles.childSearchName
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                {
                                  child.fullName
                                }
                              </Text>

                              <Text
                                style={
                                  styles.childSearchMeta
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                {child.fatherName
                                  ? `Father: ${child.fatherName}`
                                  : "Father information not available"}
                              </Text>

                              <Text
                                style={
                                  styles.childSearchEmail
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                {child.email
                                  || child.phone
                                  || "No contact information"}
                              </Text>

                              {child.package && (
                                <Text
                                  style={
                                    styles.packageSearchText
                                  }
                                  numberOfLines={
                                    1
                                  }
                                >
                                  Package:{" "}
                                  {
                                    child
                                      .package
                                      .name
                                  }
                                  {" • "}
                                  PKR{" "}
                                  {formatMoney(
                                    child
                                      .discountedPrice
                                      !== null
                                    && child
                                      .discountedPrice
                                      !== undefined
                                      ? child
                                          .discountedPrice
                                      : child
                                          .package
                                          .price,
                                  )}
                                </Text>
                              )}
                            </View>

                            <Feather
                              name="chevron-right"
                              size={20}
                              color="#94A3B8"
                            />
                          </TouchableOpacity>
                        );
                      },
                    )}

                    {childHasMore && (
                      <TouchableOpacity
                        style={
                          styles.loadMoreChildrenBtn
                        }
                        activeOpacity={
                          0.7
                        }
                        disabled={
                          childrenLoadingMore
                        }
                        onPress={
                          handleLoadMoreChildren
                        }
                      >
                        {childrenLoadingMore ? (
                          <ActivityIndicator
                            size="small"
                            color={
                              colors.primary
                            }
                          />
                        ) : (
                          <>
                            <Feather
                              name="plus-circle"
                              size={16}
                              color={
                                colors.primary
                              }
                            />

                            <Text
                              style={
                                styles.loadMoreChildrenText
                              }
                            >
                              Load More
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </>
          ) : (
            <View
              style={
                styles.selectedChildCard
              }
            >
              {selectedChild.profileImage ? (
                <Image
                  source={{
                    uri:
                      selectedChild
                        .profileImage,
                  }}
                  style={
                    styles.avatar
                  }
                />
              ) : (
                <View
                  style={
                    styles.selectedAvatarFallback
                  }
                >
                  <Text
                    style={
                      styles.avatarFallbackText
                    }
                  >
                    {getInitials(
                      selectedChild
                        .fullName,
                    )}
                  </Text>
                </View>
              )}

              <View
                style={
                  styles.childInfo
                }
              >
                <Text
                  style={
                    styles.childName
                  }
                  numberOfLines={1}
                >
                  {
                    selectedChild
                      .fullName
                  }
                </Text>

                <Text
                  style={
                    styles.childSubtext
                  }
                  numberOfLines={1}
                >
                  {selectedChild
                    .fatherName
                    ? `Father: ${selectedChild.fatherName}`
                    : "Father information not available"}
                </Text>

                {!!selectedChild
                  .fatherCnic && (
                  <Text
                    style={
                      styles.childEmail
                    }
                    numberOfLines={
                      1
                    }
                  >
                    CNIC:{" "}
                    {
                      selectedChild
                        .fatherCnic
                    }
                  </Text>
                )}

                {!!selectedChild
                  .email && (
                  <Text
                    style={
                      styles.childEmail
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {
                      selectedChild
                        .email
                    }
                  </Text>
                )}

                {!!selectedChild
                  .package && (
                  <View
                    style={
                      styles.packageBadge
                    }
                  >
                    <Feather
                      name="package"
                      size={12}
                      color="#0369A1"
                    />

                    <Text
                      style={
                        styles.packageBadgeText
                      }
                      numberOfLines={
                        1
                      }
                    >
                      {
                        selectedChild
                          .package
                          .name
                      }
                    </Text>
                  </View>
                )}
              </View>

              <View
                style={
                  styles.selectedActions
                }
              >
                <Feather
                  name="check-circle"
                  size={20}
                  color="#059669"
                />

                <TouchableOpacity
                  style={
                    styles.changeChildBtn
                  }
                  onPress={
                    handleChangeChild
                  }
                >
                  <Feather
                    name="edit-2"
                    size={14}
                    color={
                      colors.primary
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View
            style={
              styles.cardHeader
            }
          >
            <Feather
              name="file-text"
              size={18}
              color={
                colors.primary
              }
            />

            <Text
              style={
                styles.cardHeaderTitle
              }
            >
              Billing Details
            </Text>
          </View>

          <View style={styles.row}>
            <View
              style={
                styles.halfColumn
              }
            >
              <Text
                style={
                  styles.inputLabel
                }
              >
                Invoice Date
              </Text>

              <TextInput
                style={
                  styles.textInput
                }
                value={
                  invoiceDate
                }
                onChangeText={
                  setInvoiceDate
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View
              style={
                styles.halfColumn
              }
            >
              <Text
                style={
                  styles.inputLabel
                }
              >
                Due Date
              </Text>

              <TextInput
                style={
                  styles.textInput
                }
                value={dueDate}
                onChangeText={
                  setDueDate
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <Text
            style={
              styles.inputLabel
            }
          >
            Invoice Number
          </Text>

          <TextInput
            style={[
              styles.textInput,
              styles.disabledInput,
            ]}
            value={
              invoiceNumber
            }
            editable={false}
          />

          <Text
            style={
              styles.invoiceNumberHint
            }
          >
            Invoice number will
            be generated
            automatically when
            saved.
          </Text>
        </View>

        <View style={styles.card}>
          <View
            style={
              styles.cardHeader
            }
          >
            <Feather
              name="shopping-bag"
              size={18}
              color={
                colors.primary
              }
            />

            <Text
              style={
                styles.cardHeaderTitle
              }
            >
              Services & Items
            </Text>
          </View>

          {items.map(
            (item, index) => {
              const itemBase =
                (
                  Number(
                    item.sessions,
                  ) || 0
                )
                * (
                  Number(
                    item.rate,
                  ) || 0
                );

              const itemDiscount =
                Math.min(
                  Math.max(
                    Number(
                      item.discount,
                    ) || 0,
                    0,
                  ),
                  100,
                );

              const itemTotal =
                itemBase
                * (
                  1
                  - itemDiscount
                    / 100
                );

              return (
                <View
                  key={
                    item.id
                  }
                  style={
                    styles.itemBox
                  }
                >
                  {items.length
                    > 1 && (
                    <TouchableOpacity
                      style={
                        styles.removeIconBtn
                      }
                      onPress={() =>
                        handleRemoveItem(
                          item.id,
                        )
                      }
                    >
                      <Feather
                        name="x"
                        size={14}
                        color="#E11D48"
                      />
                    </TouchableOpacity>
                  )}

                  <Text
                    style={
                      styles.itemNumber
                    }
                  >
                    Item{" "}
                    {index + 1}
                  </Text>

                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Service Package
                  </Text>

                  <View
                    style={
                      styles.packageDisplay
                    }
                  >
                    <View
                      style={
                        styles.packageIcon
                      }
                    >
                      <Feather
                        name="package"
                        size={17}
                        color="#0369A1"
                      />
                    </View>

                    <View
                      style={
                        styles.packageDisplayInfo
                      }
                    >
                      <Text
                        style={[
                          styles.packageName,
                          !item.package
                          && styles.packageEmpty,
                        ]}
                        numberOfLines={
                          1
                        }
                      >
                        {item.package
                          || "No package assigned"}
                      </Text>

                      {!!item
                        .packageType && (
                        <Text
                          style={
                            styles.packageType
                          }
                        >
                          {formatPackageType(
                            item.packageType,
                          )}
                        </Text>
                      )}
                    </View>
                  </View>

                  {selectedChild
                    ?.package
                    && item.packageId
                    === selectedChild
                      .package
                      ._id && (
                    <View
                      style={
                        styles.priceInfoBox
                      }
                    >
                      <View
                        style={
                          styles.priceInfoRow
                        }
                      >
                        <Text
                          style={
                            styles.priceInfoLabel
                          }
                        >
                          Package Price
                        </Text>

                        <Text
                          style={
                            styles.priceInfoValue
                          }
                        >
                          PKR{" "}
                          {formatMoney(
                            selectedChild
                              .package
                              .price,
                          )}
                        </Text>
                      </View>

                      {selectedChild
                        .discountedPrice
                        !== null
                      && selectedChild
                        .discountedPrice
                        !== undefined && (
                        <View
                          style={
                            styles.priceInfoRow
                          }
                        >
                          <Text
                            style={
                              styles.discountPriceLabel
                            }
                          >
                            Child Price
                          </Text>

                          <Text
                            style={
                              styles.discountPriceValue
                            }
                          >
                            PKR{" "}
                            {formatMoney(
                              selectedChild
                                .discountedPrice,
                            )}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  <View
                    style={
                      styles.itemRow
                    }
                  >
                    <View
                      style={
                        styles.itemCol
                      }
                    >
                      <Text
                        style={
                          styles.smallInputLabel
                        }
                      >
                        Sessions
                      </Text>

                      <TextInput
                        style={
                          styles.textInputCenter
                        }
                        value={
                          item.sessions
                        }
                        keyboardType="numeric"
                        onChangeText={(
                          value,
                        ) =>
                          handleItemChange(
                            index,
                            "sessions",
                            value,
                          )
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.itemCol
                      }
                    >
                      <Text
                        style={
                          styles.smallInputLabel
                        }
                      >
                        Rate
                      </Text>

                      <TextInput
                        style={
                          styles.textInputCenter
                        }
                        value={
                          item.rate
                        }
                        keyboardType="decimal-pad"
                        onChangeText={(
                          value,
                        ) =>
                          handleItemChange(
                            index,
                            "rate",
                            value,
                          )
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.itemCol
                      }
                    >
                      <Text
                        style={
                          styles.smallInputLabel
                        }
                      >
                        Disc (%)
                      </Text>

                      <TextInput
                        style={
                          styles.textInputCenter
                        }
                        value={
                          item.discount
                        }
                        keyboardType="decimal-pad"
                        onChangeText={(
                          value,
                        ) =>
                          handleItemChange(
                            index,
                            "discount",
                            value,
                          )
                        }
                      />
                    </View>
                  </View>

                  <View
                    style={
                      styles.itemTotalRow
                    }
                  >
                    <Text
                      style={
                        styles.itemTotalLabel
                      }
                    >
                      Item Total
                    </Text>

                    <Text
                      style={
                        styles.itemTotalValue
                      }
                    >
                      PKR{" "}
                      {formatMoney(
                        itemTotal,
                      )}
                    </Text>
                  </View>
                </View>
              );
            },
          )}

          <TouchableOpacity
            style={
              styles.addItemBtn
            }
            onPress={
              handleAddItem
            }
          >
            <Feather
              name="plus-circle"
              size={18}
              color="#00497B"
            />

            <Text
              style={
                styles.addItemBtnText
              }
            >
              Add Another Item
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={
            styles.summaryCard
          }
        >
          <View
            style={
              styles.summaryRow
            }
          >
            <Text
              style={
                styles.summaryLabel
              }
            >
              Subtotal
            </Text>

            <Text
              style={
                styles.summaryValue
              }
            >
              PKR{" "}
              {formatMoney(
                subtotal,
              )}
            </Text>
          </View>

          <View
            style={
              styles.summaryRow
            }
          >
            <Text
              style={
                styles.summaryLabel
              }
            >
              Tax (VAT 5%)
            </Text>

            <Text
              style={
                styles.summaryValue
              }
            >
              PKR{" "}
              {formatMoney(tax)}
            </Text>
          </View>

          <View
            style={
              styles.summaryDivider
            }
          />

          <View
            style={
              styles.summaryTotalRow
            }
          >
            <Text
              style={
                styles.totalLabel
              }
            >
              Total Amount
            </Text>

            <Text
              style={
                styles.totalValue
              }
            >
              PKR{" "}
              {formatMoney(
                totalAmount,
              )}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.draftBtn,
            submitting
            && styles.disabledButton,
          ]}
          activeOpacity={0.8}
          disabled={
            submitting
          }
          onPress={() =>
            handleSubmitInvoice(
              "Draft",
            )
          }
        >
          {submitting ? (
            <ActivityIndicator
              size="small"
              color="#00497B"
            />
          ) : (
            <Text
              style={
                styles.draftBtnText
              }
            >
              Save as Draft
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.generateBtn,
            submitting
            && styles.disabledButton,
          ]}
          activeOpacity={0.8}
          disabled={
            submitting
          }
          onPress={() =>
            handleSubmitInvoice(
              "Pending",
            )
          }
        >
          {submitting ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <>
              <Feather
                name="send"
                size={16}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.generateBtnText
                }
              >
                Generate Invoice
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <BottomBar
        activeTab="Home"
      />
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    mainContainer: {
      flex: 1,
      backgroundColor:
        "#F8FAFC",
    },

    scrollArea: {
      flex: 1,
    },

    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 30,
    },

    card: {
      backgroundColor:
        "#FFFFFF",
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor:
        "#F1F5F9",
      elevation: 1,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },

    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
      gap: 8,
    },

    cardHeaderTitle: {
      fontSize: 16,
      fontFamily:
        fonts.semiBold,
      color: colors.primary,
      lineHeight: 24,
    },

    inputLabel: {
      fontSize: 15,
      fontFamily:
        fonts.regular,
      color:
        colors.blackFont,
      marginBottom: 6,
      lineHeight: 22,
    },

    smallInputLabel: {
      fontSize: 12,
      fontFamily:
        fonts.regular,
      color: "#64748B",
      marginBottom: 6,
      textAlign: "center",
    },

    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        "#F7FAFD",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 12,
      paddingHorizontal: 14,
      minHeight: 48,
      marginBottom: 10,
    },

    searchIcon: {
      marginRight: 8,
    },

    searchInput: {
      flex: 1,
      fontSize: 14,
      color: "#181C1E",
      fontFamily:
        fonts.regular,
      paddingVertical: 0,
    },

    childrenList: {
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor:
        "#FFFFFF",
    },

    childSearchItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor:
        "#F1F5F9",
    },

    searchAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: 11,
      backgroundColor:
        "#F1F5F9",
    },

    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: 12,
      backgroundColor:
        "#E2E8F0",
    },

    avatarFallback: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: 11,
      backgroundColor:
        "#DDECF5",
      alignItems: "center",
      justifyContent:
        "center",
    },

    selectedAvatarFallback: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: 12,
      backgroundColor:
        "#DDECF5",
      alignItems: "center",
      justifyContent:
        "center",
    },

    avatarFallbackText: {
      fontSize: 14,
      color: colors.primary,
      fontFamily: fonts.bold,
    },

    childSearchInfo: {
      flex: 1,
      marginRight: 8,
    },

    childSearchName: {
      fontSize: 14,
      lineHeight: 20,
      color: "#0F172A",
      fontFamily:
        fonts.semiBold,
    },

    childSearchMeta: {
      marginTop: 2,
      fontSize: 11,
      lineHeight: 16,
      color: "#64748B",
      fontFamily:
        fonts.regular,
    },

    childSearchEmail: {
      marginTop: 1,
      fontSize: 10,
      lineHeight: 15,
      color: "#94A3B8",
      fontFamily:
        fonts.regular,
    },

    packageSearchText: {
      marginTop: 3,
      fontSize: 10,
      lineHeight: 15,
      color: "#0369A1",
      fontFamily:
        fonts.semiBold,
    },

    childLoadingContainer: {
      paddingVertical: 30,
      alignItems: "center",
      justifyContent:
        "center",
    },

    childLoadingText: {
      marginTop: 8,
      fontSize: 12,
      color: "#64748B",
      fontFamily:
        fonts.regular,
    },

    noChildrenContainer: {
      paddingVertical: 28,
      paddingHorizontal: 20,
      alignItems: "center",
    },

    emptyIconCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor:
        "#F1F5F9",
      alignItems: "center",
      justifyContent:
        "center",
    },

    noChildrenTitle: {
      marginTop: 10,
      fontSize: 14,
      color: "#334155",
      fontFamily:
        fonts.semiBold,
    },

    noChildrenText: {
      marginTop: 4,
      fontSize: 11,
      lineHeight: 16,
      textAlign: "center",
      color: "#94A3B8",
      fontFamily:
        fonts.regular,
    },

    loadMoreChildrenBtn: {
      height: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 7,
      backgroundColor:
        "#F8FAFC",
    },

    loadMoreChildrenText: {
      fontSize: 12,
      color: colors.primary,
      fontFamily:
        fonts.semiBold,
    },

    selectedChildCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        "#F1F5F9",
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor:
        "#DDE7EF",
    },

    childInfo: {
      flex: 1,
    },

    childName: {
      fontSize: 16,
      fontFamily:
        fonts.semiBold,
      color: colors.primary,
      lineHeight: 22,
    },

    childSubtext: {
      marginTop: 2,
      fontSize: 12,
      color:
        colors.blackFont,
      fontFamily:
        fonts.regular,
      lineHeight: 16,
    },

    childEmail: {
      marginTop: 2,
      fontSize: 10,
      color: "#64748B",
      fontFamily:
        fonts.regular,
    },

    packageBadge: {
      alignSelf:
        "flex-start",
      marginTop: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 20,
      backgroundColor:
        "#E0F2FE",
    },

    packageBadgeText: {
      maxWidth: 180,
      fontSize: 10,
      color: "#0369A1",
      fontFamily:
        fonts.semiBold,
    },

    selectedActions: {
      alignItems: "center",
      justifyContent:
        "center",
      gap: 9,
      marginLeft: 8,
    },

    changeChildBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor:
        "#FFFFFF",
      alignItems: "center",
      justifyContent:
        "center",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
    },

    row: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 12,
    },

    halfColumn: {
      flex: 1,
    },

    textInput: {
      backgroundColor:
        "#F8FAFC",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 12,
      paddingHorizontal: 14,
      height: 48,
      fontSize: 14,
      color: "#0F172A",
      fontFamily:
        fonts.regular,
    },

    disabledInput: {
      backgroundColor:
        "#F1F5F9",
      color: "#64748B",
    },

    invoiceNumberHint: {
      marginTop: 5,
      fontSize: 10,
      color: "#94A3B8",
      fontFamily:
        fonts.regular,
    },

    itemBox: {
      position: "relative",
      backgroundColor:
        "#F8FAFC",
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
    },

    itemNumber: {
      fontSize: 12,
      color: "#94A3B8",
      fontFamily:
        fonts.semiBold,
      marginBottom: 10,
    },

    removeIconBtn: {
      position: "absolute",
      top: -8,
      right: -8,
      backgroundColor:
        "#FFE4E6",
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent:
        "center",
      zIndex: 2,
    },

    packageDisplay: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 10,
      paddingHorizontal: 12,
      marginBottom: 10,
    },

    packageIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor:
        "#E0F2FE",
      alignItems: "center",
      justifyContent:
        "center",
      marginRight: 10,
    },

    packageDisplayInfo: {
      flex: 1,
    },

    packageName: {
      fontSize: 14,
      color: "#0F172A",
      fontFamily:
        fonts.semiBold,
    },

    packageEmpty: {
      color: "#94A3B8",
      fontFamily:
        fonts.regular,
    },

    packageType: {
      marginTop: 2,
      fontSize: 10,
      color: "#64748B",
      fontFamily:
        fonts.regular,
    },

    priceInfoBox: {
      backgroundColor:
        "#EFF6FF",
      borderRadius: 9,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 12,
    },

    priceInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      marginVertical: 2,
    },

    priceInfoLabel: {
      fontSize: 11,
      color: "#64748B",
      fontFamily:
        fonts.regular,
    },

    priceInfoValue: {
      fontSize: 11,
      color: "#334155",
      fontFamily:
        fonts.semiBold,
    },

    discountPriceLabel: {
      fontSize: 11,
      color: "#059669",
      fontFamily:
        fonts.semiBold,
    },

    discountPriceValue: {
      fontSize: 12,
      color: "#059669",
      fontFamily:
        fonts.bold,
    },

    itemRow: {
      flexDirection: "row",
      gap: 10,
    },

    itemCol: {
      flex: 1,
    },

    textInputCenter: {
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E8F0",
      borderRadius: 10,
      height: 44,
      paddingHorizontal: 5,
      textAlign: "center",
      fontSize: 14,
      color: "#0F172A",
      fontFamily:
        fonts.regular,
    },

    itemTotalRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor:
        "#E2E8F0",
    },

    itemTotalLabel: {
      fontSize: 12,
      color: "#64748B",
      fontFamily:
        fonts.regular,
    },

    itemTotalValue: {
      fontSize: 13,
      color: "#0F172A",
      fontFamily:
        fonts.semiBold,
    },

    addItemBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      borderWidth: 1.5,
      borderColor:
        "#00497B",
      borderStyle: "dashed",
      borderRadius: 12,
      paddingVertical: 12,
      gap: 8,
    },

    addItemBtnText: {
      fontSize: 14,
      fontFamily:
        fonts.semiBold,
      color: "#00497B",
    },

    summaryCard: {
      backgroundColor:
        "#E8F1F8",
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor:
        "#CBD5E1",
    },

    summaryRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      marginBottom: 8,
    },

    summaryLabel: {
      fontSize: 14,
      color: "#475569",
      fontFamily:
        fonts.regular,
    },

    summaryValue: {
      fontSize: 14,
      fontFamily:
        fonts.semiBold,
      color: "#0F172A",
    },

    summaryDivider: {
      height: 1,
      backgroundColor:
        "#CBD5E1",
      marginVertical: 10,
    },

    summaryTotalRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
    },

    totalLabel: {
      fontSize: 16,
      fontFamily: fonts.bold,
      color: "#00497B",
    },

    totalValue: {
      fontSize: 18,
      fontFamily: fonts.bold,
      color: "#00497B",
    },

    draftBtn: {
      borderWidth: 1,
      borderColor:
        "#00497B",
      borderRadius: 12,
      minHeight: 50,
      alignItems: "center",
      justifyContent:
        "center",
      marginBottom: 10,
    },

    draftBtnText: {
      fontSize: 15,
      fontFamily:
        fonts.semiBold,
      color: "#00497B",
    },

    generateBtn: {
      flexDirection: "row",
      backgroundColor:
        "#00497B",
      borderRadius: 12,
      minHeight: 50,
      alignItems: "center",
      justifyContent:
        "center",
      marginBottom: 16,
      gap: 7,
    },

    generateBtnText: {
      fontSize: 15,
      fontFamily:
        fonts.semiBold,
      color: "#FFFFFF",
    },

    disabledButton: {
      opacity: 0.6,
    },
  });

export default function ProgramBuilderScreen({ navigation }) {
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [programModalVisible, setProgramModalVisible] = useState(false);
  const [goalInputText, setGoalInputText] = useState({});
  const [activeGoalInputProgramId, setActiveGoalInputProgramId] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState(null);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const flattenTherapistChildren = (therapists = []) =>
    therapists.flatMap((therapist) =>
      (therapist.children || []).map((child) => ({
        childId: String(child._id),
        childName: child.fullName,
        childEmail: child.email || "",
        therapistId: String(therapist.therapistId),
        therapistName: therapist.therapistName,
        specialty: therapist.specialties?.[0] || "",
        assignedChildren: therapist.assignedChildren,
        maxChildren: therapist.maxChildren,
        combinedName: `${child.fullName} - ${therapist.therapistName}`,
      }))
    );
  const getAssignmentId = (item) => `${item.childId}-${item.therapistId}`;

  const selectedAssignment = useMemo(
    () =>
      children.find(
        (item) => getAssignmentId(item) === selectedAssignmentId,
      ) || null,
    [children, selectedAssignmentId],
  );

  const selectedChildId = selectedAssignment?.childId || null;
  const selectedTherapistId = selectedAssignment?.therapistId || null;

  useEffect(() => {
    fetchChildren();
  }, []);

  useEffect(() => {
    if (selectedChildId && selectedTherapistId) {
      fetchProgramsForChild(
        selectedChildId,
        selectedTherapistId,
      );
    } else {
      setPrograms([]);
    }
  }, [selectedChildId, selectedTherapistId]);

  useEffect(() => {
    const servicesData = async () => {
      try {
        const res = await getServices({ search: "" });

        const activeServices = res.data.filter(
          (service) => service.isActive === true,
        );

        setServices(activeServices);
      } catch (error) {
        console.log(error);
      }
    };

    servicesData();
  }, []);

  const fetchChildren = async () => {
    try {
      setLoadingChildren(true);

      const responseData = await AssignTheraistChild();
      const fetchedUsers = flattenTherapistChildren(
        responseData?.data || [],
      );
      setChildren(fetchedUsers);

      if (fetchedUsers.length === 0) {
        setSelectedAssignmentId(null);
        return;
      }

      const selectedStillExists = fetchedUsers.some(
        (item) => getAssignmentId(item) === selectedAssignmentId,
      );

      if (!selectedStillExists) {
        setSelectedAssignmentId(
          getAssignmentId(fetchedUsers[0]),
        );
      }
    } catch (error) {
      console.error(
        "Error fetching children:",
        error?.response?.data || error.message,
      );
    } finally {
      setLoadingChildren(false);
    }
  };

  const fetchProgramsForChild = async (
    childId,
    therapistId,
  ) => {
    if (!childId || !therapistId) {
      setPrograms([]);
      return;
    }

    try {
      setLoadingPrograms(true);

      const response = await getChildPrograms(
        childId,
        therapistId,
      );

      if (response?.success) {
        const therapistGroup = response.data?.find(
          (item) => String(item.therapist?._id) === String(therapistId),
        );

        const selectedChild = therapistGroup?.children?.find(
          (item) => String(item.child?._id) === String(childId),
        );

        setPrograms(selectedChild?.programs || []);
      } else {
        setPrograms([]);
      }
    } catch (error) {
      console.error(
        "Error fetching child programs:",
        error?.response?.data || error.message,
      );
      setPrograms([]);
    } finally {
      setLoadingPrograms(false);
    }
  };

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);

      const responseData = await AssignTheraistChild();
      const fetchedUsers = flattenTherapistChildren(
        responseData?.data || [],
      );
      setChildren(fetchedUsers);

      let assignment = fetchedUsers.find(
        (item) => getAssignmentId(item) === selectedAssignmentId,
      );

      if (!assignment && fetchedUsers.length > 0) {
        assignment = fetchedUsers[0];
        setSelectedAssignmentId(
          getAssignmentId(assignment),
        );
      }

      if (assignment) {
        await fetchProgramsForChild(
          assignment.childId,
          assignment.therapistId,
        );
      } else {
        setPrograms([]);
        setSelectedAssignmentId(null);
      }
    } catch (error) {
      console.error(
        "Error on refreshing:",
        error?.response?.data || error.message,
      );
    } finally {
      setRefreshing(false);
    }
  }, [selectedAssignmentId]);

  const handleSelectAssignment = (item) => {
    setSelectedAssignmentId(
      getAssignmentId(item),
    );
  };

  const handleAddProgram = async (department) => {
    if (!selectedAssignment) {
      Alert.alert(
        "Error",
        "Please select a child and therapist.",
      );
      return;
    }

    try {
      const payload = {
        therapistId: selectedAssignment.therapistId,
        childId: selectedAssignment.childId,
        programName: department.title
          || department.label
          || "Untitled Program",
        description: "describe behavior, engagement,",
        goals: [],
      };

      const response = await AddPrograms(payload);

      if (response?.success) {
        if (response.program) {
          setPrograms((prev) => [
            response.program,
            ...prev,
          ]);
        } else {
          await fetchProgramsForChild(
            selectedAssignment.childId,
            selectedAssignment.therapistId,
          );
        }

        setProgramModalVisible(false);
      }
    } catch (error) {
      console.error(
        "Failed to add program:",
        error?.response?.data || error.message,
      );

      Alert.alert(
        "Error",
        error?.response?.data?.message
          || "Failed to add program.",
      );
    }
  };

  const handleDeleteProgram = (program) => {
    const programId = program._id || program.id;
    const programName = program.programName
      || program.title
      || "this program";

    Alert.alert(
      "Are you sure?",
      `Do you really want to delete "${programName}"? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Yes, Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await deleteProgramApi(
                programId,
              );

              if (res?.success) {
                setPrograms((prev) =>
                  prev.filter(
                    (item) => (item._id || item.id) !== programId,
                  )
                );
              }
            } catch (error) {
              console.error(
                "Failed to delete program:",
                error?.response?.data || error.message,
              );
            }
          },
        },
      ],
    );
  };

  const handleDeleteGoal = async (
    programId,
    goalId,
  ) => {
    try {
      const response = await deleteGoalApi(
        programId,
        goalId,
      );

      if (response?.success) {
        setPrograms((prev) =>
          prev.map((program) => {
            const currentProgramId = program._id || program.id;

            if (currentProgramId !== programId) {
              return program;
            }

            return {
              ...program,
              programGoals: (
                program.programGoals
                || program.goals
                || []
              ).filter(
                (goal) => (goal._id || goal.id) !== goalId,
              ),
            };
          })
        );
      }
    } catch (error) {
      console.error(
        "Failed to delete goal:",
        error?.response?.data || error.message,
      );
    }
  };

  const handleGoalInputChange = (
    programId,
    text,
  ) => {
    setGoalInputText((prev) => ({
      ...prev,
      [programId]: text,
    }));
  };

  const handleSaveGoal = async (programId) => {
    const text = goalInputText[programId]?.trim();

    if (!text) {
      return;
    }

    try {
      const response = await addGoalToProgramApi(
        programId,
        text,
      );

      if (
        response?.success
        && response?.program
      ) {
        setPrograms((prev) =>
          prev.map((program) => {
            const currentProgramId = program._id || program.id;

            return currentProgramId === programId
              ? response.program
              : program;
          })
        );

        setGoalInputText((prev) => ({
          ...prev,
          [programId]: "",
        }));

        setActiveGoalInputProgramId(null);
      }
    } catch (error) {
      console.error(
        "Failed to save goal:",
        error?.response?.data || error.message,
      );
    }
  };

  const filteredModalChildren = children.filter(
    (item) => {
      const search = modalSearch.toLowerCase().trim();

      if (!search) {
        return true;
      }

      return (
        item.childName
          ?.toLowerCase()
          .includes(search)
        || item.therapistName
          ?.toLowerCase()
          .includes(search)
        || item.combinedName
          ?.toLowerCase()
          .includes(search)
        || item.specialty
          ?.toLowerCase()
          .includes(search)
      );
    },
  );

  const filteredPrograms = programs.filter(
    (program) => {
      const title = program?.programName
        ?? program?.title
        ?? "";

      return title
        .toLowerCase()
        .includes(
          searchQuery
            .toLowerCase()
            .trim(),
        );
    },
  );

  return (
    <SafeAreaView
      style={[
        styles.mainContainer,
        commonStyles.container,
      ]}
    >
      <TopBar
        navigation={navigation}
        headerTitle="Program Builder"
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
        <View style={styles.headerBanner}>
          <Text style={styles.bannerTitle}>
            Program Builder
          </Text>

          <Text style={styles.bannerSubtitle}>
            Managing Therapist Program add child program
          </Text>
        </View>

        <View style={styles.childHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>
            Select Child - Therapist
          </Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.viewAllText}>
              View All
            </Text>
          </TouchableOpacity>
        </View>

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
              {children.map((item) => {
                const uniqueId = getAssignmentId(item);

                const isSelected = uniqueId
                  === selectedAssignmentId;

                return (
                  <TouchableOpacity
                    key={uniqueId}
                    style={[
                      styles.childChip,
                      isSelected
                        ? styles.childChipSelected
                        : styles.childChipUnselected,
                    ]}
                    activeOpacity={0.8}
                    onPress={() =>
                      handleSelectAssignment(
                        item,
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
                      {item.combinedName
                        || `${item.childName} - ${item.therapistName}`}
                    </Text>

                    {!!item.specialty && (
                      <Text
                        style={styles.childSpecialty}
                      >
                        {services.find(service => service.id === item.specialty)?.label || "-"}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )
          : (
            <View style={styles.childChipsRow}>
              <Text style={styles.emptyText}>
                No user found
              </Text>
            </View>
          )}

        {selectedAssignment && (
          <View style={styles.selectedInfoCard}>
            <View style={styles.selectedInfoRow}>
              <View style={styles.selectedInfoBox}>
                <Text style={styles.selectedInfoLabel}>
                  Child
                </Text>
                <Text style={styles.selectedInfoValue}>
                  {selectedAssignment.childName}
                </Text>
              </View>

              <View style={styles.selectedInfoBox}>
                <Text style={styles.selectedInfoLabel}>
                  Therapist
                </Text>
                <Text style={styles.selectedInfoValue}>
                  {selectedAssignment.therapistName}
                </Text>
              </View>
            </View>

            <View style={styles.selectedInfoRow}>
              <View style={styles.selectedInfoBox}>
                <Text style={styles.selectedInfoLabel}>
                  Specialty
                </Text>
                <Text style={styles.selectedInfoValue}>
                  {services.find(service => service.id === selectedAssignment.specialty)?.label || "-"}
                </Text>
              </View>

              <View style={styles.selectedInfoBox}>
                <Text style={styles.selectedInfoLabel}>
                  Assigned Children
                </Text>
                <Text style={styles.selectedInfoValue}>
                  {selectedAssignment.assignedChildren
                    || 0}
                  /
                  {selectedAssignment.maxChildren
                    || 0}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.searchCard}>
          <View
            style={styles.searchInputContainer}
          >
            <Feather
              name="search"
              size={18}
              color="#94A3B8"
              style={styles.searchIcon}
            />

            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.allLabelsBtn}
              activeOpacity={0.8}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color="#FFFFFF"
              />

              <Text style={styles.allLabelsText}>
                All Labels
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addProgramBtn}
              activeOpacity={0.8}
              disabled={!selectedAssignment}
              onPress={() => setProgramModalVisible(true)}
            >
              <Text style={styles.addProgramText}>
                Add program
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.allProgramTitle}>
          All Programs
        </Text>

        <View style={styles.programList}>
          {loadingPrograms
            ? (
              <ActivityIndicator
                size="small"
                color="#004E9F"
                style={{
                  marginTop: 20,
                }}
              />
            )
            : filteredPrograms.length === 0
            ? (
              <Text style={styles.emptyText}>
                No programs added yet. Click "Add program" above.
              </Text>
            )
            : filteredPrograms.map(
              (program) => {
                const programId = program._id
                  || program.id;

                const programGoalsList = program.programGoals
                  || program.goals
                  || [];

                return (
                  <View
                    key={String(programId)}
                    style={styles.programCard}
                  >
                    <View
                      style={styles.programHeaderRow}
                    >
                      <Text style={styles.cardTitle}>
                        {program.programName
                          || program.title}
                      </Text>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() =>
                          handleDeleteProgram(
                            program,
                          )}
                      >
                        <Feather
                          name="trash-2"
                          size={20}
                          color="#BA1A1A"
                        />
                      </TouchableOpacity>
                    </View>

                    <Text
                      style={styles.cardDescription}
                    >
                      {program.description}
                    </Text>

                    <Text style={styles.cardTitle}>
                      {program.therapistTitle
                        || selectedAssignment
                          ?.therapistName
                        || "Therapist"}
                    </Text>

                    <Text
                      style={styles.cardDescription}
                    >
                      {program.therapistDescription
                        || "describe behavior, engagement,"}
                    </Text>

                    {programGoalsList.map(
                      (goal, goalIndex) => {
                        const goalId = goal._id
                          || goal.id
                          || `${programId}-${goalIndex}`;

                        return (
                          <View
                            key={String(goalId)}
                            style={styles.goalBox}
                          >
                            <View
                              style={styles.goalLeftRow}
                            >
                              <View
                                style={styles.radioCircle}
                              />

                              <Text
                                style={styles.goalTitle}
                              >
                                {goal.title}
                              </Text>
                            </View>

                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() =>
                                handleDeleteGoal(
                                  programId,
                                  goal._id
                                    || goal.id,
                                )}
                            >
                              <Feather
                                name="trash-2"
                                size={18}
                                color="#BA1A1A"
                              />
                            </TouchableOpacity>
                          </View>
                        );
                      },
                    )}

                    {activeGoalInputProgramId
                        === programId && (
                      <View
                        style={styles.goalInputRow}
                      >
                        <TextInput
                          style={styles.goalTextInput}
                          placeholder="Enter goal title..."
                          placeholderTextColor="#94A3B8"
                          value={goalInputText[
                            programId
                          ] || ""}
                          onChangeText={(text) =>
                            handleGoalInputChange(
                              programId,
                              text,
                            )}
                          autoFocus
                        />

                        <TouchableOpacity
                          style={styles.saveGoalBtn}
                          onPress={() =>
                            handleSaveGoal(
                              programId,
                            )}
                        >
                          <Text
                            style={styles.saveGoalBtnText}
                          >
                            Add
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.addGoalBtn}
                      activeOpacity={0.8}
                      onPress={() =>
                        setActiveGoalInputProgramId(
                          programId,
                        )}
                    >
                      <Feather
                        name="plus-circle"
                        size={18}
                        color="#8BF6D9"
                      />

                      <Text
                        style={styles.addGoalBtnText}
                      >
                        Add Another Goal
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              },
            )}
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Select Child - Therapist
                  </Text>

                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
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
                    placeholder="Search child or therapist..."
                    placeholderTextColor="#94A3B8"
                    value={modalSearch}
                    onChangeText={setModalSearch}
                  />
                </View>

                <ScrollView
                  style={{
                    maxHeight: 300,
                  }}
                  showsVerticalScrollIndicator
                >
                  {filteredModalChildren.map(
                    (item) => {
                      const uniqueId = getAssignmentId(item);

                      const isSelected = uniqueId
                        === selectedAssignmentId;

                      return (
                        <TouchableOpacity
                          key={uniqueId}
                          style={[
                            styles.modalOption,
                            isSelected
                            && styles.modalOptionSelected,
                          ]}
                          onPress={() => {
                            handleSelectAssignment(
                              item,
                            );
                            setModalVisible(
                              false,
                            );
                          }}
                        >
                          <View
                            style={styles.modalOptionInfo}
                          >
                            <Text
                              style={[
                                styles.modalOptionText,
                                isSelected
                                && styles.modalOptionTextSelected,
                              ]}
                            >
                              {item.combinedName
                                || `${item.childName} - ${item.therapistName}`}
                            </Text>

                            {!!item.specialty && (
                              <Text
                                style={styles.modalOptionSubtext}
                              >
                                {services.find(service => service.id === item.specialty)?.label || "-"}
                              </Text>
                            )}
                          </View>

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

                  {filteredModalChildren.length
                      === 0 && (
                    <Text style={styles.emptyText}>
                      No user found
                    </Text>
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={programModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProgramModalVisible(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setProgramModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Select Department
                  </Text>

                  <TouchableOpacity
                    onPress={() =>
                      setProgramModalVisible(
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

                <ScrollView
                  style={{
                    maxHeight: 260,
                  }}
                  showsVerticalScrollIndicator
                >
                  {services.map(
                    (department) => (
                      <TouchableOpacity
                        key={department.id}
                        style={styles.modalOption}
                        onPress={() =>
                          handleAddProgram(
                            department,
                          )}
                      >
                        <Text
                          style={styles.modalOptionText}
                        >
                          {department.label}
                        </Text>

                        <Feather
                          name="plus"
                          size={18}
                          color="#00725E"
                        />
                      </TouchableOpacity>
                    ),
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <BottomBar />
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
    paddingBottom: 20,
  },
  headerBanner: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 20,
  },
  bannerTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.white,
    lineHeight: 24,
  },
  bannerSubtitle: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.white,
    lineHeight: 22,
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
    minHeight: 50,
    borderRadius: 32,
    paddingHorizontal: 20,
    paddingVertical: 7,
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
    fontSize: 14,
    fontFamily: fonts.medium,
    lineHeight: 20,
    color: "#004E9F",
  },
  childChipTextSelected: {
    color: "#004E9F",
  },
  childChipTextUnselected: {
    color: "#004E9F",
  },
  childSpecialty: {
    marginTop: 1,
    fontSize: 9,
    fontFamily: fonts.regular,
    color: "#64748B",
    textTransform: "capitalize",
  },
  selectedInfoCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  selectedInfoRow: {
    flexDirection: "row",
    gap: 12,
  },
  selectedInfoBox: {
    flex: 1,
  },
  selectedInfoLabel: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: "#64748B",
    marginBottom: 3,
  },
  selectedInfoValue: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: "#0F172A",
    textTransform: "capitalize",
  },
  searchCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInputContainer: {
    backgroundColor: "#F7FAFD",
    borderRadius: 10,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#0F172A",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  allLabelsBtn: {
    flex: 1,
    backgroundColor: "#F58B2A",
    height: 44,
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  allLabelsText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    lineHeight: 20,
  },
  addProgramBtn: {
    flex: 1,
    backgroundColor: "#00725E",
    height: 44,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  addProgramText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: "#8BF6D9",
    lineHeight: 20,
  },
  allProgramTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: "#1D1B16",
    lineHeight: 26,
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  emptyText: {
    textAlign: "center",
    color: "#64748B",
    fontSize: 14,
    fontFamily: fonts.regular,
    marginTop: 10,
  },
  programList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  programCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: "#94A2B6",
  },
  programHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#1D1B16",
    lineHeight: 24,
  },
  cardDescription: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#6B7280",
    lineHeight: 22,
    marginBottom: 5,
  },
  goalBox: {
    backgroundColor: "rgba(139,246,217,.2)",
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  goalLeftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  radioCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#717781",
  },
  goalTitle: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.bold,
    color: "#006B58",
    lineHeight: 18,
  },
  goalInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  goalTextInput: {
    flex: 1,
    height: 42,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#0F172A",
  },
  saveGoalBtn: {
    backgroundColor: "#006B58",
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  saveGoalBtnText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  addGoalBtn: {
    backgroundColor: "#006B58",
    height: 44,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addGoalBtnText: {
    fontSize: 16,
    fontFamily: fonts.medium,
    color: "#8BF6D9",
    lineHeight: 24,
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
    height: 43,
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
  modalOptionInfo: {
    flex: 1,
    paddingRight: 10,
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
  },
  modalOptionSubtext: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: "#64748B",
    textTransform: "capitalize",
  },
});

export const AuthContext = createContext();

const getTokenRemainingMs = (jwtToken) => {
  try {
    const decoded = jwtDecode(jwtToken);

    if (!decoded.exp) {
      return 0;
    }

    return Math.max(0, decoded.exp * 1000 - Date.now());
  } catch (error) {
    console.log(" JWT Decode Error:", error.message);
    return 0;
  }
};

const formatRemainingTime = (milliseconds) => {
  const totalSeconds = Math.ceil(milliseconds / 1000);

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    `${String(minutes).padStart(2, "0")}:`
    + `${String(seconds).padStart(2, "0")}`
  );
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const appState = useRef(AppState.currentState);
  const tokenRef = useRef(null);
  const logoutInProgressRef = useRef(false);
  const sessionVersionRef = useRef(0);
  const internetAlertShownRef = useRef(false);

  const updateOnlineStatus = useCallback(async (isOnline, expectedToken = tokenRef.current) => {
    if (!expectedToken) return;

    try {
      await updateOnlineStatusApi(isOnline);
    } catch (error) {
      console.log(" Failed to update online status:", error?.response?.data || error?.message);
    }
  }, []);
  // useEffect(() => {
  //   if (!token) return;
  //   let cancelled = false;

  //   (async () => {
  //     try {
  //       const pushToken = await registerForPushNotifications();
  //       if (!pushToken || cancelled) return;
  //       await registerNotification(pushToken, Platform.OS);
  //       await AsyncStorage.setItem("pushToken", pushToken);
  //     } catch (error) {
  //       console.log("Push registration failed:", error?.response?.data || error?.message);
  //     }
  //   })();

  //   return () => {
  //     cancelled = true;
  //   };
  // }, [token]);

  // const logout = useCallback(async (expectedToken) => {
  //   const currentToken = tokenRef.current;

  //   if (expectedToken !== undefined && currentToken !== expectedToken) {
  //     return;
  //   }

  //   if (logoutInProgressRef.current) {
  //     return;
  //   }

  //   logoutInProgressRef.current = true;
  //   const sessionVersion = sessionVersionRef.current;

  //   try {

  //     if (currentToken && getTokenRemainingMs(currentToken) > 0) {
  //       await updateOnlineStatus(false, currentToken);
  //     }

  //     if (sessionVersionRef.current !== sessionVersion) {
  //       return;
  //     }

  //     await clearAuthData();

  //     if (sessionVersionRef.current !== sessionVersion) {
  //       return;
  //     }

  //     tokenRef.current = null;
  //     sessionVersionRef.current += 1;
  //     setToken(null);
  //     setUser(null);
  //   } catch (error) {
  //     console.log(" Logout Error:", error);
  //   } finally {
  //     logoutInProgressRef.current = false;
  //   }
  // }, [updateOnlineStatus]);

  const logout = useCallback(async (expectedToken) => {
    const currentToken = tokenRef.current;

    if (
      typeof expectedToken === "string"
      && currentToken !== expectedToken
    ) {
      return;
    }

    if (logoutInProgressRef.current) {
      return;
    }

    logoutInProgressRef.current = true;

    try {
      tokenRef.current = null;
      sessionVersionRef.current += 1;

      setToken(null);
      setUser(null);
      const pushToken = await AsyncStorage.getItem("pushToken");
      // if (pushToken && currentToken && getTokenRemainingMs(currentToken) > 0) {
      //   try {
      //     await Promise.race([
      //       removePushToken(pushToken),
      //       new Promise((resolve) => setTimeout(resolve, 3000)),
      //     ]);
      //   } catch (error) {
      //     console.log("Push token removal failed:", error?.message);
      //   }
      //   await AsyncStorage.removeItem("pushToken");
      // }

      await clearAuthData();

      if (currentToken) {
        NetInfo.fetch()
          .then((state) => {
            if (
              state.isConnected === true
              && state.isInternetReachable !== false
            ) {
              return updateOnlineStatus(false, currentToken);
            }
          })
          .catch((error) => {
            console.log("Online status update failed:", error);
          });
      }
    } catch (error) {
      console.log("Logout Error:", error);
    } finally {
      logoutInProgressRef.current = false;
    }
  }, [updateOnlineStatus]);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const data = await getAuthData();

        if (!mounted) return;

        if (data?.token && data?.user) {
          const remainingMs = getTokenRemainingMs(data.token);

          if (remainingMs <= 0) {
            await clearAuthData();

            if (mounted) {
              tokenRef.current = null;
              setToken(null);
              setUser(null);
            }
          } else {
            tokenRef.current = data.token;
            sessionVersionRef.current += 1;

            setToken(data.token);
            setUser(data.user);
          }
        } else {
        }
      } catch (error) {
        console.log("Failed to load auth state:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  // const login = async (jwtToken, userData) => {
  //   const remainingMs = getTokenRemainingMs(jwtToken);

  //   if (remainingMs <= 0) {
  //     throw new Error("Invalid or expired login token");
  //   }

  //   await setAuthData(jwtToken, userData);

  //   sessionVersionRef.current += 1;
  //   tokenRef.current = jwtToken;
  //   setToken(jwtToken);
  //   setUser(userData);
  // };

  const login = useCallback(
    async (jwtToken, userData) => {
      if (getTokenRemainingMs(jwtToken) <= 0) {
        throw new Error("Invalid or expired token");
      }

      await setAuthData(jwtToken, userData);

      sessionVersionRef.current += 1;
      tokenRef.current = jwtToken;

      setToken(jwtToken);
      setUser(userData);

      if (AppState.currentState === "active") {
        await updateOnlineStatus(true, jwtToken);
      }
    },
    [updateOnlineStatus],
  );

  const switchUser = async (jwtToken, userData) => {
    const remainingMs = getTokenRemainingMs(jwtToken);

    if (remainingMs <= 0) {
      throw new Error("New user token is expired");
    }

    const previousToken = tokenRef.current;

    if (previousToken && getTokenRemainingMs(previousToken) > 0) {
      await updateOnlineStatus(false, previousToken);
    }

    await setAuthData(jwtToken, userData);

    sessionVersionRef.current += 1;
    tokenRef.current = jwtToken;

    setToken(jwtToken);
    setUser(userData);
  };

  const updateUser = async (userData) => {
    const currentToken = tokenRef.current;

    if (!currentToken) return;

    if (getTokenRemainingMs(currentToken) <= 0) {
      await logout(currentToken);
      return;
    }

    await setAuthData(currentToken, userData);

    if (tokenRef.current === currentToken) {
      setUser(userData);
    }
  };

  useEffect(() => {
    if (!token) {
      console.log("⏹️ Token timer stopped");
      return;
    }

    let intervalId = null;
    let expirationTimeoutId = null;
    let cancelled = false;
    let isExpiring = false;

    const expireSession = async () => {
      if (
        cancelled
        || isExpiring
        || tokenRef.current !== token
      ) {
        return;
      }

      isExpiring = true;

      clearInterval(intervalId);
      clearTimeout(expirationTimeoutId);

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔴 JWT TOKEN EXPIRED");
      console.log("⏰ Remaining Time: 00:00");
      console.log("🚪 Automatically logging out...");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      await logout(token);
    };

    const checkRemainingTime = () => {
      if (cancelled || tokenRef.current !== token) {
        return;
      }

      const remainingMs = getTokenRemainingMs(token);

      if (remainingMs <= 0) {
        expireSession();
        return;
      }

      const formattedTime = formatRemainingTime(remainingMs);

      // console.log(`🟢 Auto Logout In: ${formattedTime}`);
    };

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⏳ JWT AUTO LOGOUT TIMER STARTED");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    intervalId = setInterval(checkRemainingTime, 1000);

    const remainingMs = getTokenRemainingMs(token);

    if (remainingMs > 0) {
      expirationTimeoutId = setTimeout(
        expireSession,
        remainingMs,
      );
    }

    return () => {
      cancelled = true;

      clearInterval(intervalId);
      clearTimeout(expirationTimeoutId);

      console.log("⏹️ JWT countdown cleanup");
    };
  }, [token, logout]);

  useEffect(() => {
    if (!token || !user) return;

    const checkActiveSession = async () => {
      if (tokenRef.current !== token) return;

      const remainingMs = getTokenRemainingMs(token);

      if (remainingMs <= 0) {
        console.log("🔴 Token expired while app was backgrounded");
        await logout(token);
        return;
      }

      console.log(
        "📱 App active - Remaining:",
        formatRemainingTime(remainingMs),
      );

      await updateOnlineStatus(true, token);
    };

    if (AppState.currentState === "active") {
      checkActiveSession();
    }

    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        const previousAppState = appState.current;
        appState.current = nextAppState;

        if (tokenRef.current !== token) return;

        if (
          previousAppState?.match(/inactive|background/)
          && nextAppState === "active"
        ) {
          console.log("📱 App returned to foreground");

          await checkActiveSession();
        }

        if (
          previousAppState === "active"
          && nextAppState.match(/inactive|background/)
        ) {
          console.log("📱 App moved to background");

          if (getTokenRemainingMs(token) > 0) {
            await updateOnlineStatus(false, token);
          }
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [token, user, logout, updateOnlineStatus]);

  useEffect(() => {
    if (!token) {
      internetAlertShownRef.current = false;
      return;
    }

    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOffline = state.isConnected === false
        || state.isInternetReachable === false;

      if (isOffline && !internetAlertShownRef.current) {
        internetAlertShownRef.current = true;

        Alert.alert(
          "No Internet Connection",
          "Your internet connection has been lost. You will be logged out.",
          [
            {
              text: "OK",
              onPress: async () => {
                await logout(token);
              },
            },
          ],
          { cancelable: false },
        );
      }

      if (!isOffline) {
        internetAlertShownRef.current = false;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [token, logout]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        userRole: user?.role || null,
        isLoading,
        login,
        logout,
        switchUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  // const notificationListener = useRef();
  // const responseListener = useRef();

  let [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        console.log("FCM/Expo Push Token:", token);
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log("Notification received:", notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log("Notification tapped:", response);
      const targetScreen = response?.notification?.request?.content?.data?.screen;
      if (targetScreen) {
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permission not granted to get push token!');
      return;
    }

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (e) {
      token = `${e}`;
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

const PAGE_LIMIT = 5;

const STATUS_OPTIONS = [
  "All Statuses",
  "Paid",
  "Pending",
  "Partially Paid",
  "Overdue",
  "Cancelled",
  "Draft",
];

const PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "Card",
  "Online",
  "Cheque",
  "Other",
];

const EMPTY_STATS = {
  totalRevenue: 0,
  outstanding: 0,
  collected: 0,
  outstandingCount: 0,
};

const formatCurrency = (value) =>
  `PKR ${
    Number(value || 0).toLocaleString("en-PK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }`;

const formatInvoiceDate = (value) => {
  if (!value) return "—";
  const datePart = typeof value === "string" ? value.slice(0, 10) : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(datePart)
    ? new Date(`${datePart}T12:00:00Z`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const getStatusTheme = (status) => {
  switch (status) {
    case "Paid":
      return {
        bg: "#ECFDF5",
        border: "#A7F3D0",
        color: "#047857",
        icon: "check-circle",
      };

    case "Partially Paid":
      return {
        bg: "#FFF7ED",
        border: "#FED7AA",
        color: "#C2410C",
        icon: "clock",
      };

    case "Overdue":
      return {
        bg: "#FEF2F2",
        border: "#FCA5A5",
        color: "#B91C1C",
        icon: "alert-triangle",
      };

    case "Pending":
      return {
        bg: "#FFFBEB",
        border: "#FDE68A",
        color: "#B45309",
        icon: "clock",
      };

    case "Cancelled":
      return {
        bg: "#F1F5F9",
        border: "#CBD5E1",
        color: "#64748B",
        icon: "x-circle",
      };

    default:
      return {
        bg: "#F1F5F9",
        border: "#CBD5E1",
        color: "#475569",
        icon: "file-text",
      };
  }
};

const MetricCard = ({
  title,
  value,
  icon,
  color,
  background,
  subtitle,
}) => (
  <View style={styles.metricCard}>
    <View style={styles.metricTop}>
      <View style={styles.metricText}>
        <Text style={styles.metricLabel}>{title}</Text>
        <Text
          style={[styles.metricValue, { color }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatCurrency(value)}
        </Text>
      </View>

      <View
        style={[
          styles.metricIcon,
          { backgroundColor: background },
        ]}
      >
        <Feather name={icon} size={fontSize(21)} color={color} />
      </View>
    </View>

    {!!subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
  </View>
);

export default function InvoiceManagementScreen({
  navigation,
}) {
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Statuses");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [paymentStatus, setPaymentStatus] = useState("Partially Paid");

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentNote, setPaymentNote] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const loadingMoreRef = useRef(false);
  const scrollTriggeredRef = useRef(false);
  const requestIdRef = useRef(0);
  const listBusyRef = useRef(false);
  const paginationRef = useRef({
    page: 1,
    hasMore: false,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadInvoices = useCallback(
    async ({
      pageNumber = 1,
      append = false,
      refresh = false,
      search = debouncedSearch,
      status = selectedStatus,
    } = {}) => {
      if (append) {
        if (
          listBusyRef.current
          || loadingMoreRef.current
          || !paginationRef.current.hasMore
        ) {
          return;
        }

        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        listBusyRef.current = true;
        paginationRef.current = { page: 1, hasMore: false };
        scrollTriggeredRef.current = false;
        setHasMore(false);

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
      }

      const requestId = ++requestIdRef.current;

      try {
        const params = {
          page: pageNumber,
          limit: PAGE_LIMIT,
        };

        if (search) {
          params.search = search;
        }

        if (status !== "All Statuses") {
          params.status = status;
        }

        const response = await getInvoicesApi(params);
        const result = response?.data?.success
          ? response.data
          : response;

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!result?.success) {
          throw new Error(
            result?.message || "Unable to load invoices.",
          );
        }

        const newInvoices = Array.isArray(result.data)
          ? result.data
          : [];
;
        const pagination = result.pagination || {};

        if (append) {
          setInvoices((previous) => {
            const existing = new Set(
              previous.map((item) => String(item._id)),
            );

            const unique = newInvoices.filter(
              (item) => !existing.has(String(item._id)),
            );

            return [...previous, ...unique];
          });
        } else {
          setInvoices(newInvoices);
        }

        const nextPage = Number(
          pagination.page || pageNumber,
        );

        const more = Boolean(pagination.hasMore);

        paginationRef.current = {
          page: nextPage,
          hasMore: more,
        };

        setPage(nextPage);
        setHasMore(more);

        if (result.stats) {
          setStats({
            totalRevenue: Number(
              result.stats.totalRevenue || 0,
            ),
            outstanding: Number(
              result.stats.outstanding || 0,
            ),
            collected: Number(
              result.stats.collected || 0,
            ),
            outstandingCount: Number(
              result.stats.outstandingCount || 0,
            ),
          });
        } else if (!append) {
          setStats(EMPTY_STATS);
        }
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!append) {
          setInvoices([]);
        }

        Alert.alert(
          "Error",
          error?.response?.data?.message
            || error?.message
            || "Unable to load invoices.",
        );
      } finally {
        if (requestId === requestIdRef.current && append) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else if (requestId === requestIdRef.current) {
          listBusyRef.current = false;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [debouncedSearch, selectedStatus],
  );

  useFocusEffect(
    useCallback(() => {
      paginationRef.current = {
        page: 1,
        hasMore: false,
      };
      scrollTriggeredRef.current = false;

      loadingMoreRef.current = false;
      listBusyRef.current = false;
      setHasMore(false);

      loadInvoices({
        pageNumber: 1,
      });

      return () => {
        requestIdRef.current += 1;
        loadingMoreRef.current = false;
        listBusyRef.current = false;
        scrollTriggeredRef.current = false;
      };
    }, [loadInvoices]),
  );

  const handleRefresh = () => {
    if (listBusyRef.current || loadingMoreRef.current) {
      return;
    }

    loadInvoices({
      pageNumber: 1,
      refresh: true,
    });
  };

  const handleLoadMore = () => {
    if (
      !scrollTriggeredRef.current
      || loading
      || refreshing
      || loadingMore
      || listBusyRef.current
      || loadingMoreRef.current
      || !paginationRef.current.hasMore
    ) {
      return;
    }

    scrollTriggeredRef.current = false;
    loadInvoices({
      pageNumber: paginationRef.current.page + 1,
      append: true,
    });
  };

  const handleSelectStatus = (status) => {
    setFilterModalVisible(false);

    if (status === selectedStatus) return;

    requestIdRef.current += 1;
    scrollTriggeredRef.current = false;
    loadingMoreRef.current = false;
    listBusyRef.current = false;
    paginationRef.current = { page: 1, hasMore: false };
    setLoadingMore(false);
    setInvoices([]);
    setHasMore(false);
    setPage(1);
    setSelectedStatus(status);
  };

  const handleViewInvoice = (invoice) => {
    navigation.navigate("InvoiceView", {
      invoiceId: invoice._id,
    });
  };

  const handleCreateInvoice = () => {
    navigation.navigate("CreateNewInvoice");
  };

  const handleRemind = (invoice) => {
    Alert.alert(
      "Payment Reminder",
      `Reminder for ${invoice.invoiceNumber}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "OK",
        },
      ],
    );
  };

  const handleEditPayment = (invoice) => {
    if (["Draft", "Cancelled"].includes(invoice.status)) {
      Alert.alert(
        "Unavailable",
        "Payments cannot be recorded for draft or cancelled invoices.",
      );
      return;
    }

    const balance = roundMoney(invoice.balanceDue || 0);

    if (balance <= 0) {
      Alert.alert(
        "Already Paid",
        "This invoice has no outstanding balance.",
      );
      return;
    }

    setSelectedInvoice(invoice);
    setPaymentStatus("Partially Paid");
    setPaymentAmount("");
    setPaymentMethod("Cash");
    setPaymentNote("");
    setPaymentModalVisible(true);
  };

  const handlePaymentStatusChange = (status) => {
    setPaymentStatus(status);

    if (status === "Paid") {
      setPaymentAmount(
        roundMoney(
          selectedInvoice?.balanceDue || 0,
        ).toFixed(2),
      );
    } else {
      setPaymentAmount("");
    }
  };

  const closePaymentModal = () => {
    if (savingPayment) return;

    setPaymentModalVisible(false);
    setSelectedInvoice(null);
    setPaymentAmount("");
    setPaymentNote("");
  };

  const handleSavePayment = async () => {
    if (!selectedInvoice || savingPayment) return;

    const balance = roundMoney(
      selectedInvoice.balanceDue || 0,
    );

    const amount = paymentStatus === "Paid"
      ? balance
      : Number(paymentAmount);

    if (
      !Number.isFinite(amount)
      || amount <= 0
      || !Number.isInteger(
        Math.round(amount * 100)
          - amount * 100 + 0.0000001,
      )
    ) {
      if (
        !Number.isFinite(amount)
        || amount <= 0
        || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001
      ) {
        Alert.alert(
          "Invalid Amount",
          "Enter a valid amount with up to two decimal places.",
        );
        return;
      }
    }

    if (amount > balance) {
      Alert.alert(
        "Invalid Amount",
        "Payment cannot exceed the outstanding balance.",
      );
      return;
    }

    if (
      paymentStatus === "Partially Paid"
      && amount >= balance
    ) {
      Alert.alert(
        "Invalid Amount",
        "Partial payment must be less than the remaining balance.",
      );
      return;
    }

    const payload = {
      amount: roundMoney(amount),
      paymentMethod,
      note: paymentNote.trim()
        || (paymentStatus === "Paid"
          ? "Full balance payment"
          : "Partial payment"),
    };

    try {
      setSavingPayment(true);

      const response = await addInvoicePaymentApi(
        selectedInvoice._id,
        payload,
      );

      const result = response?.data?.success
        ? response.data
        : response;

      if (!result?.success) {
        throw new Error(
          result?.message || "Unable to record payment.",
        );
      }

      setPaymentModalVisible(false);
      setSelectedInvoice(null);
      setPaymentAmount("");
      setPaymentNote("");

      await loadInvoices({
        pageNumber: 1,
      });

      Alert.alert(
        "Success",
        "Payment recorded successfully.",
      );
    } catch (error) {
      Alert.alert(
        "Payment Failed",
        error?.response?.data?.message
          || error?.message
          || "Unable to save payment.",
      );
    } finally {
      setSavingPayment(false);
    }
  };

  const collectedPercentage = stats.totalRevenue > 0
    ? Math.min(
      Math.max(
        (stats.collected / stats.totalRevenue) * 100,
        0,
      ),
      100,
    )
    : 0;

  const renderHeader = () => (
    <View>
      <Text style={styles.screenTitle}>
        Invoice Management
      </Text>

      <Text style={styles.introDescription}>
        Oversee billing, track collections, and manage child session payments.
      </Text>

      <TouchableOpacity
        style={styles.createBtn}
        activeOpacity={0.8}
        onPress={handleCreateInvoice}
      >
        <Feather
          name="plus"
          size={fontSize(18)}
          color="#FFFFFF"
        />
        <Text style={styles.createBtnText}>
          Create New Invoice
        </Text>
      </TouchableOpacity>

      <MetricCard
        title="TOTAL REVENUE"
        value={stats.totalRevenue}
        icon="bar-chart-2"
        color={colors.primary}
        background="#EBF3F9"
        subtitle="Total active invoice amount"
      />

      <MetricCard
        title="TOTAL OUTSTANDING"
        value={stats.outstanding}
        icon="alert-circle"
        color="#BA1A1A"
        background="#FEF2F2"
        subtitle={`${stats.outstandingCount} unpaid ${
          stats.outstandingCount === 1
            ? "invoice"
            : "invoices"
        }`}
      />

      <MetricCard
        title="TOTAL COLLECTED"
        value={stats.collected}
        icon="check-circle"
        color="#006B58"
        background="#ECFDF5"
        subtitle={`${
          Math.round(
            collectedPercentage,
          )
        }% of total revenue collected`}
      />

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>
            Collection Progress
          </Text>
          <Text style={styles.progressPercent}>
            {collectedPercentage.toFixed(1)}%
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${collectedPercentage}%` },
            ]}
          />
        </View>

        <View style={styles.progressLegend}>
          <Text style={styles.progressCollected}>
            Collected
          </Text>
          <Text style={styles.progressOutstanding}>
            Outstanding
          </Text>
        </View>
      </View>

      <View style={styles.filterSection}>
        <View style={styles.searchBarContainer}>
          <Feather
            name="search"
            size={fontSize(18)}
            color="#94A3B8"
          />

          <TextInput
            style={styles.searchInput}
            placeholder="Search invoice ID..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />

          {!!searchQuery && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={10}
            >
              <Feather
                name="x"
                size={fontSize(18)}
                color="#94A3B8"
              />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.dropdownFilter}
          onPress={() => setFilterModalVisible(true)}
        >
          <View style={styles.filterLeft}>
            <Feather
              name="filter"
              size={fontSize(17)}
              color="#64748B"
            />

            <Text style={styles.dropdownFilterText}>
              {selectedStatus}
            </Text>
          </View>

          <Feather
            name="chevron-down"
            size={fontSize(18)}
            color="#64748B"
          />
        </TouchableOpacity>
      </View>

      {!loading && invoices.length > 0 && (
        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle}>
            Invoices
          </Text>

          <Text style={styles.resultCount}>
            {invoices.length} loaded
          </Text>
        </View>
      )}
    </View>
  );

  const handleUpdateDraftStatus = (invoice) => {
    if (invoice.status !== "Draft" || updatingStatusId) {
      return;
    }

    Alert.alert(
      "Update Invoice Status",
      `Change invoice ${invoice.invoiceNumber} from Draft to Pending and notify the child?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Update",
          onPress: async () => {
            try {
              setUpdatingStatusId(invoice._id);

              const response = await updateInvoiceStatusApi(
                invoice._id,
                "Pending",
              );

              const result = response?.data?.success
                ? response.data
                : response;

              if (!result?.success) {
                throw new Error(
                  result?.message || "Unable to update invoice status.",
                );
              }

              const updatedInvoice = result.data;

              let notificationSent = false;

              try {
                await sendInvoiceBroadcast({
                  ...invoice,
                  ...updatedInvoice,
                  childId: updatedInvoice?.childId || invoice.childId,
                });

                notificationSent = true;
              } catch (broadcastError) {
                console.error(
                  "Invoice broadcast error:",
                  broadcastError?.response?.data
                    || broadcastError?.message,
                );
              }

              await loadInvoices({
                pageNumber: 1,
              });

              Alert.alert(
                "Success",
                notificationSent
                  ? "Invoice activated and notification sent successfully."
                  : "Invoice activated, but notification could not be sent.",
              );
            } catch (error) {
              Alert.alert(
                "Error",
                error?.response?.data?.message
                  || error?.message
                  || "Unable to update invoice status.",
              );
            } finally {
              setUpdatingStatusId(null);
            }
          },
        },
      ],
    );
  };

  const renderInvoice = ({ item }) => {
    const theme = getStatusTheme(item.status);

    const childName = item.childId?.fullName
      || item.childName
      || "Unknown Child";

    const parentName = item.parentId?.fullName
      || item.parentName
      || "Parent/Guardian";

    const total = Number(item.totalAmount || 0);
    const paid = Number(item.paidAmount || 0);
    const balance = Number(item.balanceDue || 0);

    const percentage = total > 0
      ? Math.min(Math.max((paid / total) * 100, 0), 100)
      : 0;

    const canPay = balance > 0
      && !["Draft", "Cancelled"].includes(item.status);

    return (
      <View style={styles.invoiceCard}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleViewInvoice(item)}
        >
          <View style={styles.invoiceHeaderRow}>
            <View
              style={[
                styles.invoiceIconContainer,
                { backgroundColor: theme.bg },
              ]}
            >
              <Feather
                name={theme.icon}
                size={fontSize(18)}
                color={theme.color}
              />
            </View>

            <View style={styles.invoiceTextContainer}>
              <Text
                style={styles.parentName}
                numberOfLines={1}
              >
                {parentName}
              </Text>

              <Text
                style={styles.childSubtitle}
                numberOfLines={2}
              >
                Child: {childName}
              </Text>

              <Text style={styles.invoiceNumber}>
                {item.invoiceNumber}
              </Text>
            </View>

            <Feather
              name="chevron-right"
              size={fontSize(20)}
              color="#94A3B8"
            />
          </View>

          <View style={styles.invoiceDatesRow}>
            <View style={styles.invoiceDateBlock}>
              <Text style={styles.invoiceDateLabel}>Invoice Date</Text>
              <View style={styles.invoiceDateValueRow}>
                <Feather name="calendar" size={fontSize(13)} color="#64748B" />
                <Text style={styles.invoiceDateValue}>
                  {formatInvoiceDate(item.invoiceDate)}
                </Text>
              </View>
            </View>
            <View style={styles.invoiceDateBlock}>
              <Text style={styles.invoiceDateLabel}>Due Date</Text>
              <View style={styles.invoiceDateValueRow}>
                <Feather name="calendar" size={fontSize(13)} color={item.status === "Overdue" ? "#B91C1C" : "#64748B"} />
                <Text style={[styles.invoiceDateValue, item.status === "Overdue" && styles.overdueDateValue]}>
                  {formatInvoiceDate(item.dueDate)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.amountStatusRow}>
            <View style={styles.amountBlock}>
              <Text style={styles.amountLabel}>
                INVOICE AMOUNT
              </Text>

              <Text style={styles.amountValue}>
                {formatCurrency(total)}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: theme.color },
                ]}
              >
                {item.status}
              </Text>
            </View>
          </View>

          <View style={styles.balanceBox}>
            <View style={styles.balanceInfoRow}>
              <Text style={styles.balanceInfoLabel}>
                Collected
              </Text>

              <Text style={styles.collectedValue}>
                {formatCurrency(paid)}
              </Text>
            </View>

            <View style={styles.balanceInfoRow}>
              <Text style={styles.balanceInfoLabel}>
                Outstanding
              </Text>

              <Text style={styles.balanceInfoValue}>
                {formatCurrency(balance)}
              </Text>
            </View>

            <View style={styles.cardProgressTrack}>
              <View
                style={[
                  styles.cardProgressFill,
                  { width: `${percentage}%` },
                ]}
              />
            </View>

            <Text style={styles.cardProgressText}>
              {Math.round(percentage)}% Paid
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={() => handleViewInvoice(item)}
          >
            <Feather
              name="eye"
              size={fontSize(17)}
              color="#475569"
            />
          </TouchableOpacity>

          {item.status === "Draft" && (
            <TouchableOpacity
              style={[
                styles.editPaymentBtn,
                updatingStatusId === item._id && {
                  opacity: 0.6,
                },
              ]}
              disabled={!!updatingStatusId}
              onPress={() => handleUpdateDraftStatus(item)}
            >
              {updatingStatusId === item._id
                ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                )
                : (
                  <>
                    <Feather
                      name="edit-3"
                      size={fontSize(15)}
                      color="#FFFFFF"
                    />

                    <Text style={styles.editPaymentText}>
                      Update Status
                    </Text>
                  </>
                )}
            </TouchableOpacity>
          )}

          {canPay && (
            <TouchableOpacity
              style={styles.editPaymentBtn}
              onPress={() => handleEditPayment(item)}
            >
              <Feather
                name="credit-card"
                size={fontSize(15)}
                color="#FFFFFF"
              />

              <Text style={styles.editPaymentText}>
                Update Payment
              </Text>
            </TouchableOpacity>
          )}

          {canPay && (
            <TouchableOpacity
              style={styles.remindBtn}
              onPress={() => handleRemind(item)}
            >
              <Feather
                name="mail"
                size={fontSize(16)}
                color="#BA1A1A"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />

          <Text style={styles.loadingText}>
            Loading invoices...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Feather
            name="file-text"
            size={fontSize(32)}
            color="#94A3B8"
          />
        </View>

        <Text style={styles.emptyTitle}>
          No invoices found
        </Text>

        <Text style={styles.emptyDescription}>
          {debouncedSearch
              || selectedStatus !== "All Statuses"
            ? "Try changing your search or filter."
            : "Create your first invoice to get started."}
        </Text>

        {!debouncedSearch
          && selectedStatus === "All Statuses" && (
          <TouchableOpacity
            style={styles.emptyCreateBtn}
            onPress={handleCreateInvoice}
          >
            <Feather
              name="plus"
              size={fontSize(16)}
              color="#FFFFFF"
            />

            <Text style={styles.emptyCreateText}>
              Create Invoice
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator
            size="small"
            color={colors.primary}
          />

          <Text style={styles.footerLoaderText}>
            Loading more...
          </Text>
        </View>
      );
    }

    if (!hasMore && invoices.length > 0) {
      return (
        <Text style={styles.endText}>
          No more invoices
        </Text>
      );
    }

    return <View style={styles.footerSpacing} />;
  };

  const renderFilterModal = () => (
    <Modal
      visible={filterModalVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setFilterModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Filter by Status
            </Text>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setFilterModalVisible(false)}
            >
              <Feather
                name="x"
                size={fontSize(20)}
                color="#64748B"
              />
            </TouchableOpacity>
          </View>

          {STATUS_OPTIONS.map((status) => {
            const selected = selectedStatus === status;

            return (
              <TouchableOpacity
                key={status}
                style={[
                  styles.modalOption,
                  selected && styles.modalOptionSelected,
                ]}
                onPress={() => handleSelectStatus(status)}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    selected
                    && styles.modalOptionTextSelected,
                  ]}
                >
                  {status}
                </Text>

                {selected && (
                  <View style={styles.checkCircle}>
                    <Feather
                      name="check"
                      size={fontSize(14)}
                      color="#FFFFFF"
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );

  const renderPaymentModal = () => {
    const total = Number(
      selectedInvoice?.totalAmount || 0,
    );

    const collected = Number(
      selectedInvoice?.paidAmount || 0,
    );

    const balance = Number(
      selectedInvoice?.balanceDue || 0,
    );

    const amount = paymentStatus === "Paid"
      ? balance
      : Number(paymentAmount || 0);

    const remainingAfterPayment = roundMoney(
      Math.max(balance - amount, 0),
    );

    return (
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closePaymentModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
        >
          <View style={styles.paymentModalContent}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.paymentScrollContent}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    Update Payment
                  </Text>

                  <Text style={styles.paymentInvoiceNumber}>
                    {selectedInvoice?.invoiceNumber}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={closePaymentModal}
                  disabled={savingPayment}
                >
                  <Feather
                    name="x"
                    size={fontSize(20)}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.paymentSummary}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    Invoice Total
                  </Text>

                  <Text style={styles.summaryValue}>
                    {formatCurrency(total)}
                  </Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    Already Collected
                  </Text>

                  <Text style={styles.summaryCollected}>
                    {formatCurrency(collected)}
                  </Text>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    Outstanding Balance
                  </Text>

                  <Text style={styles.summaryOutstanding}>
                    {formatCurrency(balance)}
                  </Text>
                </View>
              </View>

              <Text style={styles.inputLabel}>
                Payment Status
              </Text>

              <View style={styles.paymentStatusRow}>
                {["Partially Paid", "Paid"].map((status) => {
                  const selected = paymentStatus === status;

                  return (
                    <TouchableOpacity
                      key={status}
                      disabled={savingPayment}
                      style={[
                        styles.paymentStatusOption,
                        selected
                        && styles.paymentStatusOptionActive,
                      ]}
                      onPress={() => handlePaymentStatusChange(status)}
                    >
                      <Feather
                        name={status === "Paid"
                          ? "check-circle"
                          : "clock"}
                        size={fontSize(16)}
                        color={selected ? "#FFFFFF" : "#64748B"}
                      />

                      <Text
                        style={[
                          styles.paymentStatusText,
                          selected
                          && styles.paymentStatusTextActive,
                        ]}
                      >
                        {status}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>
                Payment Amount
              </Text>

              <View
                style={[
                  styles.paymentInputContainer,
                  paymentStatus === "Paid"
                  && styles.disabledInput,
                ]}
              >
                <Text style={styles.currencyPrefix}>
                  PKR
                </Text>

                <TextInput
                  style={styles.paymentInput}
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  keyboardType="decimal-pad"
                  placeholder="Enter amount"
                  placeholderTextColor="#94A3B8"
                  editable={paymentStatus !== "Paid"
                    && !savingPayment}
                />
              </View>

              {paymentStatus === "Paid" && (
                <Text style={styles.inputHint}>
                  Full remaining balance will be collected.
                </Text>
              )}

              <View style={styles.remainingPreview}>
                <Text style={styles.remainingLabel}>
                  Balance After Payment
                </Text>

                <Text style={styles.remainingValue}>
                  {formatCurrency(remainingAfterPayment)}
                </Text>
              </View>

              <Text style={styles.inputLabel}>
                Payment Method
              </Text>

              <View style={styles.paymentMethodGrid}>
                {PAYMENT_METHODS.map((method) => {
                  const selected = paymentMethod === method;

                  return (
                    <TouchableOpacity
                      key={method}
                      disabled={savingPayment}
                      style={[
                        styles.methodOption,
                        selected && styles.methodOptionActive,
                      ]}
                      onPress={() => setPaymentMethod(method)}
                    >
                      <Text
                        style={[
                          styles.methodText,
                          selected && styles.methodTextActive,
                        ]}
                      >
                        {method}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>
                Payment Note (Optional)
              </Text>

              <TextInput
                style={styles.noteInput}
                value={paymentNote}
                onChangeText={setPaymentNote}
                placeholder="Add payment note..."
                placeholderTextColor="#94A3B8"
                multiline
                textAlignVertical="top"
                editable={!savingPayment}
              />

              <TouchableOpacity
                style={[
                  styles.savePaymentBtn,
                  savingPayment && styles.disabledButton,
                ]}
                onPress={handleSavePayment}
                disabled={savingPayment}
              >
                {savingPayment ? <ActivityIndicator color="#FFFFFF" /> : (
                  <>
                    <Feather
                      name="check"
                      size={fontSize(18)}
                      color="#FFFFFF"
                    />

                    <Text style={styles.savePaymentText}>
                      Save Payment
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelPaymentBtn}
                onPress={closePaymentModal}
                disabled={savingPayment}
              >
                <Text style={styles.cancelPaymentText}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  return (
    <View
      style={[
        styles.container,
        commonStyles.container,
      ]}
    >
    
      <FlatList
        data={invoices}
        keyExtractor={(item) => String(item._id)}
        renderItem={renderInvoice}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => { scrollTriggeredRef.current = true; }}
        onMomentumScrollBegin={() => { scrollTriggeredRef.current = true; }}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.15}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      />

      {renderFilterModal()}
      {renderPaymentModal()}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: wp(16),
    paddingTop: hp(16),
    paddingBottom: hp(30),
    flexGrow: 1,
  },

  screenTitle: {
    fontSize: fontSize(24),
    fontFamily: fonts.bold,
    color: "#0F172A",
    lineHeight: 34,
    marginBottom: hp(5),
  },

  introDescription: {
    fontSize: fontSize(15),
    color: colors.blackFont,
    lineHeight: 22,
    fontFamily: fonts.regular,
    marginBottom: hp(20),
  },

  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: wp(12),
    paddingVertical: hp(14),
    paddingHorizontal: wp(18),
    marginBottom: hp(20),
    gap: wp(8),
    alignSelf: "flex-start",
  },

  createBtnText: {
    fontSize: fontSize(14),
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
    lineHeight:18
  },

  metricCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(18),
    padding: wp(20),
    marginBottom: hp(12),
    borderWidth: 1,
    borderColor: "#F1F5F9",
    elevation: 1,
  },

  metricTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  metricText: {
    flex: 1,
    marginRight: 12,
  },

  metricLabel: {
    fontSize: fontSize(12),
    fontFamily: fonts.semiBold,
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: hp(8),
  },

  metricValue: {
    fontSize: fontSize(27),
    fontFamily: fonts.bold,
    lineHeight: 38,
  },

  metricIcon: {
    width: wp(46),
    height: hp(46),
    borderRadius: wp(10),
    alignItems: "center",
    justifyContent: "center",
  },

  metricSubtitle: {
    fontSize: fontSize(12),
    color: "#64748B",
    fontFamily: fonts.regular,
    marginTop: 2,
  },

  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(16),
    padding: wp(18),
    marginBottom: hp(16),
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: hp(14),
  },

  progressTitle: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },

  progressPercent: {
    fontSize: fontSize(14),
    fontFamily: fonts.bold,
    color: "#006B58",
  },

  progressTrack: {
    height: 9,
    backgroundColor: "#FEE2E2",
    borderRadius: wp(10),
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#059669",
    borderRadius: wp(10),
  },

  progressLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  progressCollected: {
    fontSize: fontSize(12),
    color: "#059669",
    fontFamily: fonts.regular,
  },

  progressOutstanding: {
    fontSize: fontSize(12),
    color: "#BA1A1A",
    fontFamily: fonts.regular,
  },

  filterSection: {
    marginBottom: hp(16),
    backgroundColor: "#FFFFFF",
    borderRadius: wp(16),
    padding: wp(16),
    elevation: 1,
  },

  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAFD",
    borderRadius: wp(12),
    paddingHorizontal: wp(14),
    height: 46,
    marginBottom: hp(10),
    gap: wp(8),
  },

  searchInput: {
    flex: 1,
    fontSize: fontSize(14),
    color: colors.blackFont,
    fontFamily: fonts.regular,
    paddingVertical: 0,
  },

  dropdownFilter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7FAFD",
    borderRadius: wp(12),
    paddingHorizontal: wp(14),
    height: 46,
  },

  filterLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(10),
  },

  dropdownFilterText: {
    fontSize: fontSize(14),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },

  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: hp(10),
  },

  resultTitle: {
    fontSize: fontSize(17),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
  },

  resultCount: {
    fontSize: fontSize(12),
    fontFamily: fonts.regular,
    color: "#94A3B8",
  },

  invoiceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: wp(16),
    padding: wp(16),
    marginBottom: hp(12),
    borderWidth: 1,
    borderColor: "#F1F5F9",
    elevation: 1,
  },

  invoiceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: hp(16),
  },

  invoiceIconContainer: {
    width: 42,
    height: 42,
    borderRadius: wp(11),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  invoiceTextContainer: {
    flex: 1,
    marginRight: 8,
  },

  parentName: {
    fontSize: fontSize(16),
    fontFamily: fonts.semiBold,
    color: "#181C1E",
  },

  childSubtitle: {
    marginTop: 3,
    fontSize: fontSize(12),
    color: colors.blackFont,
    fontFamily: fonts.regular,
  },

  invoiceNumber: {
    marginTop: 4,
    fontSize: fontSize(11),
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  invoiceDatesRow: {
    flexDirection: "row",
    gap: wp(10),
    marginBottom: hp(14),
  },
  invoiceDateBlock: {
    flex: 1,
    padding: wp(10),
    borderRadius: wp(10),
    backgroundColor: "#F8FAFC",
  },
  invoiceDateLabel: {
    fontSize: fontSize(11),
    fontFamily: fonts.regular,
    color: "#64748B",
    marginBottom: hp(6),
  },
  invoiceDateValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(5),
  },
  invoiceDateValue: {
    fontSize: fontSize(12),
    fontFamily: fonts.semiBold,
    color: "#0F172A",
    flexShrink: 1,
  },
  overdueDateValue: {
    color: "#B91C1C",
  },

  amountStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: hp(12),
    gap: wp(8),
  },

  amountBlock: {
    flex: 1,
  },

  amountLabel: {
    fontSize: fontSize(11),
    fontFamily: fonts.regular,
    color: "#94A3B8",
    letterSpacing: 0.5,
  },

  amountValue: {
    marginTop: 4,
    fontSize: fontSize(18),
    fontFamily: fonts.semiBold,
    color: "#00497B",
  },

  statusBadge: {
    paddingHorizontal: wp(11),
    paddingVertical: 6,
    borderRadius: wp(20),
    borderWidth: 1,
  },

  statusBadgeText: {
    fontSize: fontSize(11),
    fontFamily: fonts.semiBold,
  },

  balanceBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: wp(12),
    padding: wp(12),
    gap: wp(10),
  },

  balanceInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: wp(8),
  },

  balanceInfoLabel: {
    fontSize: fontSize(12),
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  collectedValue: {
    fontSize: fontSize(13),
    color: "#059669",
    fontFamily: fonts.semiBold,
  },

  balanceInfoValue: {
    fontSize: fontSize(13),
    color: "#BA1A1A",
    fontFamily: fonts.semiBold,
  },

  cardProgressTrack: {
    height: 6,
    backgroundColor: "#FEE2E2",
    borderRadius: wp(10),
    overflow: "hidden",
  },

  cardProgressFill: {
    height: "100%",
    backgroundColor: "#059669",
  },

  cardProgressText: {
    fontSize: fontSize(11),
    color: "#64748B",
    fontFamily: fonts.regular,
    textAlign: "right",
  },

  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 14,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(8),
  },

  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: wp(10),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  editPaymentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: wp(9),
    paddingHorizontal: wp(10),
    height: 38,
    gap: wp(7),
  },

  editPaymentText: {
    fontSize: fontSize(12),
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
  },

  remindBtn: {
    width: 38,
    height: 38,
    borderRadius: wp(10),
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },

  loadingText: {
    marginTop: 12,
    fontSize: fontSize(14),
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: wp(30),
  },

  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: wp(35),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: hp(16),
  },

  emptyTitle: {
    fontSize: fontSize(18),
    color: "#0F172A",
    fontFamily: fonts.semiBold,
    marginBottom: hp(6),
  },

  emptyDescription: {
    fontSize: fontSize(13),
    lineHeight: 20,
    color: "#64748B",
    fontFamily: fonts.regular,
    textAlign: "center",
  },

  emptyCreateBtn: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: wp(18),
    paddingVertical: 11,
    borderRadius: wp(10),
    gap: wp(7),
  },

  emptyCreateText: {
    fontSize: fontSize(13),
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
  },

  footerLoader: {
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: wp(8),
  },

  footerLoaderText: {
    fontSize: fontSize(12),
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  footerSpacing: {
    height: 15,
  },

  endText: {
    textAlign: "center",
    paddingVertical: 20,
    fontSize: fontSize(12),
    color: "#94A3B8",
    fontFamily: fonts.regular,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: wp(16),
  },

  modalContent: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: wp(18),
    padding: wp(18),
    elevation: 5,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: hp(16),
  },

  modalTitle: {
    fontSize: fontSize(18),
    fontFamily: fonts.bold,
    color: "#0F172A",
  },

  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: wp(18),
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  modalOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 52,
    paddingHorizontal: wp(12),
    borderRadius: wp(10),
    marginTop: 3,
  },

  modalOptionSelected: {
    backgroundColor: "#F0F7FB",
  },

  modalOptionText: {
    fontSize: fontSize(15),
    fontFamily: fonts.regular,
    color: "#334155",
  },

  modalOptionTextSelected: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },

  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: wp(12),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  paymentModalContent: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderRadius: wp(20),
    overflow: "hidden",
    padding: wp(20),

  },

  paymentScrollContent: {
    paddingBottom: hp(24),
  },

  paymentInvoiceNumber: {
    fontSize: fontSize(12),
    color: "#64748B",
    fontFamily: fonts.regular,
    marginTop: 4,
  },

  paymentSummary: {
    backgroundColor: "#F8FAFC",
    borderRadius: wp(12),
    padding: wp(15),
    gap: wp(12),
    marginBottom: hp(20),
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: wp(8),
  },

  summaryLabel: {
    fontSize: fontSize(12),
    color: "#64748B",
    fontFamily: fonts.regular,
    flex: 1,
  },

  summaryValue: {
    fontSize: fontSize(13),
    color: "#0F172A",
    fontFamily: fonts.semiBold,
  },

  summaryCollected: {
    fontSize: fontSize(13),
    color: "#059669",
    fontFamily: fonts.semiBold,
  },

  summaryOutstanding: {
    fontSize: fontSize(15),
    color: "#BA1A1A",
    fontFamily: fonts.bold,
  },

  summaryDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },

  inputLabel: {
    fontSize: fontSize(13),
    color: "#334155",
    fontFamily: fonts.semiBold,
    marginBottom: hp(9),
  },

  paymentStatusRow: {
    flexDirection: "row",
    gap: wp(10),
    marginBottom: hp(20),
  },

  paymentStatusOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: wp(6),
    borderRadius: wp(10),
    backgroundColor: "#F1F5F9",
    paddingVertical: 13,
  },

  paymentStatusOptionActive: {
    backgroundColor: colors.primary,
  },

  paymentStatusText: {
    fontSize: fontSize(12),
    color: "#475569",
    fontFamily: fonts.semiBold,
  },

  paymentStatusTextActive: {
    color: "#FFFFFF",
  },

  paymentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: wp(10),
    paddingHorizontal: wp(14),
    height: 50,
    marginBottom: hp(12),
  },

  disabledInput: {
    backgroundColor: "#F8FAFC",
  },

  currencyPrefix: {
    fontSize: fontSize(14),
    color: "#64748B",
    fontFamily: fonts.semiBold,
    marginRight: 10,
  },

  paymentInput: {
    flex: 1,
    fontSize: fontSize(16),
    color: "#0F172A",
    fontFamily: fonts.semiBold,
    paddingVertical: 0,
  },

  inputHint: {
    fontSize: fontSize(12),
    color: "#059669",
    fontFamily: fonts.regular,
    marginBottom: hp(12),
  },

  remainingPreview: {
    backgroundColor: "#EFF6FF",
    borderRadius: wp(10),
    padding: wp(13),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: wp(8),
    marginBottom: hp(20),
  },

  remainingLabel: {
    fontSize: fontSize(12),
    color: "#475569",
    fontFamily: fonts.regular,
    flex: 1,
  },

  remainingValue: {
    fontSize: fontSize(14),
    color: colors.primary,
    fontFamily: fonts.bold,
  },

  paymentMethodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: wp(8),
    marginBottom: hp(20),
  },

  methodOption: {
    paddingHorizontal: wp(13),
    paddingVertical: 10,
    borderRadius: wp(9),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },

  methodOptionActive: {
    borderColor: colors.primary,
    backgroundColor: "#EBF3F9",
  },

  methodText: {
    fontSize: fontSize(12),
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  methodTextActive: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },

  noteInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: wp(10),
    padding: wp(12),
    height: 75,
    fontSize: fontSize(13),
    fontFamily: fonts.regular,
    color: "#0F172A",
    marginBottom: hp(20),
  },

  savePaymentBtn: {
    backgroundColor: colors.primary,
    borderRadius: wp(11),
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: wp(8),
  },

  disabledButton: {
    opacity: 0.6,
  },

  savePaymentText: {
    fontSize: fontSize(14),
    color: "#FFFFFF",
    fontFamily: fonts.semiBold,
  },

  cancelPaymentBtn: {
    paddingVertical: 15,
    alignItems: "center",
  },

  cancelPaymentText: {
    fontSize: fontSize(13),
    color: "#64748B",
    fontFamily: fonts.semiBold,
  },
});
