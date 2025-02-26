import { isHex } from "viem";
import * as dotenv from "dotenv";
dotenv.config();

if (!process.env.NEXT_PUBLIC_DEPLOYER_PRIVATE_KEY) {
  throw new Error("DEPLOYER_PRIVATE_KEY environment variable is required");
}
if (!isHex(process.env.NEXT_PUBLIC_DEPLOYER_PRIVATE_KEY)) {
  throw new Error("NEXT_PUBLIC_DEPLOYER_PRIVATE_KEY does not start with 0x");
}
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
if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
  throw new Error("BACKEND_URL environment variable is required");
}

const DEPLOYER_PRIVATE_KEY = process.env.NEXT_PUBLIC_DEPLOYER_PRIVATE_KEY;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL;
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const EMAIL_SIGNER_FACTORY_ADDRESS =
  process.env.NEXT_PUBLIC_EMAIL_SIGNER_FACTORY_ADDRESS;

export {
  RPC_URL,
  RELAYER_URL,
  BACKEND_URL,
  EMAIL_SIGNER_FACTORY_ADDRESS,
  DEPLOYER_PRIVATE_KEY,
};
