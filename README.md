# 10,000

A live multiplayer game of 10,000 (the dice game, also known as Farkle). Everyone opens one link on their own phone. No accounts for players.
The page is static (hosted free on GitHub Pages). Game state lives in Firestore. Players sign in anonymously.

## Set it up (about 10 minutes, all in a browser)

### 1. Firebase (the live game data)
1. https://console.firebase.google.com > *Add project*. Name it, skip Google Analytics.
2. *Build > Authentication > Get started > Sign-in method > Anonymous > Enable.*
3. *Build > Firestore Database > Create database.* Pick a nearby location, start in **production mode**.
4. *Firestore > Rules* tab. Replace everything with the contents of `firestore.rules` in this repo, then **Publish**.
5. *Project settings (gear) > General > Your apps > Web (`</>`).* Register an app (skip "Firebase Hosting"). Copy the `firebaseConfig` values.
6. Put those values in `docs/firebase-config.js` (edit the file on GitHub with the pencil icon, then commit).
   These values are meant to be public. The Firestore rules are what protect the data.

### 2. GitHub Pages (the web address)
1. In this repo: *Settings > Pages > Build and deployment*. Source: **Deploy from a branch**. Branch: `main`, folder `/docs`. Save.
2. After a minute your game is at `https://YOUR_GITHUB_NAME.github.io/farkle-night/`.
3. If sign-in is refused, add `YOUR_GITHUB_NAME.github.io` under *Firebase > Authentication > Settings > Authorized domains*.

Free GitHub Pages needs a **public** repo. Nothing secret is in it.

### 3. Play
Open the address, create a table, send the link (it ends in `#t-XXXX`) to your friends.

## Other hosting
`firebase.json` is also set up for Firebase Hosting: `firebase deploy --only hosting,firestore --project YOUR_PROJECT_ID`.

## How it works
- `docs/index.html` is the whole game: lobby, dice, scoring, scoreboard.
- Each table is a Firestore document at `rooms/{code}`, with seats in `rooms/{code}/players`.
- `firestore.rules` lets only the player whose turn it is change the game. The host can change anything.
- Players are Firebase anonymous users. Clearing browser data means a new identity.

## Known limits
- Anyone with a table link can sit down. Latecomers are added by the host's screen, so the host keeps the page open.
- Rolls happen in each player's browser, so a determined player could cheat by editing their own client. Fine for friends, not for money.
- Local testing: `firebase emulators:start --only auth,firestore,hosting`, then open `http://localhost:5000/?emulator=1`.
