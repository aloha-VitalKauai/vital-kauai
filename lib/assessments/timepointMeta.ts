export const TIMEPOINT_META: Record<string, {
  label: string;
  description: string;
  order: number;
}> = {
  baseline: {
    label: 'Baseline',
    description: 'Your starting point \u2014 the before picture.',
    order: 1,
  },
  post_72h: {
    label: '72 hours after ceremony',
    description: 'Early stabilisation \u2014 how you are landing.',
    order: 2,
  },
  post_1m: {
    label: '1 month after ceremony',
    description: 'One month of life with the medicine.',
    order: 3,
  },
  post_3m: {
    label: '3 months after ceremony',
    description: 'The durability check \u2014 most predictive timepoint.',
    order: 4,
  },
  post_6m: {
    label: '6 months after ceremony',
    description: 'Six months \u2014 the fuller story.',
    order: 5,
  },
  post_12m: {
    label: '12 months after ceremony',
    description: 'One year. What has lasted.',
    order: 6,
  },
};
