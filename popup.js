
const pasteBtn = document.getElementById('pasteBtn');
const downloadLink = document.getElementById('downloadLink');
const clearBtn = document.getElementById('clearBtn');
const preview = document.getElementById('preview');
const dropZone = document.getElementById('dropZone');
const statusEl = document.getElementById('status');
const apiKeyEl = document.getElementById('apiKey');
const modelEl = document.getElementById('model');
const promptEl = document.getElementById('prompt');
const testBtn = document.getElementById('testBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const saveBtn = document.getElementById('saveBtn');
const answerEl = document.getElementById('answer');

function setStatus(msg){ statusEl.textContent = msg || ''; }
function setAnswer(msg){ answerEl.textContent = msg || ''; }

function showImageBlob(blob){
  const url = URL.createObjectURL(blob);
  preview.src = url;
  preview.style.display = 'block';
  downloadLink.href = url;
}

async function toDataUrlFromObjectUrl(objectUrl){
  const res = await fetch(objectUrl);
  const blob = await res.blob();
  return await new Promise((resolve)=>{
    const reader = new FileReader();
    reader.onloadend = ()=> resolve(reader.result); // data URL
    reader.readAsDataURL(blob);
  });
}

async function loadSettings(){
  const {openai_api_key, openai_model, openai_prompt} = await chrome.storage.local.get(['openai_api_key','openai_model','openai_prompt']);
  if (openai_api_key) apiKeyEl.value = openai_api_key;
  if (openai_model) modelEl.value = openai_model;
  if (openai_prompt) promptEl.value = openai_prompt;
}
loadSettings();

saveBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({
    openai_api_key: apiKeyEl.value.trim(),
    openai_model: modelEl.value,
    openai_prompt: promptEl.value.trim()
  });
  setStatus('Disimpan.');
  setTimeout(()=>setStatus(''), 1500);
});

async function tryReadClipboard(){
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imgType = item.types.find(t => t.startsWith('image/'));
      if (imgType) {
        const blob = await item.getType(imgType);
        showImageBlob(blob);
        setStatus('Preview ready (clipboard).');
        return;
      }
    }
    setStatus('Clipboard tidak berisi gambar.');
  } catch (e) {
    console.error(e);
    setStatus('Gagal membaca clipboard (izin/gesture diperlukan).');
  }
}

pasteBtn.addEventListener('click', async () => {
  setStatus('Membaca clipboard...');
  await tryReadClipboard();
});

document.addEventListener('paste', async (evt) => {
  if (!evt.clipboardData) return;
  for (const item of evt.clipboardData.items) {
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      showImageBlob(blob);
      evt.preventDefault();
      setStatus('Preview ready (paste).');
      return;
    }
  }
});

clearBtn.addEventListener('click', () => {
  preview.removeAttribute('src');
  preview.style.display = 'none';
  setAnswer('');
  downloadLink.removeAttribute('href');
  setStatus('Cleared.');
});

['dragenter','dragover'].forEach(ev => dropZone.addEventListener(ev, (e)=>{e.preventDefault();dropZone.classList.add('drag');}));
['dragleave','drop'].forEach(ev => dropZone.addEventListener(ev, (e)=>{e.preventDefault();dropZone.classList.remove('drag');}));
dropZone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    showImageBlob(file);
    setStatus('Preview ready (drop).');
  } else {
    setStatus('File bukan gambar.');
  }
});

testBtn.addEventListener('click', async () => {
  const key = apiKeyEl.value.trim();
  const model = modelEl.value;
  if (!key) { setStatus('Masukkan API key.'); return; }
  setStatus('Menguji koneksi...');
  setAnswer('');
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "pong" if you can read this.' }
        ],
        max_tokens: 5,
        temperature: 0
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      setStatus(`Gagal: ${resp.status} ${resp.statusText}`);
      setAnswer(errText);
      return;
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '(no content)';
    setStatus('Koneksi OK.');
    setAnswer(text);
  } catch (e) {
    console.error(e);
    setStatus('Error jaringan.');
    setAnswer(String(e));
  }
});

analyzeBtn.addEventListener('click', async () => {
  const key = apiKeyEl.value.trim();
  const model = modelEl.value;
  const prompt = promptEl.value.trim() || 'Describe the image.';
  if (!key) { setStatus('Masukkan API key.'); return; }
  if (!preview.src) { setStatus('Masukkan gambar dulu.'); return; }

  setStatus('Mengirim ke OpenAI...');
  setAnswer('');
  try {
    const dataUrl = await toDataUrlFromObjectUrl(preview.src);
    const messages = [
      { role: 'system', content: 'You are a concise vision assistant. Answer in Indonesian when the user prompt is Indonesian.' },
      { role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]}
    ];
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      setStatus(`Gagal: ${resp.status} ${resp.statusText}`);
      setAnswer(errText);
      return;
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '(no content)';
    setStatus('Selesai.');
    setAnswer(text);
  } catch (e) {
    console.error(e);
    setStatus('Error saat mengirim.');
    setAnswer(String(e));
  }
});

// Attempt auto-read on open
setTimeout(()=>{ tryReadClipboard(); }, 200);
