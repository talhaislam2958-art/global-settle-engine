export type OrderRow = {
  id: string;
  order_id: string;
  buyer_username: string | null;
  buyer_real_name: string | null;
  status: string;
  trade_type: string | null;
  fiat_amount: number;
  fiat_currency: string;
  asset: string;
  crypto_amount: number;
  unit_price: number | null;
  payment_method: string | null;
  released: boolean;
  released_at: string | null;
  payment_verified: boolean;
  order_created_at: string | null;
  created_at: string;
};

export type SmsRow = {
  id: string;
  raw_text: string;
  sender: string | null;
  payer_name: string | null;
  receiver_name: string | null;
  reference_id: string | null;
  amount: number | null;
  match_status: string;
  matched_order_id: string | null;
  matched_buyer_username: string | null;
  action_taken: string | null;
  created_at: string;
};

export type LogRow = {
  id: string;
  level: string;
  event_type: string;
  message: string;
  created_at: string;
};

export type PaymentMethodRow = {
  id: string;
  country: string;
  method_type: string;
  bank_name: string;
  account_name: string;
  account_number: string | null;
  iban: string | null;
  notes: string | null;
  is_active: boolean;
};

export type BotStateSettings = {
  country: string;
  bot_running: boolean;
  auto_release: boolean;
  binance_connected: boolean;
  binance_api_key_masked: string | null;
  telegram_connected: boolean;
  telegram_chat_id: string | null;
  webhook_token: string;
  last_poll_at: string | null;
  last_poll_status: string | null;
};

export type BotState = {
  settings: BotStateSettings;
  payment_methods: PaymentMethodRow[];
  orders: OrderRow[];
  sms_logs: SmsRow[];
  system_logs: LogRow[];
};
