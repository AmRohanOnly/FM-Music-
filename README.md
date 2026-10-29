# FM Music

A native Android music-discovery starter built with Kotlin and Jetpack Compose.

Searches and mood shortcuts open the official YouTube Music search page with an Android `ACTION_VIEW` intent. If YouTube Music is installed, Android can open it; otherwise, the configured browser handles the link. Playback, ads, subscriptions, and content availability remain in YouTube's official experience.

This starter does not play or extract audio inside the app. YouTube does not provide a maintained native Android music-playback SDK for a new client; YouTube Data API search also requires a developer API key. The app avoids unofficial stream extraction, ad blocking, and ad bypass.

## Catalog networking

The app initializes a reusable Ktor `HttpClient` using the OkHttp engine, JSON content negotiation, and bounded connection/request/socket timeouts. On application startup, it asks InnerTubeX to fetch and store YouTube's public visitor data for an unauthenticated browsing session. `MusicApplication.networkClient.catalog.search(query)` wraps InnerTubeX search metadata only; no InnerTubeX stream extraction or playback APIs are exposed by the catalog wrapper. Licensed playback still requires selecting and integrating a provider.

InnerTubeX `v0.11.2` is published on JitPack under GPL-3.0 and requires the Kotlin 2.4.21 / Ktor 3.6.0 toolchain used here. Before distributing an app that bundles this dependency, review its GPL-3.0 source and notice obligations and reconcile them with this repository's MIT license.

## Build

Open the project in Android Studio, or run `gradlew.bat :app:testDebugUnitTest` and `gradlew.bat :app:assembleDebug` on Windows with JDK 17 or newer and Android SDK Platform 37 installed.
