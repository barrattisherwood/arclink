import 'dotenv/config';
import mongoose from 'mongoose';
import { createHash } from 'crypto';
import { ContentTenant } from '../models/Tenant';
import { ContentType } from '../models/ContentType';

const SITE_ID = 'dlc-townplanning';
const RAW_API_KEY = 'dlc-content-key-change-me';

const contentTypes = [
  {
    name: 'Project',
    slug: 'project',
    fields: [
      { key: 'title', label: 'Project Title', type: 'text', required: true, order: 1 },
      { key: 'summary', label: 'Short Summary', type: 'text', required: true, order: 2 },
      { key: 'description', label: 'Full Description', type: 'richtext', required: true, order: 3 },
      { key: 'location', label: 'Location Name', type: 'text', required: true, order: 4 },
      { key: 'coordinates', label: 'Coordinates', type: 'coordinates', required: true, order: 5 },
      { key: 'country', label: 'Country', type: 'text', required: true, order: 6 },
      {
        key: 'region',
        label: 'Region',
        type: 'select',
        required: true,
        order: 7,
        options: ['south-africa', 'africa', 'international'],
      },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        required: true,
        order: 8,
        options: ['master-planning', 'town-planning', 'project-management', 'environmental'],
      },
      { key: 'images', label: 'Project Images', type: 'images', required: true, order: 9 },
      { key: 'videoUrl', label: 'Video URL', type: 'video_url', required: false, order: 10 },
      { key: 'projectUrl', label: 'External URL', type: 'url', required: false, order: 11 },
      { key: 'featured', label: 'Featured Project', type: 'boolean', required: false, order: 12 },
    ],
  },
  {
    name: 'Service',
    slug: 'service',
    fields: [
      { key: 'title', label: 'Service Title', type: 'text', required: true, order: 1 },
      { key: 'summary', label: 'Short Summary', type: 'text', required: true, order: 2 },
      { key: 'body', label: 'Full Description', type: 'richtext', required: true, order: 3 },
      { key: 'icon', label: 'Icon / Image', type: 'image', required: false, order: 4 },
      { key: 'order', label: 'Display Order', type: 'text', required: false, order: 5 },
    ],
  },
  {
    name: 'Pillar',
    slug: 'pillar',
    fields: [
      { key: 'title', label: 'Pillar Title', type: 'text', required: true, order: 1 },
      { key: 'description', label: 'Description', type: 'richtext', required: true, order: 2 },
      { key: 'icon', label: 'Icon / Image', type: 'image', required: false, order: 3 },
      { key: 'order', label: 'Display Order', type: 'text', required: false, order: 4 },
    ],
  },
  {
    name: 'Team',
    slug: 'team',
    fields: [
      { key: 'photo', label: 'Team Photo', type: 'image', required: true, order: 1 },
      { key: 'caption', label: 'Caption', type: 'text', required: false, order: 2 },
    ],
  },
  {
    name: 'Site Settings',
    slug: 'site-settings',
    fields: [
      { key: 'email', label: 'Contact Email', type: 'text', required: true, order: 1 },
      { key: 'phone', label: 'Phone Number', type: 'text', required: true, order: 2 },
      { key: 'address', label: 'Physical Address', type: 'richtext', required: false, order: 3 },
      { key: 'postal', label: 'Postal Address', type: 'richtext', required: false, order: 4 },
      { key: 'facebook', label: 'Facebook URL', type: 'url', required: false, order: 5 },
      { key: 'linkedin', label: 'LinkedIn URL', type: 'url', required: false, order: 6 },
    ],
  },
];

async function seed(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  await ContentTenant.findOneAndUpdate(
    { siteId: SITE_ID },
    {
      siteId: SITE_ID,
      name: 'DLC Town Planning',
      domain: 'dlctownplanning.co.za',
      adminUsers: [],
      api_key: createHash('sha256').update(RAW_API_KEY).digest('hex'),
      active: true,
    },
    { upsert: true, new: true }
  );
  console.log('Tenant seeded');

  for (const ct of contentTypes) {
    await ContentType.findOneAndUpdate(
      { siteId: SITE_ID, slug: ct.slug },
      { siteId: SITE_ID, ...ct },
      { upsert: true, new: true }
    );
    console.log(`ContentType seeded: ${ct.name}`);
  }

  console.log('DLC Town Planning seed complete');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
