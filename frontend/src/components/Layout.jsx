import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { LogOut, Shield } from "lucide-react";

export function Layout({ children, hideNav = false }) {
  const loc = useLocation();
  const { isAdmin, logout } = useAuth();

  if (hideNav) return <div className="min-h-screen">{children}</div>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-red-900/50 bg-black/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" data-testid="header-home-link" className="flex items-center gap-2 group">
            <div className="w-9 h-9 kop-chamfer bg-gradient-to-br from-red-500 to-red-900 flex items-center justify-center font-arcade text-white text-sm kop-glow-red">
              KOP
            </div>
            <div className="hidden sm:block">
              <div className="font-arcade text-sm text-red-500 leading-none">KINGS OF PAINTBALL</div>
              <div className="font-display text-xs text-slate-400 tracking-widest">KOP 3x3</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2 flex-wrap text-xs font-display uppercase tracking-widest">
            {[
              ["/", "Home"],
              ["/register", "Inscrição"],
              ["/teams", "Teams"],
              ["/matches", "Matches"],
              ["/standings", "Standings"],
              ["/playoffs", "Playoffs"],
              ["/stats", "Stats"],
              ["/live", "Live"],
            ].map(([to, label]) => (
              <Link
                key={to}
                to={to}
                data-testid={`nav-${label.toLowerCase()}`}
                className={`px-2 py-1 hover:text-red-400 transition ${loc.pathname === to ? "text-red-500 border-b-2 border-red-500" : "text-slate-300"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <>
                <Link to="/admin" data-testid="admin-panel-link" className="flex items-center gap-1 text-xs font-display uppercase tracking-widest text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 px-2 py-1 kop-chamfer">
                  <Shield className="w-3 h-3" /> Admin
                </Link>
                <button data-testid="logout-btn" onClick={logout} className="text-slate-400 hover:text-red-500" title="Sair">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <Link to="/login" data-testid="admin-login-link" className="text-xs font-display uppercase tracking-widest text-slate-400 hover:text-red-500">
                Admin
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-red-900/30 py-4 text-center text-xs text-slate-600 font-display tracking-widest uppercase">
        3 PLAYERS. 1 TEAM. 1 CHAMPION.
      </footer>
    </div>
  );
}
