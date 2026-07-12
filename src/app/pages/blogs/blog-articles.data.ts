export interface BlogArticle {
  /** Stable identifier — used for tracking and future article-detail routing. */
  id: string;
  /** URL-safe slug, ready for a future `/blogs/:slug` detail route. */
  slug: string;
  category: string;
  readTime: string;
  title: string;
  excerpt: string;
  image: string;
}

/** Unsplash source images, sized/cropped via their dynamic resizing params. */
const UNSPLASH = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&q=75&auto=format&fit=crop`;

export const BLOG_CATEGORIES = [
  'All Articles',
  'Delivery Operations',
  'Customer Experience',
  'Courier Management',
  'E-commerce',
  'Technology',
  'Industry News',
] as const;

/** Edit, add, remove, or reorder entries here; the Blogs page grid updates automatically. */
export const BLOG_ARTICLES: BlogArticle[] = [
  {
    id: 'real-time-tracking-customer-trust',
    slug: 'real-time-tracking-customer-trust',
    category: 'Delivery Operations',
    readTime: '5 min read',
    title: 'How Real-Time Tracking Improves Customer Trust in Delivery Services',
    excerpt: 'Customers expect visibility from pickup to delivery.',
    image: UNSPLASH('1521737604893-d14cc237f11d'),
  },
  {
    id: 'delivery-delays-customer-impact',
    slug: 'delivery-delays-customer-impact',
    category: 'Customer Experience',
    readTime: '4 min read',
    title: 'Why Delivery Delays Hurt More Than You Think',
    excerpt: 'Understanding how delays affect customer satisfaction and brand loyalty.',
    image: UNSPLASH('1556740738-b6a63e27c4df'),
  },
  {
    id: 'reduce-failed-deliveries',
    slug: 'reduce-failed-deliveries',
    category: 'E-commerce',
    readTime: '6 min read',
    title: '5 Ways Online Stores Can Reduce Failed Deliveries',
    excerpt: 'Simple operational improvements that help businesses complete more successful deliveries.',
    image: UNSPLASH('1586880244406-556ebe35f282'),
  },
  {
    id: 'future-of-logistics-visibility',
    slug: 'future-of-logistics-visibility',
    category: 'Technology',
    readTime: '4 min read',
    title: 'The Future of Logistics Is Visibility',
    excerpt: 'How tracking, automation, and data are reshaping delivery operations.',
    image: UNSPLASH('1519389950473-47ba0277781c'),
  },
  {
    id: 'optimizing-inventory-flow',
    slug: 'optimizing-inventory-flow',
    category: 'Delivery Operations',
    readTime: '7 min read',
    title: 'Optimizing Inventory Flow for Faster Shipments',
    excerpt: 'Strategies to streamline stock handling and reduce order processing times.',
    image: UNSPLASH('1586528116311-ad8dd3c8310d'),
  },
  {
    id: 'green-logistics-carbon-footprint',
    slug: 'green-logistics-carbon-footprint',
    category: 'Industry News',
    readTime: '5 min read',
    title: 'Green Logistics: Reducing Carbon Footprint in Delivery',
    excerpt: 'Eco-friendly practices transforming the supply chain industry.',
    image: UNSPLASH('1466611653911-95081537e5b7'),
  },
  {
    id: 'ai-predictive-delivery-management',
    slug: 'ai-predictive-delivery-management',
    category: 'Courier Management',
    readTime: '6 min read',
    title: 'Leveraging AI for Predictive Delivery Management',
    excerpt: 'How artificial intelligence anticipates demand and reduces delays.',
    image: UNSPLASH('1552664730-d307ca884978'),
  },
  {
    id: 'personalizing-delivery-notifications',
    slug: 'personalizing-delivery-notifications',
    category: 'Customer Experience',
    readTime: '5 min read',
    title: 'Personalizing Delivery Notifications to Enhance Engagement',
    excerpt: 'Techniques for crafting timely, relevant updates that delight customers.',
    image: UNSPLASH('1543269865-cbf427effbad'),
  },
  {
    id: 'rise-of-drone-deliveries',
    slug: 'rise-of-drone-deliveries',
    category: 'Technology',
    readTime: '4 min read',
    title: 'The Rise of Drone Deliveries: Opportunities and Challenges',
    excerpt: 'Exploring how aerial tech is reshaping last-mile solutions.',
    image: UNSPLASH('1508444845599-5c89863b1c44'),
  },
  {
    id: 'big-data-delivery-demand-forecast',
    slug: 'big-data-delivery-demand-forecast',
    category: 'Industry News',
    readTime: '6 min read',
    title: 'Using Big Data to Forecast Delivery Demand',
    excerpt: 'Harnessing analytics to optimize routes and resource allocation.',
    image: UNSPLASH('1454165804606-c3d57bc86b40'),
  },
  {
    id: 'cross-border-shipping-regulations',
    slug: 'cross-border-shipping-regulations',
    category: 'Delivery Operations',
    readTime: '5 min read',
    title: 'Cross-Border Shipping: Navigating Complex Regulations',
    excerpt: 'Key tips for efficient international delivery compliance.',
    image: UNSPLASH('1494412651409-8963ce7935a7'),
  },
  {
    id: 'returns-management-customer-loyalty',
    slug: 'returns-management-customer-loyalty',
    category: 'E-commerce',
    readTime: '7 min read',
    title: 'Enhancing Returns Management to Boost Customer Loyalty',
    excerpt: 'Best practices for smooth and hassle-free product returns.',
    image: UNSPLASH('1600880292203-757bb62b4baf'),
  },
];
