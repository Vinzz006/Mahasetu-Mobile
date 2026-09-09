import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Header } from '../../../components/common/Header';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { GOVERNMENT_SERVICES } from '../../../constants/demoData';
import { router } from 'expo-router';

export default function CitizenServicesScreen() {
  return (
    <View style={styles.container}>
      <Header
        title="Service Catalogue"
        subtitle="Apply Once • Multi-Department Processing"
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.noticeBanner}>
          <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
          <Text style={styles.noticeText}>
            All services utilize your pre-verified MahaSetu citizen identity. You will not need to repeatedly submit Aadhaar or domicile records.
          </Text>
        </View>

        {GOVERNMENT_SERVICES.map((service) => (
          <View key={service.id} style={styles.serviceCard}>
            {/* Top row */}
            <View style={styles.cardTop}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{service.category}</Text>
              </View>
              <View style={styles.daysBadge}>
                <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
                <Text style={styles.daysText}>~{service.estimatedDays} Days Processing</Text>
              </View>
            </View>

            <Text style={styles.serviceTitle}>{service.title}</Text>
            <Text style={styles.serviceDesc}>{service.description}</Text>

            {/* Departments involved */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>DEPARTMENTS INVOLVED IN VERIFICATION:</Text>
              <View style={styles.deptPillsRow}>
                {service.departmentsInvolved.map((dept) => (
                  <View key={dept.id} style={styles.deptPill}>
                    <Ionicons name="business-outline" size={12} color={Colors.primary} />
                    <Text style={styles.deptPillText}>{dept.name}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Eligibility */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>ELIGIBILITY REQUIREMENTS:</Text>
              {service.eligibility.map((crit, idx) => (
                <View key={idx} style={styles.critRow}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={Colors.success} />
                  <Text style={styles.critText}>{crit}</Text>
                </View>
              ))}
            </View>

            {/* Reusable Data Badge */}
            <View style={styles.reusableBox}>
              <Ionicons name="sync-outline" size={14} color={Colors.accent} />
              <Text style={styles.reusableText}>
                Reusable from MahaSetu: {service.reusableFields.join(', ')}
              </Text>
            </View>

            {/* Apply Button */}
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => router.push(`/(citizen)/apply/${service.id}`)}
              accessibilityLabel={`Apply for ${service.title}`}
            >
              <Text style={styles.applyBtnText}>Apply for Service</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.textInverse} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  noticeBanner: {
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
  noticeText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    lineHeight: 18,
  },
  serviceCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadowColor,
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  categoryBadge: {
    backgroundColor: Colors.surfaceSubtle,
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  categoryText: {
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  daysBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  daysText: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  serviceTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  serviceDesc: {
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  sectionBlock: {
    marginTop: Spacing.sm,
  },
  sectionLabel: {
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  deptPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  deptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySubtle,
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  deptPillText: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.primary,
    fontWeight: '600',
  },
  critRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 3,
  },
  critText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  reusableBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentLight,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    gap: 6,
  },
  reusableText: {
    fontSize: Typography.fontSize.xs - 2,
    color: '#0F766E',
    fontWeight: '600',
    flex: 1,
  },
  applyBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  applyBtnText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
});
