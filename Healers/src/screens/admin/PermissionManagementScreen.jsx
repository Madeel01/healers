import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Modal, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect } from "@react-navigation/native";

import {
  createPermissionGroupApi, deletePermissionGroupApi, getPermissionAssignmentsApi,
  getPermissionGroupsApi, getPermissionsApi, setManagerGroupsApi, updatePermissionGroupApi,
} from "../../api/authApi";
import { colors, commonStyles, fonts } from "../../styles/theme";
import { fontSize, hp } from "../../utils/responsive";

const errMsg = (e, fallback) => e?.response?.data?.message || fallback;

/* ---------- checkbox row ---------- */
const CheckRow = ({ label, sub, checked, locked, onPress }) => (
  <TouchableOpacity
    style={styles.checkRow}
    onPress={onPress}
    disabled={locked}
    activeOpacity={0.7}
  >
    <View style={[styles.box, checked && styles.boxOn, locked && { opacity: 0.5 }]}>
      {checked && <Feather name="check" size={14} color="#fff" />}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.checkLabel}>{label}</Text>
      {!!sub && <Text style={styles.sub}>{sub}</Text>}
    </View>
  </TouchableOpacity>
);

/* ---------- Group create / edit modal ---------- */
function GroupModal({ visible, group, permissions, onClose, onSaved, insets }) {
  const isEdit = !!group;
  const isDefault = group?.type === "default";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setName(group?.name || "");
    setDescription(group?.description || "");
    setSelected((group?.permissions || []).map(String));
  }, [visible, group]);

  const toggle = (id) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const save = async () => {
    if (saving) return;
    if (!name.trim()) return Alert.alert("Error", "Group name is required.");
    if (!selected.length) return Alert.alert("Error", "Select at least one permission.");

    setSaving(true);
    try {
      const body = { name: name.trim(), description: description.trim(), permissions: selected };
      if (isEdit) await updatePermissionGroupApi(group._id, body);
      else await createPermissionGroupApi(body);
      onSaved();
    } catch (e) {
      Alert.alert("Error", errMsg(e, "Could not save group."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{isEdit ? "Edit Group" : "New Group"}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
            <Text style={styles.label}>Group name</Text>
            <TextInput
              style={[styles.input, isDefault && { opacity: 0.6 }]}
              value={name}
              onChangeText={setName}
              editable={!isDefault}
              placeholder="e.g. Finance Team"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.label}>Permissions ({selected.length})</Text>
            {permissions.map((p) => (
              <CheckRow
                key={p._id}
                label={p.name}
                sub={p.description}
                checked={selected.includes(String(p._id))}
                onPress={() => toggle(String(p._id))}
              />
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
            onPress={save}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save Group</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Assign modal (one manager) ---------- */
function AssignModal({ visible, manager, groups, currentIds, onClose, onSaved, insets }) {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const defaultGroup = groups.find((g) => g.type === "default");
  const customGroups = groups.filter((g) => g.type === "custom" && g.isActive);

  React.useEffect(() => {
    if (visible) setSelected(currentIds);
  }, [visible, currentIds]);

  const toggle = (id) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await setManagerGroupsApi(manager._id, selected);
      onSaved();
    } catch (e) {
      Alert.alert("Error", errMsg(e, "Could not save."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={1}>{manager?.fullName}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flexShrink: 1 }}>
            {defaultGroup && (
              <CheckRow
                label={defaultGroup.name}
                sub="Always applied to every Manager"
                checked
                locked
              />
            )}
            <Text style={styles.label}>Extra groups</Text>
            {customGroups.length === 0 && (
              <Text style={styles.sub}>No custom groups yet. Create one in the Groups tab.</Text>
            )}
            {customGroups.map((g) => (
              <CheckRow
                key={g._id}
                label={g.name}
                sub={`${g.permissions.length} permissions`}
                checked={selected.includes(String(g._id))}
                onPress={() => toggle(String(g._id))}
              />
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
            onPress={save}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Screen ---------- */
export default function PermissionManagementScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("managers");
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [managers, setManagers] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);

  const [assignFor, setAssignFor] = useState(null);
  const [groupModal, setGroupModal] = useState({ visible: false, group: null });

  const load = useCallback(async () => {
    try {
      const [p, g, a] = await Promise.all([
        getPermissionsApi(),
        getPermissionGroupsApi(),
        getPermissionAssignmentsApi(),
      ]);
      setPermissions(p?.data || []);
      setGroups(g?.data || []);
      setManagers(a?.managers || []);
      setUserPermissions(a?.userPermissions || []);
    } catch (e) {
      console.log(e,"Eee");
      Alert.alert("Error", errMsg(e, "Could not load data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const groupIdsOf = (userId) =>
    userPermissions.filter((x) => String(x.userId) === String(userId)).map((x) => String(x.groupId));

  const groupName = (id) => groups.find((g) => String(g._id) === String(id))?.name;

  const confirmDelete = (g) =>
    Alert.alert("Delete group", `Delete "${g.name}"? It will be removed from all managers.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePermissionGroupApi(g._id);
            load();
          } catch (e) {
            Alert.alert("Error", errMsg(e, "Could not delete group."));
          }
        },
      },
    ]);

  if (loading) {
    return (
      <View style={[commonStyles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <View style={styles.tabs}>
        {[["managers", "Managers"], ["groups", "Groups"]].map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[styles.tab, tab === id && styles.tabOn]}
            onPress={() => setTab(id)}
          >
            <Text style={[styles.tabText, tab === id && { color: "#fff" }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "managers" ? (
        <FlatList
          data={managers}
          keyExtractor={(m) => String(m._id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No managers found.</Text>}
          renderItem={({ item }) => {
            const ids = groupIdsOf(item._id);
            return (
              <TouchableOpacity style={styles.card} onPress={() => setAssignFor(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.fullName}</Text>
                  <Text style={styles.sub}>{item.email}</Text>
                  <Text style={[styles.sub, { marginTop: 4 }]}>
                    {ids.length ? ids.map(groupName).filter(Boolean).join(", ") : "Default permissions only"}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="#94A3B8" />
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <>
          <FlatList
            data={groups}
            keyExtractor={(g) => String(g._id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.name}
                    {item.type === "default" ? "  (default)" : ""}
                  </Text>
                  <Text style={styles.sub}>{item.permissions.length} permissions</Text>
                </View>
                <TouchableOpacity onPress={() => setGroupModal({ visible: true, group: item })} hitSlop={8}>
                  <Feather name="edit-2" size={18} color="#334155" />
                </TouchableOpacity>
                {item.type === "custom" && (
                  <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={8} style={{ marginLeft: 16 }}>
                    <Feather name="trash-2" size={18} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setGroupModal({ visible: true, group: null })}
          >
            <Feather name="plus" size={fontSize(24)} color="#fff" />
          </TouchableOpacity>
        </>
      )}

      <AssignModal
        visible={!!assignFor}
        manager={assignFor}
        groups={groups}
        currentIds={assignFor ? groupIdsOf(assignFor._id) : []}
        insets={insets}
        onClose={() => setAssignFor(null)}
        onSaved={() => { setAssignFor(null); load(); }}
      />

      <GroupModal
        visible={groupModal.visible}
        group={groupModal.group}
        permissions={permissions}
        insets={insets}
        onClose={() => setGroupModal({ visible: false, group: null })}
        onSaved={() => { setGroupModal({ visible: false, group: null }); load(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", margin: 16, backgroundColor: "#F1F5F9", borderRadius: 12, padding: 4 },
  tab: { flex: 1, height: hp(40), borderRadius: 9, alignItems: "center", justifyContent: "center" },
  tabOn: { backgroundColor: "#0B4A6F" },
  tabText: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#475569" },
  list: { paddingHorizontal: 16, paddingBottom: hp(90) },
  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 16, padding: 14, marginBottom: 10, elevation: 1,
  },
  name: { fontSize: fontSize(15), fontFamily: fonts.semiBold, color: "#0F172A" },
  sub: { fontSize: fontSize(12), fontFamily: fonts.regular, color: "#64748B", marginTop: 2 },
  empty: { textAlign: "center", marginTop: 60, color: "#64748B" },
  fab: {
    position: "absolute", right: 16, bottom: 20, width: 56, height: 56, borderRadius: 16,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", elevation: 6,
  },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, maxHeight: "88%",
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 12 },
  sheetTitle: { flex: 1, fontSize: fontSize(18), fontFamily: fonts.semiBold, color: "#0F172A" },
  label: { fontSize: fontSize(13), fontFamily: fonts.bold, color: "#475569", marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12,
    paddingHorizontal: 14, height: hp(50), fontSize: fontSize(14), color: "#0F172A",
  },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  box: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#94A3B8",
    alignItems: "center", justifyContent: "center",
  },
  boxOn: { backgroundColor: "#0B4A6F", borderColor: "#0B4A6F" },
  checkLabel: { fontSize: fontSize(14), fontFamily: fonts.semiBold, color: "#0F172A" },
  primaryBtn: {
    backgroundColor: "#0B4A6F", borderRadius: 14, paddingVertical: hp(14),
    alignItems: "center", marginTop: 12,
  },
  primaryText: { color: "#fff", fontSize: fontSize(14), fontFamily: fonts.semiBold },
});