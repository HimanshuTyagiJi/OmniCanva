// =====================================================
// STUDYCRAFT — Google Apps Script
// Ye script Google Apps Script mein paste karo
// script.google.com → New Project
// =====================================================
//
// SETUP STEPS:
// 1. script.google.com pe jaao
// 2. New Project banao
// 3. Ye poora code paste karo
// 4. SHEET_ID mein apna Google Sheet ID daalo
// 5. Deploy → Web App → Anyone can access
// 6. Web App URL copy karo → _config.yml mein daalo
// =====================================================

const SHEET_ID   = 'YOUR_GOOGLE_SHEET_ID_HERE';   // ← CHANGE THIS
const SHEET_NAME = 'Payments';
const TOKEN_EXPIRY_HOURS = 24;

// ===== WEB APP ENTRY POINT =====
function doPost(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;

    if (action === 'verifyPayment') {
      return verifyPayment(params);
    }

    return jsonResponse({ status: 'error', message: 'Unknown action' });
  } catch(err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;

    if (action === 'validateToken') {
      return validateToken(params.token);
    }
    if (action === 'adminView') {
      return adminView();
    }

    return jsonResponse({ status: 'ok', message: 'StudyCraft API running' });
  } catch(err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ===== VERIFY PAYMENT =====
function verifyPayment(params) {
  const orderId = (params.orderId || '').trim().toUpperCase();
  const email   = (params.email || '').trim().toLowerCase();

  if (!orderId || !email) {
    return jsonResponse({ status: 'error', message: 'Order ID aur email required hai' });
  }

  const sheet = getSheet();

  // 1. Check if already verified
  const existing = findRow(sheet, orderId);
  if (existing) {
    if (existing.status === 'verified') {
      // Token regenerate karo (if expired)
      if (isTokenExpired(existing.tokenExpiry)) {
        const newToken = generateToken();
        const newExpiry = getExpiryTime();
        updateRow(sheet, existing.row, { token: newToken, tokenExpiry: newExpiry });
        return jsonResponse({
          status: 'verified',
          token: newToken,
          templateId: existing.templateId,
          message: 'Payment verified! Download link generated.'
        });
      }
      return jsonResponse({
        status: 'verified',
        token: existing.token,
        templateId: existing.templateId,
        message: 'Already verified!'
      });
    }
    if (existing.status === 'pending') {
      return jsonResponse({ status: 'pending', message: 'Tera request pending hai. Thoda wait karo.' });
    }
  }

  // 2. Search in Gmail for this Order ID
  const gmailData = searchGmail(orderId);

  if (gmailData.found) {
    // Auto-verified from Gmail!
    const token = generateToken();
    const expiry = getExpiryTime();

    const rowData = {
      orderId: orderId,
      email: email,
      amount: gmailData.amount,
      from: gmailData.from,
      date: gmailData.date,
      status: 'verified',
      token: token,
      tokenExpiry: expiry,
      templateId: 'general',  // Default — template-specific logic baad mein
      verifiedAt: new Date().toISOString(),
      notes: 'Auto-verified via Gmail'
    };

    appendRow(sheet, rowData);

    // Send email with download link
    sendDownloadEmail(email, token, orderId, gmailData.amount);

    return jsonResponse({
      status: 'verified',
      token: token,
      templateId: 'general',
      amount: gmailData.amount,
      message: 'Payment verified automatically!'
    });

  } else {
    // Not found in Gmail — add as pending
    const rowData = {
      orderId: orderId,
      email: email,
      amount: '',
      from: '',
      date: '',
      status: 'pending',
      token: '',
      tokenExpiry: '',
      templateId: '',
      verifiedAt: '',
      notes: 'Pending manual review'
    };

    // Check if already in sheet as pending
    if (!existing) {
      appendRow(sheet, rowData);
    }

    // Send confirmation email
    sendPendingEmail(email, orderId);

    return jsonResponse({
      status: 'pending',
      message: 'Order ID Gmail mein nahi mila. Manual verify hogi — 1-2 ghante mein download link email pe aayega.'
    });
  }
}

// ===== GMAIL SEARCH =====
function searchGmail(orderId) {
  try {
    // Paytm email search
    const query = `from:noreply@paytm.com subject:"Payment Received" "${orderId}"`;
    const threads = GmailApp.search(query, 0, 5);

    for (const thread of threads) {
      const messages = thread.getMessages();
      for (const msg of messages) {
        const body = msg.getPlainBody() + msg.getBody();

        if (body.includes(orderId)) {
          // Extract amount
          const amountMatch = body.match(/₹\s*([\d,]+(?:\.\d{1,2})?)/);
          const amount = amountMatch ? amountMatch[1].replace(',','') : '0';

          // Extract from UPI
          const fromMatch = body.match(/From\s*\n([^\n]+)/i) || body.match(/BHIM UPI ([^\s<]+)/i);
          const from = fromMatch ? fromMatch[1].trim() : 'Unknown';

          return {
            found: true,
            orderId: orderId,
            amount: amount,
            from: from,
            date: msg.getDate().toISOString(),
            subject: msg.getSubject()
          };
        }
      }
    }

    // Also try: Paytm pe amount & order_id format different bhi ho sakta hai
    const query2 = `from:noreply@paytm.com "Order ID: ${orderId}"`;
    const threads2 = GmailApp.search(query2, 0, 3);
    for (const thread of threads2) {
      const messages = thread.getMessages();
      for (const msg of messages) {
        const body = msg.getPlainBody();
        if (body.includes(orderId)) {
          const amountMatch = body.match(/₹\s*([\d,]+)/);
          return {
            found: true,
            orderId: orderId,
            amount: amountMatch ? amountMatch[1] : '0',
            from: 'Paytm UPI',
            date: msg.getDate().toISOString(),
            subject: msg.getSubject()
          };
        }
      }
    }

    return { found: false };
  } catch(e) {
    console.error('Gmail search error:', e);
    return { found: false };
  }
}

// ===== VALIDATE DOWNLOAD TOKEN =====
function validateToken(token) {
  if (!token) return jsonResponse({ valid: false, message: 'Token missing' });

  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowToken = row[6]; // token column
    const rowExpiry = row[7]; // tokenExpiry column
    const templateId = row[8];
    const status = row[5];

    if (rowToken === token && status === 'verified') {
      // Check expiry
      if (rowExpiry && new Date() > new Date(rowExpiry)) {
        return jsonResponse({ valid: false, message: 'Download link expire ho gayi. Nayi link generate karo.' });
      }

      // Get file URL for this template
      const fileUrl = getTemplateFileUrl(templateId);

      return jsonResponse({
        valid: true,
        fileUrl: fileUrl,
        fileName: `${templateId || 'template'}.zip`,
        expiresAt: rowExpiry,
        templateId: templateId
      });
    }
  }

  return jsonResponse({ valid: false, message: 'Invalid token' });
}

