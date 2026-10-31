package com.proofofready.seeker;

/** Converts Android's canonical positive DER integers into the P-256 P1363 wire format. */
public final class SignatureEncoding {
    private SignatureEncoding() { }
    public static byte[] p1363(byte[] der) {
        if (der == null || der.length < 8 || der.length > 72 || der[0] != 0x30 || (der[1] & 255) != der.length - 2) throw new IllegalArgumentException("Invalid ECDSA encoding.");
        int offset = 2; byte[] result = new byte[64];
        for (int part = 0; part < 2; part++) {
            if (offset + 2 > der.length || der[offset++] != 2) throw new IllegalArgumentException("Invalid ECDSA integer.");
            int encodedLength = der[offset++] & 255;
            int length = encodedLength;
            if (length < 1 || length > 33 || offset + length > der.length || (der[offset] & 0x80) != 0 || (length > 1 && der[offset] == 0 && (der[offset + 1] & 0x80) == 0)) throw new IllegalArgumentException("Invalid ECDSA integer.");
            int start = offset;
            if (length == 33) { if (der[start++] != 0) throw new IllegalArgumentException("Oversized ECDSA integer."); length--; }
            boolean zero = true; for (int index = 0; index < length; index++) zero &= der[start + index] == 0;
            if (zero) throw new IllegalArgumentException("Zero ECDSA integer.");
            System.arraycopy(der, start, result, part * 32 + 32 - length, length);
            offset += encodedLength;
        }
        if (offset != der.length) throw new IllegalArgumentException("Trailing ECDSA data.");
        return result;
    }
}
