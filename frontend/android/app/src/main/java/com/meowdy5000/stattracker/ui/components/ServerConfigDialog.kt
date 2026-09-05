package com.meowdy5000.stattracker.ui.components

import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.meowdy5000.stattracker.data.network.DynamicHostInterceptor

@Composable
fun ServerConfigDialog(
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("server_prefs", Context.MODE_PRIVATE) }
    var inputUrl by remember {
        mutableStateOf(prefs.getString(DynamicHostInterceptor.KEY_CUSTOM_URL, "") ?: "")
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Server & Port Configuration") },
        text = {
            Column {
                Text(
                    text = "Specify a custom host URL (defaults to production backend https://monfreda48.synology.me):",
                    style = MaterialTheme.typography.bodySmall
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = inputUrl,
                    onValueChange = { inputUrl = it },
                    label = { Text("Backend URL") },
                    placeholder = { Text("e.g. https://monfreda48.synology.me") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    prefs.edit().putString(DynamicHostInterceptor.KEY_CUSTOM_URL, inputUrl.trim()).apply()
                    onDismiss()
                }
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(
                onClick = {
                    prefs.edit().remove(DynamicHostInterceptor.KEY_CUSTOM_URL).apply()
                    onDismiss()
                }
            ) {
                Text("Reset to Auto")
            }
        }
    )
}
