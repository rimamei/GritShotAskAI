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
    json: () => Promise.resolve({ choices: [{ message: { content: 'Test response' } }] }),
    text: () => Promise.resolve('Error'),
    blob: () => Promise.resolve(new window.Blob([''], { type: 'image/png' })),
  })
);

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/fake-blob-id');
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
        writable: true
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
      app.elements.apiKeySetting.value = 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      
      app.validatePromptForm();

      expect(app.elements.analyzeBtn.disabled).toBe(false);
    });

    it('should disable analyze button if image is missing', () => {
        app.state.currentImage = null;
        app.elements.prompt.value = 'Test prompt';
        app.elements.apiKeySetting.value = 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        
        app.validatePromptForm();
        
        expect(app.elements.analyzeBtn.disabled).toBe(true);
    });
  });
  
  describe('Settings Management', () => {
    it('should save settings to chrome storage', async () => {
      app.elements.aiProvider.value = 'openai';
      app.elements.apiKeySetting.value = 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
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

    it('should load settings from chrome storage', async () => {
        const settings = {
            ai_provider: 'gemini',
            gemini_api_key: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            gemini_model: 'gemini-1.5-flash-latest',
            default_prompt: 'Loaded prompt'
        };
        chrome.storage.local.get.mockResolvedValue(settings);

        await app.loadSettings();
        
        expect(app.elements.aiProvider.value).toBe('gemini');
        expect(app.elements.geminiApiKeySetting.value).toBe(settings.gemini_api_key);
        expect(app.elements.geminiModelSetting.value).toBe(settings.gemini_model);
        expect(app.elements.defaultPromptSetting.value).toBe(settings.default_prompt);
    });
  });

  describe('API Analysis', () => {
    beforeEach(() => {
        // Setup for analysis tests
        app.state.currentImage = 'fake-image-url';
        app.elements.preview.src = 'http://localhost/fake.png';
        app.elements.prompt.value = 'What is in this image?';
        
        // Mock the conversion methods to prevent actual fetch/conversion during the test
        jest.spyOn(app, 'convertToDataUrl').mockResolvedValue('data:image/png;base64,fake-data-url');
        jest.spyOn(app, 'convertToBase64').mockResolvedValue('fake-base64-string');
    });
    
    it('should call OpenAI API when provider is set to openai', async () => {
        app.elements.aiProvider.value = 'openai';
        app.elements.apiKeySetting.value = 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

        await app.analyzeImage();
        
        expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.any(Object));
        expect(app.elements.answer.textContent).toBe('Test response');
    });

    it('should call Gemini API when provider is set to gemini', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: 'Gemini response' }] } }] })
        });
        
        app.elements.aiProvider.value = 'gemini';
        app.elements.geminiApiKeySetting.value = 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

        await app.analyzeImage();
        
        const model = app.elements.geminiModelSetting.value;
        const apiKey = app.elements.geminiApiKeySetting.value;
        const expectedUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        expect(fetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
        expect(app.elements.answer.textContent).toBe('Gemini response');
    });

    it('should handle API fetch error gracefully', async () => {
        // Suppress console.error for this test because we expect an error to be logged
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        
        const errorMessage = 'API request failed';
        global.fetch.mockRejectedValueOnce(new Error(errorMessage));

        app.elements.aiProvider.value = 'openai';
        app.elements.apiKeySetting.value = 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        
        await app.analyzeImage();
        
        expect(app.elements.answer.textContent).toContain('Error:');
        expect(app.elements.answer.textContent).toContain(errorMessage);
        expect(app.state.isProcessing).toBe(false);

        // Restore console.error
        consoleErrorSpy.mockRestore();
    });
  });

});

