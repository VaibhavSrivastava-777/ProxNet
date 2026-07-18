"use client";

import { useState, useEffect } from "react";

interface Contact {
  name: string;
  phoneOrEmail: string;
}

interface ContactImporterProps {
  inviteCode: string;
  onClose: () => void;
  defaultMode?: "phone" | "google";
}

export function ContactImporter({ inviteCode, onClose, defaultMode }: ContactImporterProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [manualName, setManualName] = useState("");
  const [imported, setImported] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
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

  const loadGoogleScript = (): Promise<void> => {
    return new Promise((resolve) => {
      if ((window as any).google?.accounts?.oauth2) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  };

  const handleNativeImport = async () => {
    setErrorMsg("");
    const nav = navigator as any;

    // 1. Check if running inside native Android App (via bridge)
    if ((window as any).AndroidBridge && (window as any).AndroidBridge.startContactsImport) {
      setLoading(true);

      (window as any).onAndroidContactsReady = (jsonStringOrBase64: string, isBase64?: boolean) => {
        try {
          const decoded = isBase64 ? atob(jsonStringOrBase64) : jsonStringOrBase64;
          const parsed = JSON.parse(decoded);
          setContacts(parsed);
          setImported(true);
          trackShare("contacts_native");
        } catch (e: any) {
          setErrorMsg("Failed to parse device contacts.");
        } finally {
          setLoading(false);
        }
      };

      (window as any).onAndroidContactsError = (errMessage: string) => {
        setErrorMsg("Failed to import contacts: " + errMessage);
        setLoading(false);
      };

      (window as any).AndroidBridge.startContactsImport();
      return;
    }

    // 2. Fallback to browser W3C Contact Picker API
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
      const isPlatformLimit = err.message?.includes("Unable to open a contact selector") || err.message?.includes("not supported");
      if (isPlatformLimit) {
        setErrorMsg("Contact selector is not fully supported on this device/platform. Please use manual input or Google Contacts import.");
      } else {
        setErrorMsg("Failed to import contacts: " + (err.message || "User cancelled"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleImport = async () => {
    setErrorMsg("");
    setLoading(true);

    // 1. Check if running inside native Android App (via bridge)
    if ((window as any).AndroidBridge && (window as any).AndroidBridge.startGoogleContactsImport) {
      (window as any).onAndroidContactsReady = (jsonStringOrBase64: string, isBase64?: boolean) => {
        try {
          const decoded = isBase64 ? atob(jsonStringOrBase64) : jsonStringOrBase64;
          const parsed = JSON.parse(decoded);
          setContacts(parsed);
          setImported(true);
          trackShare("contacts_google");
        } catch (e: any) {
          setErrorMsg("Failed to parse Google contacts.");
        } finally {
          setLoading(false);
        }
      };

      (window as any).onAndroidContactsError = (errMessage: string) => {
        setErrorMsg("Failed to import Google contacts: " + errMessage);
        setLoading(false);
      };

      (window as any).AndroidBridge.startGoogleContactsImport();
      return;
    }

    // 2. Fallback to client-side Google API OAuth GIS flow in browser
    try {
      await loadGoogleScript();
      
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "901915190293-u5g61v30p01epas6vtr3pdt5v5q9bmbd.apps.googleusercontent.com";
      if (!clientId) {
        throw new Error("Google Client ID is not configured.");
      }

      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/contacts.readonly",
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            setErrorMsg("Google login failed: " + tokenResponse.error_description);
            setLoading(false);
            return;
          }
          
          try {
            const res = await fetch(
              "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=150",
              {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
              }
            );
            if (!res.ok) {
              throw new Error("Failed to load Google Contacts list.");
            }
            const body = await res.json();
            const connections = body.connections || [];
            
            const formatted: Contact[] = connections.map((person: any) => {
              const name = person.names?.[0]?.displayName || "Unnamed";
              const email = person.emailAddresses?.[0]?.value || "";
              const phone = person.phoneNumbers?.[0]?.value || "";
              return {
                name,
                phoneOrEmail: phone || email || "N/A"
              };
            }).filter((c: Contact) => c.phoneOrEmail !== "N/A");

            setContacts(formatted);
            setImported(true);
            trackShare("contacts_google");
          } catch (err: any) {
            setErrorMsg(err.message || "Failed to retrieve contacts from Google.");
          } finally {
            setLoading(false);
          }
        }
      });

      client.requestAccessToken();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to initialize Google authentication.");
      setLoading(false);
    }
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
    setShowManualForm(false);
  };

  const handleSendInvite = (contact: Contact) => {
    const isEmail = contact.phoneOrEmail.includes("@");
    const text = `Hey ${contact.name}! Check out ProxNet. It connects professionals in our apartment complex/vicinity anonymously to share carpools, job referrals, and local recommendations. Join here: ${inviteUrl}`;
    
    if (isEmail) {
      window.open(`mailto:${contact.phoneOrEmail}?subject=Join%20our%20local%20professional%20network&body=${encodeURIComponent(text)}`);
    } else {
      const cleanPhone = contact.phoneOrEmail.replace(/[^0-9+]/g, "");
      window.open(`https://api.whatsapp.com/send?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(text)}`);
    }
    trackShare("contact_invite");
  };

  // Trigger automatically if defaultMode is provided
  useEffect(() => {
    if (defaultMode === "phone") {
      handleNativeImport();
    } else if (defaultMode === "google") {
      handleGoogleImport();
    }
  }, [defaultMode]);

  // Live filter contacts based on query
  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phoneOrEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ marginTop: 12 }} className="animate-fadeIn">
      {errorMsg && (
        <div className="badge badge-warning mb-3" style={{ display: "block", textAlign: "left", padding: 8 }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div className="spinner mb-2 animate-spin" />
          <p className="text-body-sm m-0" style={{ color: "var(--color-text-secondary)" }}>
            Importing your contacts...
          </p>
        </div>
      ) : !imported && !showManualForm ? (
        <div className="flex flex-col gap-4">
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 4 }}>
            Choose how you want to invite neighbors:
          </div>
          
          {/* Facebook-style Card Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div 
              onClick={handleNativeImport}
              className="card flex items-center gap-4 p-4 cursor-pointer hover:bg-[var(--color-surface-secondary)] transition-all"
              style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border-light)" }}
            >
              <div style={{ fontSize: 28 }}>📱</div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: "0 0 2px 0", fontSize: 15, fontWeight: 700 }}>Device Contact List</h4>
                <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>
                  Import display names and numbers from your address book.
                </p>
              </div>
            </div>

            <div 
              onClick={handleGoogleImport}
              className="card flex items-center gap-4 p-4 cursor-pointer hover:bg-[var(--color-surface-secondary)] transition-all"
              style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border-light)" }}
            >
              <div style={{ fontSize: 28 }}>📧</div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: "0 0 2px 0", fontSize: 15, fontWeight: 700 }}>Google Contacts</h4>
                <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>
                  Retrieve connections from your linked Gmail profile.
                </p>
              </div>
            </div>

            <div 
              onClick={() => setShowManualForm(true)}
              className="card flex items-center gap-4 p-4 cursor-pointer hover:bg-[var(--color-surface-secondary)] transition-all"
              style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border-light)" }}
            >
              <div style={{ fontSize: 28 }}>✍️</div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: "0 0 2px 0", fontSize: 15, fontWeight: 700 }}>Add Manually</h4>
                <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>
                  Key in a custom name and contact detail directly.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : showManualForm ? (
        <div className="card p-4" style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border-light)" }}>
          <form onSubmit={handleManualAdd} className="flex flex-col gap-3">
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Add Contact Manually</h4>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                className="input"
                placeholder="Full Name"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                required
              />
              <input
                type="text"
                className="input"
                placeholder="Phone Number or Email"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2 justify-end mt-2">
              <button 
                type="button" 
                onClick={() => setShowManualForm(false)} 
                className="btn"
                style={{ border: "1px solid var(--color-border)", background: "transparent" }}
              >
                Back
              </button>
              <button type="submit" className="btn btn-primary">
                Add to List
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div>
          {/* Header Action Bar */}
          <div className="flex justify-between items-center mb-3">
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {filteredContacts.length} Contacts Found
            </div>
            <button
              onClick={() => {
                setContacts([]);
                setImported(false);
                setSearchQuery("");
              }}
              className="text-primary hover:underline text-body-sm font-semibold bg-transparent border-0 cursor-pointer"
            >
              Start Over
            </button>
          </div>

          {/* Contact Search Bar */}
          <div className="mb-3">
            <input
              type="text"
              className="input w-full"
              placeholder="Search by name or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: "8px 12px", fontSize: 13 }}
            />
          </div>

          {/* Contact List Row Container */}
          <div
            style={{
              maxHeight: 280,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              paddingRight: 4,
            }}
          >
            {filteredContacts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "var(--color-text-secondary)", fontSize: 13 }}>
                No matching contacts found.
              </div>
            ) : (
              filteredContacts.map((contact, idx) => (
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
              ))
            )}
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
