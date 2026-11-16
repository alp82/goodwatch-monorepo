package expo.modules.yepwatchplayupdates

import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class YepWatchPlayUpdatesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("YepWatchPlayUpdates")

    AsyncFunction("isUpdateAvailable") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null || context.packageName != "com.yepwatch.app") {
        promise.resolve(false)
      } else {
        // Play compares installed version codes and the signed-in user's track/rollout eligibility.
        // Merely ask: the user chooses whether to leave the room and open the store.
        AppUpdateManagerFactory.create(context).appUpdateInfo
          .addOnSuccessListener { info ->
            promise.resolve(info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE)
          }
          .addOnFailureListener { error ->
            promise.reject("ERR_PLAY_UPDATE_CHECK", "Google Play update check failed", error)
          }
      }
    }
  }
}
