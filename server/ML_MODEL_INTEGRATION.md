# ML Model Integration Guide

## Overview

The system is set up to process 10-second video chunks in real-time for proctoring. The student device sends chunks every 10 seconds, and the server processes them with your ML model.

## Architecture

1. **Client (StudentTest.tsx)**: Records video and sends 10-second chunks to server
2. **Server Endpoint (`/api/student/proctor-chunk`)**: Receives chunks and processes them
3. **ML Processing (`server/src/utils/mlProctoring.ts`)**: Placeholder for your ML model
4. **Violation Storage**: Violations are logged to MongoDB with images

## Integration Steps

### 1. Replace ML Model Function

Edit `server/src/utils/mlProctoring.ts` and replace the `processVideoChunkWithML` function with your actual model:

```typescript
export async function processVideoChunkWithML(
  videoBuffer: Buffer,
  frameImage: string
): Promise<{
  hasViolation: boolean;
  violationType?: string;
  severity?: 'low' | 'medium' | 'high';
  confidence?: number;
  description?: string;
}> {
  // TODO: Replace with your ML model
  
  // Example structure:
  // 1. Load your model (TensorFlow, PyTorch, etc.)
  // 2. Preprocess video/frame
  // 3. Run inference
  // 4. Parse results
  
  // Your implementation here
  const result = await yourMLModel.predict(videoBuffer);
  
  if (result.hasViolation) {
    return {
      hasViolation: true,
      violationType: result.type,
      severity: result.severity,
      confidence: result.confidence,
      description: result.description,
    };
  }
  
  return { hasViolation: false };
}
```

### 2. Frame Extraction

The system uses `ffmpeg` to extract frames from video chunks. Make sure ffmpeg is installed:

**Windows:**
```bash
# Download from https://ffmpeg.org/download.html
# Add to PATH
```

**Mac:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

If ffmpeg is not available, the system will still work but frame extraction will be skipped. You can modify `extractFrameFromVideo` to use your own frame extraction method.

### 3. Model Loading

If your model needs to be loaded at startup, add it to `server/src/server.ts` in the `startServer` function:

```typescript
async function startServer() {
  // Load your ML model
  await loadYourMLModel();
  
  // ... rest of startup code
}
```

## Data Flow

1. **Student starts test** → Video recording begins
2. **Every 10 seconds** → Client sends video chunk to `/api/student/proctor-chunk`
3. **Server receives chunk** → Extracts frame from video
4. **ML model processes** → Detects violations
5. **If violation** → Logs to MongoDB with image
6. **Chunk discarded** → Not stored (only violations are kept)

## Violation Types

The system supports these violation types:
- `Multiple faces detected`
- `Looking away from screen`
- `Phone detected`
- `Unauthorized person detected`
- `No face detected`
- (Add your own types)

## Severity Levels

- `low`: Minor suspicious behavior
- `medium`: Moderate violation
- `high`: Serious cheating attempt

## Database Schema

Violations are stored in the `Violation` collection with:
- `studentId`: Student identifier
- `testId`: Test identifier
- `timestamp`: When violation occurred
- `type`: Violation type
- `severity`: low/medium/high
- `image`: Base64 encoded frame image
- `confidence`: ML model confidence (0-1)
- `description`: Additional details

## Testing

1. Start the server
2. Start a test as a student
3. Wait 10 seconds - check server logs for chunk processing
4. Check MongoDB for violations if detected

## Performance Considerations

- Chunks are processed asynchronously
- Processing errors don't block the test
- Violations are logged but don't interrupt the student
- Video chunks are discarded after processing (not stored)

## Next Steps

1. Integrate your ML model into `mlProctoring.ts`
2. Test with real video chunks
3. Adjust violation detection thresholds
4. Add custom violation types as needed

