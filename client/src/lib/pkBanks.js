/* Pakistani banks and mobile wallets for the "Bank & wallet accounts" editor. People can still type a name that is not here. */
export const PK_BANKS = [
  'Allied Bank Limited (ABL)', 'Askari Bank', 'Bank Alfalah', 'Bank Al Habib', 'Bank of Khyber (BOK)', 'Bank of Punjab (BOP)',
  'BankIslami Pakistan', 'Citibank Pakistan', 'Dubai Islamic Bank Pakistan', 'Faysal Bank', 'First Women Bank',
  'Habib Bank Limited (HBL)', 'Habib Metropolitan Bank', 'JS Bank', 'MCB Bank', 'MCB Islamic Bank', 'Meezan Bank',
  'National Bank of Pakistan (NBP)', 'Samba Bank', 'Silk Bank', 'Sindh Bank', 'SME Bank', 'Soneri Bank',
  'Standard Chartered Pakistan', 'Summit Bank', 'United Bank Limited (UBL)', 'Zarai Taraqiati Bank (ZTBL)',
  'Al Baraka Bank Pakistan', 'Bank of China Pakistan', 'Industrial and Commercial Bank of China (ICBC)',
  'Advans Pakistan Microfinance Bank', 'Apna Microfinance Bank', 'FINCA Microfinance Bank', 'HBL Microfinance Bank',
  'Khushhali Microfinance Bank', 'Mobilink Microfinance Bank (JazzCash)', 'NRSP Microfinance Bank',
  'Telenor Microfinance Bank (Easypaisa)', 'U Microfinance Bank (U Paisa)', 'Kashf Microfinance Bank',
];

export const PK_WALLETS = [
  'Easypaisa', 'JazzCash', 'SadaPay', 'NayaPay', 'Zindigi (JS Bank)', 'U Paisa', 'Konnect by HBL', 'SimSim (Bank Alfalah)',
  'Finja', 'Mobicash', 'PayMax', 'Keenu', 'Raast ID', 'Meezan Mobile', 'UBL Omni', 'HBL Konnect', 'Paysys', 'Binance Pay',
];

const WALLET_SET = new Set(PK_WALLETS.map((x) => x.toLowerCase()));
/** 'wallet' when the typed name is one of the known wallets, 'bank' otherwise */
export const kindOf = (name) => (WALLET_SET.has(String(name || '').trim().toLowerCase()) ? 'wallet' : 'bank');
