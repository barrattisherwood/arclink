import { IFieldDefinition } from '../models/ContentType';

export function validateEntryData(
  data: Record<string, any>,
  fields: IFieldDefinition[]
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const value = data[field.key];

    if (field.required && (value === undefined || value === null || value === '')) {
      errors[field.key] = `${field.label} is required`;
      continue;
    }
    if (value === undefined || value === null) continue;

    switch (field.type) {
      case 'url':
      case 'video_url':
        try {
          new URL(value);
        } catch {
          errors[field.key] = `${field.label} must be a valid URL`;
        }
        break;
      case 'coordinates':
        if (typeof value?.lat !== 'number' || typeof value?.lng !== 'number') {
          errors[field.key] = `${field.label} must have lat and lng as numbers`;
        }
        break;
      case 'select':
        if (field.options && !field.options.includes(value)) {
          errors[field.key] = `${field.label} must be one of: ${field.options.join(', ')}`;
        }
        break;
      case 'images':
        if (!Array.isArray(value)) {
          errors[field.key] = `${field.label} must be an array of URLs`;
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors[field.key] = `${field.label} must be a boolean`;
        }
        break;
      case 'date':
        if (isNaN(Date.parse(value))) {
          errors[field.key] = `${field.label} must be a valid date`;
        }
        break;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
