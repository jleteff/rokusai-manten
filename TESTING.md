# Test kit: run 六賽万点 as a real app on your phone

This turns the game into an iPhone (and Android) app on your MacBook, so you can play it
like a store app before we submit anything. No paid Apple account is needed for this step.

## One-time setup on the Mac (about 30–45 minutes, mostly downloads)

1. **Install Xcode** from the Mac App Store (it is large). Open it once and let it finish
   installing its extra components.
2. **Install Node.js**: download the "LTS" installer from https://nodejs.org and run it.
3. **Get the code.** Open the Terminal app and run these, one at a time:

```bash
cd ~/Documents
```

```bash
git clone https://github.com/jleteff/rokusai-manten.git
```

```bash
cd rokusai-manten
```

```bash
npm install
```

```bash
npx cap add ios
```

4. **Allow photo uploads** (used for avatars). In Finder, open
   `rokusai-manten/ios/App/App/Info.plist` with Xcode, then add two rows with the **+** button:
   - `Privacy - Photo Library Usage Description`: `Pick a photo for your avatar.`
   - `Privacy - Camera Usage Description`: `Take a photo for your avatar.`

## Put it on your iPhone

1. Plug your iPhone into the Mac with a cable and tap **Trust** on the phone.
2. On the iPhone: **Settings → Privacy & Security → Developer Mode → On** (it restarts).
3. In Terminal (inside the `rokusai-manten` folder), run:

```bash
npm run ios
```

4. Xcode opens. Click the **App** project at the top of the left sidebar, then the
   **Signing & Capabilities** tab. Under **Team**, choose **Add an Account…** and sign in with
   your Apple ID. Pick that team.
5. At the top of Xcode, choose your iPhone as the run destination and press the **▶ Run** button.
6. The first time, the iPhone may say the developer is untrusted:
   **Settings → General → VPN & Device Management → your Apple ID → Trust**. Then run again.

With a free Apple ID the app works for 7 days, then just press ▶ Run again.
With the paid Apple Developer account ($99/year) you can send builds to friends through
**TestFlight** instead.

## After I push changes

Pull the latest code and run it again:

```bash
git pull
```

```bash
npm run ios
```

## Android (optional)

Install **Android Studio** from https://developer.android.com/studio, then:

```bash
npx cap add android
```

```bash
npm run android
```

Plug in an Android phone with **USB debugging** turned on (Settings → About phone → tap
"Build number" 7 times → Developer options → USB debugging) and press ▶ Run in Android Studio.

## What works in the app today

Everything in the web game: tables, bots, chat, challenges, dealer, sounds, Arabic.
Invite links shared from the app point to the website, so friends without the app can join.

Not yet native: push notifications when the app is closed (planned with the store launch).
