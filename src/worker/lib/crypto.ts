const encoder = new TextEncoder();
export function randomToken(bytes = 32): string {
    const data = crypto.getRandomValues(new Uint8Array(bytes));
    return toBase64Url(data);
}
export function toBase64Url(data: Uint8Array): string {
    let binary = "";
    for (const byte of data)
        binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
export function fromBase64Url(value: string): Uint8Array {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
export async function sha256(value: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
    return toBase64Url(new Uint8Array(digest));
}
export async function hmac(value: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
    return toBase64Url(new Uint8Array(signature));
}
export function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length)
        return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i += 1)
        mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return mismatch === 0;
}
export async function encryptText(plaintext: string, keyHex: string): Promise<string> {
    if (!/^[0-9a-f]{64}$/i.test(keyHex))
        throw new Error("APP_ENCRYPTION_KEY must be 64 hexadecimal characters.");
    const keyBytes = Uint8Array.from(keyHex.match(/.{2}/g)!, (part) => parseInt(part, 16));
    const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));
    return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}
export async function decryptText(payload: string, keyHex: string): Promise<string> {
    if (!/^[0-9a-f]{64}$/i.test(keyHex))
        throw new Error("APP_ENCRYPTION_KEY must be 64 hexadecimal characters.");
    const [ivPart, cipherPart] = payload.split(".");
    if (!ivPart || !cipherPart)
        throw new Error("Encrypted value is malformed.");
    const keyBytes = Uint8Array.from(keyHex.match(/.{2}/g)!, (part) => parseInt(part, 16));
    const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(ivPart) }, key, fromBase64Url(cipherPart));
    return new TextDecoder().decode(plain);
}
export async function createPinVerifier(pin: string, pepper: string): Promise<{
    salt: string;
    hash: string;
}> {
    const salt = randomToken(16);
    return { salt, hash: await hmac(`${salt}:${pin}`, pepper) };
}
export async function verifyPin(pin: string, salt: string, expected: string, pepper: string): Promise<boolean> {
    const actual = await hmac(`${salt}:${pin}`, pepper);
    return safeEqual(actual, expected);
}
