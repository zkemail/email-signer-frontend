"use client";
import {
  bytesToHex,
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseAbi,
} from "viem";
import {
  EMAIL_SIGNER_FACTORY_ADDRESS,
  RELAYER_URL,
  RPC_URL,
  BACKEND_URL,
} from "./config";
import { sepolia } from "viem/chains";
import { useState, useEffect } from "react";
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
      transport: custom(window.ethereum)
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
    const poseidon = await buildPoseidon();
    const accountCodeBytes: Uint8Array = poseidon.F.random();
    return bytesToHex(accountCodeBytes.reverse());
  };

  const checkExistingAccountCode = (email: string) => {
    try {
      const storedAccounts = localStorage.getItem('accountCodes');
      if (storedAccounts) {
        const accounts = JSON.parse(storedAccounts) as Record<string, string>;
        if (accounts[email]) {
          setExistingAccountCode(accounts[email]);
          return accounts[email];
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

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isWalletConnected) {
      addLog("Please connect your wallet first");
      return;
    }

    const existing = checkExistingAccountCode(email);

    if (existing) {
      setShowConfirmation(true);
    } else {
      getOrDeployEmailSigner(email);
    }
  };

  const useExistingAccountCode = () => {
    if (existingAccountCode) {
      getOrDeployEmailSigner(email, existingAccountCode);
      setShowConfirmation(false);
    }
  };

  const createNewAccountCode = () => {
    getOrDeployEmailSigner(email);
    setShowConfirmation(false);
  };

  // Registration flow components
  const registrationContent = (
    <>
      <div className="w-full bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
        <div className="mb-6">
          <WalletConnect
            onConnect={handleWalletConnect}
            onDisconnect={handleWalletDisconnect}
            isConnected={isWalletConnected}
            address={walletAddress}
          />
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleEmailSubmit(e);
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="email-reg" className="text-sm font-medium">Email Address</label>
            <input
              id="email-reg"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700"
              placeholder="Enter your email address"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !isWalletConnected}
            className={`p-2 rounded-md text-white font-medium ${isLoading || !isWalletConnected
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
              }`}
          >
            {isLoading ? "Processing..." : "Generate Email Signer"}
          </button>
        </form>
      </div>

      {emailSignerAddress && (
        <div className="w-full bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-semibold mb-2">Email Signer Address</h2>
          <div className="p-3 bg-gray-100 dark:bg-slate-700 rounded-md font-mono text-sm break-all">
            {emailSignerAddress}
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="w-full bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-semibold mb-2">Logs</h2>
          <div className="h-64 overflow-y-auto p-3 bg-gray-100 dark:bg-slate-700 rounded-md font-mono text-sm">
            {logs.map((log, index) => (
              <div key={index} className="py-1">
                {log.startsWith("Error") ? (
                  <span className="text-red-600 dark:text-red-400">{log}</span>
                ) : log.includes("successfully") ? (
                  <span className="text-green-600 dark:text-green-400">{log}</span>
                ) : (
                  <span>{log}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showConfirmation && (
        <div className="w-full bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 mt-6">
          <p className="mb-2">An existing account code was found for this email.</p>
          <p className="font-mono text-sm mb-4">Account code: {existingAccountCode}</p>
          <div className="flex gap-3">
            <button
              onClick={useExistingAccountCode}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
            >
              Use Existing Account
            </button>
            <button
              onClick={createNewAccountCode}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md"
            >
              Create New Account
            </button>
          </div>
        </div>
      )}
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
        <div className="w-full bg-white dark:bg-slate-800 rounded-lg shadow-md p-6">
          <div className="mb-6">
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
    <main className="min-h-screen p-4 md:p-12 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Email Signer</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Deploy and manage your email signer accounts
        </p>
      </header>

      <TabInterface tabs={tabs} />
    </main>
  );
}
