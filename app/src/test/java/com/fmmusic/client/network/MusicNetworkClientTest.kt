package com.fmmusic.client.network

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.okhttp.OkHttpEngine
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MusicNetworkClientTest {
    @Test
    fun createsNetworkClientWithOkHttpEngineAndCatalogClient() {
        val client = MusicNetworkClient()
        try {
            assertTrue(client.httpClient.engine is OkHttpEngine)
        } finally {
            client.close()
        }
    }

    @Test
    fun initializesVisitorSessionWithoutCredentials() = runBlocking {
        val requests = mutableListOf<String>()
        val client = MusicNetworkClient(
            HttpClient(
                MockEngine { request ->
                    requests += request.url.toString()
                    assertNull(request.headers[HttpHeaders.Authorization])
                    assertNull(request.headers[HttpHeaders.Cookie])
                    when (request.url.host) {
                        "www.youtube.com" -> respond("", HttpStatusCode.NotFound)
                        "music.youtube.com" -> respond(
                            """<script>{"VISITOR_DATA":"public-visitor-token"}</script>""",
                            headers = headersOf(HttpHeaders.ContentType, "text/html"),
                        )
                        else -> error("Unexpected request URL: ${request.url}")
                    }
                },
            ),
        )
        try {
            assertTrue("Visitor request failed: $requests", client.initializePublicSession())
            assertEquals(2, requests.size)
            val session = client.innerTube.sessionSnapshot()
            assertEquals("public-visitor-token", session.visitorData)
            assertNull(session.cookie)
            assertNull(session.sapisid)
            assertEquals("0", session.authUser)
            assertFalse(session.useLoginForBrowse)
        } finally {
            client.close()
        }
    }
}
