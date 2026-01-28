# Pastebin Lite

A simple Pastebin-like web application built as part of the Aganitha take-home assignment.

## Features
- Create a text paste
- Generate a shareable link
- View paste content via API or browser
- Optional expiry using:
  - Time-to-live (TTL)
  - Maximum view count

## Tech Stack
- Node.js
- Express.js
- SQLite (persistence layer)

## API Endpoints

### Health Check
GET /api/healthz  
Returns application health status.

### Create Paste
POST /api/pastes  

Request body:
```json
{
  "content": "Hello World",
  "ttl_seconds": 60,
  "max_views": 5
}

### Fetch Paste (JSON)

GET /api/pastes/:id

### View Paste (HTML)

GET /p/:id

### Running Locally
npm install
npm start

### The app runs on:
http://localhost:3001