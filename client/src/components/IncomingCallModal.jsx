export function IncomingCallModal({ incomingCall, onAccept, onDecline }) {
  if (!incomingCall) return null;

  return (
    <div className="incoming-call-modal">
      <div className="modal-content">
        <h2>Incoming Call</h2>
        <p>From: {incomingCall.peerId}</p>
        <div className="modal-buttons">
          <button onClick={onAccept} className="accept-btn">
            Accept
          </button>
          <button onClick={onDecline} className="decline-btn">
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}

