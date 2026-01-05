// src/components/PlanModal.jsx
import React from "react";
import "../styles/Dashboard.css"; 



export default function PlanModal({ isOpen, currentPlan, mapLimit, onClose, onUpgrade }) {
  if (!isOpen) return null;

  const PlanCard = ({ title, slug, blurb, cta, emphasis }) => {
    const isCurrent = currentPlan === slug;
    const baseBtnClass = slug === "pro" || slug === "unlimited" ? "logout-button" : "card-button";

    return (
      <div
        className="plan-card"
        style={{
          border: "1px solid var(--border)",
          borderRadius: "16px",
          background: "var(--card)",
          padding: 16,
          boxShadow: "var(--shadow-1)",
        }}
      >
        <h3 style={{ margin: 0, color: "var(--ink)" }}>
          {title} {emphasis && <span style={{ fontSize: ".85rem", opacity: .8 }}>· {emphasis}</span>}
        </h3>
        <p style={{ margin: "6px 0 12px", color: "var(--muted)" }}>{blurb}</p>
        <button
          className={baseBtnClass}
          style={{ width: "100%" }}
          onClick={() => onUpgrade(slug)}
          disabled={isCurrent}
          aria-disabled={isCurrent}
        >
          {isCurrent ? "Current Plan" : cta}
        </button>
      </div>
    );
  };

  return (
    <div className="modal" tabIndex={0} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Choose a Plan</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>

        <p className="modal-subtitle">Pick a plan that matches your workflow.</p>

        <div className="modal-meta">
          Current: <strong style={{ color: "var(--ink)" }}>{currentPlan.toUpperCase()}</strong> • Limit:{" "}
          <strong style={{ color: "var(--ink)" }}>{mapLimit}</strong> maps
        </div>

        <div className="plan-grid">
          <PlanCard
            title="Free"
            slug="free"
            blurb="Up to 5 maps — great for getting started."
            cta="Switch to Free"
          />
          <PlanCard
            title="Pro"
            slug="pro"
            blurb="Up to 20 maps — room for bigger projects."
            cta="Upgrade to Pro"
            emphasis="Popular"
          />
          <PlanCard
            title="Unlimited"
            slug="unlimited"
            blurb="Unlimited maps — no limits, full freedom."
            cta="Upgrade to Unlimited"
          />
        </div>
      </div>
    </div>
  );
}
