import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Header } from '../../../components/common/Header';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';

export default function DepartmentNotificationsScreen() {
  const { user } = useAuth();

  const mockNotifs = [
    {
      id: 'd-1',
      title: 'New Verification Task Assigned',
      desc: `Application MS-10001 requires ${user?.departmentId} certification.`,
      time: '15m ago',
      type: 'TASK',
    },
    {
      id: 'd-2',
      title: 'Interoperability Consent Granted',
      desc: 'Citizen Anusha G. granted data-sharing consent for eligibility check.',
      time: '1h ago',
      type: 'CONSENT',
    },
    {
      id: 'd-3',
      title: 'Workflow Advancement Alert',
      desc: 'Application MS-10002 has received 2 of 5 required certifications.',
      time: '3h ago',
      type: 'INFO',
    },
  ];

  return (
    <View style={styles.container}>
      <Header
        title="Department Alerts"
        subtitle={`System notifications for ${user?.departmentId || 'Officer'}`}
      />

      <FlatList
        data={mockNotifs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="notifications" size={18} color={Colors.accent} />
            </View>
            <View style={styles.info}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.desc}>{item.desc}</Text>
              <Text style={styles.time}>{item.time}</Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
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
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  desc: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  time: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
