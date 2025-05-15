import React, { useState } from 'react';
import './FeedExamples.css';
import { askGemini, askGeminiWithFiles } from '../utils/geminiService';
import { Document, Packer, Paragraph, TextRun } from 'docx'; // Import from docx library
import { saveAs } from 'file-saver'; // For triggering the download

// Helper function to convert a Blob to base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helper function to determine MIME type from filename
const getMimeType = (filename) => {
  const extension = filename.split('.').pop().toLowerCase();
  switch (extension) {
    case 'pdf': return 'application/pdf';
    case 'txt': return 'text/plain';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    default: return null;
  }
};

const FeedExamples = ({ disabled, setAppLoading }) => {
  const [isProcessingExamples, setIsProcessingExamples] = useState(false);
  let accumulatedLogForDocx = ''; 

  const generateAndDownloadDocx = async (logContent) => {
    if (!logContent.trim()) {
      alert('No content to export.');
      return;
    }

    const paragraphs = logContent.split('\n').map(line => 
      new Paragraph({
        children: [new TextRun(line)],
      })
    );

    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs,
      }],
    });

    try {
      const blob = await Packer.toBlob(doc);
      saveAs(blob, "gemini_output.docx");
      console.log('Document generated and download triggered.');
    } catch (error) {
      console.error('Error generating .docx file:', error);
      alert('Failed to generate .docx file. Check console for details.');
    }
  };

  const handleFeedExamples = async () => {
    setAppLoading(true);
    setIsProcessingExamples(true);
    accumulatedLogForDocx = '';

    const appendToLog = (message, type = 'info') => {
      const prefix = type === 'error' ? 'ERROR: ' : type === 'warn' ? 'WARN: ' : '';
      accumulatedLogForDocx += prefix + message + '\n';
    };

    try {
      const filesListResponse = await fetch('https://vibathon.onrender.com/api/examples');
      const filesData = await filesListResponse.json();
      appendToLog(`Files in public/examples directory: ${JSON.stringify(filesData.files, null, 2)}`);
      appendToLog('\n---\n');

      const promptsFileResponse = await fetch('/FeedExamplesPrompts.txt');
      const promptsText = await promptsFileResponse.text();
      
      const individualPrompts = promptsText
        .split('@@@@')
        .map(segment => {
          let cleanedSegment = segment.trim();
          cleanedSegment = cleanedSegment.replace(/@+$/, '');
          cleanedSegment = cleanedSegment.trim();
          return cleanedSegment;
        })
        .filter(prompt => prompt !== '');

      if (individualPrompts.length > 0) {
        appendToLog('Processing prompts from file for Gemini...\n');
        for (const originalCleanedPrompt of individualPrompts) {
          const filePattern = /####(.*?)####/g;
          let fileMatches = [...originalCleanedPrompt.matchAll(filePattern)];
          let successfullySentWithFile = false;
          let filesToAttachDetails = [];

          if (fileMatches.length > 0) {
            let textForPromptWithFiles = originalCleanedPrompt;
            let allFilesValid = true;

            for (const match of fileMatches) {
              const filenameToAttach = match[1].trim();
              textForPromptWithFiles = textForPromptWithFiles.replace(match[0], '');
              const mimeType = getMimeType(filenameToAttach);
              if (filenameToAttach && mimeType) {
                filesToAttachDetails.push({ name: filenameToAttach, mimeType: mimeType });
              } else {
                appendToLog(`Invalid filename or unsupported MIME type for "${filenameToAttach}". File skipped.`, 'warn');
                allFilesValid = false;
              }
            }
            textForPromptWithFiles = textForPromptWithFiles.trim();

            if (filesToAttachDetails.length > 0 && allFilesValid) {
              appendToLog(`Attempting prompt: "${textForPromptWithFiles}", with Files: ${filesToAttachDetails.map(f => f.name).join(', ')}`);
              const filesForApi = [];
              let fileFetchError = false;
              for (const fileDetail of filesToAttachDetails) {
                try {
                  const fileFetchResponse = await fetch(`/examples/${fileDetail.name}`);
                  if (!fileFetchResponse.ok) throw new Error(`Fetch failed for ${fileDetail.name}: ${fileFetchResponse.status}`);
                  const fileBlob = await fileFetchResponse.blob();
                  const fileBase64DataUrl = await blobToBase64(fileBlob);
                  filesForApi.push({ mimeType: fileDetail.mimeType, data: fileBase64DataUrl });
                } catch (error) {
                  appendToLog(`Failed to fetch/process file "${fileDetail.name}": ${error.message}`, 'error');
                  fileFetchError = true; break;
                }
              }
              if (!fileFetchError && filesForApi.length > 0) {
                try {
                  const geminiResponse = await askGeminiWithFiles(textForPromptWithFiles, filesForApi);
                  appendToLog(`Gemini Response (for prompt with ${filesToAttachDetails.map(f => f.name).join(', ')}):\n${geminiResponse.content}`);
                  successfullySentWithFile = true;
                } catch (error) {
                  appendToLog(`Gemini API call failed for prompt with files: ${error.message}`, 'error');
                }
              }
            }
            if (!successfullySentWithFile && filesToAttachDetails.length > 0 && !allFilesValid) {
                 appendToLog(`One or more files had issues. Attempting prompt as text-only.`, 'warn');
            } else if (!successfullySentWithFile && filesToAttachDetails.length === 0 && fileMatches.length > 0) {
                appendToLog(`File tags found, but no valid files prepared. Attempting prompt as text-only.`, 'warn');
            }
          }

          if (!successfullySentWithFile) {
            const promptToSendAsText = originalCleanedPrompt;
            appendToLog(`Sending text-only prompt to Gemini: "${promptToSendAsText}"`);
            try {
              const geminiResponse = await askGemini(promptToSendAsText);
              appendToLog(`Gemini Response:\n${geminiResponse.content}`);
            } catch (error) {
              appendToLog(`Error sending text-only prompt "${promptToSendAsText}": ${error.message}`, 'error');
            }
          }
          appendToLog('\n---\n');
        }
      } else {
        appendToLog('No valid prompts found in FeedExamplesPrompts.txt');
      }
      
    } catch (error) {
      appendToLog(`Critical error in FeedExamples process: ${error.message}`, 'error');
    } finally {
      setIsProcessingExamples(false);
      setAppLoading(false);
      await generateAndDownloadDocx(accumulatedLogForDocx);
    }
  };

  return (
    <div className="feed-examples-container">
        <p>
            The first time you run this tool, click this button to feed the system with examples
            of documents and verification results. The results will be exported in a .docx file.
        </p>
      <button 
        className="feed-examples-button"
        onClick={handleFeedExamples}
        disabled={disabled || isProcessingExamples}
      >
        {isProcessingExamples ? 'Processing & Generating Doc...' : 'Feed Examples & Download Result'}
      </button>
    </div>
  );
};

export default FeedExamples; 