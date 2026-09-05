package com.meowdy5000.stattracker.ui.components

import android.Manifest
import android.app.TimePickerDialog
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import com.meowdy5000.stattracker.notifications.DailyScheduler

@Composable
fun NotificationTimePickerDialog(
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    var showDeniedDialog by remember { mutableStateOf(false) }

    fun launchTimePicker() {
        val currentHour = DailyScheduler.getSavedHour(context)
        val currentMinute = DailyScheduler.getSavedMinute(context)

        val timePickerDialog = TimePickerDialog(
            context,
            { _, hourOfDay, minute ->
                DailyScheduler.scheduleDaily(context, hourOfDay, minute)
                onDismiss()
            },
            currentHour,
            currentMinute,
            false
        )
        timePickerDialog.show()
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            launchTimePicker()
        } else {
            showDeniedDialog = true
        }
    }

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            launchTimePicker()
        }
    }

    if (showDeniedDialog) {
        AlertDialog(
            onDismissRequest = {
                showDeniedDialog = false
                onDismiss()
            },
            title = { Text("Notification Permission Required") },
            text = { Text("Notification permissions are required to receive daily stat reminders. Please enable them in app settings.") },
            confirmButton = {
                TextButton(onClick = {
                    showDeniedDialog = false
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", context.packageName, null)
                    }
                    context.startActivity(intent)
                    onDismiss()
                }) {
                    Text("Settings")
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    showDeniedDialog = false
                    onDismiss()
                }) {
                    Text("Cancel")
                }
            }
        )
    }
}
