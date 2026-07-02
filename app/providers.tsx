'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { SplashScreen } from '@/components/layout/splash';

// ─── React Query ─────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 2,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

// ─── Socket Context ──────────────────────────────────────────────────────────

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export function useSocket() {
  return useContext(SocketContext);
}

function SocketProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [socketInstance] = useState<Socket>(() => {
    // In production: connect to Railway socket server
    // In development: connect to same-origin (custom server.ts)
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ?? 
                      process.env.NEXT_PUBLIC_APP_URL ?? 
                      'http://localhost:3000';
    
    return io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
      autoConnect: false,
    });
  });

  useEffect(() => {
    socketInstance.on('connect', () => setConnected(true));
    socketInstance.on('disconnect', () => setConnected(false));
    socketInstance.connect();

    return () => {
      socketInstance.disconnect();
    };
  }, [socketInstance]);

  return (
    <SocketContext.Provider value={{ socket: socketInstance, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

// ─── Privy Ready Gate ────────────────────────────────────────────────────────

function PrivyReadyGate({ children }: { children: React.ReactNode }) {
  const { ready } = usePrivy();
  if (!ready) return <SplashScreen />;
  return <>{children}</>;
}

// ─── Root Providers ──────────────────────────────────────────────────────────

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ''}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#1800AD',
        },
        loginMethods: ['email', 'wallet'],
        embeddedWallets: {
          solana: { createOnLogin: 'users-without-wallets' },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          <PrivyReadyGate>
            {children}
          </PrivyReadyGate>
        </SocketProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
