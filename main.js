/**
 * GritShot AI Chrome Extension - Main Popup Script
 * Handles image upload, AI analysis, and storage management
 */

class GritShotApp {
  constructor() {
    this.elements = this.initializeElements();
    this.state = {
      currentImage: null,
      isProcessing: false
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
      
      // Display elements
      preview: document.getElementById('preview'),
      dropZone: document.getElementById('dropZone'),
      status: document.getElementById('status'),
      answer: document.getElementById('answer'),
      
      // Input elements settings
      prompt: document.getElementById('prompt'),
      apiKeySetting: document.getElementById('apiKeySetting'),
      modelSetting: document.getElementById('modelSetting'),
      promptSetting: document.getElementById('promptSetting'),
      
      // Status elements
      statusSetting: document.getElementById('statusSetting'),
      clearApiKeyBtn: document.getElementById('clearApiKeyBtn'),
      clearApiKeyStatus: document.getElementById('clearApiKeyStatus'),
      
      // Tab elements
      tabs: document.querySelectorAll('.tab[data-target]'),
      panels: document.querySelectorAll('.view')
    };
  }

  async init() {
    await this.loadSettings();
    this.attachEventListeners();
    this.setupTabNavigation();
    
    // Auto-attempt clipboard read on startup
    // setTimeout(() => this.tryReadClipboard(), 200);
  }

  // Settings Management
  async loadSettings() {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return; // Stop the function here
    }

    try {
      const settings = await chrome.storage.local.get([
        'openai_api_key',
        'openai_model', 
        'openai_prompt'
      ]);
      
      if (settings.openai_api_key) {
        this.elements.apiKeySetting.value = settings.openai_api_key;
      }
      
      if (settings.openai_model) {
        this.elements.modelSetting.value = settings.openai_model;
      }
      
      if (settings.openai_prompt) {
        this.elements.promptSetting.value = settings.openai_prompt;
        this.elements.prompt.value = settings.openai_prompt;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.showStatus('Error loading settings', 'error');
    }
  }

  async saveSettings() {
    try {
      const settings = {
        openai_api_key: this.elements.apiKeySetting.value.trim(),
        openai_model: this.elements.modelSetting.value,
        openai_prompt: this.elements.promptSetting.value.trim()
      };

      await chrome.storage.local.set(settings);
      this.showSettingsStatus('Settings saved successfully!', 'success');
      
      // Update current prompt if it's empty
      if (!this.elements.prompt.value.trim()) {
        this.elements.prompt.value = settings.openai_prompt;
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showSettingsStatus('Error saving settings', 'error');
    }
  }

  async clearApiKey() {
    const confirmed = confirm(
      'Are you sure you want to delete your API Key from local storage? This action cannot be undone.'
    );
    
    if (confirmed) {
      try {
        await chrome.storage.local.remove('openai_api_key');
        this.elements.apiKeySetting.value = '';
        this.showClearApiKeyStatus('API Key deleted successfully');
      } catch (error) {
        console.error('Error clearing API key:', error);
        this.showClearApiKeyStatus('Error deleting API Key');
      }
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

  async tryReadClipboard() {
    try {
      this.showStatus('Reading clipboard...', 'loading');
      
      const items = await navigator.clipboard.read();
      
      for (const item of items) {
        const imageType = item.types.find(type => type.startsWith('image/'));
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
      this.showStatus('Failed to read clipboard (permission required)', 'error');
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
  }

  // AI Analysis
  async analyzeImage() {
    if (this.state.isProcessing) return;

    const apiKey = this.elements.apiKeySetting.value.trim();
    const model = this.elements.modelSetting.value;
    const prompt = this.elements.prompt.value.trim() || 'Describe this image.';

    // Validation
    if (!apiKey) {
      this.showStatus('Please enter your OpenAI API key in Settings', 'error');
      return;
    }

    if (!this.elements.preview.src) {
      this.showStatus('Please upload an image first', 'error');
      return;
    }

    this.state.isProcessing = true;
    this.updateAnalyzeButton(true);
    this.showStatus('Sending request to OpenAI...', 'loading');
    this.elements.answer.textContent = 'Processing...';

    try {
      const dataUrl = await this.convertToDataUrl(this.elements.preview.src);
      
      const messages = [
        {
          role: 'system',
          content: 'You are a helpful vision assistant. Provide clear, concise, and accurate descriptions. Answer in Indonesian if the user prompt is in Indonesian.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('No response content received from API');
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
      btn.disabled = true;
      btn.textContent = 'Processing...';
      btn.classList.add('loading');
    } else {
      btn.disabled = false;
      btn.textContent = 'Send Request';
      btn.classList.remove('loading');
    }
  }

  // Event Listeners
  attachEventListeners() {
    // Main controls
    this.elements.pasteBtn.addEventListener('click', () => this.tryReadClipboard());
    this.elements.clearBtn.addEventListener('click', () => this.clearImage());
    this.elements.analyzeBtn.addEventListener('click', () => this.analyzeImage());
    this.elements.saveBtn.addEventListener('click', () => this.saveSettings());
    this.elements.clearApiKeyBtn.addEventListener('click', () => this.clearApiKey());

    // Drag and drop
    this.setupDragAndDrop();

    // Keyboard paste
    document.addEventListener('paste', this.handlePaste.bind(this));

    // Enter key handling
    this.elements.prompt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        this.analyzeImage();
      }
    });
  }

  setupDragAndDrop() {
    const dropZone = this.elements.dropZone;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
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

  // Tab Navigation
  setupTabNavigation() {
    const iconStates = {
      'panel-prompt': {
        inactive: './icons/ask.svg',
        active: './icons/ask_white.svg'
      },
      'panel-settings': {
        inactive: './icons/setting.svg', 
        active: './icons/settings_white.svg'
      }
    };

    this.elements.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-target');
        
        // Update tab states
        this.elements.tabs.forEach(t => {
          const tId = t.getAttribute('data-target');
          const icon = t.querySelector('.tab-icon');
          
          if (t === tab) {
            t.classList.add('tab-active');
            t.classList.remove('tab-normal');
            if (iconStates[tId]?.active) {
              icon.src = iconStates[tId].active;
            }
          } else {
            t.classList.remove('tab-active');
            t.classList.add('tab-normal');
            if (iconStates[tId]?.inactive) {
              icon.src = iconStates[tId].inactive;
            }
          }
        });

        // Update panel visibility
        this.elements.panels.forEach(panel => {
          if (panel.id === targetId) {
            panel.classList.remove('hidden');
          } else {
            panel.classList.add('hidden');
          }
        });
      });
    });
  }

  // Status Display Methods
  showStatus(message, type = 'info') {
    const statusEl = this.elements.status;
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