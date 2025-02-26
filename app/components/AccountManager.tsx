'use client';

import { useState, useEffect } from 'react';

type AccountData = {
    email: string;
    accountCode: string;
};

export default function AccountManager() {
    const [email, setEmail] = useState('');
    const [accountCode, setAccountCode] = useState('');
    const [existingAccount, setExistingAccount] = useState<AccountData | null>(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Check localStorage when email changes
    useEffect(() => {
        if (!email) return;

        // Check for existing account in localStorage
        const checkExistingAccount = () => {
            setIsLoading(true);
            try {
                const storedAccounts = localStorage.getItem('accountCodes');
                if (storedAccounts) {
                    const accounts = JSON.parse(storedAccounts) as Record<string, string>;
                    if (accounts[email]) {
                        setExistingAccount({ email, accountCode: accounts[email] });
                        setShowConfirmation(true);
                        return true;
                    }
                }
                setExistingAccount(null);
                setShowConfirmation(false);
                return false;
            } catch (error) {
                console.error('Error checking local storage:', error);
                return false;
            } finally {
                setIsLoading(false);
            }
        };

        const hasExisting = checkExistingAccount();
        if (!hasExisting) {
            createNewAccountCode();
        }
    }, [email]);

    // Generate a new account code
    const createNewAccountCode = () => {
        // Generate a random account code (you can replace with your own logic)
        const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        setAccountCode(newCode);

        if (email) {
            saveAccountCode(email, newCode);
        }
    };

    // Save account code to localStorage
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

    // Use existing account code
    const useExistingAccount = () => {
        if (existingAccount) {
            setAccountCode(existingAccount.accountCode);
            setShowConfirmation(false);
        }
    };

    // Create new account code and overwrite existing
    const createNewAccount = () => {
        createNewAccountCode();
        setShowConfirmation(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email && !showConfirmation) {
            // Continue with your application logic here
            console.log('Using account code:', accountCode, 'for email:', email);
        }
    };

    return (
        <div className="account-manager">
            <h2>Account Setup</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="email">Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>

                {isLoading && <p>Checking for existing accounts...</p>}

                {showConfirmation && existingAccount && (
                    <div className="confirmation-dialog">
                        <p>An existing account was found for {existingAccount.email}</p>
                        <p>Account code: {existingAccount.accountCode}</p>
                        <button type="button" onClick={useExistingAccount}>
                            Use Existing Account
                        </button>
                        <button type="button" onClick={createNewAccount}>
                            Create New Account
                        </button>
                    </div>
                )}

                {!showConfirmation && accountCode && (
                    <div>
                        <p>Your account code: {accountCode}</p>
                        <button type="submit">Continue</button>
                    </div>
                )}
            </form>
        </div>
    );
} 