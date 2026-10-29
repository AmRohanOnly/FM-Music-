package com.fmmusic.client.network

import com.metrolist.innertubex.InnerTube
import com.metrolist.innertubex.models.YouTubeClient
import com.metrolist.innertubex.models.response.SearchResponse
import io.ktor.client.call.body

class InnerTubeCatalogClient internal constructor(
    private val innerTube: InnerTube,
) {
    suspend fun search(query: String): SearchResponse {
        require(query.isNotBlank()) { "Search query must not be blank." }
        return innerTube
            .search(YouTubeClient.WEB, query = query.trim())
            .body()
    }
}
