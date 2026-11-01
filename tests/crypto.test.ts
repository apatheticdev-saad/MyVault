import { describe, expect, it } from "vitest";
import { createPinVerifier, verifyPin, encryptText, decryptText } from "../src/worker/lib/crypto";
describe("MyVault security primitives", () => {
    it("verifies the correct PIN and rejects an incorrect PIN", async () => {
        const pepper = "test-only-pepper-not-for-production";
        const verifier = await createPinVerifier("482916", pepper);
        await expect(verifyPin("482916", verifier.salt, verifier.hash, pepper)).resolves.toBe(true);
        await expect(verifyPin("482915", verifier.salt, verifier.hash, pepper)).resolves.toBe(false);
    });
    it("encrypts and decrypts stored provider tokens", async () => {
        const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        const encrypted = await encryptText("refresh-token-test", key);
        expect(encrypted).not.toContain("refresh-token-test");
        await expect(decryptText(encrypted, key)).resolves.toBe("refresh-token-test");
    });
});
