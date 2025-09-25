
const apiKeyEl = document.getElementById('apiKey');
const modelEl = document.getElementById('model');
const promptEl = document.getElementById('prompt');
const statusEl = document.getElementById('status');

async function load(){
  const {openai_api_key, openai_model, openai_prompt} = await chrome.storage.local.get(['openai_api_key','openai_model','openai_prompt']);
  if (openai_api_key) apiKeyEl.value = openai_api_key;
  if (openai_model) modelEl.value = openai_model;
  if (openai_prompt) promptEl.value = openai_prompt;
}
load();

document.getElementById('saveBtn').addEventListener('click', async () => {
  await chrome.storage.local.set({
    openai_api_key: apiKeyEl.value.trim(),
    openai_model: modelEl.value,
    openai_prompt: promptEl.value.trim()
  });
  statusEl.textContent = 'Disimpan.';
  setTimeout(()=> statusEl.textContent = '', 1500);
});
