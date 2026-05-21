// @ts-nocheck
"use client";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  variant = "default",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const isDanger = variant === "danger";

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div
        className="confirm-dialog"
        onClick={e => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        aria-modal="true"
      >
        {isDanger ? (
          <div className="confirm-dialog-icon confirm-dialog-icon-danger" aria-hidden="true">
            !
          </div>
        ) : null}

        <h2 id="confirm-dialog-title" className="confirm-dialog-title">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="confirm-dialog-message">
          {message}
        </p>

        <div className="confirm-dialog-foot">
          <button type="button" className="confirm-dialog-btn-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              isDanger ? "confirm-dialog-btn-confirm-danger" : "confirm-dialog-btn-confirm"
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style jsx global>{`
        .confirm-dialog-overlay {
          position: fixed;
          inset: 0;
          z-index: 70;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(6px);
        }

        .confirm-dialog {
          width: 100%;
          max-width: 460px;
          padding: 24px;
          border-radius: 24px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          box-shadow:
            0 25px 50px -12px rgba(15, 23, 42, 0.25),
            0 12px 24px rgba(15, 23, 42, 0.08);
        }

        .confirm-dialog-icon {
          width: 44px;
          height: 44px;
          margin: 0 auto 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font-size: 20px;
          font-weight: 900;
          line-height: 1;
        }

        .confirm-dialog-icon-danger {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .confirm-dialog-title {
          margin: 0;
          text-align: center;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0f172a;
        }

        .confirm-dialog-message {
          margin: 12px 0 0;
          text-align: center;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.55;
          color: #64748b;
        }

        .confirm-dialog-foot {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 24px;
        }

        .confirm-dialog-btn-cancel,
        .confirm-dialog-btn-confirm,
        .confirm-dialog-btn-confirm-danger {
          height: 46px;
          padding: 0 18px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .confirm-dialog-btn-cancel {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #475569;
        }

        .confirm-dialog-btn-cancel:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }

        .confirm-dialog-btn-confirm {
          border: 1px solid #1d4ed8;
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.22);
        }

        .confirm-dialog-btn-confirm:hover {
          background: #1d4ed8;
          border-color: #1e40af;
        }

        .confirm-dialog-btn-confirm-danger {
          border: 1px solid #b91c1c;
          background: #dc2626;
          color: #ffffff;
          box-shadow: 0 8px 20px rgba(220, 38, 38, 0.22);
        }

        .confirm-dialog-btn-confirm-danger:hover {
          background: #b91c1c;
          border-color: #991b1b;
        }

        @media (max-width: 560px) {
          .confirm-dialog-foot {
            flex-direction: column-reverse;
            align-items: stretch;
          }

          .confirm-dialog-btn-cancel,
          .confirm-dialog-btn-confirm,
          .confirm-dialog-btn-confirm-danger {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
