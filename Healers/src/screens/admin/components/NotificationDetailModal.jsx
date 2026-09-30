import React, { useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ActivityIndicator,
  Platform,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import { File, Paths } from 'expo-file-system';
const getMimeType = (filename = '') => {
  const ext = filename.split('.').pop()?.toLowerCase();

  const types = {
    pdf: 'application/pdf',

    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    txt: 'text/plain',

    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };

  return types[ext] || '*/*';
};

import { colors, fonts } from '../../../styles/theme';
import { getAssetUrl } from '../../../utils/media';

// Same palette used on the notification list/cards — keep both in sync
const TYPE_COLORS = {
  System: { bg: '#E2E8F0', text: '#475569' },
  Appointment: { bg: '#CCFBF1', text: '#0F766E' },
  Therapy: { bg: '#EDE9FE', text: '#7C3AED' },
  Message: { bg: '#DBEAFE', text: '#2563EB' },
  Reminder: { bg: '#FEF3C7', text: '#B45309' },
  Alert: { bg: '#FEE2E2', text: '#B91C1C' },
  General: { bg: '#F1F5F9', text: '#334155' },
};

const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

export default function NotificationDetailModal({ visible, notification, onClose }) {
  const [previewVisible, setPreviewVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const tc = TYPE_COLORS[notification?.type] || TYPE_COLORS.General;
  const isImage = notification?.attachment?.type === 'image';
  const attachmentUrl = getAssetUrl(notification?.attachment?.url);

  const downloadAndOpen = async (url, filename) => {
      if (!url) return;
  
      try {
        setDownloading(true);
  
        const originalName = filename || 'attachment';
        
        const uniqueName = `${Date.now()}-${originalName}`;
  
        const destination = new File(Paths.cache, uniqueName);
  
        const downloadedFile = await File.downloadFileAsync(
          url,
          destination
        );
  
        if (Platform.OS === 'android') {
          const contentUri = await FileSystem.getContentUriAsync(
            downloadedFile.uri
          );
  
          await IntentLauncher.startActivityAsync(
            'android.intent.action.VIEW',
            {
              data: contentUri,
              flags: 1,
              type: getMimeType(originalName),
            }
          );
        } else {
          await Linking.openURL(downloadedFile.uri);
        }
      } catch (error) {
        console.error('Open attachment error:', error);
  
        Alert.alert(
          'Could not open file',
          'No compatible application is installed on this device.'
        );
      } finally {
        setDownloading(false);
      }
    };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.topBar}>
            <Text style={styles.topBarTitle}>Notification</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {!notification ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <View style={styles.headerRow}>
                <Text style={styles.title}>{notification.title}</Text>
                <View style={[styles.badge, { backgroundColor: tc.bg }]}>
                  <Text style={[styles.badgeText, { color: tc.text }]}>
                    {notification.type || 'General'}
                  </Text>
                </View>
              </View>

              <Text style={styles.message}>{notification.message}</Text>

              {attachmentUrl ? (
                isImage ? (
                  <TouchableOpacity onPress={() => setPreviewVisible(true)}>
                    <Image source={{ uri: attachmentUrl }} style={styles.attachmentImage} resizeMode="cover" />
                    <View style={styles.imageHintRow}>
                      <Feather name="maximize-2" size={12} color="#64748B" />
                      <Text style={styles.imageHintText}>Tap to view full size</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.fileRow}
                    onPress={() => downloadAndOpen(attachmentUrl, notification.attachment.name)}
                    disabled={downloading}
                  >
                    <MaterialCommunityIcons
                      name={notification.attachment.type === 'pdf' ? 'file-pdf-box' : 'file-document-outline'}
                      size={28}
                      color="#0B4A6F"
                    />
                    <Text style={styles.fileName} numberOfLines={1}>
                      {notification.attachment.name}
                    </Text>
                    {downloading ? (
                      <ActivityIndicator size="small" color="#0B4A6F" />
                    ) : (
                      <Feather name="download" size={16} color="#64748B" />
                    )}
                  </TouchableOpacity>
                )
              ) : null}

              {/* {isImage && (
                <TouchableOpacity
                  style={styles.downloadImageBtn}
                  onPress={() => downloadAndOpen(attachmentUrl, notification.attachment.name)}
                  disabled={downloading}
                >
                  {downloading ? (
                    <ActivityIndicator size="small" color="#0B4A6F" />
                  ) : (
                    <>
                      <Feather name="download" size={14} color="#0B4A6F" />
                      <Text style={styles.downloadImageText}>Save / share image</Text>
                    </>
                  )}
                </TouchableOpacity>
              )} */}

              <Modal
                visible={previewVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setPreviewVisible(false)}
              >
                <View style={styles.previewOverlay}>
                  <TouchableOpacity
                    style={styles.previewCloseBtn}
                    onPress={() => setPreviewVisible(false)}
                    hitSlop={12}
                  >
                    <Feather name="x" size={26} color="#FFF" />
                  </TouchableOpacity>
                  <Image source={{ uri: attachmentUrl }} style={styles.previewImage} resizeMode="contain" />
                  <TouchableOpacity
                    style={styles.previewDownloadBtn}
                    onPress={() => downloadAndOpen(attachmentUrl, notification.attachment.name)}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Feather name="download" size={16} color="#FFF" />
                        <Text style={styles.previewDownloadText}>Download</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </Modal>

              <View style={styles.divider} />

              <DetailRow icon="send" label="Sent" value={formatDateTime(notification.sentAt || notification.createdAt)} />
              <DetailRow icon="user" label="From" value={notification.createdBy?.fullName || 'Admin'} />
              <DetailRow
                icon={notification.isRead ? 'check-circle' : 'circle'}
                label="Status"
                value={notification.isRead ? `Read${notification.readAt ? ` · ${formatDateTime(notification.readAt)}` : ''}` : 'Unread'}
              />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const DetailRow = ({ icon, label, value }) => (
  <View style={styles.detailRow}>
    <Feather name={icon} size={16} color="#64748B" style={{ width: 22 }} />
    <View style={{ flex: 1 }}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || '—'}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  topBarTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.primary },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  body: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: '#0F172A' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  message: { marginTop: 12, fontSize: 14, color: '#334155', lineHeight: 21 },

  attachmentImage: { width: '100%', height: 200, borderRadius: 14, marginTop: 16, backgroundColor: '#F1F5F9' },
  imageHintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  imageHintText: { fontSize: 11, color: '#64748B' },

  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
  },
  fileName: { flex: 1, fontSize: 13, color: '#334155', fontWeight: '600' },

  downloadImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  downloadImageText: { fontSize: 13, fontWeight: '700', color: '#0B4A6F' },

  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 18 },
  detailRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  detailLabel: { fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  detailValue: { fontSize: 14, color: '#0F172A', fontWeight: '600' },

  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  previewCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  previewImage: { width: '100%', height: '80%' },
  previewDownloadBtn: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
  },
  previewDownloadText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});