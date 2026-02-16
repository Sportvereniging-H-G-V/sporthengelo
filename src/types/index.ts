export interface Sport {
  id: string;
  slug: string;
  title: string;
  image: string;
  summary: string;
  body: string;
  external_url?: string;
  category: 'regulier' | 'aangepast';
}

export interface SiteConfig {
  brand: string;
  tagline: string;
  home_intro: string;
  contact_email: string;
  contact_phone: string;
  socials: Array<{
    label: string;
    href: string;
  }>;
}

export interface MissingSportFormData {
  sportName: string;
  organizationName: string;
  category: 'regulier' | 'aangepast' | 'beide';
  website: string;
  description?: string;
  reporterName: string;
  reporterEmail: string;
  company?: string; // honeypot
}

