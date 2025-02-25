"use client";
import {
  bytesToHex,
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
} from "viem";
import {
  DEPLOYER_PRIVATE_KEY,
  EMAIL_SIGNER_FACTORY_ADDRESS,
  RELAYER_URL,
  RPC_URL,
} from "./config";
import { baseSepolia } from "viem/chains";
import { useState } from "react";
import { privateKeyToAccount } from "viem/accounts";
import { buildPoseidon } from "circomlibjs";

const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(RPC_URL),
});

export default function Home() {
  const [email, setEmail] = useState("");
  const [emailSignerAddress, setEmailSignerAddress] = useState("");

  const generateAccountCode = async () => {
    const poseidon = await buildPoseidon();
    const accountCodeBytes: Uint8Array = poseidon.F.random();
    return bytesToHex(accountCodeBytes.reverse());
  };

  const getOrDeployEmailSigner = async (email: string) => {
    const accountCode = await generateAccountCode();

    const { accountSalt } = await fetch(`${RELAYER_URL}/api/accountSalt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountCode: accountCode,
        emailAddress: email,
      }),
    }).then((res) => res.json());
    console.log("accountSalt: ", accountSalt);

    const emailSignerFactoryAbi = parseAbi([
      "function predictAddress(bytes32 accountSalt) view returns (address)",
      "function deploy(bytes32 accountSalt) returns (address)",
    ]);

    const emailSignerAddress = await publicClient.readContract({
      address: EMAIL_SIGNER_FACTORY_ADDRESS,
      abi: emailSignerFactoryAbi,
      functionName: "predictAddress",
      args: [accountSalt],
    });
    console.log("emailSignerAddress: ", emailSignerAddress);

    const bytecode = await publicClient.getCode({
      address: emailSignerAddress,
    });
    const isEmailSignerDeployed = !!bytecode;
    console.log("Email signer contract deployed:", isEmailSignerDeployed);

    if (!isEmailSignerDeployed) {
      console.log("Deploying email signer contract...");
      const deployTxHash = await walletClient.writeContract({
        address: EMAIL_SIGNER_FACTORY_ADDRESS,
        abi: emailSignerFactoryAbi,
        functionName: "deploy",
        args: [accountSalt],
      });
      await publicClient.waitForTransactionReceipt({ hash: deployTxHash });
      console.log("Email signer contract deployed successfully");
    } else {
      console.log("Email signer contract already deployed");
    }

    setEmailSignerAddress(emailSignerAddress);
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1>Email Signer</h1>
        <p>Email Signer Address: {emailSignerAddress}</p>
        <form action={() => getOrDeployEmailSigner(email)}>
          <input
            type="text"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit">Generate email signer</button>
        </form>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center"></footer>
    </div>
  );
}
