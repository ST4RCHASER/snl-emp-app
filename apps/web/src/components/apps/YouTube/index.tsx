import { useState, useCallback } from "react";
import { Input, Button, tokens, Tooltip } from "@fluentui/react-components";
import {
  Play24Regular,
  History24Regular,
  Delete24Regular,
} from "@fluentui/react-icons";

interface VideoHistoryItem {
  id: string;
  title: string;
  timestamp: number;
}

function extractVideoId(input: string): string | null {
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default function YouTube() {
  const [inputUrl, setInputUrl] = useState("");
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<VideoHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handlePlay = useCallback(() => {
    const videoId = extractVideoId(inputUrl.trim());
    if (videoId) {
      setCurrentVideoId(videoId);
      setError(null);

      // Add to history
      const newItem: VideoHistoryItem = {
        id: videoId,
        title: `Video ${videoId}`,
        timestamp: Date.now(),
      };
      const newHistory = [
        newItem,
        ...history.filter((h) => h.id !== videoId),
      ].slice(0, 20);
      setHistory(newHistory);
    } else {
      setError("Invalid YouTube URL or video ID");
    }
  }, [inputUrl, history]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handlePlay();
    }
  };

  const playFromHistory = (videoId: string) => {
    setCurrentVideoId(videoId);
    setInputUrl(`https://youtube.com/watch?v=${videoId}`);
    setShowHistory(false);
    setError(null);
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* URL Input */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Input
          value={inputUrl}
          onChange={(_, data) => setInputUrl(data.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste YouTube URL or video ID..."
          style={{ flex: 1 }}
        />
        <Button
          appearance="primary"
          icon={<Play24Regular />}
          onClick={handlePlay}
        >
          Play
        </Button>
        <Tooltip content="History" relationship="label">
          <Button
            appearance={showHistory ? "primary" : "subtle"}
            icon={<History24Regular />}
            onClick={() => setShowHistory(!showHistory)}
          />
        </Tooltip>
      </div>

      {error && (
        <div style={{ color: tokens.colorPaletteRedForeground1, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* History Panel */}
      {showHistory && (
        <div
          style={{
            background: tokens.colorNeutralBackground2,
            borderRadius: 8,
            padding: 12,
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span style={{ fontWeight: 500, fontSize: 14 }}>Recent Videos</span>
            {history.length > 0 && (
              <Button
                appearance="subtle"
                size="small"
                icon={<Delete24Regular />}
                onClick={clearHistory}
              >
                Clear
              </Button>
            )}
          </div>
          {history.length === 0 ? (
            <div
              style={{ color: tokens.colorNeutralForeground3, fontSize: 12 }}
            >
              No history yet
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {history.map((item) => (
                <button
                  key={item.id + item.timestamp}
                  onClick={() => playFromHistory(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    border: "none",
                    background: "transparent",
                    borderRadius: 4,
                    cursor: "pointer",
                    textAlign: "left",
                    color: tokens.colorNeutralForeground1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      tokens.colorNeutralBackground3;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <img
                    src={`https://img.youtube.com/vi/${item.id}/default.jpg`}
                    alt=""
                    style={{
                      width: 60,
                      height: 45,
                      objectFit: "cover",
                      borderRadius: 4,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontFamily: "monospace",
                        color: tokens.colorNeutralForeground2,
                      }}
                    >
                      {item.id}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: tokens.colorNeutralForeground3,
                      }}
                    >
                      {new Date(item.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Video Player */}
      <div
        style={{
          flex: 1,
          background: "#000",
          borderRadius: 8,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 300,
        }}
      >
        {currentVideoId ? (
          <iframe
            src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
          />
        ) : (
          <div
            style={{
              color: tokens.colorNeutralForeground3,
              textAlign: "center",
              padding: 20,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>▶</div>
            <div>Paste a YouTube URL to start watching</div>
            <div style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>
              Supports: youtube.com/watch?v=..., youtu.be/..., or video ID
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
