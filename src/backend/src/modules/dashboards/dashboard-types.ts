export type DashboardRecord = {
  id: string;
  ownerUserId: string;
  name: string;
  description: string;
  theme: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateDashboardInput = {
  ownerUserId: string;
  name: string;
  description?: string;
  theme?: string;
};

export type UpdateDashboardInput = {
  dashboardId: string;
  ownerUserId: string;
  name: string;
  description?: string;
};

export type DashboardResponse = {
  id: string;
  name: string;
  description: string;
  theme: string;
  createdAt: string;
  updatedAt: string;
};
