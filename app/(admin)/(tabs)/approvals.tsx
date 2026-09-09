import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Header } from '../../../components/common/Header';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { EmptyState } from '../../../components/common/EmptyState';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { adminDashboardService } from '../../../services/adminDashboardService';
import { authService } from '../../../services/authService';
import { DepartmentId, UserRole } from '../../../types';

interface PendingRegistration {
  uid: string;
  name: string;
  email: string;
  phone: string;
  provider: string;
  registeredAt: string;
  status: 'PENDING' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
}

export default function AdminApprovalsScreen() {
  const [pendingUsers, setPendingUsers] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = adminDashboardService.subscribeToPendingUsers(
      (users) => {
        const mapped: PendingRegistration[] = users.map((u) => ({
          uid: u.uid,
          name: u.name || 'Applicant',
          email: u.email,
          phone: u.phone || 'N/A',
          provider: 'Email & Password',
          registeredAt: u.createdAt,
          status: (u.status as any) || 'PENDING',
        }));
        setPendingUsers(mapped);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const [selectedUser, setSelectedUser] = useState<PendingRegistration | null>(null);
  const [selectedRole, setSelectedRole] = useState<'citizen' | 'department_officer' | 'auditor'>('citizen');
  const [selectedDept, setSelectedDept] = useState<DepartmentId>('DEPT_A');
  const [submitting, setSubmitting] = useState(false);

  const openApprovalModal = (user: PendingRegistration) => {
    setSelectedUser(user);
    setSelectedRole('citizen');
    setSelectedDept('DEPT_A');
  };

  const handleApprove = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await authService.approvePendingUser(
        selectedUser.uid,
        selectedRole,
        selectedRole === 'department_officer' ? selectedDept : undefined
      );

      setPendingUsers((prev) =>
        prev.map((u) => (u.uid === selectedUser.uid ? { ...u, status: 'APPROVED' } : u))
      );

      Alert.alert(
        'User Approved',
        `Successfully approved ${selectedUser.name} as ${selectedRole.toUpperCase()}${
          selectedRole === 'department_officer' ? ` (${selectedDept})` : ''
        }. Firebase custom claims updated.`
      );
      setSelectedUser(null);
    } catch (e: any) {
      Alert.alert('Approval Error', e.message || 'Failed to approve user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      await authService.rejectPendingUser(selectedUser.uid, 'Rejected by system administrator.');
      setPendingUsers((prev) =>
        prev.map((u) => (u.uid === selectedUser.uid ? { ...u, status: 'REJECTED' } : u))
      );
      Alert.alert('Registration Rejected', `Account request for ${selectedUser.name} was rejected.`);
      setSelectedUser(null);
    } catch (e: any) {
      Alert.alert('Rejection Error', e.message || 'Failed to reject user');
    } finally {
      setSubmitting(false);
    }
  };

  const activePending = pendingUsers.filter(
    (u) => u.status === 'PENDING' || u.status === 'PENDING_APPROVAL'
  );

  return (
    <View style={styles.container}>
      <Header
        title="Pending User Approvals"
        subtitle="Review sign-ups & assign authorized MahaSetu roles"
      />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={activePending}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.banner}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
              <Text style={styles.bannerText}>
                All new registrations start under PENDING status. An administrator must assign a role (Citizen, Department Officer, or Auditor) before access is granted.
              </Text>
            </View>
          }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={20} color={Colors.primary} />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.nameText}>{item.name}</Text>
                <Text style={styles.emailText}>{item.email}</Text>
                <Text style={styles.phoneText}>Phone: {item.phone}</Text>
              </View>
              <StatusBadge status={item.status} size="sm" />
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Provider: {item.provider}</Text>
              <Text style={styles.metaText}>
                Registered: {new Date(item.registeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.reviewBtn}
              onPress={() => openApprovalModal(item)}
            >
              <Text style={styles.reviewBtnText}>Assign Role & Approve</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.textInverse} />
            </TouchableOpacity>
          </View>
        )}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-circle-outline"
              title="No Pending Registrations"
              description="All user onboarding registrations have been reviewed and approved."
            />
          }
        />
      )}

      {/* Role Assignment Modal */}
      <Modal visible={!!selectedUser} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Role & Approve</Text>
              <TouchableOpacity onPress={() => setSelectedUser(null)}>
                <Ionicons name="close" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <View style={styles.userSummaryBox}>
                <Text style={styles.summaryName}>{selectedUser.name}</Text>
                <Text style={styles.summarySub}>{selectedUser.email}</Text>
                <Text style={styles.summarySub}>Provider: {selectedUser.provider} • Phone: {selectedUser.phone}</Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>SELECT ROLE TO ASSIGN:</Text>
            <View style={styles.roleOptionsRow}>
              <TouchableOpacity
                style={[styles.roleChip, selectedRole === 'citizen' && styles.roleChipActive]}
                onPress={() => setSelectedRole('citizen')}
              >
                <Ionicons
                  name="person"
                  size={16}
                  color={selectedRole === 'citizen' ? Colors.textInverse : Colors.textPrimary}
                />
                <Text
                  style={[
                    styles.roleChipText,
                    selectedRole === 'citizen' && styles.roleChipTextActive,
                  ]}
                >
                  Citizen
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleChip, selectedRole === 'department_officer' && styles.roleChipActive]}
                onPress={() => setSelectedRole('department_officer')}
              >
                <Ionicons
                  name="business"
                  size={16}
                  color={selectedRole === 'department_officer' ? Colors.textInverse : Colors.textPrimary}
                />
                <Text
                  style={[
                    styles.roleChipText,
                    selectedRole === 'department_officer' && styles.roleChipTextActive,
                  ]}
                >
                  Dept Officer
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleChip, selectedRole === 'auditor' && styles.roleChipActive]}
                onPress={() => setSelectedRole('auditor')}
              >
                <Ionicons
                  name="shield"
                  size={16}
                  color={selectedRole === 'auditor' ? Colors.textInverse : Colors.textPrimary}
                />
                <Text
                  style={[
                    styles.roleChipText,
                    selectedRole === 'auditor' && styles.roleChipTextActive,
                  ]}
                >
                  Auditor
                </Text>
              </TouchableOpacity>
            </View>

            {/* Department Selector if Department Officer */}
            {selectedRole === 'department_officer' && (
              <View style={styles.deptSelectionSection}>
                <Text style={styles.sectionLabel}>ASSIGN DEPARTMENT SCOPE:</Text>
                <View style={styles.deptOptionsColumn}>
                  <TouchableOpacity
                    style={[styles.deptOption, selectedDept === 'DEPT_A' && styles.deptOptionActive]}
                    onPress={() => setSelectedDept('DEPT_A')}
                  >
                    <Text style={[styles.deptOptionText, selectedDept === 'DEPT_A' && styles.deptOptionTextActive]}>
                      Department A — Revenue & Civil Supplies
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.deptOption, selectedDept === 'DEPT_B' && styles.deptOptionActive]}
                    onPress={() => setSelectedDept('DEPT_B')}
                  >
                    <Text style={[styles.deptOptionText, selectedDept === 'DEPT_B' && styles.deptOptionTextActive]}>
                      Department B — Social Welfare & Inclusion
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.deptOption, selectedDept === 'DEPT_C' && styles.deptOptionActive]}
                    onPress={() => setSelectedDept('DEPT_C')}
                  >
                    <Text style={[styles.deptOptionText, selectedDept === 'DEPT_C' && styles.deptOptionTextActive]}>
                      Department C — Labour & Employment Welfare
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.adminSecurityNotice}>
              <Ionicons name="lock-closed-outline" size={14} color="#B45309" />
              <Text style={styles.adminSecurityText}>
                Admin Role Restriction: Normal Admin UI restricts granting the Admin role arbitrarily. Existing Admins remain provisioned.
              </Text>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.btnRejectModal}
                onPress={handleReject}
                disabled={submitting}
              >
                <Text style={styles.btnRejectModalText}>Reject Account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnApproveModal}
                onPress={handleApprove}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.textInverse} size="small" />
                ) : (
                  <Text style={styles.btnApproveModalText}>Approve & Grant Claims</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  bannerText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  nameText: {
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emailText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  phoneText: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textMuted,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
  },
  metaText: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
  },
  reviewBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  reviewBtnText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.lg * 1.5,
    borderTopRightRadius: BorderRadius.lg * 1.5,
    padding: Spacing.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  userSummaryBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  summaryName: {
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summarySub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: Typography.fontSize.xs - 1,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  roleOptionsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.borderDark,
  },
  roleChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleChipText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  roleChipTextActive: {
    color: Colors.textInverse,
  },
  deptSelectionSection: {
    marginBottom: Spacing.md,
  },
  deptOptionsColumn: {
    gap: Spacing.xs,
  },
  deptOption: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deptOptionActive: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  deptOptionText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  deptOptionTextActive: {
    color: '#0F766E',
    fontWeight: '700',
  },
  adminSecurityNotice: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  adminSecurityText: {
    fontSize: Typography.fontSize.xs - 2,
    color: '#92400E',
    flex: 1,
    lineHeight: 16,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  btnRejectModal: {
    flex: 1,
    paddingVertical: Spacing.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dangerLight,
    borderRadius: BorderRadius.md,
  },
  btnRejectModalText: {
    color: Colors.danger,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
  },
  btnApproveModal: {
    flex: 2,
    paddingVertical: Spacing.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.md,
  },
  btnApproveModalText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
  },
});
