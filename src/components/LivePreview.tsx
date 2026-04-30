import React from 'react';

interface LivePreviewProps {
  transcript: string;
}

export const LivePreview: React.FC<LivePreviewProps> = ({ transcript }) => {
  if (!transcript) return null;
  return (
    <div className="live-preview">
      <div className="live-preview-title">🗣️ 認識中...</div>
      <div className="interim-text">{transcript}</div>
    </div>
  );
};
