package com.meowdy5000.stattracker.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.i(TAG, "BootReceiver: Device boot completed. Reinstating daily alarm if enabled.")
            if (DailyScheduler.isReminderEnabled(context)) {
                val hour = DailyScheduler.getSavedHour(context)
                val minute = DailyScheduler.getSavedMinute(context)
                DailyScheduler.scheduleDaily(context, hour, minute)
                Log.i(TAG, "Re-scheduled daily reminder alarm for $hour:$minute after boot.")
            }
        }
    }

    companion object {
        private const val TAG = "BootReceiver"
    }
}
