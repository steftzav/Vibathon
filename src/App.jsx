import { useState } from 'react';
import FileUpload from './components/FileUpload';
import './App.css';
import SignalBlueLogo from './assets/SignalBlue.png'; // Import the logo

function App() {
  const [isAppLoading, setAppLoading] = useState(false);

  return (
    <div className="app-container">
      {isAppLoading && (
        <div className="global-loader-overlay">
          <div className="loader-spinner"></div>
          <p className="loader-text">Processing...</p>
        </div>
      )}
      <img src={SignalBlueLogo} alt="Signal Blue Logo" className="top-left-logo" />
      <h1>Cargo Documents Verification Tool</h1>
      <br></br>
      <br></br>
      <FileUpload setAppLoading={setAppLoading} />
    </div>
  );
}

export default App;
