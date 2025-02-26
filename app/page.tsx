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
            <HashApproval
              email={email}
              setEmail={setEmail}
              accountCode={accountCode}
              setAccountCode={setAccountCode}
            />
          </div>
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
