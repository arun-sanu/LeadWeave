import React from 'react';
import { X } from 'lucide-react';
import { bubbleStore, type LivelyAlert } from './useBubbleStore';
import { getBubbleDisplayName } from './bubbleUtils';

export function LivelyMessagePopup({ alert }: { alert: LivelyAlert }) {
  const displayName = getBubbleDisplayName(alert.chatId, alert.name);
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2);

  const handleClick = () => {
    bubbleStore.setDockExpanded(alert.sessionId, true);
    bubbleStore.openDrawer(alert.chatId);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    bubbleStore.dismissLivelyAlert();
  };

  return (
    <div className="lively-message-popup" onClick={handleClick} role="alert">
      <div className="lively-popup-avatar">
        {alert.avatarUrl ? <img src={alert.avatarUrl} alt={displayName} /> : <span>{initials}</span>}
      </div>
      <div className="lively-popup-content">
        <div className="lively-popup-header">
          <span className="lively-popup-sender">{displayName}</span>
          <button
            type="button"
            className="lively-popup-close"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
          >
            <X size={12} />
          </button>
        </div>
        <p className="lively-popup-snippet">{alert.text}</p>
      </div>
    </div>
  );
}
