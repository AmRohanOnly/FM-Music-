package com.fmmusic.client.network

import com.metrolist.innertubex.InnerTube
import io.ktor.client.HttpClient

class MusicNetworkClient(
    internal val httpClient: HttpClient = MusicHttpClientFactory.create(),
) : AutoCloseable {
    internal val innerTube = InnerTube(httpClient)

    val catalog = InnerTubeCatalogClient(innerTube)

    suspend fun initializePublicSession(): Boolean {
        val visitorData = innerTube.fetchFreshVisitorData() ?: return false
        val session = innerTube.sessionSnapshot()
        return session.visitorData == visitorData &&
            session.cookie == null &&
            session.sapisid == null &&
            session.authUser == "0" &&
            !session.useLoginForBrowse
    }

    override fun close() {
        innerTube.close()
        httpClient.close()
    }
}
