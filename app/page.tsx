"use client";
import {
  bytesToHex,
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseAbi,
} from "viem";
import React, { useState, useEffect } from "react";
import {
  EMAIL_SIGNER_FACTORY_ADDRESS,
  RELAYER_URL,
  RPC_URL,
  BACKEND_URL,
} from "./config";
import { sepolia } from "viem/chains";
import { buildPoseidon } from "circomlibjs";
import HashApproval from './components/HashApproval';
import TabInterface from './components/TabInterface';
import WalletConnect from './components/WalletConnect';

// Set up public client without wallet
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

export default function Home() {
  const [email, setEmail] = useState("");
  const [emailSignerAddress, setEmailSignerAddress] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [accountCode, setAccountCode] = useState<string>("");
  const [existingAccountCode, setExistingAccountCode] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Add wallet connection state
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletClient, setWalletClient] = useState<any>(null);

  const addLog = (message: string) => {
    setLogs((prevLogs) => [...prevLogs, message]);
  };

  const handleWalletConnect = (address: string) => {
    setWalletAddress(address);
    setIsWalletConnected(true);

    // Create wallet client using the connected MetaMask
    const client = createWalletClient({
      chain: sepolia,
      transport: custom((window as any).ethereum)
    });
    setWalletClient(client);

    addLog(`Connected to wallet: ${address}`);
  };

  const handleWalletDisconnect = () => {
    setWalletAddress(null);
    setIsWalletConnected(false);
    setWalletClient(null);
    addLog("Wallet disconnected");
  };

  const generateAccountCode = async () => {
    // Create a new array with exactly 32 random bytes
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);

    // Convert to hex with 0x prefix
    return bytesToHex(randomBytes);
  };

  const checkExistingAccountCode = (email: string) => {
    try {
      const storedAccounts = localStorage.getItem('accountCodes');
      if (storedAccounts) {
        const accounts = JSON.parse(storedAccounts) as Record<string, string>;
        if (accounts[email]) {
          // Validate that the account code starts with 0x
          const code = accounts[email];
          console.log(`this is the code: ${code}`);
          if (code.startsWith('0x')) {
            console.log(`Found existing account code for ${email}: ${code}`);
            setExistingAccountCode(code);
            return code;
          } else {
            // If invalid format, delete it from localStorage
            delete accounts[email];
            localStorage.setItem('accountCodes', JSON.stringify(accounts));
            return null;
          }
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const saveAccountCode = (email: string, code: string) => {
    try {
      const storedAccounts = localStorage.getItem('accountCodes');
      const accounts = storedAccounts ? JSON.parse(storedAccounts) : {};
      accounts[email] = code;
      localStorage.setItem('accountCodes', JSON.stringify(accounts));
    } catch (error) {
      console.error('Error saving to local storage:', error);
    }
  };

  const getOrDeployEmailSigner = async (email: string, userProvidedAccountCode?: string) => {
    if (!email) {
      addLog("Error: Email is required");
      return;
    }

    if (!isWalletConnected || !walletClient) {
      addLog("Error: Please connect your wallet first");
      return;
    }

    try {
      setIsLoading(true);
      setLogs([]);

      let accountCode;
      if (userProvidedAccountCode) {
        accountCode = userProvidedAccountCode;
        addLog("Using provided account code...");
      } else {
        addLog("Generating account code...");
        accountCode = await generateAccountCode();
        saveAccountCode(email, accountCode);
      }
      setAccountCode(accountCode);

      addLog("Fetching account salt from relayer...");
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
      addLog(`Account salt: ${accountSalt}`);

      const emailSignerFactoryAbi = parseAbi([
        "function predictAddress(bytes32 accountSalt) view returns (address)",
        "function deploy(bytes32 accountSalt) returns (address)",
      ]);

      addLog("Predicting email signer address...");
      const emailSignerAddress = await publicClient.readContract({
        address: EMAIL_SIGNER_FACTORY_ADDRESS,
        abi: emailSignerFactoryAbi,
        functionName: "predictAddress",
        args: [accountSalt],
      });
      addLog(`Email signer address: ${emailSignerAddress}`);

      const bytecode = await publicClient.getCode({
        address: emailSignerAddress,
      });
      const isEmailSignerDeployed = !!bytecode;
      addLog(`Email signer contract deployed: ${isEmailSignerDeployed}`);

      if (!isEmailSignerDeployed) {
        addLog("Deploying email signer contract...");

        // Use the connected wallet client instead of the hardcoded one
        const deployTxHash = await walletClient.writeContract({
          address: EMAIL_SIGNER_FACTORY_ADDRESS,
          abi: emailSignerFactoryAbi,
          functionName: "deploy",
          args: [accountSalt],
          account: walletAddress,
        });

        addLog(`Deployment transaction hash: ${deployTxHash}`);

        addLog("Waiting for transaction confirmation...");
        await publicClient.waitForTransactionReceipt({ hash: deployTxHash });
        addLog("Email signer contract deployed successfully");
      } else {
        addLog("Email signer contract already deployed");
      }

      setEmailSignerAddress(emailSignerAddress);
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Registration flow components
  const registrationContent = (
    <>
      <div className="w-full h-full bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 flex-1">
        <div className="h-full">
          <WalletConnect
            onConnect={handleWalletConnect}
            onDisconnect={handleWalletDisconnect}
            isConnected={isWalletConnected}
            address={walletAddress}
          />
        </div>
      </div>
    </>
  );

  // Create tabs configuration
  const tabs = [
    {
      id: 'registration',
      label: 'Register',
      content: registrationContent
    },
    {
      id: 'approveHash',
      label: 'Approve Hash',
      content: (
        <div className="w-full h-full bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 flex-1">
          <div className="h-full">
            <WalletConnect
              onConnect={handleWalletConnect}
              onDisconnect={handleWalletDisconnect}
              isConnected={isWalletConnected}
              address={walletAddress}
            />
          </div>
          <HashApproval
            email={email}
            setEmail={setEmail}
            accountCode={accountCode}
            setAccountCode={setAccountCode}
          />
        </div>
      )
    }
  ];

  return (
    <main className="min-h-screen p-2 md:p-6 max-w-6xl mx-auto">
      <header className="mb-4">
        <h1 className="text-3xl font-bold">Email Signer</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Deploy and manage your email signer accounts
        </p>
      </header>

      <TabInterface tabs={tabs} defaultTabId="registration" />
    </main>
  );
}
