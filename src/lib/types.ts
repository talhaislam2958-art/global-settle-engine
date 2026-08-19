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
  match_ambiguous?: boolean;
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
  agent_token: string;
  agent_online: boolean;
  agent_last_seen_at: string | null;
  agent_version: string | null;
  poll_interval_seconds: number;
  notify_new_order: boolean;
  notify_paid: boolean;
  notify_appeal: boolean;
  notify_release: boolean;
  notify_sms: boolean;
  notify_ambiguity: boolean;
};

export type AutomationTaskRow = {
  id: string;
  task_type: string;
  order_id: string;
  buyer_username: string | null;
  status: string;
  result: string | null;
  attempts: number;
  created_at: string;
  finished_at: string | null;
};

export type BotState = {
  settings: BotStateSettings;
  payment_methods: PaymentMethodRow[];
  orders: OrderRow[];
  sms_logs: SmsRow[];
  system_logs: LogRow[];
  automation_tasks: AutomationTaskRow[];
};

