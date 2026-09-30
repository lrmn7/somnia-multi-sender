import crypto from "crypto";
import { verifyMessage, isAddress } from "viem";
import { config } from "../config/index.js";
import { db } from "../db/index.js";
import { authNonces, sessions, users } from "../db/schema.js";
import { eq, and, gt, isNull } from "drizzle-orm";

export interface StoredNonce {
  walletAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  messageText: string;
  used: boolean;
}

const memoryNonceStore = new Map<string, StoredNonce>();
const memorySessionStore = new Map<string, { walletAddress: string; expiresAt: Date }>();

export interface FormatAuthMessageParams {
  domain: string;
  walletAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  chainId: number;
  purpose: string;
}

export function formatDeterministicAuthMessage(params: FormatAuthMessageParams): string {
  return [
    `${params.domain} wants you to sign in with your Somnia account:`,
    `${params.walletAddress.toLowerCase()}`,
    ``,
    `Purpose: ${params.purpose}`,
    ``,
    `Chain ID: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
    `Expiration Time: ${params.expiresAt}`,
  ].join("\n");
}

export async function generateNonce(walletAddress: string): Promise<{
  nonce: string;
  message: string;
  issuedAt: string;
  expiresAt: string;
}> {
  if (!isAddress(walletAddress)) {
    throw new Error("Invalid wallet address format");
  }

  const normalized = walletAddress.toLowerCase();
  const nonce = crypto.randomBytes(16).toString("hex");
  const now = new Date();
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + config.auth.nonceTtlSeconds * 1000).toISOString();
  const domain = "somnia.multisender.network";
  const purpose = "Wallet-signature authentication for Somnia Multisender operations";

  const message = formatDeterministicAuthMessage({
    domain,
    walletAddress: normalized,
    nonce,
    issuedAt,
    expiresAt,
    chainId: config.network.chainId,
    purpose,
  });

  // Store in memory cache
  memoryNonceStore.set(`${normalized}:${nonce}`, {
    walletAddress: normalized,
    nonce,
    issuedAt,
    expiresAt,
    messageText: message,
    used: false,
  });

  // Store in database
  try {
    await db.insert(authNonces).values({
      walletAddress: normalized,
      nonce,
      issuedAt,
      messageText: message,
      expiresAt: new Date(expiresAt),
    });
  } catch (err) {
    // Memory store handles fallback for unit tests
  }

  return { nonce, message, issuedAt, expiresAt };
}

export async function verifySignature(
  walletAddress: string,
  nonce: string,
  signature: `0x${string}`
): Promise<{
  sessionToken: string;
  expiresAt: Date;
  walletAddress: string;
}> {
  if (!isAddress(walletAddress)) {
    throw new Error("Invalid wallet address format");
  }

  const normalized = walletAddress.toLowerCase();
  const cacheKey = `${normalized}:${nonce}`;
  let storedNonce = memoryNonceStore.get(cacheKey);

  // If not in memory, query DB
  if (!storedNonce) {
    try {
      const dbNonce = await db.query.authNonces.findFirst({
        where: and(
          eq(authNonces.walletAddress, normalized),
          eq(authNonces.nonce, nonce),
          isNull(authNonces.usedAt),
          gt(authNonces.expiresAt, new Date())
        ),
      });

      if (dbNonce) {
        storedNonce = {
          walletAddress: dbNonce.walletAddress,
          nonce: dbNonce.nonce,
          issuedAt: dbNonce.issuedAt || dbNonce.createdAt.toISOString(),
          expiresAt: dbNonce.expiresAt.toISOString(),
          messageText: dbNonce.messageText || "",
          used: !!dbNonce.usedAt,
        };
      }
    } catch (e) {
      // Ignored
    }
  }

  if (!storedNonce || storedNonce.used) {
    throw new Error("Invalid, expired, or previously used nonce");
  }

  // Check expiration
  if (new Date(storedNonce.expiresAt).getTime() < Date.now()) {
    throw new Error("Authentication nonce has expired");
  }

  // Deterministically reconstruct the exact same message using the stored issuedAt
  const expectedMessage =
    storedNonce.messageText ||
    formatDeterministicAuthMessage({
      domain: "somnia.multisender.network",
      walletAddress: normalized,
      nonce: storedNonce.nonce,
      issuedAt: storedNonce.issuedAt,
      expiresAt: storedNonce.expiresAt,
      chainId: config.network.chainId,
      purpose: "Wallet-signature authentication for Somnia Multisender operations",
    });

  // Verify cryptographic signature
  const isValid = await verifyMessage({
    address: walletAddress,
    message: expectedMessage,
    signature,
  });

  if (!isValid) {
    throw new Error("Cryptographic wallet signature verification failed");
  }

  // Invalidate nonce immediately to prevent replay
  storedNonce.used = true;
  memoryNonceStore.set(cacheKey, storedNonce);

  try {
    await db
      .update(authNonces)
      .set({ usedAt: new Date() })
      .where(and(eq(authNonces.walletAddress, normalized), eq(authNonces.nonce, nonce)));
  } catch (err) {
    // Memory store handles fallback
  }

  // Issue session token (7-day validity)
  const sessionToken = `ses_${crypto.randomBytes(32).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

  memorySessionStore.set(sessionToken, {
    walletAddress: normalized,
    expiresAt,
  });

  try {
    await db.insert(sessions).values({
      walletAddress: normalized,
      sessionToken,
      expiresAt,
    });

    const existingUser = await db.query.users.findFirst({
      where: eq(users.walletAddress, normalized),
    });

    if (!existingUser) {
      await db.insert(users).values({
        walletAddress: normalized,
        lastSeenAt: new Date(),
      });
    } else {
      await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, existingUser.id));
    }
  } catch (e) {
    // Memory store handles fallback
  }

  return {
    sessionToken,
    expiresAt,
    walletAddress: normalized,
  };
}

export async function getSessionUser(sessionToken?: string | null): Promise<string | null> {
  if (!sessionToken) return null;

  // Check memory store
  const cached = memorySessionStore.get(sessionToken);
  if (cached) {
    if (cached.expiresAt.getTime() > Date.now()) {
      return cached.walletAddress;
    } else {
      memorySessionStore.delete(sessionToken);
      return null;
    }
  }

  // Check DB
  try {
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.sessionToken, sessionToken),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date())
      ),
    });

    if (session) {
      memorySessionStore.set(sessionToken, {
        walletAddress: session.walletAddress,
        expiresAt: session.expiresAt,
      });
      return session.walletAddress;
    }
  } catch (e) {
    // Fallback
  }

  return null;
}
