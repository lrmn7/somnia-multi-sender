import React from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChevronDown, AlertTriangle } from "lucide-react";

export const CustomConnectButton: React.FC = () => {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className="custom-wallet-btn custom-connect-btn"
            >
              <span>Connect Wallet</span>
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="custom-wallet-btn custom-wrong-network-btn"
            >
              <AlertTriangle size={14} />
              <span>Wrong Network</span>
            </button>
          );
        }

        return (
          <div className="custom-wallet-connected-group">
            <button
              type="button"
              onClick={openChainModal}
              className="custom-wallet-btn custom-chain-btn"
              title={chain.name}
            >
              {chain.hasIcon && chain.iconUrl && (
                <img
                  alt={chain.name ?? "Chain icon"}
                  src={chain.iconUrl}
                  className="custom-chain-icon"
                />
              )}
              <span className="custom-chain-name">{chain.name}</span>
              <ChevronDown size={13} className="custom-dropdown-arrow" />
            </button>

            <button
              type="button"
              onClick={openAccountModal}
              className="custom-wallet-btn custom-account-btn"
              title={account.displayName}
            >
              <span className="custom-account-status-dot" />
              <span className="custom-account-name mono">
                {account.displayName}
              </span>
              <ChevronDown size={13} className="custom-dropdown-arrow" />
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};
