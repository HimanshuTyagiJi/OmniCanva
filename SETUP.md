# StudyCraft — Setup Guide
**templates.gklearnstudy.in**

---

## 📁 Files Structure
```
studycraft/
├── _layouts/default.html     → Main layout (navbar, footer)
├── assets/css/main.css       → Full CSS (dark/light theme)
├── assets/js/theme.js        → Theme toggle
├── assets/js/main.js         → Toast, animations
├── index.html                → Homepage
├── templates/index.html      → All templates page
├── pages/verify.html         → Payment verify page ⭐
├── pages/download.html       → Secure download page
├── google-apps-script.js     → Google Script (copy this separately)
├── _config.yml               → Jekyll config
└── Gemfile                   → Ruby gems
```

---

## 🚀 STEP 1 — GitHub Setup

```bash
# GitHub pe new repository banao: studycraft
# Public repo (GitHub Pages free mein)

# Ya command line se:
git init
git add .
git commit -m "Initial StudyCraft site"
git remote add origin https://github.com/TERA_USERNAME/studycraft.git
git push -u origin main
```

**GitHub → Settings → Pages → Source: main branch → Save**

Site live: `https://TERA_USERNAME.github.io/studycraft/`

---

## 🌐 STEP 2 — Subdomain Setup (gklearnstudy.in)

1. **Hostinger/Namecheap DNS panel** mein jaao
2. **CNAME record add karo:**
   - Name: `templates`
   - Value: `TERA_USERNAME.github.io`
3. GitHub repo mein `CNAME` file banao:
   ```
   templates.gklearnstudy.in
   ```
4. GitHub Pages settings → Custom domain → `templates.gklearnstudy.in`

---

## 📊 STEP 3 — Google Sheets + Apps Script

### 3a. Google Sheet banao
1. sheets.google.com → New Sheet
2. "StudyCraft Payments" naam do
3. URL mein se Sheet ID copy karo:
   `https://docs.google.com/spreadsheets/d/**SHEET_ID**/edit`

### 3b. Apps Script setup
1. script.google.com → New Project
2. `google-apps-script.js` ka poora code paste karo
3. Line 13 mein `SHEET_ID` update karo
4. **Deploy → New Deployment:**
   - Type: Web App
   - Execute as: **Me**
   - Who has access: **Anyone**
5. **Deploy karo → URL copy karo**

### 3c. Website mein URL lagao
`pages/verify.html` line 150:
```js
const CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_ID/exec'
};
```

### 3d. Auto Gmail Trigger (Optional)
Script editor → Triggers (⏰) → Add trigger:
- Function: `gmailAutoSync`
- Event: Time-driven → Every 30 minutes

---

## 📁 STEP 4 — Template Files (Google Drive)

1. Templates ki files Google Drive pe upload karo
2. File → Share → "Anyone with link" → Copy link
3. Link se File ID nikalo:
   `https://drive.google.com/file/d/**FILE_ID**/view`
4. `google-apps-script.js` mein `getTemplateFileUrl()` function update karo

---

## 💰 STEP 5 — Paytm Payment Setup

**Paid template page pe ye add karo:**
```html
<a href="YOUR_PAYTM_PAYMENT_LINK" class="btn-primary">
  💙 Pay ₹XX via Paytm
</a>
<p>Payment ke baad Order ID le aao → Verify page pe</p>
```

**Paytm Business → Payment Links:**
- Amount: Template ka price
- Description: Template name
- One link per template ya fixed amount link

---

## ✅ Testing Checklist

- [ ] Site GitHub pe live hai
- [ ] templates.gklearnstudy.in pe open hoti hai
- [ ] Dark/Light theme kaam karta hai
- [ ] Templates page categories filter karta hai
- [ ] Verify page pe Order ID + email submit hota hai
- [ ] Google Sheet mein entry aati hai
- [ ] Email milta hai confirmation ka
- [ ] Download page token verify karta hai

---

## 📞 Quick Contacts
- Paytm Business: business.paytm.com
- Google Apps Script: script.google.com
- GitHub Pages: pages.github.com

**Made by TyagiMultiTech 🚀**
