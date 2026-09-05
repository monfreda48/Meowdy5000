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

import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.material3.pulltorefresh.PullToRefreshContainer
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import com.meowdy5000.stattracker.notifications.DailyScheduler
import com.meowdy5000.stattracker.storage.ApkUpdateManager
import com.meowdy5000.stattracker.storage.PersistentSafStorageManager
import androidx.compose.material.icons.filled.Settings
import com.meowdy5000.stattracker.ui.components.ExpandableStatCard
import com.meowdy5000.stattracker.ui.components.NotificationTimePickerDialog
import com.meowdy5000.stattracker.ui.components.ServerConfigDialog
import com.meowdy5000.stattracker.ui.theme.AppThemeOption
import com.meowdy5000.stattracker.ui.theme.ThemeViewModel
import com.meowdy5000.stattracker.updater.AppUpdateManager
import com.meowdy5000.stattracker.updater.UpdateStatus
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.json.JSONArray
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import android.widget.Toast
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import com.meowdy5000.stattracker.data.DataExporter


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

    var seasonNumber by remember { mutableStateOf("9.5") }
    var seasonTitle by remember { mutableStateOf("THE MYSTERY OF THEBES") }
    var newHeroName by remember { mutableStateOf("The Hood") }
    var seasonDaysLeft by remember { mutableStateOf(6) }
    var seasonProgressPct by remember { mutableStateOf(0.78f) }
    var isRefreshing by remember { mutableStateOf(false) }

    val fetchSeasonInfo: (Boolean) -> Unit = { force ->
        scope.launch {
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                try {
                    val baseUrl = NetworkModule.getBaseUrl(context)
                    val cleanBase = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"
                    val urlStr = "${cleanBase}api/season/current" + if (force) "?force_refresh=true" else ""
                    val conn = NetworkModule.createConnection(urlStr)
                    conn.requestMethod = "GET"
                    val code = conn.responseCode
                    if (code == 200) {
                        val respStr = conn.inputStream.bufferedReader().use { it.readText() }
                        val json = JSONObject(respStr)
                        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                            seasonNumber = json.optString("season_number", "9.5")
                            seasonTitle = json.optString("season_title", "THE MYSTERY OF THEBES")
                            newHeroName = json.optString("new_hero_name", "The Hood")
                            seasonDaysLeft = json.optInt("days_left", 6)
                            val pct = json.optInt("progress_percentage", 78)
                            seasonProgressPct = (pct / 100f).coerceIn(0f, 1f)
                        }
                    }
                } catch (e: Exception) {
                    Log.e("SeasonFetch", "Failed to fetch season info: ${e.message}")
                }
            }
        }
    }



    val marvelQuotes = listOf(
        "🕶️ Helping Daredevil find his keys...",
        "👁️ Obtaining the Eye of Agamotto...",
        "🔨 Bribing Eitri to forge Uru stats...",
        "⚡ Charging Iron Man's Arc Reactor (400%)...",
        "🕷️ Swiping Peter Parker's web-shooters...",
        "🧪 Injecting Super Soldier Serum into backend...",
        "💥 Hulk Smashed the web scraper API...",
        "🛡️ Borrowing Captain America's Vibranium Shield...",
        "🐱 Consulting Bast in Wakanda...",
        "🌌 Stealing the Space Stone from Thanos...",
        "📜 Reading the Darkhold for hidden KDA stats...",
        "🌭 Deadpool stole the loading bar...",
        "🎯 Hawkeye never misses a single match record...",
        "🔮 Doctor Strange checking 14,000,605 stat timelines...",
        "🐺 Wolverine is sharpening his Adamantium claws...",
        "🚀 Rocket Raccoon is stealing a prosthetic arm...",
        "🌴 Groot says: I AM GROOT (fetching data)...",
        "🌀 Opening a Bifrost portal to Tracker.gg...",
        "⚡ Thor summoned Lightning to speed up scraping...",
        "🐜 Ant-Man went subatomic to find missing data...",
        "🧠 Professor X is telepathically reading the server database...",
        "🏎️ Ghost Rider is doing a Penance Stare on bad KDA data...",
        "🍕 Spider-Man: Peter Parker is delivering pizzas on the way...",
        "🍏 Loki is shapeshifting into a fast database query...",
        "💥 Punisher is eliminating 404 network timeout errors...",
        "🏹 Kate Bishop shot an arrow through the lag spike...",
        "🔮 Scarlet Witch altered reality to boost your KDA...",
        "🤖 JARVIS is optimizing the cloud neural network...",
        "🐱 Goose the Flerken swallowed the slow network packets...",
        "🃏 Gambit is charging up your stat cards with kinetic energy..."
    )

    var searchQuery by remember { mutableStateOf("") }
    var loadedDataJson by remember { mutableStateOf<String?>(null) }
    var isSearching by remember { mutableStateOf(false) }
    var searchProgress by remember { mutableStateOf(0f) }
    var searchProgressMsg by remember { mutableStateOf("") }
    var isClaimed by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    var isReminderEnabled by remember { mutableStateOf(DailyScheduler.isReminderEnabled(context)) }

    val prefs = remember(context) { context.getSharedPreferences("dashboard_prefs", Context.MODE_PRIVATE) }
    var autoSnapshotEnabled by remember { mutableStateOf(prefs.getBoolean("auto_snapshot_enabled", true)) }
    var snapshotInterval by remember { mutableStateOf(prefs.getString("snapshot_interval", "24hr") ?: "24hr") }
    var showIssueReportDialog by remember { mutableStateOf(false) }
    var issueNotes by remember { mutableStateOf("") }
    var issueReportSuccess by remember { mutableStateOf(false) }
    var showCheckUpdateDialog by remember { mutableStateOf(false) }
    var isCheckingUpdate by remember { mutableStateOf(false) }
    var updateInfoText by remember { mutableStateOf("") }

    fun loadCardOrder(): List<String> {
        val defaultList = listOf("OVERALL_STATS", "TOP_HEROES", "ROLE_BREAKDOWN", "RECENT_MATCHES")
        val savedCsv = prefs.getString("dashboard_card_order", null)
        if (savedCsv.isNullOrBlank()) return defaultList
        val parsed = savedCsv.split(",").map { it.trim() }.filter { it in defaultList }
        val missing = defaultList.filter { it !in parsed }
        return parsed + missing
    }

    fun saveCardOrder(newOrder: List<String>) {
        prefs.edit().putString("dashboard_card_order", newOrder.joinToString(",")).apply()
    }

    var cardOrder by remember { mutableStateOf(loadCardOrder()) }
    var showCustomizeDialog by remember { mutableStateOf(false) }
    var showDonateDialog by remember { mutableStateOf(false) }
    var showClaimDialog by remember { mutableStateOf(false) }
    var showUnclaimDialog by remember { mutableStateOf(false) }
    var showServerDialog by remember { mutableStateOf(false) }

    val exportJsonLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        if (uri != null) {
            val success = DataExporter.exportSnapshotToUri(
                context = context,
                targetUri = uri,
                loadedDataJson = loadedDataJson,
                isClaimed = isClaimed,
                cardOrder = cardOrder,
                themeName = currentTheme.displayName,
                autoSnapshotEnabled = autoSnapshotEnabled,
                snapshotInterval = snapshotInterval
            )
            if (success) {
                Toast.makeText(context, "Snapshot exported successfully", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(context, "Failed to export snapshot", Toast.LENGTH_SHORT).show()
            }
        }
    }

    val unknownAppSourcesLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) {
        updateManager.checkAndResumePendingInstall()
        com.meowdy5000.stattracker.storage.ApkUpdateManager.checkAndResumePendingInstall(context)
    }

    LaunchedEffect(unknownAppSourcesLauncher) {
        updateManager.permissionLauncher = unknownAppSourcesLauncher
    }

    val lifecycleOwner = androidx.compose.ui.platform.LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == androidx.lifecycle.Lifecycle.Event.ON_RESUME) {
                updateManager.checkAndResumePendingInstall()
                com.meowdy5000.stattracker.storage.ApkUpdateManager.checkAndResumePendingInstall(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }


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
            put("notice", "No live stats found for '$clean'. Tap 'Claim Profile' to set as your profile.")
            put("error", "Live statistics could not be fetched automatically for '$clean'.")
            put("rank", rankObj)
            put("heroes", JSONArray())
        }.toString()
    }

    val performSearch: (String) -> Unit = { queryText ->
        val targetName = queryText.replace("\r", "").replace("\n", "").trim()
        if (targetName.isNotBlank()) {
            searchQuery = queryText
            isSearching = true
        searchProgress = 0.15f
        searchProgressMsg = marvelQuotes.random()
        Log.e("DashboardSearch", "Initiating search for targetName='$targetName'")
        scope.launch {
            val progressJob = launch {
                while (isActive) {
                    delay(300)
                    if (searchProgress < 0.35f) searchProgress += 0.05f
                    else if (searchProgress < 0.65f) searchProgress += 0.03f
                    else if (searchProgress < 0.85f) searchProgress += 0.02f
                    else if (searchProgress < 0.94f) searchProgress += 0.01f
                }
            }
            val quoteJob = launch {
                while (isActive) {
                    delay(2200)
                    searchProgressMsg = marvelQuotes.filter { it != searchProgressMsg }.random()
                }
            }

            try {
                val minDisplayDelay = launch { delay(2500) }
                kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                    try {
                        val urlStr = NetworkModule.getSearchUrl(context)
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
                minDisplayDelay.join()
            } finally {
                progressJob.cancel()
                quoteJob.cancel()
                searchProgress = 1.0f
                searchProgressMsg = "💥 Avengers Assembled! Stats Ready."
                delay(300)
                isSearching = false
            }
        }
    }
}

    // Instant offline loading on launch (without auto-searching on startup)
    LaunchedEffect(Unit) {
        fetchSeasonInfo(false)
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
            }
        }
    }

    if (showTimePicker) {
        NotificationTimePickerDialog(onDismiss = {
            showTimePicker = false
            isReminderEnabled = DailyScheduler.isReminderEnabled(context)
        })
    }

    if (showServerDialog) {
        ServerConfigDialog(onDismiss = { showServerDialog = false })
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
                                    val url = java.net.URL(NetworkModule.getReportErrorUrl(context))
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
                    Text("Enjoying M5 Stat Tracker?", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
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

    val activePlayerName = remember(loadedDataJson, searchQuery) {
        if (rootJson != null) {
            val name = rootJson.optString("player_name", "").ifBlank {
                rootJson.optJSONObject("overview")?.optString("player_name", "") ?: ""
            }
            if (name.isNotBlank()) name else searchQuery.ifBlank { "this player" }
        } else {
            searchQuery.ifBlank { "this player" }
        }
    }

    // Claim Profile Confirmation Dialog
    if (showClaimDialog) {
        AlertDialog(
            onDismissRequest = { showClaimDialog = false },
            title = { Text("👑 Claim Profile", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    text = "Claim $activePlayerName as your profile?",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        isClaimed = true
                        prefs.edit().putBoolean("profile_is_claimed", true).apply()
                        if (activePlayerName.isNotBlank() && activePlayerName != "this player") {
                            prefs.edit().putString("claimed_player_name", activePlayerName).apply()
                        }
                        showClaimDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                ) {
                    Text("Claim Profile", color = Color.Black, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClaimDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Unclaim Profile Confirmation Dialog
    if (showUnclaimDialog) {
        AlertDialog(
            onDismissRequest = { showUnclaimDialog = false },
            title = { Text("Unclaim Profile?", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    text = "Are you sure you want to unclaim this profile? Your customized dashboard layout will be disabled until a profile is claimed again.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        prefs.edit().putBoolean("profile_is_claimed", false).remove("claimed_player_name").apply()
                        isClaimed = false
                        loadedDataJson = null
                        snapshotManager.clearCache()
                        searchQuery = ""
                        showUnclaimDialog = false
                        scope.launch { drawerState.close() }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Unclaim", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showUnclaimDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Customize Dashboard Stat Cards Layout Dialog
    if (showCustomizeDialog) {
        AlertDialog(
            onDismissRequest = { showCustomizeDialog = false },
            title = { Text("🎨 Customize Stat Cards", fontWeight = FontWeight.Bold) },
            text = {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Rearrange the order of stat cards rendered on your claimed profile dashboard:",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
                    )
                    Spacer(Modifier.height(12.dp))

                    cardOrder.forEachIndexed { index, cardId ->
                        val (title, desc) = when (cardId) {
                            "OVERALL_STATS" -> "⚔️ Overall Stats & Rank" to "Competitive rank, K/D & overview"
                            "TOP_HEROES" -> "🦸 Top Heroes Pool" to "Top 3 hero win rates & stats"
                            "ROLE_BREAKDOWN" -> "🛡️ Role Mastery" to "Vanguard, Duelist & Strategist"
                            "RECENT_MATCHES" -> "📜 Recent Match History" to "Recent match logs & scores"
                            else -> cardId to ""
                        }

                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant
                            ),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                                    Text(desc, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                                }

                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    IconButton(
                                        enabled = index > 0,
                                        onClick = {
                                            if (index > 0) {
                                                val newOrder = cardOrder.toMutableList()
                                                val temp = newOrder[index]
                                                newOrder[index] = newOrder[index - 1]
                                                newOrder[index - 1] = temp
                                                cardOrder = newOrder
                                                saveCardOrder(newOrder)
                                            }
                                        }
                                    ) {
                                        Text("▲", fontWeight = FontWeight.Bold, color = if (index > 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f))
                                    }

                                    IconButton(
                                        enabled = index < cardOrder.size - 1,
                                        onClick = {
                                            if (index < cardOrder.size - 1) {
                                                val newOrder = cardOrder.toMutableList()
                                                val temp = newOrder[index]
                                                newOrder[index] = newOrder[index + 1]
                                                newOrder[index + 1] = temp
                                                cardOrder = newOrder
                                                saveCardOrder(newOrder)
                                            }
                                        }
                                    ) {
                                        Text("▼", fontWeight = FontWeight.Bold, color = if (index < cardOrder.size - 1) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f))
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(onClick = { showCustomizeDialog = false }) {
                    Text("Done")
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    val defaultOrder = listOf("OVERALL_STATS", "TOP_HEROES", "ROLE_BREAKDOWN", "RECENT_MATCHES")
                    cardOrder = defaultOrder
                    saveCardOrder(defaultOrder)
                }) {
                    Text("Reset to Default")
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
                                Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(Modifier.weight(1f)) {
                                            Text("Auto Snapshot Tracking", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                                            Text("Record stat snapshots on lookups", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                                        }
                                        Switch(
                                            checked = autoSnapshotEnabled,
                                            onCheckedChange = {
                                                autoSnapshotEnabled = it
                                                prefs.edit().putBoolean("auto_snapshot_enabled", it).apply()
                                            }
                                        )
                                    }

                                    if (autoSnapshotEnabled) {
                                        Spacer(Modifier.height(10.dp))
                                        HorizontalDivider(color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f))
                                        Spacer(Modifier.height(8.dp))

                                        Text(
                                            text = "Snapshot Data Increment",
                                            style = MaterialTheme.typography.labelMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.primary
                                        )
                                        Spacer(Modifier.height(6.dp))

                                        val intervals = listOf("12hr" to "12 Hours", "24hr" to "24 Hours", "1w" to "1 Week")
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            intervals.forEach { (key, _) ->
                                                val isSelected = snapshotInterval == key
                                                FilterChip(
                                                    selected = isSelected,
                                                    onClick = {
                                                        snapshotInterval = key
                                                        prefs.edit().putString("snapshot_interval", key).apply()
                                                    },
                                                    label = { Text(key, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal) },
                                                    modifier = Modifier.weight(1f),
                                                    colors = FilterChipDefaults.filterChipColors(
                                                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                                                        selectedLabelColor = Color.Black
                                                    )
                                                )
                                            }
                                        }
                                    }
                                }
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
                            NavigationDrawerItem(
                                label = {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(imageVector = Icons.Default.Refresh, contentDescription = null)
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Text("Check for Updates")
                                    }
                                },
                                selected = false,
                                onClick = {
                                    scope.launch { updateManager.checkForUpdates() }
                                }
                            )

                            Spacer(Modifier.height(16.dp))
                            HorizontalDivider()
                            Spacer(Modifier.height(12.dp))

                            // 6. Storage & Persistence
                            Text("💾 STORAGE & PERSISTENCE", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.height(8.dp))
                            NavigationDrawerItem(
                                label = {
                                    Column {
                                        Text("Export Local Data (JSON)", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                                        Text("Export cached player profiles and match logs", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                                    }
                                },
                                icon = { Icon(imageVector = Icons.Default.Share, contentDescription = "Export") },
                                selected = false,
                                onClick = {
                                    val timestamp = SimpleDateFormat("yyyyMMdd", Locale.US).format(Date())
                                    val defaultFileName = "meowdy5000_stats_$timestamp.json"
                                    exportJsonLauncher.launch(defaultFileName)
                                }
                            )

                            if (isClaimed) {
                                Spacer(Modifier.height(8.dp))
                                NavigationDrawerItem(
                                    label = {
                                        Column {
                                            Text("Unclaim Profile", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
                                            Text("Remove claimed profile link and restore default view", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                                        }
                                    },
                                    icon = { Icon(imageVector = Icons.Default.Close, contentDescription = "Unclaim Profile", tint = MaterialTheme.colorScheme.error) },
                                    selected = false,
                                    onClick = {
                                        showUnclaimDialog = true
                                    }
                                )
                            }

                            Spacer(Modifier.height(16.dp))
                            HorizontalDivider()
                            Spacer(Modifier.height(12.dp))

                            // 7. Developer Tools & Issue Reporting
                            Text("🛠️ DEVELOPER TOOLS & ISSUES", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.height(8.dp))
                            OutlinedButton(
                                onClick = {
                                    val url = "https://github.com/monfreda48/Meowdy5000/issues/new?labels=enhancement&title=%5BFeature%5D%3A+"
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                    }
                                    context.startActivity(intent)
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("💡", fontSize = 16.sp)
                                Spacer(Modifier.width(8.dp))
                                Text("Suggest a Feature")
                            }

                            Spacer(Modifier.height(8.dp))

                            OutlinedButton(
                                onClick = {
                                    val url = "https://github.com/monfreda48/Meowdy5000/issues/new?labels=bug&title=%5BBug%5D%3A+"
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                    }
                                    context.startActivity(intent)
                                },
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
                                shape = RoundedCornerShape(50),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFFE91E63),
                                    contentColor = Color.White
                                ),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("🍕 Donate with PayPal", fontWeight = FontWeight.Bold)
                            }

                            Spacer(Modifier.height(12.dp))

                            Text(
                                text = "v${com.meowdy5000.stattracker.BuildConfig.VERSION_NAME} (Build ${com.meowdy5000.stattracker.BuildConfig.VERSION_CODE})",
                                fontSize = 13.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                                textAlign = TextAlign.Center,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .align(Alignment.CenterHorizontally)
                            )

                            Spacer(modifier = Modifier.height(48.dp))
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
                    val pullToRefreshState = rememberPullToRefreshState()
                    if (pullToRefreshState.isRefreshing) {
                        LaunchedEffect(true) {
                            isRefreshing = true
                            fetchSeasonInfo(true)
                            performSearch(searchQuery)
                            isRefreshing = false
                            pullToRefreshState.endRefresh()
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                            .nestedScroll(pullToRefreshState.nestedScrollConnection)
                    ) {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 16.dp)
                        ) {
                            // 1. Season Banner at Very Top
                            item {
                                Spacer(modifier = Modifier.height(4.dp))
                                SeasonBannerCard(
                                    seasonNumber = seasonNumber,
                                    seasonTitle = seasonTitle,
                                    newHeroName = newHeroName,
                                    daysLeft = seasonDaysLeft,
                                    progressPercentage = seasonProgressPct
                                )
                            }

                // 2. Search Bar below Season Banner
                item {
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Search player username...") },
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

                // 2.5 Live Search Telemetry Progress Bar with Silly Marvel Quotes
                if (isSearching) {
                    item {
                        Spacer(modifier = Modifier.height(8.dp))
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant
                            ),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .padding(16.dp)
                                    .fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(18.dp),
                                            strokeWidth = 2.dp,
                                            color = MaterialTheme.colorScheme.primary
                                        )
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Text(
                                            text = searchProgressMsg,
                                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                                            color = MaterialTheme.colorScheme.onSurface,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                    Text(
                                        text = "${(searchProgress * 100).toInt()}%",
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                        color = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.padding(start = 8.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.height(10.dp))
                                LinearProgressIndicator(
                                    progress = { searchProgress },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(6.dp)
                                        .clip(RoundedCornerShape(3.dp)),
                                    color = MaterialTheme.colorScheme.primary,
                                    trackColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                                )
                            }
                        }
                    }
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
                                    text = "Search for your player username above to inspect stats and claim your profile.",
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

                    // 1. Profile Header Card with Avatar, Claim Button & Edit Layout Button
                    item {
                        ProfileHeaderCard(
                            playerName = profileData.playerName,
                            avatarUrl = profileData.avatarUrl,
                            isClaimed = isClaimed,
                            onClaimClick = { showClaimDialog = true },
                            onCustomizeLayoutClick = { showCustomizeDialog = true }
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
                        // Render Stat Cards in Custom Order
                        cardOrder.forEach { cardId ->
                            when (cardId) {
                                "OVERALL_STATS" -> {
                                    item { CompetitiveRankCard(rankInfo = profileData.rank) }
                                    item { CombatOverviewCard(overview = profileData.overview) }
                                    item { CombatRatesCard(overview = profileData.overview) }
                                    item { AwardsCard(overview = profileData.overview, precision = profileData.precisionTotals) }
                                    item { PrecisionCard(precision = profileData.precisionTotals) }
                                }
                                "TOP_HEROES" -> {
                                    val topHeroList = if (profileData.topHeroes.isNotEmpty()) profileData.topHeroes else profileData.heroes.take(3)
                                    if (topHeroList.isNotEmpty()) {
                                        item { TopHeroesCard(heroes = topHeroList) }
                                    }
                                }
                                "ROLE_BREAKDOWN" -> {
                                    if (rolesArray != null && rolesArray.length() > 0) {
                                        item { RoleMasteryCard(rolesArray) }
                                    }
                                }
                                "RECENT_MATCHES" -> {
                                    if (matchesArray != null && matchesArray.length() > 0) {
                                        item { MatchHistoryCard(matchesArray) }
                                    }
                                }
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
                                        text = "M5 Stat Tracker",
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

                    PullToRefreshContainer(
                        state = pullToRefreshState,
                        modifier = Modifier.align(Alignment.TopCenter)
                    )
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









