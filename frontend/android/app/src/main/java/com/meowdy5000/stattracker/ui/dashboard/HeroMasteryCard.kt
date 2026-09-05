package com.meowdy5000.stattracker.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.meowdy5000.stattracker.data.ImageLoaderProvider
import com.meowdy5000.stattracker.data.models.HeroStat
import com.meowdy5000.stattracker.ui.components.ExpandableStatCard

@Composable
fun HeroMasteryCard(heroes: List<HeroStat>) {
    val context = LocalContext.current
    val imageLoader = remember(context) { ImageLoaderProvider.get(context) }

    ExpandableStatCard(title = "🦸 Hero Mastery Breakdown", initiallyExpanded = true) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (heroes.isNotEmpty()) {
                heroes.forEachIndexed { index, hero ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            if (!hero.heroIconUrl.isNullOrBlank()) {
                                AsyncImage(
                                    model = hero.heroIconUrl,
                                    imageLoader = imageLoader,
                                    contentDescription = hero.heroName,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier
                                        .size(40.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f))
                                )
                            } else {
                                Box(
                                    modifier = Modifier
                                        .size(40.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Star,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }

                            Column {
                                Text(
                                    text = hero.heroName,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                Text(
                                    text = "${hero.matches} games • ${hero.wins}W-${hero.losses}L",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                                )
                            }
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = "${hero.winRate} WR",
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.secondary,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Text(
                                text = "${hero.kda} KDA (${hero.timePlayed})",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }

                    if (index < heroes.size - 1) {
                        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                    }
                }
            } else {
                Text(
                    text = "No hero breakdown data available for this profile.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
        }
    }
}
