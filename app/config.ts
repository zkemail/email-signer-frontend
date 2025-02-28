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
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL;
const EMAIL_SIGNER_FACTORY_ADDRESS =
  process.env.NEXT_PUBLIC_EMAIL_SIGNER_FACTORY_ADDRESS;

export { RPC_URL, RELAYER_URL, EMAIL_SIGNER_FACTORY_ADDRESS };
