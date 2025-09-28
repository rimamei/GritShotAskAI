/**
 * GritShot AI Chrome Extension - Main Popup Script
 */

class GritShotApp {
  constructor() {
    this.elements = this.initializeElements();
    this.state = {
      currentImage: null,
      isProcessing: false,
    };
    this.init();
  }

  initializeElements() {
    return {
      // Main controls
      pasteBtn: document.getElementById('pasteBtn'),
      clearBtn: document.getElementById('clearBtn'),
      analyzeBtn: document.getElementById('analyzeBtn'),
      saveBtn: document.getElementById('saveBtn'),

      // Elements for prompt form
      preview: document.getElementById('preview'),
      dropZone: document.getElementById('dropzone'),
      dropzonePreview: document.getElementById('dropzonePreview'),
      statusImage: document.getElementById('status-image'),
      answer: document.getElementById('answer'),
      prompt: document.getElementById('prompt'),
      fileInput: document.getElementById('fileInput'),

      // AI Provider settings
      aiProvider: document.getElementById('aiProvider'),
      openaiSettings: document.getElementById('openaiSettings'),
      geminiSettings: document.getElementById('geminiSettings'),

      // OpenAI settings
      apiKeySetting: document.getElementById('apiKeySetting'),
      modelSetting: document.getElementById('modelSetting'),

      // Gemini settings
      geminiApiKeySetting: document.getElementById('geminiApiKeySetting'),
      geminiModelSetting: document.getElementById('geminiModelSetting'),

      // Common settings
      defaultPromptSetting: document.getElementById('promptSetting'),
      
      // Status elements
      statusSetting: document.getElementById('statusSetting'),
      clearApiKeyBtn: document.getElementById('clearApiKeyBtn'),
      clearApiKeyStatus: document.getElementById('clearApiKeyStatus'),
      notesPanel1: document.getElementById('notesPanel1'),

      // Tab elements
      tabContainer: document.querySelector('.tab-container'),
      tabs: document.querySelectorAll('.tab[data-target]'),
      panels: document.querySelectorAll('.view'),
    };
  }

  async init() {
    await this.loadSettings();
    this.attachEventListeners();
    this.setupTabNavigation();
    this.setupProviderSwitch();

    // validation
    this.validatePromptForm(); // Set initial button state
    this.validateSettingsForm(); // For the settings form

    const currentProvider = this.elements.aiProvider.value;
    const hasApiKey = this.getCurrentApiKey().trim();
    
    if (!hasApiKey) {
      this.switchToTab('panel-2');
      this.showSettingsStatus(
        `Please enter your ${currentProvider === 'openai' ? 'OpenAI' : 'Gemini'} API key to begin.`,
        'warning'
      );
      this.elements.notesPanel1.classList.remove('hidden');
    }
  }

  // Get current API key based on selected provider
  getCurrentApiKey() {
    const provider = this.elements.aiProvider.value;
    return provider === 'openai' 
      ? this.elements.apiKeySetting.value 
      : this.elements.geminiApiKeySetting.value;
  }

  // Get current model based on selected provider
  getCurrentModel() {
    const provider = this.elements.aiProvider.value;
    return provider === 'openai' 
      ? this.elements.modelSetting.value 
      : this.elements.geminiModelSetting.value;
  }

  // Setup provider switching
  setupProviderSwitch() {
    this.elements.aiProvider.addEventListener('change', () => {
      const provider = this.elements.aiProvider.value;
      
      if (provider === 'openai') {
        this.elements.openaiSettings.classList.remove('hidden');
        this.elements.geminiSettings.classList.add('hidden');
      } else {
        this.elements.openaiSettings.classList.add('hidden');
        this.elements.geminiSettings.classList.remove('hidden');
      }
      
      this.validateSettingsForm();
    });
  }

  // Form Validation for Ask AI
  validatePromptForm() {
    const hasImage = !!this.state.currentImage;
    const hasPrompt = this.elements.prompt.value.trim() !== '';
    const hasApiKey = !!this.getCurrentApiKey().trim();
    const isFormValid = hasImage && hasPrompt && hasApiKey;

    // Enable or disable the button based on validation
    this.elements.analyzeBtn.disabled = !isFormValid;
  }

