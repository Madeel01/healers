// src/screens/admin/BatchAdditionalClassScreen.js
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
  createAdditionalSession,
  getBatchScheduleData,
  getServices,
} from '../../api/admin/api';
import {
  colors,
  fonts,
} from '../../styles/theme';
import {
  fontSize,
  hp,
  wp,
} from '../../utils/responsive';
import SessionSlotPicker from './components/SessionSlotPicker';

const DURATIONS = [45, 60, 90, 120];

export default function BatchAdditionalClassScreen({ navigation, route }) {
  const { batchId } = route.params;

  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [services, setServices] = useState([])
  const [assignmentId, setAssignmentId] = useState(null);
  const [minutes, setMinutes] = useState(60);
  const [choice, setChoice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getBatchScheduleData(batchId);
        if (res?.success) {
          setBatch(res.data.batch);
          setAssignments(res.data.assignments || []);
        } else {
          Alert.alert("Error", res?.message || "Could not load the batch.");
        }
      } catch (e) {
        Alert.alert("Error", e?.response?.data?.message || "Could not load the batch.");
      } finally {
        setLoading(false);
      }
    })();
  }, [batchId]);
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

  const pickAssignment = (id) => {
    setAssignmentId(id);
    setChoice(null);
  };
  const pickMinutes = (m) => {
    setMinutes(m);
    setChoice(null);
  };

  const submit = async () => {
    if (!assignmentId || !choice) return;
    setBusy(true);
    try {
      const res = await createAdditionalSession(batchId, assignmentId, choice);
      if (!res?.success) return Alert.alert("Could not create", res?.message || "Please try again.");
      Alert.alert("Additional session added", res.message || "", [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert("Could not create", e?.response?.data?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const batchEnd = batch?.dateTo ? batch.dateTo.slice(0, 10) : undefined;
  const ready = !!assignmentId && !!choice && !busy;

  return (
    <View style={styles.main}>
  
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.hint}>
            A one-off session on a specific date. All {batch?.childrenIds?.length || 0} children in the batch
            are added to it.
          </Text>

          <Text style={styles.label}>Therapist</Text>
          {assignments.length === 0 ? (
            <Text style={styles.muted}>No therapist is assigned to this batch yet. Add a schedule first.</Text>
          ) : (
            assignments.map((a) => {
              const m = specMeta(a.speciality);
              const on = assignmentId === a._id;
              return (
                <TouchableOpacity
                  key={a._id}
                  style={[styles.therapistRow, on && styles.therapistRowOn]}
                  onPress={() => pickAssignment(a._id)}
                >
                  <View style={[styles.radio, on && styles.radioOn]}>
                    {on && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.therapistName}>{a.therapistId?.fullName}</Text>
                  <View style={[styles.chip, { backgroundColor: m.bg }]}>
                    <Text style={[styles.chipText, { color: m.color }]}>{m.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          <Text style={styles.label}>Session length</Text>
          <View style={styles.row}>
            {DURATIONS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.durBtn, minutes === m && styles.durBtnOn]}
                onPress={() => pickMinutes(m)}
              >
                <Text style={[styles.durText, minutes === m && styles.durTextOn]}>{m} min</Text>
              </TouchableOpacity>
            ))}
          </View>

          {assignmentId && (
            <SessionSlotPicker
              batchId={batchId}
              assignmentId={assignmentId}
              minutes={minutes}
              endDate={batchEnd}
              value={choice}
              onChange={setChoice}
            />
          )}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.primaryBtn, !ready && { opacity: 0.5 }]} disabled={!ready} onPress={submit}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Create session</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: hp(20) },

  hint: { fontSize:fontSize(12), fontFamily: fonts.regular, color: "#64748B", lineHeight: 18 },
  muted: { fontSize:fontSize(12), fontFamily: fonts.regular, color: "#94A3B8" },
  label: { fontSize:fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A", marginTop: 16, marginBottom: 8 },

  therapistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  therapistRowOn: { borderColor: "#0B4A6F" },
  therapistName: { flex: 1, fontSize:fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A" },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: "#0B4A6F" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0B4A6F" },
  chip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize:fontSize(11), fontFamily: fonts.semiBold },

  row: { flexDirection: "row", gap: 10 },
  durBtn: {
    flex: 1,
    height:hp(44),
    borderRadius: wp(12),
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  durBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  durText: { fontSize:fontSize(13), fontFamily: fonts.semiBold, color: "#334155" },
  durTextOn: { color: "#FFFFFF" },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  primaryBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontSize:fontSize(15), fontFamily: fonts.semiBold, color: "#FFFFFF" },
});