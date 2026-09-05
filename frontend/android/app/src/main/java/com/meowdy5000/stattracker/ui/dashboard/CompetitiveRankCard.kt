package com.meowdy5000.stattracker.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.meowdy5000.stattracker.data.models.RankInfo
import com.meowdy5000.stattracker.ui.components.ExpandableStatCard

@Composable
fun CompetitiveRankCard(rankInfo: RankInfo) {
    ExpandableStatCard(title = "🏆 Competitive Rank & Skill Rating", initiallyExpanded = true) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (!rankInfo.rankIconUrl.isNullOrBlank()) {
                        AsyncImage(
                            model = rankInfo.rankIconUrl,
                            contentDescription = "Rank Icon",
                            modifier = Modifier.size(36.dp)
                        )
                    }
                    Text(
                        text = rankInfo.tierName,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
                Text(
                    text = rankInfo.rankScore,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.secondary
                )
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    text = "Season Best: ${rankInfo.seasonBest}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
                )
                Text(
                    text = "All-Time: ${rankInfo.allTimeBest}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
                )
            }
            if (!rankInfo.ratingChange.isBlank() && rankInfo.ratingChange != "N/A") {
                Text(
                    text = rankInfo.ratingChange,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}
