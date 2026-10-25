export const PAYMENT_ACCOUNT = {
  accountName: 'Goodshare intercontinental ventures',
  bankName: 'Jaiz Bank Plc',
  accountNumber: '0021748767',
  currency: 'NGN',
} as const;

/**
 * Global crypto subscription deposit details.
 * This address accepts USDT on Ethereum mainnet (ERC-20) only.
 */
export const USDT_ERC20_PAYMENT = {
  asset: 'USDT',
  network: 'Ethereum (ERC-20)',
  walletAddress: '0xe19b37c772c367495f8af1a375093b50f2ea00b0',
} as const;
