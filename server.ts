import express from "express";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import twilio from "twilio";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("Gemini AI client successfully initialized on the server!");
  } catch (err) {
    console.error("Error initializing Gemini AI Client:", err);
  }
} else {
  console.log("No valid GEMINI_API_KEY. Fallback template system will be used.");
}

// REST API for intelligent campaigns
app.post("/api/gemini/generate", async (req, res) => {
  const {
    promptType,
    customerName,
    purchaseHistory,
    productCategory,
    customerStatus,
    additionalDetails = "",
    customApiKey,
  } = req.body;

  if (!customerName) {
    return res.status(400).json({ error: "Customer Name is required" });
  }

  // Beautiful fallback layouts for premium jewellery branding (The Velvet Box)
  const getFallbackMessage = (type: string) => {
    const brand = "The Velvet Box";
    const website = "https://velvetboxs.com/";
    const mainCategory = productCategory || "Premium Silver Jewellery";
    const parsedNote = additionalDetails ? `\nNote: ${additionalDetails}` : "";

    switch (type) {
      // BIRTHDAYS
      case "birthday_sms":
        return `Happy Birthday, ${customerName}! ✨ Bask in royal luxury on your special day. To celebrate, enjoy 15% off our exquisite silver jewellery inside ${mainCategory}. Use code: BDAY15. Elegant designs await you at ${website} - ${brand}`;
      
      case "birthday_whatsapp":
        return `Dear ${customerName}, \n\n✨ *Happy Birthday from The Velvet Box!* ✨\n\nOn this beautiful day, we wish you joy, sparkles, and laughter. To make your celebration even more memorable, we would love to gift you an exclusive *15% OFF* on our handcrafted premium silver jewellery collection. \n\n🎁 Your special birthday treat code: *VELVETBDAY*\n\nExplore our latest rings, necklaces, and bracelets to find your birthday shine:\n🔗 ${website}\n\nHave a magical day!\nWarmest regards,\n*The Velvet Box*`;
      
      case "birthday_email":
        return `Subject: Happy Birthday, ${customerName}! ✨ Your Special Gift inside from The Velvet Box\n\nDear ${customerName},\n\nAt The Velvet Box, we believe that life should be celebrated with sparkle and elegance. Today, we celebrate YOU!\n\nWe would love to wish you a very warm and Happy Birthday! May your day be as radiant and lovely as our fine handcrafted silver jewellery.\n\nTo make your day extra special, enjoy an exclusive 15% discount on our entire collection of rings, necklaces, earrings, and classic daily wear pieces.\n\nYour Birthday Promo Code: BDAYELEGANCE\nShop now: ${website}\n\nThank you for being part of our precious family. We look forward to adorning you. \n\nSparkling wishes,\nThe Velvet Box Team\n${website}`;

      // OFFERS
      case "offer_sms":
        return `Hello ${customerName}! ✨ Indulge in pure elegance with The Velvet Box. Since you loved our ${mainCategory} designs, enjoy a special offer: Buy 1 Get 1 on our exquisite premium silver line. Visit ${website} to redeem!${parsedNote}`;
      case "offer":
      case "offer_whatsapp":
        return `Hello ${customerName}, \n\n✨ *Special Offer from The Velvet Box!* ✨\n\nSince you loved our premium *${mainCategory}* collections, we would love to offer you an exclusive buy one get one deal on our silver jewelry masterpieces.\n\n🎁 Promo treat: *SEASONSILVER*\n🔗 Explore online: ${website}\n\n${additionalDetails ? `✨ *Offer details:* ${additionalDetails}\n\n` : ""}Bask in luxury!\nWarm regards,\n*The Velvet Box*`;
      case "offer_email":
        return `Subject: Special Buy 1 Get 1 Free Promo for ${customerName} - The Velvet Box\n\nDear ${customerName},\n\nWe noticed you appreciate the luxury and fine details of our handcrafted ${mainCategory} collections.\n\nTo thank you, we are delighted to offer you key priority access to our Buy 1 Get 1 Free deal on our absolute premium silver jewellery line. Find rings, necklaces, and classic earrings matching your style.\n\nYour Redemption Code: BOGOSILVER\nExplore catalog: ${website}\n\n${additionalDetails ? `Specials: ${additionalDetails}\n\n` : ""}Warm greetings,\nThe Velvet Box Team`;

      // FESTIVALS
      case "festival_sms":
        return `Season's Greetings, ${customerName}! ✨ May your festive days shine as bright as our handcrafted silver. Explore our sparkling new collections and add a perfect touch of luxury to your celebrations. Shop at ${website} - ${brand}.${parsedNote}`;
      case "festival":
      case "festival_whatsapp":
        return `Season's Greetings, ${customerName}! ✨\n\nMay your festive days shine as bright as our handcrafted silver. We've compiled premium new arrivals in *${mainCategory}* for you to select. Enjoy priority delivery.\n\n🎁 Shop collections: ${website}\n\n${additionalDetails ? `✨ *Special info:* ${additionalDetails}\n` : ""}\nWarm greetings,\n*The Velvet Box Team*`;
      case "festival_email":
        return `Subject: Festive Blessings & New Silver Handcrafts from The Velvet Box, ${customerName}\n\nDear ${customerName},\n\nMay the coming festive season bring joy, sparkling light, and boundless prosperity to you and your home.\n\nTo make your celebrations memorable, we have launched our Royal sterling silver jewellery collections. Choose from sparkling rings, detailed necklaces, and elegant earrings built to shimmer.\n\nBrowse catalog: ${website}\n\n${additionalDetails ? `Note from our curators: ${additionalDetails}\n\n` : ""}Celebrate beauty & heritage.\n\nWarm regards,\nThe Velvet Box`;

      // REPEATS / VIP REWARDS
      case "repeat_sms":
        return `Dear ${customerName}, as a valued repeat patron of The Velvet Box, we celebrate your love for premium ${mainCategory}! Enjoy priority access to limited custom drops & early previews. Direct shop: ${website}.${parsedNote}`;
      case "repeat_purchase":
      case "repeat_whatsapp":
        return `Dear ${customerName}, \n\nAt *The Velvet Box*, your loyalty is our highest jewel metrics. \n\nBecause you are a highly regarded patron of our *${mainCategory}* collections, we invite you to preview our confidential silver vaults before the public launch.\n\n🗝️ View Private Vault: ${website}\n\n${additionalDetails ? `✨ *Curator note:* ${additionalDetails}\n\n` : ""}Thank you for choosing pure 925 handcrafted sterling silver.\nWarm regards,\n*The Velvet Box*`;
      case "repeat_email":
        return `Subject: Inside The Velvet Box Private Vault — Early Access for ${customerName}\n\nDear ${customerName},\n\nYour support has made you one of our highly respected repeat patrons.\n\nToday, we are opening early access to our premium upcoming handcrafted silver catalogue. Explore custom pieces finished in pure 925 silver with gem overlays.\n\nSecure preview: ${website}\n\n${additionalDetails ? `Note regarding this drop: ${additionalDetails}\n\n` : ""}Thank you for your ongoing elegant choice.\n\nSincerely,\nThe Velvet Box Team`;

      default:
        return `Dear ${customerName}, warm greetings from The Velvet Box! Discover our pure handcrafted 925 sterling silver treasures at ${website}`;
    }
  };

  // Determine active Gemini engine context
  let activeAi = ai;
  const userProvidedKey = customApiKey && customApiKey !== "Injected Server-Side" && customApiKey.trim() !== "";
  
  if (userProvidedKey) {
    try {
      activeAi = new GoogleGenAI({
        apiKey: customApiKey.trim(),
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      console.log("Dynamically initialized client with user's custom connected Gemini API Key!");
    } catch (err) {
      console.error("Failed to construct GoogleGenAI with client provided key:", err);
    }
  }

  // If Gemini is configured, use it! Otherwise, fall back
  if (activeAi) {
    try {
      const promptInstruction = `
        You are a highly professional, luxurious, and elegant copywriter for "The Velvet Box" (Website: https://velvetboxs.com/), a premium silver jewellery D2C brand.
        Generate a highly personalized, high-converting, premium marketing message for a customer.
        The message should sound sophisticated, luxurious, exclusive, warm, and highly personalized based on the customer details provided.
        
        Customer Details:
        - Customer Name: ${customerName}
        - Customer Purchase History: ${purchaseHistory || "Premium silver jewelry pieces"}
        - Favorite Category Reference: ${productCategory || "Pure Sterling Silver Jewellery"}
        - Customer Status: ${customerStatus || "Valued Customer"}
        - Custom Note / Offer / Topic: ${additionalDetails}
        
        Campaign Target / Channel: ${promptType}
        
        Requirements:
        1. Keep it suitable for the channel. SMS should be short, concise, high impact. Email should have a elegant subject line with elegant luxury greetings. WhatsApp should contain elegant bullet points or bold labels and emojis (like sparkles ✨, gift 🎁, rings 💍, gemstone 💎).
        2. Strictly include the brand name "The Velvet Box" and website link "https://velvetboxs.com/".
        3. For birthday prompts, wish them a warm, sparkling birthday and offer premium jewellery-related blessings.
        4. Do NOT output any explanation, markdown backticks, or system codes. output ONLY the final ready-to-copy marketing/greetings text.
      `;

      const response = await activeAi.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptInstruction,
      });

      const text = response.text?.trim();
      if (text) {
        return res.json({ message: text, aiGenerated: true, utilizedKey: userProvidedKey ? "client" : "system" });
      }
    } catch (err: any) {
      const isQuota = !!(err?.message?.includes("quota") || err?.message?.includes("Quota") || err?.message?.includes("429") || err?.status === "RESOURCE_EXHAUSTED");
      console.log(`[Campaign Fallback] Handled user campaign draft gracefully. (Quota Limit Exceeded: ${isQuota})`);
      const generatedMessage = getFallbackMessage(promptType);
      return res.json({
        message: generatedMessage,
        aiGenerated: false,
        fellBack: true,
        quotaExceeded: isQuota,
        errorMessage: err?.message || "Service Limit Met",
        reason: "Gemini server rate limits exceeded (Resource Exhausted)"
      });
    }
  }

  // Fallback generation if no active AI or if API call fails
  const generatedMessage = getFallbackMessage(promptType);
  return res.json({ 
    message: generatedMessage, 
    aiGenerated: false,
    fellBack: true,
    reason: "Gemini server load or unavailability state"
  });
});

// Real Settings API: Dynamically persist a system-wide Backend Gemini API Key
app.post("/api/settings/save-backend-key", (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || apiKey.trim() === "") {
    return res.status(400).json({ error: "API Key parameter is required" });
  }

  try {
    const cleanKey = apiKey.trim();
    const envPath = path.join(process.cwd(), ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
    }

    if (envContent.includes("GEMINI_API_KEY=")) {
      envContent = envContent.replace(/GEMINI_API_KEY=.*/, `GEMINI_API_KEY="${cleanKey}"`);
    } else {
      envContent += `\nGEMINI_API_KEY="${cleanKey}"\n`;
    }

    fs.writeFileSync(envPath, envContent, "utf-8");
    process.env.GEMINI_API_KEY = cleanKey;

    // Dynamically update the backend global Gemini instance
    ai = new GoogleGenAI({
      apiKey: cleanKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    console.log("Successfully stored and reconfigured server-wide Gemini API Client with real key.");
    return res.json({ 
      success: true, 
      message: "Server connected and fully initialized with your verified backend Gemini API Key!" 
    });
  } catch (err: any) {
    console.error("Error committing Gemini API Key to server:", err);
    return res.status(500).json({ error: "Failed to persist backend API key: " + (err.message || String(err)) });
  }
});

// Real SMTP Dispatch API using Nodemailer
app.post("/api/email/send-smtp", async (req, res) => {
  const { 
    to, 
    subject, 
    body, 
    smtpServer, 
    smtpPort, 
    smtpPassword, 
    senderEmail, 
    senderName 
  } = req.body;

  if (!to || !body) {
    return res.status(400).json({ error: "To address and Email body are required parameters" });
  }

  // If no SMTP password provided, we operate as a real verification failure/demo dispatcher
  if (!smtpServer || !senderEmail || !smtpPassword || smtpPassword.trim() === "") {
    return res.status(400).json({ 
      error: "SMTP configuration is incomplete. Please specify a Server, Sender Email, and SMTP Password/App Key under settings to dispatch real emails." 
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpServer,
      port: parseInt(smtpPort || "465", 10),
      secure: smtpPort === "465",
      auth: {
        user: senderEmail,
        pass: smtpPassword,
      },
    });

    const mailOptions = {
      from: `"${senderName || "The Velvet Box"}" <${senderEmail}>`,
      to,
      subject: subject || "A Special Note from The Velvet Box",
      text: body,
      html: `<div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eaeaea; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="text-align: center; border-bottom: 2px solid #301934; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #301934; margin: 0; font-family: serif; letter-spacing: 2px;">THE VELVET BOX</h2>
          <p style="font-size: 10px; color: #B76E79; text-transform: uppercase; margin: 5px 0 0; font-weight: bold; letter-spacing: 1px;">Pure Fine Handcrafted Silver Jewellery</p>
        </div>
        <div style="font-size: 14px; line-height: 1.6; color: #4a5568; white-space: pre-wrap;">
          ${body.replace(/\*/g, "") /* clean simple formatting */}
        </div>
        <div style="margin-top: 30px; padding-top: 15px; border-t: 1px dashed #e2e8f0; text-align: center; font-size: 11px; color: #a0aec0;">
          <p style="margin: 0; font-weight: bold; color: #301934;">&bull; Elegant Rings &bull; Handcrafted Earrings &bull; Delicate Bracelets &bull;</p>
          <p style="margin: 5px 0 0;">&copy; 2026 The Velvet Box. Crafted for royal tastes.</p>
        </div>
      </div>`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email successfully blasted:", info.messageId);
    return res.json({ 
      success: true, 
      messageId: info.messageId, 
      message: `Email broadcast dispatched securely to ${to}!` 
    });
  } catch (err: any) {
    console.error("SMTP error during dispatch:", err);
    return res.status(500).json({ 
      error: `SMTP connection failed: ${err.message || 'Verification Error'}. Check your Port, SMTP passcode/app key, or mail security configurations.` 
    });
  }
});

// Real Twilio SMS Gateway Dispatch API
app.post("/api/sms/send-twilio", async (req, res) => {
  const { 
    to, 
    body, 
    twilioAccountSid, 
    twilioAuthToken, 
    twilioFromNumber 
  } = req.body;

  if (!to || !body) {
    return res.status(400).json({ error: "Recipient phone 'to' and message 'body' are required" });
  }

  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    return res.status(400).json({ 
      error: "Twilio credentials incomplete! Please enter Account SID, Auth Token, and From Number in settings to dispatch real SMS campaigns." 
    });
  }

  try {
    const client = twilio(twilioAccountSid, twilioAuthToken);
    const message = await client.messages.create({
      body: body,
      from: twilioFromNumber,
      to: to
    });

    console.log("SMS sent via Twilio details:", message.sid);
    return res.json({ 
      success: true, 
      messageSid: message.sid, 
      message: `SMS Campaign Dispatched to ${to} via real Twilio API!` 
    });
  } catch (err: any) {
    console.error("Twilio error:", err);
    return res.status(500).json({ 
      error: `Twilio delivery failed: ${err.message || "Invalid Token credentials"}.` 
    });
  }
});

// Configure Vite middleware or serve static files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware loaded.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production assets from /dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`The Velvet Box CRM Server listening on port ${PORT}`);
  });
}

startServer();
