/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Customer, CRMSettings } from "./types";

// Helper to calculate age from DOB
export function calculateAge(dobString: string): number {
  if (!dobString) return 0;
  const birthDate = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Helper to determine customer status based on total orders and total revenue
export function determineCustomerStatus(totalRevenue: number, totalOrders: number): 'New Customer' | 'Returning Customer' | 'Repeat Customer' | 'VIP Customer' {
  if (totalRevenue >= 15000 || totalOrders >= 5) {
    return "VIP Customer";
  } else if (totalOrders >= 3) {
    return "Repeat Customer";
  } else if (totalOrders >= 2) {
    return "Returning Customer";
  }
  return "New Customer";
}

// Initial customer database representing premium silver jewellery sales
export const initialCustomers: Customer[] = [
  {
    id: "TVB-1001",
    name: "Aisha Sharma",
    dob: "1994-06-03", // Birthday in 2 days from June 1, 2026!
    contactNumber: "+919876543210",
    whatsAppNumber: "+919876543210",
    email: "aisha.sharma@example.com",
    address: "APT 402, Signature Residency, Bandra West, Mumbai, MH - 400050",
    registrationDate: "2024-02-14",
    orderId: "ORD-94812",
    productName: "925 Sterling Silver Royal Halo Ring",
    productCategory: "Rings",
    orderAmount: 3450,
    orderDate: "2026-05-15",
    totalOrders: 4,
    totalRevenue: 13800,
    clv: 13800,
    lastPurchaseDate: "2026-05-15",
    status: "Repeat Customer",
    returnAmount: 450,
  },
  {
    id: "TVB-1002",
    name: "Priyanka Sen",
    dob: "1991-06-01", // Birthday Today (June 1st)!
    contactNumber: "+919112233445",
    whatsAppNumber: "+919112233445",
    email: "priyanka.sen@example.com",
    address: "42, Shanti Kunj, Gariahat, Kolkata, WB - 700019",
    registrationDate: "2023-11-05",
    orderId: "ORD-89401",
    productName: "Handcrafted Rose Gold Plated Silver Choker",
    productCategory: "Necklaces",
    orderAmount: 8900,
    orderDate: "2026-05-28",
    totalOrders: 6,
    totalRevenue: 27500,
    clv: 27500,
    lastPurchaseDate: "2026-05-28",
    status: "VIP Customer",
    returnAmount: 1800,
  },
  {
    id: "TVB-1003",
    name: "Meera Patel",
    dob: "1988-06-02", // Birthday Tomorrow (June 2nd)!
    contactNumber: "+919988776655",
    whatsAppNumber: "+919988776655",
    email: "meera.patel@example.com",
    address: "Block B, Regency Heights, Satellite, Ahmedabad, GJ - 380015",
    registrationDate: "2025-05-10",
    orderId: "ORD-51002",
    productName: "Regal Pearl Sterling Silver Studs",
    productCategory: "Earrings",
    orderAmount: 2200,
    orderDate: "2025-05-10",
    totalOrders: 1,
    totalRevenue: 2200,
    clv: 2200,
    lastPurchaseDate: "2025-05-10",
    status: "New Customer",
    returnAmount: 0,
  },
  {
    id: "TVB-1004",
    name: "Kavita Rao",
    dob: "1997-06-04", // Birthday in 3 days from June 1, 2026!
    contactNumber: "+918877665544",
    whatsAppNumber: "+918877665544",
    email: "kavita.rao@example.com",
    address: "10B, Silver Sands, Koramangala, Bengaluru, KA - 560034",
    registrationDate: "2024-08-20",
    orderId: "ORD-73012",
    productName: "Infinity Loop Premium Silver Anklet",
    productCategory: "Bracelets",
    orderAmount: 1850,
    orderDate: "2026-03-12",
    totalOrders: 2,
    totalRevenue: 3700,
    clv: 3700,
    lastPurchaseDate: "2026-03-12",
    status: "Returning Customer",
    returnAmount: 500,
  },
  {
    id: "TVB-1005",
    name: "Anjali Gupta",
    dob: "1995-12-05",
    contactNumber: "+917766554433",
    whatsAppNumber: "+917766554433",
    email: "anjali.gupta@example.com",
    address: "Penthouse C, Orchid Heights, Sector 54, Gurugram, HR - 122011",
    registrationDate: "2023-01-20",
    orderId: "ORD-93041",
    productName: "The Empress Solitaire Silver Tennis Bracelet",
    productCategory: "Bracelets",
    orderAmount: 12500,
    orderDate: "2026-05-02",
    totalOrders: 5,
    totalRevenue: 48000,
    clv: 48000,
    lastPurchaseDate: "2026-05-02",
    status: "VIP Customer",
    returnAmount: 0,
  }
];

export const defaultSettings: CRMSettings = {
  // Gemini settings
  geminiApiKey: "Injected Server-Side",
  geminiModel: "gemini-3.5-flash",
  aiEnabled: true,

  // WhatsApp settings
  whatsAppApiKey: "••••••••••••••••",
  whatsAppBusinessNumber: "+91 82345 67890",
  whatsAppProvider: "Meta Cloud API",

  // Twilio settings
  twilioAccountSid: "",
  twilioAuthToken: "",
  twilioFromNumber: "",

  // Email SMTP settings
  gmailConnected: true,
  smtpServer: "smtp.gmail.com",
  smtpPort: "465",
  smtpPassword: "",
  senderEmail: "orders@velvetboxs.com",
  senderName: "The Velvet Box Support",

  // Google Sheets sync settings
  googleSheetsId: "1pTVB_VelvetBox_CRM_SpreadsheetID_Example",
  googleSheetsName: "Sheet1",
  isSheetsSynced: true,
};
