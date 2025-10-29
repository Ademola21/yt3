
import React, { useState } from 'react';

interface VideoDuration {
  total_seconds: number;
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
  formatted: string;
}

interface UploadTime {
  date: string;
  timestamp: number;
  formatted: string;
}

interface ChannelVideo {
  id: string;
  title: string;
  description: string;
  url: string;
  duration: VideoDuration;
  upload_time: UploadTime;
  thumbnail: string;
  view_count: number;
  like_count: number;
}

interface ChannelVideosResponse {
  channel_url: string;
  total_videos_found: number;
  total_matching_criteria: number;
  videos_returned: number;
  offset: number;
  limit: number;
  has_more: boolean;
  videos: ChannelVideo[];
}

const ChannelVideosFetcher: React.FC = () => {
  const [channelUrl, setChannelUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChannelVideosResponse | null>(null);
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(100);
  const [currentOffset, setCurrentOffset] = useState(0);

  const isValidUrl = (urlString: string) => {
    try {
      new URL(urlString);
      return urlString.includes('youtube.com') || urlString.includes('youtu.be');
    } catch (_) {
      return false;
    }
  };

  const fetchVideos = async (offset: number = 0) => {
    setError(null);
    if (offset === 0) {
      setResult(null);
      setCurrentOffset(0);
    }

    if (!apiKey.trim()) {
      setError('Please provide an API Key.');
      return;
    }

    if (!channelUrl || !isValidUrl(channelUrl)) {
      setError('Please enter a valid YouTube channel URL.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/v1/channel/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ 
          channelUrl,
          limit: batchSize,
          offset: offset
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      
      // If this is a "load more" operation, append to existing results
      if (offset > 0 && result) {
        setResult({
          ...data,
          videos: [...result.videos, ...data.videos]
        });
      } else {
        setResult(data);
      }
      
      setCurrentOffset(offset);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVideos(0);
  };

  const handleLoadMore = () => {
    if (result) {
      fetchVideos(currentOffset + batchSize);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const toggleVideoDetails = (videoId: string) => {
    setExpandedVideo(expandedVideo === videoId ? null : videoId);
  };

  return (
    <div className="p-6 bg-surface/50 rounded-xl border border-border">
      <h2 className="text-2xl font-bold text-text-primary mb-1">Channel Videos Fetcher</h2>
      <p className="text-text-secondary mb-6">
        Fetch all videos from a YouTube channel (50+ minutes only)
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
          <label htmlFor="channelUrl" className="block text-sm font-medium text-text-secondary mb-1">
            Channel URL
          </label>
          <input
            id="channelUrl"
            type="text"
            value={channelUrl}
            onChange={(e) => setChannelUrl(e.target.value)}
            placeholder="https://www.youtube.com/@channelname or https://www.youtube.com/c/channelname"
            className="w-full bg-surface border border-border rounded-md px-4 py-2 text-text-primary focus:ring-2 focus:ring-primary focus:outline-none transition-shadow"
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="batchSize" className="block text-sm font-medium text-text-secondary mb-1">
            Videos per batch (max 1000)
          </label>
          <input
            id="batchSize"
            type="number"
            min="10"
            max="1000"
            value={batchSize}
            onChange={(e) => setBatchSize(Math.min(1000, Math.max(10, parseInt(e.target.value) || 100)))}
            className="w-full bg-surface border border-border rounded-md px-4 py-2 text-text-primary focus:ring-2 focus:ring-primary focus:outline-none transition-shadow"
            disabled={isLoading}
          />
          <p className="text-xs text-text-secondary mt-1">
            For large channels (5000+ videos), use smaller batches (50-100) to see results faster
          </p>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={isLoading || !channelUrl || !apiKey}
          className="w-full bg-primary hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-md transition-all duration-200 ease-in-out disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Fetching Videos...
            </>
          ) : (
            'Fetch Channel Videos'
          )}
        </button>
      </form>

      {result && (
        <div className="mt-6 space-y-4">
          <div className="p-4 bg-surface rounded-lg border border-border">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Channel Summary</h3>
            <div className="space-y-1 text-sm">
              <p className="text-text-secondary">
                <strong>Total videos found:</strong> {result.total_videos_found}
              </p>
              <p className="text-text-secondary">
                <strong>Videos ≥ 50 minutes:</strong> {result.total_matching_criteria}
              </p>
              <p className="text-text-secondary">
                <strong>Currently showing:</strong> {result.videos.length} videos
              </p>
              {result.has_more && (
                <p className="text-primary text-xs mt-2">
                  More videos available - click "Load More" below
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="max-h-[600px] overflow-y-auto space-y-3">
            {result.videos.map((video) => (
              <div key={video.id} className="p-4 bg-surface rounded-lg border border-border hover:border-primary/50 transition-colors">
                <div className="flex gap-4">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-40 h-24 object-cover rounded flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-text-primary font-semibold mb-1 truncate">{video.title}</h4>
                    <div className="flex gap-4 text-xs text-text-secondary mb-2">
                      <span>⏱️ {video.duration.formatted}</span>
                      <span>👁️ {formatNumber(video.view_count)}</span>
                      <span>👍 {formatNumber(video.like_count)}</span>
                    </div>
                    <p className="text-xs text-text-secondary mb-2">
                      Uploaded: {new Date(video.upload_time.timestamp * 1000).toLocaleDateString()}
                    </p>
                    <button
                      onClick={() => toggleVideoDetails(video.id)}
                      className="text-xs text-primary hover:text-indigo-400 underline"
                    >
                      {expandedVideo === video.id ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>
                </div>

                {expandedVideo === video.id && (
                  <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
                    <div>
                      <strong className="text-text-secondary">Video ID:</strong>
                      <p className="font-mono text-xs mt-1">{video.id}</p>
                    </div>
                    <div>
                      <strong className="text-text-secondary">URL:</strong>
                      <p className="mt-1">
                        <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                          {video.url}
                        </a>
                      </p>
                    </div>
                    <div>
                      <strong className="text-text-secondary">Duration Breakdown:</strong>
                      <p className="text-xs mt-1">
                        {video.duration.days > 0 && `${video.duration.days} days, `}
                        {video.duration.hours} hours, {video.duration.minutes} minutes, {video.duration.seconds} seconds
                        <span className="text-text-secondary ml-2">({video.duration.total_seconds} total seconds)</span>
                      </p>
                    </div>
                    <div>
                      <strong className="text-text-secondary">Upload Time:</strong>
                      <p className="text-xs mt-1">{video.upload_time.formatted}</p>
                    </div>
                    <div>
                      <strong className="text-text-secondary">Thumbnail URL:</strong>
                      <p className="font-mono text-xs mt-1 break-all">{video.thumbnail}</p>
                    </div>
                    <div>
                      <strong className="text-text-secondary">Description:</strong>
                      <p className="text-xs mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {video.description || 'No description available'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
            </div>
            
            {result.has_more && (
              <button
                onClick={handleLoadMore}
                disabled={isLoading}
                className="w-full bg-secondary hover:bg-green-600 text-white font-bold py-3 px-6 rounded-md transition-all duration-200 ease-in-out disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading More...
                  </>
                ) : (
                  `Load More Videos (${result.total_matching_criteria - result.videos.length} remaining)`
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChannelVideosFetcher;
