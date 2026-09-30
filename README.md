# Order Guardian Cloud

Build a comprehensive, production-ready full-stack web application and automation bot that is fully hosted and maintained on Lovable AI’s own cloud infrastructure. It must run 24/7 on this cloud service automatically, ensuring that the bot remains active and processes orders even when the user's mobile device or computer is turned off.

1. Core Architecture & Infrastructure

 * 24/7 Cloud Hosting: The entire system must be deployed and hosted on Lovable AI's cloud service. No external server or local machine hosting should be required by the user.

 * Global Support: Must support all countries worldwide. When a user selects a specific country during setup, the system should dynamically load or allow configuration of that country's standard banking/payment methods.

 * Global & Local Payment Management: Options to add, configure, and save multiple bank accounts and payment gateways per country. When a buyer places an order, the system automatically sends the correct matching bank/payment details.

2. Dashboard & Controls

 * Master Switch: A prominent Start/Stop toggle to run or halt the bot's background automation engine within the cloud environment.

 * Auto-Release Toggle: An ON/OFF switch for automatic USDT release.

   * If ON: The system automatically releases USDT upon successful payment confirmation.

   * If OFF: The system holds the release and sends a Telegram notification instructing the merchant to release manually.

 * Binance API Configuration: Secure input fields to save, update, and test Binance API Key and Secret Key, ensuring the bot pulls data exclusively for the connected account.

 * Telegram Integration: Configuration settings for Telegram Bot Token and Chat ID to send instant alerts for new orders, payment confirmations, and manual release reminders.

3. Orders Management Section

The app must feature a dedicated Orders Section split into three main tabs/categories fetched via Binance P2P API. Every order listed here must explicitly display the official Binance Order ID and the exact buyer's username as registered on Binance:

 * Ongoing Orders: Orders where the buyer has placed the order but not yet marked it as paid.

 * Paid Orders: Orders where the buyer has marked the payment as sent.

 * Appeal Orders: Orders currently under dispute or appeal. (Manual handling for appeals; no automated third-party appeal logic).

4. SMS Logs & Webhook Verification Section

 * Dedicated SMS Logs Section: The application must include a dedicated section/tab to view all incoming payment SMS messages received via webhooks in real-time. This section will display the raw SMS text, sender/receiver names, TID/reference numbers, amounts, and explicitly link each received SMS to its corresponding Binance order ID and buyer username.

 * Webhook Listener: An endpoint to receive payment confirmation SMS data forwarded via webhooks (e.g., from Android SMS forwarders like MacroDroid).

 * Smart Matching Logic: When multiple buyers place orders simultaneously, the webhook engine matches incoming bank payment SMS data with pending/paid Binance orders based on:

   * Exact fiat transaction amount.

   * Buyer's legal name and account details matching Binance profile information.

 * Execution Workflow: Upon successful verification of the payment against the connected bank:

   * If the Auto-Release switch is ON, the bot triggers the Binance API to release the USDT to the buyer.

   * If the Auto-Release switch is OFF, it keeps the USDT locked and sends an immediate alert to Telegram ("Payment confirmed for Order ID. Please release USDT manually").

5. UI/UX Design

 * Clean, modern, responsive dashboard using Tailwind CSS and Lucide icons.

 * Real-time status indicators showing whether the bot is running (on the cloud), API connection status, and webhook health.

 * General system logs section to monitor real-time event tracking (incoming orders, webhook hits, matching

 results, and API responses).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://global-settle-engine.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9510dd28-7858-4f47-b3af-c0dce7454391).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
