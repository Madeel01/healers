import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
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
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  createInvoiceApi,
  getInvoiceChildrenApi,
} from '../../api/admin/api';
import BottomBar from '../../components/BottomBar';
import TopBar from '../../components/TopBar';
import {
  colors,
  commonStyles,
  fonts,
} from '../../styles/theme';

const CHILD_LIMIT = 5;

const getTodayDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultDueDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
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

  return type.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const parseDate = (dateString) => {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export default function CreateNewInvoiceScreen({ navigation }) {
  const [childSearch, setChildSearch] = useState("");
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [childrenLoadingMore, setChildrenLoadingMore] = useState(false);
  const [childPage, setChildPage] = useState(1);
  const [childHasMore, setChildHasMore] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(getTodayDate());
  const [dueDate, setDueDate] = useState(getDefaultDueDate());
  const [showInvoiceDatePicker, setShowInvoiceDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [items, setItems] = useState([
    {
      id: "1",
      packageId: null,
      package: "",
      packageType: "",
      discount: "0",
      packagePrice: "0",
    },
  ]);
  const searchTimerRef = useRef(null);
  const requestIdRef = useRef(0);

  const loadChildren = useCallback(
    async ({ search = "", page = 1, append = false } = {}) => {
      const requestId = ++requestIdRef.current;

      try {
        if (append) {
          setChildrenLoadingMore(true);
        } else {
          setChildrenLoading(true);
        }

        const response = await getInvoiceChildrenApi({
          search: search.trim(),
          page,
          limit: CHILD_LIMIT,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        const result = response;

        if (!result?.success) {
          if (!append) {
            setChildren([]);
          }
          setChildHasMore(false);
          return;
        }

        const newChildren = Array.isArray(result.data)
          ? result.data
          : [];

        if (append) {
          setChildren(
            (previous) => {
              const existingIds = new Set(
                previous.map((child) => String(child._id || child.id)),
              );

              const uniqueChildren = newChildren.filter(
                (child) => !existingIds.has(String(child._id || child.id)),
              );

              return [
                ...previous,
                ...uniqueChildren,
              ];
            },
          );
        } else {
          setChildren(newChildren);
        }
        setChildPage(Number(result?.pagination?.page) || page);
        setChildHasMore(Boolean(result?.pagination?.hasMore));
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        console.log(
          "getInvoiceChildren error:",
          error?.response?.data || error?.message || error,
        );

        if (!append) {
          setChildren([]);
        }
        setChildHasMore(false);
      } finally {
        if (requestId === requestIdRef.current) {
          setChildrenLoading(false);
          setChildrenLoadingMore(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    loadChildren({ search: "", page: 1 });

    return () => {
      requestIdRef.current += 1;

      if (
        searchTimerRef.current
      ) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [loadChildren]);

  useEffect(() => {
    if (selectedChild) {
      return undefined;
    }

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = setTimeout(() => {
      setChildPage(1);

      loadChildren({
        search: childSearch,
        page: 1,
      });
    }, 500);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [childSearch, selectedChild, loadChildren]);

  const handleLoadMoreChildren = () => {
    if (childrenLoading || childrenLoadingMore || !childHasMore) {
      return;
    }

    loadChildren({
      search: childSearch,
      page: childPage + 1,
      append: true,
    });
  };

  const handleSelectChild = (child) => {
    requestIdRef.current += 1;

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
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
      const packagePrice = Number(child.package.price) || 0;

      const hasDiscountedPrice = child.discountedPrice !== null
        && child.discountedPrice !== undefined;
      const discountedPrice = hasDiscountedPrice
        ? Number(child.discountedPrice)
        : 0;
      const discount = Math.max(
        discountedPrice,
        0,
      );

      setItems([
        {
          id: Date.now().toString(),
          packageId: child.package._id || null,
          packagePrice,
          package: child.package.name || "",
          packageType: child.package.type || "",
          discount: String(discount),
        },
      ]);
    } else {
      setItems([createEmptyItem()]);
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
        discount: "0",
        packagePrice: "0",
      },
    ]);

    loadChildren({
      search: "",
      page: 1,
    });
  };

  const subtotal = items.reduce((sum, item) => {
    const packagePrice = Number(item.packagePrice) || 0;
    const discount = Math.max(Number(item.discount) || 0, 0);
    const discountAmount = Math.min(discount, packagePrice);
    const finalPrice = packagePrice - discountAmount;
    return sum + finalPrice;
  }, 0);

  const taxPercentage = 0;
  const tax = subtotal * (taxPercentage / 100);
  const totalAmount = subtotal + tax;

  const validateForm = () => {
    if (!selectedChild) {
      Alert.alert(
        "Select Child",
        "Please select a child.",
      );

      return false;
    }

    if (!invoiceDate.trim()) {
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

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const rate = Number(item.packagePrice);
      const discount = Number(item.discount);
      if (!item.package) {
        Alert.alert(
          "Service Required",
          `No package is available for item ${index + 1}.`,
        );

        return false;
      }

      if (Number.isNaN(rate) || rate < 0) {
        Alert.alert(
          "Invalid Rate",
          `Enter a valid rate for item ${index + 1}.`,
        );

        return false;
      }

      if (Number.isNaN(discount) || discount < 0) {
        Alert.alert(
          "Invalid Discount",
          `Discount must be between 0 and 100 for item ${index + 1}.`,
        );

        return false;
      }
    }

    return true;
  };

  const buildInvoicePayload = (status = "Pending") => {
    const childId = selectedChild?._id || selectedChild?.id;

    return {
      childId,
      invoiceDate,
      dueDate,

      items: items.map((item) => {
        const rate = Number(item.packagePrice) || 0;
        const discount = Number(item.discount) || 0;
        const quantity = 1;

        const amount = Math.max(
          rate * quantity - discount,
          0,
        );

        return {
          packageId: item.packageId || undefined,
          serviceName: item.package,
          description: item.packageType
            ? formatPackageType(item.packageType)
            : "",
          quantity,
          rate,
          discount,
          amount: Number(amount.toFixed(2)),
          durationUnit: item.packageType === "per-month"
            ? "month"
            : item.packageType === "per-session"
            ? "session"
            : item.packageType === "batch"
            ? "batch"
            : "custom",
        };
      }),

      clinicalSummary: "",
      notes: "Thanks for your business.",
      termsAndConditions: "",
      status,
    };
  };

  const handleSubmitInvoice = async (status = "Pending") => {
    if (!validateForm()) {
      return;
    }

    if (submitting) {
      return;
    }

    try {
      setSubmitting(true);

      const payload = buildInvoicePayload(status);
      console.log(
        "invoice payload:",
        payload,
      );
      const response = await createInvoiceApi(payload);
      const result = response;
      if (!result?.success) {
        Alert.alert(
          "Error",
          result?.message || "Unable to create invoice.",
        );

        return;
      }

      const createdInvoice = result.data;

      Alert.alert(
        status === "Draft"
          ? "Draft Saved"
          : "Invoice Created",
        status === "Draft"
          ? "Invoice draft saved successfully."
          : "Invoice created successfully.",
        [
          {
            text: "View Invoice",

            onPress: () => {
              navigation.replace(
                "InvoiceView",
                {
                  invoiceId: createdInvoice
                    ?._id,
                },
              );
            },
          },

          {
            text: "Done",
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (error) {
      console.log(
        "createInvoice error:",
        error?.response?.data || error?.message || error,
      );

      Alert.alert(
        "Error",
        error?.response?.data?.message
          || "Unable to create invoice.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.mainContainer, commonStyles.container]}>
      <TopBar
        navigation={navigation}
        headerTitle="Create New Invoice"
      />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather
              name="user-check"
              size={18}
              color={colors.primary}
            />

            <Text style={styles.cardHeaderTitle}>
              Client Selection
            </Text>
          </View>

          <Text style={styles.inputLabel}>
            Select Child
          </Text>

          {!selectedChild
            ? (
              <>
                <View style={styles.searchContainer}>
                  <Feather
                    name="search"
                    size={18}
                    color="#64748B"
                    style={styles.searchIcon}
                  />

                  <TextInput
                    style={styles.searchInput}
                    value={childSearch}
                    onChangeText={setChildSearch}
                    placeholder="Search child by name, email, phone or father..."
                    placeholderTextColor="#94A3B8"
                    autoCorrect={false}
                    autoCapitalize="none"
                  />

                  {childrenLoading
                    ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.primary}
                      />
                    )
                    : childSearch
                    ? (
                      <TouchableOpacity
                        onPress={() => setChildSearch("")}
                      >
                        <Feather
                          name="x"
                          size={18}
                          color="#94A3B8"
                        />
                      </TouchableOpacity>
                    )
                    : null}
                </View>

                <View style={styles.childrenList}>
                  {childrenLoading && children.length === 0
                    ? (
                      <View style={styles.childLoadingContainer}>
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />

                        <Text style={styles.childLoadingText}>
                          Loading children...
                        </Text>
                      </View>
                    )
                    : children.length === 0
                    ? (
                      <View style={styles.noChildrenContainer}>
                        <View style={styles.emptyIconCircle}>
                          <Feather
                            name="users"
                            size={24}
                            color="#94A3B8"
                          />
                        </View>

                        <Text style={styles.noChildrenTitle}>
                          No children found
                        </Text>

                        <Text style={styles.noChildrenText}>
                          Try another name, email, phone, father name or CNIC.
                        </Text>
                      </View>
                    )
                    : (
                      <>
                        {children.map((child) => {
                          const childId = child._id || child.id;

                          return (
                            <TouchableOpacity
                              key={String(childId)}
                              style={styles.childSearchItem}
                              activeOpacity={0.7}
                              onPress={() => handleSelectChild(child)}
                            >
                              {child.profileImage
                                ? (
                                  <Image
                                    source={{ uri: child.profileImage }}
                                    style={styles.searchAvatar}
                                  />
                                )
                                : (
                                  <View style={styles.avatarFallback}>
                                    <Text style={styles.avatarFallbackText}>
                                      {getInitials(child.fullName)}
                                    </Text>
                                  </View>
                                )}

                              <View style={styles.childSearchInfo}>
                                <Text
                                  style={styles.childSearchName}
                                  numberOfLines={1}
                                >
                                  {child.fullName}
                                </Text>

                                <Text
                                  style={styles.childSearchMeta}
                                  numberOfLines={1}
                                >
                                  {child.fatherName
                                    ? `Father: ${child.fatherName}`
                                    : "Father information not available"}
                                </Text>

                                <Text
                                  style={styles.childSearchEmail}
                                  numberOfLines={1}
                                >
                                  {child.email || child.phone || "No contact information"}
                                </Text>

                                {child.package && (
                                  <Text
                                    style={styles.packageSearchText}
                                    numberOfLines={1}
                                  >
                                    Package: {child.package.name}
                                    {" • "}
                                    PKR {formatMoney(
                                      // child.discountedPrice !== null && child.discountedPrice !== undefined;  ? child.discountedPrice
                                      child.package.price,
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
                        })}

                        {childHasMore && (
                          <TouchableOpacity
                            style={styles.loadMoreChildrenBtn}
                            activeOpacity={0.7}
                            disabled={childrenLoadingMore}
                            onPress={handleLoadMoreChildren}
                          >
                            {childrenLoadingMore
                              ? (
                                <ActivityIndicator
                                  size="small"
                                  color={colors.primary}
                                />
                              )
                              : (
                                <>
                                  <Feather
                                    name="plus-circle"
                                    size={16}
                                    color={colors.primary}
                                  />

                                  <Text style={styles.loadMoreChildrenText}>
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
            )
            : (
              <View style={styles.selectedChildCard}>
                {selectedChild.profileImage
                  ? (
                    <Image
                      source={{
                        uri: selectedChild.profileImage,
                      }}
                      style={styles.avatar}
                    />
                  )
                  : (
                    <View style={styles.selectedAvatarFallback}>
                      <Text style={styles.avatarFallbackText}>
                        {getInitials(selectedChild.fullName)}
                      </Text>
                    </View>
                  )}

                <View style={styles.childInfo}>
                  <Text
                    style={styles.childName}
                    numberOfLines={1}
                  >
                    {selectedChild.fullName}
                  </Text>

                  <Text
                    style={styles.childSubtext}
                    numberOfLines={1}
                  >
                    {selectedChild.fatherName
                      ? `Father: ${selectedChild.fatherName}`
                      : "Father information not available"}
                  </Text>

                  {!!selectedChild.fatherCnic && (
                    <Text
                      style={styles.childEmail}
                      numberOfLines={1}
                    >
                      CNIC: {selectedChild.fatherCnic}
                    </Text>
                  )}

                  {!!selectedChild.email && (
                    <Text
                      style={styles.childEmail}
                      numberOfLines={1}
                    >
                      {selectedChild.email}
                    </Text>
                  )}

                  {!!selectedChild.package && (
                    <View
                      style={styles.packageBadge}
                    >
                      <Feather
                        name="package"
                        size={12}
                        color="#0369A1"
                      />

                      <Text
                        style={styles.packageBadgeText}
                        numberOfLines={1}
                      >
                        {selectedChild.package.name}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.selectedActions}>
                  <Feather
                    name="check-circle"
                    size={20}
                    color="#059669"
                  />

                  <TouchableOpacity
                    style={styles.changeChildBtn}
                    onPress={handleChangeChild}
                  >
                    <Feather
                      name="edit-2"
                      size={14}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather
              name="file-text"
              size={18}
              color={colors.primary}
            />

            <Text style={styles.cardHeaderTitle}>
              Billing Details
            </Text>
          </View>

          <View style={styles.row}>
            <View style={styles.halfColumn}>
              <Text style={styles.inputLabel}>
                Invoice Date
              </Text>

              <TouchableOpacity
                style={styles.dateInput}
                activeOpacity={0.7}
                onPress={() => setShowInvoiceDatePicker(true)}
              >
                <Text style={styles.dateText}>
                  {invoiceDate}
                </Text>

                <Feather
                  name="calendar"
                  size={18}
                  color={colors.primary}
                />
              </TouchableOpacity>

              {showInvoiceDatePicker && (
                <DateTimePicker
                  value={parseDate(invoiceDate)}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  maximumDate={new Date()}
                  onValueChange={(event, selectedDate) => {
                    if (Platform.OS === "android") {
                      setShowInvoiceDatePicker(false);
                    }

                    if (event.type === "dismissed") {
                      return;
                    }

                    if (selectedDate) {
                      setInvoiceDate(formatDate(selectedDate));
                    }
                  }}
                />
              )}
            </View>

            <View style={styles.halfColumn}>
              <Text style={styles.inputLabel}>
                Due Date
              </Text>

              <TouchableOpacity
                style={styles.dateInput}
                activeOpacity={0.7}
                onPress={() => setShowDueDatePicker(true)}
              >
                <Text style={styles.dateText}>
                  {dueDate}
                </Text>

                <Feather
                  name="calendar"
                  size={18}
                  color={colors.primary}
                />
              </TouchableOpacity>

              {showDueDatePicker && (
                <DateTimePicker
                  value={parseDate(dueDate)}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  minimumDate={parseDate(invoiceDate)}
                  onValueChange={(event, selectedDate) => {
                    if (Platform.OS === "android") {
                      setShowDueDatePicker(false);
                    }

                    if (event.type === "dismissed") {
                      return;
                    }

                    if (selectedDate) {
                      setDueDate(formatDate(selectedDate));
                    }
                  }}
                />
              )}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather
              name="shopping-bag"
              size={18}
              color={colors.primary}
            />

            <Text style={styles.cardHeaderTitle}>
              Services & Items
            </Text>
          </View>

          {items.map((item, index) => {
            const itemBase = (Number(item.sessions) || 0) * (Number(item.rate) || 0);
            const itemDiscount = Math.min(Math.max(Number(item.discount) || 0, 0), 100);
            const itemTotal = itemBase * (1 - itemDiscount / 100);

            return (
              <View
                key={item.id}
                style={styles.itemBox}
              >
                <Text style={styles.itemNumber}>
                  Item {index + 1}
                </Text>

                <Text style={styles.inputLabel}>
                  Service Package
                </Text>

                <View style={styles.packageDisplay}>
                  <View style={styles.packageIcon}>
                    <Feather
                      name="package"
                      size={17}
                      color="#0369A1"
                    />
                  </View>

                  <View style={styles.packageDisplayInfo}>
                    <Text
                      style={[
                        styles.packageName,
                        !item.package
                        && styles.packageEmpty,
                      ]}
                      numberOfLines={1}
                    >
                      {item.package || "No package assigned"}
                    </Text>

                    {!!item.packageType && (
                      <Text style={styles.packageType}>
                        {formatPackageType(item.packageType)}
                      </Text>
                    )}
                  </View>
                </View>

                {selectedChild?.package && item.packageId === selectedChild.package._id && (
                  <View style={styles.priceInfoBox}>
                    <View style={styles.priceInfoRow}>
                      <Text style={styles.priceInfoLabel}>
                        Package Price
                      </Text>

                      <Text style={styles.priceInfoValue}>
                        PKR {formatMoney(selectedChild.package.price)}
                      </Text>
                    </View>

                    {selectedChild.discountedPrice !== null
                      && selectedChild.discountedPrice !== undefined
                      && (
                        <View style={styles.priceInfoRow}>
                          <Text style={styles.discountPriceLabel}>
                            Child Discount
                          </Text>

                          <Text style={styles.discountPriceValue}>
                          - PKR {formatMoney(selectedChild.discountedPrice)}
                          </Text>
                        </View>
                      )}
                  </View>
                )}

                <View style={styles.summaryDivider} />

                <View style={styles.summaryTotalRow}>
                  <Text style={styles.totalLabel}>
                    Total Amount
                  </Text>

                  <Text style={styles.totalValue}>
                    PKR {formatMoney(totalAmount)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={[
            styles.draftBtn,
            submitting && styles.disabledButton,
          ]}
          activeOpacity={0.8}
          disabled={submitting}
          onPress={() => handleSubmitInvoice("Draft")}
        >
          {submitting
            ? (
              <ActivityIndicator
                size="small"
                color="#00497B"
              />
            )
            : (
              <Text style={styles.draftBtnText}>
                Save as Draft
              </Text>
            )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.generateBtn,
            submitting && styles.disabledButton,
          ]}
          activeOpacity={0.8}
          disabled={submitting}
          onPress={() => handleSubmitInvoice("Pending")}
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
                  style={styles.generateBtnText}
                >
                  Generate Invoice
                </Text>
              </>
            )}
        </TouchableOpacity>
      </ScrollView>

      <BottomBar activeTab="" />
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
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
    fontFamily: fonts.semiBold,
    color: colors.primary,
    lineHeight: 24,
  },
  inputLabel: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.blackFont,
    marginBottom: 6,
    lineHeight: 22,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAFD",
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
    fontFamily: fonts.regular,
    paddingVertical: 0,
  },

  childrenList: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },

  childSearchItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  searchAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 11,
    backgroundColor: "#F1F5F9",
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: "#E2E8F0",
  },

  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 11,
    backgroundColor: "#DDECF5",
    alignItems: "center",
    justifyContent: "center",
  },

  selectedAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: "#DDECF5",
    alignItems: "center",
    justifyContent: "center",
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
    fontFamily: fonts.semiBold,
  },

  childSearchMeta: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 16,
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  childSearchEmail: {
    marginTop: 1,
    fontSize: 10,
    lineHeight: 15,
    color: "#94A3B8",
    fontFamily: fonts.regular,
  },

  packageSearchText: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 15,
    color: "#0369A1",
    fontFamily: fonts.semiBold,
  },

  childLoadingContainer: {
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  childLoadingText: {
    marginTop: 8,
    fontSize: 12,
    color: "#64748B",
    fontFamily: fonts.regular,
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
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  noChildrenTitle: {
    marginTop: 10,
    fontSize: 14,
    color: "#334155",
    fontFamily: fonts.semiBold,
  },

  noChildrenText: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    color: "#94A3B8",
    fontFamily: fonts.regular,
  },

  loadMoreChildrenBtn: {
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#F8FAFC",
  },

  loadMoreChildrenText: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },

  selectedChildCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#DDE7EF",
  },

  childInfo: {
    flex: 1,
  },

  childName: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.primary,
    lineHeight: 22,
  },

  childSubtext: {
    marginTop: 2,
    fontSize: 12,
    color: colors.blackFont,
    fontFamily: fonts.regular,
    lineHeight: 16,
  },

  childEmail: {
    marginTop: 2,
    fontSize: 10,
    color: "#64748B",
    fontFamily: fonts.regular,
  },
  packageBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "#E0F2FE",
  },

  packageBadgeText: {
    maxWidth: 180,
    fontSize: 10,
    color: "#0369A1",
    fontFamily: fonts.semiBold,
  },

  selectedActions: {
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginLeft: 8,
  },

  changeChildBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  dateInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dateText: {
    fontSize: 14,
    color: "#0F172A",
    fontFamily: fonts.regular,
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
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: "#0F172A",
    fontFamily: fonts.regular,
  },

  itemBox: {
    position: "relative",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  itemNumber: {
    fontSize: 12,
    color: "#94A3B8",
    fontFamily: fonts.semiBold,
    marginBottom: 10,
  },
  packageDisplay: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },

  packageIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  packageDisplayInfo: {
    flex: 1,
  },

  packageName: {
    fontSize: 14,
    color: "#0F172A",
    fontFamily: fonts.semiBold,
  },

  packageEmpty: {
    color: "#94A3B8",
    fontFamily: fonts.regular,
  },

  packageType: {
    marginTop: 2,
    fontSize: 10,
    color: "#64748B",
    fontFamily: fonts.regular,
  },
  priceInfoBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },

  priceInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 2,
  },

  priceInfoLabel: {
    fontSize: 11,
    color: "#64748B",
    fontFamily: fonts.regular,
  },

  priceInfoValue: {
    fontSize: 11,
    color: "#334155",
    fontFamily: fonts.semiBold,
  },

  discountPriceLabel: {
    fontSize: 11,
    color: "#BA1A1A",
    fontFamily: fonts.semiBold,
  },

  discountPriceValue: {
    fontSize: 12,
    color: "#BA1A1A",
    fontFamily: fonts.bold,
  },

  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#00497B",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },

  addItemBtnText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: "#00497B",
  },

  summaryDivider: {
    height: 1,
    backgroundColor: "#CBD5E1",
    marginVertical: 10,
  },

  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
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
    borderColor: "#00497B",
    borderRadius: 12,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  draftBtnText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: "#00497B",
  },

  generateBtn: {
    flexDirection: "row",
    backgroundColor: "#00497B",
    borderRadius: 12,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    gap: 7,
  },

  generateBtnText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: "#FFFFFF",
  },

  disabledButton: {
    opacity: 0.6,
  },
});
