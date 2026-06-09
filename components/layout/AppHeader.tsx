// @ts-nocheck
"use client";

import Link from "next/link";

export function AppHeader({ user, breadcrumb, actions, onLogout, authUser }) {
  const displayName =
    user?.displayName || `${user?.nome || ""} ${user?.cognome || ""}`.trim() || "Utente";
  const displaySub = user?.displaySub || "";
  const plan = user?.plan || null;
  const initials =
    user?.initials ||
    `${user?.nome?.[0] || ""}${user?.cognome?.[0] || ""}`.toUpperCase() ||
    "ST";
  const showLogout = Boolean(authUser && onLogout);

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-header-left">
          <div className="app-header-mark">ST</div>
          <div className="app-header-brand">
            <div className="app-header-brand-title">Safety Trader</div>
            <div className="app-header-brand-sub">D.Lgs. 81/2008</div>
          </div>
        </div>

        {breadcrumb ? (
          <nav className="app-header-center" aria-label="Breadcrumb">
            {breadcrumb}
          </nav>
        ) : (
          <div className="app-header-center app-header-center-empty" />
        )}

        <div className="app-header-right">
          {actions ? <div className="app-header-actions">{actions}</div> : null}
          <Link href="/account" className="app-header-user" aria-label="Account">
            <div className="app-header-avatar">{initials}</div>
            <div className="app-header-user-meta">
              <div className="app-header-user-name">{displayName}</div>
              {displaySub ? (
                <div
                  className={`app-header-user-sub${
                    plan === "free"
                      ? " app-header-plan-free"
                      : plan === "trial"
                        ? " app-header-plan-trial"
                        : plan === "paid"
                          ? " app-header-plan-paid"
                          : ""
                  }`}
                >
                  {displaySub}
                </div>
              ) : null}
            </div>
          </Link>
          {showLogout ? (
            <button type="button" className="app-header-logout" onClick={onLogout}>
              Logout
            </button>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        .app-header {
          height: 76px;
          min-height: 76px;
          max-height: 76px;
          background: #0f172a;
          border-bottom: 1px solid #1e293b;
          color: #f8fafc;
          box-shadow: 0 4px 18px rgba(15, 23, 42, 0.12);
          flex-shrink: 0;
        }

        .app-header-inner {
          height: 76px;
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          box-sizing: border-box;
        }

        .app-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
          min-width: 0;
        }

        .app-header-mark {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: #ffffff;
          color: #0f172a;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.04em;
        }

        .app-header-brand {
          min-width: 0;
          line-height: 1.2;
        }

        .app-header-brand-title {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #f8fafc;
          white-space: nowrap;
        }

        .app-header-brand-sub {
          margin-top: 2px;
          font-size: 11px;
          font-weight: 600;
          color: #93c5fd;
          white-space: nowrap;
        }

        .app-header-center {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          display: flex;
          align-items: center;
          font-size: 13px;
          color: #cbd5e1;
        }

        .app-header-center-empty {
          min-width: 8px;
        }

        .app-header-center :global(.app-header-crumb) {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .app-header-center :global(.app-header-crumb-link) {
          border: 0;
          background: none;
          padding: 0;
          color: #93c5fd;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .app-header-center :global(.app-header-crumb-link:hover) {
          color: #ffffff;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .app-header-center :global(.app-header-crumb-sep) {
          color: #475569;
          flex-shrink: 0;
        }

        .app-header-center :global(.app-header-crumb-current) {
          color: #e2e8f0;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .app-header-right {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-shrink: 0;
          height: 100%;
          max-height: 76px;
        }

        .app-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          max-height: 40px;
        }

        .app-header-actions :global(.app-header-action-btn) {
          height: 32px;
          padding: 0 12px;
          border: 1px solid #475569;
          border-radius: 10px;
          background: #1e293b;
          color: #f8fafc;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .app-header-actions :global(.app-header-action-btn:hover) {
          background: #334155;
          border-color: #64748b;
        }

        .app-header-actions :global(.app-header-status) {
          display: inline-flex;
          align-items: center;
          height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.02em;
          text-transform: capitalize;
          white-space: nowrap;
          border: 1px solid transparent;
        }

        .app-header-actions :global(.app-header-status-idoneo) {
          background: #ecfdf5;
          color: #047857;
          border-color: #a7f3d0;
        }

        .app-header-actions :global(.app-header-status-parziale) {
          background: #fff7ed;
          color: #c2410c;
          border-color: #fed7aa;
        }

        .app-header-actions :global(.app-header-status-non) {
          background: #fef2f2;
          color: #dc2626;
          border-color: #fecaca;
        }

        .app-header-actions :global(.app-header-status-da) {
          background: #f8fafc;
          color: #64748b;
          border-color: #e2e8f0;
        }

        .app-header-user {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-left: 8px;
          margin-left: 2px;
          border-left: 1px solid #334155;
          text-decoration: none;
          min-width: 0;
          max-width: 180px;
          transition: opacity 0.15s ease;
        }

        .app-header-user:hover {
          opacity: 0.92;
        }

        .app-header-avatar {
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          border-radius: 999px;
          background: #2563eb;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
        }

        .app-header-user-meta {
          display: none;
          flex-direction: column;
          min-width: 0;
          line-height: 1.2;
        }

        .app-header-user-name {
          font-size: 11px;
          font-weight: 700;
          color: #f8fafc;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .app-header-user-sub {
          font-size: 10px;
          color: #94a3b8;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .app-header-user-sub.app-header-plan-free {
          color: #cbd5e1;
          font-weight: 700;
        }

        .app-header-user-sub.app-header-plan-trial {
          color: #fcd34d;
          font-weight: 700;
        }

        .app-header-user-sub.app-header-plan-paid {
          color: #86efac;
          font-weight: 700;
        }

        .app-header-logout {
          height: 32px;
          padding: 0 12px;
          border: 1px solid #475569;
          border-radius: 10px;
          background: transparent;
          color: #e2e8f0;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }

        .app-header-logout:hover {
          background: #1e293b;
          border-color: #64748b;
          color: #ffffff;
        }

        @media (min-width: 900px) {
          .app-header-user-meta {
            display: flex;
          }
        }

        @media (max-width: 900px) {
          .app-header-center {
            display: none;
          }

          .app-header-brand-sub {
            display: none;
          }

        }

        @media (max-width: 640px) {
          .app-header-inner {
            padding: 0 16px;
            gap: 10px;
          }

          .app-header-actions {
            gap: 6px;
          }

          .app-header-actions :global(.app-header-status) {
            display: none;
          }

          .app-header-user {
            max-width: 44px;
            padding-left: 6px;
          }
        }
      `}</style>
    </header>
  );
}
