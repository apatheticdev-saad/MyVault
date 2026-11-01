
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFile } from "node:fs/promises";

async function question(prompt) {
  const rl = createInterface({ input, output });
  try {
    return await rl.question(prompt);
  } finally {
    rl.close();
  }
}

async function readHidden(prompt) {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    return question(prompt);
  }

  output.write(prompt);
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let value = "";

    const cleanup = () => {
      input.setRawMode(false);
      input.pause();
      input.removeListener("data", onData);
      output.write("\n");
    };

    const onData = (chunk) => {
      const key = chunk.toString("utf8");

      if (key === "\u0003") {
        cleanup();
        reject(new Error("Cancelled."));
        return;
      }

      if (key === "\r" || key === "\n") {
        cleanup();
        resolve(value);
        return;
      }

      if (key === "\u007f" || key === "\b") {
        value = value.slice(0, -1);
        return;
      }

      if (key >= " " && key <= "~") {
        value += key;
      }
    };

    input.on("data", onData);
  });
}

async function getSetupSecret() {
  const contents = await readFile(
    new URL("../.dev.vars", import.meta.url),
    "utf8"
  );

  const match = contents.match(/^SETUP_SECRET="([^"]+)"$/m);
  const secret = match?.[1];

  if (!secret || !/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error(
      "A valid SETUP_SECRET was not found in .dev.vars."
    );
  }

  return secret;
}

const origin = (
  process.env.MYVAULT_URL || "http://127.0.0.1:8787"
).replace(/\/$/, "");

try {
  const setupSecret = await getSetupSecret();

  console.log("Setup secret loaded securely from .dev.vars.");

  const pinLengthAnswer = await question(
    "PIN length (4 or 6) [6]: "
  );

  const pinLength = pinLengthAnswer.trim() === "4" ? 4 : 6;

  const pin = await readHidden(
    `Choose your ${pinLength}-digit PIN (hidden): `
  );

  const confirm = await readHidden(
    "Confirm PIN (hidden): "
  );

  if (
    pin !== confirm ||
    !new RegExp(`^\\d{${pinLength}}$`).test(pin)
  ) {
    throw new Error(
      "PINs do not match or have an invalid length."
    );
  }

  const response = await fetch(`${origin}/api/auth/setup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Setup-Secret": setupSecret,
    },
    body: JSON.stringify({ pin, pinLength }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || `Setup failed (${response.status}).`
    );
  }

  console.log("\nMyVault owner setup completed.\n");
  console.log(
    "RECOVERY KEY — SAVE THIS OFFLINE. IT WILL NOT BE SHOWN AGAIN:\n"
  );
  console.log(data.recoveryKey);
  console.log(
    "\nKeep this key separate from your PIN. Do not commit it to GitHub.\n"
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Owner setup failed."
  );
  process.exitCode = 1;
}
