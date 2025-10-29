import React, { useState, useEffect } from 'react';
import ClipboardIcon from './icons/ClipboardIcon';
import CheckIcon from './icons/CheckIcon';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

interface ApiKey {
  id: number;
  name: string | null;
  key: string;
  createdAt: string;
  rateLimit?: number;
  maxRequests?: number | null;
  warning?: string;
}

const ApiKeyManager: React.FC = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<ApiKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [keyName, setKeyName] = useState('');
  const [rateLimit, setRateLimit] = useState('60');
  const [maxRequests, setMaxRequests] = useState('');
  const [adminKey, setAdminKey] = useState(localStorage.getItem('adminApiKey') || '');
  const [showAdminKeyInput, setShowAdminKeyInput] = useState(false);
  const [copied, copyToClipboard] = useCopyToClipboard();

  useEffect(() => {
    if (adminKey) {
      fetchKeys();
    }
  }, [adminKey]);

  const fetchKeys = async () => {
    if (!adminKey) {
      setMessage('Please set your admin API key first');
      return;
    }

    try {
      const res = await fetch('/v1/keys', {
        headers: {
          'Authorization': `Bearer ${adminKey}`
        }
      });
      
      if (res.status === 401 || res.status === 403) {
        setMessage('Invalid admin API key. Please update it.');
        setShowAdminKeyInput(true);
        return;
      }
      
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (error) {
      console.error('Error fetching keys:', error);
      setMessage('Failed to fetch API keys. Check your admin key.');
    }
  };

  const generateKey = async () => {
    if (!adminKey) {
      setMessage('Please set your admin API key first');
      setShowAdminKeyInput(true);
      return;
    }

    setLoading(true);
    setMessage('');
    
    try {
      const res = await fetch('/v1/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminKey}`
        },
        body: JSON.stringify({
          name: keyName || null,
          rateLimit: rateLimit ? parseInt(rateLimit) : 60,
          maxRequests: maxRequests ? parseInt(maxRequests) : null
        })
      });

      if (res.status === 401 || res.status === 403) {
        setMessage('Invalid admin API key. Cannot create new keys.');
        setShowAdminKeyInput(true);
        return;
      }

      const data = await res.json();
      
      if (data.key) {
        setNewKey(data);
        setMessage('API key generated successfully! Save it securely - it will not be shown again.');
        setKeyName('');
        setRateLimit('60');
        setMaxRequests('');
        await fetchKeys();
      } else {
        setMessage(data.error || 'Failed to generate API key');
      }
    } catch (error) {
      setMessage('Error generating API key');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const bootstrapFirstKey = async () => {
    setLoading(true);
    setMessage('Creating bootstrap admin key...');
    
    try {
      const res = await fetch('/v1/keys/bootstrap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Bootstrap Admin Key'
        })
      });

      const data = await res.json();
      
      if (data.key) {
        setNewKey(data);
        setAdminKey(data.key);
        localStorage.setItem('adminApiKey', data.key);
        setMessage('Bootstrap admin key created! This key has been saved. Use it to create more keys.');
        setShowAdminKeyInput(false);
      } else {
        setMessage(data.error || 'Failed to create bootstrap key');
      }
    } catch (error) {
      setMessage('Error creating bootstrap key');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const saveAdminKey = () => {
    if (adminKey) {
      localStorage.setItem('adminApiKey', adminKey);
      setShowAdminKeyInput(false);
      fetchKeys();
      setMessage('Admin key saved successfully');
    }
  };

  const clearAdminKey = () => {
    setAdminKey('');
    localStorage.removeItem('adminApiKey');
    setKeys([]);
    setShowAdminKeyInput(true);
    setMessage('Admin key cleared');
  };

  const deleteAllKeys = async () => {
    if (!confirm('⚠️ WARNING: This will delete ALL API keys from the database! This action cannot be undone. Are you absolutely sure?')) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/v1/keys/all', {
        method: 'DELETE'
      });

      const data = await res.json();

      if (data.success) {
        setMessage('All API keys deleted successfully. You can now create a new bootstrap key.');
        setKeys([]);
        setAdminKey('');
        localStorage.removeItem('adminApiKey');
        setShowAdminKeyInput(false);
      } else {
        setMessage(data.error || 'Failed to delete all API keys');
      }
    } catch (error) {
      setMessage('Error deleting all API keys');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-lg p-6 shadow-md">
        <h2 className="text-2xl font-bold text-text-primary mb-4">API Key Management</h2>
        
        {!adminKey && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-4">
            <p className="font-semibold">No Admin Key Set</p>
            <p className="text-sm mt-1">
              To get started, create a bootstrap admin key. This can only be done once when no keys exist.
            </p>
            <div className="mt-3 space-x-2">
              <button
                onClick={bootstrapFirstKey}
                disabled={loading}
                className="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90 disabled:opacity-50"
              >
                Create Bootstrap Admin Key
              </button>
            </div>
          </div>
        )}
        
        {/* Delete All Keys button - always available */}
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4">
          <p className="font-semibold">⚠️ Danger Zone</p>
          <p className="text-sm mt-1">
            Delete all API keys from the database and start completely fresh.
          </p>
          <button
            onClick={deleteAllKeys}
            disabled={loading}
            className="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
          >
            Delete All Keys & Start Fresh
          </button>
        </div>
        
        {adminKey && !showAdminKeyInput && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded mb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold">Admin Key Active</p>
                <p className="text-sm mt-1">Key: {adminKey.substring(0, 20)}...</p>
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => setShowAdminKeyInput(true)}
                  className="text-sm text-green-700 hover:underline"
                >
                  Change
                </button>
                <button
                  onClick={clearAdminKey}
                  className="text-sm text-red-600 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
        
        {showAdminKeyInput && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded mb-4">
            <label className="block text-sm font-medium text-text-primary mb-2">
              Admin API Key
            </label>
            <input
              type="text"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Enter your admin API key"
              className="w-full border border-border rounded px-3 py-2 mb-2"
            />
            <div className="flex space-x-2">
              <button
                onClick={saveAdminKey}
                className="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90"
              >
                Save Admin Key
              </button>
              {adminKey && (
                <button
                  onClick={() => setShowAdminKeyInput(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-opacity-90"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
        
        {message && (
          <div className={`px-4 py-3 rounded mb-4 ${
            message.includes('Error') || message.includes('Failed') || message.includes('Invalid')
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-green-50 border border-green-200 text-green-800'
          }`}>
            {message}
          </div>
        )}

        {newKey && (
          <div className="bg-yellow-50 border border-yellow-300 p-4 rounded mb-4">
            <p className="font-semibold text-yellow-800 mb-2">⚠️ Save This Key Securely!</p>
            <div className="flex items-center space-x-2 mb-2">
              <code className="flex-1 bg-white px-3 py-2 rounded border border-yellow-200 text-sm break-all">
                {newKey.key}
              </code>
              <button
                onClick={() => copyToClipboard(newKey.key || '')}
                className="bg-primary text-white p-2 rounded hover:bg-opacity-90"
                title="Copy to clipboard"
              >
                {copied ? <CheckIcon /> : <ClipboardIcon />}
              </button>
            </div>
            <p className="text-sm text-yellow-700">
              {newKey.warning || 'This key will not be shown again. Store it in a secure location.'}
            </p>
            <button
              onClick={() => setNewKey(null)}
              className="mt-2 text-sm text-yellow-800 hover:underline"
            >
              I've saved this key securely
            </button>
          </div>
        )}

        {adminKey && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Key Name (Optional)
                </label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g., Production API"
                  className="w-full border border-border rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Rate Limit (req/min)
                </label>
                <input
                  type="number"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  placeholder="60"
                  className="w-full border border-border rounded px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Max Requests (Optional)
                </label>
                <input
                  type="number"
                  value={maxRequests}
                  onChange={(e) => setMaxRequests(e.target.value)}
                  placeholder="Unlimited"
                  className="w-full border border-border rounded px-3 py-2"
                />
              </div>
            </div>

            <button
              onClick={generateKey}
              disabled={loading}
              className="w-full bg-primary text-white py-3 rounded-md font-semibold hover:bg-opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate New API Key'}
            </button>
          </div>
        )}

        {adminKey && keys.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-text-primary mb-3">
              Existing API Keys ({keys.length})
            </h3>
            <div className="space-y-2">
              {keys.map((key) => (
                <div key={key.id} className="bg-background p-3 rounded border border-border">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-text-primary">
                        {key.name || `Key #${key.id}`}
                      </p>
                      <p className="text-sm text-text-secondary mt-1">
                        Created: {new Date(key.createdAt).toLocaleString()}
                      </p>
                      {key.rateLimit && (
                        <p className="text-xs text-text-secondary mt-1">
                          Rate Limit: {key.rateLimit}/min
                          {key.maxRequests && ` • Max: ${key.maxRequests} requests`}
                        </p>
                      )}
                    </div>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      ID: {key.id}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiKeyManager;
