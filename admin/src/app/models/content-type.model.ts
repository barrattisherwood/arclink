export type FieldType =
  | 'text' | 'richtext' | 'url' | 'image' | 'images'
  | 'video_url' | 'coordinates' | 'boolean' | 'select' | 'date' | 'tags';

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  order: number;
  helpText?: string;
}

export interface ContentType {
  _id: string;
  siteId: string;
  name: string;
  slug: string;
  fields: FieldDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}
