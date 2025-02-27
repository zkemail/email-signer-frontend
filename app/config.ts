import { isHex } from "viem";
import * as dotenv from "dotenv";
dotenv.config();

if (!process.env.NEXT_PUBLIC_RPC_URL) {
  throw new Error("RPC_URL environment variable is required");
}
if (!process.env.NEXT_PUBLIC_RELAYER_URL) {
  throw new Error("RELAYER_URL environment variable is required");
}
if (!process.env.NEXT_PUBLIC_EMAIL_SIGNER_FACTORY_ADDRESS) {
  throw new Error(
    "EMAIL_SIGNER_FACTORY_ADDRESS environment variable is required"
  );
}
if (!isHex(process.env.NEXT_PUBLIC_EMAIL_SIGNER_FACTORY_ADDRESS)) {
  throw new Error("EMAIL_SIGNER_FACTORY_ADDRESS does not start with 0x");
}
if (!process.env.NEXT_PUBLIC_SAFE_TX_SERVICE_URL) {
  throw new Error(
    "NEXT_PUBLIC_SAFE_TX_SERVICE_URL environment variable is required"
  );
}

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL;
const EMAIL_SIGNER_FACTORY_ADDRESS =
  process.env.NEXT_PUBLIC_EMAIL_SIGNER_FACTORY_ADDRESS;
const SAFE_TX_SERVICE_URL = process.env.NEXT_PUBLIC_SAFE_TX_SERVICE_URL;
const SAFE_TRUSTED_FOR_DELEGATE_CALL = (
  process.env.NEXT_PUBLIC_SAFE_TRUSTED_FOR_DELEGATE_CALL || ""
).split(",");

export {
  RPC_URL,
  RELAYER_URL,
  EMAIL_SIGNER_FACTORY_ADDRESS,
  SAFE_TX_SERVICE_URL,
  SAFE_TRUSTED_FOR_DELEGATE_CALL,
};
