package expo.modules.cccdnfc

import net.sf.scuba.smartcards.CardService
import net.sf.scuba.smartcards.CommandAPDU
import net.sf.scuba.smartcards.ResponseAPDU

/**
 * Wraps the IsoDep card service and enforces a minimum delay between APDUs.
 * Samsung / Snapdragon NFC controllers (e.g. Galaxy Note 10, SM-N970U) drop the
 * field under sustained large transfers; a short gap keeps the Vietnamese CCCD
 * chip powered long enough to finish DG reads.
 */
internal class ThrottledCardService(
  private val delegate: CardService,
  private val minGapMs: Long,
) : CardService() {
  private var lastTransmitAt = 0L

  override fun open() {
    if (!delegate.isOpen) delegate.open()
  }

  override fun isOpen(): Boolean = delegate.isOpen

  override fun transmit(command: CommandAPDU?): ResponseAPDU {
    if (minGapMs > 0) {
      val wait = minGapMs - (System.currentTimeMillis() - lastTransmitAt)
      if (wait > 0) {
        try {
          Thread.sleep(wait)
        } catch (_: InterruptedException) {
          Thread.currentThread().interrupt()
        }
      }
    }
    val response = delegate.transmit(command)
    lastTransmitAt = System.currentTimeMillis()
    return response
  }

  override fun getATR(): ByteArray? = delegate.atr

  override fun close() {
    delegate.close()
  }

  override fun isConnectionLost(e: Exception?): Boolean = delegate.isConnectionLost(e)
}
