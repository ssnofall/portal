import { useState } from 'react';

export function ConnectionInfo({ myId, peerIdInput, onPeerIdChange, onCall, isStreamReady }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!myId) return;
    
    try {
      await navigator.clipboard.writeText(myId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = myId;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="info">
      <p className="peer-id-container">
        <span className="label">Your Portal ID:</span>{' '}
        <strong>{myId || 'Loading...'}</strong>
        {myId && (
          <button
            onClick={handleCopy}
            className="copy-btn"
            title={copied ? 'Copied!' : 'Copy to clipboard'}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </p>
      <div className="call-controls">
        <input
          type="text"
          value={peerIdInput}
          onChange={(e) => onPeerIdChange(e.target.value)}
          placeholder="Enter Portal ID"
          onKeyPress={(e) => e.key === 'Enter' && onCall()}
        />
        <button onClick={onCall} disabled={!isStreamReady}>
          Connect
        </button>
      </div>
    </div>
  );
}