// ===== GET TEMPLATE FILE URL =====
// Yahan apni template files ke Google Drive links daalo
function getTemplateFileUrl(templateId) {
  const fileMap = {
    'resume-001': 'https://drive.google.com/uc?export=download&id=YOUR_FILE_ID',
    'resume-002': 'https://drive.google.com/uc?export=download&id=YOUR_FILE_ID',
    'pdf-001':    'https://drive.google.com/uc?export=download&id=YOUR_FILE_ID',
    'pdf-003':    'https://drive.google.com/uc?export=download&id=YOUR_FILE_ID',
    'svg-002':    'https://drive.google.com/uc?export=download&id=YOUR_FILE_ID',
    'image-002':  'https://drive.google.com/uc?export=download&id=YOUR_FILE_ID',
    'image-003':  'https://drive.google.com/uc?export=download&id=YOUR_FILE_ID',
    'video-001':  'https://drive.google.com/uc?export=download&id=YOUR_FILE_ID',
    'video-002':  'https://drive.google.com/uc?export=download&id=YOUR_FILE_ID',
    'general':    'https://drive.google.com/uc?export=download&id=YOUR_FILE_ID',
  };
  return fileMap[templateId] || fileMap['general'];
}

// ===== EMAIL FUNCTIONS =====
function sendDownloadEmail(email, token, orderId, amount) {
  try {
    const downloadUrl = `https://templates.gklearnstudy.in/download/?token=${token}`;
    const subject = '✅ StudyCraft — Your Download Link is Ready!';
    const body = `
Namaste! 🙏

Tera payment verify ho gaya. Order ID: ${orderId} | Amount: ₹${amount}

Neeche link se template download karo:
${downloadUrl}

⏰ Ye link 24 ghante mein expire ho jaayegi.

Koi problem ho toh reply karo.

— StudyCraft Team
templates.gklearnstudy.in
    `.trim();

    GmailApp.sendEmail(email, subject, body);
  } catch(e) {
    console.error('Email send error:', e);
  }
}

