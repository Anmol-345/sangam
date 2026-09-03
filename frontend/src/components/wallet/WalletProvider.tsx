"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { User } from '@supabase/supabase-js';

import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
  useConnectModal,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider, useAccount, useDisconnect } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum, base } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { type Chain } from 'viem';

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "c0a5a6873551571d3a58e6e5893a903c";

const queryClient = new QueryClient();

// Add Botchain config
export const botchain = {
  id: 1337, // Placeholder ID
  name: 'Botchain',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.botchain.network'] },
  },
} as const satisfies Chain;

export const config = getDefaultConfig({
  appName: 'sangam.',
  projectId: walletConnectProjectId,
  chains: [botchain, mainnet, polygon, optimism, arbitrum, base],
  ssr: true,
});

export interface WalletState {
    address: string | null;
    isConnecting: boolean;
    isConnected: boolean;
    connectionError: string | null;
    supabaseUser: User | null;
    isSupabaseLoading: boolean;
    linkingErrorModal: string | null;
}

interface WalletContextType extends WalletState {
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOutGoogle: () => Promise<void>;
    clearLinkingError: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function InnerWalletProvider({ children }: { children: React.ReactNode }) {
    const { address, isConnecting, isConnected } = useAccount();
    const { disconnectAsync } = useDisconnect();
    const { openConnectModal } = useConnectModal();
    
    const [state, setState] = useState<WalletState>({
        address: null,
        isConnecting: false,
        isConnected: false,
        connectionError: null,
        supabaseUser: null,
        isSupabaseLoading: true,
        linkingErrorModal: null,
    });

    const clearLinkingError = () => setState(prev => ({ ...prev, linkingErrorModal: null }));

    // Sync Wagmi state to our WalletContext state
    useEffect(() => {
        setState(prev => ({
            ...prev,
            address: address ? (address as string) : null,
            isConnected,
            isConnecting
        }));
    }, [address, isConnected, isConnecting]);

    const linkWalletToGoogle = async (walletAddress: string, user: { id: string; email?: string; user_metadata?: Record<string, string> }) => {
        try {
            const { data: existingWallet, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .eq('wallet_address', walletAddress)
                .maybeSingle();

            if (existingWallet && existingWallet.google_id !== user.id) {
                await supabase.auth.signOut();
                setState(prev => ({ 
                    ...prev, 
                    supabaseUser: null,
                    linkingErrorModal: "This wallet is already associated with another Google account. Please sign in with the original account or connect a different wallet." 
                }));
                return;
            }

            const { error } = await supabase
                .from('users')
                .upsert({
                    google_id: user.id,
                    wallet_address: walletAddress,
                    email: user.email,
                    name: user.user_metadata?.full_name,
                    avatar_url: user.user_metadata?.avatar_url
                }, { onConflict: 'google_id' }); 
            
            if (error) {
                await supabase.auth.signOut();
                if (error.code === '23505') { 
                     setState(prev => ({ 
                         ...prev, 
                         supabaseUser: null,
                         linkingErrorModal: "This Google account is already linked to a different wallet. Please use the original Google account or connect a new wallet." 
                     }));
                } else {
                     setState(prev => ({ 
                         ...prev, 
                         supabaseUser: null,
                         linkingErrorModal: `Database Error: ${error.message} (Code: ${error.code})` 
                     }));
                }
            }
        } catch (err: unknown) {
            console.error("Exception during linking:", err);
            await supabase.auth.signOut();
            setState(prev => ({ 
                ...prev, 
                supabaseUser: null,
                linkingErrorModal: `Unexpected Error: ${err instanceof Error ? err.message : String(err)}` 
            }));
        }
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setState((prev) => ({
                ...prev,
                supabaseUser: session?.user ?? null,
                isSupabaseLoading: false,
            }));
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setState((prev) => ({
                ...prev,
                supabaseUser: session?.user ?? null,
                isSupabaseLoading: false,
            }));
            if (session?.user && address) {
                linkWalletToGoogle(address as string, session.user);
            }
        });

        return () => subscription.unsubscribe();
    }, [address]);

    const connect = async () => {
        if (openConnectModal) {
            openConnectModal();
        }
    };

    const disconnect = async () => {
        if (disconnectAsync) {
            await disconnectAsync();
        }
    };

    const signInWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: typeof window !== "undefined" ? window.location.origin : undefined
            }
        });
    };

    const signOutGoogle = async () => {
        await supabase.auth.signOut();
    };

    return (
        <WalletContext.Provider value={{ ...state, connect, disconnect, signInWithGoogle, signOutGoogle, clearLinkingError }}>
            {children}
            {state.linkingErrorModal && (
                <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
                    <div style={{ background: "var(--surface)", padding: "2.5rem", borderRadius: "16px", maxWidth: "420px", width: "100%", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", border: "1px solid var(--border)", textAlign: "center" }}>
                        <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
                            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        </div>
                        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--fg)", marginBottom: "1rem" }}>Account Conflict</h2>
                        <p style={{ color: "var(--muted-fg)", marginBottom: "2rem", lineHeight: "1.6" }}>{state.linkingErrorModal}</p>
                        <button onClick={clearLinkingError} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: "0.875rem", fontSize: "1rem", borderRadius: "8px", fontWeight: 600 }}>Got it</button>
                    </div>
                </div>
            )}
        </WalletContext.Provider>
    );
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider>
                    <InnerWalletProvider>
                        {children}
                    </InnerWalletProvider>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error("useWallet must be used within a WalletProvider");
    }
    return context;
}
