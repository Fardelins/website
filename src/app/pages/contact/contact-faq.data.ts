export interface ContactFaq {
  question: string;
  answer: string;
}

/** Edit, add, remove, or reorder entries here; the Contact accordion updates automatically. */
export const CONTACT_FAQS: ContactFaq[] = [
  { question: 'How quickly can I expect a response?', answer: 'Most inquiries receive a response within 24 business hours.' },
  { question: 'Can I use Fardelins for my delivery business?', answer: 'Yes. Fardelins supports delivery businesses, dispatch teams, stores, and independent operators with tools for managing deliveries and tracking.' },
  { question: 'Do you offer business partnerships?', answer: 'Yes. Tell us about your business through the form above and our partnerships team will get in touch.' },
  { question: 'How do I report an issue with a delivery?', answer: 'Send us the delivery reference and a short description of the issue. Our support team will investigate and respond as quickly as possible.' },
  { question: 'Can I change my delivery address after placing an order?', answer: 'Contact support immediately. Address changes depend on the delivery status and whether the courier has already started the trip.' },
  { question: 'What are the available payment methods for my purchase?', answer: 'Available methods are shown during checkout and may vary by service and location.' },
  { question: 'How long does it take for a refund to be processed?', answer: 'Approved refunds are typically processed within 5 to 10 business days, depending on your payment provider.' },
];
