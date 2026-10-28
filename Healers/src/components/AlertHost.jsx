import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { registerAlertHost } from '../utils/customAlert';
import { colors, fonts } from '../styles/theme';
import { fontSize, wp } from '../utils/responsive';

export default function AlertHost() {
  const [queue, setQueue] = useState([]);

  useEffect(
    () => registerAlertHost((cfg) => setQueue((q) => [...q, cfg])),
    [],
  );

  const current = queue[0];
  if (!current) return null;

  const { title, message, options } = current;
  const buttons = current.buttons?.length ? current.buttons : [{ text: "OK" }];
  const row = buttons.length === 2;

  const press = (btn) => {
    setQueue((q) => q.slice(1));
    btn?.onPress?.();            
  };

  const onBack = () => {
    if (options?.cancelable === false) return;
    const cancel = buttons.find((b) => b.style === "cancel");
    setQueue((q) => q.slice(1));
    cancel?.onPress?.();
    options?.onDismiss?.();
  };

  const textColor = (b) =>
    b.style === "destructive" ? "#DC2626"
      : b.style === "cancel" ? "#64748B"
      : colors.primary;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onBack}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          {!!title && <Text style={styles.title}>{title}</Text>}
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={[styles.btnWrap, row && styles.btnRow]}>
            {buttons.map((b, i) => {
              const primary = b.style !== "cancel";
              return (
                <TouchableOpacity
                  key={`${b.text}-${i}`}
                  style={[
                    styles.btn,
                    row && { flex: 1 },
                    primary
                      ? { backgroundColor: b.style === "destructive" ? "#FEF2F2" : "#EBF3F9" }
                      : { backgroundColor: "#F1F5F9" },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => press(b)}
                >
                  <Text style={[styles.btnText, { color: textColor(b) }]}>{b.text || "OK"}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(15,23,42,0.55)",
    alignItems: "center", justifyContent: "center", paddingHorizontal: wp(24),
  },
  box: {
    width: "100%", maxWidth: 380, backgroundColor: "#FFFFFF",
    borderRadius: wp(20), padding: wp(20), elevation: 6,
  },
  title: { fontSize: fontSize(17), fontFamily: fonts.bold, color: "#0F172A", lineHeight: 24 },
  message: {
    fontSize: fontSize(13), fontFamily: fonts.regular, color: "#475569",
    lineHeight: 20, marginTop: 8,
  },
  btnWrap: { marginTop: 20, gap: 10 },
  btnRow: { flexDirection: "row" },
  btn: { height: 44, borderRadius: wp(12), alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  btnText: { fontSize: fontSize(13), fontFamily: fonts.semiBold, lineHeight: 18 },
});