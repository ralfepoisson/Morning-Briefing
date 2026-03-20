export type DashboardWidgetRecord = {
  id: string;
  tenantId: string;
  dashboardId: string;
  ownerUserId: string;
  type: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  isVisible: boolean;
  sortOrder: number;
  refreshMode: 'SNAPSHOT' | 'LIVE' | 'HYBRID';
  version: number;
  config: Record<string, unknown>;
  configHash: string;
  data: Record<string, unknown>;
  connections: DashboardWidgetConnectionRecord[];
  createdAt: Date;
  updatedAt: Date;
  shouldRefreshSnapshot?: boolean;
};

export type DashboardWidgetConnectionRecord = {
  id: string;
  usageRole: string;
  connector: {
    id: string;
    type: string;
    name: string;
    status: 'ACTIVE' | 'DISABLED' | 'ERROR';
    authType: 'NONE' | 'API_KEY' | 'OAUTH' | 'BASIC';
    baseUrl: string | null;
    config: Record<string, unknown>;
    lastSyncAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
};

export type CreateDashboardWidgetInput = {
  dashboardId: string;
  ownerUserId: string;
  type: string;
  timezone?: string;
  correlationId?: string | null;
  causationId?: string | null;
};

export type UpdateDashboardWidgetInput = {
  dashboardId: string;
  widgetId: string;
  ownerUserId: string;
  timezone?: string;
  correlationId?: string | null;
  causationId?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  config?: Record<string, unknown>;
};

export type ArchiveDashboardWidgetInput = {
  dashboardId: string;
  widgetId: string;
  ownerUserId: string;
};

export type DashboardWidgetResponse = {
  id: string;
  dashboardId: string;
  type: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  isVisible: boolean;
  sortOrder: number;
  config: Record<string, unknown>;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
