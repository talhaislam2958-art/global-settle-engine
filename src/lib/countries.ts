// Client-safe country + payment-method catalogue.

export type CountryDef = {
  code: string;
  name: string;
  currency: string;
  methods: string[];
};

const GENERIC_METHODS = ["Bank Transfer", "Wire Transfer", "Cash Deposit", "Other"];

export const COUNTRIES: CountryDef[] = [
  { code: "PK", name: "Pakistan", currency: "PKR", methods: ["Easypaisa", "JazzCash", "Bank Transfer (IBFT)", "Raast", "NayaPay", "SadaPay", "HBL", "Meezan Bank", "UBL", "Alfalah"] },
  { code: "IN", name: "India", currency: "INR", methods: ["UPI", "IMPS", "NEFT", "Paytm", "PhonePe", "Google Pay", "Bank Transfer"] },
  { code: "BD", name: "Bangladesh", currency: "BDT", methods: ["bKash", "Nagad", "Rocket", "Bank Transfer"] },
  { code: "AE", name: "United Arab Emirates", currency: "AED", methods: ["Bank Transfer", "ENBD", "ADCB", "Careem Pay", "Wio"] },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", methods: ["Bank Transfer", "STC Pay", "Al Rajhi", "SNB"] },
  { code: "NG", name: "Nigeria", currency: "NGN", methods: ["Bank Transfer", "Opay", "Kuda", "Palmpay", "Moniepoint"] },
  { code: "KE", name: "Kenya", currency: "KES", methods: ["M-Pesa", "Airtel Money", "Bank Transfer"] },
  { code: "EG", name: "Egypt", currency: "EGP", methods: ["Vodafone Cash", "InstaPay", "Bank Transfer"] },
  { code: "TR", name: "Türkiye", currency: "TRY", methods: ["Papara", "Ziraat", "Garanti", "IBAN Transfer"] },
  { code: "ID", name: "Indonesia", currency: "IDR", methods: ["BCA", "Mandiri", "BRI", "DANA", "OVO", "GoPay"] },
  { code: "PH", name: "Philippines", currency: "PHP", methods: ["GCash", "Maya", "BDO", "BPI", "InstaPay"] },
  { code: "VN", name: "Vietnam", currency: "VND", methods: ["Vietcombank", "Techcombank", "MoMo", "ZaloPay"] },
  { code: "GB", name: "United Kingdom", currency: "GBP", methods: ["Faster Payments", "Revolut", "Monzo", "Wise", "Bank Transfer"] },
  { code: "US", name: "United States", currency: "USD", methods: ["Zelle", "ACH", "Cash App", "Wire Transfer", "PayPal"] },
  { code: "EU", name: "Eurozone", currency: "EUR", methods: ["SEPA", "SEPA Instant", "Revolut", "Wise", "N26"] },
  { code: "BR", name: "Brazil", currency: "BRL", methods: ["PIX", "TED", "Bank Transfer"] },
  { code: "AR", name: "Argentina", currency: "ARS", methods: ["Mercado Pago", "CVU Transfer", "Bank Transfer"] },
  { code: "RU", name: "Russia", currency: "RUB", methods: ["Sberbank", "Tinkoff", "SBP", "Raiffeisen"] },
  { code: "UA", name: "Ukraine", currency: "UAH", methods: ["Monobank", "PrivatBank", "Bank Transfer"] },
  { code: "ZA", name: "South Africa", currency: "ZAR", methods: ["Capitec", "FNB", "Standard Bank", "Bank Transfer"] },
  { code: "GH", name: "Ghana", currency: "GHS", methods: ["MTN MoMo", "Vodafone Cash", "Bank Transfer"] },
  { code: "MA", name: "Morocco", currency: "MAD", methods: ["Bank Transfer", "CIH", "Attijariwafa"] },
  { code: "MY", name: "Malaysia", currency: "MYR", methods: ["Maybank", "CIMB", "DuitNow", "Touch 'n Go"] },
  { code: "TH", name: "Thailand", currency: "THB", methods: ["PromptPay", "SCB", "Kasikorn"] },
  { code: "CN", name: "China", currency: "CNY", methods: ["Alipay", "WeChat Pay", "Bank Card"] },
  { code: "JP", name: "Japan", currency: "JPY", methods: ["Bank Transfer", "PayPay"] },
  { code: "KR", name: "South Korea", currency: "KRW", methods: ["Bank Transfer", "KakaoPay"] },
  { code: "AU", name: "Australia", currency: "AUD", methods: ["PayID", "Osko", "Bank Transfer"] },
  { code: "CA", name: "Canada", currency: "CAD", methods: ["Interac e-Transfer", "Bank Transfer"] },
  { code: "MX", name: "Mexico", currency: "MXN", methods: ["SPEI", "Oxxo", "Bank Transfer"] },
  { code: "OTHER", name: "Other / Worldwide", currency: "USD", methods: GENERIC_METHODS },
];

export function getCountry(code: string): CountryDef {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[COUNTRIES.length - 1]!;
}

export function methodsFor(code: string): string[] {
  const country = getCountry(code);
  return [...country.methods, ...GENERIC_METHODS.filter((m) => !country.methods.includes(m))];
}
