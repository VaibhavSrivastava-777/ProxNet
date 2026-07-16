"use client";

import { useState } from "react";

interface Contact {
  name: string;
  phoneOrEmail: string;
}

interface ContactImporterProps {
  inviteCode: string;
  onClose: () => void;
}

export function ContactImporter({ inviteCode, onClose }: ContactImporterProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [manualName, setManualName] = useState("");
  const [imported, setImported] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const inviteUrl = `${window.location.origin}/join/${inviteCode}`;

  const trackShare = async (channel: string) => {
    try {
      await fetch("/api/invite/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleNativeImport = async () => {
    setErrorMsg("");
    // Check for navigator.contacts support
    const nav = navigator as any;
    if (!nav.contacts || !nav.contacts.select) {
      setErrorMsg("Contact Picker API is not supported on this browser. Try manual input or Google Contacts.");
      return;
    }

    setLoading(true);
    try {
      const props = ["name", "tel", "email"];
      const opts = { multiple: true };
      const selection = await nav.contacts.select(props, opts);
      
      const formatted: Contact[] = selection.map((c: any) => {
        const phone = c.tel && c.tel.length > 0 ? c.tel[0] : "";
        const email = c.email && c.email.length > 0 ? c.email[0] : "";
        return {
          name: c.name && c.name.length > 0 ? c.name[0] : "Unnamed",
          phoneOrEmail: phone || email || "N/A",
        };
      }).filter((c: Contact) => c.phoneOrEmail !== "N/A");

      setContacts(formatted);
      setImported(true);
      trackShare("contacts_native");
    } catch (err: any) {
      console.error("Contact picker error:", err);
      setErrorMsg("Failed to import contacts: " + (err.message || "User cancelled"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleImport = () => {
    setErrorMsg("");
    setLoading(true);
    // Simulate OAuth and API fetch for demo purposes
    setTimeout(() => {
      setLoading(false);
      setContacts([
        { name: "Rahul Sharma", phoneOrEmail: "rahul.sharma@gmail.com" },
        { name: "Priya K.", phoneOrEmail: "+91 9876543210" },
        { name: "Ankit Singh", phoneOrEmail: "ankit.singh@yahoo.com" },
        { name: "Sneha Patel", phoneOrEmail: "+91 9812345678" }
      ]);
      setImported(true);
      trackShare("contacts_google");
    }, 1500);
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    setContacts(prev => [
      { name: manualName.trim() || "Friend", phoneOrEmail: manualInput.trim() },
      ...prev
    ]);
    setManualInput("");
    setManualName("");
    setImported(true);
  };

  const handleSendInvite = (contact: Contact) => {
    // Open whatsapp or sms automatically based on phone vs email
    const isEmail = contact.phoneOrEmail.includes("@");
    const text = `Hey ${contact.name}! Check out ProxNet. It connects professionals in our apartment complex/vicinity anonymously to share carpools, job referrals, and local recommendations. Join here: ${inviteUrl}`;
    
    if (isEmail) {
      window.open(`mailto:${contact.phoneOrEmail}?subject=Join%20our%20local%20professional%20network&body=${encodeURIComponent(text)}`);
    } else {
      // Clean up phone number
      const cleanPhone = contact.phoneOrEmail.replace(/[^0-9+]/g, "");
      window.open(`https://api.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(text)}`);
    }
    trackShare("contact_invite");
  };

  return (
    <div style={{ marginTop: 12 }} className="animate-fadeIn">
      {errorMsg && (
        <div className="badge badge-warning mb-3" style={{ display: "block", textAlign: "left", padding: 8 }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div className="spinner mb-2" />
          <p className="text-body-sm m-0" style={{ color: "var(--color-text-secondary)" }}>
            Importing contacts...
          </p>
        </div>
      ) : !imported ? (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <button
              onClick={handleNativeImport}
              className="btn btn-primary"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <span>📱</span> Import Phone List
            </button>
            <button
              onClick={handleGoogleImport}
              className="btn"
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
              }}
            >
              <span>📧</span> Connect Google
            </button>
          </div>

          <form onSubmit={handleManualAdd} className="flex flex-col gap-2 mt-2">
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-secondary)" }}>
              Or add a friend manually:
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="input"
                placeholder="Name (Optional)"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                style={{ flex: 1, minWidth: 100 }}
              />
              <input
                type="text"
                className="input"
                placeholder="Phone or Email"
                required
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                style={{ flex: 2, minWidth: 150 }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: "0 16px" }}>
                Add
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-3">
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {contacts.length} Contacts Found
            </div>
            <button
              onClick={() => {
                setContacts([]);
                setImported(false);
              }}
              className="text-primary hover:underline text-body-sm font-semibold bg-transparent border-0 cursor-pointer"
            >
              Start Over
            </button>
          </div>

          <div
            style={{
              maxHeight: 250,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              paddingRight: 4,
            }}
          >
            {contacts.map((contact, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center p-3"
                style={{
                  background: "var(--color-surface-secondary)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border-light)",
                }}
              >
                <div style={{ minWidth: 0, flex: 1, marginRight: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {contact.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {contact.phoneOrEmail}
                  </div>
                </div>
                <button
                  onClick={() => handleSendInvite(contact)}
                  className="btn btn-sm btn-primary"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                >
                  Invite
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="btn w-full mt-4"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
          >
            Close Picker
          </button>
        </div>
      )}
    </div>
  );
}
