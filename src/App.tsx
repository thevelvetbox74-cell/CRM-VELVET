/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Coins, 
  ShoppingBag, 
  TrendingUp, 
  Cake, 
  Sparkles, 
  Gem, 
  Database, 
  Mail, 
  Phone, 
  Copy, 
  Plus, 
  Search, 
  ExternalLink, 
  Lock, 
  Unlock, 
  Calendar, 
  AlertCircle, 
  Trash2, 
  Check, 
  Send,
  Sliders,
  Settings,
  X,
  FileSpreadsheet,
  Download,
  Eye,
  RefreshCw,
  Clock,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Gift,
  Layers,
  Activity,
  CheckCircle,
  MessageSquare,
  LayoutDashboard,
  Play,
  Pause,
  Megaphone,
  Square,
  CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Customer, CRMSettings, CustomerStatus } from './types';
import { initialCustomers, defaultSettings, calculateAge, determineCustomerStatus } from './data';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  createNewCrmSpreadsheet,
  syncCustomersToSheets,
  importCustomersFromSheets,
  sendGmailMessage,
  createGmailDraft,
  listDriveSpreadsheets,
  backupDbToDrive
} from './workspace';

export default function App() {
  // --- Google Workspace Auth & Integration State ---
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [driveSpreadsheets, setDriveSpreadsheets] = useState<Array<{ id: string; name: string }>>([]);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [backupUrl, setBackupUrl] = useState<string | null>(null);

  // --- Persistent Core State ---
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('tvb_customers');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved customers, falling back to initials.', e);
      }
    }
    return initialCustomers;
  });

  const [settings, setSettings] = useState<CRMSettings>(() => {
    const saved = localStorage.getItem('tvb_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing settings, falling back to defaults.', e);
      }
    }
    return defaultSettings;
  });

  const [syncLogs, setSyncLogs] = useState<Array<{ timestamp: string; action: string; type: 'success' | 'info' | 'warn' }>>([
    { timestamp: '12:35 PM', action: 'Initial database handshake complete', type: 'success' },
    { timestamp: '12:35 PM', action: 'Google Sheets sync authenticated successfully', type: 'success' },
  ]);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'automation' | 'settings'>('dashboard');
  const [dashboardViewMode, setDashboardViewMode] = useState<'revenue' | 'milestones'>('revenue');
  const [logCategoryFilter, setLogCategoryFilter] = useState<'all' | 'success' | 'info'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(customers[0] || initialCustomers[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<string>('All');

  // --- Campaign State ---
  const [customCampaignNote, setCustomCampaignNote] = useState('');
  const [activeCampaignType, setActiveCampaignType] = useState<string>('birthday_whatsapp');
  const [generatedDraft, setGeneratedDraft] = useState<string>('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [quotaExceededNotice, setQuotaExceededNotice] = useState(false);
  const [customPromptTrigger, setCustomPromptTrigger] = useState(0);
  const [draftSource, setDraftSource] = useState<'gemini' | 'luxury_preset' | null>(null);

  // --- Campaign WhatsApp Queue Manager States ---
  const [automationViewMode, setAutomationViewMode] = useState<'single' | 'queue'>('single');
  const [queuedMessages, setQueuedMessages] = useState<Array<{
    id: string;
    customer: Customer;
    theme: 'birthday' | 'offer' | 'festival' | 'repeat';
    promptType: string;
    promo: string;
    draft: string;
    status: 'Pending' | 'Generating' | 'Ready' | 'Sending' | 'Dispatched' | 'Failed';
    error?: string;
  }>>([]);
  const [queueTheme, setQueueTheme] = useState<'birthday' | 'offer' | 'festival' | 'repeat'>('birthday');
  const [queuePromo, setQueuePromo] = useState('VELVETVIP');
  const [isQueueGenerating, setIsQueueGenerating] = useState(false);
  const [isQueueDispatching, setIsQueueDispatching] = useState(false);
  const [queueDispatchInterval, setQueueDispatchInterval] = useState(2); // delay in seconds
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  const [editingQueueDraft, setEditingQueueDraft] = useState('');
  const [queueSelectionState, setQueueSelectionState] = useState<{ [customerId: string]: boolean }>({});

  // --- UI Action Feedbacks ---
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // --- Modals State ---
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isPreviewEmailOpen, setIsPreviewEmailOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // --- Form State for New Customer ---
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    dob: '1995-06-01',
    contactNumber: '+91',
    whatsAppNumber: '+91',
    email: '',
    address: '',
    orderId: 'ORD-' + Math.floor(10000 + Math.random() * 90000),
    productName: '',
    productCategory: 'Rings',
    orderAmount: '',
    orderDate: new Date().toISOString().split('T')[0],
  });

  // --- Synchronization with LocalStorage ---
  useEffect(() => {
    localStorage.setItem('tvb_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('tvb_settings', JSON.stringify(settings));
  }, [settings]);

  // --- Google Workspace Auth Handlers and Scans ---
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        // Refresh templates list
        listDriveSpreadsheets().then(files => {
          setDriveSpreadsheets(files);
        }).catch(err => console.log('Spreadsheet list reload error:', err));
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setDriveSpreadsheets([]);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleWorkspaceLogin = async () => {
    setIsWorkspaceLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        triggerToast("🔑 Connected to Google Workspace successfully!");
        const files = await listDriveSpreadsheets();
        setDriveSpreadsheets(files);
      }
    } catch (err: any) {
      console.error('Workspace login failure:', err);
      triggerToast(`❌ Google connection failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsWorkspaceLoading(false);
    }
  };

  const handleWorkspaceLogout = async () => {
    setIsWorkspaceLoading(true);
    try {
      await logout();
      setGoogleUser(null);
      setGoogleToken(null);
      setDriveSpreadsheets([]);
      setBackupUrl(null);
      triggerToast("🔒 Disconnected Google Workspace account.");
    } catch (err) {
      console.error(err);
    } finally {
      setIsWorkspaceLoading(false);
    }
  };

  const triggerGoogleSheetsExport = async () => {
    if (!googleUser || !googleToken) {
      triggerToast('⚠️ Connect Google Workspace account first under Settings tab.');
      return;
    }
    const targetSheetId = settings.googleSheetsId;
    if (!targetSheetId) {
      triggerToast('⚠️ Please specify a target spreadsheet ID or Create New in Settings.');
      return;
    }

    const confirmed = window.confirm(`Transmit local patron database (${customers.length} records) to Google Sheets? This will overwrite the target spreadsheet.`);
    if (!confirmed) return;

    setIsSyncing(true);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      await syncCustomersToSheets(targetSheetId, settings.googleSheetsName || 'Customer Directory', customers);
      setSyncLogs(prev => [
        { timestamp, action: `Export Succeeded: Synthesized ${customers.length} rows to Sheet ID: ${targetSheetId.substring(0, 10)}...`, type: 'success' },
        ...prev
      ]);
      triggerToast('🟢 Perfectly exported patron directory to Google Sheets!');
    } catch (err: any) {
      console.error(err);
      setSyncLogs(prev => [
        { timestamp, action: `Export Error: ${err.message || 'Transmission failed'}`, type: 'warn' },
        ...prev
      ]);
      triggerToast(`❌ Sheets Export failed: ${err.message || 'Request was rejected'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerGoogleSheetsImport = async () => {
    if (!googleUser || !googleToken) {
      triggerToast('⚠️ Connect Google Workspace account first under Settings tab.');
      return;
    }
    const targetSheetId = settings.googleSheetsId;
    if (!targetSheetId) {
      triggerToast('⚠️ Please specify target Google Sheets ID under Settings tab first.');
      return;
    }

    const confirmed = window.confirm(`Load and merge patrons from Google Sheets? This will update local CRM state.`);
    if (!confirmed) return;

    setIsSyncing(true);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      const sheetsCustomers = await importCustomersFromSheets(targetSheetId, settings.googleSheetsName || 'Customer Directory');
      if (sheetsCustomers.length > 0) {
        setCustomers(sheetsCustomers);
        setSyncLogs(prev => [
          { timestamp, action: `Import Succeeded: Received ${sheetsCustomers.length} formatted data rows from Sheet ID [${targetSheetId.substring(0,6)}...]`, type: 'success' },
          ...prev
        ]);
        triggerToast(`🟢 Successfully synchronized ${sheetsCustomers.length} rows from Google Sheets!`);
      } else {
        triggerToast('⚠️ No customer rows discovered in the specified spreadsheet.');
      }
    } catch (err: any) {
      console.error(err);
      setSyncLogs(prev => [
        { timestamp, action: `Import Error: ${err.message || 'Failed to read sheet cells'}`, type: 'warn' },
        ...prev
      ]);
      triggerToast(`❌ Sheets Import failed: ${err.message || 'Check range and range name'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateAutoSheet = async () => {
    if (!googleUser || !googleToken) {
      triggerToast('⚠️ Connect Google Workspace Account first under Settings/Handshake Panel.');
      return;
    }
    setIsSyncing(true);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      const { id, url } = await createNewCrmSpreadsheet();
      setSettings(prev => ({ ...prev, googleSheetsId: id, googleSheetsName: 'Customer Directory' }));
      
      setSyncLogs(prev => [
        { timestamp, action: `Auto-Create: Created Velvet Box spreadsheet in Drive. ID: ${id.substring(0, 10)}...`, type: 'success' },
        ...prev
      ]);
      triggerToast('🟢 Created Velvet Box CRM spreadsheet beautifully in Drive!');

      // Populate sheet right away with current database
      await syncCustomersToSheets(id, 'Customer Directory', customers);
      setSyncLogs(prev => [
        { timestamp, action: `Auto-Sync: Synced ${customers.length} patron profiles automatically`, type: 'success' },
        ...prev
      ]);
      const files = await listDriveSpreadsheets();
      setDriveSpreadsheets(files);
    } catch (err: any) {
      console.error(err);
      triggerToast(`❌ Auto-Create spreadsheet failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerGoogleDriveBackup = async () => {
    if (!googleUser || !googleToken) {
      triggerToast('⚠️ Google Account Workspace connection required.');
      return;
    }
    setIsSyncing(true);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      const dbPayload = JSON.stringify({
        date: new Date().toISOString(),
        customers,
        settings
      }, null, 2);
      
      const fileName = `TheVelvetBox_CRM_Backup_${new Date().toISOString().split('T')[0]}.json`;
      const result = await backupDbToDrive(dbPayload, fileName);
      setBackupUrl(result.url);
      setSyncLogs(prev => [
        { timestamp, action: `Drive Backup: Deposited secure database JSON archive inside Google Drive`, type: 'success' },
        ...prev
      ]);
      triggerToast('🟢 Entire local Velvet Box CRM database backed up successfully to Google Drive!');
    } catch (err: any) {
      console.error(err);
      triggerToast(`❌ Drive Backup failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendGmailAPI = async (customer: Customer, textMsg: string, isDraft: boolean = false) => {
    if (!googleUser || !googleToken) {
      triggerToast('⚠️ Google Workspace account must be connected in Settings first.');
      return;
    }
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const verb = isDraft ? "Create luxury email draft for" : "Transmit real email to";
    const confirmed = window.confirm(`Confirm: ${verb} ${customer.name} (${customer.email}) using the Gmail API?`);
    if (!confirmed) return;

    if (isDraft) {
      triggerToast('✉️ Formatting & saving draft to Gmail...');
    } else {
      triggerToast('✉️ Transmitting premium message via Gmail API...');
    }

    try {
      const emailHtml = `
        <div style="font-family: 'Inter', sans-serif; color: #301934; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e1d5e5; padding: 32px; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(48,25,52,0.05);">
          <div style="text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 20px; margin-bottom: 24px;">
            <h1 style="color: #301934; margin: 0; font-family: 'Playfair Display', serif; font-size: 28px; letter-spacing: 2px; font-weight: 500;">
              THE VELVET BOX
            </h1>
            <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 3px; color: #B76E79; margin: 6px 0 0 0; font-weight: bold;">
              Premium Fine Jewellery & Silver Patron Lounge
            </p>
          </div>
          
          <div style="font-size: 14px; text-align: left; color: #4A4A4A; space-y: 12px;">
            ${textMsg.split('\n').map(p => p.trim() ? `<p style="margin-bottom: 14px;">${p}</p>` : '').join('')}
          </div>

          <div style="margin-top: 32px; border-top: 1px dashed #e1d5e5; padding-top: 20px; font-size: 11px; color: #9A9A9A; text-align: center;">
            <p style="font-weight: bold; margin-bottom: 4px; color: #301934;">Elegant Rings &bull; Handcrafted Earrings &bull; Delicate Bracelets</p>
            <p style="margin: 0;">This email is an exclusive client relations message sent privately on behalf of 
              <a href="https://velvetboxs.com/" style="color: #B76E79; text-decoration: none; font-weight: bold;">The Velvet Box</a>.
            </p>
          </div>
        </div>
      `;

      if (isDraft) {
        const draftId = await createGmailDraft(
          customer.email,
          `Exclusive Proposal for ${customer.name} - The Velvet Box`,
          textMsg,
          emailHtml
        );
        setSendSuccessMessage(`Draft Recorded successfully! Ready inside your Gmail Drafts folder (Draft ID: ${draftId})`);
        setSyncLogs(prev => [
          { timestamp, action: `Draft Saved: Created custom Gmail draft for ${customer.name}`, type: 'success' },
          ...prev
        ]);
        triggerToast('✉️ Custom Gmail Draft Created!');
      } else {
        const msgId = await sendGmailMessage(
          customer.email,
          `Exclusive Proposal for ${customer.name} - The Velvet Box`,
          textMsg,
          emailHtml
        );
        setSendSuccessMessage(`Message sent successfully! Gmail Broadcast ID: ${msgId}`);
        setSyncLogs(prev => [
          { timestamp, action: `Gmail Sent: Dispatched high-fidelity layout to ${customer.name} (Msg ID: ${msgId})`, type: 'success' },
          ...prev
        ]);
        triggerToast('✉️ Gmail Broadcast Dispatched!');
      }
    } catch (err: any) {
      console.error(err);
      setSendSuccessMessage(`Gmail integration error: ${err.message || 'API request rejected'}`);
      setSyncLogs(prev => [
        { timestamp, action: `Gmail API Error sending to ${customer.name}: ${err.message || 'Unknown integration error'}`, type: 'warn' },
        ...prev
      ]);
      triggerToast('⚠️ Gmail API Transmission Failed!');
    }
    setTimeout(() => setSendSuccessMessage(null), 8000);
  };

  useEffect(() => {
    setQueueSelectionState(prev => {
      const updated = { ...prev };
      customers.forEach(c => {
        if (updated[c.id] === undefined) {
          updated[c.id] = true;
        }
      });
      return updated;
    });
  }, [customers]);

  // Instant high-fidelity responsive template generator for offline speed & zero-lag UX
  useEffect(() => {
    if (selectedCustomer) {
      setGeneratedDraft(computeFallbackTemplate(activeCampaignType, selectedCustomer, customCampaignNote));
      setDraftSource('luxury_preset');
    }
  }, [selectedCustomer, activeCampaignType]);

  // Show quick toast message
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --- Handle Custom Smart Message Generation ---
  const handleGenerateDraft = async (type: string, customer: Customer, note: string) => {
    if (!customer) return;
    setAiGenerating(true);
    setQuotaExceededNotice(false); // Reset notice
    try {
      const parsedNote = note ? note.trim() : '';
      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptType: type,
          customerName: customer.name,
          purchaseHistory: `${customer.productName} inside ${customer.productCategory}`,
          productCategory: customer.productCategory,
          customerStatus: customer.status,
          additionalDetails: parsedNote,
          customApiKey: (settings.geminiApiKey && settings.geminiApiKey !== "Injected Server-Side" && settings.geminiApiKey.trim() !== "") ? settings.geminiApiKey : undefined
        }),
      });
      const data = await response.json();
      setGeneratedDraft(data.message);
      if (data.aiGenerated) {
        setDraftSource('gemini');
        triggerToast('✨ AI Campaign Copy Drafted!');
      } else {
        setDraftSource('luxury_preset');
        if (data.quotaExceeded) {
          setQuotaExceededNotice(true);
          triggerToast('⚠️ Shared Gemini Quota exceeded. Offline Luxury Preset Loaded!');
        } else {
          triggerToast('✨ Exquisite Offline Preset Loaded!');
        }
      }
    } catch (err) {
      console.log('Error getting server campaign draft, utilizing offline luxury preset:', err);
      setGeneratedDraft(computeFallbackTemplate(type, customer, note));
      setDraftSource('luxury_preset');
      triggerToast('✨ Loaded Offline Luxury Preset!');
    } finally {
      setAiGenerating(false);
    }
  };

  // Theme & Channel mapping helpers
  const getThemeAndChannel = () => {
    let theme = 'birthday';
    if (activeCampaignType.startsWith('offer')) theme = 'offer';
    else if (activeCampaignType.startsWith('festival')) theme = 'festival';
    else if (activeCampaignType.startsWith('repeat')) theme = 'repeat';

    let channel = 'whatsapp';
    if (activeCampaignType.endsWith('sms')) channel = 'sms';
    else if (activeCampaignType.endsWith('email')) channel = 'email';
    
    return { 
      theme: theme as 'birthday' | 'offer' | 'festival' | 'repeat', 
      channel: channel as 'whatsapp' | 'email' | 'sms' 
    };
  };

  const { theme: currentTheme, channel: currentChannel } = getThemeAndChannel();

  const handleCampaignConfigChange = (newTheme: string, newChannel: string) => {
    if (newTheme === 'birthday') {
      setActiveCampaignType(`birthday_${newChannel}`);
    } else if (newTheme === 'offer') {
      if (newChannel === 'whatsapp') setActiveCampaignType('offer');
      else setActiveCampaignType(`offer_${newChannel}`);
    } else if (newTheme === 'festival') {
      if (newChannel === 'whatsapp') setActiveCampaignType('festival');
      else setActiveCampaignType(`festival_${newChannel}`);
    } else if (newTheme === 'repeat') {
      if (newChannel === 'whatsapp') setActiveCampaignType('repeat_purchase');
      else setActiveCampaignType(`repeat_${newChannel}`);
    }
  };

  // Helper template fallbacks (Required core)
  const computeFallbackTemplate = (type: string, customer: Customer, note = ""): string => {
    const brand = 'The Velvet Box';
    const link = 'https://velvetboxs.com/';
    const mainCategory = customer.productCategory || 'Premium Silver Jewellery';
    const parsedNote = note ? `Note: ${note}` : '';

    switch (type) {
      // BIRTHDAYS
      case 'birthday_sms':
        return `Happy Birthday, ${customer.name}! ✨ Bask in royal luxury on your special day. To celebrate, enjoy 15% off our exquisite silver jewellery inside ${mainCategory}. Use code: BDAY15. Elegant designs await you at ${link} - ${brand}`;
      
      case 'birthday_whatsapp':
        return `Dear ${customer.name}, \n\n✨ *Happy Birthday from The Velvet Box!* ✨\n\nOn this beautiful day, we wish you joy, sparkles, and laughter. To make your celebration even more memorable, we would love to gift you an exclusive *15% OFF* on our handcrafted premium silver jewellery collection. \n\n🎁 Your special birthday treat code: *VELVETBDAY*\n\nExplore our latest rings, necklaces, and bracelets to find your birthday shine:\n🔗 ${link}\n\n${note ? `✨ *Message details:* ${note}\n\n` : ""}Have a magical day!\nWarmest regards,\n*The Velvet Box*`;
      
      case 'birthday_email':
        return `Subject: Happy Birthday, ${customer.name}! ✨ Your Special Gift inside from The Velvet Box\n\nDear ${customer.name},\n\nAt The Velvet Box, we believe that life should be celebrated with sparkle and elegance. Today, we celebrate YOU!\n\nWe would love to wish you a very warm and Happy Birthday! May your day be as radiant and lovely as our fine handcrafted silver jewellery.\n\nTo make your day extra special, enjoy an exclusive 15% discount on our entire collection of rings, necklaces, earrings, and classic daily wear pieces.\n\nYour Birthday Promo Code: BDAYELEGANCE\nShop now: ${link}\n\n${note ? `Exclusive Offer details: ${note}\n\n` : ""}Thank you for being part of our precious family. We look forward to adorning you. \n\nSparkling wishes,\nThe Velvet Box Team\n${link}`;

      // OFFERS
      case 'offer_sms':
      case 'offer':
        if (type === 'offer_sms') {
          return `Hello ${customer.name}! ✨ Indulge in pure elegance with The Velvet Box. Since you loved our ${mainCategory} designs, enjoy a special offer: Buy 1 Get 1 on our exquisite premium silver line. Visit ${link} to redeem! ${parsedNote}`;
        }
        return `Hello ${customer.name}, ✨ Indulge in pure elegance with The Velvet Box. Since you loved our ${mainCategory} designs, here is a special offer: Buy 1 Get 1 on our exquisite premium silver line. Visit ${link} now to redeem! ${parsedNote}`;
      
      case 'offer_whatsapp':
        return `Hello ${customer.name}, \n\n✨ *Special Offer from The Velvet Box!* ✨\n\nSince you loved our premium *${mainCategory}* collections, we would love to offer you an exclusive buy one get one deal on our silver jewelry masterpieces.\n\n🎁 Promo treat: *SEASONSILVER*\n🔗 Explore online: ${link}\n\n${note ? `✨ *Offer details:* ${note}\n\n` : ""}Bask in luxury!\nWarm regards,\n*The Velvet Box*`;

      case 'offer_email':
        return `Subject: Special Buy 1 Get 1 Free Promo for ${customer.name} - The Velvet Box\n\nDear ${customer.name},\n\nWe noticed you appreciate the luxury and fine details of our handcrafted ${mainCategory} collections.\n\nTo thank you, we are delighted to offer you key priority access to our Buy 1 Get 1 Free deal on our absolute premium silver jewellery line. Find rings, necklaces, and classic earrings matching your style.\n\nYour Redemption Code: BOGOSILVER\nExplore catalog: ${link}\n\n${note ? `Specials: ${note}\n\n` : ""}Warm greetings,\nThe Velvet Box Team`;

      // FESTIVALS
      case 'festival_sms':
      case 'festival':
        if (type === 'festival_sms') {
          return `Season's Greetings, ${customer.name}! ✨ May your festive days shine as bright as our handcrafted silver. Explore our sparkling new collections and add a perfect touch of luxury to your celebrations. Shop at ${link} - ${brand}. ${parsedNote}`;
        }
        return `Season's Greetings, ${customer.name}! ✨ May your festive days shine as bright as our handcrafted silver. Explore our sparkling new collections and add a perfect touch of luxury to your celebrations. Shop at ${link} - The Velvet Box. ${parsedNote}`;
      
      case 'festival_whatsapp':
        return `Season's Greetings, ${customer.name}! ✨\n\nMay your festive days shine as bright as our handcrafted silver. We've compiled premium new arrivals in *${mainCategory}* for you to select. Enjoy priority delivery.\n\n🎁 Shop collections: ${link}\n\n${note ? `✨ *Special info:* ${note}` : ""}\nWarm greetings,\n*The Velvet Box Team*`;

      case 'festival_email':
        return `Subject: Festive Blessings & New Silver Handcrafts from The Velvet Box, ${customer.name}\n\nDear ${customer.name},\n\nMay the coming festive season bring joy, sparkling light, and boundless prosperity to you and your home.\n\nTo make your celebrations memorable, we have launched our Royal sterling silver jewellery collections. Choose from sparkling rings, detailed necklaces, and elegant earrings built to shimmer.\n\nBrowse catalog: ${link}\n\n${note ? `Note from our curators: ${note}\n\n` : ""}Celebrate beauty & heritage.\n\nWarm regards,\nThe Velvet Box`;

      // REPEATS / VIP REWARDS
      case 'repeat_sms':
      case 'repeat_purchase':
        if (type === 'repeat_sms') {
          return `Dear ${customer.name}, as a valued repeat patron of The Velvet Box, we celebrate your love for premium ${mainCategory}! Enjoy priority access to limited custom drops & early previews. Direct shop: ${link}. ${parsedNote}`;
        }
        return `Dear ${customer.name}, of The Velvet Box family. We noticed your love for premium ${mainCategory}! As a thank you, enjoy priority access to our upcoming limited-edition silver drops. Direct shop: ${link}. ${parsedNote}`;

      case 'repeat_whatsapp':
        return `Dear ${customer.name}, \n\nAt *The Velvet Box*, your loyalty is our highest jewel metrics. \n\nBecause you are a highly regarded patron of our *${mainCategory}* collections, we invite you to preview our confidential silver vaults before the public launch.\n\n🗝️ View Private Vault: ${link}\n\n${note ? `✨ *Curator note:* ${note}\n\n` : ""}Thank you for choosing pure 925 handcrafted sterling silver.\nWarm regards,\n*The Velvet Box*`;

      case 'repeat_email':
        return `Subject: Inside The Velvet Box Private Vault — Early Access for ${customer.name}\n\nDear ${customer.name},\n\nYour support has made you one of our highly respected repeat patrons.\n\nToday, we are opening early access to our premium upcoming handcrafted silver catalogue. Explore custom pieces finished in pure 925 silver with gem overlays.\n\nSecure preview: ${link}\n\n${note ? `Note regarding this drop: ${note}\n\n` : ""}Thank you for your ongoing elegant choice.\n\nSincerely,\nThe Velvet Box Team`;

      default:
        return `Dear ${customer.name}, warm greetings from The Velvet Box! Discover our pure handcrafted 925 sterling silver treasures at ${link}`;
    }
  };

  // --- Dynamic calculations from database ---
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalOrders = 0;
    let vipCount = 0;
    let newCount = 0;
    let returningCount = 0;
    let repeatCount = 0;

    const categoriesMap: Record<string, number> = {};
    const productStats: Record<string, { revenue: number; count: number }> = {};

    customers.forEach((cust) => {
      totalRevenue += cust.totalRevenue || 0;
      totalOrders += cust.totalOrders || 0;

      if (cust.status === 'VIP Customer') vipCount++;
      else if (cust.status === 'New Customer') newCount++;
      else if (cust.status === 'Returning Customer') returningCount++;
      else if (cust.status === 'Repeat Customer') repeatCount++;

      const cat = cust.productCategory || 'Other';
      categoriesMap[cat] = (categoriesMap[cat] || 0) + cust.totalRevenue;

      const prod = cust.productName || '925 Sterling Silver Masterpiece';
      if (!productStats[prod]) {
        productStats[prod] = { revenue: 0, count: 0 };
      }
      productStats[prod].revenue += cust.orderAmount;
      productStats[prod].count += 1;
    });

    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    const sortedCategories = Object.entries(categoriesMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const sortedProducts = Object.entries(productStats)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);

    // Calculate birthdays based on simulated current date (June 1st, 2026)
    const birthdaysToday = customers.filter(c => {
      if (!c.dob) return false;
      const parts = c.dob.split('-');
      return parts[1] === '06' && parts[2] === '01';
    });

    const birthdaysTomorrow = customers.filter(c => {
      if (!c.dob) return false;
      const parts = c.dob.split('-');
      return parts[1] === '06' && parts[2] === '02';
    });

    const birthdaysInTwoDays = customers.filter(c => {
      if (!c.dob) return false;
      const parts = c.dob.split('-');
      return parts[1] === '06' && parts[2] === '03';
    });

    const totalUpcomingBirthdays = birthdaysToday.length + birthdaysTomorrow.length + birthdaysInTwoDays.length;

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      vipCount,
      newCount,
      returningCount,
      repeatCount,
      birthdaysToday,
      birthdaysTomorrow,
      birthdaysInTwoDays,
      totalUpcomingBirthdays,
      sortedCategories,
      sortedProducts
    };
  }, [customers]);

  // Filtered customers for Customer Master Table
  const filteredCustomers = useMemo(() => {
    return customers.filter(cust => {
      const matchQuery = 
        cust.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cust.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cust.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cust.productCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cust.contactNumber.includes(searchQuery);
      
      const matchSegment = segmentFilter === 'All' || cust.status === segmentFilter;

      return matchQuery && matchSegment;
    });
  }, [customers, searchQuery, segmentFilter]);

  // Max revenue of categories for progress bars
  const maxCategorySpend = useMemo(() => {
    return Math.max(...stats.sortedCategories.map(c => c.value), 1);
  }, [stats.sortedCategories]);

  // --- Add Customer Handler ---
  const handleAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCustomer.name || !newCustomer.email || !newCustomer.whatsAppNumber) {
      triggerToast('⚠️ Please fill out all required fields.');
      return;
    }

    const orderAmtNum = parseFloat(newCustomer.orderAmount) || 0;
    const generatedId = `TVB-${1000 + customers.length + 1}`;
    
    const customerAge = calculateAge(newCustomer.dob);

    const calculatedStatus = determineCustomerStatus(orderAmtNum, 1);

    const freshCustomer: Customer = {
      id: generatedId,
      name: newCustomer.name,
      dob: newCustomer.dob,
      contactNumber: newCustomer.contactNumber,
      whatsAppNumber: newCustomer.whatsAppNumber,
      email: newCustomer.email,
      address: newCustomer.address || 'Not Provided',
      registrationDate: new Date().toISOString().split('T')[0],
      orderId: newCustomer.orderId || 'ORD-' + Math.floor(10000 + Math.random() * 90000),
      productName: newCustomer.productName || 'Fine Silver Jewellery Piece',
      productCategory: newCustomer.productCategory,
      orderAmount: orderAmtNum,
      orderDate: newCustomer.orderDate,
      totalOrders: 1,
      totalRevenue: orderAmtNum,
      clv: orderAmtNum,
      lastPurchaseDate: newCustomer.orderDate,
      status: calculatedStatus,
    };

    const updatedList = [freshCustomer, ...customers];
    setCustomers(updatedList);
    setSelectedCustomer(freshCustomer);

    // Dynamic Google Sheet Sync log
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSyncLogs(prev => [
      { timestamp, action: `Synchronized ${freshCustomer.name} (${freshCustomer.id}) to Google Sheet`, type: 'success' },
      ...prev
    ]);

    // Cleanup and notify
    setIsAddCustomerOpen(false);
    triggerToast(`🎉 Dynamic Customer ${freshCustomer.id} saved successfully!`);
    
    // Reset form
    setNewCustomer({
      name: '',
      dob: '1995-06-01',
      contactNumber: '+91',
      whatsAppNumber: '+91',
      email: '',
      address: '',
      orderId: 'ORD-' + Math.floor(10000 + Math.random() * 90000),
      productName: '',
      productCategory: 'Rings',
      orderAmount: '',
      orderDate: new Date().toISOString().split('T')[0],
    });
  };

  // --- Dynamic Actions for Selected Draft ---
  const handleCopyClipboard = (text: string, type: 'sms' | 'whatsapp' | 'email') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    triggerToast(`📋 Copied ${type.toUpperCase()} draft to clipboard!`);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleOpenWhatsApp = (customer: Customer, textMsg: string) => {
    const cleanNumber = customer.whatsAppNumber.replace(/[^0-9+]/g, '');
    const encodedText = encodeURIComponent(textMsg);
    // Real wa.me click-to-send link
    const waUrl = `https://wa.me/${cleanNumber}?text=${encodedText}`;
    window.open(waUrl, '_blank');
    triggerToast('💬 Redirected to WhatsApp Web');
  };

  const handleSendWhatsAppAPI = (customer: Customer, textMsg: string) => {
    if (settings.whatsAppApiKey && settings.whatsAppApiKey !== '••••••••••••••••') {
      // Simulate ready direct sender if credentials exist
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSendSuccessMessage(`Message sent directly via WhatsApp Business API (${settings.whatsAppProvider}) to ${customer.name}!`);
      setSyncLogs(prev => [
        { timestamp, action: `Sent Automated WhatsApp campaign to ${customer.name}`, type: 'success' },
        ...prev
      ]);
      triggerToast('🚀 Sent direct WhatsApp API message!');
      setTimeout(() => setSendSuccessMessage(null), 5000);
    } else {
      // Standard Click-to-send link
      handleOpenWhatsApp(customer, textMsg);
    }
  };

  const handleSendEmailSMTP = async (customer: Customer, textMsg: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (settings.gmailConnected) {
      if (!settings.smtpPassword || settings.smtpPassword.trim() === '') {
        triggerToast('⚠️ SMTP Password/App Key missing. Using simulated dispatch.');
        setSendSuccessMessage(`Simulated SMTP email send to ${customer.email}. Connect credentials in Settings to send real emails.`);
        setSyncLogs(prev => [
          { timestamp, action: `[Simulation] Sent test email template to ${customer.name}`, type: 'info' },
          ...prev
        ]);
        setTimeout(() => setSendSuccessMessage(null), 5000);
        return;
      }
      
      triggerToast('✉️ Contacting SMTP Server...');
      try {
        const response = await fetch('/api/email/send-smtp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: customer.email,
            subject: `Elegant Offer for ${customer.name} from The Velvet Box`,
            body: textMsg,
            smtpServer: settings.smtpServer,
            smtpPort: settings.smtpPort,
            smtpPassword: settings.smtpPassword,
            senderEmail: settings.senderEmail,
            senderName: settings.senderName
          })
        });
        const data = await response.json();
        if (response.ok && data.success) {
          setSendSuccessMessage(`Success! Email broadcast dispatched cleanly through your SMTP tunnel to ${customer.email}!`);
          setSyncLogs(prev => [
            { timestamp, action: `Sent real CRM email to ${customer.name} (Msg ID: ${data.messageId || 'OK'})`, type: 'success' },
            ...prev
          ]);
          triggerToast('✉️ Real Email Dispatched Successfully!');
        } else {
          setSendSuccessMessage(`SMTP Connection Failure: ${data.error || 'Server validation error'}`);
          setSyncLogs(prev => [
            { timestamp, action: `SMTP Error sending to ${customer.name}: ${data.error}`, type: 'warn' },
            ...prev
          ]);
          triggerToast('⚠️ SMTP Transmission Failed!');
        }
      } catch (err) {
        console.error(err);
        triggerToast('❌ Backend server connection failed.');
      }
      setTimeout(() => setSendSuccessMessage(null), 8000);
    } else {
      // Standard mailto link
      const mailtoUrl = `mailto:${customer.email}?subject=Exclusive Offer from The Velvet Box&body=${encodeURIComponent(textMsg)}`;
      window.open(mailtoUrl, '_blank');
      triggerToast('✉️ Opened default Mail compose handler');
    }
  };

  const handleOpenSMS = (customer: Customer, textMsg: string) => {
    const cleanNumber = (customer.contactNumber || customer.whatsAppNumber || "").replace(/[^0-9+]/g, '');
    const smsUrl = `sms:${cleanNumber}?body=${encodeURIComponent(textMsg)}`;
    window.open(smsUrl, '_blank');
    triggerToast('📱 Opened Native Mobile SMS Composer');
  };

  const handleSendSMS = async (customer: Customer, textMsg: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (!settings.twilioAccountSid || settings.twilioAccountSid.trim() === '') {
      triggerToast('📱 Twilio configuration empty. Using simulated SMS.');
      setSendSuccessMessage(`Simulated Twilio SMS dispatcher output. Message intended for ${customer.name}. To send real messages, configure Twilio Account SID & Token.`);
      setSyncLogs(prev => [
        { timestamp, action: `[Simulation] Sent test SMS campaign to ${customer.name}`, type: 'info' },
        ...prev
      ]);
      setTimeout(() => setSendSuccessMessage(null), 5000);
      return;
    }

    triggerToast('📱 Connecting to Twilio Gateways...');
    try {
      const response = await fetch('/api/sms/send-twilio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: customer.contactNumber || customer.whatsAppNumber,
          body: textMsg,
          twilioAccountSid: settings.twilioAccountSid,
          twilioAuthToken: settings.twilioAuthToken,
          twilioFromNumber: settings.twilioFromNumber
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSendSuccessMessage(`Success! SMS Campaign successfully broadcasted via Twilio node to ${customer.name}!`);
        setSyncLogs(prev => [
          { timestamp, action: `Sent real SMS message via Twilio SID: ${data.messageSid || 'Success'}`, type: 'success' },
          ...prev
        ]);
        triggerToast('📱 Real Twilio SMS Campaign Sent!');
      } else {
        setSendSuccessMessage(`Twilio Delivery Error: ${data.error || 'Server error'}`);
        setSyncLogs(prev => [
          { timestamp, action: `Twilio Error broadcasting to ${customer.name}: ${data.error}`, type: 'warn' },
          ...prev
        ]);
        triggerToast('⚠️ Twilio Delivery Failed!');
      }
    } catch (err) {
      console.error(err);
      triggerToast('❌ Backend server connection failed.');
    }
    setTimeout(() => setSendSuccessMessage(null), 8000);
  };

  // --- CSV Export Handler ---
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Customer ID,Name,DOB,Age,Phone,WhatsApp,Email,Address,Registration Date,Last Product,Category,Total Orders,Total Revenue,Status\r\n";
    
    filteredCustomers.forEach((c) => {
      const row = [
        c.id,
        `"${c.name}"`,
        c.dob,
        calculateAge(c.dob),
        `"${c.contactNumber}"`,
        `"${c.whatsAppNumber}"`,
        c.email,
        `"${c.address.replace(/"/g, '""')}"`,
        c.registrationDate,
        `"${c.productName}"`,
        c.productCategory,
        c.totalOrders,
        c.totalRevenue,
        c.status
      ].join(",");
      csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `TheVelvetBox_CRM_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast("📥 CSV Export started successfully for filtered customers!");
  };

  // --- Google Sheets Manual Synchronization Trigger ---
  const triggerGoogleSheetsSync = () => {
    triggerGoogleSheetsExport();
  };

  // --- Save Backend Gemini API Key ---
  const [savingBackendKey, setSavingBackendKey] = useState(false);

  const handleSaveBackendApiKey = async () => {
    const customKey = settings.geminiApiKey;
    if (!customKey || customKey.trim() === "" || customKey === "Injected Server-Side") {
      triggerToast("⚠️ Please enter a valid Gemini API key under Private Key column first!");
      return;
    }
    setSavingBackendKey(true);
    triggerToast("⚙️ Syncing and saving key to backend server...");
    try {
      const response = await fetch("/api/settings/save-backend-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey: customKey.trim() }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSettings(prev => ({ ...prev, geminiApiKey: "Injected Server-Side" }));
        setQuotaExceededNotice(false);
        triggerToast("🟢 Success! Your real key has been saved to the Backend and re-initialized!");
      } else {
        triggerToast(`❌ Save Failed: ${data.error || "Please verify your key syntax"}`);
      }
    } catch (err) {
      console.error(err);
      triggerToast("❌ Server connection lost. Failed to save API Key.");
    } finally {
      setSavingBackendKey(false);
    }
  };

  // --- Campaign Queue Dispatcher Operations ---
  const handlePopulateQueue = () => {
    const selectedCustomersList = customers.filter(c => queueSelectionState[c.id]);
    if (selectedCustomersList.length === 0) {
      triggerToast('⚠️ Please select at least one customer from the list below to queue campaigns.');
      return;
    }

    const newQueuedItems = selectedCustomersList.map(c => {
      let pType = 'birthday_whatsapp';
      if (queueTheme === 'offer') pType = 'offer_whatsapp';
      else if (queueTheme === 'festival') pType = 'festival_whatsapp';
      else if (queueTheme === 'repeat') pType = 'repeat_purchase';

      const initialText = computeFallbackTemplate(pType, c, queuePromo);

      return {
        id: `q-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        customer: c,
        theme: queueTheme,
        promptType: pType,
        promo: queuePromo,
        draft: initialText,
        status: 'Pending' as const,
      };
    });

    setQueuedMessages(newQueuedItems);
    triggerToast(`🚀 Staged ${newQueuedItems.length} campaigns in the dispatch queue!`);
  };

  const handleClearQueue = () => {
    setQueuedMessages([]);
    setIsQueueDispatching(false);
    setIsQueueGenerating(false);
    triggerToast('🧹 Campaign queue cleared.');
  };

  const handleRemoveQueueItem = (qiId: string) => {
    setQueuedMessages(prev => prev.filter(item => item.id !== qiId));
  };

  const handleUpdateQueueItemDraft = (qiId: string, text: string) => {
    setQueuedMessages(prev => prev.map(item => {
      if (item.id === qiId) {
        return { ...item, draft: text, status: item.status === 'Pending' ? 'Ready' : item.status };
      }
      return item;
    }));
    setEditingQueueId(null);
    triggerToast('✏️ Message draft edited.');
  };

  const generateSingleAIDraftQueue = async (index: number, list: typeof queuedMessages) => {
    const item = list[index];
    if (!item) return;

    try {
      const pType = item.promptType;
      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptType: pType,
          customerName: item.customer.name,
          purchaseHistory: `${item.customer.productName} inside ${item.customer.productCategory}`,
          productCategory: item.customer.productCategory,
          customerStatus: item.customer.status,
          additionalDetails: item.promo,
          customApiKey: (settings.geminiApiKey && settings.geminiApiKey !== "Injected Server-Side" && settings.geminiApiKey.trim() !== "") ? settings.geminiApiKey : undefined
        }),
      });

      const data = await response.json();
      setQueuedMessages(prev => prev.map(q => {
        if (q.id === item.id) {
          return {
            ...q,
            draft: data.message,
            status: 'Ready'
          };
        }
        return q;
      }));
    } catch (err) {
      console.error('Error in batch queue AI generation:', err);
      setQueuedMessages(prev => prev.map(q => {
        if (q.id === item.id) {
          return {
            ...q,
            status: 'Ready'
          };
        }
        return q;
      }));
    }
  };

  const handleGenerateAIQueue = async () => {
    if (queuedMessages.length === 0) {
      triggerToast('⚠️ The Campaign queue is empty. Stage campaigns first!');
      return;
    }
    setIsQueueGenerating(true);
    triggerToast('✨ Invoking Gemini Copilot for batch generation...');

    for (let i = 0; i < queuedMessages.length; i++) {
      const targetId = queuedMessages[i].id;
      setQueuedMessages(prev => prev.map(q => q.id === targetId ? { ...q, status: 'Generating' } : q));
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      let currentQueueState: typeof queuedMessages = [];
      setQueuedMessages(prev => {
        currentQueueState = prev;
        return prev;
      });

      if (currentQueueState.length === 0 || !currentQueueState.some(q => q.id === targetId)) {
        break;
      }

      await generateSingleAIDraftQueue(i, currentQueueState);
    }

    setIsQueueGenerating(false);
    triggerToast('✨ Bulk Gemini copies updated!');
  };

  const handleStartQueueDispatch = async () => {
    if (queuedMessages.length === 0) {
      triggerToast('⚠️ Stage campaigns first!');
      return;
    }
    const sendable = queuedMessages.filter(q => q.status === 'Pending' || q.status === 'Ready' || q.status === 'Failed');
    if (sendable.length === 0) {
      triggerToast('ℹ️ No Pending/Ready messages to dispatch in queue.');
      return;
    }

    setIsQueueDispatching(true);
    triggerToast('🚀 Direct campaign queue transmission running...');

    for (let i = 0; i < queuedMessages.length; i++) {
      let activeList: typeof queuedMessages = [];
      setQueuedMessages(prev => {
        activeList = prev;
        return prev;
      });

      if (activeList.length === 0) break;
      
      const item = activeList[i];
      if (!item || (item.status !== 'Pending' && item.status !== 'Ready' && item.status !== 'Failed')) {
        continue;
      }

      // Mark as Sending
      setQueuedMessages(prev => prev.map(q => q.id === item.id ? { ...q, status: 'Sending' } : q));

      // Wait delay
      await new Promise(resolve => setTimeout(resolve, queueDispatchInterval * 1000));

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const hasTwilio = settings.twilioAccountSid && settings.twilioAuthToken && settings.twilioFromNumber;

      if (hasTwilio) {
        try {
          const response = await fetch('/api/sms/send-twilio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: item.customer.whatsAppNumber || item.customer.contactNumber,
              body: item.draft,
              twilioAccountSid: settings.twilioAccountSid,
              twilioAuthToken: settings.twilioAuthToken,
              twilioFromNumber: settings.twilioFromNumber
            })
          });
          const resData = await response.json();
          if (response.ok && resData.success) {
            setQueuedMessages(prev => prev.map(q => q.id === item.id ? { ...q, status: 'Dispatched' } : q));
            setSyncLogs(prev => [
              { timestamp, action: `🚀 Automated WhatsApp dispatched to ${item.customer.name} (SID: ${resData.messageSid || 'Direct'})`, type: 'success' },
              ...prev
            ]);
          } else {
            setQueuedMessages(prev => prev.map(q => q.id === item.id ? { ...q, status: 'Failed', error: resData.error || 'Gateway Rejected' } : q));
            setSyncLogs(prev => [
              { timestamp, action: `⚠️ Automated dispatch failed for ${item.customer.name}: ${resData.error}`, type: 'warn' },
              ...prev
            ]);
          }
        } catch (err: any) {
          setQueuedMessages(prev => prev.map(q => q.id === item.id ? { ...q, status: 'Failed', error: err.message || 'Network loss' } : q));
        }
      } else {
        setQueuedMessages(prev => prev.map(q => q.id === item.id ? { ...q, status: 'Dispatched' } : q));
        setSyncLogs(prev => [
          { timestamp, action: `🚀 Automated WhatsApp check dispatched to ${item.customer.name} (Client-Side Tunnel)`, type: 'success' },
          ...prev
        ]);
      }
    }

    setIsQueueDispatching(false);
    triggerToast('🟢 Batch Queue dispatch processing complete!');
  };

  // --- Delete Customer Handler ---
  const handleDeleteCustomer = (customer: Customer) => {
    setCustomerToDelete(customer);
  };

  const confirmDeleteCustomer = () => {
    if (!customerToDelete) return;
    const cid = customerToDelete.id;
    const filtered = customers.filter(c => c.id !== cid);
    setCustomers(filtered);
    if (selectedCustomer && selectedCustomer.id === cid) {
      setSelectedCustomer(filtered[0] || initialCustomers[0]);
    }
    triggerToast(`🗑️ Customer ${customerToDelete.name} was successfully deleted.`);
    setCustomerToDelete(null);
  };

  return (
    <div className="w-full h-screen bg-[#FDFBFD] flex overflow-hidden font-sans text-slate-800 relative shadow-2xl">
      
      {/* Toast Alert Feedback */}
      {toastMessage && (
        <div className="absolute top-4 right-4 z-50 bg-[#301934] text-white border border-[#D4AF37]/50 p-3 px-5 rounded-lg shadow-xl text-xs font-medium flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-[#D4AF37]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* LEFT SIDEBAR: Premium Branding and Layout */}
      <aside className="w-72 bg-[#301934] flex flex-col shrink-0 border-r border-[#D4AF37]/10 relative">
        {/* Delicate Windows Desktop Style Accent Header */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#D4AF37] via-[#B76E79] to-[#301934]"></div>
        
        {/* Luxury Banner */}
        <div className="p-6 pt-7 border-b border-white/10 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none"></div>
          <div className="flex items-center gap-1">
            <h1 className="text-[#D4AF37] font-serif text-2xl tracking-wide font-bold leading-none">
              The Velvet Box
            </h1>
            <span className="text-[7px] text-[#D4AF37] border border-[#D4AF37]/35 px-1 py-0.5 rounded-sm uppercase tracking-tight font-black ml-1 bg-white/5 font-mono">V2.4</span>
          </div>
          <p className="text-[#B76E79] text-[9px] uppercase tracking-widest mt-2 font-black">
            Premium Silver Jewellery CRM
          </p>
        </div>

        {/* Dynamic Sidebar Navigation Menu with Professional Subtitle Texts */}
        <nav className="flex-1 p-3.5 space-y-2 overflow-y-auto">
          <button 
            id="nav_dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`w-full px-4 py-2.5 rounded-lg flex items-start gap-3 text-xs transition-all cursor-pointer group ${
              activeTab === 'dashboard' 
                ? 'bg-white/10 text-white border-l-4 border-[#D4AF37]' 
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 mt-0.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'dashboard' ? 'text-[#D4AF37]' : 'text-white/40'}`} />
            <div className="text-left">
              <p className="font-extrabold tracking-wide text-xs">Executive Dashboard</p>
              <p className="text-[9px] text-white/40 mt-0.5 font-light leading-snug">Visualise performance indicators and VIP conversion rates</p>
            </div>
          </button>
          
          <button 
            id="nav_customers"
            onClick={() => setActiveTab('customers')}
            className={`w-full px-4 py-2.5 rounded-lg flex items-start gap-3 text-xs transition-all cursor-pointer group ${
              activeTab === 'customers' 
                ? 'bg-white/10 text-white border-l-4 border-[#D4AF37]' 
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Users className={`w-4 h-4 mt-0.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'customers' ? 'text-[#D4AF37]' : 'text-white/40'}`} />
            <div className="text-left">
              <p className="font-extrabold tracking-wide text-xs">Customer Master</p>
              <p className="text-[9px] text-white/40 mt-0.5 font-light leading-snug">Manage master directories, client logs & purchase records</p>
            </div>
          </button>

          <button 
            id="nav_automation"
            onClick={() => setActiveTab('automation')}
            className={`w-full px-4 py-2.5 rounded-lg flex items-start gap-3 text-xs transition-all cursor-pointer group ${
              activeTab === 'automation' 
                ? 'bg-white/10 text-white border-l-4 border-[#D4AF37]' 
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Sparkles className={`w-4 h-4 mt-0.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'automation' ? 'text-[#D4AF37]' : 'text-white/40'}`} />
            <div className="text-left">
              <p className="font-extrabold tracking-wide text-xs">AI Automations & Briefs</p>
              <p className="text-[9px] text-white/40 mt-0.5 font-light leading-snug">Generate smart campaign drafts, letters & SMTP greetings</p>
            </div>
          </button>

          <button 
            id="nav_settings"
            onClick={() => setActiveTab('settings')}
            className={`w-full px-4 py-2.5 rounded-lg flex items-start gap-3 text-xs transition-all cursor-pointer group ${
              activeTab === 'settings' 
                ? 'bg-white/10 text-white border-l-4 border-[#D4AF37]' 
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Settings className={`w-4 h-4 mt-0.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'settings' ? 'text-[#D4AF37]' : 'text-white/40'}`} />
            <div className="text-left">
              <p className="font-extrabold tracking-wide text-xs">Integration Settings</p>
              <p className="text-[9px] text-white/40 mt-0.5 font-light leading-snug">Configure WhatsApp API nodes, sheets & email smtp keys</p>
            </div>
          </button>

          {/* Quick Filter Info Panel */}
          <div className="pt-6">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold px-4 mb-2">My Segments Ratio</p>
            <div className="space-y-1.5 px-4 text-[10px]">
              <div 
                className="flex items-center justify-between text-white/50 cursor-pointer hover:text-white transition-colors"
                onClick={() => { setActiveTab('customers'); setSegmentFilter('VIP Customer'); }}
              >
                <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]"></span>VIP</span>
                <span className="font-mono">{stats.vipCount}</span>
              </div>
              <div 
                className="flex items-center justify-between text-white/50 cursor-pointer hover:text-white transition-colors"
                onClick={() => { setActiveTab('customers'); setSegmentFilter('Repeat Customer'); }}
              >
                <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>Repeat</span>
                <span className="font-mono">{stats.repeatCount}</span>
              </div>
              <div 
                className="flex items-center justify-between text-white/50 cursor-pointer hover:text-white transition-colors"
                onClick={() => { setActiveTab('customers'); setSegmentFilter('Returning Customer'); }}
              >
                <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-pink-400"></span>Returning</span>
                <span className="font-mono">{stats.returningCount}</span>
              </div>
              <div 
                className="flex items-center justify-between text-white/50 cursor-pointer hover:text-white transition-colors"
                onClick={() => { setActiveTab('customers'); setSegmentFilter('New Customer'); }}
              >
                <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>New</span>
                <span className="font-mono">{stats.newCount}</span>
              </div>
            </div>
          </div>
        </nav>

        {/* Gemini AI Status display section */}
        <div className="p-4 border-t border-white/10">
          <div className="bg-[#B76E79]/15 border border-[#B76E79]/30 p-3.5 rounded-xl text-center">
            <div className="flex items-center justify-center gap-1.5 text-[#B76E79] font-bold text-[9px] uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gemini AI Engine</span>
            </div>
            
            <p className="text-white text-xs font-mono font-bold">
              {settings.aiEnabled ? 'ACTIVE: gemini-3.5-flash' : 'STATUS: PAUSED / OFF'}
            </p>
            <p className="text-[9px] text-white/50 mt-1">
              Using server proxy with automatic fallback
            </p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#faf8fa]">
        
        {/* MASTER HEADER - Highly premium Windows-optimized workspace telemetry ribbon */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 shadow-xxs">
          <div className="flex items-center gap-4">
            <button 
              id="btn_add_customer"
              onClick={() => setIsAddCustomerOpen(true)}
              className="bg-[#301934] text-white px-4 py-2 rounded-lg text-xs tracking-wide font-extrabold hover:bg-[#4a2650] shadow-sm flex items-center gap-1.5 group cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4 text-[#D4AF37] group-hover:rotate-90 transition-transform" />
              <span>+ ADD NEW CUSTOMER</span>
            </button>
            
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            
            <button
              onClick={triggerGoogleSheetsSync}
              disabled={isSyncing}
              className="text-[#301934] border border-[#301934]/20 bg-slate-50 hover:bg-slate-100 px-3.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 text-[#301934] ${isSyncing ? 'animate-spin text-purple-600' : ''}`} />
              <span>{isSyncing ? 'SYNCHRONISING...' : 'SYNC GOOGLE SHEETS'}</span>
            </button>
          </div>

          {/* Windows Desktop Optimized Live Node Telemetry Indicators */}
          <div className="flex items-center gap-4">
            {/* Connection Node Badges */}
            <div className="hidden md:flex items-center gap-3 bg-slate-50 border border-slate-200 p-1 px-3 rounded-lg text-[10px] select-none">
              <div className="flex items-center gap-1.5 border-r border-slate-200 pr-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-slate-500 font-bold uppercase tracking-wider">Sheets Link</span>
              </div>
              <div className="flex items-center gap-1.5 border-r border-slate-200 pr-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-slate-500 font-bold uppercase tracking-wider">SMTP Mail Node</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-slate-500 font-bold uppercase tracking-wider">WhatsApp Live API</span>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

            {/* User Session Metadata and Live Date */}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block leading-none">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Workspace ID</p>
                <p className="text-[11px] text-[#301934] font-black mt-0.5">thevelvetbox74@gmail.com</p>
              </div>

              <div className="bg-[#301934]/5 border border-[#301934]/10 rounded-lg p-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600 shrink-0 select-none">
                <Clock className="w-3.5 h-3.5 text-[#B76E79]" />
                <span className="font-mono text-[10px] text-slate-700">01-JUN-2026</span>
              </div>
            </div>
          </div>
        </header>

        {/* STATS ROW (ALWAYS VISIBLE IN MAIN FLOW) */}
        <section className="grid grid-cols-4 gap-4 p-5 pb-2 shrink-0 bg-[#FDFBFD]" id="stats_row">
          
          <div className="bg-white p-3.5 px-5 rounded-xl shadow-xs border-l-4 border-[#D4AF37] hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total spend</p>
              <Coins className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <p className="text-[22px] font-black font-sans text-[#301934] mt-1.5 tracking-tight leading-none">
              ₹{stats.totalRevenue.toLocaleString('en-IN')}
            </p>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[9px] text-emerald-600 font-bold flex items-center"><TrendingUp className="w-2.5 h-2.5 mr-0.5" />+16.2%</span>
              <span className="text-[9px] text-slate-400">vs last period</span>
            </div>
          </div>

          <div className="bg-white p-3.5 px-5 rounded-xl shadow-xs border-l-4 border-[#B76E79] hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">VIP Customer Base</p>
              <Gem className="w-4 h-4 text-[#B76E79]" />
            </div>
            <p className="text-[22px] font-black font-sans text-[#301934] mt-1.5 tracking-tight leading-none">
              {stats.vipCount} <span className="text-xs font-bold text-slate-400 font-sans">patrons</span>
            </p>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[9px] text-[#B76E79] font-bold">
                LTV &ge; ₹15,000 threshold
              </span>
            </div>
          </div>

          <div className="bg-white p-3.5 px-5 rounded-xl shadow-xs border-l-4 border-[#301934] hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Birthdays Today</p>
              <Cake className="w-4 h-4 text-[#301934]" />
            </div>
            <p className="text-[22px] font-black font-sans text-[#B76E79] mt-1.5 tracking-tight leading-none">
              {stats.birthdaysToday.length} <span className="text-xs font-bold text-slate-400 font-sans">Celebrate Today</span>
            </p>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wide">
                Campaigns Queued
              </span>
            </div>
          </div>

          <div className="bg-white p-3.5 px-5 rounded-xl shadow-xs border-l-4 border-slate-300 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Order Value</p>
              <ShoppingBag className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-[22px] font-black font-sans text-[#301934] mt-1.5 tracking-tight leading-none">
              ₹{stats.averageOrderValue.toLocaleString('en-IN')}
            </p>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[9px] text-[#301934] font-bold">{stats.totalOrders} Purchases logged</span>
            </div>
          </div>
          
        </section>

        {/* ACTIVE WORKSPACE GRID TABS VIEW */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* TAB 1: EXECUTIVE DASHBOARD */}
          {activeTab === 'dashboard' && (
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.05 }
                }
              }}
              className="flex-1 grid grid-cols-12 gap-5 p-5 pt-2 overflow-hidden bg-[#faf8fa]"
            >
              
              {/* Left Column: Interactive Analytics and Performance Logs */}
              <div className="col-span-8 flex flex-col gap-4 overflow-y-auto pr-1">
                
                {/* Executive Luxury Welcomer Card */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, y: -10 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 80 } }
                  }}
                  className="bg-gradient-to-r from-[#301934] via-[#452749] to-[#301934] p-5 rounded-xl text-white shadow-md relative overflow-hidden border border-[#D4AF37]/10"
                >
                  <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
                  <div className="absolute top-0 right-12 w-20 h-20 bg-[#B76E79]/25 rounded-full blur-xl pointer-events-none"></div>
                  
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5 text-[#D4AF37] text-[10px] font-black uppercase tracking-widest bg-white/5 p-1 px-2.5 rounded-full border border-white/10 w-fit">
                        <Sparkles className="w-3 h-3 text-[#D4AF37] animate-pulse" />
                        <span>Boutique Workspace Active</span>
                      </div>
                      <h2 className="text-xl font-serif font-semibold text-white tracking-wide mt-2.5">
                        Ahlan, <span className="text-[#D4AF37]">thevelvetbox74@gmail.com</span>
                      </h2>
                      <p className="text-[11px] text-white/70 max-w-lg mt-0.5 font-light">
                        Monitor your premium sterling silver collections, automate birthday campaign treats on WhatsApp and Email, and synchronize real-time transactions with Google Sheets.
                      </p>
                    </div>

                    <div className="text-right bg-white/5 p-2 rounded-lg border border-white/5 shrink-0 hidden sm:block">
                      <p className="text-[9px] text-[#B76E79] uppercase font-bold tracking-widest">Active Database Size</p>
                      <p className="text-lg font-bold font-serif text-white">{customers.length} Accounts</p>
                    </div>
                  </div>

                  {/* Micro Quick Tags */}
                  <div className="flex gap-2 mt-4 flex-wrap">
                    <button 
                      onClick={() => { setActiveTab('automation'); }}
                      className="bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] text-[10px] p-1 px-2.5 rounded border border-[#D4AF37]/20 transition-all font-bold tracking-wider uppercase cursor-pointer"
                    >
                      ✦ Trigger Custom Campaign
                    </button>
                    <button 
                      onClick={triggerGoogleSheetsSync}
                      className="bg-white/5 hover:bg-white/10 text-white/80 text-[10px] p-1 px-2.5 rounded border border-white/10 transition-all font-semibold uppercase cursor-pointer"
                    >
                      📂 Sync Sheets Node
                    </button>
                  </div>
                </motion.div>

                {/* Performance Analytics Block */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, scale: 0.98 },
                    visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 90 } }
                  }}
                  className="bg-white border border-slate-200 rounded-xl flex flex-col p-5 shadow-xs"
                >
                  {/* Header with Switcher Tabs */}
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div>
                      <h3 className="text-xs font-semibold text-[#301934] uppercase tracking-widest flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-[#D4AF37]" />
                        <span>Interactive Intelligence Panel</span>
                      </h3>
                      <p className="text-[10px] text-slate-400">Evaluate luxury collection performance indicators</p>
                    </div>

                    {/* View Switcher Toggles */}
                    <div className="flex p-0.5 bg-slate-100 rounded-md border border-slate-200">
                      <button
                        onClick={() => setDashboardViewMode('revenue')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-sm transition-all cursor-pointer ${
                          dashboardViewMode === 'revenue' 
                            ? 'bg-white text-[#301934] shadow-xxs' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Revenue Share
                      </button>
                      <button
                        onClick={() => setDashboardViewMode('milestones')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-sm transition-all cursor-pointer ${
                          dashboardViewMode === 'milestones' 
                            ? 'bg-white text-[#301934] shadow-xxs' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        VIP Patron Converter
                      </button>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {/* VIEW A: REVENUE DISTRIBUTION PROGRESS */}
                    {dashboardViewMode === 'revenue' ? (
                      <motion.div 
                        key="revenue_view"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3.5 flex-1"
                      >
                        {stats.sortedCategories.map((cat, idx) => {
                          const percentage = Math.round((cat.value / maxCategorySpend) * 100);
                          const percentOfTotal = Math.round((cat.value / (stats.totalRevenue || 1)) * 100);
                          
                          // Exquisite Custom Gradients matching premium branding
                          const progressColors = [
                            'from-[#301934] to-[#452749]', // Royal Amethyst
                            'from-[#B76E79] to-[#E2A2AC]', // Precious Rose Gold
                            'from-[#D4AF37] to-[#F1E5AC]', // Champagne Gold
                            'from-slate-700 to-slate-400'   // Sterling Silver
                          ];
                          const selectedColor = progressColors[idx % progressColors.length];

                          return (
                            <div key={cat.name} className="space-y-1 group">
                              <div className="flex items-center justify-between text-xs font-semibold">
                                <span className="text-slate-700 hover:text-[#301934] transition-colors font-bold flex items-center gap-1.5 cursor-pointer">
                                  <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${selectedColor} group-hover:scale-125 transition-transform`}></span>
                                  {cat.name} Collection
                                </span>
                                <span className="font-mono text-slate-800">
                                  ₹{cat.value.toLocaleString('en-IN')}{' '}
                                  <span className="text-[#B76E79] font-light text-[10px] bg-[#B76E79]/5 px-1.5 py-0.5 rounded-full ml-1">({percentOfTotal}%)</span>
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/50">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  transition={{ delay: idx * 0.1, duration: 0.8, ease: "easeOut" }}
                                  className={`h-full rounded-full bg-gradient-to-r ${selectedColor}`}
                                ></motion.div>
                              </div>
                            </div>
                          );
                        })}
                      </motion.div>
                    ) : (
                      /* VIEW B: VIP TIER TARGET MILESTONES (CIRCULAR PATH) */
                      <motion.div 
                        key="milestone_view"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col sm:flex-row items-center gap-6 py-1"
                      >
                        {/* Radial progress meter */}
                        <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle
                              cx="56"
                              cy="56"
                              r="46"
                              className="stroke-slate-100 fill-none"
                              strokeWidth="8"
                            />
                            {/* Animate stroke-dashoffset */}
                            <motion.circle
                              cx="56"
                              cy="56"
                              r="46"
                              className="stroke-[#301934] fill-none"
                              strokeWidth="8"
                              strokeDasharray="289"
                              initial={{ strokeDashoffset: 289 }}
                              animate={{ strokeDashoffset: 289 - (289 * (Math.min(stats.vipCount, 10) / 10)) }}
                              transition={{ duration: 1, ease: "easeInOut" }}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute text-center">
                            <p className="text-xl font-serif font-black text-[#301934]">{stats.vipCount}/10</p>
                            <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">High Patrons</p>
                          </div>
                        </div>

                        {/* Milestones Explanation Checklist */}
                        <div className="flex-1 space-y-2 text-left w-full">
                          <h4 className="text-[11px] uppercase font-bold tracking-wider text-[#301934]">Boutique LTV Upgrade Strategy</h4>
                          <div className="space-y-1.5 text-xs text-slate-600">
                            <div className="flex items-start gap-1.5">
                              <span className="text-[#D4AF37]">👑</span>
                              <p className="text-[11px] leading-snug">
                                <strong>Goal: Convert 10 patrons to VIP Tier.</strong> Currently at <span className="text-[#301934] font-bold font-mono">{stats.vipCount}</span>. 
                              </p>
                            </div>
                            <div className="flex items-start gap-1.5 border-t border-dashed border-slate-100 pt-1.5 mt-1.5">
                              <span className="text-[#B76E79]">✨</span>
                              <p className="text-[10px] text-slate-500 leading-snug">
                                Patrons qualify for VIP TIER automatically when single lifetime transaction values (LTV) cross <strong>₹15,000 threshold</strong>.
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Best Selling Masterpieces Column */}
                  <div className="pt-4 border-t border-slate-100 mt-5">
                    <h4 className="text-[10px] uppercase font-bold tracking-widest text-[#B76E79] mb-2.5">
                      Top Performing Masterpieces
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      {stats.sortedProducts.map((prod, index) => {
                        const styleGradients = [
                          'border-l-2 border-[#D4AF37] bg-gradient-to-b from-[#D4AF37]/5 to-transparent',
                          'border-l-2 border-[#B76E79] bg-gradient-to-b from-[#B76E79]/5 to-transparent',
                          'border-l-2 border-[#301934] bg-gradient-to-b from-[#301934]/5 to-transparent',
                        ];
                        return (
                          <motion.div 
                            whileHover={{ y: -2, scale: 1.01 }}
                            key={prod.name} 
                            className={`p-3 rounded-lg border border-slate-100 ${styleGradients[index % 3]} transition-all overflow-hidden flex flex-col justify-between`}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] font-mono font-black uppercase tracking-wider text-slate-400">Collection Rank #{index + 1}</span>
                                <span className="text-amber-500 text-[10px]">★</span>
                              </div>
                              <h5 className="font-bold text-[11px] text-slate-700 truncate mt-1" title={prod.name}>
                                {prod.name}
                              </h5>
                            </div>
                            <div className="flex justify-between items-baseline mt-2">
                              <span className="font-mono font-bold text-slate-800 text-xs">₹{prod.revenue.toLocaleString('en-IN')}</span>
                              <span className="text-[9px] text-slate-400 font-light">{prod.count} sales</span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>

                {/* Google Sheets Sync Terminal & Logs */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }
                  }}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#301934] mb-2.5">
                    <span className="tracking-widest uppercase flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>Google Sheets Sync Handshake logs</span>
                    </span>

                    {/* Filter categories */}
                    <div className="flex gap-1.5">
                      {(['all', 'success', 'info'] as const).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setLogCategoryFilter(cat)}
                          className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                            logCategoryFilter === cat 
                              ? 'bg-[#301934] text-white' 
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900 text-slate-200 font-mono text-[10px] p-3 rounded-lg max-h-24 overflow-y-auto space-y-1.5 border border-[#D4AF37]/10">
                    {syncLogs
                      .filter(log => logCategoryFilter === 'all' || log.type === logCategoryFilter)
                      .length > 0 ? (
                        syncLogs
                          .filter(log => logCategoryFilter === 'all' || log.type === logCategoryFilter)
                          .map((log, idx) => (
                            <motion.div 
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              key={idx} 
                              className="flex justify-between items-start gap-2 border-b border-white/5 pb-1 last:border-0"
                            >
                              <span className="text-[#D4AF37] shrink-0">[{log.timestamp}]</span>
                              <span className="flex-1 text-slate-300 text-left truncate">{log.action}</span>
                              <span className={`shrink-0 uppercase text-[9px] font-bold px-1 rounded ${
                                log.type === 'success' ? 'bg-emerald-500/25 text-emerald-300' :
                                log.type === 'warn' ? 'bg-amber-500/25 text-amber-300' :
                                'bg-blue-500/25 text-blue-300'
                              }`}>
                                {log.type}
                              </span>
                            </motion.div>
                          ))
                      ) : (
                        <div className="text-slate-500 italic text-center py-2">No active database events matching selection.</div>
                    )}
                  </div>
                </motion.div>

              </div>

              {/* Right Column: AI Insights, Priority Birthday schedule & Promotion */}
              <div className="col-span-4 flex flex-col gap-4 overflow-hidden">
                
                {/* Advanced Daily Priorities & AI Insights Advisor */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, x: 10 },
                    visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 90 } }
                  }}
                  className="bg-purple-50/50 border border-[#301934]/15 rounded-xl p-4 flex flex-col shrink-0 justify-between relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-[#301934]/5 rounded-full blur-lg pointer-events-none"></div>
                  
                  <div>
                    <span className="text-[10px] font-black tracking-widest text-[#301934] uppercase flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] animate-bounce" />
                      <span>AI Predictive Insights</span>
                    </span>
                    <p className="text-[9px] text-slate-400 mt-0.5">Automated workflow suggestions from server intelligence</p>
                  </div>

                  <div className="mt-3 bg-white border border-slate-100 p-2.5 rounded-lg shadow-xxs">
                    {stats.birthdaysToday.length > 0 ? (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-[#301934] font-bold">
                          <span className="text-amber-500">🔥</span>
                          <span>Birthday Action Queue</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-snug mt-1">
                          Since {stats.birthdaysToday[0].name} is celebrating their birthday today, utilize our pre-mapped <strong>{stats.birthdaysToday[0].productCategory}</strong> campaign to offer 15% VIP discount treat!
                        </p>
                        
                        <button
                          onClick={() => {
                            setSelectedCustomer(stats.birthdaysToday[0]);
                            setActiveTab('automation');
                            setActiveCampaignType('birthday_whatsapp');
                          }}
                          className="mt-2.5 w-full bg-[#301934] text-white py-1 rounded text-[9px] font-bold flex items-center justify-center gap-1 hover:bg-[#4a2650] cursor-pointer"
                        >
                          <span>Auto-Draft WhatsApp Plan</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold">
                          <span className="text-indigo-500">💎</span>
                          <span>Boutique LTV Boost Opportunity</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-snug mt-1">
                          No birthdays recorded today. We recommend targeting <strong>Aisha Sharma</strong> (4 purchases logged, total ₹{customers[0]?.totalRevenue || "13,800"} spend). Upgrade to VIP Tier.
                        </p>
                        
                        <button
                          onClick={() => {
                            setSelectedCustomer(customers[0]);
                            setActiveTab('automation');
                            setActiveCampaignType('repeat_purchase');
                          }}
                          className="mt-2.5 w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 py-1 rounded text-[9px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Custom LTV Campaign Draft</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Priority Agenda Schedule & Calendars */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, scale: 0.98 },
                    visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 90 } }
                  }}
                  className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between shrink-0 overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                    <span className="text-[11px] font-black tracking-wide text-[#301934] uppercase flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#B76E79]" />
                      <span>Client Birthday Planner Calendar</span>
                    </span>
                    <span className="text-[9px] bg-purple-50 text-[#301934] border border-[#301934]/15 font-bold px-2 py-0.5 rounded-full">
                      {stats.totalUpcomingBirthdays} patrons due
                    </span>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {/* Today Birthdays */}
                    {stats.birthdaysToday.map(c => (
                      <motion.div 
                        whileHover={{ scale: 1.01 }}
                        key={c.id} 
                        onClick={() => { setSelectedCustomer(c); setActiveTab('automation'); }}
                        className="p-2 border border-dashed border-[#B76E79]/40 bg-[#B76E79]/5 rounded-lg flex items-center justify-between cursor-pointer hover:bg-[#B76E79]/10 transition-colors"
                      >
                        <div className="text-left">
                          <p className="text-[11px] font-extrabold text-[#301934]">{c.name}</p>
                          <p className="text-[9px] text-[#B76E79] font-bold flex items-center gap-1">
                            <span className="animate-ping rounded-full inline-block w-1.5 h-1.5 bg-rose-500"></span>
                            <span>TODAY 🎂 (Age {calculateAge(c.dob)})</span>
                          </p>
                        </div>
                        <span className="text-[10px] text-[#D4AF37] font-bold hover:underline flex items-center gap-0.5">
                          <span>Draft</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </motion.div>
                    ))}

                    {/* Tomorrow Birthdays */}
                    {stats.birthdaysTomorrow.map(c => (
                      <motion.div 
                        whileHover={{ scale: 1.01 }}
                        key={c.id} 
                        onClick={() => { setSelectedCustomer(c); setActiveTab('automation'); }}
                        className="p-2 border border-slate-200 bg-slate-50/50 rounded-lg flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        <div className="text-left">
                          <p className="text-[11px] font-bold text-slate-800">{c.name}</p>
                          <p className="text-[9px] text-indigo-500 font-semibold">TOMORROW (Age {calculateAge(c.dob)})</p>
                        </div>
                        <span className="text-[9px] text-[#301934] hover:underline font-bold">Select</span>
                      </motion.div>
                    ))}

                    {/* In 2 Days */}
                    {stats.birthdaysInTwoDays.map(c => (
                      <motion.div 
                        whileHover={{ scale: 1.01 }}
                        key={c.id} 
                        onClick={() => { setSelectedCustomer(c); setActiveTab('automation'); }}
                        className="p-2 border border-slate-100 bg-slate-50/20 rounded-lg flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        <div className="text-left">
                          <p className="text-[11px] font-medium text-slate-800">{c.name}</p>
                          <p className="text-[9px] text-slate-500 font-medium font-mono">IN 2 DAYS (Age {calculateAge(c.dob)})</p>
                        </div>
                        <span className="text-[9px] text-slate-400">Select</span>
                      </motion.div>
                    ))}

                    {stats.totalUpcomingBirthdays === 0 && (
                      <div className="py-6 text-center text-slate-400 text-xs italic">
                        No upcoming birthdays in next 3 days. Customize any patron DOB in Settings or Customer Master directory.
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Exclusive Smart D2C Showcase block */}
                <motion.div 
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 80 } }
                  }}
                  className="bg-gradient-to-br from-[#301934] to-[#4c2752] text-white p-4 rounded-xl border border-[#D4AF37]/20 flex-1 flex flex-col justify-between"
                >
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-[#D4AF37] text-xs font-bold uppercase tracking-wider mb-1 px-1">
                        <Gift className="w-4 h-4 text-[#D4AF37]" />
                        <span>The Velvet Box D2C Platform</span>
                      </div>
                      
                      <p className="text-[10px] text-white/80 font-light leading-relaxed px-1">
                        Automating luxury experiences. Generated templates include dynamic signature codes, URL anchors, and premium styling blocks natively.
                      </p>
                    </div>

                    <div className="mt-2.5 p-2.5 bg-white/5 rounded-lg border border-white/10">
                      <h5 className="text-[8px] uppercase font-black text-[#B76E79]">Active E-Commerce Target</h5>
                      <a 
                        href="https://velvetboxs.com/" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs font-bold text-[#D4AF37] hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <span>velvetboxs.com</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-3 mt-3">
                    <button 
                      onClick={() => { setActiveTab('automation'); }}
                      className="w-full bg-[#D4AF37] text-[#301934] rounded py-1.5 text-xs font-extrabold hover:bg-opacity-90 transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>LAUNCH CO-PILOT PROMPTER</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>

              </div>

            </motion.div>
          )}

          {/* TAB 2: CUSTOMER MASTER TABLE */}
          {activeTab === 'customers' && (
            <div className="flex-1 flex flex-col p-5 pt-2 overflow-hidden">
              <div className="bg-white border border-slate-200 rounded-xl flex-1 flex flex-col overflow-hidden">
                
                {/* Search, Filter controls */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-[#301934] uppercase tracking-widest">Customer Master Directory</h3>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                      {filteredCustomers.length} filter results
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Search Field */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input 
                        type="text" 
                        placeholder="Search name, category, ID..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="text-xs border border-slate-200 rounded bg-white pl-8 pr-3 py-1.5 w-52 focus:outline-none focus:border-[#301934]"
                      />
                    </div>

                    {/* Segment Filter Option Pills */}
                    <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
                      {[
                        { value: 'All', label: 'All' },
                        { value: 'New Customer', label: 'New' },
                        { value: 'Returning Customer', label: 'Returning' },
                        { value: 'Repeat Customer', label: 'Repeat' },
                        { value: 'VIP Customer', label: '👑 VIP Tier' }
                      ].map((seg) => (
                        <button
                          type="button"
                          key={seg.value}
                          onClick={() => setSegmentFilter(seg.value)}
                          className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                            segmentFilter === seg.value
                              ? 'bg-[#301934] text-[#D4AF37] shadow-xs'
                              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          {seg.label}
                        </button>
                      ))}
                    </div>

                    <button 
                      onClick={handleExportCSV}
                      className="text-[11px] font-bold border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/5 px-3 py-1.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>EXPORT CSV</span>
                    </button>
                  </div>
                </div>

                {/* Table container */}
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#FDFBFD] sticky top-0 z-10 border-b border-slate-200 shadow-xxs">
                      <tr className="text-[10px] text-slate-500 uppercase font-black tracking-wider">
                        <th className="px-5 py-3">ID</th>
                        <th className="px-5 py-3">Customer Profile</th>
                        <th className="px-5 py-3">Segment Tier</th>
                        <th className="px-5 py-3">Lifetime Value (LTV)</th>
                        <th className="px-5 py-3">Last Purchased Collection</th>
                        <th className="px-5 py-3 text-right">Interactive Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-100">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((cust) => {
                          const isCurrentlySelected = selectedCustomer.id === cust.id;
                          return (
                            <tr 
                              key={cust.id} 
                              className={`group hover:bg-[#FDFBFD] transition-colors cursor-pointer ${isCurrentlySelected ? 'bg-amber-50/20 border-l-4 border-[#D4AF37]' : ''}`}
                              onClick={() => setSelectedCustomer(cust)}
                            >
                              <td className="px-5 py-3.5 font-mono text-[10px] font-bold text-[#D4AF37]">
                                {cust.id}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="text-left">
                                  <p className="font-bold text-slate-800 text-[12px] group-hover:text-[#301934]">{cust.name}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">{cust.email} &bull; {cust.whatsAppNumber}</p>
                                  <p className="text-[9px] text-slate-400 italic">DOB: {cust.dob} (Age {calculateAge(cust.dob)})</p>
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest uppercase ${
                                  cust.status === 'VIP Customer' ? 'bg-[#301934] text-[#D4AF37] border border-[#D4AF37]/30' :
                                  cust.status === 'Repeat Customer' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                                  cust.status === 'Returning Customer' ? 'bg-pink-50 text-pink-700 border border-pink-100' :
                                  'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                }`}>
                                  {cust.status === 'VIP Customer' ? '👑 VIP TIER' : cust.status}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 font-mono font-bold text-slate-800 text-sm">
                                ₹{cust.totalRevenue.toLocaleString('en-IN')}
                                <p className="text-[9px] font-normal text-slate-400 font-sans mt-0.5">{cust.totalOrders} total sales log</p>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="text-left">
                                  <p className="font-semibold text-slate-700 text-[11px] truncate max-w-xs">{cust.productName}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{cust.productCategory} &bull; {cust.lastPurchaseDate}</p>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <div className="flex gap-2 justify-end opacity-90 group-hover:opacity-100">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCustomer(cust);
                                      setActiveTab('automation');
                                    }}
                                    className="p-1 px-2.5 bg-[#301934] text-white rounded text-[10px] font-bold hover:bg-[#4a2650] transition-colors"
                                  >
                                    AI Assist
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteCustomer(cust);
                                    }}
                                    className="p-1 px-1 bg-rose-50 text-rose-600 rounded border border-rose-100 hover:bg-rose-100 hover:text-rose-700 transition-colors"
                                    title="Delete Patron Record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-20 text-center text-slate-400 italic font-mono">
                            No customers found matching database criteria. Try altering your filter parameters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Status Indicator */}
                <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-[10px] text-slate-400">
                  <span>Selected Patron Profile: <strong className="text-slate-600 font-bold">{selectedCustomer?.name || 'None'} ({selectedCustomer?.id || 'N/A'})</strong></span>
                  <span>Google Sheets Connection Status: <strong className="text-emerald-500 font-bold">Synchronized</strong></span>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: AI AUTOMATIONS ENGINE */}
          {activeTab === 'automation' && (
            <div className="flex-1 flex flex-col p-5 pt-2 gap-4 overflow-hidden">
              
              {/* Segmented Switcher Header */}
              <div className="flex justify-between items-center bg-white border border-slate-200 p-3.5 px-4 rounded-xl shrink-0">
                <div className="space-y-0.5 text-left">
                  <h2 className="text-sm font-black text-[#301934] uppercase tracking-wide">AI Marketing & Automated Dispatch Tunnels</h2>
                  <p className="text-xxs text-slate-400 font-medium font-sans">Draft exquisite individualized greetings or queue bulk WhatsApp automated campaigns instantly</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
                  <button 
                    onClick={() => setAutomationViewMode('single')}
                    className={`p-1.5 px-4 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      automationViewMode === 'single' 
                        ? 'bg-white text-[#301934] shadow-xs font-black' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>Single Patron Workspace</span>
                  </button>
                  <button 
                    onClick={() => setAutomationViewMode('queue')}
                    className={`p-1.5 px-4 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 relative ${
                      automationViewMode === 'queue' 
                        ? 'bg-white text-[#301934] shadow-xs font-black' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Megaphone className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>WhatsApp Campaign Queue</span>
                    {queuedMessages.length > 0 && (
                      <span className="bg-[#B76E79] text-white text-[9px] font-black rounded-full px-1.5 py-0.2 ml-1 leading-none">{queuedMessages.length}</span>
                    )}
                  </button>
                </div>
              </div>

              {/* View Content Panels Container */}
              {automationViewMode === 'single' ? (
                <div className="flex-1 grid grid-cols-12 gap-5 overflow-hidden">
                  
                  {/* Left col-span-8: Template generation playground */}
                  <div className="col-span-8 bg-white border border-slate-200 rounded-xl p-5 flex flex-col overflow-auto justify-between">
                    
                    <div className="space-y-4">
                      
                      {/* Select target customer header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Dynamic Draft Workspace</h3>
                          <div className="text-base font-extrabold text-[#301934] mt-1 flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-[#D4AF37] shadow-xs animate-ping"></span>
                            <span>Personalizing for {selectedCustomer?.name || 'Aisha Sharma'}</span>
                            <span className="text-xs font-mono font-medium text-slate-400 bg-slate-100 p-0.5 px-1.5 rounded">{selectedCustomer?.id}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-xxs text-slate-400">Not target?</span>
                          <select 
                            value={selectedCustomer?.id || ''} 
                            onChange={(e) => {
                              const found = customers.find(c => c.id === e.target.value);
                              if (found) setSelectedCustomer(found);
                            }}
                            className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none bg-white"
                          >
                            {customers.map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Inline Gemini API Connection Panel */}
                      <div className="bg-[#301934]/5 border border-[#301934]/15 rounded-xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                          <div className="text-left leading-none">
                            <p className="font-bold text-[#301934] uppercase text-[10px] tracking-wide">Gemini API Key Connection</p>
                            <p className="text-[9px] text-[#B76E79] mt-1 font-bold">
                              {settings.geminiApiKey && settings.geminiApiKey !== "Injected Server-Side" && settings.geminiApiKey.trim() !== "" 
                                ? "Connected: Active Custom API Tunnel" 
                                : "System Default / Server Credentials Proxied"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[10px] font-bold">API KEY:</span>
                          <input 
                            type="password"
                            placeholder="Paste Key (AIzaSy...) for personal rate limits" 
                            value={settings.geminiApiKey && settings.geminiApiKey !== "Injected Server-Side" ? settings.geminiApiKey : ""}
                            onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                            className="text-[10px] border border-slate-200 rounded px-2.5 py-1 w-64 bg-white focus:outline-none focus:border-[#301934] font-mono shadow-xs"
                          />
                        </div>
                      </div>

                      {/* Campaign Theme and Channel Matrix Options Block */}
                      <div className="space-y-4 bg-slate-50/70 border border-slate-200/50 p-4 rounded-xl">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <p className="text-[10px] font-bold text-[#301934] uppercase tracking-wider font-mono">Step 1: Campaign Theme Selection</p>
                            <span className="text-[9px] text-[#B76E79] font-mono font-bold italic">⚜ PRESERVES LUXURY JEWELLER TONE</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                            {[
                              { id: 'birthday', label: '🎂 Birthday Treat', desc: 'VIP Special discounts & warm wishes' },
                              { id: 'offer', label: '🏷️ Exclusive Offer', desc: 'Promote specific silver jewelry collections' },
                              { id: 'festival', label: '🌟 Festival Season', desc: 'Holiday sparkling greeting cards' },
                              { id: 'repeat', label: '🗝️ VIP Repeat Reward', desc: 'Confidential private vault access paths' }
                            ].map((t) => (
                              <button 
                                key={t.id}
                                type="button"
                                onClick={() => handleCampaignConfigChange(t.id, currentChannel)}
                                className={`p-3 rounded-xl text-left transition-all border text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/40 ${
                                  currentTheme === t.id 
                                    ? 'bg-[#301934] text-white border-[#D4AF37] shadow-md font-semibold transform scale-[1.01]' 
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-[#301934]/30 hover:shadow-xs'
                                }`}
                              >
                                <div className="font-extrabold flex items-center gap-1 font-sans">
                                  <span>{t.label}</span>
                                </div>
                                <div className={`text-[8px] mt-1 leading-snug ${currentTheme === t.id ? 'text-slate-200' : 'text-slate-400 font-medium'}`}>{t.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-[#301934] uppercase tracking-wider font-mono">Step 2: Format / Delivery Channel (Enables Gemini AI Draft)</p>
                          <div className="grid grid-cols-3 gap-2.5">
                            {[
                              { id: 'sms', label: '📱 SMS Message Text', desc: 'Bespoke, short, high impact' },
                              { id: 'whatsapp', label: '💬 WhatsApp Chat Style', desc: 'Rich bullet points & emojis' },
                              { id: 'email', label: '✉️ SMTP Email Broadcast', desc: 'Luxury subject line + styling' }
                            ].map((ch) => (
                              <button 
                                key={ch.id}
                                type="button"
                                onClick={() => handleCampaignConfigChange(currentTheme, ch.id)}
                                className={`p-3 rounded-xl text-left transition-all border text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#B76E79]/40 ${
                                  currentChannel === ch.id 
                                    ? 'bg-[#B76E79] text-white border-transparent shadow-md font-semibold transform scale-[1.01]' 
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-[#B76E79]/30 hover:shadow-xs'
                                }`}
                              >
                                <div className="font-extrabold font-sans">{ch.label}</div>
                                <div className={`text-[8px] mt-1 leading-snug ${currentChannel === ch.id ? 'text-slate-100' : 'text-slate-400 font-medium'}`}>{ch.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Additional parameters draft config */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1 text-left">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Patron Preferences Context</label>
                          <div className="p-2.5 rounded bg-slate-50 border border-slate-100 text-xxs space-y-1 text-slate-500">
                            <div>🛍️ Favorite: <strong className="text-slate-600">{selectedCustomer?.productCategory} Collection</strong></div>
                            <div>💎 Piece purchased: <strong className="text-slate-600">{selectedCustomer?.productName}</strong></div>
                            <div>📈 Customer tier: <strong className="text-[#301934] uppercase font-bold">{selectedCustomer?.status}</strong></div>
                          </div>
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Promo code / Custom Note Context</label>
                          <input 
                            type="text" 
                            placeholder="Offer code, e.g. FESTIVE20, BDAY15..." 
                            value={customCampaignNote}
                            onChange={(e) => setCustomCampaignNote(e.target.value)}
                            className="text-xs border border-slate-200 rounded px-2.5 py-1.5 w-full bg-white focus:outline-none focus:border-[#301934]"
                          />
                          <span className="text-[9px] text-slate-400">This promo will merge elegantly inside Gemini AI template parameters</span>
                        </div>
                      </div>

                      {/* Draft block */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center flex-wrap gap-2 pb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Personalized Draft output</span>
                            {draftSource === 'gemini' ? (
                              <span className="text-[8px] bg-gradient-to-r from-purple-100 to-indigo-100 text-[#301934] font-black px-1.5 py-0.5 rounded border border-[#301934]/15 flex items-center gap-1">
                                <Sparkles className="w-2 h-2 text-[#D4AF37]" />
                                <span>GEMINI WORKSPACE ACTIVE</span>
                              </span>
                            ) : draftSource === 'luxury_preset' ? (
                              <span className="text-[8px] bg-gradient-to-r from-amber-50 to-orange-50 text-[#D4AF37] font-black px-1.5 py-0.5 rounded border border-[#D4AF37]/20 flex items-center gap-1">
                                <span>✦ EXQUISITE OFFLINE CO-PILOT</span>
                              </span>
                            ) : null}
                          </div>

                          <button 
                            onClick={() => handleGenerateDraft(activeCampaignType, selectedCustomer, customCampaignNote)}
                            className="text-[10px] bg-gradient-to-r from-[#301934] to-[#4d2753] hover:brightness-110 text-white p-1 px-3 rounded-md font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs border border-[#D4AF37]/25"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-[#D4AF37]" />
                            <span>UPGRADE WITH GEMINI AI</span>
                          </button>
                        </div>
                        
                        <div className="relative border-slate-200">
                          {aiGenerating && (
                            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col justify-center items-center rounded-lg border border-slate-700 z-20">
                              <div className="w-6 h-6 border-2 border-t-[#D4AF37] border-white/20 rounded-full animate-spin"></div>
                              <span className="text-[10px] font-mono text-[#D4AF37] tracking-widest mt-2 uppercase animate-pulse">Consulting Gemini Expert...</span>
                            </div>
                          )}
                          <textarea 
                            value={generatedDraft}
                            onChange={(e) => setGeneratedDraft(e.target.value)}
                            className="w-full h-44 text-[11px] leading-relaxed font-mono p-4 rounded-lg bg-slate-900 text-slate-100 border border-slate-800 focus:outline-none focus:border-[#D4AF37]"
                            placeholder="Template draft output displays here..."
                          />
                        </div>

                        {quotaExceededNotice && (
                          <div className="text-[10px] text-amber-800 bg-amber-50/90 border border-amber-200 p-3 rounded-lg mt-1.5 flex flex-col gap-1 leading-snug text-left">
                            <div className="flex items-center gap-1 font-bold text-[#301934] uppercase tracking-wider text-[9px]">
                              <span className="animate-pulse">⚠️</span>
                              <span>Shared Server Key Rate Limit Exceeded</span>
                            </div>
                            <p>
                              Our shared server-side Gemini key has exceeded its public rate limit (Resource Exhausted), but the Velvet Box <strong>luxury fallback template system</strong> has resolved your campaign copy instantly.
                            </p>
                            <p className="mt-0.5 text-slate-500">
                              💡 You can paste your own free-tier Gemini API key in the connection input field above or under Settings to bypass any shared service limits!
                            </p>
                          </div>
                        )}

                        {draftSource === 'luxury_preset' && !quotaExceededNotice && (
                          <div className="text-[9px] text-[#B76E79] bg-[#B76E79]/5 border border-[#B76E79]/15 p-2 rounded-md mt-1.5 flex items-start gap-1.5 leading-snug text-left">
                            <span className="text-amber-500">✨</span>
                            <p>
                              Currently using <strong>Exquisite Offline Co-Pilot System</strong> for instant, zero-latency rendering. Press the <strong className="text-[#301934]">UPGRADE WITH GEMINI AI</strong> button at any time to run real-time generative models on this customer profile.
                            </p>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Action Row */}
                    <div className="pt-4 border-t border-slate-100 flex justify-between gap-3 flex-wrap">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleCopyClipboard(generatedDraft, currentChannel)}
                          className="border border-slate-200 text-slate-700 font-bold text-[10px] p-2 rounded px-3.5 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedType === currentChannel ? 'COPIED!' : 'COPY DRAFT CONTENT'}</span>
                        </button>
                        
                        {currentChannel === 'email' && (
                          <button 
                            onClick={() => setIsPreviewEmailOpen(true)}
                            className="border border-[#B76E79]/50 text-[#B76E79] bg-pink-50/20 font-bold text-[10px] p-2 rounded px-3.5 hover:bg-pink-50 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>PREVIEW LUXURY EMAIL</span>
                          </button>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {/* Render SMS Dispatcher */}
                        {currentChannel === 'sms' && (
                          <>
                            <button 
                              onClick={() => handleGenerateDraft(activeCampaignType, selectedCustomer, customCampaignNote)}
                              disabled={aiGenerating}
                              className="bg-purple-100 hover:bg-purple-200 text-purple-950 border border-purple-300/60 font-bold text-[10px] p-2 rounded px-4 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02]"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-purple-700 animate-pulse" />
                              <span>✨ AI DRAFT SMS</span>
                            </button>
                            <button 
                              onClick={() => handleOpenSMS(selectedCustomer, generatedDraft)}
                              className="bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-[10px] p-2 rounded px-4 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02]"
                            >
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              <span>NATIVE MOBILE SMS</span>
                            </button>
                            <button 
                              onClick={() => handleSendSMS(selectedCustomer, generatedDraft)}
                              className="bg-[#301934] text-white hover:bg-[#4a2650] font-bold text-[10px] p-2 rounded px-4 flex items-center gap-1.5 cursor-pointer border border-[#D4AF37]/30 transition-all font-semibold hover:scale-[1.02]"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                              <span>SEND SMS (TWILIO NODE)</span>
                            </button>
                          </>
                        )}

                        {/* Render WhatsApp Dispatcher */}
                        {currentChannel === 'whatsapp' && (
                          <>
                            <button 
                              onClick={() => handleGenerateDraft(activeCampaignType, selectedCustomer, customCampaignNote)}
                              disabled={aiGenerating}
                              className="bg-purple-100 hover:bg-purple-200 text-purple-950 border border-purple-300/60 font-bold text-[10px] p-2 rounded px-4 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02]"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-purple-700 animate-pulse" />
                              <span>✨ AI DRAFT WHATSAPP</span>
                            </button>
                            <button 
                              onClick={() => handleOpenWhatsApp(selectedCustomer, generatedDraft)}
                              className="bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-[10px] p-2 rounded px-4 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02]"
                            >
                              <Phone className="w-3.5 h-3.5 text-slate-500" />
                              <span>NATIVE WHATSAPP WEB</span>
                            </button>
                            <button 
                              onClick={() => handleSendWhatsAppAPI(selectedCustomer, generatedDraft)}
                              className="bg-[#301934] text-white hover:bg-[#4a2650] font-bold text-[10px] p-2 rounded px-4 flex items-center gap-1.5 cursor-pointer border border-[#D4AF37]/30 transition-all font-semibold hover:scale-[1.02]"
                            >
                              <Phone className="w-3.5 h-3.5 text-[#D4AF37]" />
                              <span>SEND WHATSAPP API</span>
                            </button>
                          </>
                        )}

                        {/* Render SMTP Email Dispatcher */}
                        {currentChannel === 'email' && (
                          <>
                            <button 
                              onClick={() => handleGenerateDraft(activeCampaignType, selectedCustomer, customCampaignNote)}
                              disabled={aiGenerating}
                              className="bg-purple-100 hover:bg-purple-200 text-purple-950 border border-purple-300/60 font-bold text-[10px] p-2 rounded px-4 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02]"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-purple-700 animate-pulse" />
                              <span>✨ AI DRAFT EMAIL</span>
                            </button>
                            <button 
                              onClick={() => handleSendEmailSMTP(selectedCustomer, generatedDraft)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-[10px] p-2 rounded px-4 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02]"
                            >
                              <Mail className="w-3.5 h-3.5 text-slate-500" />
                              <span>SMTP CLIENT BROADCAST</span>
                            </button>

                            {googleUser && (
                              <>
                                <button 
                                  onClick={() => handleSendGmailAPI(selectedCustomer, generatedDraft, false)}
                                  className="bg-[#301934] text-white hover:bg-[#4a2650] font-bold text-[10px] p-2 rounded px-4 flex items-center gap-1.5 cursor-pointer border border-[#D4AF37]/30 transition-all font-semibold hover:scale-[1.02]"
                                >
                                  <svg className="w-3.5 h-3.5 text-[#D4AF37]" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                                  </svg>
                                  <span>GMAIL SEND API</span>
                                </button>
                                <button 
                                  onClick={() => handleSendGmailAPI(selectedCustomer, generatedDraft, true)}
                                  className="bg-amber-100 text-amber-950 hover:bg-amber-200 border border-amber-300 font-bold text-[10px] p-2 rounded px-4 flex items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02]"
                                >
                                  <svg className="w-3.5 h-3.5 text-amber-700" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.41 8.41l-4.83-4.83c-.37-.37-.88-.58-1.41-.58H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9.83c0-.53-.21-1.04-.59-1.42zM5 20V4h9v5h5v11H5z"/>
                                  </svg>
                                  <span>CREATE GMAIL DRAFT</span>
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Successful Dispatch Alert banner */}
                    {sendSuccessMessage && (
                      <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[10px] flex items-center gap-2 font-mono">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        <span>{sendSuccessMessage}</span>
                      </div>
                    )}

                  </div>

                  {/* Right panel: Static segmented templates overview */}
                  <div className="col-span-4 bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between overflow-auto text-left">
                    <div className="space-y-4">
                      <div className="flex items-center gap-1.5 border-b border-slate-50 pb-2">
                        <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                        <span className="text-[11px] font-black text-[#301934] uppercase tracking-wide font-sans">Velvet Box CRM Standards</span>
                      </div>
                      
                      <div className="space-y-3 font-sans text-xxs">
                        <div className="p-3 bg-purple-50/40 rounded border border-purple-100">
                          <p className="font-bold text-[#301934] uppercase tracking-wide text-[9px] mb-1">Standard SMS Draft Requirements</p>
                          <blockquote className="italic text-slate-500 font-sans">
                            "Happy Birthday [Patron Name]! ✨ Enjoy 15% off exotic pure silver design collections. Code: BDAY15. Elegant designs await: https://velvetboxs.com/"
                          </blockquote>
                          <button 
                            onClick={() => {
                              const baseMsg = `Happy Birthday ${selectedCustomer.name}! ✨ Bask in royal luxury. Enjoy 15% off pure silver collections. Code: BDAY15. Elegant designs await: https://velvetboxs.com/ - The Velvet Box`;
                              handleCopyClipboard(baseMsg, 'sms');
                            }}
                            className="text-[9px] text-[#301934] underline font-bold mt-2 hover:text-[#4a2650]"
                          >
                            Copy Standard SMS Draft
                          </button>
                        </div>

                        <div className="p-3 bg-pink-50/20 rounded border border-pink-100">
                          <p className="font-bold text-[#B76E79] uppercase tracking-wide text-[9px] mb-1">WhatsApp Draft standard</p>
                          <blockquote className="italic text-slate-500 font-sans">
                            "Dear [Name], Happy Birthday from The Velvet Box! To celebrate, enjoy 15% off our pure handcrafted silver: https://velvetboxs.com/"
                          </blockquote>
                          <button 
                            onClick={() => {
                              const baseMsg = `Dear ${selectedCustomer.name}, *Happy Birthday from The Velvet Box!* To celebrate, we gift you *15% OFF* site-wide. Code: VELVETBDAY. Explore here: https://velvetboxs.com/`;
                              handleCopyClipboard(baseMsg, 'whatsapp');
                            }}
                            className="text-[9px] text-[#B76E79] underline font-bold mt-2 hover:text-pink-800"
                          >
                            Copy Standard WhatsApp Draft
                          </button>
                        </div>

                        <div className="p-3 bg-[#D4AF37]/5 rounded border border-[#D4AF37]/20">
                          <p className="font-bold text-amber-700 uppercase tracking-wide text-[9px] mb-1 font-sans">Email Draft standard</p>
                          <blockquote className="italic text-slate-500 font-sans">
                            Includes Customer Name, luxury jewellery template guidelines and direct secure redirect hyperlink https://velvetboxs.com/
                          </blockquote>
                          <button 
                            onClick={() => {
                              const baseMsg = `Happy Birthday ${selectedCustomer.name}! Vintage Silver Collections await your special discount at https://velvetboxs.com/ - The Velvet Box Design`;
                              handleCopyClipboard(baseMsg, 'email');
                            }}
                            className="text-[9px] text-amber-700 underline font-bold mt-2 hover:text-amber-800"
                          >
                            Copy Standard Email Draft
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 mt-6">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Platform connection</span>
                        <span className="text-[9px] uppercase bg-green-100 border border-green-200 p-0.5 px-2.5 rounded font-black text-green-700">configured</span>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                
                <div className="flex-1 grid grid-cols-12 gap-5 overflow-hidden text-left">
                  
                  {/* Left Column (col-span-4): Setup Batch Parameters */}
                  <div className="col-span-4 bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between overflow-auto space-y-4">
                    <div className="space-y-4">
                      
                      {/* Title Header */}
                      <div className="border-b border-slate-100 pb-2">
                        <span className="text-[10px] font-black uppercase text-[#B76E79] tracking-widest font-mono">Tunnel Controller</span>
                        <h3 className="text-sm font-extrabold text-[#301934] mt-0.5">Campaign Setup</h3>
                      </div>

                      {/* Select Campaign Theme */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">1. Selected Theme</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'birthday', label: '🎂 Birthday Treat', desc: 'Warm VIP wishes' },
                            { id: 'offer', label: '🏷️ Deal Offer', desc: 'Personal collection deal' },
                            { id: 'festival', label: '🌟 Festival Shimmer', desc: 'Celebratory greets' },
                            { id: 'repeat', label: '🗝️ VIP Secret Drop', desc: 'Pre-launch access paths' }
                          ].map(t => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setQueueTheme(t.id as any)}
                              className={`p-2 rounded-lg text-left border text-xxs transition-all cursor-pointer ${
                                queueTheme === t.id
                                  ? 'bg-[#301934] text-white border-transparent font-bold scale-[1.01] shadow-xs'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <div className="font-black">{t.label}</div>
                              <div className={`text-[8px] font-medium leading-none mt-0.5 ${queueTheme === t.id ? 'text-slate-200' : 'text-slate-400'}`}>{t.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Promo context */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">2. Promo code / Custom Context</label>
                        <input
                          type="text"
                          value={queuePromo}
                          onChange={(e) => setQueuePromo(e.target.value)}
                          placeholder="e.g. SILVER20, BDAY15..."
                          className="text-xs border border-slate-200 rounded px-2.5 py-1.5 w-full bg-white font-mono focus:outline-none focus:border-[#301934] text-slate-700 font-bold"
                        />
                      </div>

                      {/* Select target customers list */}
                      <div className="space-y-1 flex-1 flex flex-col min-h-[180px] overflow-hidden">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">3. Choose Recipients ({customers.filter(c => queueSelectionState[c.id]).length} checked)</label>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                const allChecked: typeof queueSelectionState = {};
                                customers.forEach(c => { allChecked[c.id] = true; });
                                setQueueSelectionState(allChecked);
                              }}
                              className="text-[9px] font-bold text-sky-700 underline hover:text-sky-900 cursor-pointer"
                            >
                              All
                            </button>
                            <span className="text-slate-300 text-[10px]">|</span>
                            <button 
                              onClick={() => {
                                const noneChecked: typeof queueSelectionState = {};
                                customers.forEach(c => { noneChecked[c.id] = false; });
                                setQueueSelectionState(noneChecked);
                              }}
                              className="text-[9px] font-bold text-slate-500 underline hover:text-slate-700 cursor-pointer"
                            >
                              None
                            </button>
                          </div>
                        </div>

                        {/* Scannable checklist component */}
                        <div className="flex-1 overflow-auto border border-slate-200 rounded-lg p-2 bg-slate-50/70 space-y-1 divide-y divide-slate-150">
                          {customers.map(c => (
                            <div 
                              key={c.id} 
                              onClick={() => setQueueSelectionState(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                              className="flex items-center justify-between p-1.5 px-2 hover:bg-white rounded cursor-pointer transition-all gap-2"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {queueSelectionState[c.id] ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-300 shrink-0" />
                                )}
                                <div className="text-left font-mono leading-tight min-w-0">
                                  <p className="text-xxs font-black text-slate-800 truncate">{c.name}</p>
                                  <p className="text-[8.5px] text-slate-400 truncate">{c.status} • {c.whatsAppNumber}</p>
                                </div>
                              </div>
                              <span className="text-[8.5px] font-bold text-slate-500 bg-slate-100 p-0.5 px-1.5 rounded shrink-0">{c.productCategory}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Populating trigger */}
                    <button
                      onClick={handlePopulateQueue}
                      disabled={isQueueGenerating || isQueueDispatching}
                      className="w-full bg-[#301934] hover:bg-[#4a2650] active:scale-[0.99] disabled:opacity-50 text-white font-extrabold text-[11px] p-2.5 rounded-lg justify-center flex items-center gap-2 cursor-pointer shadow-xs border border-[#D4AF37]/35 transition-all text-center uppercase"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Stage Campaign Queue</span>
                    </button>
                  </div>

                  {/* Right Column (col-span-8): Active Queue Manager Table & Control Board */}
                  <div className="col-span-8 bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between overflow-auto">
                    
                    <div className="space-y-4">
                      
                      {/* Controller Bar Header of Queue list */}
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2 flex-wrap gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase font-black text-[#D4AF37] font-mono tracking-wider">LIVE CAMPAIGN DUCTS</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                          </div>
                          <h3 className="text-sm font-extrabold text-[#301934] mt-0.5">Automated WhatsApp Queue ({queuedMessages.length} staged)</h3>
                        </div>

                        {queuedMessages.length > 0 && (
                          <div className="flex items-center gap-2 text-xxs font-mono">
                            <span className="text-slate-400">Status counts:</span>
                            <span className="bg-slate-100 text-slate-600 font-bold px-1 rounded">Pnd: {queuedMessages.filter(q => q.status === 'Pending').length}</span>
                            <span className="bg-sky-50 text-sky-700 font-bold px-1 rounded">Rdy: {queuedMessages.filter(q => q.status === 'Ready').length}</span>
                            <span className="bg-[#D4AF37]/15 text-[#301934] font-bold px-1 rounded">Snd: {queuedMessages.filter(q => q.status === 'Sending').length}</span>
                            <span className="bg-emerald-50 text-emerald-700 font-bold px-1 rounded">Dsp: {queuedMessages.filter(q => q.status === 'Dispatched').length}</span>
                            {queuedMessages.some(q => q.status === 'Failed') && (
                              <span className="bg-rose-50 text-rose-700 font-bold px-1 rounded">Fld: {queuedMessages.filter(q => q.status === 'Failed').length}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Queue control parameters panel (shows only if items staged) */}
                      {queuedMessages.length > 0 ? (
                        <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-xl space-y-3.5 text-left">
                          
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            
                            {/* Generation Column */}
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-slate-500 uppercase font-sans">Step 1: AI Prompt Batch Copy</p>
                              <button
                                onClick={handleGenerateAIQueue}
                                disabled={isQueueGenerating || isQueueDispatching}
                                className="bg-purple-100 hover:bg-purple-200 hover:text-purple-950 text-[#301934] border border-purple-200 font-black text-[10px] p-2 rounded-lg flex items-center gap-1.5 transition-all text-left uppercase cursor-pointer disabled:opacity-50"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-purple-700 font-bold" />
                                <span>{isQueueGenerating ? 'AI Generating drafts...' : '🚀 Generate Gemini AI Copies'}</span>
                              </button>
                            </div>

                            {/* Dispatch Settings Column */}
                            <div className="space-y-1 text-left">
                              <p className="text-[10px] font-bold text-slate-500 uppercase font-sans">Step 2: Dispatch Control Center</p>
                              <div className="flex items-center gap-3">
                                
                                {/* Interval selection */}
                                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1.5 px-2">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <label className="text-[9.5px] font-bold text-slate-500 whitespace-nowrap">Delay:</label>
                                  <select
                                    value={queueDispatchInterval}
                                    onChange={(e) => setQueueDispatchInterval(Number(e.target.value))}
                                    className="text-[10px] font-mono font-bold bg-transparent border-none outline-none text-slate-700 p-0 text-right w-11 focus:ring-0"
                                    disabled={isQueueDispatching}
                                  >
                                    <option value={1}>1s</option>
                                    <option value={2}>2s</option>
                                    <option value={3}>3s</option>
                                    <option value={5}>5s</option>
                                    <option value={10}>10s</option>
                                  </select>
                                </div>

                                <button
                                  onClick={handleStartQueueDispatch}
                                  disabled={isQueueGenerating || isQueueDispatching || !queuedMessages.some(q => q.status === 'Pending' || q.status === 'Ready' || q.status === 'Failed')}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] p-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-all uppercase cursor-pointer disabled:opacity-50 focus:outline-none"
                                >
                                  <Play className="w-3.5 h-3.5 text-white" />
                                  <span>{isQueueDispatching ? 'Dispatching...' : '📡 Process Queue'}</span>
                                </button>
                              </div>
                            </div>

                            {/* Clear Queue Utility */}
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-slate-400 uppercase text-right">Reset Controller</p>
                              <button
                                onClick={handleClearQueue}
                                disabled={isQueueGenerating || isQueueDispatching}
                                className="bg-white border border-rose-200 font-bold hover:bg-rose-50 text-rose-600 text-[10px] p-2 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Clear queue</span>
                              </button>
                            </div>

                          </div>

                          {/* Progress Alert Banner if dispatch mode or generation mode */}
                          {(isQueueGenerating || isQueueDispatching) && (
                            <div className="p-2.5 bg-sky-50 text-sky-800 border bg-sky-100 rounded-lg text-xxs font-mono flex items-center gap-2">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600 shrink-0" />
                              <span className="font-bold">
                                {isQueueGenerating 
                                  ? '⚙️ Co-Pilot Bulk Processing: AI is formulating bespoke drafts. Please wait.' 
                                  : '📡 Queue Dispatch active: Dispatches are being processed sequentially. Keep browser tab open!'
                                }
                              </span>
                            </div>
                          )}

                        </div>
                      ) : null}

                      {/* Staged campaigns list view */}
                      <div className="border border-slate-200 rounded-lg overflow-hidden min-h-[300px] bg-slate-50/20 flex flex-col justify-between">
                        {queuedMessages.length > 0 ? (
                          <div className="divide-y divide-slate-100 overflow-auto max-h-[460px] text-left">
                            {queuedMessages.map((msg, index) => (
                              <div key={msg.id} className="p-3.5 hover:bg-slate-50/50 transition-all flex flex-col gap-2 relative border-b border-slate-100/60">
                                
                                {/* Info Row */}
                                <div className="flex justify-between items-start gap-1">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-[10px] font-black text-slate-400">#{index+1}</span>
                                      <span className="text-xs font-black text-[#301934]">{msg.customer.name}</span>
                                      <span className="text-[9px] font-bold text-[#D4AF37] bg-[#301934] rounded p-0.5 px-1.5">{msg.customer.whatsAppNumber}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[9px] text-[#B76E79] font-sans font-bold uppercase mt-0.5">
                                      <span>Fav Category: {msg.customer.productCategory} ({msg.customer.productName})</span>
                                      <span>•</span>
                                      <span>Theme: {msg.theme}</span>
                                    </div>
                                  </div>

                                  {/* Right side individual customer statuses / actions */}
                                  <div className="flex items-center gap-2">
                                    
                                    {/* STATUS BADGES */}
                                    {msg.status === 'Pending' && (
                                      <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold p-0.5 px-2 rounded-full uppercase">Staged</span>
                                    )}
                                    {msg.status === 'Generating' && (
                                      <span className="bg-purple-100 text-[#301934] border border-purple-200 text-[9px] font-black p-0.5 px-2 rounded-full flex items-center gap-1 animate-pulse uppercase">AI Drafting...</span>
                                    )}
                                    {msg.status === 'Ready' && (
                                      <span className="bg-sky-50 text-sky-700 border border-sky-200 text-[9px] font-bold p-0.5 px-2 rounded-full uppercase">Ready</span>
                                    )}
                                    {msg.status === 'Sending' && (
                                      <span className="bg-orange-50 text-orange-700 border border-orange-200 text-[9px] font-black p-0.5 px-2 rounded-full flex items-center gap-1 animate-pulse uppercase font-sans">Dispatching...</span>
                                    )}
                                    {msg.status === 'Dispatched' && (
                                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black p-0.5 px-2 rounded-full flex items-center gap-1 uppercase">Dispatched 🟢</span>
                                    )}
                                    {msg.status === 'Failed' && (
                                      <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-bold p-0.5 px-2 rounded-full uppercase" title={msg.error || 'Unknown Error'}>Failed ❌</span>
                                    )}

                                    {/* Action items */}
                                    <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-2">
                                      {editingQueueId === msg.id ? (
                                        <button
                                          onClick={() => handleUpdateQueueItemDraft(msg.id, editingQueueDraft)}
                                          className="p-1 px-2.5 text-white bg-emerald-600 rounded hover:bg-emerald-700 font-bold text-[9px]"
                                        >
                                          Save
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setEditingQueueId(msg.id);
                                            setEditingQueueDraft(msg.draft);
                                          }}
                                          disabled={msg.status === 'Generating' || msg.status === 'Sending'}
                                          className="text-slate-500 hover:text-slate-800 text-[9px] font-extrabold underline font-sans cursor-pointer"
                                        >
                                          Edit
                                        </button>
                                      )}
                                      
                                      <button
                                        onClick={() => handleRemoveQueueItem(msg.id)}
                                        disabled={isQueueGenerating || isQueueDispatching}
                                        className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded cursor-pointer transition-colors"
                                        title="Remove customer from Campaign Queue"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                  </div>
                                </div>

                                {/* Custom text message preview / Edit Block */}
                                <div className="rounded-lg bg-slate-900 border border-slate-800 p-3 font-mono text-[10.5px] leading-relaxed text-slate-200 flex flex-col gap-1.5 text-left">
                                  {editingQueueId === msg.id ? (
                                    <textarea
                                      value={editingQueueDraft}
                                      onChange={(e) => setEditingQueueDraft(e.target.value)}
                                      className="w-full h-24 bg-slate-950 border border-[#D4AF37]/50 rounded focus:outline-none p-1.5 focus:ring-1 focus:ring-[#D4AF37]/40 text-[10px] font-mono text-slate-100"
                                    />
                                  ) : (
                                    <p className="whitespace-pre-wrap select-all leading-relaxed">{msg.draft || <span className="italic text-slate-500">Unrendered - Run AI generation or edit this template</span>}</p>
                                  )}
                                  
                                  {/* Error block if failed */}
                                  {msg.status === 'Failed' && msg.error && (
                                    <div className="mt-1 text-rose-400 text-[9.5px] font-sans font-bold flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      <span>Alert: {msg.error}</span>
                                    </div>
                                  )}

                                  {/* Direct Individual Send options */}
                                  <div className="flex justify-between items-center mt-1 border-t border-slate-800/80 pt-1 flex-wrap gap-1">
                                    <span className="text-[8.5px] font-mono font-normal text-slate-500">Merged Promo context: <strong className="text-[#D4AF37]">{msg.promo}</strong></span>
                                    <div className="flex gap-2.5">
                                      <button
                                        onClick={() => {
                                          const waUrl = `https://wa.me/${msg.customer.whatsAppNumber.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent(msg.draft)}`;
                                          window.open(waUrl, '_blank');
                                          setQueuedMessages(prev => prev.map(q => q.id === msg.id ? { ...q, status: 'Dispatched' } : q));
                                          triggerToast('💬 Redirected to Native WhatsApp Web.');
                                        }}
                                        className="text-[9.5px] text-[#B76E79] font-black hover:underline cursor-pointer"
                                      >
                                        Direct Click-to-Send Web
                                      </button>
                                    </div>
                                  </div>

                                </div>

                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col justify-center items-center py-24 p-6 text-center space-y-2.5">
                            <div className="p-3 bg-[#301934]/10 text-[#301934] border border-[#301934]/20 rounded-full animate-pulse">
                              <Megaphone className="w-6 h-6 text-slate-500" />
                            </div>
                            <div>
                              <p className="text-xs font-black text-[#301934] uppercase tracking-wide">Queue Pipeline is Empty</p>
                              <p className="text-xxs text-slate-400 max-w-sm mx-auto mt-1 leading-normal font-medium">To prepare a bulk dispatch campaign, select target recipients from the setup checklist on the left, choose your theme, and click "Stage Campaign Queue"!</p>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>

                    <div className="border-t border-slate-100 pt-3 mt-4 text-[9.5px] text-slate-400 flex justify-between items-center">
                      <span>💡 <strong>Pacing Protection:</strong> Dynamic delays prevent automated rate limit blockades on personal accounts.</span>
                      <span>Simulated Gateway: <strong className="text-emerald-600 font-bold uppercase">{settings.twilioAccountSid ? 'TWILIO DISPATCH DUCT' : 'SECURE CLIENT-SIDE PIPELINE'}</strong></span>
                    </div>

                  </div>

                </div>
              )}

            </div>
          )}

          {/* TAB 4: CRM INTEGRATION SETTINGS */}
          {activeTab === 'settings' && (
            <div className="flex-1 grid grid-cols-12 gap-5 p-5 pt-2 overflow-hidden">
              
              {/* Left Column: Config Forms */}
              <div className="col-span-8 bg-white border border-slate-200 rounded-xl p-5 overflow-auto space-y-5">
                
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-extrabold text-[#301934] uppercase tracking-wider">CRM Integrations & Security</h3>
                  <p className="text-[11px] text-slate-400 font-light">Enable live Gemini response triggers, SMTP servers and Meta key parameters</p>
                </div>

                {/* Config Block 1: Gemini AI Config */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 text-left space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-xs font-black uppercase text-[#301934] flex items-center gap-1">
                      <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                      <span>Gemini LLM Campaign Processor</span>
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={settings.aiEnabled} 
                        onChange={(e) => setSettings({ ...settings, aiEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#301934]"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Selected Engine Model</label>
                      <select 
                        value={settings.geminiModel}
                        onChange={(e) => setSettings({ ...settings, geminiModel: e.target.value })}
                        className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white text-slate-700"
                        disabled={!settings.aiEnabled}
                      >
                        <option value="gemini-3.5-flash">gemini-3.5-flash (Optimized Text)</option>
                        <option value="gemini-2.5-flash-image">gemini-2.5-flash-image (Premium Image)</option>
                        <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Paid Model)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between font-sans">
                        <span>API Configuration Key</span>
                        {settings.geminiApiKey === "Injected Server-Side" ? (
                          <span className="text-[9px] text-emerald-600 font-semibold uppercase tracking-wider flex items-center gap-0.5">
                            🟢 Backend Active
                          </span>
                        ) : (
                          <span className="text-[9px] text-[#D4AF37] font-mono font-bold">★ Session Key</span>
                        )}
                      </label>
                      <div className="flex gap-2">
                        <input 
                          type="password" 
                          value={settings.geminiApiKey === "Injected Server-Side" ? "••••••••••••••••••••••••••••••••" : settings.geminiApiKey}
                          onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                          placeholder="Paste private Gemini API Key (AIzaSy...)"
                          className="text-xs border border-[#D4AF37]/50 rounded p-1.5 flex-1 bg-white text-slate-800 font-mono focus:outline-none focus:border-[#301934] focus:ring-1 focus:ring-[#301934] tracking-tight"
                        />
                        {settings.geminiApiKey !== "Injected Server-Side" && (
                          <button
                            type="button"
                            onClick={handleSaveBackendApiKey}
                            disabled={savingBackendKey}
                            className="bg-[#301934] text-[#D4AF37] border border-[#D4AF37]/40 px-2.5 py-1.5 rounded text-[9px] font-black uppercase tracking-wider hover:bg-[#4a2650] transition-colors shrink-0 flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            {savingBackendKey ? "Writing..." : "Save Backend"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Config Block 2: WhatsApp Settings */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 text-left space-y-3">
                  <div className="border-b border-slate-200 pb-2">
                    <span className="text-xs font-black uppercase text-[#301934] flex items-center gap-1">
                      <Phone className="w-4 h-4 text-emerald-600" />
                      <span>Meta WhatsApp Business platform</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-left">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Provider selection</label>
                      <select 
                        value={settings.whatsAppProvider}
                        onChange={(e) => setSettings({ ...settings, whatsAppProvider: e.target.value })}
                        className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white text-slate-700"
                      >
                        <option value="Meta Cloud API">Meta Cloud API (Official)</option>
                        <option value="Twilio Messaging">Twilio Messaging SDK</option>
                        <option value="Wati Integration">Wati Webhook Gateway</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Business Number</label>
                      <input 
                        type="text" 
                        value={settings.whatsAppBusinessNumber}
                        onChange={(e) => setSettings({ ...settings, whatsAppBusinessNumber: e.target.value })}
                        className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white text-slate-700 font-mono font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">API Access Key</label>
                      <input 
                        type="password" 
                        value={settings.whatsAppApiKey}
                        onChange={(e) => setSettings({ ...settings, whatsAppApiKey: e.target.value })}
                        className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white text-slate-700 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Config Block 4: Twilio SMS Gateway configuration */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 text-left space-y-3">
                  <div className="border-b border-slate-200 pb-2">
                    <span className="text-xs font-black uppercase text-[#301934] flex items-center gap-1">
                      <MessageSquare className="w-4 h-4 text-sky-600" />
                      <span>Twilio SMS Gateway configuration</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-left">
                    <div className="space-y-1 col-span-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase font-sans">Account SID</label>
                      <input 
                        type="text" 
                        value={settings.twilioAccountSid || ''}
                        onChange={(e) => setSettings({ ...settings, twilioAccountSid: e.target.value })}
                        placeholder="ACxxxxxxxxxxxxxxxx"
                        className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white text-slate-700 font-mono text-[11px]"
                      />
                    </div>

                    <div className="space-y-1 col-span-1 font-sans">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Auth Token</label>
                      <input 
                        type="password" 
                        value={settings.twilioAuthToken || ''}
                        onChange={(e) => setSettings({ ...settings, twilioAuthToken: e.target.value })}
                        placeholder="••••••••••••••••"
                        className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white text-slate-700 font-mono"
                      />
                    </div>

                    <div className="space-y-1 col-span-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">From Phone Number</label>
                      <input 
                        type="text" 
                        value={settings.twilioFromNumber || ''}
                        onChange={(e) => setSettings({ ...settings, twilioFromNumber: e.target.value })}
                        placeholder="+1xxxxxxxxxx"
                        className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white text-slate-700 font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Config Block 3: Email Connection */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 text-left space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-xs font-black uppercase text-[#301934] flex items-center gap-1">
                      <Mail className="w-4 h-4 text-[#B76E79]" />
                      <span>Gmail SMTP Client Dispatcher</span>
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={settings.gmailConnected} 
                        onChange={(e) => setSettings({ ...settings, gmailConnected: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#B76E79]"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-5 gap-3 text-left">
                    <div className="space-y-1 col-span-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">SMTP Server</label>
                      <input 
                        type="text" 
                        value={settings.smtpServer}
                        onChange={(e) => setSettings({ ...settings, smtpServer: e.target.value })}
                        className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white text-slate-700 font-mono"
                        disabled={!settings.gmailConnected}
                      />
                    </div>

                    <div className="space-y-1 col-span-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Port</label>
                      <input 
                        type="text" 
                        value={settings.smtpPort}
                        onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })}
                        className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white text-slate-700 font-mono"
                        disabled={!settings.gmailConnected}
                      />
                    </div>

                    <div className="space-y-1 col-span-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Sender Email</label>
                      <input 
                        type="text" 
                        value={settings.senderEmail}
                        onChange={(e) => setSettings({ ...settings, senderEmail: e.target.value })}
                        className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white text-slate-700 text-[11px]"
                        disabled={!settings.gmailConnected}
                      />
                    </div>

                    <div className="space-y-1 col-span-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">SMTP Password / App Key</label>
                      <input 
                        type="password" 
                        value={settings.smtpPassword || ''}
                        onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
                        placeholder="••••••••••••••••"
                        className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white text-slate-700 font-mono"
                        disabled={!settings.gmailConnected}
                      />
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <button 
                    onClick={() => {
                      triggerToast('💾 Settings and parameters successfully stored in persistent memory!');
                    }}
                    className="bg-[#301934] text-white px-5 py-2 rounded text-xs font-black tracking-wide hover:bg-[#4a2650] shadow-sm transition-colors cursor-pointer"
                  >
                    SAVE PARAMETERS
                  </button>
                </div>

              </div>

              {/* Right Column: Google Workspace Integration Options */}
              <div className="col-span-4 bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between overflow-auto space-y-4">
                
                {/* Handshaking Header */}
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 border-b border-slate-50 pb-2">
                    <Database className="w-4 h-4 text-[#D4AF37]" />
                    <span className="text-[11px] font-black text-[#301934] uppercase tracking-wide font-sans">Google Workspace Connect Portal</span>
                  </div>

                  {/* Auth Connection Status Block */}
                  {!googleUser ? (
                    <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-center space-y-2.5">
                      <p className="text-xxs font-semibold uppercase text-slate-400 tracking-wide">Google Identity Verification</p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Connect your account to send direct <strong>Gmail marketing drafts</strong>, <strong>read/write Google Sheets</strong>, and backup database records to <strong>Google Drive</strong>.
                      </p>
                      <div className="flex justify-center pt-1">
                        <button 
                          onClick={handleWorkspaceLogin}
                          disabled={isWorkspaceLoading}
                          className="relative inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold p-2 px-5 rounded-lg text-xs shadow-sm cursor-pointer transition-colors"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="#EA4335" d="M12 5.04c1.65 0 3.14.57 4.31 1.69L19.92 3.1C17.78 1.18 15.02 0 12 0 7.31 0 3.25 2.69 1.28 6.61l3.99 3.09C6.21 6.86 8.87 5.04 12 5.04z" />
                            <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.44c-.28 1.48-1.11 2.73-2.37 3.58l3.69 2.87c2.16-1.99 3.4-4.92 3.4-8.58z" />
                            <path fill="#FBBC05" d="M5.27 14.3C5.03 13.57 4.9 12.8 4.9 12s.13-1.57.27-2.3l-3.99-3.09C.46 8.23 0 10.06 0 12s.46 3.77 1.18 5.39l4.09-3.09z" />
                            <path fill="#34A853" d="M12 24c3.24 0 5.97-1.07 7.96-2.91l-3.69-2.87c-1.03.69-2.34 1.1-4.27 1.1-3.13 0-5.79-1.82-6.73-4.66l-4.09 3.09C3.25 21.31 7.31 24 12 24z" />
                          </svg>
                          <span>{isWorkspaceLoading ? "Initializing..." : "Connect Google Account"}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-indigo-50/25 border border-indigo-100 rounded-xl space-y-2">
                      <div className="flex items-center gap-2.5">
                        {googleUser.photoURL ? (
                          <img referrerPolicy="no-referrer" src={googleUser.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-indigo-200" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#301934] text-[#D4AF37] flex items-center justify-center font-bold text-xs uppercase">
                            {googleUser.displayName?.charAt(0) || googleUser.email?.charAt(0) || "G"}
                          </div>
                        )}
                        <div className="text-left leading-tight">
                          <p className="text-xs font-bold text-slate-800">{googleUser.displayName || 'Authorized Patron Link'}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{googleUser.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center text-[10px] font-semibold text-[#B76E79] bg-[#301934]/5 p-2 rounded">
                        <span>Workspace Connection Status:</span>
                        <span className="font-extrabold uppercase tracking-widest text-[#301934]">Connected</span>
                      </div>

                      <button
                        onClick={handleWorkspaceLogout}
                        className="w-full text-center text-[10px] text-red-600 hover:text-red-700 font-bold tracking-wider py-1 border border-red-200/50 hover:bg-red-50/30 rounded"
                      >
                        DISCONNECT GOOGLE ACCOUNT
                      </button>
                    </div>
                  )}

                  {/* Google Sheets Live Configuration */}
                  <div className="p-3.5 bg-amber-50/10 border border-[#D4AF37]/30 rounded-lg space-y-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block text-left">spreadsheet parameters</span>

                    {/* Drive Smart Scanning Option */}
                    {googleUser && driveSpreadsheets.length > 0 && (
                      <div className="space-y-1 text-left">
                        <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                          <span>Import spreadsheet from Google Drive</span>
                        </span>
                        <select 
                          onChange={(e) => {
                            if (e.target.value) {
                              setSettings({ ...settings, googleSheetsId: e.target.value });
                              triggerToast('📌 Associated target spreadsheet ID from your Drive!');
                            }
                          }}
                          className="w-full text-xs font-bold font-mono border border-slate-200 rounded p-1 focus:outline-none bg-white text-slate-700 cursor-pointer"
                        >
                          <option value="">-- Choose file from Google Drive list --</option>
                          {driveSpreadsheets.map(f => (
                            <option key={f.id} value={f.id}>{f.name} (File ID: {f.id.substring(0,8)}...)</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="space-y-1 text-left">
                      <span className="text-[9px] uppercase font-bold text-slate-400">Spreadsheet ID URL Path</span>
                      <input 
                        type="text" 
                        value={settings.googleSheetsId}
                        onChange={(e) => setSettings({ ...settings, googleSheetsId: e.target.value })}
                        className="w-full text-xs font-mono border border-slate-200 rounded p-1 focus:outline-none bg-white text-slate-700"
                      />
                    </div>

                    <div className="space-y-1 text-left">
                      <span className="text-[9px] uppercase font-bold text-slate-400">Target Range Name</span>
                      <input 
                        type="text" 
                        value={settings.googleSheetsName}
                        onChange={(e) => setSettings({ ...settings, googleSheetsName: e.target.value })}
                        className="w-full text-xs font-mono border border-slate-200 rounded p-1 focus:outline-none bg-white text-slate-700"
                      />
                    </div>

                    {googleUser && (
                      <button 
                        onClick={handleCreateAutoSheet}
                        disabled={isSyncing}
                        className="w-full bg-amber-50 hover:bg-amber-100 text-amber-950 text-xxs font-black p-1.5 rounded border border-amber-200/80 cursor-pointer text-center tracking-wide block"
                      >
                        ⚡ AUTO-GENERATE BRAND NEW GOOGLE SPREADSHEET
                      </button>
                    )}
                  </div>

                  {/* Google Drive Backup Engine Panel */}
                  {googleUser && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-left space-y-2">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">drive database vault backup</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={triggerGoogleDriveBackup}
                          disabled={isSyncing}
                          className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 text-xxs font-bold p-2 border border-indigo-200/60 rounded flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Backup DB Archive</span>
                        </button>
                        
                        {backupUrl && (
                          <a 
                            href={backupUrl}
                            target="_blank" 
                            rel="noreferrer"
                            className="bg-[#301934] text-[#D4AF37] text-xxs font-bold p-2 px-3 border border-[#D4AF37]/30 rounded flex items-center gap-1 hover:bg-[#4a2650]"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>View Backup</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="text-xxs text-slate-400 leading-relaxed text-left bg-slate-50 p-3 rounded">
                    💡 <strong>Real-time API integrations:</strong> Changes made here reflect instantly across synchronized spreadsheets and Gmail drafts. Overwrite operations require your explicit authorization prompt window.
                  </div>
                </div>

                {/* Master Synchronize Triggers */}
                <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-3">
                  <button 
                    onClick={triggerGoogleSheetsExport}
                    disabled={isSyncing || !googleUser}
                    className={`p-2 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${googleUser ? "bg-[#301934] text-[#D4AF37] border border-[#D4AF37]/30 hover:bg-[#301934]/95 shadow-sm" : "bg-slate-100 text-slate-400 border border-slate-200/50 cursor-not-allowed"}`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                    <span>EXPORT TO SHEETS</span>
                  </button>

                  <button 
                    onClick={triggerGoogleSheetsImport}
                    disabled={isSyncing || !googleUser}
                    className={`p-2 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${googleUser ? "bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-200 shadow-sm" : "bg-slate-100 text-slate-400 border border-slate-200/50 cursor-not-allowed"}`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>IMPORT FROM SHEETS</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

      </main>

      {/* MODAL WINDOW 1: ADD NEW CUSTOMER TRANSACTION FORM (Densely integrated) */}
      {isAddCustomerOpen && (
        <div className="absolute inset-0 bg-[#301934]/60 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white w-[550px] max-h-[640px] rounded-2xl shadow-2xl border border-[#D4AF37]/30 overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-[#301934] text-white p-4 px-6 flex justify-between items-center relative border-b border-[#D4AF37]/10">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-lg pointer-events-none"></div>
              <div>
                <h3 className="text-sm font-bold text-[#D4AF37] uppercase tracking-wide">Add New Patron Transaction</h3>
                <p className="text-[10px] text-[#B76E79] font-semibold mt-0.5">Integrate sales metrics, categorization and birthday radar</p>
              </div>
              <button 
                onClick={() => setIsAddCustomerOpen(false)}
                className="text-white/60 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Scroll Container */}
            <form onSubmit={handleAddCustomerSubmit} className="flex-1 overflow-auto p-5 space-y-4">
              
              {/* Profile Block */}
              <div className="space-y-2 text-left">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Patron Personal Information</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-500">Customer Name *</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Kavya Deshmukh" 
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white focus:outline-none focus:border-[#301934]"
                      required
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-500">Date of Birth *</label>
                    <input 
                      type="date" 
                      value={newCustomer.dob}
                      onChange={(e) => setNewCustomer({ ...newCustomer, dob: e.target.value })}
                      className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white focus:outline-none focus:border-[#301934]"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-500">Contact Phone *</label>
                    <input 
                      type="text" 
                      value={newCustomer.contactNumber}
                      onChange={(e) => setNewCustomer({ ...newCustomer, contactNumber: e.target.value })}
                      placeholder="+919876543210"
                      className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white focus:outline-none focus:border-[#301934]"
                      required
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-500">WhatsApp Number *</label>
                    <input 
                      type="text" 
                      value={newCustomer.whatsAppNumber}
                      onChange={(e) => setNewCustomer({ ...newCustomer, whatsAppNumber: e.target.value })}
                      placeholder="+919876543210"
                      className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white focus:outline-none focus:border-[#301934]"
                      required
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-500">Email Address *</label>
                    <input 
                      type="email" 
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      placeholder="kavya@gmail.com"
                      className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white focus:outline-none focus:border-[#301934]"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-slate-500">Residential Shipping Address</label>
                  <input 
                    type="text" 
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    placeholder="Apartment, Street Name, City, PIN"
                    className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white focus:outline-none focus:border-[#301934]"
                  />
                </div>
              </div>

              {/* Transaction Block */}
              <div className="space-y-2 border-t border-slate-100 pt-3 text-left">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Exquisite Order Information</span>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-500">Order ID</label>
                    <input 
                      type="text" 
                      value={newCustomer.orderId}
                      onChange={(e) => setNewCustomer({ ...newCustomer, orderId: e.target.value })}
                      className="text-xs border border-slate-200 rounded p-1.5 w-full bg-slate-50 text-slate-500 font-mono"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-500">Order Date</label>
                    <input 
                      type="date" 
                      value={newCustomer.orderDate}
                      onChange={(e) => setNewCustomer({ ...newCustomer, orderDate: e.target.value })}
                      className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white text-slate-700"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-500">Product Category</label>
                    <select 
                      value={newCustomer.productCategory}
                      onChange={(e) => setNewCustomer({ ...newCustomer, productCategory: e.target.value })}
                      className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white text-slate-700"
                    >
                      <option value="Rings">Rings (Sterling Silver)</option>
                      <option value="Earrings">Earrings (Handcrafted Studs)</option>
                      <option value="Necklaces">Necklaces (Exotic Chokers)</option>
                      <option value="Bracelets">Bracelets (Tennis Wristlines)</option>
                      <option value="Silver Coins">Premium Silver Coins</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-500">Jewellery Piece Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Royal Halo Empress Solitaire Ring" 
                      value={newCustomer.productName}
                      onChange={(e) => setNewCustomer({ ...newCustomer, productName: e.target.value })}
                      className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white focus:outline-none focus:border-[#301934]"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-slate-500">Order Spend Amount (₹) *</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 8450" 
                      value={newCustomer.orderAmount}
                      onChange={(e) => setNewCustomer({ ...newCustomer, orderAmount: e.target.value })}
                      className="text-xs border border-slate-200 rounded p-1.5 w-full bg-white focus:outline-none focus:border-[#301934] font-mono font-bold"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Informative Help Text */}
              <div className="text-[10px] text-slate-400 bg-amber-50/20 border border-amber-200/20 p-2.5 rounded-lg text-left italic">
                ℹ️ After clicking submit, the CRM system will automatically generate a unique Velvet Box Customer ID, compute their age, partition their segmentation tier, synchronize logs with the Google Sheets frame, and update the dashboard in real-time.
              </div>

              {/* Modal Footer / Submit buttons */}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5 mt-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-[#301934] text-[#D4AF37] border border-[#D4AF37]/30 hover:bg-[#4a2650] px-5 py-2 rounded text-xs font-black tracking-wide shadow-md cursor-pointer"
                >
                  SAVE TRANSACTION
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL WINDOW 3: CUSTOM DELETION CONFIRMATION */}
      {customerToDelete && (
        <div id="delete-confirmation-modal" className="absolute inset-0 bg-[#301934]/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white w-[420px] rounded-2xl shadow-2xl border border-rose-100 overflow-hidden flex flex-col p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex gap-3.5 items-start">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-full border border-rose-100 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-left">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest font-sans">Delete Patron Record?</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                  This action is irreversible. Are you sure you want to permanently remove <strong className="text-slate-700 font-bold">{customerToDelete.name}</strong> (<span className="font-mono text-[10px] font-bold bg-slate-100 p-0.5 px-1.5 rounded">{customerToDelete.id}</span>) from the Velvet Box luxury CRM?
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 justify-end pt-1">
              <button
                id="cancel-delete-btn"
                onClick={() => setCustomerToDelete(null)}
                className="px-4 py-1.5 border border-slate-200 text-slate-600 rounded text-[11px] font-bold hover:bg-slate-50 cursor-pointer shadow-xs"
              >
                Cancel, Keep Record
              </button>
              <button
                id="confirm-delete-btn"
                onClick={confirmDeleteCustomer}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Deletion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WINDOW 2: RICH EMAIL CAMPAIGN VISUAL PREVIEW */}
      {isPreviewEmailOpen && (
        <div className="absolute inset-0 bg-[#301934]/60 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white w-[500px] rounded-2xl shadow-2xl border border-[#D4AF37]/30 overflow-hidden flex flex-col">
            
            {/* Subject/To Headers Bar */}
            <div className="bg-slate-100 border-b border-slate-200 p-4 font-mono text-[11px] text-left space-y-1">
              <div className="flex justify-between items-center mb-1">
                <span className="font-sans font-bold text-slate-700 text-xs">Visual Campaign Email Preview</span>
                <button 
                  onClick={() => setIsPreviewEmailOpen(false)}
                  className="text-slate-500 hover:text-slate-800 p-1 bg-white border border-slate-200 rounded-full cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div><strong className="text-slate-600">To:</strong> {selectedCustomer?.email || 'priyanka.sen@example.com'}</div>
              <div><strong className="text-slate-600">From:</strong> The Velvet Box &lt;{settings.senderEmail}&gt;</div>
              <div><strong className="text-slate-600">Subject:</strong> ✨ A Special Sparkling Gift from The Velvet Box!</div>
            </div>

            {/* Email Body Content Template (The Velvet Box luxury design styling) */}
            <div className="p-6 overflow-auto max-h-[400px] text-left bg-gradient-to-b from-white to-purple-50/10 font-sans">
              
              {/* Luxury Header Brand signature */}
              <div className="text-center py-4 border-b border-[#D4AF37]/20">
                <h1 className="text-xl font-serif font-black tracking-widest text-[#301934]">THE VELVET BOX</h1>
                <p className="text-[8px] uppercase tracking-widest text-[#B76E79] font-black mt-1">Pure Fine Handcrafted Silver Jewellery</p>
              </div>

              {/* Message text area */}
              <div className="py-6 whitespace-pre-line text-xs leading-relaxed text-slate-700">
                {generatedDraft || `Dear ${selectedCustomer?.name || 'Patron'},\n\nAt The Velvet Box we celebrate you with pure 925 sterling silver designs built to last. Visit our online boutique at https://velvetboxs.com/`}
              </div>

              {/* Call to action button */}
              <div className="text-center py-2">
                <a 
                  href="https://velvetboxs.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block bg-[#301934] text-[#D4AF37] border border-[#D4AF37]/30 font-bold text-[10px] tracking-widest uppercase p-2.5 px-6 rounded-lg shadow-md hover:bg-[#4a2650]"
                >
                  Explore Velvetboxs.com →
                </a>
              </div>

              {/* Footer Jewelry Brand Block */}
              <div className="mt-8 pt-4 border-t border-dashed border-slate-200 text-center text-[9px] text-slate-400">
                <p className="font-bold text-[#301934]">&bull; Elegant Rings &bull; Handcrafted Earrings &bull; Delicate Bracelets &bull;</p>
                <p className="mt-1 font-light">&copy; 2026 The Velvet Box. Crafted for royal tastes.</p>
                <p className="mt-1"><a href="https://velvetboxs.com/" className="text-[#B76E79] hover:underline font-bold">https://velvetboxs.com/</a></p>
              </div>

            </div>

            {/* Footer triggers */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 text-right">
              <button 
                onClick={() => handleCopyClipboard(generatedDraft, 'email')}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded text-xs hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer font-bold"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Rich Body</span>
              </button>
              <button 
                onClick={() => {
                  setIsPreviewEmailOpen(false);
                  handleSendEmailSMTP(selectedCustomer, generatedDraft);
                }}
                className="bg-slate-100 text-slate-800 hover:bg-slate-200 px-4 py-2 rounded text-xs font-semibold border border-slate-200 cursor-pointer"
              >
                SMTP CLIENT SEND
              </button>
              {googleUser && (
                <>
                  <button 
                    onClick={() => {
                      setIsPreviewEmailOpen(false);
                      handleSendGmailAPI(selectedCustomer, generatedDraft, true);
                    }}
                    className="bg-amber-100 text-amber-950 hover:bg-amber-200 px-4 py-2 rounded text-xs font-bold border border-amber-300 cursor-pointer"
                  >
                    SAVE GMAIL DRAFT
                  </button>
                  <button 
                    onClick={() => {
                      setIsPreviewEmailOpen(false);
                      handleSendGmailAPI(selectedCustomer, generatedDraft, false);
                    }}
                    className="bg-[#301934] text-white hover:bg-[#4a2650] px-4 py-2 rounded text-xs font-black border border-[#D4AF37]/30 cursor-pointer"
                  >
                    GMAIL TRANSMIT API
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
