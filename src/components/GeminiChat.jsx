import { useState } from 'react';
import { askGemini, askGeminiForJson, askGeminiWithImage } from '../utils/geminiService';
import './GeminiChat.css';

const GeminiChat = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResponse('');
    setIsLoading(true);
    setRetryCount(0);

    try {
      let result;
      
      if (selectedImage) {
        // If an image is selected, use image analysis
        result = await askGeminiWithImage(selectedImage, prompt);
      } else if (prompt.toLowerCase().includes('json')) {
        // If prompt mentions JSON, use JSON response
        const schema = {
          type: 'object',
          properties: {
            response: {
              type: 'string'
            },
            details: {
              type: 'array',
              items: {
                type: 'string'
              }
            }
          }
        };
        result = await askGeminiForJson(prompt, schema);
        result = { content: JSON.stringify(result, null, 2) };
      } else {
        // Regular text prompt
        result = await askGemini(prompt);
      }

      setResponse(result.content);
      setError('');
    } catch (error) {
      setError(error.message);
      setRetryCount(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
  };

  return (
    <div className="gemini-chat">
      <h2>Gemini Chat</h2>
      
      <form onSubmit={handleSubmit} className="chat-form">
        <div className="input-group">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            rows={4}
            disabled={isLoading}
          />
          
          <div className="image-upload">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              disabled={isLoading}
              style={{ display: 'none' }}
              id="image-upload"
            />
            <label htmlFor="image-upload" className="upload-button">
              {selectedImage ? 'Change Image' : 'Add Image'}
            </label>
            {selectedImage && (
              <button type="button" onClick={clearImage} className="clear-button">
                Clear Image
              </button>
            )}
          </div>
        </div>

        {selectedImage && (
          <div className="image-preview">
            <img src={selectedImage} alt="Selected" />
          </div>
        )}

        <button type="submit" disabled={!prompt.trim() || isLoading} className={isLoading ? 'loading' : ''}>
          {isLoading ? 'Connecting to Cursor...' : 'Send'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          <h3>Error:</h3>
          <pre>{error}</pre>
          {error.includes('Cursor is not accessible') && (
            <div className="error-help">
              <p>Make sure to:</p>
              <ol>
                <li>Open Cursor application</li>
                <li>Press Ctrl+Shift+L to open the chat window</li>
                <li>Wait a few seconds and try again</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {response && (
        <div className="response">
          <h3>Response:</h3>
          <pre>{response}</pre>
        </div>
      )}
    </div>
  );
};

export default GeminiChat; 