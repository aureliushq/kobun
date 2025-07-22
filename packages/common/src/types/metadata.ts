/**
 * Metadata types for content management
 */

export interface BaseMetadata {
  id?: string;
  createdAt?: string;
  updatedAt: string;
  status?: "draft" | "published";
  publishedAt?: string;
}

export interface CollectionItemMetadata extends BaseMetadata {
  id: string;
  createdAt: string;
  status: "draft" | "published";
  [key: string]: unknown;
}

export interface SingletonMetadata extends BaseMetadata {
  [key: string]: unknown;
}

export interface ContentPayload {
  content?: string;
  [key: string]: unknown;
}

export interface FormSubmissionData {
  intent?: string;
  [key: string]: unknown;
}

export interface MetadataGenerationOptions {
  intent?: string;
  existingMetadata?: BaseMetadata;
  generateId?: boolean;
}
