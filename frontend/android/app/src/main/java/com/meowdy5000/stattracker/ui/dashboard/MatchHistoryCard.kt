package com.meowdy5000.stattracker.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.meowdy5000.stattracker.data.models.MatchInfo
import com.meowdy5000.stattracker.ui.components.ExpandableStatCard
import org.json.JSONArray

import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import com.meowdy5000.stattracker.data.ImageLoaderProvider

@Composable
fun MatchHistoryCard(matchesArray: JSONArray) {
    if (matchesArray.length() == 0) return
    val matchList = (0 until matchesArray.length()).mapNotNull { MatchInfo.fromJson(matchesArray.optJSONObject(it)) }
    MatchHistoryListCard(matchList)
}

@Composable
fun MatchHistoryListCard(matches: List<MatchInfo>) {
    if (matches.isEmpty()) return
    val context = LocalContext.current
    val imageLoader = remember(context) { ImageLoaderProvider.get(context) }

    ExpandableStatCard(title = "📜 Recent Match History", initiallyExpanded = true) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            matches.forEach { match ->
                val resultLower = match.score.lowercase()
                val isWin = resultLower == "victory" || resultLower == "win"
                val resultColor = if (isWin) Color(0xFF4CAF50) else Color(0xFFF44336)

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            if (!match.heroIconUrl.isNullOrBlank()) {
                                AsyncImage(
                                    model = match.heroIconUrl,
                                    imageLoader = imageLoader,
                                    contentDescription = match.heroName,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f))
                                )
                            }
                            Column {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Surface(
                                        color = resultColor,
                                        shape = RoundedCornerShape(4.dp)
                                    ) {
                                        Text(
                                            text = match.score.uppercase(),
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 11.sp,
                                            color = Color.White
                                        )
                                    }
                                    Text(
                                        text = match.heroName,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                }
                                Text(
                                    text = "${match.mapName} • ${match.modeName}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                                )
                            }
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = "${match.kills} / ${match.deaths} / ${match.assists}",
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Text(
                                text = "${match.kda} KDA",
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.secondary
                            )
                        }
                    }
                }
            }
        }
    }
}
