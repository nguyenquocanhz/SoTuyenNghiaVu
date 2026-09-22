package expo.modules.cccdnfc

import android.nfc.TagLostException
import android.nfc.tech.IsoDep
import android.os.Build
import net.sf.scuba.smartcards.CardService
import net.sf.scuba.smartcards.CardServiceException
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.jmrtd.BACKey
import org.jmrtd.PassportService
import org.jmrtd.lds.CardAccessFile
import org.jmrtd.lds.PACEInfo
import org.jmrtd.lds.icao.DG1File
import org.jmrtd.lds.icao.MRZInfo
import java.io.IOException
import java.security.Security

internal class CccdReadException(val code: String, message: String, cause: Throwable? = null) : Exception(message, cause)

/**
 * Reads DG1 (MRZ) and DG13 (Vietnamese citizen data) from a CCCD chip using ICAO 9303
 * PACE, falling back to BAC. DG2 (photo) and biometric groups are intentionally not read.
 */
internal object CccdChipReader {
  fun interface Progress {
    fun report(step: String, percent: Int, message: String)
  }

  @Synchronized
  private fun ensureBouncyCastle() {
    // Android ships a stripped "BC" provider under a repackaged class name; JMRTD needs the full one.
    if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) !is BouncyCastleProvider) {
      Security.removeProvider(BouncyCastleProvider.PROVIDER_NAME)
      Security.insertProviderAt(BouncyCastleProvider(), 1)
    }
  }

  fun read(isoDep: IsoDep, documentNumber: String, dateOfBirth: String, dateOfExpiry: String, progress: Progress): Map<String, Any?> {
    ensureBouncyCastle()

    val weakRf = Build.MANUFACTURER.equals("samsung", ignoreCase = true) ||
      Build.HARDWARE.lowercase().contains("qcom") ||
      Build.BOARD.lowercase().contains("universal")
    val extended = !weakRf && runCatching { isoDep.isExtendedLengthApduSupported }.getOrDefault(false)
    // 223-byte commands keep PACE key-agreement APDUs within short-length limits on every controller.
    val maxTransceive = if (extended) isoDep.maxTransceiveLength else 223
    val maxBlockSize = when {
      weakRf -> 128
      extended -> 2048
      else -> PassportService.DEFAULT_MAX_BLOCKSIZE
    }
    isoDep.timeout = maxOf(isoDep.timeout, 20_000)

    val cardService = ThrottledCardService(CardService.getInstance(isoDep), if (weakRf) 15L else 0L)
    val service = PassportService(cardService, maxTransceive, maxBlockSize, false, false)
    var stage = "connect"
    try {
      service.open()
      val bacKey = BACKey(documentNumber, dateOfBirth, dateOfExpiry)

      stage = "auth"
      progress.report("authenticating", 15, "Đang xác thực bảo mật (PACE)…")
      var authMethod = "BAC"
      var paceSucceeded = false
      try {
        val cardAccess = CardAccessFile(service.getInputStream(PassportService.EF_CARD_ACCESS, maxBlockSize))
        val paceInfo = cardAccess.securityInfos?.filterIsInstance<PACEInfo>()?.firstOrNull()
        if (paceInfo != null) {
          service.doPACE(bacKey, paceInfo.objectIdentifier, PACEInfo.toParameterSpec(paceInfo.parameterId), null)
          paceSucceeded = true
          authMethod = "PACE"
        }
      } catch (e: Exception) {
        if (isTagLost(e, cardService)) throw e
      }
      service.sendSelectApplet(paceSucceeded)
      if (!paceSucceeded) {
        progress.report("authenticating", 25, "Đang xác thực bảo mật (BAC)…")
        service.doBAC(bacKey)
      }

      stage = "dg1"
      progress.report("reading_dg1", 40, "Đang đọc thông tin MRZ (DG1)…")
      val mrz: MRZInfo = DG1File(service.getInputStream(PassportService.EF_DG1, maxBlockSize)).mrzInfo

      stage = "dg13"
      progress.report("reading_dg13", 65, "Đang đọc thông tin công dân (DG13)…")
      val dg13 = try {
        val bytes = service.getInputStream(PassportService.EF_DG13, maxBlockSize).use { it.readBytes() }
        try {
          Dg13Parser.parse(bytes)
        } finally {
          bytes.fill(0)
        }
      } catch (e: Exception) {
        if (isTagLost(e, cardService)) throw e
        null
      }

      val mrzName = listOfNotNull(mrz.primaryIdentifier, mrz.secondaryIdentifier)
        .joinToString(" ")
        .replace('<', ' ')
        .replace(Regex("\\s+"), " ")
        .trim()
      val sexMrz = when (mrz.gender?.toString()) {
        "MALE" -> "M"
        "FEMALE" -> "F"
        else -> "X"
      }
      progress.report("reading_dg13", 95, "Đang hoàn tất…")
      return mapOf(
        "fullNameDg13" to dg13?.fullName,
        "fullNameMrz" to mrzName,
        "dateOfBirthDg13" to dg13?.dateOfBirth,
        "dateOfBirthMrz" to mrz.dateOfBirth,
        "sexDg13" to dg13?.sex,
        "sexMrz" to sexMrz,
        "nationalityDg13" to dg13?.nationality,
        "nationalityMrz" to mrz.nationality,
        "dateOfExpiryDg13" to dg13?.dateOfExpiry,
        "dateOfExpiryMrz" to mrz.dateOfExpiry,
        "documentNumberLast3" to mrz.documentNumber?.trim()?.takeLast(3),
        "authMethod" to authMethod,
        "dg13Parsed" to (dg13?.parsed == true),
        // Only trusted when its last 9 digits match the MRZ document number the chip was unlocked with.
        "idNumberDg13" to dg13?.idNumber?.takeIf { it.takeLast(9) == mrz.documentNumber?.trim() },
        "ethnicityDg13" to dg13?.ethnicity,
        "religionDg13" to dg13?.religion,
        "placeOfOriginDg13" to dg13?.placeOfOrigin,
        "residenceDg13" to dg13?.residence,
        "issueDateDg13" to dg13?.issueDate,
        "fatherNameDg13" to dg13?.fatherName,
        "motherNameDg13" to dg13?.motherName,
      )
    } catch (e: CccdReadException) {
      throw e
    } catch (e: Exception) {
      throw classify(e, stage, cardService)
    } finally {
      runCatching { service.close() }
    }
  }

  fun isTagLost(e: Throwable, cardService: CardService? = null): Boolean {
    var t: Throwable? = e
    while (t != null) {
      if (t is TagLostException) return true
      val msg = t.message?.lowercase() ?: ""
      if ("tag was lost" in msg || "transceive failed" in msg || "tag is out of date" in msg) return true
      t = t.cause
    }
    return e is Exception && runCatching { cardService?.isConnectionLost(e) == true }.getOrDefault(false)
  }

  private fun classify(e: Exception, stage: String, cardService: CardService): CccdReadException = when {
    isTagLost(e, cardService) ->
      CccdReadException("TAG_LOST", "Mất kết nối với thẻ. Giữ thẻ áp sát, không di chuyển và thử lại.", e)
    stage == "auth" && (e is CardServiceException || e is IOException) ->
      CccdReadException("AUTH_FAILED", "Xác thực chip thất bại. Kiểm tra lại số CCCD, ngày sinh và ngày hết hạn.", e)
    else -> CccdReadException("READ_FAILED", "Không đọc được dữ liệu chip: ${e.message ?: e.javaClass.simpleName}", e)
  }
}
