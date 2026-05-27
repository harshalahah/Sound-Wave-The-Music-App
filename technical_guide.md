# Sound Wave: Architect & Developer Guide

Welcome to the technical backend and frontend documentation for your personal music streaming app. This guide explains how everything connects, special secrets hidden in the code, and how to boot up your servers safely.

## 🚀 How to Start the App (Every Time)

To run this application locally, you need **two separate terminal windows** running side-by-side in your `MusicApp` folder.

### 1. Start the Python Backend

```powershell
# Open a terminal and go into the backend folder
cd C:\Users\meluc\CODING\Projects\MusicApp\backend

# Activate your Python virtual environment (this is crucial!)
.\venv2\Scripts\activate

# Start the FastAPI server
uvicorn main:app --reload
```

### 2. Start the React Frontend

```powershell
# Open a second terminal and go into the frontend folder
cd C:\Users\meluc\CODING\Projects\MusicApp\frontend

# Start the Vite React server
npm run dev
```

*Your app is now live at [http://localhost:5173/](http://localhost:5173/) !*

---

## 🌊 App Process Flow

How does data actually move when you use the app? Here is a high-level breakdown:

1. **You Play a Song** -> React `App.jsx` updates its `currentTrack` state.
2. **The Player Hooks In** -> `FloatingConsole.jsx` catches the new track, asks the FastAPI backend for the secret `.m4a` audio stream URL, and begins HTML5 `<audio>` playback natively.
3. **History is Written** -> A stealth POST request fires to `/api/history`, where SQLite permanently records the play.
4. **AI Radio Generation** -> `App.jsx` immediately asks `/api/recommendations` for similar tracks. The Python backend talks to Last.fm, maps those text strings to YouTube Music IDs, and completely populates your AI Radio queue.
5. **The Queue Engine** -> When the custom HTML `<audio>` tag finishes the song, it fires `onEnded`, which triggers our React Auto-Play Engine to cleanly pull the next track from your queue!

## 🌟 Major Features Built

- **Intelligent Queue Engine**: Seamlessly queues Search Results, Trending lists, or your Library context. If the list finishes, it smoothly hands over control to the infinite AI Radio mix.
- **Library & Liked Songs**: A fully persistent SQLite database holding your "Likes". Click the Heart icon in the player to instantly save a song to your profile.
- **Advanced Media Controls**: A custom `FloatingConsole` player featuring a precise timeline Seek/Scrub bar, volume slider, and native MediaSession integration (so your physical keyboard media keys control the app).
- **The Spotify-Style Home Screen**: Fetches your "Jump Back In" recent history alongside a live "Trending Now" chart via `ytmusic.get_charts()` directly from YouTube.

---

## 🏛️ How the App Actually Works (The Architecture)

We built this app using a decoupled architecture. The **Backend (Python)** and the **Frontend (React)** run totally separately. They talk to each other using API calls over your local network.

### 1. The FastAPI Backend (The Brain)

- **`main.py`**: The entry point. It creates the web server and mounts our specific URL routes.
- **`database.py` & `models.py`**: We use SQLite (a file-based database so you don't need a massive DB server running) and `SQLAlchemy`. `models.py` defines the structure of your data (`Users`, `Tracks`, `ListenHistory`) so Python knows how to store them.
- **`api/music.py`**: Houses the `ytmusicapi` search tool and `yt-dlp`. It silently grabs the raw, hidden `.m4a` music stream URL direct from Google's servers so we can play music natively without ads.
- **`api/history.py`**: A stealthy endpoint. When you click play in React, it quietly logs that song to your history database.
- **`api/recommendations.py` (The Secret Sauce)**: The "Smart" engine.
  - *Code highlight:* It grabs your latest listened song from the database. It then tries to send it to the Last.fm API. If your API key is invalid or Last.fm crashes, the code has a built-in AI fallback mechanism that dynamically intercepts the failure and queries the YouTube Music Radio algorithm instead, ensuring the UI never crashes!

### 2. The React Frontend (The Face)

- **`vite.config.js` - THE BRIDGE (Crucial Concept)**:
  How does the frontend talk to the backend without triggering browser security blocks (CORS errors)? In `vite.config.js`, we configured a local network **proxy**. Any fetch request the frontend sends to `/api/...` gets automatically caught by Vite and securely forwarded to `http://localhost:8000`. This perfectly links the two servers together.

- **`App.jsx`**: The main Layout. It holds the "State" (what track is currently playing, what search results are active). In React, when "state" changes, the UI updates instantly without refreshing the page.

- **`FloatingConsole.jsx` - The Custom Audio Player**:
  - *Code highlight:* The `track` object is passed down into this component. When `track.videoId` changes, a React `useEffect` hook triggers inherently, firing a fetch request to the Python server to grab the raw HTTP audio stream.
  - We use a hidden HTML5 `<audio>` tag that is natively synced by React ref variables (`audioRef.current`) to our custom Play/Pause/Skip buttons.

- **`DynamicBackground.jsx`**:
  Instead of static background colors, this component takes the thumbnail of the currently playing song in high-res, scales it to 120% of the screen size, heavily blurs it (`blur-[100px]`), and uses the physics engine `framer-motion` to infinitely, slowly zoom and rotate it behind the app!

---

## 🛠️ How to Edit the Code & Add Features

**Modifying the Beautiful UI (CSS)**
Because we used **Tailwind CSS v4**, styling isn't hidden in weird external `.css` files. It's written directly on the HTML elements in `className` tags. If you want to change the visual theme later, look for these common tags in the code:

- `backdrop-blur-xl`: Creates the frosted glass Glassmorphism effect you see everywhere.
- `bg-white/5`: Gives elements a transparent, faint white color (5% opacity).
- `hover:-translate-y-1`: This is the math behind why the radio cards subtly lift up when your mouse hovers over them!

Whenever you want to change the look of the app, you just change these string utilities directly inside `App.jsx` and `FloatingConsole.jsx` and the browser will instantly hot-reload the new design!

**How to Add New Features (Extendability)**
If you ever want to build entirely new features (like Custom Playlists, Lyrics, or a Social feed):

1. **The Backend**: Open the `backend/api/` folder. Create a new Python file (e.g. `lyrics.py`). Build your logic, then mount it in `backend/main.py` using `app.include_router()`.
2. **The Database**: If the feature needs to save data (like custom playlist structures), edit `backend/models.py`. The next time you restart the python terminal, SQLAlchemy will automatically build the new tables inside your lightweight `.db` SQLite file.
3. **The Frontend**: In `frontend/src/App.jsx`, simply create a new `useState` hook to fetch data from your new API. Add a new `<button>` in the Navigation bar to toggle visibility, and build a frosted overlay block Exactly like the `showLibrary` component logic!

---

## How to run the app on your phone

1. The "Right Now" Solution: Playing on your Phone over Wi-Fi

Since the App is entirely responsive (built with Tailwind mobile-first styling), you can actually play it on your phone right now as long as your PC and phone are on the same Wi-Fi network!

To do this:

- Restart your frontend server with `npm run dev -- --host` (this exposes it to your local network) .
- Restart your backend server with `uvicorn main:app --host 0.0.0.0 --reload`.
- Find your PC's local IP address (usually looks like 192.168.1.something), pull out your phone, and type that exact IP address with the port into your Safari or Chrome mobile browser (e.g. `http://192.168.1.15:5173`).
- The app will load exactly as it does on your PC, completely controlled from your phone, and because both devices are talking to the same SQLite database running on your computer, your Liked Songs and History will instantly sync perfectly across both devices!
