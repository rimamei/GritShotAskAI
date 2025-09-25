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

      // Input elements settings
      apiKeySetting: document.getElementById('apiKeySetting'),
      modelSetting: document.getElementById('modelSetting'),
      defaultPromptSetting: document.getElementById('promptSetting'),

      // Status elements
      statusSetting: document.getElementById('statusSetting'),
      clearApiKeyBtn: document.getElementById('clearApiKeyBtn'),
      clearApiKeyStatus: document.getElementById('clearApiKeyStatus'),

      // Tab elements
      tabs: document.querySelectorAll('.tab[data-target]'),
      panels: document.querySelectorAll('.view'),
    };
  }

  async init() {
    await this.loadSettings();
    this.attachEventListeners();
    this.setupTabNavigation();
    this.validatePromptForm(); // Set initial button state
    this.validateSettingsForm(); // For the settings form

    if (!this.elements.apiKeySetting.value.trim()) {
      this.switchToTab('panel-2');
      this.showSettingsStatus(
        'Please enter your OpenAI API key to begin.',
        'warning'
      );
    }
  }

  // Form Validation for Ask AI
  validatePromptForm() {
    const hasImage = !!this.state.currentImage;
    const hasPrompt = this.elements.prompt.value.trim() !== '';
    const isFormValid = hasImage && hasPrompt;

    // Enable or disable the button based on validation
    this.elements.analyzeBtn.disabled = !isFormValid;
  }

  // Form Validation for Settings
  validateSettingsForm() {
    const hasDefaultPrompt =
      this.elements.defaultPromptSetting.value.trim() !== '';
    const hasApiKey = this.elements.apiKeySetting.value.trim() !== '';
    const hasModel = this.elements.modelSetting.value.trim() !== '';

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
        'openai_api_key',
        'openai_model',
        'openai_prompt',
      ]);

      // Show or hide the 'Clear API Key' button based on whether a key is stored.
      if (settings.openai_api_key) {
        this.elements.apiKeySetting.value = settings.openai_api_key;
        this.elements.clearApiKeyBtn.classList.remove('hidden'); // Show the button
      } else {
        this.elements.clearApiKeyBtn.classList.add('hidden'); // Keep it hidden
      }

      if (settings.openai_api_key) {
        this.elements.apiKeySetting.value = settings.openai_api_key;
      }

      if (settings.openai_model) {
        this.elements.modelSetting.value = settings.openai_model;
      }

      if (settings.openai_prompt) {
        this.elements.promptSetting.value = settings.openai_prompt;
        this.elements.prompt.value = settings.openai_prompt;
        this.validatePromptForm(); // Re-validate in case a default prompt is loaded
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.showStatus('Error loading settings', 'error');
    }
  }

  async saveSettings() {
    const apiKeyInput = this.elements.apiKeySetting;
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey.startsWith('sk-') || apiKey.length < 50) {
      this.showSettingsStatus(
        "Invalid API Key. It must start with 'sk-' and be complete.",
        'error'
      );
      apiKeyInput.classList.add('input-error');
      return;
    }

    try {
      const settings = {
        openai_api_key: apiKey,
        openai_model: this.elements.modelSetting.value,
        openai_prompt: this.elements.promptSetting.value.trim(),
      };

      await chrome.storage.local.set(settings);
      apiKeyInput.classList.remove('input-error'); // Remove error style on success
      this.showSettingsStatus('Settings saved successfully!', 'success');

      this.elements.clearApiKeyBtn.classList.remove('hidden'); // Show button after saving

      // Update current prompt if it's empty
      if (!this.elements.prompt.value.trim()) {
        this.elements.prompt.value = settings.openai_prompt;
      }
      this.validatePromptForm(); // Re-validate after settings change
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showSettingsStatus('Error saving settings', 'error');
    }
  }

  async clearApiKey() {
    // NOTE: Switched from confirm() to a non-blocking UI for better extension experience.
    // In a real app, you would build a custom modal here.
    try {
      await chrome.storage.local.remove('openai_api_key');
      this.elements.apiKeySetting.value = '';
      this.showClearApiKeyStatus('API Key deleted successfully');
      this.elements.clearApiKeyBtn.classList.add('hidden'); // Hide button after clearing
    } catch (error) {
      console.error('Error clearing API key:', error);
      this.showClearApiKeyStatus('Error deleting API Key');
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

    this.validatePromptForm(); // Validate after adding image
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

    this.validatePromptForm(); // Validate after clearing image
  }

  // AI Analysis
  async analyzeImage() {
    if (this.state.isProcessing) return;

    // The button being enabled serves as the primary validation, but these are good safeguards.
    const apiKey = this.elements.apiKeySetting.value.trim();
    if (!apiKey) {
      this.showStatus('Please enter your OpenAI API key in Settings', 'error');
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
    this.showStatus('Sending request to OpenAI...', 'loading');
    this.elements.answer.textContent = 'Processing...';

    try {
      const dataUrl = await this.convertToDataUrl(this.elements.preview.src);
      const model = this.elements.modelSetting.value;

      const messages = [
        {
          role: 'system',
          content:
            'You are a helpful vision assistant. Provide clear, concise, and accurate descriptions. Answer in Indonesian if the user prompt is in Indonesian.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ];

      const apiUrl = {
        openapi: 'https://api.openai.com/v1/chat/completions',
      };

      const response = await fetch(apiUrl.openapi, {
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
      btn.textContent = 'Processing...';
      btn.classList.add('loading');
    } else {
      btn.textContent = 'Send Request';
      btn.classList.remove('loading');
    }
    // The disabled state is now handled by validatePromptForm()
    // We only manage text and loading class here.
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
    this.elements.apiKeySetting.addEventListener('input', () =>
      this.validateSettingsForm()
    );
    this.elements.modelSetting.addEventListener('input', () =>
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
        // Check if button is not disabled before submitting
        if (!this.elements.analyzeBtn.disabled) {
          this.analyzeImage();
        }
      }
    });
  }

  handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      this.showImageBlob(file);
      this.showStatus('Image loaded from file browser', 'success');
    } else if (file) {
      this.showStatus('Please select a valid image file (PNG, JPG)', 'error');
    }
    // Reset the input value. This allows selecting the same file again if needed.
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

        // Update tab states
        this.elements.tabs.forEach((t) => {
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
        this.elements.panels.forEach((panel) => {
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
    // Use the corrected element property 'statusImage'
    const statusEl = this.elements.statusImage;
    if (!statusEl) return; // Add a safeguard

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
