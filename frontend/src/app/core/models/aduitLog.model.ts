export interface AuditLog {
  id: number;
  adminUsername: string;
  action: string;
  entityName: string;
  entityId: number;
  details: string;
  timestamp: string;
}