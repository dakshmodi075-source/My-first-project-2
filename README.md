# Eye Drops Reminder PWA

An installable web app for Android and iPhone. It stores schedules/photos in the browser on each device and uses a small Node.js server to send background Web Push notifications.

## Important notification notes

- The app must be hosted on HTTPS.
- Android: use a current Chrome-based browser and allow notifications.
- iPhone/iPad: iOS/iPadOS 16.4 or later is required for Web Push. Open the HTTPS site in Safari, choose **Share → Add to Home Screen**, launch the installed app, then tap **Enable notifications** inside it.
- The phone/browser must allow notifications. Focus modes, battery settings, network outages and OS policies can delay or suppress delivery.
- Push notifications require this Node server to remain running. A static GitHub Pages/Netlify-only deployment is not enough for scheduled background push.
- Schedules and photos are stored locally in the browser. Add schedules separately on each phone where reminders are needed.
- This is a reminder tool, not a dosing recommendation or medical record. Use only the schedule prescribed by a qualified eye-care professional.

## 1. Create VAPID keys

On a computer with Node.js installed:

```bash
npm install
npx web-push generate-vapid-keys
```

Keep the private key secret. Set these environment variables on your host:

- `VAPID_PUBLIC_KEY` = generated public key
- `VAPID_PRIVATE_KEY` = generated private key
- `VAPID_SUBJECT` = `mailto:you@example.com` (replace with an email you control)

## 2. Run locally

```bash
npm install
VAPID_PUBLIC_KEY="your-public-key" VAPID_PRIVATE_KEY="your-private-key" VAPID_SUBJECT="mailto:you@example.com" npm start
```

Open `http://localhost:3000`. Push requires HTTPS in production; localhost is treated as a secure context by modern browsers.

## 3. Deploy and get your public link

Use a Node.js host that supports a persistent disk/volume. Example: Render.

1. Create a private GitHub repository and upload the contents of this project.
2. In Render, create a **Web Service** connected to the repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add the three VAPID environment variables above.
6. Attach a persistent disk and set `DATA_DIR` to its mount path (for example `/var/data`). The app writes push subscriptions to `subscriptions.json`.
7. Deploy. Your host will provide an HTTPS URL. Open it on your phone and enable notifications.

Do not commit your VAPID private key or the `data/` directory to a public repository.

## 4. Install on phones

**Android:** Open the public HTTPS link in Chrome → browser menu → Install app / Add to Home screen.

**iPhone:** Open the public HTTPS link in Safari → Share → Add to Home Screen → open the new Home Screen icon → tap Enable notifications.

## Limitations

This starter server stores subscriptions and schedules in a JSON file and is intended for a small personal app. It does not have user accounts, multi-user isolation, encryption-at-rest, backup, or a production database. Anyone who can access the same app backend is not automatically given access to your local schedule data, but push subscriptions are held on the server. Use a persistent disk and keep the deployment private/unlisted if it is only for personal use. For a public multi-user product, add authentication, per-user data separation, rate limiting, secure database storage, and a privacy policy.
