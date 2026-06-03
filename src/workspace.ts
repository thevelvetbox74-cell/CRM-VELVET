/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { Customer } from './types';

// Check if Firebase is already initialized to avoid duplicate apps
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Scopes from OAuth setup
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/drive');

// In-memory caching for Access Token
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // If logged in but cache is empty, we must trigger sign-in or let the user fetch it again
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Workspace credentials');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Workspace Sign In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// --- Google Sheets API Helpers ---

/**
 * Creates a brand new Spreadsheet in Google Drive and pre-populates header row.
 */
export const createNewCrmSpreadsheet = async (): Promise<{ id: string; url: string }> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Unauthorized: No active Google credentials found.');

  // Create spreadsheet
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: 'Velvet Box CRM Patron Database'
      },
      sheets: [
        {
          properties: {
            title: 'Customer Directory'
          }
        }
      ]
    })
  });

  if (!res.ok) {
    const errObj = await res.json().catch(() => ({}));
    throw new Error(errObj?.error?.message || 'Failed to create sheet in Google Sheets.');
  }

  const sData = await res.json();
  const id = sData.spreadsheetId;
  const url = sData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${id}/edit`;

  // Pre-populate header columns
  const headers = [
    "Customer ID",
    "Name",
    "Date of Birth",
    "Contact Number",
    "WhatsApp Number",
    "Email",
    "Address",
    "Registration Date",
    "Last Order ID",
    "Last Product",
    "Product Category",
    "Last Order Amount",
    "Last Order Date",
    "Total Orders",
    "Total Revenue",
    "CLV",
    "Last Purchase Date",
    "Relationship Status"
  ];

  await writeSpreadsheetHeaders(id, 'Customer Directory', headers);

  return { id, url };
};

/**
 * Writes the header columns onto a specific spreadsheet & range.
 */
const writeSpreadsheetHeaders = async (sheetId: string, sheetName: string, headers: string[]) => {
  const token = await getAccessToken();
  const range = `${sheetName}!A1:R1`;
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: [headers]
    })
  });
  if (!res.ok) {
    console.error('Failed to write headers to Google Sheets');
  }
};

/**
 * Overwrites / Syncs all Local Customers into spreadsheet.
 */
export const syncCustomersToSheets = async (sheetId: string, sheetName: string, customers: Customer[]): Promise<void> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Unauthorized: Sign-in required.');

  const cleanSheetName = sheetName.trim() || 'Customer Directory';
  
  // Map customers to Google Sheet rows starting at row 2
  const values = customers.map(c => [
    c.id || '',
    c.name || '',
    c.dob || '',
    c.contactNumber || '',
    c.whatsAppNumber || '',
    c.email || '',
    c.address || '',
    c.registrationDate || '',
    c.orderId || '',
    c.productName || '',
    c.productCategory || '',
    c.orderAmount || 0,
    c.orderDate || '',
    c.totalOrders || 0,
    c.totalRevenue || 0,
    c.clv || 0,
    c.lastPurchaseDate || '',
    c.status || 'New Customer'
  ]);

  // Read range first, or clear down standard entries to ensure no hanging items
  const rangeToClear = `${cleanSheetName}!A2:R1000`;
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(rangeToClear)}:clear`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  // Write new customer list starting at A2
  const rangeToWrite = `${cleanSheetName}!A2:R${values.length + 1}`;
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(rangeToWrite)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range: rangeToWrite,
      majorDimension: 'ROWS',
      values
    })
  });

  if (!res.ok) {
    const errObj = await res.json().catch(() => ({}));
    throw new Error(errObj?.error?.message || 'Failed to update rows in Google Sheets.');
  }
};

/**
 * Imports customers from target Google Sheet.
 */
