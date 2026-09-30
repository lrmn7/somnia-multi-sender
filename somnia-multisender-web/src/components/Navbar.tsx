import React, { useState, useEffect, useRef } from "react";
import { LayoutDashboard, Menu, X } from "lucide-react";
import { BackendConfig } from "../services/api";
import { BrandLogo } from "./BrandLogo";
import { CustomConnectButton } from "./CustomConnectButton";

interface NavbarProps {
  currentView: "executor" | "dashboard";
  onSelectView: (view: "executor" | "dashboard") => void;
  isConnected: boolean;
  config: BackendConfig;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  isConnected,
  config,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 640) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileMenuOpen]);

  const handleNavSelect = (view: "executor" | "dashboard") => {
    onSelectView(view);
    setMobileMenuOpen(false);
  };

  return (
    <header className="navbar" ref={menuRef}>
      <div className="navbar-inner">
        {/* Left Branding: {m}  Multisender  [Somnia] */}
        <div className="brand-group">
          <button
            type="button"
            onClick={() => handleNavSelect("executor")}
            className="brand-link"
            aria-label="Multisender Homepage"
          >
            <BrandLogo width={42} height={26} />
            <span className="brand-product-title">Multisender</span>
          </button>
          <span className="brand-network-badge">Somnia</span>
        </div>

        {/* Desktop Navigation & Wallet Action */}
        <div className="nav-actions nav-actions-desktop">
          {isConnected && (
            <button
              type="button"
              onClick={() => onSelectView("dashboard")}
              className={`nav-link-btn ${currentView === "dashboard" ? "active" : ""}`}
              aria-current={currentView === "dashboard" ? "page" : undefined}
            >
              <LayoutDashboard size={14} />
              <span>Dashboard</span>
            </button>
          )}
          <CustomConnectButton />
        </div>

        {/* Hamburger Toggle (Mobile Only) */}
        <button
          type="button"
          className="hamburger-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Dropdown — expands inside navbar */}
      {mobileMenuOpen && (
        <nav
          className="mobile-dropdown"
          role="navigation"
          aria-label="Mobile navigation"
        >
          {isConnected && (
            <button
              type="button"
              onClick={() => handleNavSelect("dashboard")}
              className={`mobile-nav-item ${currentView === "dashboard" ? "active" : ""}`}
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </button>
          )}

          <div className="mobile-dropdown-wallet">
            <CustomConnectButton />
          </div>
        </nav>
      )}
    </header>
  );
};
