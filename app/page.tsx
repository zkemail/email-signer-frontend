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

  const handleWalletConnect = (address: string, client: WalletClient) => {
    setWalletAddress(address);
    setIsWalletConnected(true);
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
      <header className="relative overflow-hidden rounded-t-2xl h-80">
        <div 
          className="absolute inset-0 bg-cover bg-center z-0" 
          style={{ backgroundImage: "url('/bg-image.png')" }}
        ></div>
        <div className="relative z-10 p-6 bg-black/40 text-white h-full flex flex-col justify-end">
          <h1 className="text-3xl font-bold">Email Signer &#123;Sepolia&#125;</h1>
          <p className="text-gray-200 mt-1">
            Deploy and manage your email signer accounts
          </p>
        </div>
      </header>

      {!isWalletConnected ? (
        <div className="w-full bg-white dark:bg-slate-800 rounded-lg shadow-md p-4">
          <div className="max-w-md mx-auto">
            <WalletConnect
              onConnect={handleWalletConnect}
              onDisconnect={handleWalletDisconnect}
              isConnected={isWalletConnected}
              address={walletAddress}
            />
          </div>
        </div>
      ) : (
        <TabInterface tabs={tabs} defaultTabId="registration" />
      )}
    </main>
  );
}
