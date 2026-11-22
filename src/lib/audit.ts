import { prisma } from "./db";
import { AuthEventType } from "@prisma/client";

export interface LogAuthParams {
  eventType: AuthEventType;
  userId?: string | null;
  email?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: string | null;
}

/**
 * Persists an authentication security event to PostgreSQL audit log.
 * Fails gracefully so audit failures do not block authentication flows.
 */
export async function logAuthEvent(params: LogAuthParams): Promise<void> {
  try {
    await prisma.authAuditLog.create({
      data: {
        eventType: params.eventType,
        userId: params.userId || null,
        email: params.email ? params.email.trim().toLowerCase() : null,
        ipAddress: params.ipAddress ? params.ipAddress.slice(0, 100) : null,
        userAgent: params.userAgent ? params.userAgent.slice(0, 255) : null,
        details: params.details || null,
      },
    });
  } catch (error) {
    console.error("Failed to write to AuthAuditLog:", error);
  }
}
