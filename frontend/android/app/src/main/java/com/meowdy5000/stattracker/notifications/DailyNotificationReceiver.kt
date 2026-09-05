package com.meowdy5000.stattracker.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.meowdy5000.stattracker.MainActivity

class DailyNotificationReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        Log.i(TAG, "DailyNotificationReceiver received intent: ${intent.action}")

        val channelId = "daily_reminder_channel"
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Daily Reminders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Daily statistics tracking reminders"
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val mainIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            mainIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Time to check your stats!")
            .setContentText("Log in to track your matches and update your rankings.")
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(1001, notification)
        Log.i(TAG, "Notification displayed successfully.")

        // Reschedule alarm for subsequent day
        val hour = DailyScheduler.getSavedHour(context)
        val minute = DailyScheduler.getSavedMinute(context)
        if (DailyScheduler.isReminderEnabled(context)) {
            DailyScheduler.scheduleDaily(context, hour, minute)
        }
    }

    companion object {
        private const val TAG = "DailyNotificationReceiver"
    }
}
