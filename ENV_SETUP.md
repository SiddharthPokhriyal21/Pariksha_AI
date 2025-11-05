# Environment Variables Setup Guide

This project uses environment variables for configuration to make it cloud-deployment ready.

## Server Configuration

Create a `.env` file in the `server/` directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
# For local development: http://localhost:8080
# For production: https://your-frontend-domain.com
CORS_ORIGIN=http://localhost:8080

# Database Configuration
# MongoDB Connection URI
# Format: mongodb://username:password@host:port/database
# Example: mongodb://localhost:27017/pariksha_ai
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/database
MONGODB_URI=your_mongodb_connection_string_here

# API Keys for AI Services
# OpenAI API Key (for generating test questions)
OPENAI_API_KEY=your_openai_api_key_here

# Alternative: Anthropic API Key (Claude)
# ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### Getting API Keys

1. **OpenAI API Key:**
   - Visit https://platform.openai.com/api-keys
   - Create a new API key
   - Copy and paste it into `OPENAI_API_KEY`

2. **Anthropic API Key (Alternative):**
   - Visit https://console.anthropic.com/
   - Create a new API key
   - Copy and paste it into `ANTHROPIC_API_KEY`

**Note:** You only need one AI API key. The server will try OpenAI first, then fall back to Anthropic if OpenAI is not available.

### Getting MongoDB URI

1. **Local MongoDB:**
   - If running MongoDB locally: `mongodb://localhost:27017/pariksha_ai`
   - Default port is 27017

2. **MongoDB Atlas (Cloud):**
   - Sign up at https://www.mongodb.com/cloud/atlas
   - Create a cluster and database
   - Get your connection string from "Connect" → "Connect your application"
   - Format: `mongodb+srv://username:password@cluster.mongodb.net/database`

3. **Other MongoDB Providers:**
   - Use the connection string provided by your MongoDB hosting service

## Client Configuration

Create a `.env` file in the `client/` directory with the following variables:

```env
# Client Configuration
VITE_API_BASE_URL=http://localhost:3000
VITE_PORT=8080

# Environment
VITE_NODE_ENV=development
```

### For Production/Cloud Deployment

When deploying to cloud:

1. **Server `.env` file:**
   - Set `PORT` to the port provided by your hosting platform (e.g., `PORT=8080` for Render)
   - Set `CORS_ORIGIN` to your frontend URL (e.g., `CORS_ORIGIN=https://your-app.com`)
   - Set `MONGODB_URI` to your production MongoDB connection string
   - Keep your API keys and database URI secure and never commit them to version control

2. **Client `.env` file:**
   - Set `VITE_API_BASE_URL` to your backend server URL (e.g., `VITE_API_BASE_URL=https://api.your-app.com`)
   - The `VITE_` prefix is required for Vite to expose these variables to the client

## Security Notes

- **Never commit `.env` files to version control**
- `.env` files are already in `.gitignore`
- Always use environment variables for sensitive data (API keys, passwords, etc.)
- For cloud deployments, set environment variables in your hosting platform's dashboard

## Example: Setting up locally

1. Copy the example values above
2. Create `.env` files in both `server/` and `client/` directories
3. Replace placeholder values with your actual configuration
4. Restart your development servers

## Troubleshooting

- If API generation doesn't work, check that your API keys are correctly set in `server/.env`
- If the client can't connect to the server, verify `VITE_API_BASE_URL` matches your server URL
- Make sure both servers are running before testing

