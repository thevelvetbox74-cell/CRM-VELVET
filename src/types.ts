/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CustomerStatus = 'New Customer' | 'Returning Customer' | 'Repeat Customer' | 'VIP Customer';

export interface Customer {
  id: string; // Auto Generated TVB-XXXX
  name: string;
  dob: string; // YYYY-MM-DD
  contactNumber: string;
  whatsAppNumber: string;
  email: string;
  address: string;
  registrationDate: string; // YYYY-MM-DD
  orderId: string;
  productName: string;
  productCategory: string; // Rings, Earrings, Necklaces, Bracelets, Silver Coins, etc.
  orderAmount: number;
  orderDate: string; // YYYY-MM-DD
  totalOrders: number;
  totalRevenue: number;
  clv: number; // Customer Lifetime Value (total revenue)
  lastPurchaseDate: string; // YYYY-MM-DD
  status: CustomerStatus;
  returnAmount: number;
}

export interface CRMSettings {
  // Gemini AI Settings
  geminiApiKey: string;
  geminiModel: string;
  aiEnabled: boolean;

  // WhatsApp Integration
  whatsAppApiKey: string;
  whatsAppBusinessNumber: string;
  whatsAppProvider: string;

  // Twilio Integration
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFromNumber: string;

  // Email Integration
  gmailConnected: boolean;
  smtpServer: string;
  smtpPort: string;
  smtpPassword: string;
  senderEmail: string;
  senderName: string;

  // Google Sheets integration configuration
  googleSheetsId: string;
  googleSheetsName: string;
  isSheetsSynced: boolean;
}

export interface DashboardStats {
  totalCustomers: number;
  newCustomersCount: number;
  returningCustomersCount: number;
  vipCustomersCount: number;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  upcomingBirthdaysCount: number;
  topCategories: { category: string; value: number }[];
  topProducts: { product: string; revenue: number; count: number }[];
}

export interface DirectMessageDrafts {
  sms: string;
  whatsApp: string;
  email: string;
}
