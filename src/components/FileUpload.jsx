import { useState, useRef } from 'react';
// import { GoogleGenerativeAI } from "@google/generative-ai"; // No longer needed if detectSignature is removed
import './FileUpload.css';
import FeedExamples from './FeedExamples';
import { askGemini, askGeminiWithFiles } from '../utils/geminiService'; // Import Gemini services
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
// import SignalBlueLogo from '../../assets/SignalBlue.png'; // REMOVED Import

// const ai = new GoogleGenerativeAI('AIzaSyCCCHh_fFM_QwDXuyosvORR9Y5t42pEDPU'); // No longer needed

// Helper function to convert a Blob to base64 (already exists, ensure it's available)
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helper function to determine MIME type from filename (already exists, ensure it's available)
const getMimeType = (filename) => {
  const extension = filename.split('.').pop().toLowerCase();
  switch (extension) {
    case 'pdf': return 'application/pdf';
    case 'txt': return 'text/plain';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    default: return null;
  }
};

const FileUpload = ({ setAppLoading }) => {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  // const [signatureResults, setSignatureResults] = useState([]); // Removed
  const [showPerformChecksButton, setShowPerformChecksButton] = useState(false);
  const [lastUploadedFiles, setLastUploadedFiles] = useState([]); // New state for successfully uploaded files
  const [isPerformingChecks, setIsPerformingChecks] = useState(false); // Renamed loading to isPerformingChecks for clarity
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setError(null);
    setShowPerformChecksButton(false);
    setLastUploadedFiles([]); // Clear on new selection
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileInput = (e) => {
    setError(null);
    setShowPerformChecksButton(false);
    setLastUploadedFiles([]); // Clear on new selection
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);
  };

  const handleFiles = (newFiles) => {
    setShowPerformChecksButton(false); 
    setLastUploadedFiles([]); // Clear when file list is modified before upload
    const uniqueFiles = newFiles.filter(
      newFile => !files.some(existingFile => 
        existingFile.name === newFile.name && 
        existingFile.size === newFile.size
      )
    );
    const oversizedFiles = uniqueFiles.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setError(`Some files exceed the 10MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }
    setFiles(prevFiles => [...prevFiles, ...uniqueFiles]);
  };

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    setError(null);
    if (newFiles.length === 0) { 
        setShowPerformChecksButton(false);
        setLastUploadedFiles([]); // Clear if all files removed
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // detectSignature function removed

  const uploadFiles = async () => {
    if (files.length === 0) {
      setError('Please select files to upload');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);
    // setSignatureResults([]); // Removed
    setShowPerformChecksButton(false);
    const uploadedFileDetailsFromServer = []; // To store { nameOnServer, originalType } for this batch

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setCurrentFile(file);
      
      // Signature detection call removed
      // const hasSignature = await detectSignature(file);
      // setSignatureResults(prev => [...prev, { fileName: file.name, hasSignature }]);
      
      const formData = new FormData();
      formData.append('files', file);

      try {
        const response = await fetch('http://localhost:3000/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Upload failed for ' + file.name);
        
        // Assuming server returns data.files as an array, and for single file upload, it's data.files[0]
        if (data.files && data.files.length > 0) {
          uploadedFileDetailsFromServer.push({ 
            name: data.files[0].filename, // THIS IS THE KEY: Use filename from server response
            type: file.type // Keep original type for MIME
          });
        } else {
          // Fallback or error if server response format is unexpected
          console.warn('Server response for uploaded file did not contain expected filename.');
          uploadedFileDetailsFromServer.push({ name: file.name, type: file.type }); // Fallback to original name
        }

        const progress = ((i + 1) / files.length) * 100;
        setUploadProgress(progress);
        
      } catch (errorCatch) {
        console.error('Error uploading file:', errorCatch);
        setError(`Error uploading ${file.name}: ${errorCatch.message}`);
        setIsUploading(false);
        setCurrentFile(null);
        setUploadProgress(0);
        setShowPerformChecksButton(false);
        setLastUploadedFiles([]); // Clear if upload fails
        return;
      }
    }

    if (!error) {
        // Store details of successfully uploaded files for this batch
        setLastUploadedFiles(uploadedFileDetailsFromServer); 
        setShowPerformChecksButton(true);
    }
    setFiles([]); // Clear the selection list
    setIsUploading(false);
    setCurrentFile(null);
  };

  const generateAndDownloadDocx = async (logContent, baseFilename = "gemini_output") => {
    if (!logContent.trim()) {
      alert('No content to export.');
      return;
    }
    const paragraphs = logContent.split('\n').map(line => new Paragraph({ children: [new TextRun(line)] }));
    const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
    try {
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${baseFilename}_${new Date().toISOString().slice(0,10)}.docx`);
    } catch (error) {
      console.error('Error generating .docx file:', error);
      alert('Failed to generate .docx file. Check console for details.');
    }
  };

  const handlePerformChecks = async () => {
    if (lastUploadedFiles.length === 0) {
      alert('No files were uploaded in the last batch to perform checks on.');
      return;
    }

    setAppLoading(true); // Use global loader
    setIsPerformingChecks(true); // For button state
    let outputForDocx = '';
    const appendToDoc = (message, type='info') => { 
        outputForDocx += (type === 'error' ? 'ERROR: ' : type === 'warn' ? 'WARN: ' : '') + message + '\n';
    };

    appendToDoc(`Performing checks on ${lastUploadedFiles.length} file(s): ${lastUploadedFiles.map(f => f.name).join(', ')}\n---\n`);

    try {
      const promptTextResponse = await fetch('/PerformChecks.txt');
      if (!promptTextResponse.ok) throw new Error('Failed to fetch PerformChecks.txt');
      let mainPromptText = await promptTextResponse.text();

      appendToDoc(`Using prompt from PerformChecks.txt:\n${mainPromptText}\n---\n`);

      const filesForApi = [];
      let fileFetchError = false;

      for (const uploadedFile of lastUploadedFiles) {
        try {
          // Fetch from server's /uploads directory where files are stored by server.cjs
          const fileFetchResponse = await fetch(`http://localhost:3000/uploads/${uploadedFile.name}`);
          if (!fileFetchResponse.ok) {
            throw new Error(`Fetch failed for ${uploadedFile.name}: ${fileFetchResponse.status}`);
          }
          const fileBlob = await fileFetchResponse.blob();
          const fileBase64DataUrl = await blobToBase64(fileBlob);
          filesForApi.push({ mimeType: uploadedFile.type || getMimeType(uploadedFile.name), data: fileBase64DataUrl });
          appendToDoc(`Successfully prepared file for Gemini: ${uploadedFile.name}`);
        } catch (error) {
          appendToDoc(`Failed to fetch/process uploaded file "${uploadedFile.name}": ${error.message}`, 'error');
          fileFetchError = true; 
          // Optionally decide if you want to stop or continue without this file
        }
      }

      if (fileFetchError && filesForApi.length === 0) {
        appendToDoc('Could not prepare any of the uploaded files for Gemini. Aborting checks.', 'error');
      } else if (filesForApi.length > 0) {
        // Remove ####filename#### placeholders from prompt as all uploaded files are attached by default
        mainPromptText = mainPromptText.replace(/####(.*?)####/g, '').trim();
        if (fileFetchError) {
            appendToDoc('Some files could not be prepared, proceeding with available files.', 'warn');
        }
        appendToDoc(`Sending prompt to Gemini with ${filesForApi.length} attached file(s)...`);
        try {
          const geminiResponse = await askGeminiWithFiles(mainPromptText, filesForApi);
          appendToDoc(`Gemini Response:\n${geminiResponse.content}`);
        } catch (geminiError) {
          appendToDoc(`Gemini API call failed: ${geminiError.message}`, 'error');
        }
      } else {
        appendToDoc('No files were successfully prepared to send with the prompt. Attempting prompt as text-only.', 'warn');
        try {
            const geminiResponse = await askGemini(mainPromptText);
            appendToDoc(`Gemini Response (text-only):\n${geminiResponse.content}`);
        } catch (geminiError) {
            appendToDoc(`Gemini API call (text-only) failed: ${geminiError.message}`, 'error');
        }
      }

    } catch (error) {
      appendToDoc(`Error in Perform Checks process: ${error.message}`, 'error');
    } finally {
      setIsPerformingChecks(false); // For button state
      setAppLoading(false); // Hide global loader
      await generateAndDownloadDocx(outputForDocx, "PerformChecks_Output");
      setShowPerformChecksButton(false); // Hide button after DOCX is generated/downloaded
    }
  };

  return (
    <>
      <FeedExamples disabled={isUploading || isPerformingChecks} setAppLoading={setAppLoading} />
      <div className="file-upload-container">
        <p className="upload-description">
          Upload your files here. Maximum file size: 10MB
        </p>
        
        <div className="file-upload-main-content">
          <div className="file-upload-left-column">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            {!error && uploadProgress === 100 && !isUploading && (
              <div className="success-message">
                Files uploaded successfully!
                {showPerformChecksButton && (
                    <button 
                        onClick={handlePerformChecks} 
                        className="perform-checks-button"
                        disabled={isUploading || isPerformingChecks}
                    >
                        {isPerformingChecks ? 'Performing Checks...' : 'Perform Checks'}
                    </button>
                )}
              </div>
            )}
            
            <div
              className={`drop-zone ${isDragging ? 'dragging' : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="file-input"
                onChange={handleFileInput}
                multiple
              />
              <div className="drop-zone-text">
                <p>Drag and drop files here</p>
                <p>or</p>
                <button type="button" className="browse-button">
                  Upload from Computer
                </button>
                <p className="file-limit-text">Maximum file size: 10MB</p>
              </div>
            </div>

            <div className="button-container main-upload-button-container">
                <button
                onClick={uploadFiles}
                className="upload-button"
                disabled={isUploading || files.length === 0}
                >
                {isUploading && currentFile ? `Uploading ${currentFile?.name || 'file'}... (${Math.round(uploadProgress)}%)` : (isUploading ? 'Uploading...' : 'Upload Selected Files')}
                </button>
            </div>

            {isUploading && currentFile && (
              <div className="upload-progress">
                <div className="progress-info">
                  <span>Uploading: {currentFile.name}</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="file-upload-right-column">
            {files.length > 0 && (
              <div className="file-list">
                <h3>Selected Files:</h3>
                <ul>
                  {files.map((file, index) => (
                    <li key={index}>
                      <div className="file-info">
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">{formatFileSize(file.size)}</span>
                      </div>
                      <button 
                        onClick={() => removeFile(index)}
                        className="remove-button"
                        disabled={isUploading}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default FileUpload;