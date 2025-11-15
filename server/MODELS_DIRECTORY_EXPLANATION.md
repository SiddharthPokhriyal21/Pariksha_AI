# Models Directory Explanation

## Two Different "models" Directories

Your server has **two different "models" directories** with different purposes:

### 1. `server/models/` ✅ (Face Recognition Models)
**Purpose**: Contains face-api.js pre-trained models for face detection and recognition

**Location**: `C:\Users\sanch\Desktop\Pariksha_AI\server\models\`

**Required Files** (all present ✅):
- `ssd_mobilenetv1_model-weights_manifest.json`
- `ssd_mobilenetv1_model-shard1`
- `face_landmark_68_model-weights_manifest.json`
- `face_landmark_68_model-shard1`
- `face_recognition_model-weights_manifest.json`
- `face_recognition_model-shard1`

**Status**: ✅ All files are present and in the correct location!

### 2. `server/src/models/` (Mongoose Database Models)
**Purpose**: Contains TypeScript Mongoose schema definitions (like User.ts)

**Location**: `C:\Users\sanch\Desktop\Pariksha_AI\server\src\models\`

**Files**:
- `User.ts` - Mongoose schema for user authentication

**Status**: ✅ This is correct - it's for database models, not face recognition models

## Why Models Might Not Be Loading

If models aren't loading, it could be due to:

1. **Path Resolution Issue**: The code now uses `path.resolve()` for better path handling
2. **Missing Dependencies**: Ensure all npm packages are installed
3. **Runtime Error**: Check the console output when starting the server

## Debugging

When you start the server, you'll now see:
- 🔍 The exact path where it's looking for models
- 📦 Progress as each model loads
- ✗ Clear error messages if something is wrong

## Quick Test

Run the server and check the console output:
```bash
npm run dev
```

You should see:
```
🔍 Looking for models at: [absolute path]
📦 Loading face recognition models...
  ✓ SSD Mobilenet v1 loaded
  ✓ Face Landmark 68 loaded
  ✓ Face Recognition Net loaded
✓ Face recognition models loaded successfully
```

If you see errors, the debug output will tell you exactly what's wrong!

