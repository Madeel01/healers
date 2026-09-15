import React from 'react';

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import TopBar from '../../components/TopBar';
import {
  commonStyles,
  fonts,
} from '../../styles/theme';

export default function InvoiceDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const invoiceData = route.params?.invoiceData || {};

  const handleDownloadPDF = async () => {
    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; color: #00497B; }
            .details { margin-top: 20px; width: 100%; border-collapse: collapse; }
            .details th { background-color: #00497B; color: #fff; padding: 10px; text-align: left; }
            .details td { padding: 10px; border-bottom: 1px solid #eee; }
            .total-box { margin-top: 20px; float: right; width: 250px; }
            .total-row { display: flex; justify-content: space-between; padding: 6px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2>HEALERS INSTITUTION</h2>
              <p>12-K, Gulberg III, Lahore</p>
            </div>
            <div>
              <div class="title">INVOICE</div>
              <p># ${invoiceData.invoiceNumber || 'INV-2023-089'}</p>
            </div>
          </div>
          <table class="details">
            <thead>
              <tr>
                <th>#</th>
                <th>Service & Date</th>
                <th>Duration</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>Speech-Language Therapy</td>
                <td>45 min</td>
                <td>PKR 300.00</td>
                <td>PKR 300.00</td>
              </tr>
              <tr>
                <td>2</td>
                <td>Occupational Therapy</td>
                <td>60 min</td>
                <td>PKR 250.00</td>
                <td>PKR 250.00</td>
              </tr>
            </tbody>
          </table>
          <div class="total-box">
            <div class="total-row"><span>Balance Due:</span><strong>PKR 562.75</strong></div>
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate PDF document.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, commonStyles.container, { paddingTop: insets.top }]}>
      <TopBar navigation={navigation} headerTitle={'Invoices'} />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.invoiceCard}>
          {/* Header section */}
          <View style={styles.invoiceHeader}>
            <View style={styles.brandRow}>
              <View style={styles.logoContainer}>
                <Feather name="activity" size={24} color="#00497B" />
              </View>
              <View>
                <Text style={styles.brandTitle}>HEALERS INSTITUTION</Text>
                <Text style={styles.brandAddress}>12-K, Gulberg III, Lahore</Text>
              </View>
            </View>

            <View style={styles.invoiceMeta}>
              <Text style={styles.invoiceMetaTitle}>INVOICE</Text>
              <Text style={styles.invoiceMetaNum}># {invoiceData.invoiceNumber || 'INV-2023-089'}</Text>
              <Text style={styles.balanceLabel}>Balance Due</Text>
              <Text style={styles.balanceValue}>PKR 562.75</Text>
            </View>
          </View>

          {/* Student & Bill To details */}
          <View style={styles.sectionDivider} />
          <View style={styles.metaSection}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Student Details</Text>
              <Text style={styles.metaValBold}>Ali Raza Ahmad</Text>
              <Text style={styles.metaSubtext}>Grade 4 - Willow Creek Elementary</Text>

              <Text style={[styles.metaLabel, { marginTop: 12 }]}>Bill To (Parent/Guardian)</Text>
              <Text style={styles.metaValBold}>Ahmad</Text>
              <Text style={styles.metaSubtext}>4141 Hacienda Drive, Pleasanton, CA</Text>
            </View>

            <View style={styles.metaRightCol}>
              <Text style={styles.metaLabel}>Invoice Date :</Text>
              <Text style={styles.metaValRight}>29 Jun 2018</Text>
              <Text style={[styles.metaLabel, { marginTop: 12 }]}>Ref# :</Text>
              <Text style={styles.metaValRight}>321014</Text>
            </View>
          </View>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeadCell, { flex: 0.5 }]}>#</Text>
            <Text style={[styles.tableHeadCell, { flex: 2.5 }]}>Service & Date</Text>
            <Text style={[styles.tableHeadCell, { flex: 1.2, textAlign: 'center' }]}>Duration</Text>
            <Text style={[styles.tableHeadCell, { flex: 1.2, textAlign: 'right' }]}>Rate</Text>
            <Text style={[styles.tableHeadCell, { flex: 1.2, textAlign: 'right' }]}>Amount</Text>
          </View>

          {/* Table Row 1 */}
          <View style={styles.tableRow}>
            <Text style={[styles.cellText, { flex: 0.5 }]}>1</Text>
            <View style={{ flex: 2.5 }}>
              <Text style={styles.serviceName}>Speech-Language Therapy</Text>
              <Text style={styles.serviceSub}>Date: 15 Jun 2023 | IEP Goal: Articulation 2.1</Text>
            </View>
            <Text style={[styles.cellText, { flex: 1.2, textAlign: 'center' }]}>45 min</Text>
            <Text style={[styles.cellText, { flex: 1.2, textAlign: 'right' }]}>PKR 300.00</Text>
            <Text style={[styles.cellText, { flex: 1.2, textAlign: 'right' }]}>PKR 300.00</Text>
          </View>

          {/* Table Row 2 */}
          <View style={styles.tableRow}>
            <Text style={[styles.cellText, { flex: 0.5 }]}>2</Text>
            <View style={{ flex: 2.5 }}>
              <Text style={styles.serviceName}>Occupational Therapy</Text>
              <Text style={styles.serviceSub}>Date: 18 Jun 2023 | IEP Goal: Fine Motor 1.4</Text>
            </View>
            <Text style={[styles.cellText, { flex: 1.2, textAlign: 'center' }]}>60 min</Text>
            <Text style={[styles.cellText, { flex: 1.2, textAlign: 'right' }]}>PKR 250.00</Text>
            <Text style={[styles.cellText, { flex: 1.2, textAlign: 'right' }]}>PKR 250.00</Text>
          </View>

          {/* Table Row 3 */}
          <View style={styles.tableRow}>
            <Text style={[styles.cellText, { flex: 0.5 }]}>3</Text>
            <View style={{ flex: 2.5 }}>
              <Text style={styles.serviceName}>Behavioral Support</Text>
              <Text style={styles.serviceSub}>Date: 22 Jun 2023 | 504 Plan: Focus & Attention</Text>
            </View>
            <Text style={[styles.cellText, { flex: 1.2, textAlign: 'center' }]}>30 min</Text>
            <Text style={[styles.cellText, { flex: 1.2, textAlign: 'right' }]}>PKR 80.00</Text>
            <Text style={[styles.cellText, { flex: 1.2, textAlign: 'right' }]}>PKR 80.00</Text>
          </View>

          {/* Calculation Summary */}
          <View style={styles.summaryContainer}>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Sub Total</Text>
              <Text style={styles.sumVal}>PKR 630.00</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Sample Tax1 (4.70%)</Text>
              <Text style={styles.sumVal}>PKR 11.75</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Sample Tax2 (7.00%)</Text>
              <Text style={styles.sumVal}>PKR 21.00</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalVal}>PKR 662.75</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={[styles.sumLabel, { color: '#E11D48' }]}>Payment Received</Text>
              <Text style={[styles.sumVal, { color: '#E11D48' }]}>(-) PKR 100.00</Text>
            </View>

            <View style={styles.balanceDueBox}>
              <Text style={styles.balanceDueText}>Balance Due</Text>
              <Text style={styles.balanceDueVal}>PKR 562.75</Text>
            </View>
          </View>

          {/* Terms and Clinical Notes */}
          <View style={styles.notesSection}>
            <Text style={styles.noteHeading}>Clinical Summary</Text>
            <Text style={styles.noteBody}>
              All sessions conducted in accordance with the student's current IEP/504 plan. Progress notes are available upon request through the Serene Care portal.
            </Text>

            <Text style={styles.noteHeading}>Notes</Text>
            <Text style={styles.noteBody}>Thanks for your business.</Text>

            <Text style={styles.noteHeading}>Terms & Conditions</Text>
            <Text style={styles.noteBody}>
              Your company's Terms and Conditions will be displayed here. You can add it in the Invoice Preferences page under Settings.
            </Text>
          </View>

          {/* Download / Modify Button */}
          <TouchableOpacity 
            style={styles.downloadBtn} 
            activeOpacity={0.8}
            onPress={handleDownloadPDF}
          >
            <Feather name="download" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.downloadBtnText}>Download PDF</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },

  invoiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EBF3F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#00497B',
  },
  brandAddress: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: fonts.regular,
  },
  invoiceMeta: {
    alignItems: 'flex-end',
  },
  invoiceMetaTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: '#334155',
  },
  invoiceMetaNum: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: fonts.regular,
  },
  balanceLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
  },
  balanceValue: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#00497B',
  },

  sectionDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  metaSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metaCol: {
    flex: 1,
  },
  metaRightCol: {
    alignItems: 'flex-end',
  },
  metaLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: fonts.regular,
  },
  metaValBold: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#1E293B',
  },
  metaSubtext: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: fonts.regular,
  },
  metaValRight: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: '#334155',
  },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#00497B',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  tableHeadCell: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cellText: {
    fontSize: 12,
    color: '#334155',
    fontFamily: fonts.regular,
  },
  serviceName: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: '#1E293B',
  },
  serviceSub: {
    fontSize: 10,
    color: '#94A3B8',
  },

  summaryContainer: {
    marginTop: 16,
    alignItems: 'flex-end',
  },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 240,
    paddingVertical: 4,
  },
  sumLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  sumVal: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: '#334155',
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#0F172A',
  },
  totalVal: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#0F172A',
  },
  balanceDueBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    width: 240,
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  balanceDueText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#0F172A',
  },
  balanceDueVal: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#00497B',
  },

  notesSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
  },
  noteHeading: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: '#64748B',
    marginTop: 8,
  },
  noteBody: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },

  downloadBtn: {
    flexDirection: 'row',
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  downloadBtnText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: '#FFFFFF',
  },
});