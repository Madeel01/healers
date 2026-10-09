import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
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

import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  AssignTheraistChild,
  createInvoiceApi,
  getInvoiceChildrenApi,
  getServices,
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
