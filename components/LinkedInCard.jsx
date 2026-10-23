"use client";
/* Account → LinkedIn: connect the personal profile that blog posts are
   shared to, see until when, reconnect or disconnect. Owners and admins. */
import { useCallback, useEffect, useState } from "react";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { connectLinkedIn, daysLeft, disconnectLinkedIn, linkedinStatus } from "@/lib/linkedin";
import { dateTime } from "@/lib/format";

/* what /api/linkedin/callback sends back as ?linkedin= */
const RESULTS = {
  connected: ["LinkedIn connected. Posts you tick will be shared there.", false],
  declined: ["LinkedIn was not connected: access was not allowed.", true],
  expired: ["That took too long. Please try connecting again.", true],
  failed: ["LinkedIn could not be connected. Please try again.", true],
};

export default function LinkedInCard() {
  const { toast } = useStudio();
  const [status, setStatus] = useState(undefined);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => linkedinStatus().then(setStatus, () => setStatus(null)), []);

  useEffect(() => {
    load();
    const result = RESULTS[new URLSearchParams(window.location.search).get("linkedin")];
    if (result) {
      toast(result[0], { bad: result[1], ms: 7000 });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [load, toast]);

  async function connect() {
    setBusy(true);
    try {
      await connectLinkedIn();
    } catch (e) {
      toast(e.message, { bad: true });
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect LinkedIn? Posts will stop being shared until it is connected again.")) return;
    setBusy(true);
    try {
      await disconnectLinkedIn();
      toast("LinkedIn disconnected.");
      await load();
    } catch (e) {
      toast(e.message, { bad: true });
    } finally {
      setBusy(false);
    }
  }

  const days = daysLeft(status);

  return (
    <section className="card">
      <div>
        <h2>LinkedIn</h2>
        <p className="small muted">Blog posts with “Share on LinkedIn” ticked are posted to this profile when they go live.</p>
      </div>
      {status === undefined ? (
        <div className="spinner" />
      ) : status ? (
        <>
          <div className="row">
            <Icon name="link" size={18} />
            <div className="grow">
              <div className="title">{status.name || "Connected"}</div>
              <div className="sub">
                Connected by {status.connected_by} · {days < 0 ? "expired" : "valid until " + dateTime(status.expires_at, false)}
              </div>
            </div>
          </div>
          {days < 7 ? (
            <p className={"notice" + (days < 0 ? " notice--bad" : " notice--warn")}>
              {days < 0 ? "The connection has expired, so nothing is being shared." : "The connection runs out in " + days + " days."} LinkedIn asks for a reconnect every 60 days. It takes one click.
            </p>
          ) : null}
          <div className="btnrow">
            <button className="btn btn--sm" onClick={connect} disabled={busy}>
              Reconnect
            </button>
            <button className="btn btn--sm btn--danger" onClick={disconnect} disabled={busy}>
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <div>
          <button className="btn btn--solid" onClick={connect} disabled={busy}>
            {busy ? "Opening LinkedIn…" : "Connect LinkedIn"}
          </button>
        </div>
      )}
    </section>
  );
}
