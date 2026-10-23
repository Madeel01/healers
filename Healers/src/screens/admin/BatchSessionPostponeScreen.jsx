// src/screens/admin/BatchSessionPostponeScreen.js
import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  getServices,
  postponeBatchSession,
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

const mins = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const prettyFull = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function BatchSessionPostponeScreen({ navigation, route }) {
  const { batchId, assignmentId, sessionId, date, startTime, endTime, therapistName, speciality, batchEnd, batchStart } =
    route.params;

  const minutes = mins(endTime) - mins(startTime);
  

  const [createAlternate, setCreateAlternate] = useState(true);
  const [choice, setChoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [services, setServices] = useState([])

  const submit = async () => {
    if (createAlternate && !choice) {
      return Alert.alert("Alternate session", "Pick a date and time, or switch to “Postpone only”.");
    }
    setBusy(true);
    try {
      const res = await postponeBatchSession(batchId, assignmentId, sessionId, {
        createAlternate,
        ...(createAlternate ? choice : {}),
      });
      if (!res?.success) return Alert.alert("Could not postpone", res?.message || "Please try again.");
      Alert.alert("Done", res.message || "Session postponed.", [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert("Could not postpone", e?.response?.data?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const servicesData = async () => {
      try {
        const res = await getServices({ search: "" });

        const activeServices = res.data.filter(
          (service) => service.isActive === true
        );

        setServices(activeServices);
      } catch (error) {
        console.log(error);
      }
    };

    servicesData();
  }, []);
  const specMeta = useCallback(
    (id) => {
      return (
        services.find(
          (service) => service.id === id
        ) || {
          label: id,
          bg: "#E0F2FE",
          color: "#0B4A6F",
        }
      );
    },
    [services]
  );
  const meta = specMeta(speciality);
  const confirm = () => {
    if (createAlternate) return submit();
    Alert.alert(
      "Postpone without a new session?",
      "This session will be marked postponed and no replacement will be created.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Postpone", style: "destructive", onPress: submit },
      ],
    );
  };

  return (
    <View style={styles.main}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Current session</Text>
          <Text style={styles.big}>{prettyFull(date)}</Text>
          <Text style={styles.sub}>
            {formatTo12Hour(`${startTime}-${endTime}`)} · {minutes} min
          </Text>
          <View style={styles.rowBetween}>
            <Text style={styles.sub}>{therapistName}</Text>
            <View style={[styles.chip, { backgroundColor: meta.bg }]}>
              <Text style={[styles.chipText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
        </View>

        <View style={styles.segment}>
          {[
            { v: true, text: "Postpone + alternate" },
            { v: false, text: "Postpone only" },
          ].map((o) => (
            <TouchableOpacity
              key={String(o.v)}
              style={[styles.segBtn, createAlternate === o.v && styles.segBtnOn]}
              onPress={() => setCreateAlternate(o.v)}
            >
              <Text style={[styles.segText, createAlternate === o.v && styles.segTextOn]}>{o.text}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {createAlternate ? (
          <>
            <Text style={styles.hint}>
              The alternate session keeps the same {minutes} minutes and the same children. Only times when
              the therapist and every child are free are shown.
            </Text>
            <SessionSlotPicker
              batchId={batchId}
              assignmentId={assignmentId}
              minutes={minutes}
              endDate={batchEnd}
              value={choice}
              onChange={setChoice}
            />
          </>
        ) : (
          <Text style={styles.hint}>
            The session will be marked as postponed and no new session will be created. You can add an
            additional session later.
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={confirm}>
          {busy ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryText}>{createAlternate ? "Postpone and create alternate" : "Postpone session"}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#F8FAFC" },
   content: { padding: wp(16), paddingBottom: hp(20) },
  card: { backgroundColor: "#FFFFFF", borderRadius: wp(18), padding: wp(16), marginBottom: hp(14) },
  cardLabel: { fontSize:fontSize(12), fontFamily: fonts.regular, color: "#64748B" },
  big: { fontSize:fontSize(18), fontFamily: fonts.semiBold, color: "#0F172A", marginTop: 4 },
  sub: { fontSize:fontSize(12), fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  chip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize:fontSize(10), fontFamily: fonts.semiBold },

  segment: { flexDirection: "row", backgroundColor: "#E2E8F0", borderRadius: 12, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  segBtnOn: { backgroundColor: "#FFFFFF" },
  segText: { fontSize:fontSize(11),lineHeight:16, fontFamily: fonts.semiBold, color: "#64748B" },
  segTextOn: { color: "#0B4A6F" },
  hint: { fontSize:fontSize(12), fontFamily: fonts.regular, color: "#64748B", lineHeight: 18, marginTop: 12 },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: wp(16),
    paddingBottom: hp(20),
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
  primaryText: { fontSize:fontSize(14),lineHeight:16, fontFamily: fonts.semiBold, color: "#FFFFFF" },
});