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
        <div className="w-full h-full rounded-lg shadow-md p-4 flex-1">
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
        <div className="w-full h-full rounded-lg shadow-md p-4 flex-1">
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
    <main className="min-h-screen p-2 pt-[120px] md:p-6 md:pt-[160px] max-w-[768px] mx-auto">
      <header className="relative overflow-hidden rounded-t-2xl h-80">
        <div 
          className="absolute inset-0 bg-cover bg-center z-0" 
          style={{ backgroundImage: "url('/bg-image.png')" }}
        ></div>
        <div className="relative z-10 p-6 bg-black/40 text-white h-full flex flex-col justify-end">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Email Signer &#123;Sepolia&#125;</h1>
              <p className="text-gray-200 mt-1">
                Deploy and manage your email signer accounts
              </p>
            </div>
            
            {/* Wallet connection status */}
            {isWalletConnected && walletAddress && (
              <div className="flex items-center bg-black/50 px-3 py-2 rounded-lg">
                <div className="flex items-center mr-3">
                  <div className="h-2 w-2 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-sm font-medium">
                    {`${walletAddress.substring(0, 6)}...${walletAddress.substring(
                      walletAddress.length - 4
                    )}`}
                  </span>
                </div>
                <button
                  onClick={handleWalletDisconnect}
                  className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="w-full bg-[#111314] border border-[#272727] rounded-none rounded-b-[24px] p-4">
        {isWalletConnected ? (
          <TabInterface tabs={tabs} defaultTabId="registration" />
        ) : (
          <div className="w-full">
            <WalletConnect
              onConnect={handleWalletConnect}
              onDisconnect={handleWalletDisconnect}
              isConnected={isWalletConnected}
              address={walletAddress}
            />
          </div>
        )}
      </div>
    </main>
  );
}
