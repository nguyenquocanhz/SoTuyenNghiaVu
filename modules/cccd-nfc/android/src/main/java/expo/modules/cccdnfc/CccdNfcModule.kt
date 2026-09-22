package expo.modules.cccdnfc

import android.app.Activity
import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Bundle
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean

class CccdNfcModule : Module() {
  private data class Session(
    val promise: Promise,
    val activity: Activity,
    val documentNumber: String,
    val dateOfBirth: String,
    val dateOfExpiry: String,
    var tagLostCount: Int = 0,
  )

  private val lock = Any()
  private var session: Session? = null
  private val reading = AtomicBoolean(false)

  private fun adapter(): NfcAdapter? = appContext.reactContext?.let { NfcAdapter.getDefaultAdapter(it) }

  override fun definition() = ModuleDefinition {
    Name("CccdNfc")

    Events("onProgress")

    Function("getNfcStatus") {
      val nfc = adapter()
      mapOf("supported" to (nfc != null), "enabled" to (nfc?.isEnabled == true))
    }

    Function("openNfcSettings") {
      val activity = appContext.currentActivity
      activity != null && runCatching { activity.startActivity(Intent(Settings.ACTION_NFC_SETTINGS)) }.isSuccess
    }

    AsyncFunction("readCard") { documentNumber: String, dateOfBirth: String, dateOfExpiry: String, promise: Promise ->
      start(documentNumber, dateOfBirth, dateOfExpiry, promise)
    }.runOnQueue(Queues.MAIN)

    Function("cancel") {
      finish(error = "CANCELLED" to "Đã huỷ quét thẻ.")
    }

    OnActivityEntersBackground {
      finish(error = "CANCELLED" to "Ứng dụng chuyển sang nền nên phiên quét đã dừng.")
    }

    OnDestroy {
      finish(error = "CANCELLED" to "Phiên quét đã dừng.")
    }
  }

  private fun start(documentNumber: String, dateOfBirth: String, dateOfExpiry: String, promise: Promise) {
    val nfc = adapter()
    if (nfc == null) {
      promise.reject("NFC_UNSUPPORTED", "Thiết bị không có NFC.", null)
      return
    }
    if (!nfc.isEnabled) {
      promise.reject("NFC_DISABLED", "NFC đang tắt. Hãy bật NFC trong Cài đặt.", null)
      return
    }
    val digits9 = Regex("^\\d{9}$")
    val yymmdd = Regex("^\\d{6}$")
    if (!digits9.matches(documentNumber) || !yymmdd.matches(dateOfBirth) || !yymmdd.matches(dateOfExpiry)) {
      promise.reject("INVALID_INPUT", "Số CCCD, ngày sinh hoặc ngày hết hạn không hợp lệ.", null)
      return
    }
    val activity = appContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Không tìm thấy màn hình đang hoạt động.", null)
      return
    }
    synchronized(lock) {
      if (session != null) {
        promise.reject("BUSY", "Đang có một phiên quét thẻ khác.", null)
        return
      }
      session = Session(promise, activity, documentNumber, dateOfBirth, dateOfExpiry)
    }

    val flags = NfcAdapter.FLAG_READER_NFC_A or
      NfcAdapter.FLAG_READER_NFC_B or
      NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK or
      NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS
    val extras = Bundle().apply { putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 250) }
    try {
      nfc.enableReaderMode(activity, { tag -> onTag(tag) }, flags, extras)
    } catch (e: Exception) {
      synchronized(lock) { session = null }
      promise.reject("READ_FAILED", "Không bật được chế độ đọc NFC: ${e.message}", e)
      return
    }
    progress("waiting_card", 0, "Đặt thẻ CCCD áp sát mặt lưng điện thoại (gần camera) và giữ yên…")
  }

  /** Called on an NFC binder thread. */
  private fun onTag(tag: Tag) {
    val current = synchronized(lock) { session } ?: return
    if (!reading.compareAndSet(false, true)) return
    try {
      val isoDep = IsoDep.get(tag)
      if (isoDep == null) {
        finish(error = "NOT_ISO_DEP" to "Thẻ không phải chip CCCD (không hỗ trợ ISO-DEP).")
        return
      }
      progress("connecting", 5, "Đã phát hiện thẻ, đang kết nối…")
      val result = CccdChipReader.read(isoDep, current.documentNumber, current.dateOfBirth, current.dateOfExpiry) { step, percent, message ->
        progress(step, percent, message)
      }
      progress("done", 100, "Đọc thẻ thành công.")
      finish(result = result)
    } catch (e: CccdReadException) {
      if (e.code == "TAG_LOST" && current.tagLostCount < MAX_TAG_LOST_RETRIES) {
        current.tagLostCount++
        progress("waiting_card", 0, "Mất kết nối với thẻ (lần ${current.tagLostCount}). Giữ yên thẻ áp sát điện thoại để đọc lại…")
      } else {
        finish(error = e.code to (e.message ?: "Không đọc được thẻ."))
      }
    } catch (e: Exception) {
      finish(error = "READ_FAILED" to "Lỗi không xác định: ${e.message ?: e.javaClass.simpleName}")
    } finally {
      reading.set(false)
    }
  }

  private fun progress(step: String, percent: Int, message: String) {
    sendEvent("onProgress", mapOf("step" to step, "percent" to percent, "message" to message))
  }

  private fun finish(result: Map<String, Any?>? = null, error: Pair<String, String>? = null) {
    val ended = synchronized(lock) { session.also { session = null } } ?: return
    val activity = ended.activity
    activity.runOnUiThread {
      runCatching { adapter()?.disableReaderMode(activity) }
    }
    if (error != null) ended.promise.reject(error.first, error.second, null) else ended.promise.resolve(result)
  }

  companion object {
    private const val MAX_TAG_LOST_RETRIES = 3
  }
}
