import React from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import {
  colors,
  fonts,
} from '../../../styles/theme';

export default function Fee({ customstyles }) {
  return (
    <View style={styles.container}>
      <Text style={[customstyles?.sectionTitle,{marginBottom:10}]}>
        Financial Summary
      </Text>

      <View style={[styles.financialCard]}>
        <View style={styles.redCardBorder}></View>
        <View style={styles.cardHeader}>
          <View style={[styles.financeIconWrapper, { backgroundColor: "#FFDAD6" }]}>
            <MaterialIcons name="event-busy" size={20} color="#DC2626" />
          </View>
          <Text style={styles.financeLabel}>Overdue Fees</Text>
        </View>
        <Text style={styles.financeAmount}>PKR 45,000</Text>
        <Text style={styles.financeSubTextRed}>12 Children pending</Text>
      </View>

      <View style={[styles.financialCard]}>
        <View style={styles.orangeCardBorder}></View>
        <View style={styles.cardHeader}>
          <View style={[styles.financeIconWrapper, { backgroundColor: "rgba(245,139,42,.1)" }]}>
            <MaterialIcons name="assignment-late" size={20} color="#F58B2A" />
          </View>
          <Text style={styles.financeLabel}>Unpaid Fees</Text>
        </View>
        <Text style={styles.financeAmount}>PKR 128,500</Text>
        <Text style={styles.financeSubTextOrange}>Due by end of week</Text>
      </View>

      <View style={[styles.financialCard]}>
        <View style={styles.greenCardBorder}></View>

        <View style={styles.cardHeader}>
          <View style={[styles.financeIconWrapper, { backgroundColor: "rgba(76,185,159,.1)" }]}>
            <MaterialIcons name="account-balance-wallet" size={20} color="#4CB99F" />
          </View>
          <Text style={styles.financeLabel}>Total Revenue</Text>
        </View>
        <Text style={styles.financeAmount}>PKR 2,450,000</Text>
        <Text style={styles.financeSubTextGreen}>Current Fiscal Year</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
 
  financialCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    overflow: "hidden",
    borderLeftWidth: 0,
    elevation: 2,
    shadowColor: "#414750",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    position: "relative",
  },
  redCardBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 5,
    height: "130%",
    backgroundColor: "#E84545",
  },
  orangeCardBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 5,
    height: "130%",
    backgroundColor: "#F58B2A",
  },
  greenCardBorder: {
    position: "absolute",
    top: 0,
    left: -0,
    width: 5,
    height: "130%",
    backgroundColor: "#4CB99F",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  financeIconWrapper: {
    borderRadius: 8,
    padding: 8,
    paddingBottom: 14,
  },
  financeLabel: {
    fontSize: 12,
    color: colors.blackFont,
    fontFamily: fonts.regular,
  },
  financeAmount: {
    fontSize: 24,
    fontFamily: fonts.semiBold,
    color: "#181C1E",
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  financeSubTextRed: {
    color: "#BA1A1A",
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },
  financeSubTextOrange: {
    color: "#D97706",
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },
  financeSubTextGreen: {
    color: "#059669",
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },
});