export const importCustomersFromSheets = async (sheetId: string, sheetName: string): Promise<Customer[]> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Unauthorized: Sign-in required.');

  const cleanSheetName = sheetName.trim() || 'Customer Directory';
  const range = `${cleanSheetName}!A2:R1000`; // Reading first 1000 records
  
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const errObj = await res.json().catch(() => ({}));
    throw new Error(errObj?.error?.message || 'Failed to retrieve spreadsheet payload.');
  }

  const payload = await res.json();
  const rows: any[][] = payload.values || [];

  return rows.map((r, index) => {
    const rowId = r[0] || `TVB-${1000 + (index + 1)}`;
    return {
      id: rowId,
      name: r[1] || `Patron ${index + 1}`,
      dob: r[2] || '1995-01-01',
      contactNumber: r[3] || '',
      whatsAppNumber: r[4] || '',
      email: r[5] || '',
      address: r[6] || '',
      registrationDate: r[7] || new Date().toISOString().split('T')[0],
      orderId: r[8] || '',
      productName: r[9] || '',
      productCategory: r[10] || 'Rings',
      orderAmount: parseFloat(r[11]) || 0,
      orderDate: r[12] || '',
      totalOrders: parseInt(r[13]) || 1,
      totalRevenue: parseFloat(r[14]) || 0,
      clv: parseFloat(r[15]) || 0,
      lastPurchaseDate: r[16] || '',
      status: (r[17] || 'New Customer') as any
    };
  });
};


// --- Gmail API Helpers ---

/**
 * Builds standard base64URL RFC2822 email format.
 */
const buildRawEmail = (to: string, subject: string, bodyText: string, htmlText?: string): string => {
  const boundary = "boundary_velvet_box_" + Date.now();
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ""
  ].join("\r\n");

  const parts = [];
  
  if (bodyText) {
    parts.push(
      `--${boundary}`,
      `Content-Type: text/plain; charset="utf-8"`,
      `Content-Transfer-Encoding: 7bit`,
      "",
      bodyText,
      ""
    );
  }

  if (htmlText) {
    parts.push(
      `--${boundary}`,
      `Content-Type: text/html; charset="utf-8"`,
      `Content-Transfer-Encoding: 7bit`,
      "",
      htmlText,
      ""
    );
  }

  parts.push(`--${boundary}--`);

  const rawMessage = headers + parts.join("\r\n");
  
  // Encode into MIME message (URL Safe Base64)
  const base64 = btoa(unescape(encodeURIComponent(rawMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
    
  return base64;
};

/**
 * Sends a real email using logged-in user's Gmail API.
 */
export const sendGmailMessage = async (to: string, subject: string, bodyText: string, htmlText?: string): Promise<string> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Unauthorized: Google account connection is missing.');

  const raw = buildRawEmail(to, subject, bodyText, htmlText);

  const res = await fetch('https://gmail.googleapis.com/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw })
  });

  if (!res.ok) {
    const errObj = await res.json().catch(() => ({}));
    throw new Error(errObj?.error?.message || 'Failed to dispatch Gmail broadcast.');
  }

  const sData = await res.json();
  return sData.id;
};

/**
 * Saves draft parameters inside user's Gmail drafts workspace.
 */
export const createGmailDraft = async (to: string, subject: string, bodyText: string, htmlText?: string): Promise<string> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Unauthorized: Google account connection is missing.');

  const raw = buildRawEmail(to, subject, bodyText, htmlText);

  const res = await fetch('https://gmail.googleapis.com/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: { raw }
    })
  });

  if (!res.ok) {
    const errObj = await res.json().catch(() => ({}));
    throw new Error(errObj?.error?.message || 'Failed to record Gmail draft copy.');
  }

  const sData = await res.json();
  return sData.id;
};


// --- Google Drive API Helpers ---

/**
 * Scans user's Google Drive for existing spreadsheet templates.
 */
export const listDriveSpreadsheets = async (): Promise<Array<{ id: string; name: string }>> => {
  const token = await getAccessToken();
  if (!token) return [];

  const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=name&pageSize=40`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.files || [];
};

/**
 * Backs up entire local CRM database structure into Google Drive.
 */
export const backupDbToDrive = async (jsonData: string, filename: string): Promise<{ id: string; url: string }> => {
  const token = await getAccessToken();
  if (!token) throw new Error('Unauthorized: Sign-in required.');

  // Create file metadata
  const metaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: filename,
      mimeType: 'application/json'
    })
  });

  if (!metaRes.ok) {
    const errObj = await metaRes.json().catch(() => ({}));
    throw new Error(errObj?.error?.message || 'Failed to design Drive backup file.');
  }

  const fileMeta = await metaRes.json();
  const fileId = fileMeta.id;

  // Upload file text / media data
  const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: jsonData
  });

  if (!uploadRes.ok) {
    throw new Error('Failed to transmit binary database backup upload to Drive.');
  }

  return {
    id: fileId,
    url: `https://drive.google.com/open?id=${fileId}`
  };
};
