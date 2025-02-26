import { useState, useEffect } from 'react';
import { createWalletClient, custom, getAddress } from 'viem';
import { sepolia } from 'viem/chains';

interface WalletConnectProps {
    onConnect: (address: string) => void;
    onDisconnect: () => void;
    isConnected: boolean;
    address: string | null;
}

export default function WalletConnect({
    onConnect,
    onDisconnect,
    isConnected,
    address
}: WalletConnectProps) {
    const [isMetamaskInstalled, setIsMetamaskInstalled] = useState<boolean>(false);

    useEffect(() => {
        // Check if Metamask is installed
        const checkMetamask = async () => {
            const isMetamask = typeof window !== 'undefined' && window.ethereum && window.ethereum.isMetaMask;
            setIsMetamaskInstalled(!!isMetamask);
        };

        checkMetamask();
    }, []);

    const connectWallet = async () => {
        if (!window.ethereum) {
            alert('Please install MetaMask to use this feature');
            return;
        }

        try {
            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length > 0) {
                onConnect(accounts[0]);
            }
        } catch (error) {
            console.error('Error connecting to wallet:', error);
        }
    };

    const disconnectWallet = () => {
        onDisconnect();
    };

    if (!isMetamaskInstalled) {
        return (
            <div className="p-4 border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 rounded-lg">
                <p className="text-yellow-800 dark:text-yellow-200">
                    MetaMask is not installed. Please install it to use this application.
                </p>
                <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400 mt-2 inline-block"
                >
                    Download MetaMask
                </a>
            </div>
        );
    }

    return (
        <div className="flex items-center">
            {isConnected && address ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-md text-sm">
                        {`${address.substring(0, 6)}...${address.substring(address.length - 4)}`}
                    </div>
                    <button
                        onClick={disconnectWallet}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm"
                    >
                        Disconnect
                    </button>
                </div>
            ) : (
                <button
                    onClick={connectWallet}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
                >
                    Connect Metamask
                </button>
            )}
        </div>
    );
} 