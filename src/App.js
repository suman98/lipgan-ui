import { useState, useEffect, useRef } from 'react';

function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [videoTag, setVideoTag] = useState('');
  const [audioTag, setAudioTag] = useState('');
  const [processTag, setProcessTag] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiBase, setApiBase] = useState(process.env.REACT_APP_API_URL);
  const [outfileTag, setOutfileTag] = useState('output_video.mp4');
  const [statusText, setStatusText] = useState('Idle');
  const [statusDetail, setStatusDetail] = useState('Waiting for inputs');
  const [jobInfo, setJobInfo] = useState('');
  const [errorText, setErrorText] = useState('');
  const [logText, setLogText] = useState('');
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const pollTimer = useRef(null);
  const inputVideoRef = useRef(null);
  const inputAudioRef = useRef(null);
  const outputVideoRef = useRef(null);

  // Load saved process and config
  useEffect(() => {
    const savedProcessTag = localStorage.getItem('wav2lip_process_tag');
    if (savedProcessTag) {
      setProcessTag(savedProcessTag);
      setJobInfo('Process ID: ' + savedProcessTag);
      setIsProcessing(true);
    }

    const savedConfig = JSON.parse(localStorage.getItem('wav2lip_config') || '{}');
    if (savedConfig.apiBase) setApiBase(savedConfig.apiBase);
    if (savedConfig.outfileTag) setOutfileTag(savedConfig.outfileTag);
  }, []);

  // Handle polling when processTag and isProcessing change
  useEffect(() => {
    if (processTag && isProcessing) {
      console.log('Starting polling for process:', processTag);
      // Initial status check
      checkStatus(processTag);
      // Start polling
      const interval = setInterval(() => {
        console.log('Polling status...');
        checkStatus(processTag);
      }, 2000);
      
      pollTimer.current = interval;
      
      return () => {
        console.log('Cleaning up polling');
        clearInterval(interval);
      };
    } else {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    }
  }, [processTag, isProcessing]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
      }
    };
  }, []);

  // Persist config
  useEffect(() => {
    localStorage.setItem('wav2lip_config', JSON.stringify({ apiBase, outfileTag }));
  }, [apiBase, outfileTag]);

  const setStatus = (mode, detail = '') => {
    setStatusText(mode);
    setStatusDetail(detail);
  };

  const setError = (err) => {
    setErrorText(err);
  };

  const clearError = () => {
    setErrorText('');
  };

  const showLog = (text) => {
    setLogText(text);
  };

  const validate = () => {
    if (!apiBase.trim()) throw new Error('Please enter API Base URL.');
    if (!videoFile) throw new Error('Please select a video file.');
    if (!audioFile) throw new Error('Please select an audio file.');
  };

  const enableUI = (processing) => {
    setIsProcessing(processing);
  };

  const handleFileChange = (file, type) => {
    clearError();
    if (type === 'video' && file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      if (inputVideoRef.current) inputVideoRef.current.src = url;
    } else if (type === 'audio' && file) {
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      if (inputAudioRef.current) inputAudioRef.current.src = url;
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    let usedVideo = false, usedAudio = false;
    
    for (const f of files) {
      if (!usedVideo && f.type.startsWith('video/')) {
        handleFileChange(f, 'video');
        usedVideo = true;
      } else if (!usedAudio && f.type.startsWith('audio/')) {
        handleFileChange(f, 'audio');
        usedAudio = true;
      }
    }
  };

  const uploadVideo = async () => {
    const formData = new FormData();
    formData.append('file', videoFile);
    
    const response = await fetch(`${apiBase}/upload/video`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) throw new Error('Video upload failed');
    const data = await response.json();
    setVideoTag(data.video_tag);
    return data.video_tag;
  };

  const uploadAudio = async () => {
    const formData = new FormData();
    formData.append('file', audioFile);
    
    const response = await fetch(`${apiBase}/upload/audio`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) throw new Error('Audio upload failed');
    const data = await response.json();
    setAudioTag(data.audio_tag);
    return data.audio_tag;
  };

  const startProcessing = async (vTag, aTag) => {
    const payload = {
      video_tag: vTag,
      audio_tag: aTag,
      outfile_tag: outfileTag || 'output_video.mp4',
      checkpoint_path: "/Users/suman/Desktop/projects/wav2lip/checkpoints/wav2lip_gan.pth",
      segmentation_path: "/Users/suman/Desktop/projects/wav2lip/checkpoints/face_segmentation.pth",
      sr_path: "/Users/suman/Desktop/projects/wav2lip/checkpoints/esrgan_max.pth",
      no_sr: false,
      no_segmentation: false
    };

    const response = await fetch(`${apiBase}/process/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('Processing start failed');
    const data = await response.json();
    const pTag = data.process_tag;
    
    setProcessTag(pTag);
    localStorage.setItem('wav2lip_process_tag', pTag);
    setJobInfo('Process ID: ' + pTag);
    
    return pTag;
  };

  const checkStatus = async (tag) => {
    if (!tag) return;
    
    try {
      const response = await fetch(`${apiBase}/process/status/${tag}`);
      if (!response.ok) throw new Error('Status check failed');
      
      const data = await response.json();
      
      console.log('Status check:', data); // Debug log
      
      if (data.running) {
        setStatus('Processing', 'Wav2Lip is running...');
        setProgress(70);
      } else if (data.out_exists) {
        setStatus('Completed', 'Processing completed successfully!');
        setProgress(100);
        setIsProcessing(false);
        await downloadResult(tag);
      } else if (data.returncode !== 0) {
        setStatus('Failed', 'Processing failed with errors');
        setProgress(0);
        setIsProcessing(false);
        if (data.log_tail) {
          showLog(data.log_tail);
          setError('Check log output for details');
        }
      } else {
        // Process exists but not running and no output yet - might be queued
        setStatus('Processing', 'Process queued or starting...');
        setProgress(30);
      }
      
      if (data.log_tail) {
        showLog(data.log_tail);
      }
      
    } catch (error) {
      setError('Status check failed: ' + error.message);
      console.error('Status check error:', error);
    }
  };

  const downloadResult = async (tag) => {
    try {
      const response = await fetch(`${apiBase}/download/${tag}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      setDownloadUrl(url);
      if (outputVideoRef.current) outputVideoRef.current.src = url;
      
      // Auto-download
      const a = document.createElement('a');
      a.href = url;
      a.download = `${outfileTag || 'output'}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
    } catch (error) {
      setError('Download failed: ' + error.message);
    }
  };

  const startPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
    }
    console.log('Starting polling every 2000ms'); // Debug log
    pollTimer.current = setInterval(() => {
      console.log('Polling status...'); // Debug log
      checkStatus(processTag);
    }, 2000);
  };

  const stopPolling = () => {
    if (pollTimer.current) {
      console.log('Stopping polling'); // Debug log
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };



  const handleStart = async () => {
    clearError();
    showLog('');
    
    try {
      validate();
    } catch (e) {
      setError(e.message);
      return;
    }

    enableUI(true);
    setProgress(0);
    
    try {
      setStatus('Uploading', 'Uploading video file...');
      setProgress(20);
      const vTag = await uploadVideo();
      
      setStatus('Uploading', 'Uploading audio file...');
      setProgress(40);
      const aTag = await uploadAudio();
      
      setStatus('Processing', 'Starting Wav2Lip processing...');
      setProgress(50);
      await startProcessing(vTag, aTag);
      
      startPolling();
      
    } catch (error) {
      setStatus('Failed', error.message);
      setError(error.message);
      enableUI(false);
      setProgress(0);
    }
  };

  const handleReset = () => {
    setProcessTag('');
    setVideoTag('');
    setAudioTag('');
    localStorage.removeItem('wav2lip_process_tag');
    stopPolling();
    enableUI(false);
    setStatus('Idle', 'Waiting for inputs');
    setProgress(0);
    clearError();
    showLog('');
    setJobInfo('');
    setDownloadUrl('');
    if (outputVideoRef.current) outputVideoRef.current.src = '';
  };

  const getStatusDotClass = () => {
    if (statusText === 'Completed') return 'dot ok';
    if (statusText === 'Failed' || statusText === 'Error') return 'dot err';
    if (statusText === 'Uploading' || statusText === 'Running' || statusText === 'Processing') return 'dot run';
    return 'dot';
  };

  return (
    <div className="app">
      <header>
        <div className="brand">
          <div className="logo" aria-hidden="true"></div>
          <div>
            <div style={{ fontSize: '18px' }}>Sujip's GAN Orchestrator</div>
            <div className="small">Upload face+background video and an audio track, run, then preview the synthesized output.</div>
          </div>
        </div>
        <div className="badge">Cloud API</div>
      </header>

      <main>
        <section className="card">
          <div className="section-title">Inputs</div>

          <div 
            className={`dropzone ${isDragOver ? 'dragover' : ''}`}
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="drop">
              <input 
                type="file" 
                id="videoFile" 
                accept="video/*"
                onChange={(e) => handleFileChange(e.target.files[0], 'video')}
              />
              <div style={{ fontSize: '28px', opacity: '.85' }}>🎬</div>
              <label htmlFor="videoFile">Face+Background Video</label>
              <div className="hint">MP4, MOV, WebM • up to ~500MB</div>
              {videoFile && <div className="small">{videoFile.name} • {(videoFile.size / 1e6).toFixed(2)} MB</div>}
            </div>
            <div className="drop">
              <input 
                type="file" 
                id="audioFile" 
                accept="audio/*"
                onChange={(e) => handleFileChange(e.target.files[0], 'audio')}
              />
              <div style={{ fontSize: '28px', opacity: '.85' }}>🎵</div>
              <label htmlFor="audioFile">Audio File</label>
              <div className="hint">WAV, MP3, M4A • mono recommended</div>
              {audioFile && <div className="small">{audioFile.name} • {(audioFile.size / 1e6).toFixed(2)} MB</div>}
            </div>
          </div>

          <div className="inputs">
            <div className="field">
              <label htmlFor="apiBase">API Base URL</label>
              <input 
                id="apiBase" 
                type="url" 
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
              />
              <small>Base endpoint for your Wav2Lip service.</small>
            </div>
            <div className="field">
              <label htmlFor="outfileTag">Output Filename</label>
              <input 
                id="outfileTag" 
                type="text" 
                placeholder="output_video" 
                value={outfileTag}
                onChange={(e) => setOutfileTag(e.target.value)}
              />
              <small>Name for the generated video file.</small>
            </div>
          </div>

          <div className="actions">
            <button onClick={handleStart} disabled={isProcessing}>
              Start Synthesis
            </button>
            <button className="secondary" onClick={handleReset}>
              Reset Process
            </button>
            <span className="pill">
              <span className={getStatusDotClass()}></span>
              <span>{statusText}</span>
            </span>
          </div>

          <div className="progress">
            <div className="bar" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="status-line">
            <strong>Status:</strong> <span>{statusDetail}</span>
          </div>
          <div className="status-line small">
            <span>{jobInfo}</span>
          </div>
          {errorText && <div className="status-line small error">{errorText}</div>}
          {logText && <div className="log-output">{logText}</div>}
        </section>

        <section className="card preview">
          <div className="section-title">Preview</div>

          <div className="grid-2">
            <div className="pane">
              <div className="small">Input Video</div>
              <video ref={inputVideoRef} controls playsInline></video>
            </div>
            <div className="pane">
              <div className="small">Input Audio</div>
              <audio ref={inputAudioRef} controls></audio>
            </div>
          </div>

          <div className="pane">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="small">Synthesized Output</div>
              {downloadUrl && (
                <a 
                  href={downloadUrl} 
                  download={`${outfileTag || 'output'}.mp4`}
                  className="small"
                >
                  Download video
                </a>
              )}
            </div>
            <video ref={outputVideoRef} controls playsInline></video>
          </div>
        </section>
      </main>

      <footer>
        <div className="small">Tip: For best results, use a clear, front-facing video and clean speech audio.</div>
        <div className="small">
          Config: <code className="inline">POST /upload</code>, <code className="inline">POST /process/start</code>, <code className="inline">GET /process/status</code>
        </div>
      </footer>
    </div>
  );
}

export default App;