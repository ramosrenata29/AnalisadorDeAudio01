/**
 * Analisador de Áudio & Frequências de Terapia
 * JavaScript (Vanilla) SPA
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const btnTheme = document.getElementById('btn-theme');
  const iconMoon = document.getElementById('icon-moon');
  const iconSun = document.getElementById('icon-sun');
  const btnColorblind = document.getElementById('btn-colorblind');

  const fileInput = document.getElementById('audio-file-input');
  const dropzone = document.getElementById('dropzone');
  const fileLabelText = document.getElementById('file-label-text');
  const fileInfo = document.getElementById('file-info');

  const playerControls = document.getElementById('player-controls');
  const btnPlayPause = document.getElementById('btn-play-pause');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const playBtnText = document.getElementById('play-btn-text');
  const timeCurrent = document.getElementById('time-current');
  const timeDuration = document.getElementById('time-duration');
  const seekBar = document.getElementById('seek-bar');
  const volumeAudioInput = document.getElementById('volume-audio');
  const volumeAudioVal = document.getElementById('volume-audio-val');

  const hzTabs = document.querySelectorAll('.hz-tab');
  const customHzSlider = document.getElementById('custom-hz-slider');
  const customHzVal = document.getElementById('custom-hz-val');
  const volumeToneInput = document.getElementById('volume-tone');
  const volumeToneVal = document.getElementById('volume-tone-val');

  const viewTabs = document.querySelectorAll('.view-tab');
  const canvas = document.getElementById('visualizer-canvas');
  const ctx = canvas.getContext('2d');

  const statDominantFreq = document.getElementById('stat-dominant-freq');
  const statBassLevel = document.getElementById('stat-bass-level');
  const statMidLevel = document.getElementById('stat-mid-level');
  const statTrebleLevel = document.getElementById('stat-treble-level');

  const btnExport = document.getElementById('btn-export');
  const exportStatus = document.getElementById('export-status');

  // --- State Variables ---
  let audioContext = null;
  let audioBuffer = null;
  let audioSource = null;
  let audioGainNode = null;

  let oscillator = null;
  let toneGainNode = null;

  let analyser = null;
  let dataArray = null;
  let bufferLength = 0;

  let isPlaying = false;
  let startTime = 0;
  let pauseOffset = 0;
  let currentFile = null;

  let selectedHz = 0; // 0 = None
  let activeViewMode = 'bars'; // 'bars', 'wave', 'circular'
  let animFrameId = null;

  // Hz Color Palette Mapping
  const hzColorMap = {
    174: '#ef4444',
    285: '#f97316',
    396: '#eab308',
    417: '#84cc16',
    432: '#10b981',
    528: '#06b6d4',
    639: '#3b82f6',
    741: '#6366f1',
    852: '#8b5cf6',
    963: '#ec4899'
  };

  const hzColorblindMap = {
    174: '#005ab5',
    285: '#117733',
    396: '#44aa99',
    417: '#88ccee',
    432: '#ddcc77',
    528: '#cc6677',
    639: '#aa4499',
    741: '#882255',
    852: '#440154',
    963: '#fde725'
  };

  // --- Theme & Colorblind Handlers ---
  btnTheme.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    iconMoon.classList.toggle('hidden', newTheme === 'dark');
    iconSun.classList.toggle('hidden', newTheme === 'light');
  });

  btnColorblind.addEventListener('click', () => {
    const isCb = document.documentElement.getAttribute('data-colorblind') === 'true';
    document.documentElement.setAttribute('data-colorblind', !isCb);
    btnColorblind.classList.toggle('active', !isCb);
  });

  // --- Audio Context Initialization ---
  function initAudioContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioCtx();

      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);

      audioGainNode = audioContext.createGain();
      audioGainNode.gain.value = parseFloat(volumeAudioInput.value);

      toneGainNode = audioContext.createGain();
      toneGainNode.gain.value = parseFloat(volumeToneInput.value);

      // Routing:
      // audioSource -> audioGainNode -> analyser -> destination
      // oscillator  -> toneGainNode  -> analyser -> destination
      audioGainNode.connect(analyser);
      toneGainNode.connect(analyser);
      analyser.connect(audioContext.destination);
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
  }

  // --- Drag & Drop / File Loading ---
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });

  function handleFileSelection(file) {
    if (!file.type.startsWith('audio/') && !file.name.endsWith('.mp3') && !file.name.endsWith('.wav')) {
      alert('Por favor, selecione um arquivo de áudio válido (.mp3, .wav, etc).');
      return;
    }

    currentFile = file;
    fileLabelText.textContent = file.name;
    fileInfo.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB • ${file.type || 'audio'}`;

    const reader = new FileReader();
    reader.onload = async (e) => {
      initAudioContext();
      try {
        exportStatus.textContent = 'Decodificando áudio...';
        audioBuffer = await audioContext.decodeAudioData(e.target.result);
        exportStatus.textContent = '';

        // Reset playback position
        stopPlayback();
        pauseOffset = 0;
        seekBar.value = 0;
        timeCurrent.textContent = '00:00';
        timeDuration.textContent = formatTime(audioBuffer.duration);

        playerControls.classList.remove('disabled');
        btnExport.classList.remove('disabled');
        btnExport.disabled = false;
      } catch (err) {
        alert('Erro ao decodificar o arquivo de áudio: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // --- Audio Playback Controls ---
  btnPlayPause.addEventListener('click', () => {
    if (!audioBuffer) return;
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  });

  function startPlayback() {
    initAudioContext();

    audioSource = audioContext.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.connect(audioGainNode);

    startTime = audioContext.currentTime - pauseOffset;
    audioSource.start(0, pauseOffset);

    isPlaying = true;
    updatePlayPauseUI();
    updateToneState();

    audioSource.onended = () => {
      if (audioContext.currentTime - startTime >= audioBuffer.duration) {
        stopPlayback();
        pauseOffset = 0;
        seekBar.value = 0;
        timeCurrent.textContent = '00:00';
      }
    };

    drawVisualizer();
  }

  function pausePlayback() {
    if (!isPlaying) return;
    pauseOffset = audioContext.currentTime - startTime;
    stopPlayback();
  }

  function stopPlayback() {
    if (audioSource) {
      try { audioSource.stop(); } catch(e) {}
      audioSource.disconnect();
      audioSource = null;
    }
    stopTone();
    isPlaying = false;
    updatePlayPauseUI();
  }

  function updatePlayPauseUI() {
    if (isPlaying) {
      iconPlay.classList.add('hidden');
      iconPause.classList.remove('hidden');
      playBtnText.textContent = 'Pausar';
    } else {
      iconPlay.classList.remove('hidden');
      iconPause.classList.add('hidden');
      playBtnText.textContent = 'Reproduzir';
    }
  }

  seekBar.addEventListener('input', () => {
    if (!audioBuffer) return;
    const seekTo = (seekBar.value / 100) * audioBuffer.duration;
    pauseOffset = seekTo;
    timeCurrent.textContent = formatTime(seekTo);

    if (isPlaying) {
      stopPlayback();
      startPlayback();
    }
  });

  volumeAudioInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    volumeAudioVal.textContent = `${Math.round(val * 100)}%`;
    if (audioGainNode) {
      audioGainNode.gain.value = val;
    }
  });

  // --- Therapy Frequency Tone Generator ---
  hzTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      hzTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const hz = parseInt(tab.getAttribute('data-hz'), 10);
      selectedHz = hz;

      if (hz > 0) {
        customHzSlider.value = hz;
        customHzVal.textContent = `${hz} Hz`;
      }

      updateToneState();
    });
  });

  customHzSlider.addEventListener('input', (e) => {
    const hz = parseInt(e.target.value, 10);
    customHzVal.textContent = `${hz} Hz`;
    selectedHz = hz;

    // Deselect tab active highlights if custom value doesn't match predefined tabs exactly
    let matched = false;
    hzTabs.forEach(tab => {
      if (parseInt(tab.getAttribute('data-hz'), 10) === hz) {
        tab.classList.add('active');
        matched = true;
      } else {
        tab.classList.remove('active');
      }
    });

    updateToneState();
  });

  volumeToneInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    volumeToneVal.textContent = `${Math.round(val * 100)}%`;
    if (toneGainNode) {
      toneGainNode.gain.value = val;
    }
  });

  function updateToneState() {
    if (!isPlaying || selectedHz === 0) {
      stopTone();
      return;
    }

    if (!oscillator) {
      oscillator = audioContext.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = selectedHz;
      oscillator.connect(toneGainNode);
      oscillator.start();
    } else {
      oscillator.frequency.setTargetAtTime(selectedHz, audioContext.currentTime, 0.05);
    }
  }

  function stopTone() {
    if (oscillator) {
      try { oscillator.stop(); } catch(e) {}
      oscillator.disconnect();
      oscillator = null;
    }
  }

  // --- Visualizer View Modes ---
  viewTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      viewTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeViewMode = tab.getAttribute('data-view');
    });
  });

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function getAccentColor() {
    const isCb = document.documentElement.getAttribute('data-colorblind') === 'true';
    if (selectedHz in (isCb ? hzColorblindMap : hzColorMap)) {
      return (isCb ? hzColorblindMap : hzColorMap)[selectedHz];
    }
    return isCb ? '#005ab5' : '#2563eb';
  }

  // --- Visualizer Render Loop ---
  function drawVisualizer() {
    if (!isPlaying && !audioBuffer) return;

    animFrameId = requestAnimationFrame(drawVisualizer);

    // Update Seekbar & Time Display
    if (isPlaying && audioBuffer) {
      const current = audioContext.currentTime - startTime;
      if (current <= audioBuffer.duration) {
        timeCurrent.textContent = formatTime(current);
        seekBar.value = (current / audioBuffer.duration) * 100;
      }
    }

    if (!analyser) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (activeViewMode === 'bars') {
      analyser.getByteFrequencyData(dataArray);
      drawFrequencyBars(width, height);
      calculateStats(dataArray);
    } else if (activeViewMode === 'wave') {
      analyser.getByteTimeDomainData(dataArray);
      drawTimeWaveform(width, height);
      calculateStats(dataArray);
    } else if (activeViewMode === 'circular') {
      analyser.getByteFrequencyData(dataArray);
      drawCircularSpectrum(width, height);
      calculateStats(dataArray);
    }
  }

  function drawFrequencyBars(width, height) {
    const barWidth = (width / bufferLength) * 2.5;
    let x = 0;
    const accentColor = getAccentColor();

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * height;

      const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, accentColor);
      gradient.addColorStop(1, '#8b5cf6');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);

      x += barWidth + 1;
      if (x > width) break;
    }
  }

  function drawTimeWaveform(width, height) {
    ctx.lineWidth = 2 * (window.devicePixelRatio || 1);
    ctx.strokeStyle = getAccentColor();
    ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  function drawCircularSpectrum(width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) * 0.4;
    const accentColor = getAccentColor();

    ctx.save();
    ctx.translate(centerX, centerY);

    const bars = 128;
    const step = (Math.PI * 2) / bars;

    for (let i = 0; i < bars; i++) {
      const index = Math.floor((i / bars) * (bufferLength / 2));
      const val = dataArray[index] || 0;
      const barHeight = (val / 255) * (radius * 1.2);

      const angle = i * step;
      const x1 = Math.cos(angle) * radius;
      const y1 = Math.sin(angle) * radius;
      const x2 = Math.cos(angle) * (radius + barHeight);
      const y2 = Math.sin(angle) * (radius + barHeight);

      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.restore();
  }

  // --- Statistics Calculation ---
  function calculateStats(data) {
    if (!audioContext) return;

    const sampleRate = audioContext.sampleRate;
    const nyquist = sampleRate / 2;
    const hzPerBin = nyquist / bufferLength;

    let maxVal = -1;
    let maxBin = 0;

    let bassSum = 0, bassCount = 0;
    let midSum = 0, midCount = 0;
    let trebleSum = 0, trebleCount = 0;

    for (let i = 0; i < bufferLength; i++) {
      const val = data[i];
      const freq = i * hzPerBin;

      if (val > maxVal) {
        maxVal = val;
        maxBin = i;
      }

      if (freq >= 20 && freq <= 250) {
        bassSum += val;
        bassCount++;
      } else if (freq > 250 && freq <= 4000) {
        midSum += val;
        midCount++;
      } else if (freq > 4000) {
        trebleSum += val;
        trebleCount++;
      }
    }

    const dominantHz = Math.round(maxBin * hzPerBin);
    statDominantFreq.textContent = `${dominantHz} Hz`;

    const avgBass = bassCount > 0 ? bassSum / bassCount : 0;
    const avgMid = midCount > 0 ? midSum / midCount : 0;
    const avgTreble = trebleCount > 0 ? trebleSum / trebleCount : 0;

    const total = avgBass + avgMid + avgTreble || 1;

    statBassLevel.textContent = `${Math.round((avgBass / total) * 100)}%`;
    statMidLevel.textContent = `${Math.round((avgMid / total) * 100)}%`;
    statTrebleLevel.textContent = `${Math.round((avgTreble / total) * 100)}%`;
  }

  // --- Export Audio with OfflineAudioContext ---
  btnExport.addEventListener('click', async () => {
    if (!audioBuffer) return;

    btnExport.disabled = true;
    exportStatus.textContent = 'Processando e renderizando áudio com frequência de terapia...';

    try {
      const duration = audioBuffer.duration;
      const sampleRate = audioBuffer.sampleRate;
      const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
        audioBuffer.numberOfChannels,
        duration * sampleRate,
        sampleRate
      );

      // Audio Source
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;

      const mainGain = offlineCtx.createGain();
      mainGain.gain.value = parseFloat(volumeAudioInput.value);

      source.connect(mainGain);
      mainGain.connect(offlineCtx.destination);
      source.start(0);

      // Therapy Tone (if active)
      if (selectedHz > 0) {
        const osc = offlineCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = selectedHz;

        const toneGain = offlineCtx.createGain();
        toneGain.gain.value = parseFloat(volumeToneInput.value);

        osc.connect(toneGain);
        toneGain.connect(offlineCtx.destination);
        osc.start(0);
      }

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);

      const fileName = currentFile ? currentFile.name.replace(/\.[^/.]+$/, "") : "audio";
      const exportName = selectedHz > 0 ? `${fileName}_${selectedHz}Hz_terapia.wav` : `${fileName}_modificado.wav`;

      const downloadUrl = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = exportName;
      a.click();

      exportStatus.textContent = `Sucesso! Arquivo "${exportName}" gerado com sucesso.`;
    } catch (err) {
      exportStatus.textContent = `Erro ao exportar: ${err.message}`;
    } finally {
      btnExport.disabled = false;
    }
  });

  // --- Helpers ---
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // WAV Encoder Helper Function
  function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    let result;
    if (numChannels === 2) {
      result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
    } else {
      result = buffer.getChannelData(0);
    }

    return encodeWAV(result, numChannels, sampleRate, format, bitDepth);
  }

  function interleave(inputL, inputR) {
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);

    let index = 0;
    let inputIndex = 0;

    while (index < length) {
      result[index++] = inputL[inputIndex];
      result[index++] = inputR[inputIndex];
      inputIndex++;
    }
    return result;
  }

  function encodeWAV(samples, numChannels, sampleRate, format, bitDepth) {
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
    const view = new DataView(buffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* RIFF chunk length */
    view.setUint32(4, 36 + samples.length * bytesPerSample, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, format, true);
    /* channel count */
    view.setUint16(22, numChannels, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * blockAlign, true);
    /* block align */
    view.setUint16(32, blockAlign, true);
    /* bits per sample */
    view.setUint16(34, bitDepth, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples.length * bytesPerSample, true);

    floatTo16BitPCM(view, 44, samples);

    return new Blob([buffer], { type: 'audio/wav' });
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  }
});
