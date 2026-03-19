export type DashboardSnapshotWidgetRecord = {
  widgetId: string;
  widgetType: string;
  title: string;
  status: 'PENDING' | 'READY' | 'FAILED';
  content: Record<string, unknown>;
  errorMessage: string | null;
  generatedAt: Date;
};

export type DashboardSnapshotRecord = {
  id: string;
  dashboardId: string;
  userId: string;
  snapshotDate: string;
  generationStatus: 'PENDING' | 'READY' | 'FAILED';
  summary: Record<string, unknown>;
  generatedAt: Date;
  widgets: DashboardSnapshotWidgetRecord[];
};

export type DashboardSnapshotResponse = {
  id: string;
  dashboardId: string;
  snapshotDate: string;
  generationStatus: 'PENDING' | 'READY' | 'FAILED';
  summary: Record<string, unknown>;
  generatedAt: string;
  widgets: Array<{
    widgetId: string;
    widgetType: string;
    title: string;
    status: 'PENDING' | 'READY' | 'FAILED';
    content: Record<string, unknown>;
    errorMessage: string | null;
    generatedAt: string;
  }>;
};

export type WeatherSnapshotInput = {
  latitude: number;
  longitude: number;
  timezone: string;
};

export type WeatherSnapshotData = {
  temperature: string;
  condition: string;
  location: string;
  highLow: string;
  summary: string;
  details: Array<{
    label: string;
    value: string;
  }>;
};
