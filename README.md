# Wav2Lip Client

A React application for interacting with the Wav2Lip API to generate lip-synced videos.

## Features

- Upload video and audio files
- Start processing with configurable parameters
- Real-time status monitoring with automatic polling
- Automatic download of processed results
- Process persistence using localStorage (survives page refresh)
- Error handling and logging display

## API Endpoints Used

- `POST /upload/videofile_upload` - Upload video file
- `POST /upload/audiofile_upload` - Upload audio file  
- `POST /process/start` - Start processing
- `GET /process/status/{process_tag}` - Check processing status
- `GET /download/{process_tag}` - Download result

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Usage

1. Upload a video file and an audio file
2. Optionally customize the output filename
3. Click "Start Processing" to begin
4. The app will automatically poll for status updates
5. When complete, the result will be automatically downloaded
6. Process status persists across page refreshes

## Configuration

The app is configured to use the API at `http://0.0.0.0:8000`. Update the `API_BASE` constant in `src/App.js` if your API is running on a different address.