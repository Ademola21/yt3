
import React, { useState } from 'react';

interface VideoDetails {
  id: string;
  title: string;
  description: string;
  url: string;
  duration: {
    total_seconds: number;
    seconds: number;
    minutes: number;
    hours: number;
    days: number;
    formatted: string;
  };
  upload_time: {
    date: string;
    timestamp: number;
    formatted: string;
  };
  thumbnail: string;
  view_count: number;
  like_count: number;
  channel: {
    name: string;
    id: string;
    url: string;
  };
}

interface VideoDetailsResponse {
  success: boolean;
  video: VideoDetails;
}

const VideoDetailsFetcher: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<VideoDetailsResponse | null>(null);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }
    
    if (!videoUrl.trim()) {
      setError('Please enter a video URL');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/v1/video/details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ url: videoUrl })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface p-6 rounded-lg border border-border">
      <h2 className="text-2xl font-bold text-text-primary mb-4">Video Details Fetcher</h2>
      <p className="text-text-secondary mb-6">
        Fetch comprehensive details for any YouTube video including title, description, duration, upload time, and highest quality thumbnail.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium text-text-secondary mb-1">
            API Key
          </label>
          <input
            id="apiKey"
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your API key here..."
            className="w-full bg-surface border border-border rounded-md px-4 py-2 text-text-primary focus:ring-2 focus:ring-primary focus:outline-none transition-shadow"
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="videoUrl" className="block text-sm font-medium text-text-secondary mb-1">
            Video URL
          </label>
          <input
            id="videoUrl"
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
            className="w-full bg-surface border border-border rounded-md px-4 py-2 text-text-primary focus:ring-2 focus:ring-primary focus:outline-none transition-shadow"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Fetching Video Details...
            </>
          ) : (
            'Fetch Video Details'
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-md">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {result && result.video && (
        <div className="mt-6 space-y-4">
          <div className="p-4 bg-surface rounded-lg border border-border">
            <div className="flex gap-4 mb-4">
              <img
                src={result.video.thumbnail}
                alt={result.video.title}
                className="w-64 h-36 object-cover rounded flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-semibold text-text-primary mb-2">{result.video.title}</h3>
                <div className="flex gap-4 text-sm text-text-secondary mb-2">
                  <span>⏱️ {result.video.duration.formatted}</span>
                  <span>👁️ {formatNumber(result.video.view_count)} views</span>
                  <span>👍 {formatNumber(result.video.like_count)} likes</span>
                </div>
                <p className="text-sm text-text-secondary">
                  Channel: <a href={result.video.channel.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {result.video.channel.name}
                  </a>
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <strong className="text-text-secondary">Video ID:</strong>
                <p className="font-mono text-xs mt-1">{result.video.id}</p>
              </div>

              <div>
                <strong className="text-text-secondary">URL:</strong>
                <p className="mt-1">
                  <a href={result.video.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                    {result.video.url}
                  </a>
                </p>
              </div>

              <div>
                <strong className="text-text-secondary">Duration Breakdown:</strong>
                <p className="text-xs mt-1">
                  {result.video.duration.days > 0 && `${result.video.duration.days} days, `}
                  {result.video.duration.hours} hours, {result.video.duration.minutes} minutes, {result.video.duration.seconds} seconds
                  <span className="text-text-secondary ml-2">({result.video.duration.total_seconds} total seconds)</span>
                </p>
              </div>

              <div>
                <strong className="text-text-secondary">Upload Time:</strong>
                <p className="text-xs mt-1">{result.video.upload_time.formatted}</p>
                <p className="text-xs text-text-secondary">Upload Date: {result.video.upload_time.date}</p>
              </div>

              <div>
                <strong className="text-text-secondary">Thumbnail URL (Highest Quality):</strong>
                <p className="mt-1">
                  <a href={result.video.thumbnail} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all text-xs">
                    {result.video.thumbnail}
                  </a>
                </p>
              </div>

              <div>
                <strong className="text-text-secondary">Description:</strong>
                <p className="text-xs mt-1 whitespace-pre-wrap max-h-40 overflow-y-auto p-2 bg-background rounded">
                  {result.video.description || 'No description available'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoDetailsFetcher;
