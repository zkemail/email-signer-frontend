import { useState, useEffect } from "react";
import { RELAYER_URL, RPC_URL, EMAIL_SIGNER_FACTORY_ADDRESS } from "../config";
import {
  encodeAbiParameters,
  createPublicClient,
  http,
  parseAbi,
  WalletClient,
  PublicClient,
} from "viem";
import { sepolia } from "viem/chains";
import {
  OperationType,
  SafeMultisigTransactionResponse,
} from "@safe-global/types-kit";
import SafeApiKit from "@safe-global/api-kit";

interface HashApprovalProps {
  email: string;
  setEmail: (email: string) => void;
  accountCode: string;
  setAccountCode: (code: string) => void;
  walletClient?: WalletClient;
  walletAddress?: string;
}

export default function HashApproval({
  email,
  setEmail,
  accountCode,
  setAccountCode,
  walletClient,
  walletAddress,
}: HashApprovalProps) {
  const [safeAddress, setSafeAddress] = useState("");
  const [hashToApprove, setHashToApprove] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  }>();
  const [hasAccountCode, setHasAccountCode] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [proofId, setProofId] = useState<string>();
  const [pollingInterval, setPollingInterval] = useState<
    NodeJS.Timeout | undefined
  >();
  const [emailSignerAddress, setEmailSignerAddress] = useState<string>();
  const [publicClient, setPublicClient] = useState<PublicClient>();

  // Initialize public client
  useEffect(() => {
    const client = createPublicClient({
      chain: sepolia,
      transport: http(RPC_URL),
    });
    setPublicClient(client);
  }, []);

  // Get account salt and predict email signer address when email and account code are available
  useEffect(() => {
    if (!email || !accountCode || !publicClient) return;

    const getEmailSignerAddress = async () => {
      try {
        addLog("Fetching account salt from relayer...");

        // Get the salt from the relayer
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
        setEmailSignerAddress(signerAddress);

        // Save to localStorage for future use
        try {
          const savedSigners = localStorage.getItem("emailSigners") || "{}";
          const emailSigners = JSON.parse(savedSigners);
          emailSigners[email] = signerAddress;
          localStorage.setItem("emailSigners", JSON.stringify(emailSigners));
        } catch (err) {
          console.error("Error saving email signer to localStorage:", err);
        }

        return signerAddress;
      } catch (error) {
        console.error("Error predicting email signer address:", error);
        addLog(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
        return null;
      }
    };

    getEmailSignerAddress();
  }, [email, accountCode, publicClient]);

  // Check if account code exists for the email
  useEffect(() => {
    if (!email) return;

    try {
      const storedAccounts = localStorage.getItem("accountCodes");
      if (storedAccounts) {
        const accounts = JSON.parse(storedAccounts) as Record<string, string>;
        if (accounts[email]) {
          setAccountCode(accounts[email]);
          setHasAccountCode(true);

          // Also check if there's a Safe address for this email
          const savedSafes = localStorage.getItem("userSafes");
          if (savedSafes) {
            const userSafes = JSON.parse(savedSafes);
            const safeKey = `${email}`;
            // Try both formats - with wallet address and without
            Object.keys(userSafes).forEach((key) => {
              if (key === safeKey || key.endsWith(`_${email}`)) {
                setSafeAddress(userSafes[key]);
              }
            });
          }

          // Find email signer address
          const savedSigners = localStorage.getItem("emailSigners");
          if (savedSigners) {
            const emailSigners = JSON.parse(savedSigners);
            if (emailSigners[email]) {
              setEmailSignerAddress(emailSigners[email]);
              addLog(`Found email signer address: ${emailSigners[email]}`);
            }
          }

          return;
        }
      }
      setHasAccountCode(false);
    } catch (error) {
      console.error("Error checking local storage:", error);
      setHasAccountCode(false);
    }
  }, [email, setAccountCode]);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const addLog = (message: string) => {
    setLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  // Get template ID from email signer contract
  const getTemplateId = async (signerAddress: string) => {
    if (!publicClient) {
      throw new Error("Public client not initialized");
    }

    try {
      addLog(`Getting template ID from email signer at ${signerAddress}...`);
      const emailSignerAbi = parseAbi([
        "function templateId() view returns (uint256)",
      ]);

      const templateId = await publicClient.readContract({
        address: signerAddress as `0x${string}`,
        abi: emailSignerAbi,
        functionName: "templateId",
      });

      addLog(`Retrieved template ID: ${templateId}`);

      const templateIdBigInt = templateId as bigint;
      const templateIdHex = `0x${templateIdBigInt.toString(16)}`;
      addLog(`Template ID (hex): ${templateIdHex}`);

      return templateIdHex;
    } catch (error) {
      console.error("Error getting template ID:", error);
      addLog(
        `Error getting template ID: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  };

  const getDkimContractAddress = async (signerAddress: string) => {
    if (!publicClient) {
      throw new Error("Public client not initialized");
    }

    try {
      addLog("Getting DKIM contract address...");
      const dkimContractAbi = parseAbi([
        "function dkimRegistryAddr() view returns (address)",
      ]);

      const dkimRegistryAddress = await publicClient.readContract({
        address: signerAddress as `0x${string}`,
        abi: dkimContractAbi,
        functionName: "dkimRegistryAddr",
      });

      addLog(`DKIM registry address: ${dkimRegistryAddress}`);
      return dkimRegistryAddress;
    } catch (error) {
      console.error("Error getting DKIM contract address:", error);
      addLog(
        `Error getting DKIM contract address: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  };

  const requestSignature = async () => {
    addLog("Requesting email signature...");

    if (!emailSignerAddress) {
      throw new Error("Email signer address not found");
    }

    try {
      const apiKit = new SafeApiKit({
        chainId: BigInt(sepolia.id),
        txServiceUrl: "https://dev.sepolia2.transaction.keypersafe.xyz/api",
      });
      const transaction = await apiKit.getTransaction(hashToApprove);
      const warning = hasUntrustedDelegateCall(transaction)
        ? "!!!!!!!! Transaction includes an untrusted delegate call !!!!!!!!"
        : "";

      // Get template ID from contract
      const templateId = await getTemplateId(emailSignerAddress);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const dkimRegistryAddress = await getDkimContractAddress(
        emailSignerAddress
      );
      const response = await fetch(`${RELAYER_URL}/api/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // dkimContractAddress: dkimRegistryAddress,
          // chain: "sepolia",
          accountCode,
          codeExistsInEmail: true,
          commandTemplate: "signHash {uint}",
          commandParams: [BigInt(hashToApprove).toString()],
          templateId: templateId, // Use the retrieved template ID
          emailAddress: email,
          subject: "Safe Transaction Signature Request",
          body: `${
            warning + " "
          }Please sign the safe transaction with hash: ${hashToApprove}`,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to request signature: ${await response.text()}`
        );
      }

      const data = await response.json();
      addLog(`Email sent! Proof ID: ${data.id}`);
      setProofId(data.id);
      return data.id;
    } catch (error) {
      console.error("Error requesting signature:", error);
      addLog(
        `Error requesting signature: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  };

  const hasUntrustedDelegateCall = (
    { operation, to }: SafeMultisigTransactionResponse,
    trustedForDelegateCall: string[] = []
  ): boolean => {
    return (
      operation === OperationType.DelegateCall &&
      !trustedForDelegateCall.includes(to)
    );
  };

  const pollForProof = async (emailProofId: string) => {
    addLog("Waiting for email proof...");

    // Clear any existing polling interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    let retries = 0;
    const maxRetries = 100;

    const interval = setInterval(async () => {
      try {
        if (retries >= maxRetries) {
          addLog("Timed out waiting for email proof");
          clearInterval(interval);
          setPollingInterval(undefined);
          setIsLoading(false);
          return;
        }

        const statusResponse = await fetch(
          `${RELAYER_URL}/api/status/${emailProofId}`
        );

        if (!statusResponse.ok) {
          addLog(`Error checking proof status: ${await statusResponse.text()}`);
          retries++;
          return;
        }

        const status = await statusResponse.json();

        if (status.error) {
          addLog(`Error getting proof: ${status.error}`);
          retries++;
          return;
        }

        if (status.response) {
          addLog("Email proof received!");
          clearInterval(interval);
          setPollingInterval(undefined);

          // Process the proof
          const signature = encodeAbiParameters(
            [
              {
                type: "tuple",
                components: [
                  { type: "uint256", name: "templateId" },
                  { type: "bytes[]", name: "commandParams" },
                  { type: "uint256", name: "skippedCommandPrefix" },
                  {
                    type: "tuple",
                    name: "proof",
                    components: [
                      { type: "string", name: "domainName" },
                      { type: "bytes32", name: "publicKeyHash" },
                      { type: "uint256", name: "timestamp" },
                      { type: "string", name: "maskedCommand" },
                      { type: "bytes32", name: "emailNullifier" },
                      { type: "bytes32", name: "accountSalt" },
                      { type: "bool", name: "isCodeExist" },
                      { type: "bytes", name: "proof" },
                    ],
                  },
                ],
              },
            ],
            [
              {
                templateId: status.response.templateId,
                commandParams: status.response.commandParams,
                skippedCommandPrefix: status.response.skippedCommandPrefix,
                proof: status.response.proof,
              },
            ]
          );

          addLog(`Signature generated: ${signature.slice(0, 20)}...`);

          // Approve the hash using the email signer
          addLog("Approving hash with email signer...");
          try {
            if (!publicClient) {
              throw new Error("Public client not initialized");
            }

            if (!walletClient) {
              throw new Error("Wallet not connected");
            }

            if (!walletAddress) {
              throw new Error("Wallet address not available");
            }

            const txHash = await walletClient.writeContract({
              address: emailSignerAddress as `0x${string}`,
              abi: [
                {
                  name: "approveHash",
                  type: "function",
                  inputs: [
                    { type: "bytes32", name: "hashToApprove" },
                    { type: "bytes", name: "signature" },
                    { type: "address", name: "safe" },
                  ],
                  outputs: [],
                  stateMutability: "external",
                },
              ],
              functionName: "approveHash",
              args: [hashToApprove, signature, safeAddress],
              account: walletAddress as `0x${string}`,
              chain: sepolia,
            });

            addLog(`Approval transaction hash: ${txHash}`);
            await publicClient.waitForTransactionReceipt({ hash: txHash });
            addLog("Hash approved successfully!");

            setResult({
              success: true,
              message: "Hash approved successfully",
            });
          } catch (error) {
            console.error("Error approving hash:", error);
            addLog(
              `Error approving hash: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            setResult({
              success: false,
              message: "Failed to approve hash",
            });
          } finally {
            setIsLoading(false);
          }

          return;
        }

        retries++;
      } catch (error) {
        console.error("Error polling for proof:", error);
        addLog(
          `Error polling for proof: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        retries++;
      }
    }, 2000);

    setPollingInterval(interval);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !accountCode || !safeAddress || !hashToApprove) {
      setResult({
        success: false,
        message: "All fields are required",
      });
      return;
    }

    if (!hasAccountCode) {
      setResult({
        success: false,
        message: "You need to generate an account code first",
      });
      return;
    }

    if (!walletClient) {
      setResult({
        success: false,
        message: "Wallet not connected. Please connect your wallet first.",
      });
      return;
    }

    setIsLoading(true);
    setResult(undefined);
    setLogs([]);

    try {
      // Start the email signature flow
      const emailProofId = await requestSignature();
      // Poll for the proof
      await pollForProof(emailProofId);
    } catch (error) {
      console.error("Error in approval process:", error);
      setResult({
        success: false,
        message: "An error occurred during the approval process",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-4">Approve Hash for Safe</h2>

      {!walletClient && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 dark:bg-yellow-900 dark:border-yellow-800 dark:text-yellow-200 px-4 py-3 rounded mb-4">
          <p>Wallet not connected.</p>
          <p className="mt-1">
            Please switch to the Registration tab to connect your wallet first.
          </p>
        </div>
      )}

      {!hasAccountCode && email && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 dark:bg-yellow-900 dark:border-yellow-800 dark:text-yellow-200 px-4 py-3 rounded mb-4">
          <p>No account code found for this email.</p>
          <p className="mt-1">
            Please switch to the Registration tab to generate an account code
            first.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email-approval"
            className="block text-sm font-medium mb-1"
          >
            Email Address
          </label>
          <input
            type="email"
            id="email-approval"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-slate-700"
            placeholder="your@email.com"
            required
          />
        </div>

        {hasAccountCode && (
          <div>
            <label
              htmlFor="accountCode"
              className="block text-sm font-medium mb-1"
            >
              Account Code
            </label>
            <input
              type="text"
              id="accountCode"
              value={accountCode}
              onChange={(e) => setAccountCode(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-slate-700"
              placeholder="Account Code"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Auto-loaded from your account. Edit if needed.
            </p>
          </div>
        )}

        <div>
          <label
            htmlFor="safeAddress"
            className="block text-sm font-medium mb-1"
          >
            Safe Address
          </label>
          <input
            type="text"
            id="safeAddress"
            value={safeAddress}
            onChange={(e) => setSafeAddress(e.target.value)}
            className="block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-slate-700"
            placeholder="0x..."
            required
          />
          {safeAddress && (
            <p className="text-xs text-gray-500 mt-1">
              Auto-loaded from your account. Edit if needed.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="hashToApprove"
            className="block text-sm font-medium mb-1"
          >
            Hash to Approve
          </label>
          <input
            type="text"
            id="hashToApprove"
            value={hashToApprove}
            onChange={(e) => setHashToApprove(e.target.value)}
            className="block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-slate-700"
            placeholder="0x..."
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !hasAccountCode || !walletClient}
          className={`w-full py-2 px-4 rounded-md text-white font-medium ${
            isLoading || !hasAccountCode || !walletClient
              ? "bg-green-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isLoading ? "Processing..." : "Approve Hash"}
        </button>
      </form>

      {logs.length > 0 && (
        <div className="mt-4 p-3 rounded-md bg-gray-100 dark:bg-gray-800 max-h-60 overflow-y-auto">
          <h3 className="text-sm font-medium mb-2">Process Log:</h3>
          <div className="space-y-1 text-xs font-mono">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div
          className={`mt-4 p-3 rounded-md ${
            result.success
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}
