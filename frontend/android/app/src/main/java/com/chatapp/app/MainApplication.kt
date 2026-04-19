package com.chatapp.app

import android.app.Application
import android.content.res.Configuration
import android.os.Build
import android.util.Log

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
      this,
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // On old Android emulators (API < 26) react-native-webrtc's
              // WebRTCModule constructor hangs forever in
              // AudioEffect.queryEffects() because the emulator's audio
              // flinger service never responds. This deadlocks the whole RN
              // init and produces a permanent white screen. The problem does
              // not occur on real devices, so we only skip the module for the
              // broken emulator case.
              if (BuildConfig.DEBUG && isBrokenAudioEmulator()) {
                val removed = removeAll { pkg ->
                  pkg.javaClass.name.startsWith("com.oney.WebRTCModule")
                }
                if (removed) {
                  Log.w(
                      "MainApplication",
                      "Skipping react-native-webrtc on legacy emulator " +
                          "(API ${Build.VERSION.SDK_INT}) to avoid audio-flinger hang. " +
                          "Calls will be disabled in this run; use API 28+ or a real device for WebRTC."
                  )
                }
              }
            }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }

  /**
   * Returns true when the current process is running on an Android emulator
   * whose audio stack is known to hang WebRTC's `AudioEffect.queryEffects()`
   * call. We detect the emulator via the usual heuristic (generic/goldfish
   * fingerprints + SDK). API 26+ emulators have a working audio flinger and
   * are left untouched.
   */
  private fun isBrokenAudioEmulator(): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) return false
    val fingerprint = Build.FINGERPRINT ?: ""
    val model = Build.MODEL ?: ""
    val product = Build.PRODUCT ?: ""
    val hardware = Build.HARDWARE ?: ""
    return fingerprint.startsWith("generic") ||
        fingerprint.startsWith("unknown") ||
        model.contains("google_sdk") ||
        model.contains("Emulator") ||
        model.contains("Android SDK built for") ||
        product.contains("sdk") ||
        hardware.contains("goldfish") ||
        hardware.contains("ranchu")
  }
}
