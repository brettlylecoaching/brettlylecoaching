/**
 * Single source of truth for site-wide content that isn't long-form copy.
 * Anything marked TODO needs a decision from Brett before launch.
 */

export const site = {
  name: 'Brett Lyle Coaching',
  tagline: 'Career success coaching',
  description:
    'Brett Lyle helps professionals uncover their brands, build Productive Professional Networks™, and tell their stories in a way that compels others to support them.',
  email: 'brettlylecoaching@gmail.com',
  socials: [
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/brettalyle/' },
    { label: 'Instagram', href: 'https://www.instagram.com/brettlylecoaching' },
    { label: 'Facebook', href: 'https://www.facebook.com/brettlylecoaching' },
    { label: 'YouTube', href: 'https://www.youtube.com/channel/UCUNIZQnZrxzi0NTXvt73Igg' },
  ],
} as const;

export const nav = [
  { label: 'Coaching', href: '/coaching' },
  { label: 'Meet Brett', href: '/about' },
  { label: 'Podcast', href: '/podcast' },
] as const;

export type Offer = {
  kind: string;
  title: string;
  body: string;
  price: string;
  cta: { label: string; href: string };
  comingSoon?: boolean;
};

/**
 * Kajabi checkouts stop working on Oct 15, 2026. Until Brett has Stripe
 * Payment Links (or similar), paid offers route to the contact form so no
 * visitor ever lands on a dead checkout.
 * TODO(brett): replace `href` with Stripe Payment Link URLs.
 */
export const offers: Offer[] = [
  {
    kind: 'Learn',
    title: 'Networking Foundations',
    body: 'A straightforward, 25-minute minicourse to start building your own Productive Professional Network™, at your own pace.',
    price: '$14.99',
    cta: { label: 'Get the course', href: '/contact?topic=Networking' },
  },
  {
    kind: 'Coach',
    title: '1:1 Coaching',
    body: 'Make your career transition faster and less stressful. Together you’ll design a plan for your situation, from a single Powersession to the full Career Success Package.',
    price: 'Sessions from $79 · packages from $465',
    cta: { label: 'Start with a free consult', href: '/contact?topic=Career+transition' },
  },
  {
    kind: 'Coming soon',
    title: 'The Two-Way Interview™',
    body: 'Interviews go both ways: you’re choosing them as much as they’re choosing you. A course on interviewing with confidence, curiosity, and leverage.',
    price: 'Want first access? Just ask.',
    cta: { label: 'Get notified', href: '/contact?topic=Interview+prep' },
    comingSoon: true,
  },
];

export const services = [
  'Complimentary consultation',
  'Professional branding',
  'Goal-setting & fulfillment',
  'Productive Professional Networking™',
  'Effective communication & storytelling',
  'Leadership development',
] as const;

export const testimonials = [
  {
    quote:
      'Brett exceeded all expectations I had going into the process. She thoroughly reviewed and provided feedback on every segment… She caught mistakes that I hadn’t, even after checking 100 times.',
    name: 'Rebekah M.',
    place: 'Mobile, AL',
    photo: 'rebekah',
  },
  {
    quote:
      'Our meetings were very constructive: a clear agenda before we met and “homework” for our next sessions, so we stayed on track… I highly recommend her services!',
    name: 'Christy C.',
    place: 'Fort Worth, TX',
    photo: 'christy',
  },
  {
    quote:
      'Brett is an insightful and transformative coach who demonstrates how to look at the big picture while making progress with small steps. This inspires real rather than surface change.',
    name: 'Kate C.',
    place: 'New York City, NY',
    photo: 'kate',
  },
] as const;

export const featuredQuote = {
  quote: 'Brett knows the questions to ask to help get you started down the path of professional discovery.',
  name: 'Dwayne H.',
  role: 'Chief of Staff, Fort Worth, TX',
};

/** Must match the choice titles on the Formaloo form exactly (the API maps by title). */
export const helpTopics = [
  'Career transition',
  'Personal branding & resume',
  'Networking',
  'Interview prep',
  'Leadership development',
  'Coaching for my team or organization',
] as const;
