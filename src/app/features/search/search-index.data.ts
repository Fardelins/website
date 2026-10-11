import { FEATURES_FAQS } from '@features/features-page/features-faq.data';
import { CONTACT_FAQS } from '@features/contact/contact-faq.data';
import { SearchResult } from './search.models';

const HELP_ICON = 'solarQuestionCircleBoldDuotone';

export const ACTIONS: SearchResult[] = [
  {
    id: 'action-send',
    scope: 'actions',
    title: 'Create delivery',
    detail: 'Book a new parcel pickup',
    icon: 'solarAddCircleBoldDuotone',
    link: ['/app/send'],
    hint: 'C',
    keywords: [
      'send',
      'send delivery',
      'send parcel',
      'send package',
      'ship',
      'shipping',
      'new',
      'book',
      'booking',
      'create',
      'dispatch',
      'courier',
      'rider',
      'bike',
      'driver',
      'pickup',
      'drop off',
      'order',
      'post',
      // Pricing lands here on purpose: the quote comes from the booking flow, and no
      // published FAQ states a figure we could quote back.
      'cost',
      'price',
      'pricing',
      'fee',
      'charge',
      'rate',
      'quote',
      'estimate',
      'how much',
    ],
  },
  {
    id: 'action-parcels',
    scope: 'actions',
    title: 'View all parcels',
    detail: 'Every delivery you have booked',
    icon: 'solarBoxBoldDuotone',
    link: ['/app/deliveries'],
    hint: 'P',
    keywords: ['parcels', 'deliveries', 'shipments', 'orders', 'list', 'history', 'all', 'my'],
  },
  {
    id: 'action-profile',
    scope: 'actions',
    title: 'Profile settings',
    detail: 'Your name, email and phone',
    icon: 'solarUserRoundedBoldDuotone',
    link: ['/app/profile'],
    keywords: ['profile', 'account', 'settings', 'preferences', 'details', 'me'],
  },
  {
    id: 'action-profile-edit',
    scope: 'actions',
    title: 'Edit your details',
    detail: 'Change your name, email or phone number',
    icon: 'solarUserRoundedBoldDuotone',
    link: ['/app/profile/edit'],
    keywords: ['edit', 'change', 'update', 'name', 'email', 'phone', 'number', 'details'],
  },
  {
    id: 'action-profile-security',
    scope: 'actions',
    title: 'Password and security',
    detail: 'Change your password',
    icon: 'solarUserRoundedBoldDuotone',
    link: ['/app/profile/security'],
    keywords: ['password', 'security', 'reset', 'change password', 'login', 'sign in', '2fa'],
  },
  {
    id: 'action-profile-documents',
    scope: 'actions',
    title: 'Verification documents',
    detail: 'Upload and review your ID documents',
    icon: 'solarUserRoundedBoldDuotone',
    link: ['/app/profile/documents'],
    keywords: [
      'document',
      'documents',
      'id',
      'identity',
      'kyc',
      'verify',
      'verification',
      'upload',
    ],
  },
  {
    id: 'action-track',
    scope: 'actions',
    title: 'Track a parcel',
    detail: 'Look up any tracking ID',
    icon: 'solarMapPointWaveBoldDuotone',
    link: ['/track'],
    keywords: ['track', 'tracking', 'where', 'locate', 'find', 'status', 'trace', 'follow'],
  },
  {
    id: 'action-help',
    scope: 'actions',
    title: 'Help centre',
    detail: 'Reach a human',
    icon: 'solarQuestionCircleBoldDuotone',
    link: ['/app/help'],
    keywords: ['help', 'support', 'contact', 'problem', 'issue', 'question', 'stuck', 'complaint'],
  },
];

/**
 * Extra search terms for the published FAQs, keyed by a phrase from the question.
 * The answers stay exactly as written on the site, only the words that reach them
 * are widened here, so search never puts words in the company's mouth.
 */
const FAQ_KEYWORDS: { match: string; keywords: string[] }[] = [
  { match: 'refund', keywords: ['refund', 'money back', 'reimburse', 'chargeback', 'return'] },
  { match: 'track', keywords: ['track', 'tracking', 'where', 'status', 'locate'] },
  {
    match: 'deliver',
    keywords: ['delivery', 'deliver', 'how long', 'eta', 'time', 'late', 'delay'],
  },
  { match: 'price', keywords: ['price', 'pricing', 'cost', 'fee', 'charge', 'how much', 'quote'] },
  { match: 'pay', keywords: ['pay', 'payment', 'card', 'transfer', 'bank'] },
  { match: 'insur', keywords: ['insurance', 'insured', 'damage', 'lost', 'broken', 'cover'] },
  { match: 'cancel', keywords: ['cancel', 'cancellation', 'stop', 'abort'] },
  { match: 'pickup', keywords: ['pickup', 'pick up', 'collect', 'collection'] },
  {
    match: 'international',
    keywords: ['international', 'abroad', 'overseas', 'export', 'country'],
  },
  { match: 'size', keywords: ['size', 'weight', 'heavy', 'big', 'dimension', 'limit'] },
];

function faqKeywords(question: string, answer: string): string[] {
  const haystack = `${question} ${answer}`.toLowerCase();
  return FAQ_KEYWORDS.filter((entry) => haystack.includes(entry.match)).flatMap((e) => e.keywords);
}

export const HELP_INDEX: SearchResult[] = [
  ...FEATURES_FAQS.map((faq, index) => ({
    id: `help-features-${index}`,
    scope: 'help' as const,
    title: faq.question,
    detail: faq.answer,
    icon: HELP_ICON,
    href: '/features#faq',
    keywords: faqKeywords(faq.question, faq.answer),
  })),
  ...CONTACT_FAQS.map((faq, index) => ({
    id: `help-contact-${index}`,
    scope: 'help' as const,
    title: faq.question,
    detail: faq.answer,
    icon: HELP_ICON,
    href: '/contact#faq',
    keywords: faqKeywords(faq.question, faq.answer),
  })),
];
