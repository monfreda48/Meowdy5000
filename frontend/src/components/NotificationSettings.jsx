import { useState, useEffect } from 'react';
import { scheduleDailyReminder, cancelDailyReminder } from '../utils/notifications';

export default function NotificationSettings({ showNativeToast }) {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem('m5_reminder_enabled') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [reminderTime, setReminderTime] = useState(() => {
    try {
      return localStorage.getItem('m5_reminder_time') || '20:00';
    } catch (e) {
      return '20:00';
    }
  });

  const [loading, setLoading] = useState(false);
  const isNative = typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();

  const handleToggle = async (e) => {
    const newValue = e.target.checked;
    setEnabled(newValue);
    try {
      localStorage.setItem('m5_reminder_enabled', newValue ? 'true' : 'false');
    } catch (err) { }

    if (!isNative) {
      return;
    }

    setLoading(true);
    try {
      if (newValue) {
        await scheduleDailyReminder(reminderTime);
        if (showNativeToast) showNativeToast(`🔔 Daily reminder set for ${reminderTime}`);
      } else {
        await cancelDailyReminder();
        if (showNativeToast) showNativeToast('🔕 Daily reminder cancelled');
      }
    } catch (err) {
      console.error('Failed to update notification schedule:', err);
      setEnabled(false);
      try { localStorage.setItem('m5_reminder_enabled', 'false'); } catch (e) { }
      if (showNativeToast) showNativeToast(`⚠️ ${err.message || 'Permission denied'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeChange = async (e) => {
    const newTime = e.target.value;
    setReminderTime(newTime);
    try {
      localStorage.setItem('m5_reminder_time', newTime);
    } catch (err) { }

    if (enabled && isNative) {
      setLoading(true);
      try {
        await scheduleDailyReminder(newTime);
        if (showNativeToast) showNativeToast(`🔔 Reminder rescheduled for ${newTime}`);
      } catch (err) {
        console.error('Failed to reschedule notification:', err);
        if (showNativeToast) showNativeToast(`⚠️ ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="bg-[#131b2f] border border-slate-700/80 rounded-2xl p-4 space-y-3.5 text-left">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
            🔔
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Daily Check-in Reminders
            </h4>
            <p className="text-[10px] text-slate-400">Scheduled local push notifications</p>
          </div>
        </div>

        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
          enabled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
        }`}>
          {enabled ? 'Active' : 'Disabled'}
        </span>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">
        Receive a local reminder to check your stats, track rank progress, and log daily games.
      </p>

      {/* Control Actions */}
      <div className="space-y-3 bg-[#0b101e] border border-slate-800 p-3 rounded-xl">
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs font-bold text-white flex items-center gap-2 cursor-pointer select-none">
            <span>{enabled ? '🔔' : '🔕'}</span>
            <span>Enable Daily Reminder</span>
          </label>

          <input
            type="checkbox"
            checked={enabled}
            disabled={loading}
            onChange={handleToggle}
            className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-900 cursor-pointer accent-emerald-500 shrink-0"
          />
        </div>

        {enabled && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 animate-in fade-in">
            <span className="text-xs text-slate-400 font-medium">Scheduled Time:</span>
            <input
              type="time"
              value={reminderTime}
              disabled={loading}
              onChange={handleTimeChange}
              className="bg-[#131b2f] border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Web Fallback Warning Note */}
      {!isNative && (
        <div className="p-2.5 bg-slate-800/40 border border-slate-700/60 rounded-xl text-[11px] text-slate-400 flex items-center gap-2">
          <span>📱</span>
          <span>Push reminders are available in the Android APK version.</span>
        </div>
      )}
    </div>
  );
}