function sendPendingEmail(email, orderId) {
  try {
    const subject = '📨 StudyCraft — Payment Verification Pending';
    const body = `
Namaste!

Tera Order ID ${orderId} receive ho gaya.

Hum verify kar rahe hain. 1-2 ghante mein download link is email pe bheja jaayega.

Business hours: 9 AM – 9 PM (Mon–Sat)

— StudyCraft Team
    `.trim();

    GmailApp.sendEmail(email, subject, body);
  } catch(e) {
    console.error('Pending email error:', e);
  }
}

// ===== SHEET FUNCTIONS =====
function getSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Headers
    sheet.appendRow([
      'Order ID', 'Email', 'Amount (₹)', 'From UPI', 'Payment Date',
      'Status', 'Download Token', 'Token Expiry', 'Template ID',
      'Verified At', 'Notes'
    ]);
    sheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#4f8eff').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function appendRow(sheet, data) {
  sheet.appendRow([
    data.orderId, data.email, data.amount, data.from, data.date,
    data.status, data.token, data.tokenExpiry, data.templateId,
    data.verifiedAt, data.notes
  ]);
}

function findRow(sheet, orderId) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toUpperCase() === orderId) {
      return {
        row: i + 1,
        orderId: data[i][0],
        email: data[i][1],
        amount: data[i][2],
        status: data[i][5],
        token: data[i][6],
        tokenExpiry: data[i][7],
        templateId: data[i][8]
      };
    }
  }
  return null;
}

function updateRow(sheet, rowNum, updates) {
  if (updates.token) sheet.getRange(rowNum, 7).setValue(updates.token);
  if (updates.tokenExpiry) sheet.getRange(rowNum, 8).setValue(updates.tokenExpiry);
  if (updates.status) sheet.getRange(rowNum, 6).setValue(updates.status);
}

// ===== UTILS =====
function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = 'SC-';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function getExpiryTime() {
  const d = new Date();
  d.setHours(d.getHours() + TOKEN_EXPIRY_HOURS);
  return d.toISOString();
}

function isTokenExpired(expiry) {
  if (!expiry) return true;
  return new Date() > new Date(expiry);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== GMAIL AUTO-SYNC (Optional Trigger) =====
// Ye function time-trigger se chalao: har 30 min
// Triggers → Add Trigger → gmailAutoSync → Time-driven → Every 30 mins
function gmailAutoSync() {
  const query = 'from:noreply@paytm.com subject:"Payment Received" is:unread newer_than:2d';
  const threads = GmailApp.search(query, 0, 20);
  const sheet = getSheet();

  for (const thread of threads) {
    const messages = thread.getMessages();
    for (const msg of messages) {
      const body = msg.getPlainBody();

      // Extract Order ID
      const orderMatch = body.match(/Order ID:\s*(T\d+)/i);
      if (!orderMatch) continue;
      const orderId = orderMatch[1];

      // Extract amount
      const amountMatch = body.match(/₹\s*([\d,]+)/);
      const amount = amountMatch ? amountMatch[1].replace(',','') : '0';

      // Check if pending in sheet
      const existing = findRow(sheet, orderId);
      if (existing && existing.status === 'pending') {
        // Auto verify!
        const token = generateToken();
        const expiry = getExpiryTime();
        updateRow(sheet, existing.row, {
          token: token,
          tokenExpiry: expiry,
          status: 'verified'
        });
        sheet.getRange(existing.row, 10).setValue(new Date().toISOString());
        sheet.getRange(existing.row, 11).setValue('Auto-verified via Gmail sync');

        // Send download email
        sendDownloadEmail(existing.email, token, orderId, amount);
      }

      // Mark email as read
      msg.markRead();
    }
  }
}
