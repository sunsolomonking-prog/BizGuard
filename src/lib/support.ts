export const BIZGUARD_SUPPORT = {
  phone: '07050480997',
  email: 'goodshareintercontinentalventures@hotmail.com',
} as const;

export const buildSupportMailto = (subject: string, body = '') =>
  `mailto:${BIZGUARD_SUPPORT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
