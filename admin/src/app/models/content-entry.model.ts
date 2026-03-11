export interface ContentEntry {
  _id: string;
  siteId: string;
  contentTypeSlug: string;
  slug: string;
  published: boolean;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
