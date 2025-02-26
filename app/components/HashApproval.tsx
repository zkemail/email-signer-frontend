import { useState, useEffect } from 'react';
import { BACKEND_URL } from '../config';

interface HashApprovalProps {
    email: string;
    setEmail: (email: string) => void;
    accountCode: string;
    setAccountCode: (code: string) => void;
}

export default function HashApproval({ email, setEmail, accountCode, setAccountCode }: HashApprovalProps) {
    const [safeAddress, setSafeAddress] = useState('');
    const [hashToApprove, setHashToApprove] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [hasAccountCode, setHasAccountCode] = useState(false);

    // Check if account code exists for the email
    useEffect(() => {
        if (!email) return;

        try {
            const storedAccounts = localStorage.getItem('accountCodes');
            if (storedAccounts) {
                const accounts = JSON.parse(storedAccounts) as Record<string, string>;
                if (accounts[email]) {
                    setAccountCode(accounts[email]);
                    setHasAccountCode(true);
                    return;
                }
            }
            setHasAccountCode(false);
        } catch (error) {
            console.error('Error checking local storage:', error);
            setHasAccountCode(false);
        }
    }, [email, setAccountCode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !accountCode || !safeAddress || !hashToApprove) {
            setResult({
                success: false,
                message: 'All fields are required',
            });
            return;
        }

        if (!hasAccountCode) {
            setResult({
                success: false,
                message: 'You need to generate an account code first',
            });
            return;
        }

        setIsLoading(true);
        setResult(null);

        try {
            const response = await fetch(`${BACKEND_URL}/api/accounts/approve-hash`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    accountCode,
                    chainId: 11155111, // Sepolia testnet
                    safeAddress,
                    hashToApprove,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setResult({
                    success: true,
                    message: 'Hash approval request was successful',
                });
            } else {
                setResult({
                    success: false,
                    message: data.message || 'Failed to approve hash',
                });
            }
        } catch (error) {
            console.error('Error approving hash:', error);
            setResult({
                success: false,
                message: 'An error occurred while trying to approve the hash',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full">
            <h2 className="text-xl font-semibold mb-4">Approve Hash for Safe</h2>

            {!hasAccountCode && email && (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 dark:bg-yellow-900 dark:border-yellow-800 dark:text-yellow-200 px-4 py-3 rounded mb-4">
                    <p>No account code found for this email.</p>
                    <p className="mt-1">Please switch to the Registration tab to generate an account code first.</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="email-approval" className="block text-sm font-medium mb-1">
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

                <div>
                    <label htmlFor="safeAddress" className="block text-sm font-medium mb-1">
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
                </div>

                <div>
                    <label htmlFor="hashToApprove" className="block text-sm font-medium mb-1">
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
                    disabled={isLoading || !hasAccountCode}
                    className={`w-full py-2 px-4 rounded-md text-white font-medium ${isLoading || !hasAccountCode
                            ? 'bg-blue-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                >
                    {isLoading ? 'Processing...' : 'Approve Hash'}
                </button>
            </form>

            {result && (
                <div
                    className={`mt-4 p-3 rounded-md ${result.success
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                >
                    {result.message}
                </div>
            )}
        </div>
    );
} 