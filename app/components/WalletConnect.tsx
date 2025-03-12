import { useState, useEffect, useRef } from "react";
import {
  createWalletClient,
  custom,
  createPublicClient,
  http,
  parseAbi,
  WalletClient,
  PublicClient,
  bytesToHex,
} from "viem";
import { sepolia } from "viem/chains";
import Safe, {
  SafeAccountConfig,
  getSafeAddressFromDeploymentTx,
} from "@safe-global/protocol-kit";
import { SafeVersion } from "@safe-global/types-kit";
import { RPC_URL, RELAYER_URL, EMAIL_SIGNER_FACTORY_ADDRESS } from "../config";
import { buildPoseidon } from "circomlibjs";

interface WalletConnectProps {
  onConnect: (address: string, walletClient: WalletClient) => void;
  onDisconnect: () => void;
  isConnected: boolean;
  address: string | null;
}

type Step = "connect" | "email" | "accountCode" | "deploying" | "complete";

export default function WalletConnect({
  onConnect,
  onDisconnect,
  isConnected,
  address,
}: WalletConnectProps) {
  // Core state
  const [isMetamaskInstalled, setIsMetamaskInstalled] = useState(false);
  const [publicClient, setPublicClient] = useState<PublicClient>();
  const [walletClient, setWalletClient] = useState<WalletClient>();
  const [currentStep, setCurrentStep] = useState<Step>("connect");

  // User data
  const [email, setEmail] = useState("");
  const [accountCode, setAccountCode] = useState("");
  const [existingAccountCode, setExistingAccountCode] = useState<string | null>(
    null
  );
  const [showAccountCodeConfirmation, setShowAccountCodeConfirmation] =
    useState(false);

  // Contract addresses
  const [emailSignerAddress, setEmailSignerAddress] = useState<string | null>(
    null
  );
  const [safeAddress, setSafeAddress] = useState<string | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Add this state for copy tooltip
  const [showCopyTooltip, setShowCopyTooltip] = useState(false);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize on component mount
  useEffect(() => {
    // Check if Metamask is installed
    const checkMetamask = async () => {
      const isMetamask =
        typeof window !== "undefined" &&
        window.ethereum &&
        window.ethereum.isMetaMask;
      setIsMetamaskInstalled(!!isMetamask);
    };

    // Set up public client
    const setupClient = () => {
      const client = createPublicClient({
        chain: sepolia,
        transport: http(RPC_URL),
      });
      setPublicClient(client);
    };

    // Load email, account code, and safe address from local storage
    const loadFromLocalStorage = () => {
      const storedEmail = localStorage.getItem("emailAddress");
      if (storedEmail) {
        setEmail(storedEmail);
        const storedAccounts = localStorage.getItem("accountCodes");
        if (storedAccounts) {
          const accounts = JSON.parse(storedAccounts) as Record<string, string>;
          if (accounts[storedEmail]) {
            setAccountCode(accounts[storedEmail]);
          }
        }
        const storedSafes = localStorage.getItem("safeAddresses");
        if (storedSafes) {
          const safes = JSON.parse(storedSafes) as Record<string, string>;
          if (safes[storedEmail]) {
            setSafeAddress(safes[storedEmail]);
          }
        }
      }
    };

    checkMetamask();
    setupClient();
    loadFromLocalStorage();
  }, []);

  // Add a log message
  const addLog = (message: string) => {
    console.log(message);
    setLogs((prevLogs) => [...prevLogs, message]);
  };

  // Clear any error
  const clearError = () => setError(null);

  // Save email address to localStorage
  const saveEmailAddress = (email: string) => {
    try {
      localStorage.setItem("emailAddress", email);
      addLog(`Saved email address: ${email}`);
    } catch (error) {
      console.error("Error saving email address to local storage:", error);
    }
  };

  // Connect wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      setError("Please install MetaMask to use this feature");
      return;
    }

    try {
      setIsLoading(true);
      clearError();
      addLog("Connecting to wallet...");

      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length > 0) {
        // Switch to Sepolia network
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${sepolia.id.toString(16)}` }],
        });

        const newWalletClient = createWalletClient({
          chain: sepolia,
          transport: custom(window.ethereum),
        });

        setWalletClient(newWalletClient);
        onConnect(accounts[0], newWalletClient);
        addLog(
          `Connected to wallet: ${accounts[0].substring(
            0,
            6
          )}...${accounts[0].substring(accounts[0].length - 4)}`
        );

        setCurrentStep("email");
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setError("Failed to connect wallet. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Disconnect wallet and reset state
  const disconnectWallet = () => {
    setSafeAddress(null);
    setEmailSignerAddress(null);
    setAccountCode("");
    setEmail("");
    setCurrentStep("connect");
    setLogs([]);
    clearError();
    onDisconnect();
  };

  // Handle email submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Email address is required");
      return;
    }

    try {
      setIsLoading(true);
      clearError();
      addLog(`Using email: ${email}`);

      // Save email address to localStorage
      saveEmailAddress(email);

      // Check if we have an account code for this email
      const storedAccounts = localStorage.getItem("accountCodes");
      if (storedAccounts) {
        const accounts = JSON.parse(storedAccounts) as Record<string, string>;
        if (accounts[email] && accounts[email].startsWith("0x")) {
          setExistingAccountCode(accounts[email]);
          setShowAccountCodeConfirmation(true);
          addLog(`Found existing account code for ${email}`);
          return;
        }
      }

      // No existing account code, generate new one
      await generateNewAccountCode();
      setCurrentStep("accountCode");
    } catch (error) {
      console.error("Error checking for account code:", error);
      setError("Failed to check for existing account code");
    } finally {
      setIsLoading(false);
    }
  };

  // Generate a new account code
  const generateNewAccountCode = async () => {
    const poseidon = await buildPoseidon();
    const accountCodeBytes: Uint8Array = poseidon.F.random();
    const newCode = bytesToHex(accountCodeBytes.reverse());
    setAccountCode(newCode);
    addLog(`Generated new account code: ${newCode}`);

    if (email) {
      saveAccountCode(email, newCode);
    }
  };

  // Save account code to localStorage
  const saveAccountCode = (email: string, code: string) => {
    try {
      const storedAccounts = localStorage.getItem("accountCodes");
      const accounts = storedAccounts ? JSON.parse(storedAccounts) : {};
      accounts[email] = code;
      localStorage.setItem("accountCodes", JSON.stringify(accounts));
      addLog(`Saved account code for ${email}`);
    } catch (error) {
      console.error("Error saving to local storage:", error);
    }
  };

  // Save safe address to localStorage
  const saveSafeAddress = (email: string, address: string) => {
    try {
      const storedAddresses = localStorage.getItem("safeAddresses");
      const addresses = storedAddresses ? JSON.parse(storedAddresses) : {};
      addresses[email] = address;
      localStorage.setItem("safeAddresses", JSON.stringify(addresses));
      addLog(`Saved Safe address: ${address}`);
    } catch (error) {
      console.error("Error saving to local storage:", error);
    }
  };

  // Use existing account code
  const useExistingAccountCode = () => {
    if (existingAccountCode) {
      setAccountCode(existingAccountCode);
      setShowAccountCodeConfirmation(false);
      addLog(`Using existing account code: ${existingAccountCode}`);
      setCurrentStep("accountCode");
    }
  };

  // Create new account code instead of using existing
  const createNewAccountCodeInstead = async () => {
    await generateNewAccountCode();
    setShowAccountCodeConfirmation(false);
    setCurrentStep("accountCode");
  };

  // Get or deploy email signer
  const getOrDeployEmailSigner = async () => {
    if (!email || !accountCode || !address || !walletClient || !publicClient) {
      setError("Missing required information");
      return null;
    }

    try {
      addLog("Fetching account salt from relayer...");

      // First get the salt
      const saltResponse = await fetch(`${RELAYER_URL}/api/accountSalt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountCode: accountCode,
          emailAddress: email,
        }),
      });

      if (!saltResponse.ok) {
        throw new Error("Failed to get account salt from relayer");
      }

      const { accountSalt } = await saltResponse.json();
      addLog(`Account salt: ${accountSalt}`);

      // Get email signer factory
      const emailSignerFactoryAbi = parseAbi([
        "function predictAddress(bytes32 accountSalt) view returns (address)",
        "function deploy(bytes32 accountSalt) returns (address)",
      ]);

      // Predict the email signer address
      addLog("Predicting email signer address...");
      const signerAddress = await publicClient.readContract({
        address: EMAIL_SIGNER_FACTORY_ADDRESS as `0x${string}`,
        abi: emailSignerFactoryAbi,
        functionName: "predictAddress",
        args: [accountSalt],
      });
      addLog(`Email signer address: ${signerAddress}`);

      // Check if the email signer is already deployed
      const bytecode = await publicClient.getCode({
        address: signerAddress,
      });
      console.log(`Bytecode: ${bytecode}`);
      const isEmailSignerDeployed = bytecode !== "0x" && bytecode !== undefined;
      addLog(`Email signer contract deployed: ${isEmailSignerDeployed}`);

      // Deploy if not already deployed
      if (!isEmailSignerDeployed) {
        addLog("Deploying email signer contract...");
        const txHash = await walletClient.writeContract({
          address: EMAIL_SIGNER_FACTORY_ADDRESS as `0x${string}`,
          abi: emailSignerFactoryAbi,
          functionName: "deploy",
          args: [accountSalt],
          account: address as `0x${string}`,
          chain: sepolia,
        });

        addLog(`Deployment transaction hash: ${txHash}`);
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        addLog("Email signer contract deployed successfully");
      }

      setEmailSignerAddress(signerAddress);
      return signerAddress;
    } catch (error) {
      console.error("Error deploying email signer:", error);
      throw new Error("Failed to deploy email signer");
    }
  };

  // Deploy Safe with email signer
  const deployMultiSigSafe = async (emailSignerAddress: string) => {
    if (!address || !emailSignerAddress || !walletClient || !publicClient) {
      throw new Error("Missing required information");
    }

    try {
      addLog("Setting up Safe account...");
      console.log("Setting up Safe account...", emailSignerAddress);

      // Config for Safe deployment - 2/2 multisig with wallet and email signer
      const safeAccountConfig: SafeAccountConfig = {
        owners: [address, emailSignerAddress],
        threshold: 2, // Require both signatures
      };

      const safeVersion = "1.3.0" as SafeVersion;
      const saltNonce = Date.now().toString(); // Generate a unique nonce

      addLog("Initializing Safe deployment...");
      // Setup Safe Kit
      const protocolKit = await Safe.init({
        provider: RPC_URL,
        signer: address,
        predictedSafe: {
          safeAccountConfig,
          safeDeploymentConfig: {
            saltNonce,
            safeVersion,
          },
        },
      });

      // Predict Safe address
      const predictedSafeAddress = await protocolKit.getAddress();
      addLog(`Predicted Safe address: ${predictedSafeAddress}`);

      // Check if Safe is already deployed
      const isSafeDeployed = await protocolKit.isSafeDeployed();
      addLog(`Safe already deployed: ${isSafeDeployed}`);

      if (!isSafeDeployed) {
        // Deploy the Safe
        addLog("Creating Safe deployment transaction...");
        const deploymentTransaction =
          await protocolKit.createSafeDeploymentTransaction();

        // Send transaction to deploy Safe
        addLog("Sending Safe deployment transaction...");
        const txHash = await walletClient.sendTransaction({
          to: deploymentTransaction.to as `0x${string}`,
          value: BigInt(deploymentTransaction.value || 0),
          data: deploymentTransaction.data as `0x${string}`,
          account: address as `0x${string}`,
          chain: sepolia,
        });

        addLog(`Safe deployment transaction hash: ${txHash}`);

        // Wait for transaction receipt
        addLog("Waiting for transaction confirmation...");
        const txReceipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });
        const deployedSafeAddress = getSafeAddressFromDeploymentTx(
          txReceipt,
          safeVersion
        );
        addLog(`Safe deployed at: ${deployedSafeAddress}`);

        // Save Safe address to state and localStorage
        setSafeAddress(deployedSafeAddress);
        saveSafeAddress(email, deployedSafeAddress);

        return deployedSafeAddress;
      } else {
        // Safe already deployed
        addLog(`Using existing Safe at: ${predictedSafeAddress}`);
        setSafeAddress(predictedSafeAddress);
        saveSafeAddress(email, predictedSafeAddress);
        return predictedSafeAddress;
      }
    } catch (error) {
      console.error("Error deploying Safe:", error);
      throw new Error("Failed to deploy Safe");
    }
  };

  // Start the deployment process
  const startDeployment = async () => {
    try {
      setCurrentStep("deploying");
      setIsLoading(true);
      setLogs([]);
      clearError();

      addLog("Starting deployment process...");
      addLog(`Using email address: ${email}`);
      addLog(`Using account code: ${accountCode}`);

      // Step 1: Deploy email signer if not already deployed
      const signerAddress = await getOrDeployEmailSigner();
      if (!signerAddress) {
        throw new Error("Failed to get or deploy email signer");
      }

      // Step 2: Deploy Safe with email signer
      const safeAddr = await deployMultiSigSafe(signerAddress);
      if (!safeAddr) {
        throw new Error("Failed to deploy Safe");
      }

      // Step 3: Complete the setup
      addLog("Setup completed successfully!");
      addLog(`Email Signer Address: ${signerAddress}`);
      addLog(`Safe Address: ${safeAddr}`);

      setCurrentStep("complete");
    } catch (err) {
      console.error("Deployment error:", err);
      setError(
        `Deployment failed: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Add this function to copy account code to clipboard
  const copyAccountCodeToClipboard = () => {
    navigator.clipboard.writeText(accountCode);
    
    // Clear any existing timeout
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    
    // Show the tooltip
    setShowCopyTooltip(true);
    
    // Hide the tooltip after 2 seconds
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowCopyTooltip(false);
    }, 2000);
  };

  // Render the step content based on current step
  const renderStepContent = () => {
    // If showing account code confirmation dialog, render that
    if (showAccountCodeConfirmation) {
      return (
        <div className="rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Account Code Found</h2>
          <p className="text-[#A8A8A8] font-normal text-base leading-5 tracking-[0.32px] mb-4">
            We found an existing account code for this email address. Would you
            like to use it or create a new one?
          </p>
          <div className="flex space-x-3">
            <button
              onClick={useExistingAccountCode}
              className="flex-1 px-4 py-2 bg-white text-slate-800 hover:bg-gray-100 border border-gray-300 rounded-md font-semibold"
            >
              Use Existing
            </button>
            <button
              onClick={createNewAccountCodeInstead}
              className="flex-1 px-4 py-2 bg-white text-slate-800 hover:bg-gray-100 border border-gray-300 rounded-md font-semibold"
            >
              Create New
            </button>
          </div>
        </div>
      );
    }

    // Otherwise, render the current step
    switch (currentStep) {
      case "connect":
        return (
          <div className="rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Connect Your Wallet</h2>
            <p className="text-[#A8A8A8] font-normal text-base leading-5 tracking-[0.32px] mb-4">
              This will be one of the owners of your multisig Safe
            </p>
            <button
              onClick={connectWallet}
              disabled={isLoading}
              className={`w-full px-4 py-2 rounded-xl flex items-center justify-center ${
                isLoading 
                  ? "bg-gray-200 text-gray-500" 
                  : "bg-white text-slate-800 hover:bg-gray-100 border border-gray-300 font-semibold"
              }`}
            >
              <img 
                src="/metamask.svg" 
                alt="Metamask" 
                className="w-5 h-5 mr-2" 
              />
              {isLoading ? "Connecting..." : "Connect Metamask"}
            </button>
          </div>
        );

      case "email":
        return (
          <div className="rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Enter Your Email</h2>
            <p className="text-[#A8A8A8] font-normal text-base leading-5 tracking-[0.32px] mb-4">
              This will be used as the second authorization method for your
              multisig Safe.
            </p>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-1"
                >
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-[8px] border border-[#272727] px-3 py-2 bg-transparent focus:border-[#606060] focus:bg-[#111314] focus:shadow-[0px_0px_0px_2px_#3B3B3B] focus:outline-none"
                  placeholder="your@email.com"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !email}
                className={`w-full px-4 py-2 rounded-md font-semibold ${
                  isLoading || !email
                    ? "bg-gray-200 text-gray-500"
                    : "bg-white text-slate-800 hover:bg-gray-100 border border-gray-300"
                }`}
              >
                {isLoading ? "Processing..." : "Continue"}
              </button>
            </form>
          </div>
        );

      case "accountCode":
        return (
          <div className="rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Account Code</h2>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md mb-4">
              <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                Important: Save this account code securely! You&apos;ll need it
                to authorize operations with your email.
              </p>
            </div>
            <div className="relative">
              <div className="p-2 rounded-[8px] border border-[#272727] bg-[#161819] font-mono text-center mb-4 pr-10">
                {accountCode}
              </div>
              <button
                onClick={copyAccountCodeToClipboard}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-white"
                aria-label="Copy account code"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {showCopyTooltip && (
                  <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap">
                    Copied!
                  </div>
                )}
              </button>
            </div>
            <button
              onClick={startDeployment}
              disabled={isLoading}
              className={`w-full px-4 py-2 rounded-md font-semibold ${
                isLoading 
                  ? "bg-gray-200 text-gray-500" 
                  : "bg-white text-slate-800 hover:bg-gray-100 border border-gray-300"
              }`}
            >
              {isLoading ? "Processing..." : "Deploy Email Signer & Safe"}
            </button>
          </div>
        );

      case "deploying":
        return (
          <div className="rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Deploying...</h2>
            <div className="flex justify-center mb-4">
              <svg
                className="animate-spin h-8 w-8 text-green-600 dark:text-green-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>

            <div className="mb-4 h-48 overflow-y-auto p-3 bg-gray-100 dark:bg-slate-700 rounded-md font-mono text-sm">
              {logs.map((log, index) => (
                <div key={index} className="mb-1">
                  <span className="text-gray-500 dark:text-gray-400">
                    [{index + 1}]
                  </span>{" "}
                  {log}
                </div>
              ))}
            </div>
          </div>
        );

      case "complete":
        return (
          <div className="rounded-lg">
            <div className="mb-4 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 mb-3">
                <svg
                  className="h-6 w-6 text-green-600 dark:text-green-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold">Setup Completed!</h2>
              <p className="text-[#A8A8A8] font-normal text-base leading-5 tracking-[0.32px] mt-1">
                You&apos;ve successfully set up your email signer and Safe
                account.
              </p>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <h3 className="text-sm font-medium">Email Signer Address:</h3>
                <p className="p-2 bg-gray-100 dark:bg-slate-700 rounded-md text-sm font-mono break-all">
                  {emailSignerAddress}
                </p>
                <a
                  href={`https://sepolia.etherscan.io/address/${emailSignerAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline dark:text-green-400 text-xs mt-1 inline-block"
                >
                  View on Etherscan
                </a>
              </div>

              <div>
                <h3 className="text-sm font-medium">Safe Address:</h3>
                <p className="p-2 bg-gray-100 dark:bg-slate-700 rounded-md text-sm font-mono break-all">
                  {safeAddress}
                </p>
                <a
                  href={`https://sepolia.etherscan.io/address/${safeAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline dark:text-green-400 text-xs mt-1 inline-block"
                >
                  View on Etherscan
                </a>
              </div>

              <div>
                <h3 className="text-sm font-medium">Account Code:</h3>
                <div className="relative">
                  <p className="p-2 bg-gray-100 dark:bg-slate-700 rounded-md text-sm font-mono pr-10">
                    {accountCode}
                  </p>
                  <button
                    onClick={copyAccountCodeToClipboard}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                    aria-label="Copy account code"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {showCopyTooltip && (
                      <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap">
                        Copied!
                      </div>
                    )}
                  </button>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Save this code securely! You&apos;ll need it to approve
                  transactions.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setCurrentStep("email");
                setLogs([]);
              }}
              className="w-full px-4 py-2 bg-white text-slate-800 hover:bg-gray-100 border border-gray-300 rounded-md font-semibold"
            >
              Start Again
            </button>
          </div>
        );
    }
  };

  // Metamask not installed case
  if (!isMetamaskInstalled) {
    return (
      <div className="border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 rounded-lg w-full text-left">
        <p className="text-yellow-800 dark:text-yellow-200">
          MetaMask is not installed. Please install it to use this application.
        </p>
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-600 hover:underline dark:text-green-400 mt-2 inline-block font-semibold"
        >
          Download MetaMask
        </a>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Main content */}
      <div className="w-full text-left flex-grow">
        {renderStepContent()}
      </div>

      {/* Error display - centralized at the bottom */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 rounded-md w-full">
          <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Step indicator */}
      {currentStep !== "connect" && (
        <div className="mt-4 flex justify-center w-full">
          <div className="flex items-center space-x-2">
            {["email", "accountCode", "deploying", "complete"].map(
              (step, i) => (
                <div
                  key={step}
                  className={`h-2 w-2 rounded-full ${
                    ["email", "accountCode", "deploying", "complete"].indexOf(
                      currentStep as Step
                    ) >= i
                      ? "bg-green-600 dark:bg-green-400"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
