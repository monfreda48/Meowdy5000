package com.meowdy5000.stattracker.ui.dashboard

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Close

import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Warning
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.meowdy5000.stattracker.data.LocalSnapshotManager
import com.meowdy5000.stattracker.data.NetworkModule

import com.meowdy5000.stattracker.notifications.DailyScheduler
import com.meowdy5000.stattracker.storage.ApkUpdateManager
import com.meowdy5000.stattracker.storage.PersistentSafStorageManager
import com.meowdy5000.stattracker.ui.components.ExpandableStatCard
import com.meowdy5000.stattracker.ui.components.NotificationTimePickerDialog
import com.meowdy5000.stattracker.ui.theme.AppThemeOption
import com.meowdy5000.stattracker.ui.theme.ThemeViewModel
import com.meowdy5000.stattracker.updater.AppUpdateManager
import com.meowdy5000.stattracker.updater.UpdateStatus
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.json.JSONArray


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    themeViewModel: ThemeViewModel
) {
    val context = LocalContext.current
    val snapshotManager = remember { LocalSnapshotManager(context) }
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    val currentTheme by themeViewModel.selectedTheme.collectAsState()
    var themeDropdownExpanded by remember { mutableStateOf(false) }

    val updateManager = remember { AppUpdateManager(context) }
    val updateStatus by updateManager.status.collectAsState()



    var searchQuery by remember { mutableStateOf("Meowdy 5000") }
    var loadedDataJson by remember { mutableStateOf<String?>(null) }
    var isClaimed by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    var isReminderEnabled by remember { mutableStateOf(DailyScheduler.isReminderEnabled(context)) }

    // Settings & Options State
    var autoSnapshotEnabled by remember { mutableStateOf(true) }
    var selectedFavoriteSite by remember { mutableStateOf("merged") }
    var showIssueReportDialog by remember { mutableStateOf(false) }
    var issueNotes by remember { mutableStateOf("") }
    var issueReportSuccess by remember { mutableStateOf(false) }
    var showCheckUpdateDialog by remember { mutableStateOf(false) }
    var isCheckingUpdate by remember { mutableStateOf(false) }
    var updateInfoText by remember { mutableStateOf("") }
    var showDonateDialog by remember { mutableStateOf(false) }
    var showClaimDialog by remember { mutableStateOf(false) }
    var claimInputUrl by remember { mutableStateOf("") }

    val rootJson = remember(loadedDataJson) {
        if (loadedDataJson != null) {
            try { JSONObject(loadedDataJson!!) } catch (e: Exception) { JSONObject() }
        } else null
    }

    fun generateAndroidFallbackProfile(username: String): String {
        val clean = username.trim()

        val rankObj = JSONObject().apply {
            put("tier_name", "Unranked")
            put("rank_score", 0)
            put("leaderboard_percentile", "N/A")
        }

        return JSONObject().apply {
            put("player_name", clean)
            put("is_fallback", true)
            put("notice", "No live stats found for '$clean'. Enter your direct Tracker.gg URL or player tag (e.g. Meowdy 5000#1234) and tap 'Claim Profile'.")
            put("error", "Live statistics could not be fetched automatically. Please enter your direct Tracker.gg URL or full player tag.")
            put("rank", rankObj)
            put("heroes", JSONArray())
        }.toString()
    }

    val performSearch: (String) -> Unit = { queryText ->
        val targetName = queryText.ifBlank { "Meowdy 5000" }.trim()
        searchQuery = targetName
        Log.e("DashboardSearch", "Initiating search for targetName='$targetName'")
        scope.launch {
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                try {
                    val urlStr = NetworkModule.getSearchUrl()
                    val conn = NetworkModule.createConnection(urlStr)
                    conn.requestMethod = "POST"
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.doOutput = true

                    val jsonPayload = JSONObject().apply {
                        put("username", targetName)
                    }.toString()

                    conn.outputStream.use { os ->
                        os.write(jsonPayload.toByteArray(Charsets.UTF_8))
                    }

                    val code = conn.responseCode
                    if (code == 200) {
                        val responseText = conn.inputStream.bufferedReader().use { it.readText() }
                        val root = JSONObject(responseText)
                        val dataObj = root.optJSONObject("data")
                        val resJson = dataObj?.toString() ?: responseText
                        val checkRoot = try { JSONObject(resJson) } catch (e: Exception) { null }
                        val hasError = checkRoot?.optString("error", "")?.isNotBlank() == true
                        val isFallback = checkRoot?.optBoolean("is_fallback", false) == true
                        val overviewObj = checkRoot?.optJSONObject("overview")
                        val winRateStr = overviewObj?.optString("win_rate", "") ?: ""
                        val hasOverviewData = overviewObj != null && overviewObj.length() > 0 && winRateStr != "N/A" && !isFallback

                        if (checkRoot != null && !hasError && hasOverviewData) {
                            snapshotManager.saveScrapedData(resJson, targetName, "19")
                            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                                loadedDataJson = resJson
                            }
                        } else {
                            val fb = generateAndroidFallbackProfile(targetName)
                            snapshotManager.saveScrapedData(fb, targetName, "19")
                            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                                loadedDataJson = fb
                            }
                        }
                    } else {
                        val fb = generateAndroidFallbackProfile(targetName)
                        snapshotManager.saveScrapedData(fb, targetName, "19")
                        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                            loadedDataJson = fb
                        }
                    }
                } catch (e: Exception) {
                    val fb = generateAndroidFallbackProfile(targetName)
                    snapshotManager.saveScrapedData(fb, targetName, "19")
                    kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                        loadedDataJson = fb
                    }
                }
            }
        }
    }

    // Instant offline loading on launch (or automatic initial search)
    LaunchedEffect(Unit) {
        val cached = snapshotManager.loadLatestProfile()
        if (cached != null) {
            val root = try { JSONObject(cached) } catch (e: Exception) { null }
            val hasError = root?.optString("error", "")?.isNotBlank() == true
            val isFallback = root?.optBoolean("is_fallback", false) == true
            val overviewObj = root?.optJSONObject("overview")
            val winRateStr = overviewObj?.optString("win_rate", "") ?: ""
            val rankObj = root?.optJSONObject("rank")
            val tierName = rankObj?.optString("tier_name", "") ?: ""
            val hasValidData = overviewObj != null && overviewObj.length() > 0 && winRateStr != "N/A" && tierName != "Unranked" && !isFallback
            if (root != null && !hasError && hasValidData) {
                loadedDataJson = cached
            } else {
                snapshotManager.clearCache()
                performSearch("Meowdy 5000")
            }
        } else {
            performSearch("Meowdy 5000")
        }
    }

    if (showTimePicker) {
        NotificationTimePickerDialog(onDismiss = {
            showTimePicker = false
            isReminderEnabled = DailyScheduler.isReminderEnabled(context)
        })
    }

    // Issue Reporting Dialog
    if (showIssueReportDialog) {
        AlertDialog(
            onDismissRequest = { showIssueReportDialog = false },
            title = { Text("🛠️ Report an Issue / Bug", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text("Describe any bug or stat inaccuracy to notify developers:", style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = issueNotes,
                        onValueChange = { issueNotes = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Details or steps to reproduce...") },
                        maxLines = 4
                    )
                    if (issueReportSuccess) {
                        Spacer(Modifier.height(8.dp))
                        Text("✅ Report submitted successfully!", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                    }
                }
            },
            confirmButton = {
                Button(onClick = {
                    if (issueNotes.isNotBlank()) {
                        scope.launch {
                            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                                try {
                                    val url = java.net.URL("http://10.0.2.2:8000/api/report-error")
                                    val conn = url.openConnection() as java.net.HttpURLConnection
                                    conn.requestMethod = "POST"
                                    conn.setRequestProperty("Content-Type", "application/json")
                                    conn.doOutput = true
                                    val payload = JSONObject().apply {
                                        put("error", "User Bug Report: ${issueNotes.trim()}")
                                        put("platform", "Android Native App")
                                    }.toString()
                                    conn.outputStream.use { os -> os.write(payload.toByteArray(Charsets.UTF_8)) }
                                    conn.responseCode
                                } catch (e: Exception) { }
                            }
                        }
                        issueReportSuccess = true
                        issueNotes = ""
                    }
                }) {
                    Text("Submit Report")
                }
            },
            dismissButton = {
                TextButton(onClick = { showIssueReportDialog = false; issueReportSuccess = false }) {
                    Text("Close")
                }
            }
        )
    }

    // Check Updates Dialog
    if (showCheckUpdateDialog) {
        AlertDialog(
            onDismissRequest = { showCheckUpdateDialog = false },
            title = { Text("⚡ App Updates & Release Check", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text("Current Installed Version: v${com.meowdy5000.stattracker.BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(8.dp))
                    if (isCheckingUpdate) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                            Text("Checking GitHub for latest APK release...")
                        }
                    } else {
                        Text(
                            text = updateInfoText.ifBlank { "App is up to date! Build v${com.meowdy5000.stattracker.BuildConfig.VERSION_NAME} is the latest release." },
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            },
            confirmButton = {
                Button(onClick = {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/monfreda48/Meowdy5000/releases"))
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                }) {
                    Text("View GitHub Releases")
                }
            },
            dismissButton = {
                TextButton(onClick = { showCheckUpdateDialog = false }) {
                    Text("Close")
                }
            }
        )
    }

    // Support PayPal Donation Dialog
    if (showDonateDialog) {
        AlertDialog(
            onDismissRequest = { showDonateDialog = false },
            title = { Text("🍕 Support Development", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text("Enjoying Meowdy 5000 Rivals Tracker?", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.height(4.dp))
                    Text("Help support server hosting, scraper maintenance, and future features!", style = MaterialTheme.typography.bodyMedium)
                }
            },
            confirmButton = {
                Button(onClick = {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://paypal.me/monfreda48"))
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                }) {
                    Text("Donate with PayPal")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDonateDialog = false }) {
                    Text("Close")
                }
            }
        )
    }

    // Claim Profile Input Dialog
    if (showClaimDialog) {
        AlertDialog(
            onDismissRequest = { showClaimDialog = false },
            title = { Text("👑 Claim Profile & Sync Stats", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text("Enter your exact Tracker.gg URL or full player tag (e.g. Meowdy 5000#1234):", style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = claimInputUrl,
                        onValueChange = { claimInputUrl = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("https://tracker.gg/marvel-rivals/profile/...") },
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                Button(onClick = {
                    val target = claimInputUrl.ifBlank { searchQuery }
                    if (target.isNotBlank()) {
                        performSearch(target)
                        isClaimed = true
                    }
                    showClaimDialog = false
                }) {
                    Text("Sync & Claim")
                }
            },
            dismissButton = {
                TextButton(onClick = { showClaimDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Right-anchored Drawer Setup: RTL wrapper puts drawer on RIGHT side
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        ModalNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                // Reset LTR layout direction inside drawer content so items read left-to-right
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    ModalDrawerSheet(
                        drawerContainerColor = MaterialTheme.colorScheme.surface,
                        drawerContentColor = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.width(340.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .verticalScroll(rememberScrollState())
                                .padding(16.dp)
                        ) {
                            // Header & Close Button
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(
                                        color = MaterialTheme.colorScheme.primary,
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier.size(36.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text("M5", fontWeight = FontWeight.Black, color = Color.Black, fontSize = 14.sp)
                                        }
                                    }
                                    Spacer(Modifier.width(10.dp))
                                    Column {
                                        Text("SETTINGS & TOOLS", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurface)
                                        Text("Control panel & app configurations", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                                    }
                                }
                                IconButton(onClick = { scope.launch { drawerState.close() } }) {
                                    Icon(Icons.Default.Close, contentDescription = "Close Drawer", tint = MaterialTheme.colorScheme.onSurface)
                                }
                            }

                            Spacer(Modifier.height(16.dp))
                            HorizontalDivider()
                            Spacer(Modifier.height(12.dp))

                            // 1. App Color Scheme & Themes
                            Text("🎨 APP COLOR SCHEME", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.height(6.dp))
                            Text("Select your dynamic accent color palette:", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f))
                            Spacer(Modifier.height(8.dp))

                            Box(modifier = Modifier.fillMaxWidth()) {
                                OutlinedButton(
                                    onClick = { themeDropdownExpanded = true },
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(12.dp),
                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.5f))
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = currentTheme.displayName,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.primary
                                        )
                                        Icon(
                                            imageVector = Icons.Default.ArrowDropDown,
                                            contentDescription = "Select Theme",
                                            tint = MaterialTheme.colorScheme.primary
                                        )
                                    }
                                }
                                DropdownMenu(
                                    expanded = themeDropdownExpanded,
                                    onDismissRequest = { themeDropdownExpanded = false },
                                    modifier = Modifier.fillMaxWidth(0.75f)
                                ) {
                                    AppThemeOption.values().forEach { option ->
                                        DropdownMenuItem(
                                            text = {
                                                Text(
                                                    text = option.displayName,
                                                    fontWeight = if (option == currentTheme) FontWeight.Bold else FontWeight.Normal,
                                                    color = if (option == currentTheme) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
                                                )
                                            },
                                            onClick = {
                                                themeViewModel.setTheme(option)
                                                themeDropdownExpanded = false
                                            }
                                        )
                                    }
                                }
                            }


                            Spacer(Modifier.height(16.dp))
                            HorizontalDivider()
                            Spacer(Modifier.height(12.dp))

                            // 2. Snapshot Tracking Mode
                            Text("⚡ SNAPSHOT TRACKING MODE", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.height(8.dp))
                            Card(
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(Modifier.weight(1f)) {
                                        Text("Auto Snapshot Tracking", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                                        Text("Record daily stat snapshots on lookups", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                                    }
                                    Switch(
                                        checked = autoSnapshotEnabled,
                                        onCheckedChange = { autoSnapshotEnabled = it }
                                    )
                                }
                            }

                            Spacer(Modifier.height(16.dp))
                            HorizontalDivider()
                            Spacer(Modifier.height(12.dp))

                            // 3. Favorite Minimized Site
                            Text("⭐ FAVORITE MINIMIZED SITE", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.height(6.dp))
                            Text("Select site display for minimized cards:", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f))
                            Spacer(Modifier.height(8.dp))
                            val sites = listOf(
                                "merged" to "⚡ Merged / Best Available",
                                "trackerGg" to "🌐 Tracker.gg",
                                "rivalsMeta" to "⚔️ RivalsMeta.com",
                                "rivalsTracker" to "🎯 RivalsTracker.com"
                            )
                            sites.forEach { (key, label) ->
                                NavigationDrawerItem(
                                    label = { Text(label, style = MaterialTheme.typography.bodyMedium) },
                                    selected = (selectedFavoriteSite == key),
                                    onClick = { selectedFavoriteSite = key },
                                    colors = NavigationDrawerItemDefaults.colors(
                                        selectedContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
                                        selectedTextColor = MaterialTheme.colorScheme.primary,
                                        unselectedTextColor = MaterialTheme.colorScheme.onSurface
                                    ),
                                    modifier = Modifier.padding(vertical = 1.dp)
                                )
                            }

                            Spacer(Modifier.height(16.dp))
                            HorizontalDivider()
                            Spacer(Modifier.height(12.dp))

                            // 4. Daily Tracking Reminder
                            Text("🔔 DAILY TRACKING REMINDER", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.height(8.dp))
                            Card(
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(Modifier.padding(12.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text("Daily Log In Reminder", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                                        Switch(
                                            checked = isReminderEnabled,
                                            onCheckedChange = { enabled ->
                                                if (enabled) {
                                                    showTimePicker = true
                                                } else {
                                                    DailyScheduler.cancelReminder(context)
                                                    isReminderEnabled = false
                                                }
                                            }
                                        )
                                    }
                                    if (isReminderEnabled) {
                                        val hour = DailyScheduler.getSavedHour(context)
                                        val minute = DailyScheduler.getSavedMinute(context)
                                        val timeStr = String.format("%02d:%02d", hour, minute)
                                        Spacer(Modifier.height(6.dp))
                                        TextButton(onClick = { showTimePicker = true }) {
                                            Text("⏰ Reminder Time: $timeStr (Tap to Change)", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }

                            Spacer(Modifier.height(16.dp))
                            HorizontalDivider()
                            Spacer(Modifier.height(12.dp))

                            // 5. App Updates & Maintenance
                            Text("⚡ APP UPDATES & MAINTENANCE", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.height(8.dp))
                            OutlinedButton(
                                onClick = {
                                    scope.launch { updateManager.checkForUpdates() }
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {

                                Icon(Icons.Default.Refresh, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text("Check for App Release Updates")
                            }

                            Spacer(Modifier.height(16.dp))
                            HorizontalDivider()
                            Spacer(Modifier.height(12.dp))

                            // 6. Storage & Persistence
                            Text("💾 STORAGE & PERSISTENCE", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text("SAF Storage Write Permission", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                                    val isGranted = PersistentSafStorageManager.hasValidPermission(context)
                                    Text(if (isGranted) "Status: Granted (Persistent)" else "Status: Ready", style = MaterialTheme.typography.bodySmall, color = if (isGranted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                                }
                                Button(onClick = {
                                    if (loadedDataJson != null) {
                                        val file = java.io.File(context.cacheDir, "stats_export.json").apply { writeText(loadedDataJson!!) }
                                        val uri = Uri.parse("content://com.meowdy5000.stattracker.fileprovider/external_files/stats_export.json")
                                        PersistentSafStorageManager.writeJson(context, loadedDataJson!!)
                                    }
                                }) {
                                    Text("Export JSON")
                                }
                            }

                            Spacer(Modifier.height(16.dp))
                            HorizontalDivider()
                            Spacer(Modifier.height(12.dp))

                            // 7. Developer Tools & Issue Reporting
                            Text("🛠️ DEVELOPER TOOLS & ISSUES", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.height(8.dp))
                            OutlinedButton(
                                onClick = { showIssueReportDialog = true },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Default.Warning, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text("Report an Issue / Bug")
                            }

                            Spacer(Modifier.height(16.dp))
                            HorizontalDivider()
                            Spacer(Modifier.height(12.dp))

                            // 8. Community & Esports Meta Resources
                            Text("🌐 COMMUNITY & META RESOURCES", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.height(8.dp))
                            val resourceLinks = listOf(
                                "Rivals Meta (RivalsMeta.com)" to "https://rivalsmeta.com",
                                "RivalsTracker.com" to "https://rivalstracker.com",
                                "Marvel Rivals Tracker.gg" to "https://tracker.gg/marvel-rivals",
                                "Liquipedia Hero Meta Wiki" to "https://liquipedia.net/marvelrivals"
                            )
                            resourceLinks.forEach { (name, linkUrl) ->
                                TextButton(
                                    onClick = {
                                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(linkUrl))
                                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                        context.startActivity(intent)
                                    },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween) {
                                        Text("↗️ $name", color = MaterialTheme.colorScheme.onSurface)
                                    }
                                }
                            }

                            Spacer(Modifier.height(16.dp))
                            HorizontalDivider()
                            Spacer(Modifier.height(12.dp))

                            // 9. Support Development
                            Button(
                                onClick = { showDonateDialog = true },
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("🍕 Donate with PayPal", color = Color.Black, fontWeight = FontWeight.Bold)
                            }

                            Spacer(Modifier.height(16.dp))
                            Text("v${com.meowdy5000.stattracker.BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f), modifier = Modifier.align(Alignment.CenterHorizontally).padding(16.dp))

                            Spacer(Modifier.height(12.dp))
                        }
                    }
                }
            }
        ) {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                Scaffold(
                    containerColor = MaterialTheme.colorScheme.background,
                    contentColor = MaterialTheme.colorScheme.onBackground,
                    topBar = {
                        TopAppBar(
                            title = { Text("Rivals Tracker Dashboard", color = MaterialTheme.colorScheme.onSurface) },
                            actions = {
                                IconButton(onClick = { scope.launch { drawerState.open() } }) {
                                    Icon(Icons.Default.Menu, contentDescription = "Open Drawer (Right)", tint = MaterialTheme.colorScheme.primary)
                                }
                            },
                            colors = TopAppBarDefaults.topAppBarColors(
                                containerColor = MaterialTheme.colorScheme.surface,
                                titleContentColor = MaterialTheme.colorScheme.onSurface,
                                actionIconContentColor = MaterialTheme.colorScheme.primary
                            )
                        )
                    }
                ) { innerPadding ->
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(horizontal = 16.dp)
            ) {
                // 1. Season Banner at Very Top
                item {
                    Spacer(modifier = Modifier.height(4.dp))
                    SeasonBannerCard()
                }

                // 2. Search Bar below Season Banner
                item {
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Search player (e.g. Meowdy 5000)") },
                        trailingIcon = {
                            IconButton(onClick = { performSearch(searchQuery) }) {
                                Icon(Icons.Default.Search, contentDescription = "Search")
                            }
                        },
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(onSearch = { performSearch(searchQuery) }),
                        shape = RoundedCornerShape(12.dp)
                    )
                }

                // Conditional Stats Rendering: No stats if user hasn't searched or bound account yet
                if (loadedDataJson == null) {
                    item {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 12.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surface
                            )
                        ) {
                            Column(
                                modifier = Modifier
                                    .padding(24.dp)
                                    .fillMaxWidth(),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = "👑 No Bound Account",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                    color = MaterialTheme.colorScheme.primary
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Search for your player username above (e.g. Meowdy 5000) to inspect stats and claim your profile.",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    }
                } else {
                    val currentRoot = rootJson ?: JSONObject()
                    val profileData = com.meowdy5000.stattracker.data.models.ProfileData.fromJson(currentRoot)
                    val errorMessage = currentRoot.optString("error", "").ifBlank { null }
                    val rolesArray = currentRoot.optJSONArray("role_performance") ?: currentRoot.optJSONArray("roles")
                    val matchesArray = currentRoot.optJSONArray("match_history") ?: currentRoot.optJSONArray("recent_matches") ?: currentRoot.optJSONArray("matches")

                    // 1. Profile Header Card with Avatar & Claim Button
                    item {
                        ProfileHeaderCard(
                            playerName = profileData.playerName,
                            avatarUrl = profileData.avatarUrl,
                            isClaimed = isClaimed,
                            onClaimClick = { showClaimDialog = true }
                        )
                    }

                    // Preview / Fallback Notice Banner
                    val isFallback = currentRoot.optBoolean("is_fallback", false)
                    val noticeMsg = currentRoot.optString("notice", "")
                    if (isFallback || noticeMsg.isNotBlank()) {
                        item {
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.7f)
                                )
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        Icons.Default.Info,
                                        contentDescription = "Notice",
                                        tint = MaterialTheme.colorScheme.onSecondaryContainer
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Text(
                                        text = noticeMsg.ifBlank { "Preview Profile — Enter your direct Tracker.gg profile URL or tag and tap 'Claim Profile' to link exact live stats." },
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSecondaryContainer
                                    )
                                }
                            }
                        }
                    }

                    // Error Alert Card if scraper returned an error / player not found
                    if (errorMessage != null || profileData.overview.matchesPlayed == 0) {
                        item {
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 8.dp),
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.errorContainer
                                )
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text(
                                        text = "⚠️ Profile Unavailable",
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onErrorContainer
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = errorMessage ?: "Player stats could not be retrieved from tracker.gg. Verify IGN or check if profile is set to Private.",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onErrorContainer
                                    )
                                }
                            }
                        }
                    } else {
                        // 2. Competitive Rank & Skill Rating Card
                        item {
                            CompetitiveRankCard(rankInfo = profileData.rank)
                        }

                        // 3. Combat Overview Accordion Card
                        item {
                            CombatOverviewCard(overview = profileData.overview)
                        }

                        // 4. Per-Minute Combat Rates Card
                        item {
                            CombatRatesCard(overview = profileData.overview)
                        }

                        // 5. Awards & Streaks Card
                        item {
                            AwardsCard(overview = profileData.overview, precision = profileData.precisionTotals)
                        }

                        // 6. Precision & Combat Totals Card
                        item {
                            PrecisionCard(precision = profileData.precisionTotals)
                        }

                        // 7. Role Performance Breakdown Card
                        if (rolesArray != null && rolesArray.length() > 0) {
                            item {
                                RoleMasteryCard(rolesArray)
                            }
                        }

                        // 8. Top 3 Heroes Card (with Square Hero Portraits)
                        val topHeroList = if (profileData.topHeroes.isNotEmpty()) profileData.topHeroes else profileData.heroes.take(3)
                        if (topHeroList.isNotEmpty()) {
                            item {
                                TopHeroesCard(heroes = topHeroList)
                            }
                        }

                        // 9. Recent Match History Card (with Hero Thumbnails)
                        if (matchesArray != null && matchesArray.length() > 0) {
                            item {
                                MatchHistoryCard(matchesArray)
                            }
                        }

                        item {
                            Spacer(modifier = Modifier.height(16.dp))
                        }
                    }

                        // 6. App Footer & Version Banner
                        item {
                            Spacer(modifier = Modifier.height(8.dp))
                            HorizontalDivider()
                            Spacer(modifier = Modifier.height(16.dp))

                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 32.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.Center
                                ) {
                                    Surface(
                                        color = MaterialTheme.colorScheme.primary,
                                        shape = RoundedCornerShape(6.dp),
                                        modifier = Modifier.size(24.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text("M5", fontWeight = FontWeight.Black, color = Color.Black, fontSize = 10.sp)
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Meowdy 5000 Rivals Tracker",
                                        fontWeight = FontWeight.Bold,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                }

                                Surface(
                                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
                                    shape = RoundedCornerShape(12.dp),
                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.3f))
                                ) {
                                    Text(
                                        text = "App Version v${com.meowdy5000.stattracker.BuildConfig.VERSION_NAME}",
                                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                                        color = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                                    )
                                }

                                Text(
                                    text = "Disclaimer: Not endorsed or affiliated with Marvel, Marvel Entertainment, or NetEase Games. All game assets and trademarks belong to their respective owners.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                                    textAlign = TextAlign.Center,
                                    fontSize = 10.sp,
                                    modifier = Modifier.padding(horizontal = 16.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Feedback Dialogs for Self-Update Pipeline
    when (val status = updateStatus) {
        is UpdateStatus.Checking -> {
            AlertDialog(
                onDismissRequest = {},
                confirmButton = {},
                title = { Text("Checking for Updates") },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp))
                        Spacer(modifier = Modifier.width(16.dp))
                        Text("Contacting server...")
                    }
                }
            )
        }
        is UpdateStatus.UpToDate -> {
            AlertDialog(
                onDismissRequest = { updateManager.resetStatus() },
                confirmButton = {
                    TextButton(onClick = { updateManager.resetStatus() }) { Text("OK") }
                },
                title = { Text("Up to Date") },
                text = { Text("You are running the latest version (v${com.meowdy5000.stattracker.BuildConfig.VERSION_NAME}).") }
            )
        }
        is UpdateStatus.Available -> {
            AlertDialog(
                onDismissRequest = { updateManager.resetStatus() },
                title = { Text("Update Available: v${status.versionName}") },
                text = { Text(status.changelog) },
                confirmButton = {
                    Button(onClick = {
                        scope.launch { updateManager.downloadAndInstallApk(status.downloadUrl) }
                    }) {
                        Text("Download & Install")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { updateManager.resetStatus() }) { Text("Later") }
                }
            )
        }
        is UpdateStatus.Downloading -> {
            AlertDialog(
                onDismissRequest = {},
                confirmButton = {},
                title = { Text("Downloading Update") },
                text = {
                    Column {
                        LinearProgressIndicator(
                            progress = status.progress / 100f,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("${status.progress}% downloaded")
                    }
                }
            )
        }
        is UpdateStatus.Error -> {
            AlertDialog(
                onDismissRequest = { updateManager.resetStatus() },
                title = { Text("Update Check Failed") },
                text = { Text(status.message) },
                confirmButton = {
                    TextButton(onClick = { updateManager.resetStatus() }) { Text("Dismiss") }
                }
            )
        }
        else -> {}
    }
}
}









