import React, { useState, useEffect } from 'react';
import { X, Bell, Mail, Smartphone } from 'lucide-react';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: NotificationSettings) => void;
}

interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
  minMatchScore: number;
  opportunityTypes: string[];
  agencies: string[];
  contractValueMin: number | null;
  contractValueMax: number | null;
  keywords: string[];
}

const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [settings, setSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    pushNotifications: false,
    smsNotifications: false,
    frequency: 'daily',
    minMatchScore: 0.7,
    opportunityTypes: [],
    agencies: [],
    contractValueMin: null,
    contractValueMax: null,
    keywords: []
  });

  const [loading, setLoading] = useState(false);

  // Load existing settings when modal opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profiles/notification-settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Notification Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Notification Channels */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Notification Channels</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    emailNotifications: e.target.checked
                  }))}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <Mail className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">Email notifications</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.pushNotifications}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    pushNotifications: e.target.checked
                  }))}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <Bell className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">Push notifications</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.smsNotifications}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    smsNotifications: e.target.checked
                  }))}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <Smartphone className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">SMS notifications</span>
              </label>
            </div>
          </div>

          {/* Frequency */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Notification Frequency</h3>
            <select
              value={settings.frequency}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                frequency: e.target.value as 'immediate' | 'daily' | 'weekly'
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="immediate">Immediate</option>
              <option value="daily">Daily digest</option>
              <option value="weekly">Weekly summary</option>
            </select>
          </div>

          {/* Minimum Match Score */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Minimum Match Score: {Math.round(settings.minMatchScore * 100)}%
            </h3>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.minMatchScore}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                minMatchScore: parseFloat(e.target.value)
              }))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Opportunity Types */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Notify me about:</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.opportunityTypes.includes('perfectMatch')}
                  onChange={(e) => {
                    const types = settings.opportunityTypes;
                    if (e.target.checked) {
                      setSettings(prev => ({
                        ...prev,
                        opportunityTypes: [...types, 'perfectMatch']
                      }));
                    } else {
                      setSettings(prev => ({
                        ...prev,
                        opportunityTypes: types.filter(type => type !== 'perfectMatch')
                      }));
                    }
                  }}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Perfect matches (90%+ score)</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.opportunityTypes.includes('highValue')}
                  onChange={(e) => {
                    const types = settings.opportunityTypes;
                    if (e.target.checked) {
                      setSettings(prev => ({
                        ...prev,
                        opportunityTypes: [...types, 'highValue']
                      }));
                    } else {
                      setSettings(prev => ({
                        ...prev,
                        opportunityTypes: types.filter(type => type !== 'highValue')
                      }));
                    }
                  }}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">High-value contracts ($100k+)</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.opportunityTypes.includes('newOpportunities')}
                  onChange={(e) => {
                    const types = settings.opportunityTypes;
                    if (e.target.checked) {
                      setSettings(prev => ({
                        ...prev,
                        opportunityTypes: [...types, 'newOpportunities']
                      }));
                    } else {
                      setSettings(prev => ({
                        ...prev,
                        opportunityTypes: types.filter(type => type !== 'newOpportunities')
                      }));
                    }
                  }}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">New opportunities in my areas</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.opportunityTypes.includes('deadlineReminders')}
                  onChange={(e) => {
                    const types = settings.opportunityTypes;
                    if (e.target.checked) {
                      setSettings(prev => ({
                        ...prev,
                        opportunityTypes: [...types, 'deadlineReminders']
                      }));
                    } else {
                      setSettings(prev => ({
                        ...prev,
                        opportunityTypes: types.filter(type => type !== 'deadlineReminders')
                      }));
                    }
                  }}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Deadline reminders</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettingsModal;