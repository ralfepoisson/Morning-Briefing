export type RssFeedRecord = {
  id: string;
  categoryId: string;
  name: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
};

export type RssFeedCategoryRecord = {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  sortOrder: number;
  feeds: RssFeedRecord[];
  createdAt: Date;
  updatedAt: Date;
};

export type RssFeedResponse = {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  updatedAt: string;
};

export type RssFeedCategoryResponse = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  feeds: RssFeedResponse[];
  createdAt: string;
  updatedAt: string;
};
