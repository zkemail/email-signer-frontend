"use client";
import { createWalletClient, custom, WalletClient } from "viem";
import React, { useState } from "react";
import { sepolia } from "viem/chains";
import HashApproval from "./components/HashApproval";
import TabInterface from "./components/TabInterface";
import WalletConnect from "./components/WalletConnect";

export default function Home() {
  const [email, setEmail] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [logs, setLogs] = useState<string[]>([]);
  const [accountCode, setAccountCode] = useState<string>("");

  // Add wallet connection state
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletClient, setWalletClient] = useState<WalletClient>();

  const addLog = (message: string) => {
    setLogs((prevLogs) => [...prevLogs, message]);
  };

  const handleWalletConnect = (address: string) => {
    setWalletAddress(address);
    setIsWalletConnected(true);

    // Create wallet client using the connected MetaMask
    const client = createWalletClient({
      chain: sepolia,
      transport: custom(window.ethereum),
    });
    setWalletClient(client);

    addLog(`Connected to wallet: ${address}`);
  };

  const handleWalletDisconnect = () => {
    setWalletAddress("");
    setIsWalletConnected(false);
    setWalletClient(undefined);
    addLog("Wallet disconnected");
  };

  // Create tabs configuration
  const tabs = [
    {
      id: "registration",
      label: "Register",
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
        </div>
      ),
    },
    {
      id: "approveHash",
      label: "Approve Hash",
      content: (
        <div className="w-full h-full bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 flex-1">
          <div className="h-full">
            <HashApproval
              email={email}
              setEmail={setEmail}
              accountCode={accountCode}
              setAccountCode={setAccountCode}
              walletClient={walletClient}
              walletAddress={walletAddress}
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <main className="min-h-screen p-2 md:p-6 max-w-6xl mx-auto">
      <header className="mb-4">
        <h1 className="text-3xl font-bold">Email Signer &#123;Sepolia&#125;</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Deploy and manage your email signer accounts
        </p>
      </header>

      <TabInterface tabs={tabs} defaultTabId="registration" />
    </main>
  );
}
