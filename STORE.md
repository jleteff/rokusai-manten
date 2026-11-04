# ManTen (六賽万点) launch guide

Everything to get from here to the App Store and Google Play, in order.
Steps marked **(you)** need your accounts; everything else is already built.

---

## Step 1: Switch the server on (about 15 minutes, on your Mac)

The new version runs every roll, coin and purchase on a Firebase server, so nobody can
cheat. It needs the Blaze plan (pay as you go) and one deploy.

1. **(you)** Firebase console → ⚙ → *Usage and billing* → *Modify plan* → **Blaze**.
   Then in Google Cloud billing, add a **budget alert at $10/month**.
2. **(you)** On your Mac, in Terminal:

```bash
cd ~/Documents/rokusai-manten
```

```bash
git fetch origin && git checkout store-build && git pull
```

```bash
cd functions && npm install && cd ..
```

```bash
npx firebase-tools login
```

```bash
npx firebase-tools use farkle-night
```

3. Set the two purchase secrets (use any long random text for now; you'll replace them in step 4):

```bash
npx firebase-tools functions:secrets:set RC_WEBHOOK_AUTH
```

```bash
npx firebase-tools functions:secrets:set RC_API_KEY
```

4. Deploy the server and the new database rules:

```bash
npm run deploy:server
```

5. Tell Claude "server is deployed". Claude merges `store-build` into `main`, which puts the
   new game live at https://jleteff.github.io/rokusai-manten/. Until then, the live site
   keeps running the current version.

---

## Step 2: Apple (you)

1. **Apple Developer Program** (individual, $99/yr): https://developer.apple.com/programs/enroll/
2. In **App Store Connect → Business**: sign the **Paid Apps Agreement**, add bank and tax info.
3. Join the **App Store Small Business Program** (15% fee instead of 30%):
   https://developer.apple.com/app-store/small-business-program/
4. In **Certificates, IDs & Profiles → Keys**: create a key with **Apple Push Notifications
   service (APNs)**, download the `.p8` file, then upload it in
   **Firebase → Project settings → Cloud Messaging → Apple app configuration**.

### Create the app in App Store Connect

- Name: **ManTen: Dice to 10,000** (30 characters max)
- Bundle ID: `com.jleteff.rokusaimanten`
- SKU: `manten-ios`
- Primary category: **Games → Dice**; secondary: **Games → Board**
- Age rating: answer **None** to everything except **Unrestricted Web Access: No**,
  **User-generated content / chat: Yes**. No gambling, no simulated gambling, no contests.
  Expected rating: **12+**.

### In-app purchases (App Store Connect → your app → Monetization)

| Product ID | Type | Price | Name |
|---|---|---|---|
| `mt_founder` | Non-Consumable | $9.99 | Founder's Pack |
| `mt_coins_500` | Consumable | $0.99 | 500 Koban |
| `mt_coins_3000` | Consumable | $4.99 | 3,000 Koban |
| `mt_coins_7000` | Consumable | $9.99 | 7,000 Koban |
| `mt_coins_16000` | Consumable | $19.99 | 16,000 Koban |
| `mt_season_s1` | Non-Consumable | $4.99 | Season 1 Pass |
| `mt_vip_monthly` | Auto-Renewable Subscription (group "VIP", 1 month) | $2.99 | VIP |

Each one needs a short description and a review screenshot (a screenshot of the shop's Premium tab works).

---

## Step 3: Google Play (you)

1. **Google Play Console** ($25): https://play.google.com/console/signup
2. Personal accounts must run a **closed test with at least 12 testers for 14 days** before
   going public. Start this as soon as the Android build exists: your friend group is the test group.
3. Create the same product IDs under **Monetize → Products** (in-app products and a
   `mt_vip_monthly` subscription).
4. Add your app's SHA-1 in Firebase if asked, and download **google-services.json** (step 5).

---

## Step 4: RevenueCat (you, free up to $2,500/month in revenue)

1. Sign up at https://app.revenuecat.com and create project **ManTen**.
2. Add the **App Store** app (bundle ID above, plus an App Store Connect API key) and the
   **Play Store** app (package name `com.jleteff.rokusaimanten`, plus a service account).
3. **Products**: import all seven product IDs.
4. **Entitlements**: create `vip` and attach `mt_vip_monthly`.
5. **Offerings**: one offering named `default` with a package for each product.
6. **API keys**: copy the **public** iOS key (`appl_…`) and Android key (`goog_…`) into
   `docs/firebase-config.js` → `window.RC_KEYS` (or send them to Claude).
7. Copy the **secret** API key (`sk_…`) and run the secret command again:

```bash
npx firebase-tools functions:secrets:set RC_API_KEY
```

8. **Integrations → Webhooks**: URL
   `https://us-central1-farkle-night.cloudfunctions.net/rcWebhook`, and set an
   **Authorization header** value. Use the same value for:

```bash
npx firebase-tools functions:secrets:set RC_WEBHOOK_AUTH
```

9. Redeploy so the server picks up the secrets:

```bash
npm run deploy:server
```

---

## Step 5: Build the apps (on your Mac)

```bash
npm install
```

```bash
npx cap add ios
```

```bash
npx cap add android
```

```bash
npm run assets
```

1. **Firebase config files**: in Firebase → Project settings → *Add app*, add an **iOS app**
   (bundle ID above) and an **Android app** (same ID). Download
   `GoogleService-Info.plist` into `ios/App/App/` (drag it into Xcode) and
   `google-services.json` into `android/app/`.
2. In Xcode → *Signing & Capabilities*: add **Push Notifications**, **Background Modes →
   Remote notifications**, and **In-App Purchase**.
3. In `ios/App/App/Info.plist`, add the photo and camera descriptions (see TESTING.md).
4. Run on your iPhone, test a purchase with a **Sandbox tester** (App Store Connect →
   Users and Access → Sandbox).
5. **Product → Archive → Distribute → App Store Connect**. It appears in **TestFlight**,
   where friends can test before launch.

---

## Step 6: The listing

**Subtitle** (30 max): `Push your luck to 10,000`

**Promotional text**: `Roll six dice with friends, chase the perfect 10,000, and collect gold, jade and neon dice along the way.`

**Description**:

```
ManTen is the house-rules dice game you play with friends, live.

Roll six dice, keep the scorers, and push your luck. Bank your points or risk it all.
Land on exactly 10,000 to win, then hold on while everyone gets one last turn.
Tie at the top? It's a 決戦 roll-off.

• Real-time tables with friends: send a link, everyone joins
• Trash-talk chat, challenges and Ro Sham Bo call-outs
• Six of a kind wins on the spot
• Earn coins and levels every game, plus daily rewards
• Collect dice skins, table felts, avatar frames and roll effects
• Season Pass with 20 tiers of rewards
• English and Arabic

Everything you can buy is cosmetic: it never changes how the dice roll.
```

**Keywords** (100 max): `dice,farkle,10000,yahtzee,friends,party,multiplayer,zilch,greed,board game,roll,koi`

**URLs**: privacy `https://jleteff.github.io/rokusai-manten/privacy.html`, support
`https://jleteff.github.io/rokusai-manten/support.html`.

**App Privacy** (App Store Connect → App Privacy). Data collected, all **linked to the user**,
**not used for tracking**:
- Contact info → Email address (App functionality)
- User content → Photos (avatar), Other user content (chat) (App functionality)
- Identifiers → User ID (App functionality)
- Purchases → Purchase history (App functionality)
- Usage data → Product interaction (App functionality)

**Screenshots**: 6.9" iPhone (1320 × 2868) and 13" iPad if you support iPad. Five shots:
a live table, the dice mid-roll, the shop, the Season Pass, the winner screen.

**App Review notes**: create a demo account (email and password, already confirmed) and
put it in the review notes, plus: "Open a table, tap Invite to add a second device or account;
practice tables work with one player."

---

## Before you submit: fill in the legal pages

`docs/privacy.html`, `docs/terms.html` and `docs/support.html` have three blanks marked in red:
**CONTACT_EMAIL**, **OWNER_NAME** and **STATE**. Send them to Claude to fill in.
