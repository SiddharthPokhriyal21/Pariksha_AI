# Face Recognition Setup Guide

This application uses face-api.js for face verification during registration and login.

## Prerequisites

1. Node.js dependencies are installed (`npm install`)
2. MongoDB is configured and running

## Download Face Recognition Models

Face-api.js requires pre-trained models to detect and recognize faces. You need to download these models:

### Option 1: Manual Download (Recommended)

1. Visit the face-api.js models repository: https://github.com/justadudewhohacks/face-api.js-models

2. Download the following model files:
   - `ssd_mobilenetv1_model-weights_manifest.json`
   - `ssd_mobilenetv1_model-shard1` (or shard files)
   - `face_landmark_68_model-weights_manifest.json`
   - `face_landmark_68_model-shard1` (or shard files)
   - `face_recognition_model-weights_manifest.json`
   - `face_recognition_model-shard1` (or shard files)

3. Create a `models` directory in the `server` folder:
   ```bash
   mkdir server/models
   ```

4. Place all downloaded model files in the `server/models` directory

### Option 2: Using Git (if available)

```bash
cd server
git clone https://github.com/justadudewhohacks/face-api.js-models.git temp_models
mv temp_models/* models/
rm -rf temp_models
```

## Directory Structure

After setup, your directory structure should look like:

```
server/
├── models/
│   ├── ssd_mobilenetv1_model-weights_manifest.json
│   ├── ssd_mobilenetv1_model-shard1
|   |-- ssd_mobilenetv1_model-shard2
│   ├── face_landmark_68_model-weights_manifest.json
│   ├── face_landmark_68_model-shard1
│   ├── face_recognition_model-weights_manifest.json
|   |── face_recognition_model-shard1
│   └── face_recognition_model-shard2
├── src/
└── ...
```

## Verification

When you start the server, you should see:
- `✓ Face recognition models loaded successfully` - if models are correctly placed
- `⚠ Face recognition models not loaded` - if models are missing

## Troubleshooting

### Models not loading
- Ensure all model files are in `server/models/` directory
- Check that file names match exactly (case-sensitive)
- Verify file permissions allow reading

### Face detection not working
- Ensure good lighting in photos
- Face should be clearly visible and facing the camera
- Avoid multiple faces in the image
- Ensure face takes up a reasonable portion of the image

### Performance Issues
- Face recognition can be CPU-intensive
- First request may be slower as models are loaded
- Consider using a more powerful server for production

## Error Codes

The API returns specific error codes for different scenarios:

- `FACE_VALIDATION_FAILED` - No face detected or multiple faces detected during registration
- `FACE_DETECTION_FAILED` - No face detected during login
- `FACE_MISMATCH` - Face in login photo doesn't match registered face
- `INVALID_CREDENTIALS` - Email or password is incorrect
- `MISSING_FIELDS` - Required fields are missing

