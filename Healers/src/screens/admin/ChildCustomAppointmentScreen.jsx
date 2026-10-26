import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import {
  createChildCustomAppointment,
  getChildCustomSlotOptions,
  getServices,
  getUsersByRole,
} from '../../api/admin/api';
import {
  colors,
  fonts,
} from '../../styles/theme';
import { formatTo12Hour } from '../../utils/hoursformat';
import {
  fontSize,
  hp,
  wp,
} from '../../utils/responsive';
import SessionSlotPicker from './components/SessionSlotPicker';

const DURATIONS = [45, 60, 90, 120];

const prettyFull = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function ChildCustomAppointmentScreen({ navigation, route }) {
  const { childId, childName } = route.params;
  const [selectingTherapist, setSelectingTherapist] = useState(false);
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const { width } = useWindowDimensions();
  const isSmallDevice = width < 380;

  const [search, setSearch] = useState("");
  const [therapists, setTherapists] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const [therapistId, setTherapistId] = useState(null);
  const [minutes, setMinutes] = useState(60);
  const [choice, setChoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [services, setServices] = useState([]);

  useEffect(() => {
    let alive = true;
    getServices({ search: "" })
      .then((res) => {
        if (alive) setServices((res?.data || []).filter((s) => s.isActive === true));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const serviceMap = useMemo(
    () => new Map(services.map((s) => [s.id, s])),
    [services],
  );

  useEffect(() => {
    let alive = true;
    setLoadingList(true);
    const t = setTimeout(async () => {
      try {
        const res = await getUsersByRole({ role: "Therapist", search });
        if (alive) setTherapists(res?.data || []);
      } catch (e) {
        if (alive) setTherapists([]);
      } finally {
        if (alive) setLoadingList(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [search]);

  const loadSlots = useCallback(
    (date, m) => getChildCustomSlotOptions(childId, { therapistId, date, sessionMinutes: m }),
    [childId, therapistId],
  );

  const pickTherapist = (t) => {
    if (t === therapistId) return;

    setSelectedTherapist(t);
    setTherapistId(t._id || t.id);
    setChoice(null);
  };
  const pickMinutes = (m) => {
    setMinutes(m);
    setChoice(null);
  };
  const changeTherapist = () => {
    setSelectedTherapist(null);
    setTherapistId(null);
    setChoice(null);
    setSearch("");
  };

  const submit = async () => {
    if (!therapistId || !choice || busy) return;
    setBusy(true);
    try {
      const res = await createChildCustomAppointment(childId, { therapistId, ...choice });
      if (!res?.success) return Alert.alert("Could not create", res?.message || "Please try again.");
      Alert.alert(
        "Appointment created",
        `${prettyFull(choice.date)}, ${formatTo12Hour(`${choice.startTime}-${choice.endTime}`)}`,
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      Alert.alert("Could not create", e?.response?.data?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const renderSpecChips = (t) => {
    const specs = [].concat(t.speciality ?? t.specialities ?? t.services ?? []);
    if (services.length === 0 || specs.length === 0) return null;
    return (
      <View style={styles.chipWrap}>
        {specs.map((sid) => {
          const m = serviceMap.get(sid) || { label: sid, bg: "#E0F2FE", color: "#0B4A6F" };
          return (
            <View key={sid} style={[styles.chip, { backgroundColor: m.bg }]}>
              <Text style={[styles.chipText, { color: m.color }]}>{m.label}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const ready = !!therapistId && !!choice && !busy;

  return (
    <View style={styles.main}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Therapist</Text>

        {selectedTherapist
          ? (
            <View style={styles.selectedCard}>
              <View style={styles.selectedTop}>
                <View style={[styles.radio, styles.radioOn]}>
                  <View style={styles.radioDot} />
                </View>
                <Text style={styles.therapistName} numberOfLines={1}>
                  {selectedTherapist.fullName || selectedTherapist.name}
                </Text>
                <TouchableOpacity style={styles.changeBtn} onPress={changeTherapist} activeOpacity={0.8}>
                  <Feather name="repeat" size={14} color={colors.primary} />
                  <Text style={styles.changeBtnText}>Change</Text>
                </TouchableOpacity>
              </View>
              {renderSpecChips(selectedTherapist)}
            </View>
          )
          : (
            <>
              <View style={styles.searchBox}>
                <Feather name="search" size={16} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search therapist..."
                  placeholderTextColor="#94A3B8"
                  value={search}
                  onChangeText={setSearch}
                />
              </View>

              {loadingList
                ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
                : therapists.length === 0
                ? <Text style={styles.muted}>No therapists found.</Text>
                : (
                  therapists.map((t) => {
                    const id = t._id || t.id;
                    return (
                      <TouchableOpacity
                        key={id}
                        style={styles.therapistRow}
                        onPress={() => pickTherapist(t)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.radio} />
                        <Text style={styles.therapistName} numberOfLines={1}>
                          {t.fullName || t.name}
                        </Text>
                        {renderSpecChips(t)}
                      </TouchableOpacity>
                    );
                  })
                )}
            </>
          )}

        <Text style={styles.label}>Session length</Text>

        <View style={styles.durationRow}>
          {DURATIONS.map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.durBtn,
                {
                  width: isSmallDevice ? "48%" : "23%",
                },
                minutes === m && styles.durBtnOn,
              ]}
              onPress={() => pickMinutes(m)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.durText,
                  minutes === m && styles.durTextOn,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {m} min
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {therapistId && (
          <SessionSlotPicker loadSlots={loadSlots} minutes={minutes} value={choice} onChange={setChoice} />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.primaryBtn, !ready && { opacity: 0.5 }]} disabled={!ready} onPress={submit}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Create appointment</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: wp(16), paddingBottom: hp(154) },

  hint: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#64748B", lineHeight: 18 },
  muted: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#94A3B8", marginVertical: 8 },
  label: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A", marginTop: 16, marginBottom: hp(8) },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: wp(12),
    paddingHorizontal: wp(12),
    height: hp(48),
    marginBottom: hp(8),
  },
  searchInput: { flex: 1, fontSize: fontSize(14), color: "#0F172A" },

  therapistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: wp(12),
    marginBottom: hp(8),
    borderRadius: wp(14),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  therapistRowOn: { borderColor: "#0B4A6F" },
  therapistName: { flex: 1, fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A" },
  radio: {
    width: wp(20),
    height: hp(20),
    borderRadius: wp(10),
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: "#0B4A6F" },
  radioDot: { width: wp(10), height: hp(10), borderRadius: wp(5), backgroundColor: "#0B4A6F" },

  row: { flexDirection: "row", gap: 10 },
  durBtn: {
    flex: 1,
    height: hp(44),
    borderRadius: wp(12),
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  durBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  durText: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#334155" },
  durTextOn: { color: "#FFFFFF" },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: wp(16),
    paddingBottom: hp(24),
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  primaryBtn: {
    height: hp(50),
    borderRadius: wp(12),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#FFFFFF", lineHeight: 18 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  chip: { borderRadius: wp(20), paddingHorizontal: wp(10), paddingVertical: 4 },
  chipText: { fontSize: fontSize(11), fontFamily: fonts.semiBold },
  selectedCard: {
    padding: wp(12),
    borderRadius: wp(14),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#0B4A6F",
  },
  selectedTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  changeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: wp(12),
    paddingVertical: 6,
    borderRadius: wp(20),
    backgroundColor: "#E8F2FC",
  },
  changeBtnText: { fontSize: fontSize(12), fontFamily: fonts.semiBold, color: colors.primary },

  durationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
    marginTop: 4,
  },

  durBtn: {
    minHeight: 44,
    borderRadius: wp(12),
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 10,
  },

  durBtnOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  durText: {
    fontSize: fontSize(13),
    fontFamily: fonts.semiBold,
    color: "#334155",
    textAlign: "center",
  },

  durTextOn: {
    color: "#FFFFFF",
  },
});
