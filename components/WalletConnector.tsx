import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

export function WalletConnector() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div className="text-center">
        <p className="text-sm text-brand-gray">Connected as:</p>
        <p className="text-lg truncate">{address}</p>
        <button
          onClick={() => disconnect()}
          className="mt-2 px-4 py-2 bg-red-500 text-white rounded-md shadow-pixel-orange-sm hover:bg-red-600 transition-all"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="px-6 py-3 bg-brand-orange text-brand-dark rounded-md shadow-pixel-orange hover:bg-opacity-80 transition-all"
    >
      Connect Admin Wallet
    </button>
  );
}