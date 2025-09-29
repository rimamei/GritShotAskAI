const fs = require('fs');
const path = require('path');
const GritShotApp = require('./main');

// Load the HTML file's content
const html = fs.readFileSync(path.resolve(__dirname, './index.html'), 'utf8');

// Mock chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    },
  },
};

// Mock fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({ choices: [{ message: { content: 'Test response' } }] }),
    text: () => Promise.resolve('Error'),
    blob: () => Promise.resolve(new window.Blob([''], { type: 'image/png' })),
  })
);

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(
  () => 'blob:http://localhost/fake-blob-id'
);
global.URL.revokeObjectURL = jest.fn();

describe('GritShotApp', () => {
  let app;

  beforeEach(() => {
    // Set the document's body to the content from index.html
    // This ensures the DOM is populated before the app script initializes
    const bodyContent = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    document.body.innerHTML = bodyContent ? bodyContent[1] : '';

    // Add clipboard mock to the navigator object
    Object.defineProperty(global.navigator, 'clipboard', {
      value: {
        read: jest.fn().mockResolvedValue([]),
      },
      writable: true,
    });

    // Reset mocks before each test
    jest.clearAllMocks();

    // Create a new instance of the app
    app = new GritShotApp();
  });

  describe('Initialization', () => {
    it('should initialize elements correctly', () => {
      // Check if some key elements exist
      expect(app.elements.pasteBtn).not.toBeNull();
      expect(app.elements.analyzeBtn).not.toBeNull();
      expect(app.elements.saveBtn).not.toBeNull();
      expect(app.elements.prompt).not.toBeNull();
      expect(app.elements.aiProvider).not.toBeNull();
    });

    it('should call loadSettings on init', () => {
      // Since loadSettings is async, we check the call to chrome.storage.local.get
      expect(chrome.storage.local.get).toHaveBeenCalled();
    });

    it('should disable analyze and save buttons initially', () => {
      expect(app.elements.analyzeBtn.disabled).toBe(true);
      expect(app.elements.saveBtn.disabled).toBe(true);
    });
  });

  describe('Tab Keyboard Navigation', () => {
    let promptTab, settingsTab, tabContainer;

    beforeEach(() => {
      // Get references to the tab elements for easier access in tests
      promptTab = document.getElementById('promptTab');
      settingsTab = document.getElementById('settingsTab');
      tabContainer = app.elements.tabContainer;

      // Spy on the methods we want to track
      jest.spyOn(promptTab, 'focus');
      jest.spyOn(promptTab, 'click');
      jest.spyOn(settingsTab, 'focus');
      jest.spyOn(settingsTab, 'click');
    });

    it("should move focus to the next tab when 'ArrowRight' is pressed", () => {
      // Arrange: Focus the first tab
      promptTab.focus();
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
      });

      // Act: Dispatch the event on the container
      tabContainer.dispatchEvent(event);

      // Assert: Expect the second tab to be focused and clicked
      expect(settingsTab.focus).toHaveBeenCalled();
      expect(settingsTab.click).toHaveBeenCalled();
    });

    it("should wrap focus to the first tab when 'ArrowRight' is pressed on the last tab", () => {
      // Arrange: Focus the last tab
      settingsTab.focus();
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
      });

      // Act
      tabContainer.dispatchEvent(event);

      // Assert: Expect the first tab to be focused and clicked
      expect(promptTab.focus).toHaveBeenCalled();
      expect(promptTab.click).toHaveBeenCalled();
    });

    it("should move focus to the previous tab when 'ArrowLeft' is pressed", () => {
      // Arrange: Focus the second tab
      settingsTab.focus();
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
      });

      // Act
      tabContainer.dispatchEvent(event);

      // Assert: Expect the first tab to be focused and clicked
      expect(promptTab.focus).toHaveBeenCalled();
      expect(promptTab.click).toHaveBeenCalled();
    });

    it("should wrap focus to the last tab when 'ArrowLeft' is pressed on the first tab", () => {
      // Arrange: Focus the first tab
      promptTab.focus();
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
      });

      // Act
      tabContainer.dispatchEvent(event);

      // Assert: Expect the last tab to be focused and clicked
      expect(settingsTab.focus).toHaveBeenCalled();
      expect(settingsTab.click).toHaveBeenCalled();
    });
  });

  describe('Image Handling', () => {
    it('should show image blob and update UI', () => {
      const blob = new window.Blob([''], { type: 'image/png' });
      app.showImageBlob(blob);

      expect(app.state.currentImage).not.toBeNull();
      expect(app.elements.preview.style.display).toBe('block');
      expect(app.elements.dropZone.classList.contains('hidden')).toBe(true);
      expect(app.elements.pasteBtn.classList.contains('hidden')).toBe(true);
      expect(app.elements.clearBtn.classList.contains('hidden')).toBe(false);
    });

    it('should clear image and reset UI', () => {
      const blob = new window.Blob([''], { type: 'image/png' });
      app.showImageBlob(blob); // First, show an image
      app.clearImage(); // Then, clear it

      expect(app.state.currentImage).toBeNull();
      expect(app.elements.preview.style.display).toBe('none');
      expect(app.elements.dropZone.classList.contains('hidden')).toBe(false);
      expect(app.elements.pasteBtn.classList.contains('hidden')).toBe(false);
      expect(app.elements.clearBtn.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Form Validation', () => {
    it('should enable analyze button when all conditions are met', () => {
      // Simulate valid conditions
      app.state.currentImage = 'fake-image-url';
      app.elements.prompt.value = 'Test prompt';
      app.elements.apiKeySetting.value =
        'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      app.validatePromptForm();

      expect(app.elements.analyzeBtn.disabled).toBe(false);
    });

    it('should disable analyze button if image is missing', () => {
      app.state.currentImage = null;
      app.elements.prompt.value = 'Test prompt';
      app.elements.apiKeySetting.value =
        'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      app.validatePromptForm();

      expect(app.elements.analyzeBtn.disabled).toBe(true);
    });
  });

  describe('Settings Management', () => {
    it('should save settings to chrome storage', async () => {
      app.elements.aiProvider.value = 'openai';
      app.elements.apiKeySetting.value =
        'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      app.elements.modelSetting.value = 'gpt-4o-mini';
      app.elements.defaultPromptSetting.value = 'Default prompt';

      await app.saveSettings();

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        ai_provider: 'openai',
        openai_api_key: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        openai_model: 'gpt-4o-mini',
        default_prompt: 'Default prompt',
      });
    });

    it('should load gemini settings from chrome storage', async () => {
      const settings = {
        ai_provider: 'gemini',
        gemini_api_key: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        gemini_model: 'gemini-1.5-flash-latest',
        default_prompt: 'Loaded prompt',
      };
      chrome.storage.local.get.mockResolvedValue(settings);

      await app.loadSettings();

      expect(app.elements.aiProvider.value).toBe('gemini');
      expect(app.elements.geminiApiKeySetting.value).toBe(
        settings.gemini_api_key
      );
      expect(app.elements.geminiModelSetting.value).toBe(settings.gemini_model);
      expect(app.elements.defaultPromptSetting.value).toBe(
        settings.default_prompt
      );
    });

    it('should load openai settings from chrome storage', async () => {
      const settings = {
        ai_provider: 'openai',
        openai_api_key: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        openai_model: 'gpt-4o-mini',
        default_prompt: 'Loaded prompt',
      };
      chrome.storage.local.get.mockResolvedValue(settings);

      await app.loadSettings();

      expect(app.elements.aiProvider.value).toBe('openai');
      expect(app.elements.apiKeySetting.value).toBe(settings.openai_api_key);
      expect(app.elements.modelSetting.value).toBe(settings.openai_model);
      expect(app.elements.defaultPromptSetting.value).toBe(
        settings.default_prompt
      );
    });
  });

  describe('API Analysis', () => {
    beforeEach(() => {
      // Setup for analysis tests
      app.state.currentImage = 'fake-image-url';
      app.elements.preview.src = 'http://localhost/fake.png';
      app.elements.prompt.value = 'What is in this image?';

      // Mock the conversion methods to prevent actual fetch/conversion during the test
      jest
        .spyOn(app, 'convertToDataUrl')
        .mockResolvedValue('data:image/png;base64,fake-data-url');
      jest
        .spyOn(app, 'convertToBase64')
        .mockResolvedValue('fake-base64-string');
    });

    it('should call OpenAI API when provider is set to openai', async () => {
      app.elements.aiProvider.value = 'openai';
      app.elements.apiKeySetting.value =
        'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      await app.analyzeImage();

      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.any(Object)
      );
      expect(app.elements.answer.textContent).toBe('Test response');
    });

    it('should call Gemini API when provider is set to gemini', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: 'Gemini response' }] } }],
          }),
      });

      app.elements.aiProvider.value = 'gemini';
      app.elements.geminiApiKeySetting.value =
        'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      await app.analyzeImage();

      const model = app.elements.geminiModelSetting.value;
      const apiKey = app.elements.geminiApiKeySetting.value;
      const expectedUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      expect(fetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
      expect(app.elements.answer.textContent).toBe('Gemini response');
    });

    it('should handle API fetch error gracefully', async () => {
      // Suppress console.error for this test because we expect an error to be logged
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const errorMessage = 'API request failed';
      global.fetch.mockRejectedValueOnce(new Error(errorMessage));

      app.elements.aiProvider.value = 'openai';
      app.elements.apiKeySetting.value =
        'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

      await app.analyzeImage();

      expect(app.elements.answer.textContent).toContain('Error:');
      expect(app.elements.answer.textContent).toContain(errorMessage);
      expect(app.state.isProcessing).toBe(false);

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Clear API Key', () => {
    it('should clear API keys from storage and update UI on success', async () => {
      // Arrange: Set initial values to ensure they are cleared
      app.elements.apiKeySetting.value = 'sk-testkey';
      app.elements.geminiApiKeySetting.value = 'AIza-testkey';
      app.elements.clearApiKeyBtn.classList.remove('hidden');
      app.elements.notesPanel1.classList.add('hidden');

      // Spy on methods to verify they are called without executing them
      const showStatusSpy = jest.spyOn(app, 'showClearApiKeyStatus');
      const validateSettingsSpy = jest.spyOn(app, 'validateSettingsForm');
      const validatePromptSpy = jest.spyOn(app, 'validatePromptForm');

      // Act: Call the function to be tested
      await app.clearApiKey();

      // Assert
      // 1. Check if chrome.storage.local.remove was called with the correct keys
      expect(chrome.storage.local.remove).toHaveBeenCalledWith([
        'openai_api_key',
        'gemini_api_key',
      ]);

      // 2. Verify input fields are cleared
      expect(app.elements.apiKeySetting.value).toBe('');
      expect(app.elements.geminiApiKeySetting.value).toBe('');

      // 3. Confirm the correct success message was shown
      expect(showStatusSpy).toHaveBeenCalledWith(
        'All API Keys deleted successfully'
      );

      // 4. Check if UI elements were updated correctly
      expect(app.elements.clearApiKeyBtn.classList.contains('hidden')).toBe(
        true
      );
      expect(app.elements.notesPanel1.classList.contains('hidden')).toBe(false);

      // 5. Ensure validation functions were triggered
      expect(validateSettingsSpy).toHaveBeenCalled();
      expect(validatePromptSpy).toHaveBeenCalled();
    });

    it('should handle errors gracefully when clearing API keys fails', async () => {
      // Arrange: Mock the storage.remove method to simulate a failure
      const testError = new Error('Failed to access storage');
      chrome.storage.local.remove.mockRejectedValueOnce(testError);

      // Spy on console.error to check if it's called and to suppress the error in the test output
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const showStatusSpy = jest.spyOn(app, 'showClearApiKeyStatus');

      // Act: Call the function
      await app.clearApiKey();

      // Assert
      // 1. Verify that the error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error clearing API keys:',
        testError
      );

      // 2. Check if the user was shown an error message
      expect(showStatusSpy).toHaveBeenCalledWith('Error deleting API Keys');

      // Restore the original console.error function
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Drag and Drop Handling', () => {
    // Helper function to create a mock drag event with a mockable preventDefault
    // and a dataTransfer property.
    function createMockDragEvent(type, files = []) {
      const event = new Event(type, { bubbles: true });
      event.preventDefault = jest.fn();
      Object.defineProperty(event, 'dataTransfer', {
        value: {
          files,
        },
      });
      return event;
    }

    it("should add 'drag' class on dragenter", () => {
      const dropZone = app.elements.dropZone;
      const event = createMockDragEvent('dragenter');

      dropZone.dispatchEvent(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(dropZone.classList.contains('drag')).toBe(true);
    });

    it("should remove 'drag' class on dragleave", () => {
      const dropZone = app.elements.dropZone;
      dropZone.classList.add('drag'); // Simulate entering first

      const event = createMockDragEvent('dragleave');
      dropZone.dispatchEvent(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(dropZone.classList.contains('drag')).toBe(false);
    });

    it('should call showImageBlob for a valid image file on drop', () => {
      // Arrange: Spy on the methods that should be called
      const showImageBlobSpy = jest.spyOn(app, 'showImageBlob');
      const showStatusSpy = jest.spyOn(app, 'showStatus');

      const dropZone = app.elements.dropZone;
      const mockImageFile = new File(['mock-image-content'], 'test.png', {
        type: 'image/png',
      });
      const event = createMockDragEvent('drop', [mockImageFile]);

      // Act: Dispatch the event
      dropZone.dispatchEvent(event);

      // Assert: Check if the correct methods were called with the correct arguments
      expect(showImageBlobSpy).toHaveBeenCalledWith(mockImageFile);
      expect(showStatusSpy).toHaveBeenCalledWith(
        'Image loaded from file drop',
        'success'
      );
      expect(dropZone.classList.contains('drag')).toBe(false);
    });

    it('should show an error for an invalid file type on drop', () => {
      // Arrange
      const showImageBlobSpy = jest.spyOn(app, 'showImageBlob');
      const showStatusSpy = jest.spyOn(app, 'showStatus');

      const dropZone = app.elements.dropZone;
      const mockTextFile = new File(['mock-text-content'], 'test.txt', {
        type: 'text/plain',
      });
      const event = createMockDragEvent('drop', [mockTextFile]);

      // Act
      dropZone.dispatchEvent(event);

      // Assert
      expect(showImageBlobSpy).not.toHaveBeenCalled();
      expect(showStatusSpy).toHaveBeenCalledWith(
        'Please drop a valid image file',
        'error'
      );
    });

    it('should show an error if no file is dropped', () => {
      // Arrange
      const showImageBlobSpy = jest.spyOn(app, 'showImageBlob');
      const showStatusSpy = jest.spyOn(app, 'showStatus');

      const dropZone = app.elements.dropZone;
      const event = createMockDragEvent('drop', []); // No files in the array

      // Act
      dropZone.dispatchEvent(event);

      // Assert
      expect(showImageBlobSpy).not.toHaveBeenCalled();
      expect(showStatusSpy).toHaveBeenCalledWith(
        'Please drop a valid image file',
        'error'
      );
    });
  });

  describe('UI Interaction and State Changes', () => {
    it('should show OpenAI settings and hide Gemini settings when provider is changed to OpenAI', () => {
      // Arrange: Spy on the validation method and set an initial state
      const validateSpy = jest.spyOn(app, 'validateSettingsForm');
      const aiProviderSelect = app.elements.aiProvider;
      const openaiSettings = app.elements.openaiSettings;
      const geminiSettings = app.elements.geminiSettings;

      // Start with Gemini settings visible
      openaiSettings.classList.add('hidden');
      geminiSettings.classList.remove('hidden');

      // Act: Simulate the user selecting 'openai'
      aiProviderSelect.value = 'openai';
      aiProviderSelect.dispatchEvent(new Event('change'));

      // Assert: Check the visibility of the settings panels and if validation was called
      expect(openaiSettings.classList.contains('hidden')).toBe(false);
      expect(geminiSettings.classList.contains('hidden')).toBe(true);
      expect(validateSpy).toHaveBeenCalled();
    });

    it('should show Gemini settings and hide OpenAI settings when provider is changed to Gemini', () => {
      // Arrange
      const validateSpy = jest.spyOn(app, 'validateSettingsForm');
      const aiProviderSelect = app.elements.aiProvider;
      const openaiSettings = app.elements.openaiSettings;
      const geminiSettings = app.elements.geminiSettings;

      // Start with OpenAI settings visible (the default state)
      openaiSettings.classList.remove('hidden');
      geminiSettings.classList.add('hidden');

      // Act: Simulate the user selecting 'gemini'
      aiProviderSelect.value = 'gemini';
      aiProviderSelect.dispatchEvent(new Event('change'));

      // Assert
      expect(openaiSettings.classList.contains('hidden')).toBe(true);
      expect(geminiSettings.classList.contains('hidden')).toBe(false);
      expect(validateSpy).toHaveBeenCalled();
    });
  });

  describe('UI Interaction and State Changes', () => {
    it('should show OpenAI settings and hide Gemini settings when provider is changed to OpenAI', () => {
      // Arrange: Spy on the validation method and set an initial state
      const validateSpy = jest.spyOn(app, 'validateSettingsForm');
      const aiProviderSelect = app.elements.aiProvider;
      const openaiSettings = app.elements.openaiSettings;
      const geminiSettings = app.elements.geminiSettings;

      // Start with Gemini settings visible
      openaiSettings.classList.add('hidden');
      geminiSettings.classList.remove('hidden');

      // Act: Simulate the user selecting 'openai'
      aiProviderSelect.value = 'openai';
      aiProviderSelect.dispatchEvent(new Event('change'));

      // Assert: Check the visibility of the settings panels and if validation was called
      expect(openaiSettings.classList.contains('hidden')).toBe(false);
      expect(geminiSettings.classList.contains('hidden')).toBe(true);
      expect(validateSpy).toHaveBeenCalled();
    });

    it('should show Gemini settings and hide OpenAI settings when provider is changed to Gemini', () => {
      // Arrange
      const validateSpy = jest.spyOn(app, 'validateSettingsForm');
      const aiProviderSelect = app.elements.aiProvider;
      const openaiSettings = app.elements.openaiSettings;
      const geminiSettings = app.elements.geminiSettings;

      // Start with OpenAI settings visible (the default state)
      openaiSettings.classList.remove('hidden');
      geminiSettings.classList.add('hidden');

      // Act: Simulate the user selecting 'gemini'
      aiProviderSelect.value = 'gemini';
      aiProviderSelect.dispatchEvent(new Event('change'));

      // Assert
      expect(openaiSettings.classList.contains('hidden')).toBe(true);
      expect(geminiSettings.classList.contains('hidden')).toBe(false);
      expect(validateSpy).toHaveBeenCalled();
    });
  });

  describe('Settings Saving', () => {
    const VALID_OPENAI_KEY =
      'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    const VALID_GEMINI_KEY = 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    let showStatusSpy;
    let validatePromptSpy;

    beforeEach(() => {
      // Spy on helper methods before each test in this block
      showStatusSpy = jest.spyOn(app, 'showSettingsStatus');
      validatePromptSpy = jest.spyOn(app, 'validatePromptForm');
    });

    it('should successfully save valid OpenAI settings', async () => {
      // Arrange
      app.elements.aiProvider.value = 'openai';
      app.elements.apiKeySetting.value = VALID_OPENAI_KEY;
      app.elements.modelSetting.value = 'gpt-4o-mini';
      app.elements.defaultPromptSetting.value = 'Default prompt';
      app.elements.prompt.value = ''; // Ensure main prompt is empty

      // Act
      await app.saveSettings();

      // Assert
      const expectedSettings = {
        ai_provider: 'openai',
        openai_api_key: VALID_OPENAI_KEY,
        openai_model: 'gpt-4o-mini',
        default_prompt: 'Default prompt',
      };
      expect(chrome.storage.local.set).toHaveBeenCalledWith(expectedSettings);
      expect(showStatusSpy).toHaveBeenCalledWith(
        'Settings saved successfully!',
        'success'
      );
      expect(app.elements.prompt.value).toBe('Default prompt'); // Check if prompt was updated
      expect(validatePromptSpy).toHaveBeenCalled();
      expect(app.elements.clearApiKeyBtn.classList.contains('hidden')).toBe(
        false
      );
      expect(app.elements.notesPanel1.classList.contains('hidden')).toBe(true);
    });

    it('should successfully save valid Gemini settings', async () => {
      // Arrange
      app.elements.aiProvider.value = 'gemini';
      app.elements.geminiApiKeySetting.value = VALID_GEMINI_KEY;
      app.elements.geminiModelSetting.value = 'gemini-1.5-flash-latest';
      app.elements.defaultPromptSetting.value = 'Gemini prompt';

      // Act
      await app.saveSettings();

      // Assert
      const expectedSettings = {
        ai_provider: 'gemini',
        gemini_api_key: VALID_GEMINI_KEY,
        gemini_model: 'gemini-1.5-flash-latest',
        default_prompt: 'Gemini prompt',
      };
      expect(chrome.storage.local.set).toHaveBeenCalledWith(expectedSettings);
      expect(showStatusSpy).toHaveBeenCalledWith(
        'Settings saved successfully!',
        'success'
      );
      expect(validatePromptSpy).toHaveBeenCalled();
    });

    it('should show an error for an invalid OpenAI API key and not save', async () => {
      // Arrange
      app.elements.aiProvider.value = 'openai';
      app.elements.apiKeySetting.value = 'invalid-key'; // Invalid prefix and length

      // Act
      await app.saveSettings();

      // Assert
      expect(showStatusSpy).toHaveBeenCalledWith(
        "Invalid OpenAI API Key. It must start with 'sk-' and be complete.",
        'error'
      );
      expect(app.elements.apiKeySetting.classList.contains('input-error')).toBe(
        true
      );
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('should show an error for an invalid Gemini API key and not save', async () => {
      // Arrange
      app.elements.aiProvider.value = 'gemini';
      app.elements.geminiApiKeySetting.value = 'invalid-key'; // Invalid prefix and length

      // Act
      await app.saveSettings();

      // Assert
      expect(showStatusSpy).toHaveBeenCalledWith(
        "Invalid Gemini API Key. It must start with 'AIza' and be complete.",
        'error'
      );
      expect(
        app.elements.geminiApiKeySetting.classList.contains('input-error')
      ).toBe(true);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('should handle errors from chrome.storage.local.set', async () => {
      // Arrange
      const storageError = new Error('Storage quota exceeded');
      chrome.storage.local.set.mockRejectedValueOnce(storageError);
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      app.elements.aiProvider.value = 'openai';
      app.elements.apiKeySetting.value = VALID_OPENAI_KEY;
      app.elements.defaultPromptSetting.value = 'Test prompt';

      // Act
      await app.saveSettings();

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error saving settings:',
        storageError
      );
      expect(showStatusSpy).toHaveBeenCalledWith(
        'Error saving settings',
        'error'
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Utility and Conversion Methods', () => {
    it('should convert a blob object URL to a data URL successfully', async () => {
      // Arrange
      const fakeBlob = new Blob(['mock-image-content'], { type: 'image/png' });
      const fakeObjectUrl = 'blob:http://localhost/fake-blob-id';
      // This is the Base64 representation of 'mock-image-content'
      const expectedDataUrl = 'data:image/png;base64,bW9jay1pbWFnZS1jb250ZW50';

      // Mock the fetch call to resolve with our fake blob
      global.fetch.mockResolvedValueOnce({
        blob: () => Promise.resolve(fakeBlob),
      });

      // Mock the FileReader
      const mockReaderInstance = {
        onloadend: null,
        onerror: null,
        result: expectedDataUrl,
        readAsDataURL: function (blob) {
          // Immediately call onloadend to simulate a successful read
          this.onloadend();
        },
      };
      global.FileReader = jest.fn(() => mockReaderInstance);

      // Act
      const result = await app.convertToDataUrl(fakeObjectUrl);

      // Assert
      expect(fetch).toHaveBeenCalledWith(fakeObjectUrl);
      expect(result).toBe(expectedDataUrl);
    });

    it('should throw a specific error if fetching the object URL fails', async () => {
      // Arrange
      const fakeObjectUrl = 'blob:http://localhost/another-id';
      // Mock fetch to reject, simulating a network or permission error
      global.fetch.mockRejectedValueOnce(new Error('Network failure'));

      // Act & Assert
      // We expect the promise to reject and throw our custom error message
      await expect(app.convertToDataUrl(fakeObjectUrl)).rejects.toThrow(
        'Failed to convert image to data URL'
      );
    });

    it('should throw a specific error if the FileReader encounters an error', async () => {
      // Arrange
      const fakeBlob = new Blob(['mock-content'], { type: 'image/png' });
      const fakeObjectUrl = 'blob:http://localhost/error-id';

      global.fetch.mockResolvedValueOnce({
        blob: () => Promise.resolve(fakeBlob),
      });

      // Mock the FileReader to simulate a read error
      const mockReaderInstance = {
        onloadend: null,
        onerror: null,
        readAsDataURL: function (blob) {
          // Immediately call onerror to simulate a failure
          this.onerror(new Error('File could not be read'));
        },
      };
      global.FileReader = jest.fn(() => mockReaderInstance);

      // Act & Assert
      await expect(app.convertToDataUrl(fakeObjectUrl)).rejects.toThrow(
        'Failed to convert image to data URL'
      );
    });
  });

  describe('Convert to Base64', () => {
    it('should convert a blob object URL to a pure base64 string', async () => {
      // Arrange
      const fakeBlob = new Blob(['Hello World'], { type: 'text/plain' });
      const fakeObjectUrl = 'blob:http://localhost/fake-base64-id';
      const fakeDataUrl = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';
      const expectedBase64 = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64

      global.fetch.mockResolvedValueOnce({
        blob: () => Promise.resolve(fakeBlob),
      });

      const mockReaderInstance = {
        onloadend: null,
        onerror: null,
        result: fakeDataUrl,
        readAsDataURL: function (blob) {
          this.onloadend();
        },
      };
      global.FileReader = jest.fn(() => mockReaderInstance);

      // Act
      const result = await app.convertToBase64(fakeObjectUrl);

      // Assert
      expect(fetch).toHaveBeenCalledWith(fakeObjectUrl);
      expect(result).toBe(expectedBase64);
    });

    it('should throw a specific error if fetching the object URL fails', async () => {
      // Arrange
      const fakeObjectUrl = 'blob:http://localhost/fetch-fail-id';
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(app.convertToBase64(fakeObjectUrl)).rejects.toThrow(
        'Failed to convert image to base64'
      );
    });

    it('should throw a specific error if the FileReader fails', async () => {
      // Arrange
      const fakeBlob = new Blob(['test'], { type: 'text/plain' });
      const fakeObjectUrl = 'blob:http://localhost/reader-fail-id';

      global.fetch.mockResolvedValueOnce({
        blob: () => Promise.resolve(fakeBlob),
      });

      const mockReaderInstance = {
        onloadend: null,
        onerror: null,
        readAsDataURL: function (blob) {
          this.onerror(new Error('Read failed'));
        },
      };
      global.FileReader = jest.fn(() => mockReaderInstance);

      // Act & Assert
      await expect(app.convertToBase64(fakeObjectUrl)).rejects.toThrow(
        'Failed to convert image to base64'
      );
    });
  });

  describe('Clipboard Handling', () => {
    let showImageBlobSpy;
    let showStatusSpy;

    beforeEach(() => {
      // Spy on the methods that will be called by tryReadClipboard
      showImageBlobSpy = jest.spyOn(app, 'showImageBlob');
      showStatusSpy = jest.spyOn(app, 'showStatus');
    });

    it('should load an image from the clipboard successfully', async () => {
      // Arrange
      const mockBlob = new Blob(['mock-image-data'], { type: 'image/png' });
      const mockClipboardItem = {
        types: ['image/png'],
        getType: jest.fn().mockResolvedValue(mockBlob),
      };
      // Mock the clipboard API to return our item
      navigator.clipboard.read.mockResolvedValue([mockClipboardItem]);

      // Act
      await app.tryReadClipboard();

      // Assert
      expect(showStatusSpy).toHaveBeenCalledWith(
        'Reading clipboard...',
        'loading'
      );
      expect(navigator.clipboard.read).toHaveBeenCalled();
      expect(mockClipboardItem.getType).toHaveBeenCalledWith('image/png');
      expect(showImageBlobSpy).toHaveBeenCalledWith(mockBlob);
      expect(showStatusSpy).toHaveBeenCalledWith(
        'Image loaded from clipboard',
        'success'
      );
    });

    it('should show a warning if no image is found in the clipboard', async () => {
      // Arrange
      const mockClipboardItem = {
        types: ['text/plain'], // Item is not an image
        getType: jest.fn(),
      };
      navigator.clipboard.read.mockResolvedValue([mockClipboardItem]);

      // Act
      await app.tryReadClipboard();

      // Assert
      expect(showStatusSpy).toHaveBeenCalledWith(
        'Reading clipboard...',
        'loading'
      );
      expect(navigator.clipboard.read).toHaveBeenCalled();
      // Ensure that since it's not an image, getType and showImageBlob are not called
      expect(mockClipboardItem.getType).not.toHaveBeenCalled();
      expect(showImageBlobSpy).not.toHaveBeenCalled();
      expect(showStatusSpy).toHaveBeenCalledWith(
        'No image found in clipboard',
        'warning'
      );
    });

    it('should handle clipboard read errors gracefully', async () => {
      // Arrange
      const permissionError = new Error('Read permission denied');
      navigator.clipboard.read.mockRejectedValue(permissionError);
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      await app.tryReadClipboard();

      // Assert
      expect(showStatusSpy).toHaveBeenCalledWith(
        'Reading clipboard...',
        'loading'
      );
      expect(navigator.clipboard.read).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Clipboard error:',
        permissionError
      );
      expect(showStatusSpy).toHaveBeenCalledWith(
        'Failed to read clipboard (permission required)',
        'error'
      );

      // Clean up the console spy
      consoleErrorSpy.mockRestore();
    });
  });

  // In main.test.js

  // ... (inside the 'Clipboard Handling' describe block)

  describe('handlePaste', () => {
    let showImageBlobSpy;
    let showStatusSpy;

    beforeEach(() => {
      // Set up spies before each test in this block
      showImageBlobSpy = jest.spyOn(app, 'showImageBlob');
      showStatusSpy = jest.spyOn(app, 'showStatus');
    });

    // Helper to create a mock paste event
    const createMockPasteEvent = (items) => {
      const event = new Event('paste');
      event.preventDefault = jest.fn();
      Object.defineProperty(event, 'clipboardData', {
        value: { items },
        writable: true,
      });
      return event;
    };

    it('should process an image item from the clipboard', () => {
      // Arrange
      const mockFile = new File(['mock-image'], 'pasted.png', {
        type: 'image/png',
      });
      const mockClipboardItems = [
        { type: 'image/png', getAsFile: () => mockFile },
        { type: 'text/plain', getAsFile: () => null },
      ];
      const event = createMockPasteEvent(mockClipboardItems);

      // Act
      app.handlePaste(event);

      // Assert
      expect(showImageBlobSpy).toHaveBeenCalledWith(mockFile);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(showStatusSpy).toHaveBeenCalledWith(
        'Image pasted successfully',
        'success'
      );
    });

    it('should not process anything if no image item is found', () => {
      // Arrange
      const mockClipboardItems = [
        { type: 'text/html', getAsFile: () => null },
        { type: 'text/plain', getAsFile: () => null },
      ];
      const event = createMockPasteEvent(mockClipboardItems);

      // Act
      app.handlePaste(event);

      // Assert
      expect(showImageBlobSpy).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(showStatusSpy).not.toHaveBeenCalled();
    });

    it('should stop processing after finding the first image', () => {
      // Arrange
      const mockFile1 = new File(['image1'], 'image1.png', {
        type: 'image/png',
      });
      const mockFile2 = new File(['image2'], 'image2.jpg', {
        type: 'image/jpeg',
      });

      const mockClipboardItems = [
        { type: 'image/png', getAsFile: () => mockFile1 },
        { type: 'image/jpeg', getAsFile: () => mockFile2 },
      ];
      const event = createMockPasteEvent(mockClipboardItems);

      // Act
      app.handlePaste(event);

      // Assert
      // It should have only been called once, with the *first* file.
      expect(showImageBlobSpy).toHaveBeenCalledTimes(1);
      expect(showImageBlobSpy).toHaveBeenCalledWith(mockFile1);
      expect(showStatusSpy).toHaveBeenCalledWith(
        'Image pasted successfully',
        'success'
      );
    });

    it('should exit gracefully if event.clipboardData is null', () => {
      // Arrange
      const event = new Event('paste');
      Object.defineProperty(event, 'clipboardData', { value: null });

      // Act & Assert
      // We expect no errors to be thrown and no functions to be called.
      expect(() => app.handlePaste(event)).not.toThrow();
      expect(showImageBlobSpy).not.toHaveBeenCalled();
      expect(showStatusSpy).not.toHaveBeenCalled();
    });
  });

  describe('Event Listener Attachment', () => {
    let spies;

    beforeEach(() => {
      // Re-create the app instance to ensure a clean state
      app = new GritShotApp();

      // Set up spies on all handler methods
      spies = {
        tryReadClipboard: jest.spyOn(app, 'tryReadClipboard'),
        clearImage: jest.spyOn(app, 'clearImage'),
        analyzeImage: jest.spyOn(app, 'analyzeImage'),
        saveSettings: jest.spyOn(app, 'saveSettings'),
        clearApiKey: jest.spyOn(app, 'clearApiKey'),
        validatePromptForm: jest.spyOn(app, 'validatePromptForm'),
        validateSettingsForm: jest.spyOn(app, 'validateSettingsForm'),
        handleFileSelect: jest.spyOn(app, 'handleFileSelect'),
        handlePaste: jest.spyOn(app, 'handlePaste'),
        setupDragAndDrop: jest.spyOn(app, 'setupDragAndDrop'),
        setupTabKeydownListener: jest.spyOn(app, 'setupTabKeydownListener'),
        fileInputClick: jest.spyOn(app.elements.fileInput, 'click'),
      };
    });

    it('should attach a click listener to the dropzone to trigger file input', () => {
      app.elements.dropZone.click();
      expect(spies.fileInputClick).toHaveBeenCalled();
    });

    it('should attach a change listener to the file input', () => {
      app.elements.fileInput.dispatchEvent(new Event('change'));
      expect(spies.handleFileSelect).toHaveBeenCalled();
    });

    it('should attach a paste listener to the document', () => {
      document.dispatchEvent(new Event('paste'));
      // Note: Since handlePaste is bound, we check the spy on the original method.
      expect(spies.handlePaste).toHaveBeenCalled();
    });

    it('should trigger analysis on Ctrl+Enter if analyze button is enabled', () => {
      // Arrange: Ensure the button is enabled for the test
      app.elements.analyzeBtn.disabled = false;
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
      });

      // Act
      app.elements.prompt.dispatchEvent(event);

      // Assert
      expect(spies.analyzeImage).toHaveBeenCalled();
    });

    it('should NOT trigger analysis on Ctrl+Enter if analyze button is disabled', () => {
      // Arrange: The button is disabled by default
      app.elements.analyzeBtn.disabled = true;
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
      });

      // Act
      app.elements.prompt.dispatchEvent(event);

      // Assert
      expect(spies.analyzeImage).not.toHaveBeenCalled();
    });
  });

  describe('File Input Handling', () => {
    let showImageBlobSpy;
    let showStatusSpy;

    beforeEach(() => {
      // Spy on the methods that will be called by the handler
      showImageBlobSpy = jest.spyOn(app, 'showImageBlob');
      showStatusSpy = jest.spyOn(app, 'showStatus');
    });

    // Helper to create a mock event with files
    const createMockFileEvent = (files = []) => {
      return {
        target: {
          files,
          value: 'C:\\fakepath\\somefile.png', // a dummy initial value
        },
      };
    };

    it('should process a valid selected image file', () => {
      // Arrange
      const mockImageFile = new File(['mock-image'], 'photo.jpg', {
        type: 'image/jpeg',
      });
      const event = createMockFileEvent([mockImageFile]);

      // Act
      app.handleFileSelect(event);

      // Assert
      expect(showImageBlobSpy).toHaveBeenCalledWith(mockImageFile);
      expect(showStatusSpy).toHaveBeenCalledWith(
        'Image loaded from file browser',
        'success'
      );
      expect(event.target.value).toBe(''); // Verify the input was cleared
    });

    it('should show an error for a selected non-image file', () => {
      // Arrange
      const mockTextFile = new File(['mock-text'], 'document.txt', {
        type: 'text/plain',
      });
      const event = createMockFileEvent([mockTextFile]);

      // Act
      app.handleFileSelect(event);

      // Assert
      expect(showImageBlobSpy).not.toHaveBeenCalled();
      expect(showStatusSpy).toHaveBeenCalledWith(
        'Please select a valid image file (PNG, JPG)',
        'error'
      );
      expect(event.target.value).toBe('');
    });

    it('should do nothing if no file is selected', () => {
      // Arrange: Create an event with an empty files array
      const event = createMockFileEvent([]);

      // Act
      app.handleFileSelect(event);

      // Assert: No processing methods should be called
      expect(showImageBlobSpy).not.toHaveBeenCalled();
      expect(showStatusSpy).not.toHaveBeenCalled();
      expect(event.target.value).toBe('');
    });
  });
});
