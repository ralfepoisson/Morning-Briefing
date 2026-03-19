export type DashboardWidgetRecord = {
  id: string;
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
  config: Record<string, unknown>;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateDashboardWidgetInput = {
  dashboardId: string;
  ownerUserId: string;
  type: string;
};

export type UpdateDashboardWidgetInput = {
  dashboardId: string;
  widgetId: string;
  ownerUserId: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
