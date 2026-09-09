/**
 * Application Notification Events and Standard Message Templates
 * MahaSetu Interoperability Platform
 */

export const APPLICATION_EVENTS = {
  APPLICATION_SUBMITTED: 'APPLICATION_SUBMITTED',
  DEPARTMENT_A_VERIFIED: 'DEPARTMENT_A_VERIFIED',
  DEPARTMENT_B_VERIFIED: 'DEPARTMENT_B_VERIFIED',
  DEPARTMENT_C_VERIFIED: 'DEPARTMENT_C_VERIFIED',
  ADMIN_VERIFIED: 'ADMIN_VERIFIED',
  AUDITOR_VERIFIED: 'AUDITOR_VERIFIED',
  APPLICATION_APPROVED: 'APPLICATION_APPROVED',
  APPLICATION_REJECTED: 'APPLICATION_REJECTED',
  APPLICATION_REQUIRES_ACTION: 'APPLICATION_REQUIRES_ACTION',
} as const;

export type ApplicationEventType =
  (typeof APPLICATION_EVENTS)[keyof typeof APPLICATION_EVENTS];

/**
 * Returns the exact statutory SMS message for each application lifecycle event
 */
export function getSmsMessage(eventType: ApplicationEventType | string, applicationNumber: string): string {
  switch (eventType) {
    case APPLICATION_EVENTS.APPLICATION_SUBMITTED:
      return `MAHASETU: Your application ${applicationNumber} has been submitted successfully.`;
    case APPLICATION_EVENTS.DEPARTMENT_A_VERIFIED:
      return `MAHASETU: Your application ${applicationNumber} has been verified by Department A.`;
    case APPLICATION_EVENTS.DEPARTMENT_B_VERIFIED:
      return `MAHASETU: Your application ${applicationNumber} has been verified by Department B.`;
    case APPLICATION_EVENTS.DEPARTMENT_C_VERIFIED:
      return `MAHASETU: Your application ${applicationNumber} has been verified by Department C.`;
    case APPLICATION_EVENTS.ADMIN_VERIFIED:
      return `MAHASETU: Your application ${applicationNumber} has been verified by the Administration.`;
    case APPLICATION_EVENTS.AUDITOR_VERIFIED:
      return `MAHASETU: Your application ${applicationNumber} has completed all verification stages.`;
    case APPLICATION_EVENTS.APPLICATION_APPROVED:
      return `MAHASETU: Your application ${applicationNumber} has been approved.`;
    case APPLICATION_EVENTS.APPLICATION_REJECTED:
      return `MAHASETU: Your application ${applicationNumber} requires attention. Please open MahaSetu for details.`;
    case APPLICATION_EVENTS.APPLICATION_REQUIRES_ACTION:
      return `MAHASETU: Your application ${applicationNumber} requires attention. Please open MahaSetu for details.`;
    default:
      return `MAHASETU: Update regarding application ${applicationNumber}.`;
  }
}

/**
 * Returns in-app notification title & message
 */
export function getInAppNotificationDetails(
  eventType: ApplicationEventType | string,
  applicationNumber: string,
  extra?: { departmentName?: string; reason?: string }
): { title: string; message: string } {
  switch (eventType) {
    case APPLICATION_EVENTS.APPLICATION_SUBMITTED:
      return {
        title: 'Application Submitted',
        message: `${applicationNumber} submitted successfully. 5-department verification initialized.`,
      };
    case APPLICATION_EVENTS.DEPARTMENT_A_VERIFIED:
      return {
        title: 'Department A Verification Completed',
        message: `Your application passed Department A (${extra?.departmentName || 'Revenue & Civil Supplies'}) verification.`,
      };
    case APPLICATION_EVENTS.DEPARTMENT_B_VERIFIED:
      return {
        title: 'Department B Verification Completed',
        message: `Your application passed Department B (${extra?.departmentName || 'Social Welfare & Inclusion'}) verification.`,
      };
    case APPLICATION_EVENTS.DEPARTMENT_C_VERIFIED:
      return {
        title: 'Department C Verification Completed',
        message: `Your application passed Department C (${extra?.departmentName || 'Labour & Employment Welfare'}) verification.`,
      };
    case APPLICATION_EVENTS.ADMIN_VERIFIED:
      return {
        title: 'Administration Verification Completed',
        message: `Your application passed State Administration statutory review.`,
      };
    case APPLICATION_EVENTS.AUDITOR_VERIFIED:
      return {
        title: 'Application Completed',
        message: `Your application ${applicationNumber} has passed all 5 verification stages.`,
      };
    case APPLICATION_EVENTS.APPLICATION_APPROVED:
      return {
        title: 'Application Approved',
        message: `Your application ${applicationNumber} has been approved.`,
      };
    case APPLICATION_EVENTS.APPLICATION_REJECTED:
      return {
        title: 'Application Requires Attention',
        message: extra?.reason
          ? `Application rejected: ${extra.reason}. Please review details in MahaSetu.`
          : `Application ${applicationNumber} requires attention. Please open MahaSetu for details.`,
      };
    default:
      return {
        title: 'Status Update',
        message: `Status update for application ${applicationNumber}.`,
      };
  }
}
