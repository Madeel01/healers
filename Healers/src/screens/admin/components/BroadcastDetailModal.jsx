import React, { useState, useEffect } from 'react';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts } from '../../../styles/theme';
import { getAssetUrl } from '../../../utils/media';
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

const STATUS_COLORS = {
  sent: { bg: '#DCFCE7', text: '#15803D' },
  scheduled: { bg: '#FEF3C7', text: '#B45309' },
  draft: { bg: '#E2E8F0', text: '#475569' },
  sending: { bg: '#E0F2FE', text: '#0B4A6F' },
  cancelled: { bg: '#FEE2E2', text: '#B91C1C' },
};
const TYPE_COLORS = {
  System: { bg: '#E2E8F0', text: '#475569' },
  Appointment: { bg: '#CCFBF1', text: '#0F766E' },
  Therapy: { bg: '#EDE9FE', text: '#7C3AED' },
  Message: { bg: '#DBEAFE', text: '#2563EB' },
  Reminder: { bg: '#FEF3C7', text: '#B45309' },
  Alert: { bg: '#FEE2E2', text: '#B91C1C' },
  General: { bg: '#F1F5F9', text: '#334155' },
};

const audienceText = (b) => {
  if (!b) return '';
  if (b.audience === 'all') return 'All Users';
  if (b.audience === 'role') return `All ${(b.roles || []).join(', ')}${b.roles?.length > 1 ? 's' : ''}`;
  if (b.audience === 'users') {
    const names = (b.users || []).map((u) => (typeof u === 'object' ? u.fullName : null)).filter(Boolean);
    return names.length ? names.join(', ') : `${b.users?.length || 0} selected user(s)`;
  }
  return '';
};

export default function BroadcastDetailModal({ visible, loading, broadcast, onClose, onEdit, onDelete }) {
  const sc = STATUS_COLORS[broadcast?.status] || STATUS_COLORS.draft;
  const tc = TYPE_COLORS[broadcast?.type] || TYPE_COLORS.General;
  const isImage = broadcast?.attachment?.type === 'image';
  const attachmentUrl = getAssetUrl(broadcast?.attachment?.url);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isColumnLayout, setIsColumnLayout] = useState(false);
  const [hasMeasured, setHasMeasured] = useState(false);

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
  useEffect(() => {
    if (!visible) {
      setIsColumnLayout(false);
      setHasMeasured(false);
    }
  }, [visible, broadcast]);




  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.topBar}>
            <Text style={styles.topBarTitle}>Broadcast Details</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {loading || !broadcast ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <>
                <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                <View style={styles.headerRow}>
                  <Text
                    style={styles.title}
                    onTextLayout={(e) => {
                      if (!hasMeasured) {
                        setHasMeasured(true);
                        if (e.nativeEvent.lines.length > 1) {
                          setIsColumnLayout(true);
                        }
                      }
                    }}
                  >
                    {broadcast.title}
                  </Text>
                  <View
                    style={[
                      styles.badgeGroup,
                      { flexDirection: isColumnLayout ? 'column' : 'row' },
                    ]}
                  >
                    <View style={[styles.badge, { backgroundColor: tc.bg }]}>
                      <Text style={[styles.badgeText, { color: tc.text }]}>
                        {broadcast.type || 'General'}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.badgeText, { color: sc.text }]}>
                        {broadcast.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.message}>{broadcast.message}</Text>

                {attachmentUrl ? (
                    isImage ? (
                        <TouchableOpacity onPress={() => setPreviewVisible(true)}>
                        <Image source={{ uri: attachmentUrl }} style={styles.attachmentImage} resizeMode="cover" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.fileRow} onPress={() => downloadAndOpen(attachmentUrl, broadcast.attachment.name)} disabled={downloading}>
                        <MaterialCommunityIcons
                            name={broadcast.attachment.type === 'pdf' ? 'file-pdf-box' : 'file-document-outline'}
                            size={28} color="#0B4A6F"
                        />
                        <Text style={styles.fileName} numberOfLines={1}>{broadcast.attachment.name}</Text>
                        {downloading ? <ActivityIndicator size="small" color="#0B4A6F" /> : <Feather name="download" size={16} color="#64748B" />}
                        </TouchableOpacity>
                    )
                    ) : null}

                    <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
                        <View style={styles.previewOverlay}>
                            <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setPreviewVisible(false)} hitSlop={12}>
                            <Feather name="x" size={26} color="#FFF" />
                            </TouchableOpacity>
                            <Image source={{ uri: attachmentUrl }} style={styles.previewImage} resizeMode="contain" />
                        </View>
                    </Modal>

                <View style={styles.divider} />

                <DetailRow icon="users" label="Recipients" value={audienceText(broadcast)} />
                {broadcast.status === 'sent' && (
                    <DetailRow icon="eye" label="Read" value={`${broadcast.readCount || 0} / ${broadcast.recipientCount || 0}`} />
                )}
                {broadcast.status === 'scheduled' && broadcast.sendAt && (
                    <DetailRow icon="clock" label="Scheduled for" value={new Date(broadcast.sendAt).toLocaleString()} />
                )}
                {broadcast.sentAt && (
                    <DetailRow icon="check-circle" label="Sent at" value={new Date(broadcast.sentAt).toLocaleString()} />
                )}
                <DetailRow icon="user" label="Created by" value={broadcast.createdBy?.fullName || '—'} />
                <DetailRow icon="calendar" label="Created" value={new Date(broadcast.createdAt).toLocaleString()} />

                </ScrollView>
                {broadcast.status && (
                    <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(broadcast)}>
                        <Feather name="edit-2" size={16} color={colors.primary} />
                        <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(broadcast)}>
                        <Feather name="trash-2" size={16} color="#EF4444" />
                        <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                    </View>
                )}
            
            </>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
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
  fileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16,
    backgroundColor: '#F1F5F9', borderRadius: 12, padding: 12,
  },
  fileName: { flex: 1, fontSize: 13, color: '#334155', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 18 },
  detailRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  detailLabel: { fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  detailValue: { fontSize: 14, color: '#0F172A', fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, },
  editBtn: {
    flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary,
  },
  editBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  deleteBtn: {
    flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: '#EF4444',
  },
  deleteBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
    previewCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
    previewImage: { width: '100%', height: '80%' },
    badgeGroup: { gap: 2, flexWrap: 'wrap',alignItems:'center' },
});