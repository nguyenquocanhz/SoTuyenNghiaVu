package expo.modules.cccdnfc

import org.bouncycastle.asn1.ASN1Encodable
import org.bouncycastle.asn1.ASN1InputStream
import org.bouncycastle.asn1.ASN1Integer
import org.bouncycastle.asn1.ASN1OctetString
import org.bouncycastle.asn1.ASN1Sequence
import org.bouncycastle.asn1.ASN1Set
import org.bouncycastle.asn1.ASN1String
import org.bouncycastle.asn1.ASN1TaggedObject

/**
 * Vietnamese CCCD DG13 ("thông tin công dân") is a proprietary ASN.1 structure:
 * a list of (INTEGER field-number, string value…) pairs in the order
 * 1 ID number, 2 full name, 3 date of birth (dd/MM/yyyy), 4 sex ("Nam"/"Nữ"),
 * 5 nationality, 6 ethnicity, 7 religion, 8 place of origin, 9 residence,
 * 10 identifying marks, 11 issue date, 12 expiry date, 13 father / mother names, 14 spouse, 15 old ID.
 *
 * The military-service screening form (Mẫu 2, Phụ lục I, Thông tư 106/2025/TT-BQP) is filled from
 * the national population data, so besides the identity fields this returns ethnicity, residence and
 * parents' names. Parsing falls back to content anchors (the first dd/MM/yyyy date and "Nam"/"Nữ")
 * when field numbers are absent; results are cross-checked against DG1 in JS.
 */
internal object Dg13Parser {
  data class Fields(
    val idNumber: String? = null,
    val fullName: String? = null,
    val dateOfBirth: String? = null,
    val sex: String? = null,
    val nationality: String? = null,
    val ethnicity: String? = null,
    val religion: String? = null,
    val placeOfOrigin: String? = null,
    val residence: String? = null,
    val issueDate: String? = null,
    val dateOfExpiry: String? = null,
    val fatherName: String? = null,
    val motherName: String? = null,
  ) {
    val parsed: Boolean get() = fullName != null && dateOfBirth != null
  }

  private val DATE = Regex("^\\d{2}/\\d{2}/\\d{4}$")
  private val ID12 = Regex("^\\d{12}$")
  private val SEX = setOf("nam", "nữ", "nu")

  fun parse(bytes: ByteArray): Fields {
    val indexed = HashMap<Int, MutableList<String>>()
    val ordered = ArrayList<String>()
    try {
      ASN1InputStream(bytes).use { input ->
        var obj = input.readObject()
        while (obj != null) {
          walk(obj, null, indexed, ordered, 0)
          obj = input.readObject()
        }
      }
    } catch (_: Exception) {
      // Keep whatever was collected before a malformed tail.
    }

    fun first(i: Int) = indexed[i]?.firstOrNull()

    val byIndex = indexed.isNotEmpty() && first(3)?.let { DATE.matches(it) } == true
    if (byIndex) {
      val parents = indexed[13].orEmpty()
      return Fields(
        idNumber = first(1)?.takeIf { ID12.matches(it) },
        fullName = first(2)?.takeIf(::looksLikeName),
        dateOfBirth = first(3),
        sex = first(4)?.takeIf { it.lowercase() in SEX },
        nationality = first(5),
        ethnicity = first(6),
        religion = first(7),
        placeOfOrigin = first(8),
        residence = first(9),
        issueDate = first(11)?.takeIf { DATE.matches(it) },
        dateOfExpiry = first(12),
        fatherName = parents.getOrNull(0)?.takeIf(::looksLikeName),
        motherName = parents.getOrNull(1)?.takeIf(::looksLikeName),
      )
    }

    val dobAt = ordered.indexOfFirst { DATE.matches(it) }
    if (dobAt < 0) return Fields()
    val name = ordered.getOrNull(dobAt - 1)?.takeIf(::looksLikeName)
    val sex = ordered.getOrNull(dobAt + 1)?.takeIf { it.lowercase() in SEX }
    // Positional fallback beyond sex/nationality only when the sex anchor confirms the expected order.
    val at = { offset: Int -> if (sex != null) ordered.getOrNull(dobAt + offset) else null }
    return Fields(
      idNumber = ordered.getOrNull(dobAt - 2)?.takeIf { ID12.matches(it) },
      fullName = name,
      dateOfBirth = ordered[dobAt],
      sex = sex,
      nationality = at(2),
      ethnicity = at(3),
      religion = at(4),
      placeOfOrigin = at(5),
      residence = at(6),
      issueDate = at(8)?.takeIf { DATE.matches(it) },
      dateOfExpiry = ordered.getOrNull(dobAt + 9),
      fatherName = at(10)?.takeIf(::looksLikeName),
      motherName = at(11)?.takeIf(::looksLikeName),
    )
  }

  private fun looksLikeName(value: String): Boolean =
    value.length in 2..80 && value.any { it.isLetter() } && value.none { it.isDigit() }

  private fun walk(node: ASN1Encodable, index: Int?, indexed: MutableMap<Int, MutableList<String>>, ordered: MutableList<String>, depth: Int) {
    if (depth > 12) return
    when (val obj = node.toASN1Primitive()) {
      is ASN1String -> add(obj.string, index, indexed, ordered)
      is ASN1Sequence -> walkCollection((0 until obj.size()).map { obj.getObjectAt(it) }, index, indexed, ordered, depth)
      is ASN1Set -> walkCollection((0 until obj.size()).map { obj.getObjectAt(it) }, index, indexed, ordered, depth)
      is ASN1TaggedObject -> walk(obj.baseObject, index, indexed, ordered, depth + 1)
      is ASN1OctetString -> {
        val octets = obj.octets
        val nested = try {
          ASN1InputStream(octets).use { it.readObject() }
        } catch (_: Exception) {
          null
        }
        if (nested != null) walk(nested, index, indexed, ordered, depth + 1) else decodeText(octets)?.let { add(it, index, indexed, ordered) }
      }
    }
  }

  private fun walkCollection(children: List<ASN1Encodable>, index: Int?, indexed: MutableMap<Int, MutableList<String>>, ordered: MutableList<String>, depth: Int) {
    val first = children.firstOrNull()?.toASN1Primitive()
    val fieldNumber = (first as? ASN1Integer)?.value?.takeIf { it.bitLength() < 16 }?.toInt()
    val rest = if (fieldNumber != null) children.drop(1) else children
    rest.forEach { walk(it, fieldNumber ?: index, indexed, ordered, depth + 1) }
  }

  private fun add(raw: String, index: Int?, indexed: MutableMap<Int, MutableList<String>>, ordered: MutableList<String>) {
    val value = raw.trim()
    if (value.isEmpty()) return
    ordered.add(value)
    if (index != null) indexed.getOrPut(index) { ArrayList() }.add(value)
  }

  private fun decodeText(bytes: ByteArray): String? {
    if (bytes.isEmpty()) return null
    if (bytes.any { val c = it.toInt() and 0xFF; c < 32 && c != 9 && c != 10 && c != 13 }) return null
    return String(bytes, Charsets.UTF_8).trim().ifEmpty { null }
  }
}
