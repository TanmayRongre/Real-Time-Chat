# LiveChat — Real-Time 1-on-1 Chat Application (MERN + TypeScript)

A full-stack, real-time 1-on-1 chat platform built with TypeScript, Node.js, Express, Socket.io, MongoDB (Mongoose), React, Vite, Tailwind CSS, and GSAP. Designed strictly according to the **Hallmark** (high-craft, anti-AI-slop) and **Unslop** design specifications.

---

## Architecture Overview

```
Chat application/
├── server/                        # Node.js + Express + TypeScript + Socket.io + Mongoose
│   ├── src/
│   │   ├── config/                # Environment variables & MongoDB connection
│   │   ├── controllers/           # Auth, User directory, and Conversation controllers
│   │   ├── middlewares/           # JWT authentication and error handlers
│   │   ├── models/                # User, Otp (TTL), Conversation, and Message schemas
│   │   ├── routes/                # Health, Auth, User, and Chat REST endpoints
│   │   ├── sockets/               # Real-time chat engine, presence & typing
│   │   └── utils/                 # Nodemailer with developer console fallback
├── client/                        # React + Vite + TypeScript + Tailwind CSS + GSAP
│   ├── src/
│   │   ├── api/                   # Axios client with automatic Bearer token interceptor
│   │   ├── components/
│   │   │   ├── auth/              # Split-step Auth card and custom 6-box OtpInput
│   │   │   ├── chat/              # Sidebar, ChatWindow, MessageBubble, and EmptyState
│   │   │   └── ui/                # Tactile Buttons and UI primitives
│   │   ├── context/               # AuthContext (session validation) & SocketContext (presence)
│   │   ├── pages/                 # AuthPage (Email + OTP) & ChatPage (2-pane chat)
│   │   └── utils/                 # Classname merge (cn) and timestamp formatting
```

---

## Features

- **Passwordless Email OTP Authentication**: 6-digit numeric OTP generation, hashed via bcrypt, stored with MongoDB 5-minute TTL indexes, and delivered via email (or server terminal in development mode).
- **Session Persistence**: 7-day signed JWT tokens stored in `localStorage` and verified against `/api/auth/me` on initial load.
- **Real-Time 1-on-1 Messaging**: Instant bi-directional message delivery via Socket.io with delivery (`✓✓`) and read receipts (`✓✓` emerald).
- **Online Presence & Typing Indicators**: Active user socket mapping with green status indicators and live typing alerts.
- **MongoDB Message History**: Complete persistence of conversations and messages with compound index optimization.
- **GSAP Micro-Interactions**: Tactile entry transitions, OTP error shake animations, and smooth bubble arrivals.

---

## Quick Start Guide

### 1. Prerequisites
- **Node.js** (v18+)
- **MongoDB** running locally on default port `27017` (e.g. `mongodb://localhost:27017/realtime_chat`)

### 2. Environment Setup
The backend environment is configured in `server/.env`. If you wish to customize it:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/realtime_chat
JWT_SECRET=super_secret_jwt_key_phase_1_dev
CLIENT_URL=http://localhost:5173
```
*(If `SMTP_USER` and `SMTP_PASS` are omitted, OTP codes are logged directly to the server terminal with `[DEV OTP FALLBACK]` for zero-friction local testing).*

### 3. Install & Start

From the root project directory:

```bash
# Run both Backend (port 5000) and Frontend (port 5173) concurrently:
npm run dev
```

---

## Testing the 2-User Real-Time Flow

1. Open **Browser 1** at `http://localhost:5173`.
   - Enter `alice@example.com` and Name `Alice`.
   - Look at the server terminal for the 6-digit code:
     ```text
     ======================================================
     [DEV OTP FALLBACK] Email: alice@example.com -> Code: 123456
     ======================================================
     ```
   - Enter the 6 digits in the OTP box to log in as Alice.

2. Open **Browser 2 (Incognito / Second Browser)** at `http://localhost:5173`.
   - Enter `bob@example.com` and Name `Bob`.
   - Grab Bob's OTP code from the terminal and log in.

3. **Live Chatting**:
   - Alice will see Bob listed in her sidebar with a green **Online** status dot.
   - Bob selects Alice, starts typing, and Alice immediately sees `typing...` in the header and message feed.
   - Send a message: it arrives in real time with a double checkmark (`✓✓`).
   - When the recipient focuses the conversation, read receipts turn emerald (`✓✓`).
   - Refresh both browser tabs: the message history remains intact and reloads from MongoDB.

