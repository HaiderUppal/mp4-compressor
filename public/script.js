const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const compressBtn = document.getElementById('compress-btn');

const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const timemark = document.getElementById('timemark');

const resultContainer = document.getElementById('result-container');
const statOriginal = document.getElementById('stat-original');
const statCompressed = document.getElementById('stat-compressed');
const statRatio = document.getElementById('stat-ratio');
const downloadBtn = document.getElementById('download-btn');
const resetBtn = document.getElementById('reset-btn');

let selectedFile = null;

// Socket.io for progress
const socket = io();
const clientId = Math.random().toString(36).substring(2, 15);
socket.emit('join', clientId);

// File handling
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    if (!file.type.startsWith('video/')) {
        alert('Please upload a valid video file.');
        return;
    }
    selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    
    dropZone.classList.add('hidden');
    fileInfo.classList.remove('hidden');
}

compressBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    fileInfo.classList.add('hidden');
    progressContainer.classList.remove('hidden');

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('clientId', clientId);

    try {
        const response = await fetch('/compress', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Upload failed');
        }
    } catch (error) {
        alert('An error occurred during upload: ' + error.message);
        resetUI();
    }
});

socket.on('progress', (data) => {
    progressFill.style.width = `${data.percent}%`;
    progressText.textContent = `${data.percent}%`;
    if (data.timemark) {
        timemark.textContent = `Processed timeline: ${data.timemark}`;
    }
});

socket.on('complete', (data) => {
    progressContainer.classList.add('hidden');
    resultContainer.classList.remove('hidden');

    statOriginal.textContent = formatBytes(data.originalSize);
    statCompressed.textContent = formatBytes(data.compressedSize);
    statRatio.textContent = `${data.ratio}x`;
    downloadBtn.href = data.downloadUrl;
    
    // Automatically click download or let user click it
});

socket.on('error', (data) => {
    alert('Compression error: ' + data.message);
    resetUI();
});

resetBtn.addEventListener('click', resetUI);

function resetUI() {
    selectedFile = null;
    fileInput.value = '';
    resultContainer.classList.add('hidden');
    progressContainer.classList.add('hidden');
    fileInfo.classList.add('hidden');
    dropZone.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressText.textContent = '0%';
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