  // Form Validation for Settings
  validateSettingsForm() {
    const hasDefaultPrompt = this.elements.defaultPromptSetting.value.trim() !== '';
    const provider = this.elements.aiProvider.value;
    
    let hasApiKey = false;
    let hasModel = false;
    
    if (provider === 'openai') {
      hasApiKey = this.elements.apiKeySetting.value.trim() !== '';
      hasModel = this.elements.modelSetting.value.trim() !== '';
    } else {
      hasApiKey = this.elements.geminiApiKeySetting.value.trim() !== '';
      hasModel = this.elements.geminiModelSetting.value.trim() !== '';
    }

    const isFormValid = hasDefaultPrompt && hasApiKey && hasModel;
    this.elements.saveBtn.disabled = !isFormValid;
  }

  // Settings Management
  async loadSettings() {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return; // Stop the function here
    }

    try {
      const settings = await chrome.storage.local.get([
        'ai_provider',
        'openai_api_key',
        'openai_model',
        'gemini_api_key',
        'gemini_model',
        'default_prompt',
      ]);

      // Set AI provider
      if (settings.ai_provider) {
        this.elements.aiProvider.value = settings.ai_provider;
      }

      // Load OpenAI settings
      if (settings.openai_api_key) {
        this.elements.apiKeySetting.value = settings.openai_api_key;
      }
      if (settings.openai_model) {
        this.elements.modelSetting.value = settings.openai_model;
      }

      // Load Gemini settings
      if (settings.gemini_api_key) {
        this.elements.geminiApiKeySetting.value = settings.gemini_api_key;
      }
      if (settings.gemini_model) {
        this.elements.geminiModelSetting.value = settings.gemini_model;
      }

      // Load default prompt
      if (settings.default_prompt) {
        this.elements.defaultPromptSetting.value = settings.default_prompt;
        this.elements.prompt.value = settings.default_prompt;
      }

      // Show/hide provider settings and clear button
      const currentProvider = this.elements.aiProvider.value;
      if (currentProvider === 'openai') {
        this.elements.openaiSettings.classList.remove('hidden');
        this.elements.geminiSettings.classList.add('hidden');
      } else {
        this.elements.openaiSettings.classList.add('hidden');
        this.elements.geminiSettings.classList.remove('hidden');
      }

      // Show clear button if any API key exists
      const hasAnyKey = settings.openai_api_key || settings.gemini_api_key;
      if (hasAnyKey) {
        this.elements.clearApiKeyBtn.classList.remove('hidden');
      } else {
        this.elements.clearApiKeyBtn.classList.add('hidden');
      }

      this.validatePromptForm();
    } catch (error) {
      console.error('Error loading settings:', error);
      this.showStatus('Error loading settings', 'error');
    }
  }

  // Save settings to chrome.storage
  async saveSettings() {
    const provider = this.elements.aiProvider.value;
    let apiKey = '';
    let model = '';

    // Validate API key based on provider
    if (provider === 'openai') {
      apiKey = this.elements.apiKeySetting.value.trim();
      model = this.elements.modelSetting.value;
      
      if (!apiKey.startsWith('sk-') || apiKey.length < 50) {
        this.showSettingsStatus(
          "Invalid OpenAI API Key. It must start with 'sk-' and be complete.",
          'error'
        );
        this.elements.apiKeySetting.classList.add('input-error');
        return;
      }
      this.elements.apiKeySetting.classList.remove('input-error');
    } else {
      apiKey = this.elements.geminiApiKeySetting.value.trim();
      model = this.elements.geminiModelSetting.value;
      
      if (!apiKey.startsWith('AIza') || apiKey.length < 35) {
        this.showSettingsStatus(
          "Invalid Gemini API Key. It must start with 'AIza' and be complete.",
          'error'
        );
        this.elements.geminiApiKeySetting.classList.add('input-error');
        return;
      }
      this.elements.geminiApiKeySetting.classList.remove('input-error');
    }

    try {
      const settings = {
        ai_provider: provider,
        default_prompt: this.elements.defaultPromptSetting.value.trim(),
      };

      // Save provider-specific settings
      if (provider === 'openai') {
        settings.openai_api_key = apiKey;
        settings.openai_model = model;
      } else {
        settings.gemini_api_key = apiKey;
        settings.gemini_model = model;
      }

      await chrome.storage.local.set(settings);
      this.showSettingsStatus('Settings saved successfully!', 'success');
      this.elements.clearApiKeyBtn.classList.remove('hidden');

      // Update current prompt if it's empty
      if (!this.elements.prompt.value.trim()) {
        this.elements.prompt.value = settings.default_prompt;
      }
      this.validatePromptForm();

      // Hide notes if API key is set
      this.elements.notesPanel1.classList.add('hidden');
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showSettingsStatus('Error saving settings', 'error');
    }
  }

  // Clear API Keys in storage
  async clearApiKey() {
    try {
      await chrome.storage.local.remove([
        'openai_api_key', 
        'gemini_api_key'
      ]);
      this.elements.apiKeySetting.value = '';
      this.elements.geminiApiKeySetting.value = '';
      this.showClearApiKeyStatus('All API Keys deleted successfully');
      this.elements.clearApiKeyBtn.classList.add('hidden');
      this.validateSettingsForm();
      this.validatePromptForm();
      this.elements.notesPanel1.classList.remove('hidden');
    } catch (error) {
      console.error('Error clearing API keys:', error);
      this.showClearApiKeyStatus('Error deleting API Keys');
    }
  }

  // Image Handling
  showImageBlob(blob) {
    if (this.state.currentImage) {
      URL.revokeObjectURL(this.state.currentImage);
    }

    const url = URL.createObjectURL(blob);
    this.state.currentImage = url;
    this.elements.preview.src = url;
    this.elements.preview.style.display = 'block';

    // UI Updates
    this.elements.dropZone.classList.add('hidden');
    this.elements.dropzonePreview.classList.remove('hidden');
    this.elements.pasteBtn.classList.add('hidden');
    this.elements.clearBtn.classList.remove('hidden');

    this.validatePromptForm();
  }

  async convertToDataUrl(objectUrl) {
    try {
      const response = await fetch(objectUrl);
      const blob = await response.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      throw new Error('Failed to convert image to data URL');
    }
  }

  async convertToBase64(objectUrl) {
    try {
      const response = await fetch(objectUrl);
      const blob = await response.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1]; // Remove data URL prefix
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      throw new Error('Failed to convert image to base64');
    }
  }

  async tryReadClipboard() {
    try {
      this.showStatus('Reading clipboard...', 'loading');

      const items = await navigator.clipboard.read();

      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          this.showImageBlob(blob);
          this.showStatus('Image loaded from clipboard', 'success');
          return;
        }
      }

      this.showStatus('No image found in clipboard', 'warning');
    } catch (error) {
      console.error('Clipboard error:', error);
      this.showStatus(
        'Failed to read clipboard (permission required)',
        'error'
      );
    }
  }

  clearImage() {
    if (this.state.currentImage) {
      URL.revokeObjectURL(this.state.currentImage);
      this.state.currentImage = null;
    }

    this.elements.preview.removeAttribute('src');
    this.elements.preview.style.display = 'none';
    this.elements.answer.textContent = 'No request has been made yet.';
    this.showStatus('Cleared', 'success');

    // UI Updates
    this.elements.dropZone.classList.remove('hidden');
    this.elements.dropzonePreview.classList.add('hidden');
    this.elements.pasteBtn.classList.remove('hidden');
    this.elements.clearBtn.classList.add('hidden');

    this.validatePromptForm();
  }

  // AI Analysis - OpenAI
  async analyzeWithOpenAI(prompt, dataUrl, apiKey, model) {
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful vision assistant. Provide clear, concise, and accurate descriptions. Answer in Indonesian if the user prompt is in Indonesian.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('No response content received from OpenAI API');
    }

    return content;
  }

  // AI Analysis - Gemini
  async analyzeWithGemini(prompt, base64Image, apiKey, model) {
    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000,
      }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Gemini res', response)

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!content) {
      throw new Error('No response content received from Gemini API');
    }

    return content;
  }

  // Main Analysis Function
  async analyzeImage() {
    if (this.state.isProcessing) return;

    const provider = this.elements.aiProvider.value;
    const apiKey = this.getCurrentApiKey().trim();
    const model = this.getCurrentModel();
    
    if (!apiKey) {
      this.showStatus(`Please enter your ${provider === 'openai' ? 'OpenAI' : 'Gemini'} API key in Settings`, 'error');
      return;
    }
    if (!this.state.currentImage) {
      this.showStatus('Please upload an image first', 'error');
      return;
    }
    const prompt = this.elements.prompt.value.trim();
    if (!prompt) {
      this.showStatus('Please enter a prompt', 'error');
      return;
    }

    this.state.isProcessing = true;
    this.updateAnalyzeButton(true);
    this.showStatus(`Sending request to ${provider === 'openai' ? 'OpenAI' : 'Google Gemini'}...`, 'loading');
    this.elements.answer.textContent = 'Processing...';

    try {
      let content;

      if (provider === 'openai') {
        const dataUrl = await this.convertToDataUrl(this.elements.preview.src);
        content = await this.analyzeWithOpenAI(prompt, dataUrl, apiKey, model);
      } else {
        const base64Image = await this.convertToBase64(this.elements.preview.src);
        content = await this.analyzeWithGemini(prompt, base64Image, apiKey, model);
      }

      this.elements.answer.textContent = content;
      this.showStatus('Analysis complete!', 'success');
    } catch (error) {
      console.error('Analysis error:', error);
      this.elements.answer.textContent = `Error: ${error.message}`;
      this.showStatus('Analysis failed', 'error');
    } finally {
      this.state.isProcessing = false;
      this.updateAnalyzeButton(false);
    }
  }

  updateAnalyzeButton(isLoading) {
    const btn = this.elements.analyzeBtn;
    if (isLoading) {
      btn.textContent = 'Processing...';
      btn.classList.add('loading');
    } else {
      btn.textContent = 'Send Request';
      btn.classList.remove('loading');
    }
  }

  // Event Listeners
  attachEventListeners() {
    // Main controls
    this.elements.pasteBtn.addEventListener('click', () =>
      this.tryReadClipboard()
    );
    this.elements.clearBtn.addEventListener('click', () => this.clearImage());
    this.elements.analyzeBtn.addEventListener('click', () =>
      this.analyzeImage()
    );
    this.elements.saveBtn.addEventListener('click', () => this.saveSettings());
    this.elements.clearApiKeyBtn.addEventListener('click', () =>
      this.clearApiKey()
    );

    // Add listener to prompt input for real-time validation
    this.elements.prompt.addEventListener('input', () =>
      this.validatePromptForm()
    );

    // Add listeners to settings inputs for real-time validation
    this.elements.aiProvider.addEventListener('change', () =>
      this.validateSettingsForm()
    );
    this.elements.apiKeySetting.addEventListener('input', () => {
      this.validateSettingsForm();
      this.validatePromptForm();
    });
    this.elements.modelSetting.addEventListener('input', () =>
      this.validateSettingsForm()
    );
    this.elements.geminiApiKeySetting.addEventListener('input', () => {
      this.validateSettingsForm();
      this.validatePromptForm();
    });
    this.elements.geminiModelSetting.addEventListener('input', () =>
      this.validateSettingsForm()
    );
    this.elements.defaultPromptSetting.addEventListener('input', () =>
      this.validateSettingsForm()
    );

    // Drag and drop
    this.setupDragAndDrop();

    // Make the dropzone clickable to open the file browser
    this.elements.dropZone.addEventListener('click', () =>
      this.elements.fileInput.click()
    );

    // Handle the file selection from the browser
    this.elements.fileInput.addEventListener('change', (e) =>
      this.handleFileSelect(e)
    );

    // Keyboard paste
    document.addEventListener('paste', this.handlePaste.bind(this));

    // Enter key handling
    this.elements.prompt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        if (!this.elements.analyzeBtn.disabled) {
          this.analyzeImage();
        }
      }
    });

    // Keyboard navigation for tabs
    this.setupTabKeydownListener();
  }

  handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      this.showImageBlob(file);
      this.showStatus('Image loaded from file browser', 'success');
    } else if (file) {
      this.showStatus('Please select a valid image file (PNG, JPG)', 'error');
    }
    event.target.value = '';
  }

  setupDragAndDrop() {
    const dropZone = this.elements.dropZone;

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        this.showImageBlob(file);
        this.showStatus('Image loaded from file drop', 'success');
      } else {
        this.showStatus('Please drop a valid image file', 'error');
      }
    });
  }

  handlePaste(event) {
    if (!event.clipboardData) return;

    for (const item of event.clipboardData.items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        this.showImageBlob(file);
        event.preventDefault();
        this.showStatus('Image pasted successfully', 'success');
        return;
      }
    }
  }

  // Tab Switching
  switchToTab(targetId) {
    const targetTab = document.querySelector(`.tab[data-target="${targetId}"]`);
    if (targetTab) {
      targetTab.click();
    }
  }

  // Tab Navigation
  setupTabNavigation() {
    const iconStates = {
      'panel-1': {
        inactive: './icons/ask.svg',
        active: './icons/ask_white.svg',
      },
      'panel-2': {
        inactive: './icons/setting.svg',
        active: './icons/settings_white.svg',
      },
    };

    this.elements.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-target');

        // Update tab and panel states
        this.elements.tabs.forEach((t) => {
          const tId = t.getAttribute('data-target');
          const icon = t.querySelector('.tab-icon');
          const isActive = t === tab;

          t.classList.toggle('tab-active', isActive);
          t.classList.toggle('tab-normal', !isActive);
          t.setAttribute('aria-selected', isActive);

          const iconSrc = isActive
            ? iconStates[tId]?.active
            : iconStates[tId]?.inactive;
          if (icon && iconSrc) {
            icon.src = iconSrc;
          }
        });

        this.elements.panels.forEach((panel) => {
          panel.classList.toggle('hidden', panel.id !== targetId);
        });
      });
    });
  }

  // Setup keyboard navigation for tabs (Arrow keys)
  setupTabKeydownListener() {
    const tabContainer = this.elements.tabContainer;
    if (!tabContainer) return;

    tabContainer.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') {
        return;
      }

      const tabs = Array.from(this.elements.tabs);
      const focusedTabIndex = tabs.findIndex(
        (tab) => tab === document.activeElement
      );

      if (focusedTabIndex === -1) {
        return;
      }

      e.preventDefault();

      let nextTabIndex;
      if (e.key === 'ArrowRight') {
        nextTabIndex = (focusedTabIndex + 1) % tabs.length;
      } else {
        // ArrowLeft
        nextTabIndex = (focusedTabIndex - 1 + tabs.length) % tabs.length;
      }

      tabs[nextTabIndex].focus();
      tabs[nextTabIndex].click(); // Activate tab on focus change
    });
  }

  // Status Display Methods
  showStatus(message, type = 'info') {
    const statusEl = this.elements.statusImage;
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;

    if (type === 'success' || type === 'warning') {
      setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = 'status-message';
      }, 3000);
    }
  }

  showSettingsStatus(message, type = 'info') {
    const statusEl = this.elements.statusSetting;
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;

    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'status-message';
    }, 2500);
  }

  showClearApiKeyStatus(message) {
    const statusEl = this.elements.clearApiKeyStatus;
    statusEl.textContent = message;

    setTimeout(() => {
      statusEl.textContent = '';
    }, 2500);
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new GritShotApp();
});