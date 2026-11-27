# Asha — Dr Shilpa Fertility chat assistant

The chat bubble for **www.drshilpafertility.com**, plus a private **staff inbox** where the clinic team reads chats, takes over conversations and sees every booking and website enquiry.

| File | What it is |
|---|---|
| `clinic-config.json` | **The only file you normally edit**: phone, WhatsApp, address, timings and prices Asha tells patients |
| `server.js` | The brain: talks to Google Gemini, stores chats and leads, sends alerts |
| `public/widget.js` | The chat bubble shown on the website |
| `public/admin.html` | The staff inbox (open `/admin`) |
| `google-apps-script.gs` | Optional: email every enquiry and log it in a Google Sheet |
| `.env.example` | List of settings that go into Coolify |

## What Asha does
- Answers questions about treatments, the doctor, timings, location and the **published estimated prices** in 1–2 short sentences, in English, Hindi, Hinglish or Punjabi (whichever the patient uses).
- Never diagnoses, never promises success, never quotes unpublished prices, refuses sex-selection requests and sends emergencies to hospital.
- **Books consultations inside the chat**: the "Book a consultation" button opens a short form, and the request lands in the staff inbox.
- **Human takeover**: when staff reply from the inbox, Asha goes quiet for that chat and comes back after the hand-back time.
- New visitors on a computer see the chat open automatically. On phones a small "Chat with us" note appears instead, because a full-screen pop-up on phones can lower Google rankings.
- **Every website form is an AI form.** When a patient sends any form on the website, the enquiry lands in the inbox straight away (with city, page and Google Ads campaign) and a notification goes out. Asha then writes the patient a short personal note about their concern — what the first visit involves, what to bring, the estimated price if there is one — which they see on the thank-you page. The patient can carry on chatting with Asha, and staff see the whole conversation, form included, in the inbox. If the AI is ever slow or down, the patient gets a standard thank-you note and the lead is still saved.
- If a visitor starts filling in a website form while the chat has opened by itself, the chat closes so it doesn't cover the form.

---

## Before you start: put in the real clinic details
`clinic-config.json` already has the clinic's confirmed phone (+91 98775 14819), address (Sector 14, Panchkula) and timings (Mon–Sun, 9:30 am – 8:30 pm). If anything changes later, edit it there and keep it the same as the website's `site-config.json`.

## Step 1 — Put the files on GitHub
1. Go to **github.com** and click **+** → **New repository**.
2. Name it `dr-shilpa-chat`, choose **Private**, leave "Add a README" unticked, click **Create repository**.
3. Click **uploading an existing file**.
4. Unzip `dr-shilpa-chatbot.zip`, open the folder, select **everything inside it** and drag it onto the page.
5. Click **Commit changes**.

## Step 2 — Point bot.drshilpafertility.com to your server
1. In Hostinger hPanel, go to **Domains** → `drshilpafertility.com` → **DNS / Nameservers** → **DNS records**.
2. Add a record: **Type** `A`, **Name** `bot`, **Points to** your Coolify server's IP address, **TTL** leave as it is.
3. Click **Add record**. It can take from a few minutes to a few hours to start working.

## Step 3 — Create the app in Coolify
1. Open Coolify → **Projects** → **+ Add** → name it `Dr Shilpa Chat` → open the **production** environment.
2. Click **+ New** → **Private Repository (with GitHub App)** → choose the `dr-shilpa-chat` repository, branch `main`.
3. **Build Pack**: **Nixpacks**. Click **Continue**.
4. On **Configuration → General**:
   - **Domains**: `https://bot.drshilpafertility.com`
   - **Ports Exposes**: `3000`
   - Click **Save**.
5. Open **Environment Variables** and add these one at a time (click **+ Add**, type the name and value, **Save**):
   - `GEMINI_API_KEY` = your Gemini key (see "AI key" below)
   - `ADMIN_TOKEN` = a strong password for the staff inbox
   - `DATA_FILE` = `/app/data/data.json`
   - `HANDBACK_MINUTES` = `5`
6. Open **Persistent Storage** (or **Storages**) → **+ Add** → **Volume**: name `dsf-chat-data`, **Destination path** `/app/data` → **Save**. Without this, chats and leads are wiped every time you redeploy.
7. Click **Deploy** and wait until the status shows **Running**.
8. Open `https://bot.drshilpafertility.com`. You should see the test page with the chat bubble. Try a chat.
9. Open `https://bot.drshilpafertility.com/admin` and enter your `ADMIN_TOKEN` password.

## Step 4 — Turn it on for the website
Upload the new **dr-shilpa-fertility-hostinger.zip** to Hostinger the usual way (File Manager → public_html → Upload → Extract, replacing files → delete the zip → **Performance → CDN → Flush cache**). It adds the chat bubble to every page and connects the website forms to the inbox.

## AI key (important for a medical clinic)
1. Go to **aistudio.google.com** → **Get API key** → **Create API key**.
2. For patient chats, use a key from a Google Cloud project with **billing switched on**. On the free tier Google may use chat text to improve its models; on the paid tier it does not. Asha already masks phone numbers and emails before anything is sent to Google, and a clinic's chat volume usually costs very little.

## Optional — email alerts and a Google Sheet of every lead
1. Open `google-apps-script.gs` and follow the steps at the top (new Google Sheet → Extensions → Apps Script → paste → Deploy as Web app → copy the URL).
2. In Coolify, add `NOTIFY_WEBHOOK_URL` = that URL, then **Redeploy**.

## Optional — alerts on the clinic's phone
1. Open `https://bot.drshilpafertility.com/admin` on the phone.
2. iPhone: tap **Share** → **Add to Home Screen**, then open "DSF Inbox" from the home screen. Android: Chrome menu → **Add to Home screen**.
3. Tap **🔔 Enable alerts** and allow notifications.

## Changing things later
| To change | Do this |
|---|---|
| Phone, timings, prices | Edit `clinic-config.json` on GitHub (pencil icon → Commit), then **Redeploy** in Coolify |
| Greeting, notification email, hand-back time | Staff inbox → **⚙️ Settings** (no redeploy needed) |
| How Asha talks | `server.js` → the section headed "the assistant's brief" |
| Auto-open on computers | `public/widget.js` → `AUTO_OPEN_DESKTOP = true` (set `false` to turn off) |

## Troubleshooting
- **"Setup needed" reply** → `GEMINI_API_KEY` is missing in Coolify. Add it and redeploy.
- **Inbox says wrong password** → what you typed doesn't match `ADMIN_TOKEN`.
- **No bubble on the website** → check `https://bot.drshilpafertility.com/widget.js` opens in a browser, then flush the Hostinger CDN cache.
- **Chats disappeared after an update** → the persistent storage at `/app/data` is missing (Step 3.6).
