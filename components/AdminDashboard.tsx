import React, { useState, useEffect } from 'react';

interface ApiKey {
  id: number;
  name: string | null;
  status: string;
  rateLimit: number;
  maxRequests: number | null;
  totalRequests: number;
  lastUsedAt: string | null;
  createdAt: string;
}

interface SystemInfo {
  ytdlp: {
    version: string;
    updatesAvailable: boolean;
  };
  nodeVersion: string;
  platform: string;
  uptime: number;
  downloads: {
    activeDownloads: number;
    queuedDownloads: number;
    maxConcurrent: number;
  };
}

const AdminDashboard: React.FC = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  const [keyStats, setKeyStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchKeys();
    fetchSystemInfo();
    const interval = setInterval(fetchSystemInfo, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedKeyId) {
      fetchKeyStats(selectedKeyId);
    }
  }, [selectedKeyId]);

  const fetchKeys = async () => {
    const adminKey = localStorage.getItem('adminApiKey');
    if (!adminKey) return;

    try {
      const res = await fetch('/v1/keys', {
        headers: { 'Authorization': `Bearer ${adminKey}` }
      });
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (error) {
      console.error('Error fetching keys:', error);
    }
  };

  const fetchSystemInfo = async () => {
    const adminKey = localStorage.getItem('adminApiKey');
    if (!adminKey) return;

    try {
      const res = await fetch('/v1/system/info', {
        headers: { 'Authorization': `Bearer ${adminKey}` }
      });
      const data = await res.json();
      setSystemInfo(data);
    } catch (error) {
      console.error('Error fetching system info:', error);
    }
  };

  const fetchKeyStats = async (keyId: number) => {
    const adminKey = localStorage.getItem('adminApiKey');
    if (!adminKey) return;

    try {
      const res = await fetch(`/v1/keys/${keyId}/stats`, {
        headers: { 'Authorization': `Bearer ${adminKey}` }
      });
      const data = await res.json();
      setKeyStats(data);
    } catch (error) {
      console.error('Error fetching key stats:', error);
    }
  };

  const deleteKey = async (keyId: number) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    const adminKey = localStorage.getItem('adminApiKey');
    if (!adminKey) {
      setMessage('No admin API key found. Please set it first.');
      return;
    }

    try {
      const res = await fetch(`/v1/keys/${keyId}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminKey}` }
      });
      
      if (res.status === 401 || res.status === 403) {
        setMessage('Invalid admin API key. Cannot delete key.');
        return;
      }

      const data = await res.json();
      
      if (data.success) {
        setMessage('API key deleted successfully');
        fetchKeys();
        if (selectedKeyId === keyId) {
          setSelectedKeyId(null);
          setKeyStats(null);
        }
      } else {
        setMessage('Failed to delete API key');
      }
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Error deleting API key');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const updateYtDlp = async () => {
    const adminKey = localStorage.getItem('adminApiKey');
    if (!adminKey) {
      setMessage('No admin API key found. Please set it first.');
      return;
    }

    setLoading(true);
    setMessage('Updating yt-dlp... This may take a minute.');
    
    try {
      const res = await fetch('/v1/system/update/ytdlp', { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminKey}` }
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage(`yt-dlp updated successfully to version ${data.version}`);
        fetchSystemInfo();
      } else {
        setMessage(`Failed to update yt-dlp: ${data.error}`);
      }
    } catch (error) {
      setMessage('Error updating yt-dlp');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-8">
      <div className="bg-surface rounded-lg p-6 shadow-md">
        <h2 className="text-2xl font-bold text-text-primary mb-4">System Health</h2>
        
        {systemInfo && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-background p-4 rounded">
              <div className="text-sm text-text-secondary mb-1">System Uptime</div>
              <div className="text-2xl font-bold text-text-primary">
                {formatUptime(systemInfo.uptime)}
              </div>
            </div>
            
            <div className="bg-background p-4 rounded">
              <div className="text-sm text-text-secondary mb-1">Active Downloads</div>
              <div className="text-2xl font-bold text-primary">
                {systemInfo.downloads.activeDownloads} / {systemInfo.downloads.maxConcurrent}
              </div>
              <div className="text-xs text-text-secondary mt-1">
                Configure via MAX_CONCURRENT_DOWNLOADS env var
              </div>
            </div>
            
            <div className="bg-background p-4 rounded">
              <div className="text-sm text-text-secondary mb-1">Queued Downloads</div>
              <div className="text-2xl font-bold text-text-primary">
                {systemInfo.downloads.queuedDownloads}
              </div>
            </div>
            
            <div className="bg-background p-4 rounded">
              <div className="text-sm text-text-secondary mb-1">yt-dlp Version</div>
              <div className="text-lg font-semibold text-text-primary">
                {systemInfo.ytdlp.version}
              </div>
              <button
                onClick={updateYtDlp}
                disabled={loading}
                className="mt-2 px-3 py-1 bg-primary text-white text-sm rounded hover:bg-opacity-90 disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update'}
              </button>
            </div>
            
            <div className="bg-background p-4 rounded">
              <div className="text-sm text-text-secondary mb-1">Node.js Version</div>
              <div className="text-lg font-semibold text-text-primary">
                {systemInfo.nodeVersion}
              </div>
            </div>
            
            <div className="bg-background p-4 rounded">
              <div className="text-sm text-text-secondary mb-1">Platform</div>
              <div className="text-lg font-semibold text-text-primary capitalize">
                {systemInfo.platform}
              </div>
            </div>
          </div>
        )}
      </div>

      {message && (
        <div className="bg-primary bg-opacity-10 border border-primary text-text-primary px-4 py-3 rounded">
          {message}
        </div>
      )}

      <div className="bg-surface rounded-lg p-6 shadow-md">
        <h2 className="text-2xl font-bold text-text-primary mb-4">API Key Management</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-background">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Requests</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Rate Limit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Last Used</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {keys.map((key) => (
                <tr key={key.id} className="hover:bg-background cursor-pointer" onClick={() => setSelectedKeyId(key.id)}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">{key.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                    {key.name || <span className="text-text-secondary italic">Unnamed</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      key.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {key.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                    {key.totalRequests} {key.maxRequests ? `/ ${key.maxRequests}` : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                    {key.rateLimit}/min
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                    {formatDate(key.lastUsedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteKey(key.id);
                      }}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedKeyId && keyStats && (
        <div className="bg-surface rounded-lg p-6 shadow-md">
          <h3 className="text-xl font-bold text-text-primary mb-4">
            API Key Statistics (ID: {selectedKeyId})
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-text-primary mb-2">Endpoint Usage</h4>
              <div className="space-y-2">
                {Object.entries(keyStats.endpointBreakdown || {}).map(([endpoint, count]) => (
                  <div key={endpoint} className="flex justify-between items-center bg-background p-2 rounded">
                    <span className="text-sm text-text-secondary">{endpoint}</span>
                    <span className="font-semibold text-text-primary">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-text-primary mb-2">Recent Requests</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(keyStats.recentRequests || []).slice(0, 10).map((req: any, idx: number) => (
                  <div key={idx} className="bg-background p-2 rounded text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">{req.method} {req.endpoint}</span>
                      <span className={req.statusCode < 400 ? 'text-green-600' : 'text-red-600'}>
                        {req.statusCode}
                      </span>
                    </div>
                    <div className="text-text-secondary mt-1">
                      {formatDate(req.timestamp)} • {req.responseTime}ms
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
