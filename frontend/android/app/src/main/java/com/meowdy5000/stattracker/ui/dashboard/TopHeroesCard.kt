package com.meowdy5000.stattracker.ui.dashboard

import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import coil.request.ImageRequest
import com.meowdy5000.stattracker.data.ImageLoaderProvider
import com.meowdy5000.stattracker.data.models.HeroStat
import com.meowdy5000.stattracker.ui.components.ExpandableStatCard

@Composable
fun TopHeroesCard(heroes: List<HeroStat>) {
    val context = LocalContext.current
    val imageLoader = remember(context) { ImageLoaderProvider.get(context) }
    val top3 = heroes.take(3)
    ExpandableStatCard(title = "🌟 Top 3 Heroes", initiallyExpanded = false) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (top3.isNotEmpty()) {
                top3.forEachIndexed { index, hero ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            if (!hero.heroIconUrl.isNullOrBlank() && hero.heroIconUrl != "null") {
                                AsyncImage(
                                    model = ImageRequest.Builder(context)
                                        .data(hero.heroIconUrl)
                                        .crossfade(true)
                                        .listener(
                                            onStart = { Log.d("HeroImage", "Loading start: ${hero.heroIconUrl}") },
                                            onSuccess = { _, _ -> Log.d("HeroImage", "Successfully loaded: ${hero.heroName}") },
                                            onError = { _, result -> 
                                                Log.e("HeroImage", "FAILED to load ${hero.heroName} from ${hero.heroIconUrl}", result.throwable) 
                                            }
                                        )
                                        .build(),
                                    imageLoader = imageLoader,
                                    contentDescription = hero.heroName,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier
                                        .size(52.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(8.dp))
                                        .background(MaterialTheme.colorScheme.surfaceVariant)
                                )
                            } else {
                                Box(
                                    modifier = Modifier
                                        .size(52.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(8.dp))
                                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Star,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.size(24.dp)
                                    )
                                }
                            }

                            Column {
                                Text(
                                    text = hero.heroName,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.primary,
                                    style = MaterialTheme.typography.titleSmall
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "${hero.matches} games • ${hero.timePlayed}",
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
                            Spacer(modifier = Modifier.height(2.dp))
                            val kdaText = if (!hero.kdaSplit.isNullOrBlank()) {
                                "${hero.kda} KDA (${hero.kdaSplit})"
                            } else {
                                "${hero.kda} KDA"
                            }
                            Text(
                                text = kdaText,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }

                    if (index < top3.size - 1) {
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
