# Troubleshooting: "Failed to Connect to Server"

## Quick Checks

### 1. **Is the backend server running?**
   - Open a terminal in the `server/` directory
   - Run: `npm start` or `ts-node src/server.ts`
   - You should see: "Pariksha AI Backend server is running on port 3000"
   
   **If not running:**
   ```bash
   cd server
   npm install
   npm start
   ```

### 2. **Check your `.env` files**

   **Client `.env` file** (`client/.env`):
   ```env
   VITE_API_BASE_URL=http://localhost:3000
   VITE_PORT=8080
   ```
   
   **Server `.env` file** (`server/.env`):
   ```env
   PORT=3000
   CORS_ORIGIN=http://localhost:8080
   ```

### 3. **Restart after creating/editing `.env` files**
   - **Important:** After creating or editing `.env` files, you MUST restart both servers:
     - Stop the client server (Ctrl+C)
     - Stop the server (Ctrl+C)
     - Restart both servers

### 4. **Check browser console**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Look for error messages
   - You should see: "Registering with URL: http://localhost:3000/api/auth/student/register"

### 5. **Check Network tab**
   - Open browser DevTools (F12)
   - Go to Network tab
   - Try registering again
   - Look for the request to `/api/auth/student/register`
   - Check if it's:
     - **Pending** → Server not running
     - **Failed (CORS error)** → CORS configuration issue
     - **404** → Wrong URL
     - **500** → Server error

## Common Issues

### Issue: "Failed to connect to server"
**Solution:**
1. Make sure backend server is running on port 3000
2. Check that `client/.env` has `VITE_API_BASE_URL=http://localhost:3000`
3. Restart the client server after creating `.env` file

### Issue: CORS Error
**Solution:**
1. Check `server/.env` has `CORS_ORIGIN=http://localhost:8080`
2. Make sure the client is running on port 8080
3. Restart the server after editing `.env`

### Issue: "NetworkError when attempting to fetch resource"
**Solution:**
- Backend server is not running
- Start the server: `cd server && npm start`

## Step-by-Step Setup

1. **Create `client/.env`:**
   ```env
   VITE_API_BASE_URL=http://localhost:3000
   VITE_PORT=8080
   ```

2. **Create `server/.env`:**
   ```env
   PORT=3000
   CORS_ORIGIN=http://localhost:8080
   MONGODB_URI=mongodb://localhost:27017/pariksha_ai
   ```

3. **Start backend server:**
   ```bash
   cd server
   npm start
   ```
   Wait for: "Pariksha AI Backend server is running on port 3000"

4. **Start client server (in a new terminal):**
   ```bash
   cd client
   npm run dev
   ```
   Wait for: "Local: http://localhost:8080"

5. **Test registration:**
   - Open http://localhost:8080
   - Try registering a student
   - Check browser console for any errors

## Still Not Working?

1. Check if port 3000 is already in use:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   
   # Mac/Linux
   lsof -i :3000
   ```

2. Try a different port:
   - Change `PORT=3001` in `server/.env`
   - Change `VITE_API_BASE_URL=http://localhost:3001` in `client/.env`
   - Restart both servers

3. Check firewall settings
4. Make sure no proxy is blocking localhost

